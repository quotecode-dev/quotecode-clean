import { describe, it, expect, beforeEach } from 'vitest';
import {
  DRAFT_KEY_PREFIX, DRAFT_SCHEMA_VERSION, DRAFT_TTL_MS, PAYLOAD_FIELDS, allowDraftWrites, buildDraftEnvelope, createDraftStore, decideRestore, draftStorageKey,
  flushAllDrafts, formHash, hasMaterialContent, isDraftWriteSuppressed, isDraftExpired, parseDraftKey, registerDraftFlush, serverFingerprintFromQuote,
  snapshotFromState, suppressDraftWrites, validateDraftEnvelope,
} from './quoteDraft';

// In-memory Storage double (same surface the store uses: length/key/getItem/setItem/removeItem)
function memStorage(opts = {}) {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts.throwOn) throw opts.throwOn; m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _m: m,
  };
}
const NOW = 1_800_000_000_000;
const payload = (over = {}) => ({
  clientName: 'ACME', clientEmail: 'a@b.co', clientPhone: '', clientType: 'business', clientTaxId: '', clientAddress: '', quoteSubject: 'S', attnName: '', attnRole: '',
  currency: 'ILS', quoteStatus: 'Draft', validUntil: '2026-12-31', discount: '5', terms: 'T', warranty: 'W', notes: 'N',
  items: [{ description: 'Door', quantity: '2', unit_price: '100', section_key: 'k1', measurements: [{ width: 1, height: 2 }], specification: [{ k: 'v' }] }],
  sections: [{ key: 'k1', name: 'Kitchen', sort_order: 0 }], quoteStructureMode: 'divided', projectName: 'Villa', ...over,
});
const env = (over = {}) => buildDraftEnvelope({ userId: 'u1', businessId: 'b1', draftId: 'd1', mode: 'new', payload: payload(), now: NOW, locale: 'he', market: 'Local', ...over });

describe('draft contract', () => {
  it('persists EVERY user-editable quote field (no material state stays memory-only)', () => {
    expect(PAYLOAD_FIELDS).toEqual(expect.arrayContaining(['clientName', 'clientEmail', 'clientPhone', 'clientType', 'clientTaxId', 'clientAddress', 'quoteSubject', 'attnName', 'attnRole', 'currency', 'quoteStatus', 'validUntil', 'discount', 'terms', 'warranty', 'notes', 'items', 'sections', 'quoteStructureMode', 'projectName']));
    const snap = snapshotFromState(payload());
    expect(Object.keys(snap).sort()).toEqual([...PAYLOAD_FIELDS].sort());
    expect(snap.items[0].measurements).toEqual([{ width: 1, height: 2 }]); // measurement rows, specifications, sections, ordering survive
    expect(snap.items[0].specification).toEqual([{ k: 'v' }]);
    expect(snap.items[0].section_key).toBe('k1');
    expect(snap.projectName).toBe('Villa');
  });
  it('envelope carries the contract fields', () => {
    const e = env({ mode: 'edit', quoteId: 'q1', baseServerFingerprint: 'fp', cleanFormHash: 'ch', pendingAttachments: [{ blobId: 'b', name: 'f.pdf', size: 3, type: 'application/pdf' }], pendingAttachmentRemovals: ['a1'] });
    expect(e).toMatchObject({ schemaVersion: DRAFT_SCHEMA_VERSION, userId: 'u1', businessId: 'b1', draftId: 'd1', mode: 'edit', quoteId: 'q1', baseServerFingerprint: 'fp', locale: 'he', market: 'Local', createdAt: NOW, updatedAt: NOW, appBuildSha: 'unknown' });
    expect(e.pendingAttachments).toEqual([{ blobId: 'b', name: 'f.pdf', size: 3, type: 'application/pdf' }]);
    expect(e.pendingAttachmentRemovals).toEqual(['a1']);
  });
  it('key shapes: new by draft UUID, edit by quote id; parse round-trips', () => {
    expect(draftStorageKey({ project: 'p', userId: 'u1', mode: 'new', draftId: 'd1' })).toBe(`${DRAFT_KEY_PREFIX}:p:u1:new:d1`);
    expect(draftStorageKey({ project: 'p', userId: 'u1', mode: 'edit', quoteId: 'q9' })).toBe(`${DRAFT_KEY_PREFIX}:p:u1:edit:q9`);
    expect(parseDraftKey(`${DRAFT_KEY_PREFIX}:p:u1:edit:q9`)).toEqual({ project: 'p', userId: 'u1', mode: 'edit', id: 'q9' });
    expect(parseDraftKey('other:key')).toBeNull();
    expect(parseDraftKey(`${DRAFT_KEY_PREFIX}:p:u1:weird:q9`)).toBeNull();
  });
  it('TTL is 30 days', () => {
    expect(DRAFT_TTL_MS).toBe(30 * 24 * 3600 * 1000);
    expect(isDraftExpired({ updatedAt: NOW }, NOW + DRAFT_TTL_MS)).toBe(false);
    expect(isDraftExpired({ updatedAt: NOW }, NOW + DRAFT_TTL_MS + 1)).toBe(true);
    expect(isDraftExpired({}, NOW)).toBe(true);
  });
});

describe('schema validation', () => {
  it('accepts a valid envelope for its own user', () => {
    expect(validateDraftEnvelope(env(), { userId: 'u1', now: NOW }).ok).toBe(true);
  });
  it.each([
    ['null', null, 'corrupt'], ['array', [], 'corrupt'], ['wrong kind', { ...env(), kind: 'x' }, 'schema'], ['future schema', { ...env(), schemaVersion: 99 }, 'schema'],
    ['other user', env({ userId: 'u2' }), 'user'], ['bad mode', { ...env(), mode: 'zzz' }, 'shape'], ['no draftId', { ...env(), draftId: '' }, 'shape'],
    ['edit w/o quoteId', { ...env({ mode: 'edit' }), quoteId: null }, 'shape'], ['no items', { ...env(), payload: { items: 'x', sections: [] } }, 'shape'],
    ['no pending list', { ...env(), pendingAttachments: null }, 'shape'], ['expired', { ...env(), updatedAt: NOW - DRAFT_TTL_MS - 5 }, 'expired'],
  ])('rejects %s', (_n, raw, reason) => {
    const r = validateDraftEnvelope(raw, { userId: 'u1', now: NOW });
    expect(r.ok).toBe(false); expect(r.reason).toBe(reason);
  });
});

describe('store: save / restore / TTL / corruption / isolation', () => {
  let st; let store;
  beforeEach(() => { st = memStorage(); store = createDraftStore({ storage: st, project: 'p', now: () => NOW }); });

  it('serialization round trip preserves the whole payload', () => {
    expect(store.save(env()).ok).toBe(true);
    const got = store.latestNew('u1');
    expect(got.envelope.payload).toEqual(snapshotFromState(payload()));
  });
  it('supports multiple new drafts (UUIDs); latest first', () => {
    store.save(env({ draftId: 'a', now: NOW - 10 }));
    store.save(env({ draftId: 'b', now: NOW }));
    expect(store.listForUser('u1').map((d) => d.envelope.draftId)).toEqual(['b', 'a']);
    expect(store.latestNew('u1').envelope.draftId).toBe('b');
  });
  it('edit drafts are found per quote id', () => {
    store.save(env({ mode: 'edit', quoteId: 'q1', draftId: 'edit-q1' }));
    expect(store.editFor('u1', 'q1')).not.toBeNull();
    expect(store.editFor('u1', 'q2')).toBeNull();
  });
  it('USER ISOLATION: user B never enumerates or restores user A drafts', () => {
    store.save(env({ userId: 'uA' }));
    expect(store.listForUser('uB')).toEqual([]);
    expect(store.latestNew('uB')).toBeNull();
    // forged envelope under B's key but claiming A's identity is rejected and removed
    const forged = { ...env({ userId: 'uA' }) };
    st.setItem(`${DRAFT_KEY_PREFIX}:p:uB:new:d1`, JSON.stringify(forged));
    expect(store.listForUser('uB')).toEqual([]);
    expect(st.getItem(`${DRAFT_KEY_PREFIX}:p:uB:new:d1`)).toBeNull();
    // A's own draft is untouched
    expect(store.latestNew('uA')).not.toBeNull();
  });
  it('CORRUPT drafts are dropped without throwing', () => {
    st.setItem(`${DRAFT_KEY_PREFIX}:p:u1:new:bad`, '{not json');
    st.setItem(`${DRAFT_KEY_PREFIX}:p:u1:new:bad2`, JSON.stringify({ hello: 'world' }));
    expect(store.listForUser('u1')).toEqual([]);
    expect(st._m.size).toBe(0);
  });
  it('TTL: an expired draft is not restored and is deleted; cleanupExpired sweeps other users without reading content', () => {
    store.save(env({ userId: 'u1', now: NOW - DRAFT_TTL_MS - 1000 }));
    store.save(env({ userId: 'u2', draftId: 'x', now: NOW - DRAFT_TTL_MS - 1000 }));
    store.save(env({ userId: 'u2', draftId: 'fresh', now: NOW }));
    expect(store.listForUser('u1')).toEqual([]);
    const swept = store.cleanupExpired();
    expect(swept.removed).toBe(1);
    expect(swept.entries).toEqual([{ userId: 'u2', draftId: 'x' }]);
    expect(store.listForUser('u2').map((d) => d.envelope.draftId)).toEqual(['fresh']);
  });
  it('a key that does not match its envelope identity is rejected', () => {
    st.setItem(`${DRAFT_KEY_PREFIX}:p:u1:new:other-id`, JSON.stringify(env({ draftId: 'd1' })));
    expect(store.listForUser('u1')).toEqual([]);
  });
  it('EXPLICIT LOGOUT purge removes every draft of that user only, and reports draft ids for blob purge', () => {
    store.save(env({ userId: 'u1', draftId: 'a' })); store.save(env({ userId: 'u1', mode: 'edit', quoteId: 'q1', draftId: 'edit-q1' })); store.save(env({ userId: 'u2', draftId: 'z' }));
    const r = store.purgeUser('u1');
    expect(r.removed).toBe(2); expect(r.draftIds.sort()).toEqual(['a', 'edit-q1']);
    expect(store.listForUser('u1')).toEqual([]);
    expect(store.listForUser('u2').length).toBe(1);
  });
  it('remove/removeFor delete exactly one draft', () => {
    store.save(env({ draftId: 'a' })); store.save(env({ draftId: 'b' }));
    store.removeFor('u1', 'new', 'a');
    expect(store.listForUser('u1').map((d) => d.envelope.draftId)).toEqual(['b']);
  });
});

describe('storage failure is visible, never a false "saved"', () => {
  it('quota', () => {
    const q = new DOMException('full', 'QuotaExceededError');
    const store = createDraftStore({ storage: memStorage({ throwOn: q }), project: 'p' });
    expect(store.save(env())).toEqual({ ok: false, error: 'quota' });
    expect(store.probe()).toEqual({ ok: false, error: 'quota' });
  });
  it('unavailable (private mode / blocked storage)', () => {
    const store = createDraftStore({ storage: memStorage({ throwOn: new Error('SecurityError') }), project: 'p' });
    expect(store.save(env())).toEqual({ ok: false, error: 'unavailable' });
    expect(store.probe().ok).toBe(false);
  });
  it('no storage object at all', () => {
    const store = createDraftStore({ storage: null, project: 'p' });
    // globalThis.localStorage may exist in jsdom; force a throwing getter
    const bad = { get length() { throw new Error('x'); }, key: () => null, getItem: () => null, setItem: () => { throw new Error('x'); }, removeItem: () => {} };
    const s2 = createDraftStore({ storage: bad, project: 'p' });
    expect(s2.save(env()).ok).toBe(false);
    expect(store).toBeTruthy();
  });
  it('a non-serialisable envelope is reported, not thrown', () => {
    const store = createDraftStore({ storage: memStorage(), project: 'p' });
    const cyc = env(); cyc.self = cyc;
    expect(store.save(cyc)).toEqual({ ok: false, error: 'serialize' });
  });
});

describe('material content / dirty detection', () => {
  const defaults = { defaultTerms: 'T0', defaultWarranty: 'W0' };
  const blank = { clientName: '', clientEmail: '', clientPhone: '', clientType: '', clientTaxId: '', clientAddress: '', quoteSubject: '', attnName: '', attnRole: '', currency: 'ILS', quoteStatus: 'Draft', validUntil: '', discount: '', terms: 'T0', warranty: 'W0', notes: '', items: [{ description: '', quantity: '1', unit_price: '' }], sections: [], quoteStructureMode: null, projectName: '' };
  it('an untouched new quote is not a draft', () => { expect(hasMaterialContent(blank, defaults)).toBe(false); });
  it.each([['clientName', 'X'], ['projectName', 'P'], ['notes', 'n'], ['terms', 'changed'], ['warranty', 'w']])('typing %s makes it material', (f, v) => {
    expect(hasMaterialContent({ ...blank, [f]: v }, defaults)).toBe(true);
  });
  it('an item description/price/quantity/measurement/spec or a named section makes it material', () => {
    expect(hasMaterialContent({ ...blank, items: [{ description: 'x', quantity: '1', unit_price: '' }] }, defaults)).toBe(true);
    expect(hasMaterialContent({ ...blank, items: [{ description: '', quantity: '3', unit_price: '' }] }, defaults)).toBe(true);
    expect(hasMaterialContent({ ...blank, items: [{ description: '', quantity: '1', unit_price: '9' }] }, defaults)).toBe(true);
    expect(hasMaterialContent({ ...blank, items: [{ description: '', quantity: '1', unit_price: '', measurements: [{}] }] }, defaults)).toBe(true);
    expect(hasMaterialContent({ ...blank, sections: [{ key: 'k', name: 'Kitchen' }] }, defaults)).toBe(true);
  });
  it('formHash is stable and sensitive to every persisted field', () => {
    const a = formHash(payload()); expect(formHash(payload())).toBe(a);
    for (const f of PAYLOAD_FIELDS) { const p = payload(); p[f] = f === 'items' || f === 'sections' ? [...(p[f]), { zzz: 1 }] : `${String(p[f])}!`; expect(formHash(p), f).not.toBe(a); }
  });
});

describe('server-conflict decision (never overwrite a changed saved quote)', () => {
  const quote = (over = {}) => ({ id: 'q1', status: 'draft', notes: 'n', total: 100, quote_items: [{ id: 'i1', description: 'd', quantity: 1, unit_price: 10 }], quote_sections: [], ...over });
  const editEnv = (q) => env({ mode: 'edit', quoteId: q.id, draftId: `edit-${q.id}`, baseServerFingerprint: serverFingerprintFromQuote(q) });
  it('new draft restores', () => { expect(decideRestore(env(), null)).toBe('restore-new'); });
  it('edit with UNCHANGED server baseline restores automatically', () => { const q = quote(); expect(decideRestore(editEnv(q), quote())).toBe('restore-edit'); });
  it('edit with CHANGED server state is a conflict (any editor-visible change)', () => {
    const q = quote(); const e = editEnv(q);
    for (const change of [{ notes: 'other device' }, { status: 'sent' }, { total: 999 }, { updated_at: 'later' }, { quote_items: [{ id: 'i1', description: 'CHANGED', quantity: 1, unit_price: 10 }] }, { quote_items: [] }]) {
      expect(decideRestore(e, quote(change)), JSON.stringify(change)).toBe('conflict-changed');
    }
  });
  it('quote deleted or now immutable (approved/signed) is a conflict, never a silent restore', () => {
    const q = quote(); const e = editEnv(q);
    expect(decideRestore(e, null)).toBe('conflict-unavailable');
    expect(decideRestore(e, quote(), { immutable: true })).toBe('conflict-unavailable');
  });
});

describe('write suppression + flush registry', () => {
  it('suppression is per user and reversible', () => {
    suppressDraftWrites('u1'); expect(isDraftWriteSuppressed('u1')).toBe(true); expect(isDraftWriteSuppressed('u2')).toBe(false);
    allowDraftWrites('u1'); expect(isDraftWriteSuppressed('u1')).toBe(false);
  });
  it('flushAllDrafts calls every registered flusher and tolerates a throwing one', () => {
    let n = 0; const off1 = registerDraftFlush(() => { n++; }); const off2 = registerDraftFlush(() => { throw new Error('x'); });
    flushAllDrafts(); expect(n).toBe(1); off1(); off2(); flushAllDrafts(); expect(n).toBe(1);
  });
});
