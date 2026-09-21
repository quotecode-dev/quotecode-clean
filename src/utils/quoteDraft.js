// Durable local quote drafts (Owner blocker: MOBILE DRAFT LOSS, 2026-09-21).
//
// LAW: unsaved quote work must survive app backgrounding, a real page reload, renderer/process eviction and auth
// refresh - and must NEVER leak across accounts. This module is the ONE versioned draft contract + storage engine.
// It is framework-free (no React) so every rule below is unit-testable with an injected storage.
//
// Storage keys (schemaVersion 1):
//   tekango:quote-draft:v1:<project>:<userId>:new:<draftId>     - a not-yet-saved quote (many may coexist)
//   tekango:quote-draft:v1:<project>:<userId>:edit:<quoteId>    - unsaved edits of an existing quote
// The userId is part of the KEY (so another account never even enumerates it) AND of the envelope (verified on
// restore). Nothing here is encrypted - browser storage is not a vault; drafts are removed on explicit logout,
// on successful save, on explicit discard, on corruption, and after DRAFT_TTL_MS (30 days).
//
// PRIVACY: nothing in this file logs draft content; callers must only ever log outcomes/ids/booleans.

export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // Owner decision: 30 days
export const DRAFT_KEY_PREFIX = 'tekango:quote-draft:v1';
export const DRAFT_KIND = 'tekango-quote-draft';

// Every user-editable quote field that lives in Dashboard state. No material business state may be memory-only.
export const PAYLOAD_FIELDS = [
  'clientName', 'clientEmail', 'clientPhone', 'clientType', 'clientTaxId', 'clientAddress',
  'quoteSubject', 'attnName', 'attnRole', 'currency', 'quoteStatus', 'validUntil', 'discount',
  'terms', 'warranty', 'notes', 'items', 'sections', 'quoteStructureMode', 'projectName',
];

export function getDraftProjectId(url) {
  try {
    const raw = url ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : '');
    const host = new URL(raw).hostname;
    return host.split('.')[0] || 'local';
  } catch { return 'local'; }
}

export function newDraftId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* fall through */ }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function draftStorageKey({ project, userId, mode, draftId, quoteId }) {
  const id = mode === 'edit' ? quoteId : draftId;
  return `${DRAFT_KEY_PREFIX}:${project}:${userId}:${mode}:${id}`;
}

export function parseDraftKey(key) {
  if (typeof key !== 'string' || !key.startsWith(`${DRAFT_KEY_PREFIX}:`)) return null;
  const parts = key.slice(DRAFT_KEY_PREFIX.length + 1).split(':');
  if (parts.length !== 4) return null;
  const [project, userId, mode, id] = parts;
  if (!project || !userId || !id || (mode !== 'new' && mode !== 'edit')) return null;
  return { project, userId, mode, id };
}

const clone = (v) => JSON.parse(JSON.stringify(v));

// Picks exactly the persisted fields from a state bag (deep-cloned, JSON-safe).
export function snapshotFromState(state) {
  const out = {};
  for (const f of PAYLOAD_FIELDS) out[f] = clone(state?.[f] ?? null);
  return out;
}

// Stable, order-independent-of-insertion hash of the form payload (FNV-1a 32, hex). Used for "is this dirty?" and
// for the edit-mode clean baseline. Not a security primitive.
export function formHash(payload) {
  const ordered = {};
  for (const f of PAYLOAD_FIELDS) ordered[f] = payload?.[f] ?? null;
  const s = JSON.stringify(ordered);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// A NEW quote is only worth a draft when the user typed something material. Untouched defaults (default
// terms/warranty, the single empty placeholder row, currency) are not content.
export function hasMaterialContent(payload, { defaultTerms = '', defaultWarranty = '' } = {}) {
  if (!payload) return false;
  const txt = (v) => String(v ?? '').trim();
  const fields = ['clientName', 'clientEmail', 'clientPhone', 'clientTaxId', 'clientAddress', 'quoteSubject', 'attnName', 'attnRole', 'validUntil', 'discount', 'notes', 'projectName'];
  if (fields.some((f) => txt(payload[f]) !== '')) return true;
  if (txt(payload.terms) !== txt(defaultTerms) || txt(payload.warranty) !== txt(defaultWarranty)) return true;
  if ((payload.sections || []).some((s) => txt(s?.name) !== '')) return true;
  return (payload.items || []).some((it) => txt(it?.description) !== '' || txt(it?.unit_price) !== '' || (txt(it?.quantity) !== '' && txt(it?.quantity) !== '1')
    || (it?.measurements || []).length > 0 || (it?.specification || []).length > 0 || !!it?.isFromCatalog);
}

// Server-baseline fingerprint of an existing quote (as loaded into the edit form). Any change made elsewhere to a
// field the editor shows changes it, so a restored edit-draft can be checked for a stale baseline.
export function serverFingerprintFromQuote(quote) {
  if (!quote) return null;
  const items = (quote.quote_items || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).map((it) => [
    it.id, it.description ?? '', String(it.quantity ?? ''), String(it.unit_price ?? ''), it.pricing_unit ?? '', String(it.calculated_quantity ?? ''),
    it.section_id ?? '', JSON.stringify(it.specification ?? null),
    (it.quote_item_measurements || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).map((m) => [m.id, String(m.width ?? ''), String(m.height ?? ''), m.label ?? '', m.is_pricing_driving]),
  ]);
  const sections = (quote.quote_sections || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).map((s) => [s.id, s.name ?? '', s.sort_order ?? 0]);
  const base = {
    id: quote.id, status: quote.status ?? '', valid_until: quote.valid_until ?? '', terms: quote.terms ?? '', warranty: quote.warranty ?? '',
    notes: quote.notes ?? '', subject: quote.subject ?? quote.quote_subject ?? '', project_name: quote.project_name ?? '', discount: String(quote.discount ?? ''),
    total: String(quote.total ?? ''), currency: quote.currency ?? '', client: quote.clients?.company_name ?? '', attn_name: quote.attn_name ?? '', attn_role: quote.attn_role ?? '',
    updated_at: quote.updated_at ?? '', items, sections,
  };
  return formHash({ clientName: JSON.stringify(base) });
}

export function buildDraftEnvelope({
  userId, businessId = null, draftId, mode, quoteId = null, baseServerFingerprint = null, cleanFormHash = null,
  locale = null, market = null, createdAt, now = Date.now(), appBuildSha = 'unknown', payload, wizard = null,
  pendingAttachments = [], pendingAttachmentRemovals = [], attachmentsPersistFailed = [],
}) {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION, kind: DRAFT_KIND, userId, businessId, draftId, mode, quoteId,
    baseServerFingerprint, cleanFormHash, locale, market, createdAt: createdAt ?? now, updatedAt: now, appBuildSha,
    payload: snapshotFromState(payload), wizard: wizard ? clone(wizard) : null,
    pendingAttachments: pendingAttachments.map((a) => ({ blobId: a.blobId, name: a.name, size: a.size, type: a.type })),
    pendingAttachmentRemovals: [...pendingAttachmentRemovals],
    attachmentsPersistFailed: [...attachmentsPersistFailed],
  };
}

const isStr = (v) => typeof v === 'string' && v.length > 0;

export function isDraftExpired(envelope, now = Date.now()) {
  return !Number.isFinite(envelope?.updatedAt) || now - envelope.updatedAt > DRAFT_TTL_MS;
}

// Validates an already-parsed envelope for a specific authenticated user. NEVER trust storage content.
export function validateDraftEnvelope(raw, { userId, now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'corrupt' };
  if (raw.kind !== DRAFT_KIND || raw.schemaVersion !== DRAFT_SCHEMA_VERSION) return { ok: false, reason: 'schema' };
  if (!isStr(raw.userId) || !isStr(userId) || raw.userId !== userId) return { ok: false, reason: 'user' };
  if (raw.mode !== 'new' && raw.mode !== 'edit') return { ok: false, reason: 'shape' };
  if (!isStr(raw.draftId)) return { ok: false, reason: 'shape' };
  if (raw.mode === 'edit' && !isStr(raw.quoteId)) return { ok: false, reason: 'shape' };
  if (!raw.payload || typeof raw.payload !== 'object' || !Array.isArray(raw.payload.items) || !Array.isArray(raw.payload.sections)) return { ok: false, reason: 'shape' };
  if (!Array.isArray(raw.pendingAttachments) || !Array.isArray(raw.pendingAttachmentRemovals)) return { ok: false, reason: 'shape' };
  if (isDraftExpired(raw, now)) return { ok: false, reason: 'expired' };
  return { ok: true, envelope: raw };
}

function classifyStorageError(e) {
  const name = String(e?.name || '');
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || e?.code === 22 || e?.code === 1014) return 'quota';
  return 'unavailable';
}

// What to do with a validated draft at restore time. NEVER overwrite a saved quote that changed on the server:
//  new draft                      -> 'restore-new'
//  edit, quote gone/immutable     -> 'conflict-unavailable' (offer: review as a copy / discard)
//  edit, server baseline changed  -> 'conflict-changed'     (offer: review copy / use saved / discard)
//  edit, baseline unchanged       -> 'restore-edit'
export function decideRestore(envelope, quote, { immutable = false } = {}) {
  if (!envelope) return 'none';
  if (envelope.mode === 'new') return 'restore-new';
  if (!quote || immutable) return 'conflict-unavailable';
  return serverFingerprintFromQuote(quote) === envelope.baseServerFingerprint ? 'restore-edit' : 'conflict-changed';
}

// Injected storage keeps this testable and lets the app degrade visibly when storage is blocked (private mode).
export function createDraftStore({ storage, project = getDraftProjectId(), now = () => Date.now() } = {}) {
  const st = () => {
    try { return storage ?? globalThis.localStorage ?? null; } catch { return null; }
  };
  const keysWithPrefix = () => {
    const s = st(); const out = [];
    if (!s) return out;
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(`${DRAFT_KEY_PREFIX}:`)) out.push(k); }
    return out;
  };
  const store = {
    project,
    // Probe: is durable draft storage usable right now? (private/blocked storage throws)
    probe() {
      const s = st();
      if (!s) return { ok: false, error: 'unavailable' };
      try { const k = `${DRAFT_KEY_PREFIX}:probe`; s.setItem(k, '1'); s.removeItem(k); return { ok: true }; } catch (e) { return { ok: false, error: classifyStorageError(e) }; }
    },
    keyFor(userId, mode, id) { return draftStorageKey({ project, userId, mode, draftId: id, quoteId: id }); },
    save(envelope) {
      const s = st();
      if (!s) return { ok: false, error: 'unavailable' };
      let text;
      try { text = JSON.stringify(envelope); } catch { return { ok: false, error: 'serialize' }; }
      try {
        s.setItem(draftStorageKey({ project, userId: envelope.userId, mode: envelope.mode, draftId: envelope.draftId, quoteId: envelope.quoteId }), text);
        return { ok: true };
      } catch (e) { return { ok: false, error: classifyStorageError(e) }; }
    },
    remove(key) { try { st()?.removeItem(key); } catch { /* ignore */ } },
    removeFor(userId, mode, id) { store.remove(store.keyFor(userId, mode, id)); },
    // All VALID drafts for THIS user only (other users' keys are never parsed). Corrupt/expired/mismatched entries
    // of this user are deleted as a side effect. Newest first.
    listForUser(userId) {
      const s = st(); const out = [];
      if (!s || !isStr(userId)) return out;
      const prefix = `${DRAFT_KEY_PREFIX}:${project}:${userId}:`;
      for (const key of keysWithPrefix()) {
        if (!key.startsWith(prefix)) continue;
        let parsed;
        try { parsed = JSON.parse(s.getItem(key)); } catch { parsed = null; }
        const v = validateDraftEnvelope(parsed, { userId, now: now() });
        if (!v.ok) { store.remove(key); continue; }
        const k = parseDraftKey(key);
        if (!k || (k.mode === 'edit' ? k.id !== v.envelope.quoteId : k.id !== v.envelope.draftId) || k.mode !== v.envelope.mode) { store.remove(key); continue; }
        out.push({ key, envelope: v.envelope });
      }
      return out.sort((a, b) => b.envelope.updatedAt - a.envelope.updatedAt);
    },
    latestNew(userId) { return store.listForUser(userId).find((d) => d.envelope.mode === 'new') || null; },
    editFor(userId, quoteId) { return store.listForUser(userId).find((d) => d.envelope.mode === 'edit' && d.envelope.quoteId === quoteId) || null; },
    // Explicit-logout purge: removes every draft key of this user (valid or not) and reports the draft ids so the
    // caller can purge their IndexedDB blobs.
    purgeUser(userId) {
      const s = st(); const draftIds = []; let removed = 0;
      if (!s || !isStr(userId)) return { removed, draftIds };
      const prefix = `${DRAFT_KEY_PREFIX}:${project}:${userId}:`;
      for (const key of keysWithPrefix()) {
        if (!key.startsWith(prefix)) continue;
        try { const p = JSON.parse(s.getItem(key)); if (p?.draftId) draftIds.push(p.draftId); } catch { /* corrupt - still removed */ }
        store.remove(key); removed++;
      }
      return { removed, draftIds };
    },
    // TTL/corruption sweep over ALL users' draft keys WITHOUT exposing content: only updatedAt is read.
    cleanupExpired() {
      const s = st(); let removed = 0; const entries = [];
      if (!s) return { removed, entries };
      for (const key of keysWithPrefix()) {
        if (key === `${DRAFT_KEY_PREFIX}:probe`) continue;
        let p;
        try { p = JSON.parse(s.getItem(key)); } catch { p = null; }
        if (!p || typeof p !== 'object' || !Number.isFinite(p.updatedAt) || isDraftExpired(p, now())) {
          const k = parseDraftKey(key);
          if (k && p?.draftId) entries.push({ userId: k.userId, draftId: p.draftId });
          store.remove(key); removed++;
        }
      }
      return { removed, entries };
    },
  };
  return store;
}

// Registry so unrelated UI (the "new version available" banner) can force every live persistence hook to flush
// synchronously BEFORE it reloads the page.
const flushers = new Set();
export function registerDraftFlush(fn) { flushers.add(fn); return () => flushers.delete(fn); }
export function flushAllDrafts() { for (const f of [...flushers]) { try { f(); } catch { /* best effort */ } } }

// After an explicit logout purge, the unmounting editor must not re-write the draft it just lost (its cleanup flush
// runs AFTER the purge). Writes for that user stay suppressed until they authenticate again.
const suppressed = new Set();
export function suppressDraftWrites(userId) { if (userId) suppressed.add(userId); }
export function allowDraftWrites(userId) { suppressed.delete(userId); }
export function isDraftWriteSuppressed(userId) { return suppressed.has(userId); }
