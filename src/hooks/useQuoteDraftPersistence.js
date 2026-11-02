import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDraftEnvelope, createDraftStore, formHash, hasMaterialContent, isDraftWriteSuppressed, registerDraftFlush } from '../utils/quoteDraft';
import { getBlobStore } from '../utils/draftAttachments';
import { CURRENT_BUILD_SHA } from '../shared/versionAwareness';
import { diagLog } from '../utils/returnDiag';

// Debounced (350 ms) durable persistence of the quote editor, with an IMMEDIATE synchronous flush on
// visibilitychange->hidden / pagehide / freeze / unmount (never beforeunload, which mobile browsers skip).
// New attachment blobs are staged in IndexedDB the moment they are added (not debounced). Status is honest:
// 'saved' only after the envelope was actually written; 'error' when storage refused (quota/blocked).
const DEBOUNCE_MS = 350;

export default function useQuoteDraftPersistence({
  enabled, userId, businessId = null, locale = null, market = null,
  mode, quoteId = null, draftId, payload, wizard = null, files = [], pendingRemovals = [],
  baseServerFingerprint = null, cleanFormHash = null, defaults = {}, createdAt = null,
  store: injectedStore, blobStore: injectedBlobStore,
}) {
  const store = useMemo(() => injectedStore || createDraftStore(), [injectedStore]);
  const blobStore = useMemo(() => injectedBlobStore || getBlobStore(), [injectedBlobStore]);
  const [status, setStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const [attachmentsWarning, setAttachmentsWarning] = useState([]);
  const latest = useRef({});
  latest.current = { enabled, userId, businessId, locale, market, mode, quoteId, draftId, payload, wizard, files, pendingRemovals, baseServerFingerprint, cleanFormHash, defaults, createdAt };
  const blobIds = useRef(new Map()); // File object -> blobId (persisted in IndexedDB)
  const running = useRef(false);
  const rerun = useRef(false);
  const timer = useRef(null);
  const createdRef = useRef(null);

  const isDirty = useCallback(() => {
    const a = latest.current;
    const newFiles = (a.files || []).filter((f) => !f.id);
    if (a.mode === 'edit' && a.cleanFormHash == null) return false; // baseline not captured yet: an untouched edit is not a draft
    if (a.mode === 'edit') return formHash(a.payload) !== a.cleanFormHash || (a.pendingRemovals || []).length > 0 || newFiles.length > 0 || !!a.wizard?.open;
    return hasMaterialContent(a.payload, a.defaults) || newFiles.length > 0 || !!a.wizard?.open;
  }, []);

  const currentKey = () => { const a = latest.current; return store.keyFor(a.userId, a.mode, a.mode === 'edit' ? a.quoteId : a.draftId); };

  const makeEnvelope = (failed = []) => {
    const a = latest.current;
    if (!createdRef.current || createdRef.current.id !== `${a.mode}:${a.mode === 'edit' ? a.quoteId : a.draftId}`) createdRef.current = { id: `${a.mode}:${a.mode === 'edit' ? a.quoteId : a.draftId}`, at: a.createdAt || Date.now() };
    const pending = (a.files || []).filter((f) => !f.id).map((f) => ({ f, blobId: blobIds.current.get(f) })).filter((x) => x.blobId)
      .map(({ f, blobId }) => ({ blobId, name: f.name, size: f.size, type: f.type || '' }));
    return buildDraftEnvelope({
      userId: a.userId, businessId: a.businessId, draftId: a.mode === 'edit' ? `edit-${a.quoteId}` : a.draftId, mode: a.mode, quoteId: a.mode === 'edit' ? a.quoteId : null,
      baseServerFingerprint: a.baseServerFingerprint, cleanFormHash: a.cleanFormHash, locale: a.locale, market: a.market, createdAt: createdRef.current.at,
      appBuildSha: CURRENT_BUILD_SHA, payload: a.payload, wizard: a.wizard, pendingAttachments: pending, pendingAttachmentRemovals: a.pendingRemovals || [], attachmentsPersistFailed: failed,
    });
  };

  const writeEnvelope = (failed = []) => {
    if (isDraftWriteSuppressed(latest.current.userId)) return { ok: true, suppressed: true };
    const res = store.save(makeEnvelope(failed));
    if (res.ok) { setStatus('saved'); setLastSavedAt(Date.now()); setError(null); diagLog('draft-persist', { outcome: 'saved', mode: latest.current.mode }); }
    else { setStatus('error'); setError(res.error); diagLog('draft-persist', { outcome: 'error', reason: res.error }); }
    return res;
  };

  const persistNow = useCallback(async () => {
    if (running.current) { rerun.current = true; return; }
    running.current = true;
    try {
      do {
        rerun.current = false;
        const a = latest.current;
        if (!a.enabled || !a.userId) break;
        if (!isDirty()) {
          store.remove(currentKey());
          const draftKey = a.mode === 'edit' ? `edit-${a.quoteId}` : a.draftId;
          if (blobIds.current.size) { await blobStore.deleteDraft(a.userId, draftKey); blobIds.current.clear(); }
          setStatus('idle'); setAttachmentsWarning([]);
          continue;
        }
        const draftKey = a.mode === 'edit' ? `edit-${a.quoteId}` : a.draftId;
        const newFiles = (a.files || []).filter((f) => !f.id);
        const failed = [];
        for (const f of newFiles) {
          if (!blobIds.current.has(f)) {
            const r = await blobStore.putFile(a.userId, draftKey, f);
            if (r.ok) blobIds.current.set(f, r.blobId); else failed.push(f.name);
          }
        }
        // drop blobs of files that are no longer attached
        for (const [f, id] of [...blobIds.current.entries()]) { if (!newFiles.includes(f)) { await blobStore.deleteBlob(id); blobIds.current.delete(f); } }
        setAttachmentsWarning(failed);
        writeEnvelope(failed);
      } while (rerun.current);
    } finally { running.current = false; }
  }, [store, blobStore, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // synchronous flush: last-chance write of the envelope with whatever blobs are already staged
  const flushSync = useCallback(() => {
    const a = latest.current;
    if (!a.enabled || !a.userId) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!isDirty()) { store.remove(currentKey()); return; }
    const failed = (a.files || []).filter((f) => !f.id && !blobIds.current.has(f)).map((f) => f.name);
    writeEnvelope(failed);
    persistNow(); // finish any pending blob writes in the background
  }, [store, isDirty, persistNow]); // eslint-disable-line react-hooks/exhaustive-deps

  const sig = `${enabled}|${userId}|${mode}|${quoteId}|${draftId}|${formHash(payload)}|${JSON.stringify(payload?.items || []).length}|${(files || []).length}|${(pendingRemovals || []).join(',')}|${JSON.stringify(wizard || null)}`;
  const filesSig = (files || []).map((f) => (f.id ? `i${f.id}` : `n${f.name}:${f.size}`)).join(',');

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; persistNow(); }, DEBOUNCE_MS);
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [sig, enabled, userId, persistNow]);

  // attachments are staged immediately (a picked file must never wait for a debounce)
  useEffect(() => { if (enabled && userId && (files || []).some((f) => !f.id)) persistNow(); }, [filesSig, enabled, userId, persistNow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    const onVis = () => { if (document.visibilityState === 'hidden') flushSync(); };
    const onHide = () => flushSync();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('freeze', onHide);
    const unregister = registerDraftFlush(flushSync);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('freeze', onHide);
      unregister();
      flushSync(); // unmount (sign-out, route change): never lose the last edits
    };
  }, [enabled, userId, flushSync]);

  // Removes THIS draft (explicit discard or successful save). Blobs are purged too.
  const discard = useCallback(async () => {
    const a = latest.current;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    store.remove(currentKey());
    if (a.userId) await blobStore.deleteDraft(a.userId, a.mode === 'edit' ? `edit-${a.quoteId}` : a.draftId);
    blobIds.current.clear(); setStatus('idle'); setAttachmentsWarning([]);
  }, [store, blobStore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Registers files restored from IndexedDB (File -> existing blobId) so persistence reuses them instead of re-staging copies.
  const adopt = useCallback((pairs) => { for (const { file, blobId } of pairs || []) blobIds.current.set(file, blobId); }, []);

  return { status, lastSavedAt, error, attachmentsWarning, flush: flushSync, discard, adopt, isDirty, store, blobStore };
}
