// Task 16 - the creator's presentation controller. Owns everything about quote presentation that is NOT draft content:
// the server context (tier / business default / catalog links), the saved record of the quote being edited (draft /
// issued / locked), signed thumbnail URLs, upload state, preview UI state and the post-save sync. The draft content
// itself ({ style, media, detail }) is Dashboard quote state (durable local draft) and is passed in as value + setter.
// Every network call goes through utils/quotePresentationClient.js (never throws, resolves { ok, ... }).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPresentationContext, setDefaultStyle as clientSetDefaultStyle, uploadPresentationMedia, fetchMediaUrls,
  fetchQuotePresentation, saveQuotePresentation, issueQuotePresentation,
} from '../../utils/quotePresentationClient';
import { isStyleIncluded, normalizeStyleId, normalizeTierId, STYLE_COPY } from '../../quoteDocument/quoteStyles';
import {
  addMedia, bindCatalogMedia, hasServerContent, isPristinePresentation, normalizePresentationState, resolveCreatorStyle, toServerMedia,
} from './presentationState';
import { presentationCopy, presentationErrorMessage } from './presentationCopy';
import { stashPendingPresentation, takePendingPresentation, clearPendingPresentation, __resetPendingForTests } from './pendingPresentationStore';

const URL_MAX_AGE_MS = 50 * 60 * 1000; // signed URLs live 1 h; refresh before they expire
const NON_DRAFT_STATUSES = ['sent', 'approved', 'paid'];
const FROZEN_CODES = ['quote_issued', 'quote_locked'];

// Shared across mounts (Settings tab and creator) so the context is fetched once per session and survives remounts.
let contextCache = null; // { userId, data }
const urlCache = new Map(); // assetId -> { url, at }
// Presentation choices whose server save did not happen after the quote itself was saved live in
// pendingPresentationStore.js (this device) and are re-applied as unsaved edits when that quote is opened again.

// New untouched quotes whose style-less record could not be written yet (settings not loaded at save time, or the
// write failed twice): written when the settings load, and only if the quote still has no record at all.
const styleLessQueue = new Map(); // userId -> Set(quoteId)

export function __resetPresentationCachesForTests() {
  contextCache = null;
  urlCache.clear();
  styleLessQueue.clear();
  __resetPendingForTests();
}

export async function flushStyleLessQueue({ userId, businessDefault, client }) {
  const set = styleLessQueue.get(userId);
  if (!set || !set.size) return 0;
  if (!normalizeStyleId(businessDefault) || businessDefault === 'classic') { set.clear(); return 0; } // Classic: legacy view is right
  let written = 0;
  for (const quoteId of [...set]) {
    const g = await client.fetchQuotePresentation(quoteId);
    if (!g.ok) continue; // keep queued, try on a later load
    set.delete(quoteId);
    const d = g.data || {};
    if (d.draft || d.issued || d.locked) continue; // the quote already has a record (or is frozen): never overwrite it
    const r = await client.saveQuotePresentation(quoteId, { media: [] });
    if (r && r.ok) written += 1; else set.add(quoteId);
  }
  return written;
}

export function readUrls(data) {
  const src = data && typeof data === 'object' ? (data.urls && typeof data.urls === 'object' ? data.urls : data) : {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'string' || v === null) out[k] = v;
    else if (v && typeof v === 'object' && (typeof v.url === 'string' || v.url === null)) out[k] = v.url;
  }
  return out;
}

function normalizeContext(data) {
  const d = data && typeof data === 'object' ? data : {};
  const catalogSrc = d.catalog && typeof d.catalog === 'object' ? (d.catalog.links && typeof d.catalog.links === 'object' ? d.catalog.links : d.catalog) : {};
  const catalog = {};
  for (const [k, v] of Object.entries(catalogSrc)) {
    if (v && typeof v === 'object' && typeof v.assetId === 'string') catalog[String(k).toLowerCase()] = { assetId: v.assetId, caption: typeof v.caption === 'string' ? v.caption : '' };
  }
  return {
    testMode: d.testMode === true,
    tier: normalizeTierId(d.tier),
    tierSource: d.tierSource || 'default',
    defaultStyle: normalizeStyleId(d.defaultStyle),
    catalog,
  };
}

// Local/stashed presentation applied over a READY saved record: keep the stored style when the local one is null;
// union images by assetId (stored first, no duplicates). Nothing stored is ever dropped by this merge.
export function mergePresentation(stored, local) {
  const s = normalizePresentationState(stored);
  const l = normalizePresentationState(local);
  const ids = new Set(s.media.map((m) => m.assetId));
  return normalizePresentationState({
    style: l.style ?? s.style,
    media: [...s.media, ...l.media.filter((m) => !ids.has(m.assetId))].map((m, i) => ({ ...m, order: i })),
    detail: l.detail,
  });
}

export function catalogLinkFor(catalog, serviceId) {
  if (serviceId === undefined || serviceId === null || serviceId === '') return null;
  return (catalog || {})[String(serviceId).toLowerCase()] || null;
}

export function styleTitle(lang, style) {
  const c = (lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en)[style];
  return c ? c.title : String(style || '');
}

// Pure post-save decision + calls; exported for tests. `client` is the presentation client (injectable).
//
// DATA-SAFETY RULES (review H1 / L8):
//  - `detail` is local-only and never a reason to call the server.
//  - A NEW quote is written only when it has server content (a style override or images).
//  - An EXISTING quote is written only when its saved record is KNOWN (server.status === 'ready') and the style or the
//    images actually differ from it. An unknown record (get_quote failed / still loading) is never overwritten: the
//    choice is reported as pending (kept on the device by the caller) instead - a stored premium style or images can
//    never be erased by a blind write.
//  - `style` is sent only when it changed vs the saved record (an omitted key keeps the stored style server-side);
//    null is sent only when the owner explicitly returned to the business default.
export async function syncPresentationAfterSave({
  client, quoteId, isNew, previousStatus, persistedStatus, presentation, server, businessDefault = null,
}) {
  const out = { saved: null, saveError: null, issued: null, issueError: null, issuedStyle: null, pending: false };
  if (!quoteId) return out;
  const frozen = !!(server && (server.issued || server.locked));
  const value = normalizePresentationState(presentation);
  let body = null;
  if (!frozen) {
    if (isNew) {
      if (hasServerContent(value)) {
        body = { media: toServerMedia(value.media) };
        if (value.style !== null) body.style = value.style;
      } else if (normalizeStyleId(businessDefault) && businessDefault !== 'classic') {
        // untouched new quote of a business whose default is not Classic: a style-less record makes the public draft
        // view resolve to the business default (as the preview shows) instead of the legacy Classic composition
        body = { media: [] };
        out.styleLess = true;
      }
    } else if (server && server.status === 'ready') {
      const stored = normalizePresentationState(server.draft);
      const styleChanged = value.style !== stored.style;
      const mediaChanged = JSON.stringify(toServerMedia(value.media)) !== JSON.stringify(toServerMedia(stored.media));
      if (styleChanged || mediaChanged) {
        body = { media: toServerMedia(value.media) };
        if (styleChanged) body.style = value.style;
      }
    } else if (hasServerContent(value)) {
      out.saved = false;
      out.pending = true;
      out.saveError = { code: 'presentation_record_unknown', message: '' };
    }
  }
  if (body) {
    let r = await client.saveQuotePresentation(quoteId, body);
    if (out.styleLess && !(r && r.ok)) r = await client.saveQuotePresentation(quoteId, body); // one silent retry
    if (r && r.ok) out.saved = true;
    else if (out.styleLess) { out.saved = false; out.styleLessFailed = true; } // quiet: nothing the owner chose was lost
    else { out.saved = false; out.saveError = { code: r?.code || 'unknown_error', message: r?.message || '' }; }
  }
  const prev = String(previousStatus || '').toLowerCase();
  const next = String(persistedStatus || '').toLowerCase();
  const shouldIssue = !isNew && !frozen && prev === 'draft' && NON_DRAFT_STATUSES.includes(next) && out.saved !== false;
  if (shouldIssue) {
    const r = await client.issueQuotePresentation(quoteId);
    if (r && r.ok) {
      out.issued = true;
      out.issuedStyle = normalizeStyleId(r.data?.issued?.style ?? r.data?.style) || null;
    } else {
      out.issued = false;
      out.issueError = { code: r?.code || 'unknown_error', message: r?.message || '' };
    }
  }
  return out;
}

const defaultClient = { saveQuotePresentation, issueQuotePresentation };

export default function useQuotePresentationEditor({
  enabled = true,
  userId = null,
  isHebrew = false,
  editingQuoteId = null,
  presentation,
  setPresentation,
  // returns true when a server record may replace the local value (an edit opened from the server, not a restored draft)
  shouldHydrateFromServer = () => true,
  // called with the server draft value when hydrating (Dashboard re-bases the clean-form hash)
  onHydrate,
}) {
  const lang = isHebrew ? 'he' : 'en';
  const copy = presentationCopy(lang);
  const [context, setContext] = useState(() => (contextCache && contextCache.userId === userId
    ? { status: 'ready', ...contextCache.data, error: null }
    : { status: 'idle', ...normalizeContext(null), error: null }));
  const [server, setServer] = useState({ quoteId: null, status: 'none', draft: null, issued: null, locked: false });
  const [urls, setUrls] = useState(() => {
    const o = {};
    for (const [k, v] of urlCache.entries()) o[k] = v.url;
    return o;
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [ui, setUi] = useState({ sheetOpen: false, splitHidden: false, device: 'desktop', previewStyle: null, lockedStyle: null, layout: 'stack' });
  const latest = useRef({});
  latest.current = { presentation, setPresentation, shouldHydrateFromServer, onHydrate, editingQuoteId, context, editable: true };

  // ---- context ----
  const loadContext = useCallback(async () => {
    if (!userId) return;
    setContext((c) => ({ ...c, status: 'loading', error: null }));
    const r = await fetchPresentationContext();
    if (r.ok) {
      const data = normalizeContext(r.data);
      contextCache = { userId, data };
      setContext({ status: 'ready', ...data, error: null });
    } else {
      setContext((c) => ({ ...c, status: 'error', error: { code: r.code, message: r.message } }));
    }
  }, [userId]);

  // settings loaded (or re-loaded): write any queued style-less records
  useEffect(() => {
    if (!enabled || !userId || context.status !== 'ready') return;
    flushStyleLessQueue({ userId, businessDefault: context.defaultStyle, client: { fetchQuotePresentation, saveQuotePresentation } });
  }, [enabled, userId, context.status, context.defaultStyle]);

  useEffect(() => {
    if (!enabled || !userId) return;
    if (contextCache && contextCache.userId === userId) {
      setContext({ status: 'ready', ...contextCache.data, error: null });
      return;
    }
    loadContext();
  }, [enabled, userId, loadContext]);

  // ---- signed thumbnail URLs ----
  const ensureUrls = useCallback(async (assetIds) => {
    const now = Date.now();
    const missing = [...new Set((assetIds || []).filter(Boolean))].filter((id) => {
      const hit = urlCache.get(id);
      return !hit || (hit.url && now - hit.at > URL_MAX_AGE_MS);
    });
    if (!missing.length) return;
    for (let i = 0; i < missing.length; i += 50) {
      const chunk = missing.slice(i, i + 50);
      const r = await fetchMediaUrls(chunk);
      const got = r.ok ? readUrls(r.data) : {};
      const at = Date.now();
      const patch = {};
      for (const id of chunk) {
        const url = r.ok ? (Object.prototype.hasOwnProperty.call(got, id) ? got[id] : null) : undefined;
        if (url === undefined) continue; // transport failure: leave unknown, retry later
        urlCache.set(id, { url, at });
        patch[id] = url;
      }
      if (Object.keys(patch).length) setUrls((u) => ({ ...u, ...patch }));
    }
  }, []);

  const mediaIdsKey = normalizePresentationState(presentation).media.map((m) => m.assetId).join(',');
  useEffect(() => {
    if (!enabled || !userId || !mediaIdsKey) return;
    ensureUrls(mediaIdsKey.split(','));
  }, [enabled, userId, mediaIdsKey, ensureUrls]);

  // ---- the saved record of the quote being edited ----
  // Until this record is 'ready', every presentation edit of an EXISTING quote is disabled (see `editable`): an unknown
  // record must never be overwritten or shadowed. A stashed / restored local presentation is MERGED onto the ready
  // record (server style kept when the local style is null; images unioned by assetId) and left as an unsaved change.
  const loadTokenRef = useRef(0);
  const loadServer = useCallback(async (quoteId) => {
    loadTokenRef.current += 1;
    const token = loadTokenRef.current;
    setServer({ quoteId, status: 'loading', draft: null, issued: null, locked: false });
    const r = await fetchQuotePresentation(quoteId);
    if (token !== loadTokenRef.current || latest.current.editingQuoteId !== quoteId) return;
    if (!r.ok) {
      setServer({ quoteId, status: 'error', draft: null, issued: null, locked: false, error: { code: r.code, message: r.message } });
      return;
    }
    const d = r.data || {};
    const draft = d.draft ? normalizePresentationState(d.draft) : null;
    const issued = d.issued && typeof d.issued === 'object' ? { ...d.issued, style: normalizeStyleId(d.issued.style) } : null;
    const seeded = readUrls(d.urls || {});
    if (Object.keys(seeded).length) {
      const at = Date.now();
      for (const [k, v] of Object.entries(seeded)) urlCache.set(k, { url: v, at });
      setUrls((u) => ({ ...u, ...seeded }));
    }
    setServer({ quoteId, status: 'ready', draft, issued, locked: d.locked === true });
    const L = latest.current;
    const frozenRecord = !!issued || d.locked === true;
    const stored = issued ? { style: issued.style, media: issued.media || [] } : draft;
    const pending = takePendingPresentation(userId, quoteId);
    if (!frozenRecord && pending) {
      // unsaved change (no clean-hash re-base) so the next Save retries it - merged, never replacing the record
      L.setPresentation((cur) => ({ ...mergePresentation(stored, pending), detail: normalizePresentationState(cur).detail, recordKnown: true }));
      return;
    }
    if (!frozenRecord && !L.shouldHydrateFromServer(quoteId)) {
      // a restored local draft: if it was built on a loaded record it is authoritative (removals / explicit default
      // survive); otherwise it is merged onto the ready record so nothing stored is dropped
      L.setPresentation((cur) => {
        const c = normalizePresentationState(cur);
        if (c.recordKnown) return c;
        return { ...(stored ? mergePresentation(stored, c) : c), detail: c.detail, recordKnown: true };
      });
      return;
    }
    // no stored record: keep the current value (nothing to load), only mark that the record is known
    const base = stored ? normalizePresentationState(stored) : normalizePresentationState(L.presentation);
    const next = { ...base, detail: normalizePresentationState(L.presentation).detail, recordKnown: true };
    if (L.onHydrate) L.onHydrate(next); else L.setPresentation(next);
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId || !editingQuoteId) {
      loadTokenRef.current += 1;
      setServer({ quoteId: null, status: 'none', draft: null, issued: null, locked: false });
      return;
    }
    loadServer(editingQuoteId);
  }, [enabled, userId, editingQuoteId, loadServer]);
  const reloadServer = useCallback(() => { if (latest.current.editingQuoteId) loadServer(latest.current.editingQuoteId); }, [loadServer]);

  // ---- derived ----
  const tier = context.tier;
  const businessDefault = context.defaultStyle;
  const value = useMemo(() => normalizePresentationState(presentation), [presentation]);
  const frozenStyle = server.issued?.style || null;
  const readOnly = !!(server.issued || server.locked);
  // an EXISTING quote is editable only once its saved record is known; a new quote only needs the context
  const recordReady = !editingQuoteId || server.status === 'ready';
  const editable = !readOnly && recordReady;
  const effective = useMemo(() => (frozenStyle
    ? { style: frozenStyle, source: 'issued', entitled: true }
    : resolveCreatorStyle({ presentation: value, businessDefault, tier })), [frozenStyle, value, businessDefault, tier]);
  latest.current.editable = editable;
  const previewStyle = ui.previewStyle && !readOnly ? ui.previewStyle : null;
  const shownStyle = previewStyle || effective.style;

  // ---- actions ----
  const update = useCallback((fn) => {
    if (!latest.current.editable) return;
    latest.current.setPresentation((cur) => normalizePresentationState(fn(normalizePresentationState(cur))));
  }, []);

  const chooseStyle = useCallback((style) => {
    const s = normalizeStyleId(style);
    if (!s) return { ok: false, code: 'invalid_style' };
    if (latest.current.context.status !== 'ready') return { ok: false, code: 'context_unavailable' }; // tier unknown: no change
    if (!latest.current.editable) return { ok: false, code: 'record_unavailable' };
    if (!isStyleIncluded(latest.current.context.tier, s)) {
      // locked (refined R2): the preview shows the style at once + an inline explanation; the draft style and the
      // business default never change
      setUi((u) => ({ ...u, lockedStyle: s, previewStyle: s }));
      return { ok: false, code: 'style_not_entitled' };
    }
    update((cur) => ({ ...cur, style: s }));
    setUi((u) => ({ ...u, previewStyle: null }));
    return { ok: true };
  }, [update]);

  const resetToBusinessDefault = useCallback(() => update((cur) => ({ ...cur, style: null })), [update]);
  // detail is a local-only preview preference: allowed even while the saved record is loading
  const setDetail = useCallback((detail) => latest.current.setPresentation((cur) => ({ ...normalizePresentationState(cur), detail })), []);

  const makeDefault = useCallback(async (style) => {
    const s = normalizeStyleId(style);
    if (latest.current.context.status !== 'ready') return { ok: false, code: 'context_unavailable', message: '' };
    if (!s || !isStyleIncluded(latest.current.context.tier, s)) {
      if (s) setUi((u) => ({ ...u, lockedStyle: s }));
      return { ok: false, code: 'style_not_entitled', message: 'This style is not included in the current plan' };
    }
    const r = await clientSetDefaultStyle(s);
    if (r.ok) {
      const next = normalizeStyleId(r.data?.defaultStyle) || s;
      setContext((c) => ({ ...c, defaultStyle: next }));
      if (contextCache) contextCache = { ...contextCache, data: { ...contextCache.data, defaultStyle: next } };
    }
    return r;
  }, []);

  const upload = useCallback(async (file) => {
    setUploadError(null);
    if (!latest.current.editable) return { ok: false, code: 'record_unavailable' };
    if (normalizePresentationState(latest.current.presentation).media.length >= 12) {
      setUploadError({ code: 'too_many_media' });
      return { ok: false, code: 'too_many_media' };
    }
    setUploading(true);
    try {
      const r = await uploadPresentationMedia(file);
      if (!r.ok) { setUploadError({ code: r.code, message: r.message }); return r; }
      const asset = r.data?.asset || r.data || {};
      const assetId = asset.id || asset.assetId;
      if (!assetId) { setUploadError({ code: 'invalid_response' }); return { ok: false, code: 'invalid_response' }; }
      let added = true;
      update((cur) => {
        const shown = resolveCreatorStyle({ presentation: cur, businessDefault: latest.current.context.defaultStyle, tier: latest.current.context.tier }).style;
        const role = shown === 'visual' && !cur.media.some((m) => m.role === 'hero') ? 'hero' : 'support';
        const res = addMedia(cur, { assetId, caption: '', alt: '', role, itemKey: null });
        added = res.added;
        return res.state;
      });
      ensureUrls([assetId]);
      return { ok: true, data: { assetId, added } };
    } finally {
      setUploading(false);
    }
  }, [update, ensureUrls]);

  // Catalog -> quote: the added item's service has a linked image => bind it to that row.
  const onCatalogItemAdded = useCallback((serviceId, item) => {
    const link = catalogLinkFor(latest.current.context.catalog, serviceId);
    if (!link || !item?.description || !latest.current.editable) return false;
    let added = false;
    update((cur) => {
      const res = bindCatalogMedia(cur, { assetId: link.assetId, caption: link.caption, description: item.description });
      added = res.added;
      return res.state;
    });
    return added;
  }, [update]);

  const setCatalogLink = useCallback((serviceId, link) => {
    const key = String(serviceId).toLowerCase();
    setContext((c) => {
      const catalog = { ...c.catalog };
      if (link) catalog[key] = link; else delete catalog[key];
      if (contextCache) contextCache = { ...contextCache, data: { ...contextCache.data, catalog } };
      return { ...c, catalog };
    });
  }, []);

  // Duplicate: copy the source quote's presentation (issued snapshot wins, else its draft) into the new draft,
  // only while the new draft's presentation is still untouched.
  // A request token makes a late response harmless: any newer copy or cancelCopy() (form reset / edit / restore) wins.
  // The source's style is copied only when the CURRENT tier includes it (never a premium style into a new quote);
  // its images are always kept.
  const copyTokenRef = useRef(0);
  const cancelCopy = useCallback(() => { copyTokenRef.current += 1; }, []);
  const copyFromQuote = useCallback(async (sourceQuoteId) => {
    copyTokenRef.current += 1;
    const token = copyTokenRef.current;
    if (!sourceQuoteId) return;
    const r = await fetchQuotePresentation(sourceQuoteId);
    if (token !== copyTokenRef.current || !r.ok) return;
    const d = r.data || {};
    const src = d.issued ? { style: d.issued.style, media: d.issued.media || [] } : d.draft;
    if (!src) return;
    const s = normalizeStyleId(src.style);
    const ctx = latest.current.context;
    const style = s && ctx.status === 'ready' && isStyleIncluded(ctx.tier, s) ? s : null;
    const next = normalizePresentationState({ style, media: src.media || [] });
    latest.current.setPresentation((cur) => (isPristinePresentation(cur) ? next : cur));
  }, []);

  const afterSave = useCallback(async ({ quoteId, isNew, previousStatus, persistedStatus, presentation: savedValue }) => {
    const srv = !isNew && server.quoteId === quoteId ? server : null;
    const outcome = await syncPresentationAfterSave({
      client: defaultClient, quoteId, isNew, previousStatus, persistedStatus, presentation: savedValue, server: srv,
      businessDefault: latest.current.context.status === 'ready' ? latest.current.context.defaultStyle : null,
    });
    const untouchedNew = isNew && !hasServerContent(savedValue);
    if (untouchedNew && (outcome.styleLessFailed || latest.current.context.status !== 'ready')) {
      if (!styleLessQueue.has(userId)) styleLessQueue.set(userId, new Set());
      styleLessQueue.get(userId).add(quoteId);
    }
    // quote_issued / quote_locked: the server already froze this quote's presentation (issued, or frozen when the customer
    // opened a sent link). Retrying could never succeed, so nothing is kept; the frozen presentation stays authoritative.
    if (outcome.saveError && !FROZEN_CODES.includes(outcome.saveError.code)) {
      const v = normalizePresentationState(savedValue);
      outcome.keptOn = stashPendingPresentation(userId, quoteId, { style: v.style, media: v.media, detail: null });
    } else if (outcome.saved) {
      clearPendingPresentation(userId, quoteId);
    }
    return outcome;
  }, [server, userId]);

  // Owner-facing text for an afterSave outcome: { kind: 'none'|'info'|'alert', text }
  const describeOutcome = useCallback((outcome, requestedStyle) => {
    const title = (s) => styleTitle(lang, s);
    if (outcome.styleLessFailed) return { kind: 'info', text: copy.styleLessQueued };
    if (outcome.saveError && FROZEN_CODES.includes(outcome.saveError.code)) return { kind: 'alert', text: copy.saveFrozen };
    if (outcome.saveError) {
      const reason = presentationErrorMessage(lang, outcome.saveError.code);
      return { kind: 'alert', text: outcome.keptOn === 'device' ? copy.saveFailedKept(reason) : copy.saveFailedNotKept(reason) };
    }
    if (outcome.issueError) {
      if (outcome.issueError.code === 'style_not_entitled') return { kind: 'alert', text: copy.issueNotEntitledAfterSave(title(requestedStyle)) };
      return { kind: 'alert', text: copy.issueFailed(presentationErrorMessage(lang, outcome.issueError.code)) };
    }
    if (outcome.issued) return { kind: 'info', text: copy.issued(title(outcome.issuedStyle || requestedStyle)) };
    return { kind: 'none', text: '' };
  }, [lang, copy]);

  const openPreview = useCallback(() => setUi((u) => ({ ...u, sheetOpen: u.layout === 'stack', splitHidden: false })), []);
  const closePreview = useCallback(() => setUi((u) => ({ ...u, sheetOpen: false })), []);
  const setSplitHidden = useCallback((hidden) => setUi((u) => ({ ...u, splitHidden: !!hidden })), []);
  const setDevice = useCallback((device) => setUi((u) => ({ ...u, device })), []);
  const previewLockedStyle = useCallback((style) => setUi((u) => ({ ...u, previewStyle: normalizeStyleId(style), sheetOpen: u.layout === 'stack', splitHidden: false })), []);
  const clearPreviewStyle = useCallback(() => setUi((u) => ({ ...u, previewStyle: null })), []);
  const closeLockedDialog = useCallback(() => setUi((u) => ({ ...u, lockedStyle: null, previewStyle: null })), []);
  const setLayoutMode = useCallback((layout) => setUi((u) => (u.layout === layout ? u : { ...u, layout })), []);

  return useMemo(() => ({
    lang, copy, context, reloadContext: loadContext, tier, businessDefault, server, readOnly, frozenStyle,
    value, effective, shownStyle, previewStyle, previewIsLocked: !!previewStyle && !isStyleIncluded(tier, previewStyle),
    urls, uploading, uploadError, clearUploadError: () => setUploadError(null), ui,
    chooseStyle, resetToBusinessDefault, setDetail, makeDefault, upload, update, onCatalogItemAdded, setCatalogLink, copyFromQuote, cancelCopy,
    contextReady: context.status === 'ready', recordReady, editable, reloadServer,
    afterSave, describeOutcome, openPreview, closePreview, setSplitHidden, setDevice, previewLockedStyle, clearPreviewStyle, closeLockedDialog,
    ensureUrls, setLayoutMode,
  }), [lang, copy, context, loadContext, tier, businessDefault, server, readOnly, frozenStyle, value, effective, shownStyle, previewStyle, urls,
    uploading, uploadError, ui, chooseStyle, resetToBusinessDefault, setDetail, makeDefault, upload, update, onCatalogItemAdded, setCatalogLink,
    copyFromQuote, cancelCopy, afterSave, describeOutcome, openPreview, closePreview, setSplitHidden, setDevice, previewLockedStyle, clearPreviewStyle,
    closeLockedDialog, ensureUrls, setLayoutMode, recordReady, editable, reloadServer]);
}
