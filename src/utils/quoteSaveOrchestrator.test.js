import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  persistQuote, persistQuoteAtomic, persistQuotePhased, detectAtomicSave, flushStorageGc, deleteQuoteWithAttachments,
  buildAttachmentPath, safeFileExtension, newUuid, createAttachmentAccessUrl,
} from './quoteSaveOrchestrator';

// In-memory fake of the supabase-js surface the orchestrator uses. `fail` injects an error at a named stage:
//   'clients.update' | 'clients.insert' | 'quotes.insert' | 'quotes.update' | 'quotes.delete' | 'quote_items.update'
//   'quote_attachments.insert' | 'quote_attachments.delete' | 'rpc.save_quote_structured' | 'rpc.save_quote_atomic'
//   'storage.upload' | 'storage.remove' | 'storage.removeSilently' (RLS: returns [] without error)
function makeFake({ atomic = false, fail = {}, db = {} } = {}) {
  const state = {
    clients: [...(db.clients || [])], quotes: [...(db.quotes || [])], quote_attachments: [...(db.quote_attachments || [])],
    quote_storage_gc: [...(db.quote_storage_gc || [])], quote_items: [...(db.quote_items || [])], objects: new Set(db.objects || []),
    calls: [],
  };
  const err = (stage) => (typeof fail[stage] === 'function' ? fail[stage]() : fail[stage]) || null;
  let seq = 0;
  function from(table) {
    const q = { table, op: 'select', filters: [], payload: null, wantRows: false };
    const api = {
      select() { if (q.op === 'select') q.op = 'select'; else q.wantRows = true; return api; },
      insert(rows) { q.op = 'insert'; q.payload = rows; return api; },
      update(obj) { q.op = 'update'; q.payload = obj; return api; },
      delete() { q.op = 'delete'; return api; },
      eq(col, val) { q.filters.push((r) => r[col] === val); return api; },
      in(col, vals) { q.filters.push((r) => vals.includes(r[col])); return api; },
      limit() { return api; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    function run() {
      state.calls.push(`${table}.${q.op}`);
      const e = err(`${table}.${q.op}`);
      if (e) return { data: null, error: e };
      const rows = state[table];
      const match = (r) => q.filters.every((f) => f(r));
      if (q.op === 'insert') {
        const inserted = q.payload.map((r) => ({ id: r.id || `${table}-${(seq += 1)}`, ...r }));
        rows.push(...inserted);
        return { data: inserted, error: null };
      }
      if (q.op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, q.payload)); return { data: null, error: null }; }
      if (q.op === 'delete') {
        const gone = rows.filter(match);
        state[table] = rows.filter((r) => !match(r));
        if (table === 'quotes') state.quote_attachments = state.quote_attachments.filter((a) => !gone.some((g) => g.id === a.quote_id));
        return { data: null, error: null };
      }
      return { data: rows.filter(match), error: null };
    }
    return api;
  }
  const storage = {
    from: () => ({
      upload: async (path) => { state.calls.push('storage.upload'); const e = err('storage.upload'); if (e) return { error: e }; state.objects.add(path); return { error: null }; },
      remove: async (paths) => {
        state.calls.push('storage.remove');
        const e = err('storage.remove'); if (e) return { data: null, error: e };
        if (fail['storage.removeSilently']) return { data: [], error: null };
        const done = paths.filter((p) => state.objects.delete(p));
        return { data: done.map((name) => ({ name })), error: null };
      },
      createSignedUrl: async (path, ttl) => ({ data: { signedUrl: `https://signed.example/${path}?ttl=${ttl}` }, error: null }),
    }),
  };
  const rpc = vi.fn(async (name, args) => {
    state.calls.push(`rpc.${name}`);
    if (name === 'save_quote_atomic_version') return atomic ? { data: 1, error: null } : { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    const e = err(`rpc.${name}`);
    if (e) return { data: null, error: e };
    if (name === 'save_quote_atomic') {
      const existing = state.quotes.find((x) => x.id === args.p_quote_id);
      if (args.p_is_new && existing) return { data: { ok: true, idempotent_replay: true, quote_id: existing.id, attachment_paths: state.quote_attachments.filter((a) => a.quote_id === existing.id).map((a) => a.storage_path) }, error: null };
      const clientId = args.p_client.id || `clients-${(seq += 1)}`;
      if (!args.p_client.id) state.clients.push({ id: clientId, ...args.p_client });
      if (args.p_is_new) state.quotes.push({ id: args.p_quote_id, client_id: clientId, ...args.p_quote });
      else Object.assign(state.quotes.find((x) => x.id === args.p_quote_id), args.p_quote);
      const removed = state.quote_attachments.filter((a) => args.p_removed_attachment_ids.includes(a.id));
      state.quote_attachments = state.quote_attachments.filter((a) => !args.p_removed_attachment_ids.includes(a.id));
      removed.forEach((a) => state.quote_storage_gc.push({ storage_path: a.storage_path }));
      args.p_new_attachments.forEach((a) => state.quote_attachments.push({ id: `att-${(seq += 1)}`, quote_id: args.p_quote_id, ...a }));
      return { data: { ok: true, idempotent_replay: false, quote_id: args.p_quote_id, client_id: clientId, attachment_paths: state.quote_attachments.filter((a) => a.quote_id === args.p_quote_id).map((a) => a.storage_path) }, error: null };
    }
    return { data: { ok: true }, error: null };
  });
  return { from, storage, rpc, state };
}

const U = '00000000-0000-4000-8000-00000000000a';
const Q = '31000000-0000-4000-8000-000000000001';
const file = (name, size = 10) => ({ name, size });
function plan(over = {}) {
  return {
    userId: U, isNew: true, quoteId: Q, existingClientId: null,
    clientPayload: { company_name: 'Synthetic Client', email: '', user_id: U },
    header: { status: 'draft', valid_until: null, currency: 'ILS', subtotal: 100, tax_rate: 0.18, total: 118, discount: 0 },
    attnFields: { attn_name: 'Synthetic Client', attn_role: null }, attnUserEntered: false, projectName: 'Synthetic Tower',
    descriptionUpdates: [],
    structured: { financial: null, sections: [], items: [{ client_key: 'new_0', description: 'x' }], removedSectionIds: [], removedItemIds: [] },
    newFiles: [], removedAttachments: [], now: () => 1790000000000,
    ...over,
  };
}
const boom = (message = 'injected failure', extra = {}) => ({ message, ...extra });

beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

describe('helpers', () => {
  it('attachment paths always pass the public path check (<owner>/<quote>_<digits>.<1-10 alnum>)', () => {
    const re = new RegExp(`^${U}/${Q}_\\d+\\.[A-Za-z0-9]{1,10}$`);
    for (const n of ['plan.PDF', 'site plan', 'archive.tar.gz', '.env', 'ש"ח.png', 'x.verylongextension123']) expect(buildAttachmentPath(U, Q, n, 1790000000000)).toMatch(re);
    expect(safeFileExtension('site plan')).toBe('bin');
    expect(safeFileExtension('Plan.PDF')).toBe('pdf');
  });
  it('newUuid is RFC 4122 v4 without crypto.randomUUID (insecure LAN origin)', () => {
    expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('capability probe: missing RPC => phased path; present => atomic', async () => {
    expect(await detectAtomicSave(makeFake({ atomic: false }))).toBe(false);
    expect(await detectAtomicSave(makeFake({ atomic: true }))).toBe(true);
  });
  it('attachment access is a short-lived signed URL from the storage path (never a stored public URL)', async () => {
    const { url } = await createAttachmentAccessUrl(makeFake(), { storage_path: `${U}/${Q}_1.pdf`, file_url: 'https://public.example/x.pdf' });
    expect(url).toMatch(/^https:\/\/signed\.example\/.*ttl=60$/);
  });
  it('no storage path -> FAIL CLOSED: a stored http(s) or public file_url is never returned (2026-09-25 raw-URL parity)', async () => {
    for (const file_url of ['https://evil.example/phish', 'http://evil.example/x.pdf', 'https://public.example/storage/v1/object/public/quote-files/x.pdf']) {
      for (const storage_path of [undefined, null, '']) {
        const r = await createAttachmentAccessUrl(makeFake(), { storage_path, file_url });
        expect(r.url).toBeNull(); expect(r.error).toBeInstanceOf(Error);
      }
    }
  });
});

describe('PHASED path (current TEST schema) - failure injection at every stage', () => {
  it('failure before any write (client insert) -> failed, nothing written', async () => {
    const f = makeFake({ fail: { 'clients.insert': boom() } });
    const r = await persistQuotePhased(f, plan());
    expect(r).toMatchObject({ outcome: 'failed', stage: 'client', wrote: [] });
    expect(f.state.quotes).toHaveLength(0);
  });
  it('client UPDATE failure on edit -> failed before any quote write', async () => {
    const f = makeFake({ fail: { 'clients.update': boom() }, db: { quotes: [{ id: Q, project_name: 'Old' }], clients: [{ id: 'c1' }] } });
    const r = await persistQuotePhased(f, plan({ isNew: false, existingClientId: 'c1' }));
    expect(r).toMatchObject({ outcome: 'failed', stage: 'client' });
    expect(f.state.quotes[0].project_name).toBe('Old');
    expect(f.state.calls).not.toContain('quotes.update');
  });
  it('quote insert failure on a NEW quote -> the just-created client is compensated (nothing remains)', async () => {
    const f = makeFake({ fail: { 'quotes.insert': boom() } });
    const r = await persistQuotePhased(f, plan());
    expect(r).toMatchObject({ outcome: 'failed', stage: 'quote', wrote: [] });
    expect(f.state.clients).toHaveLength(0);
  });
  it('a missing project_name column never drops a TYPED project name silently', async () => {
    const f = makeFake({ fail: { 'quotes.insert': boom('column "project_name" of relation "quotes" does not exist') } });
    const r = await persistQuotePhased(f, plan({ projectName: 'Synthetic Tower' }));
    expect(r).toMatchObject({ outcome: 'failed', stage: 'quote', missingColumn: 'project_name' });
    expect(f.state.calls.filter((c) => c === 'quotes.insert')).toHaveLength(1);
  });
  it('a missing project_name column may be skipped only when the user left it empty', async () => {
    let first = true;
    const f = makeFake({ fail: { 'quotes.insert': () => (first ? ((first = false), boom('column "project_name" does not exist')) : null) } });
    const r = await persistQuotePhased(f, plan({ projectName: null }));
    expect(r.outcome).toBe('ok');
    expect(f.state.quotes[0]).not.toHaveProperty('project_name');
  });
  it('project_name reaches the quote row on success (new + edit)', async () => {
    const f = makeFake();
    await persistQuotePhased(f, plan({ projectName: 'Synthetic Tower' }));
    expect(f.state.quotes[0].project_name).toBe('Synthetic Tower');
    await persistQuotePhased(f, plan({ isNew: false, existingClientId: f.state.clients[0].id, projectName: 'Synthetic Tower B' }));
    expect(f.state.quotes[0].project_name).toBe('Synthetic Tower B');
  });
  it('structured item failure on a NEW quote -> quote shell AND new client compensated', async () => {
    const f = makeFake({ fail: { 'rpc.save_quote_structured': boom() } });
    const r = await persistQuotePhased(f, plan());
    expect(r).toMatchObject({ outcome: 'failed', stage: 'structure', wrote: [] });
    expect(f.state.quotes).toHaveLength(0);
    expect(f.state.clients).toHaveLength(0);
  });
  it('structured item failure on EDIT -> partial (header saved, structure unchanged) - reported, not success', async () => {
    const f = makeFake({ fail: { 'rpc.save_quote_structured': boom() }, db: { quotes: [{ id: Q }], clients: [{ id: 'c1' }] } });
    const r = await persistQuotePhased(f, plan({ isNew: false, existingClientId: 'c1' }));
    expect(r).toMatchObject({ outcome: 'partial', stage: 'structure' });
    expect(r.wrote).toEqual(['client', 'quote']);
  });
  it('compensation failure is surfaced (never reported as a clean failure)', async () => {
    const f = makeFake({ fail: { 'rpc.save_quote_structured': boom(), 'quotes.delete': boom() } });
    const r = await persistQuotePhased(f, plan());
    expect(r).toMatchObject({ outcome: 'failed', compensationFailed: true });
  });
  it('attachment upload succeeds but metadata fails -> partial + the uploaded object is removed (no orphan)', async () => {
    const f = makeFake({ fail: { 'quote_attachments.insert': boom() } });
    const r = await persistQuotePhased(f, plan({ newFiles: [file('plan.pdf')] }));
    expect(r).toMatchObject({ outcome: 'partial', stage: 'attachments', attachmentFailures: ['plan.pdf'], orphanedUploads: [] });
    expect(f.state.objects.size).toBe(0);
  });
  it('upload failure -> partial with the failed file named (quote itself saved)', async () => {
    const f = makeFake({ fail: { 'storage.upload': boom() } });
    const r = await persistQuotePhased(f, plan({ newFiles: [file('a.pdf')] }));
    expect(r).toMatchObject({ outcome: 'partial', attachmentFailures: ['a.pdf'] });
    expect(r.wrote).toContain('quote');
  });
  it('removed persisted attachment: row deleted first, then its storage object', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ db: { quotes: [{ id: Q }], clients: [{ id: 'c1' }], quote_attachments: [{ id: 'a1', quote_id: Q, storage_path: path }], objects: [path] } });
    const r = await persistQuotePhased(f, plan({ isNew: false, existingClientId: 'c1', removedAttachments: [{ id: 'a1', storage_path: path }] }));
    expect(r.outcome).toBe('ok');
    expect(f.state.quote_attachments).toHaveLength(0);
    expect(f.state.objects.has(path)).toBe(false);
    expect(f.state.calls.indexOf('quote_attachments.delete')).toBeLessThan(f.state.calls.lastIndexOf('storage.remove'));
  });
  it('removed-attachment row delete fails -> the object is NOT deleted (no premature delete) and the step is reported', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ fail: { 'quote_attachments.delete': boom() }, db: { quotes: [{ id: Q }], clients: [{ id: 'c1' }], quote_attachments: [{ id: 'a1', quote_id: Q, storage_path: path }], objects: [path] } });
    const r = await persistQuotePhased(f, plan({ isNew: false, existingClientId: 'c1', removedAttachments: [{ id: 'a1', storage_path: path }] }));
    expect(r).toMatchObject({ outcome: 'partial', removalFailed: true });
    expect(f.state.objects.has(path)).toBe(true);
  });
  it('storage refusing the delete (RLS, no error) is detected and reported as cleanup pending', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ fail: { 'storage.removeSilently': true }, db: { quotes: [{ id: Q }], clients: [{ id: 'c1' }], quote_attachments: [{ id: 'a1', quote_id: Q, storage_path: path }], objects: [path] } });
    const r = await persistQuotePhased(f, plan({ isNew: false, existingClientId: 'c1', removedAttachments: [{ id: 'a1', storage_path: path }] }));
    expect(r.outcome).toBe('ok');
    expect(r.cleanupPending).toEqual([path]);
  });
  it('retry after a partial new-quote failure recreates cleanly with the same id (no duplicate)', async () => {
    let fails = 1;
    const f = makeFake({ fail: { 'rpc.save_quote_structured': () => (fails-- > 0 ? boom() : null) } });
    expect((await persistQuotePhased(f, plan())).outcome).toBe('failed');
    expect((await persistQuotePhased(f, plan())).outcome).toBe('ok');
    expect(f.state.quotes).toHaveLength(1);
    expect(f.state.clients).toHaveLength(1);
  });
  it('unfinished draft (no items) saves as Draft', async () => {
    const f = makeFake();
    const r = await persistQuotePhased(f, plan({ structured: { financial: null, sections: [], items: [], removedSectionIds: [], removedItemIds: [] }, header: { status: 'draft', total: 0 } }));
    expect(r.outcome).toBe('ok');
    expect(f.state.quotes[0].status).toBe('draft');
  });
});

describe('ATOMIC path (migration 20260922000000) - failure injection', () => {
  it('everything in one call: client + quote + project_name + attachments; uploads happen BEFORE the transaction', async () => {
    const f = makeFake({ atomic: true });
    const r = await persistQuote(f, plan({ newFiles: [file('plan.pdf')] }));
    expect(r).toMatchObject({ path: 'atomic', outcome: 'ok' });
    expect(f.state.calls.indexOf('storage.upload')).toBeLessThan(f.state.calls.indexOf('rpc.save_quote_atomic'));
    expect(f.state.quotes[0].project_name).toBe('Synthetic Tower');
    expect(f.state.quote_attachments).toHaveLength(1);
  });
  it('upload failure before any write -> failed, nothing written, earlier uploads removed', async () => {
    let n = 0;
    const f = makeFake({ atomic: true, fail: { 'storage.upload': () => ((n += 1) === 2 ? boom() : null) } });
    const r = await persistQuoteAtomic(f, plan({ newFiles: [file('a.pdf'), file('b.pdf')] }));
    expect(r).toMatchObject({ outcome: 'failed', stage: 'upload', attachmentFailures: ['b.pdf'] });
    expect(f.state.objects.size).toBe(0);
    expect(f.state.calls).not.toContain('rpc.save_quote_atomic');
  });
  it('transaction failure -> failed (DB rolled back) and the uploaded objects are removed', async () => {
    const f = makeFake({ atomic: true, fail: { 'rpc.save_quote_atomic': boom('Unknown section_client_key') } });
    const r = await persistQuoteAtomic(f, plan({ newFiles: [file('a.pdf')] }));
    expect(r).toMatchObject({ outcome: 'failed', stage: 'transaction', orphanedUploads: [] });
    expect(f.state.objects.size).toBe(0);
    expect(f.state.quotes).toHaveLength(0);
  });
  it('duplicate retry of a committed new-quote save is idempotent and removes the retry\'s own uploads', async () => {
    const f = makeFake({ atomic: true });
    await persistQuoteAtomic(f, plan({ newFiles: [file('a.pdf')] }));
    const r = await persistQuoteAtomic(f, plan({ newFiles: [file('a.pdf')], now: () => 1790000000999 }));
    expect(r).toMatchObject({ outcome: 'ok', idempotentReplay: true });
    expect(f.state.quotes).toHaveLength(1);
    expect(f.state.quote_attachments).toHaveLength(1);
    expect(f.state.objects.size).toBe(1);
  });
  it('removed attachment: queued by the transaction, object deleted after commit, queue acknowledged', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ atomic: true, db: { quotes: [{ id: Q }], quote_attachments: [{ id: 'a1', quote_id: Q, storage_path: path }], objects: [path] } });
    const r = await persistQuoteAtomic(f, plan({ isNew: false, existingClientId: 'c1', removedAttachments: [{ id: 'a1', storage_path: path }] }));
    expect(r.outcome).toBe('ok');
    expect(f.state.objects.has(path)).toBe(false);
    expect(f.state.quote_storage_gc).toHaveLength(0);
  });
  it('GC keeps a queue row when storage does not confirm the delete (retried on the next flush)', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ atomic: true, fail: { 'storage.removeSilently': true }, db: { quote_storage_gc: [{ storage_path: path }], objects: [path] } });
    const gc = await flushStorageGc(f);
    expect(gc.pending).toEqual([path]);
    expect(f.state.quote_storage_gc).toHaveLength(1);
  });
});

describe('quote deletion', () => {
  it('phased: quote row deleted first, then its attachment objects', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ db: { quotes: [{ id: Q }], quote_attachments: [{ id: 'a1', quote_id: Q, storage_path: path }], objects: [path] } });
    const r = await deleteQuoteWithAttachments(f, Q);
    expect(r).toMatchObject({ ok: true, cleanupPending: [] });
    expect(f.state.objects.size).toBe(0);
  });
  it('a failed quote delete never deletes storage objects', async () => {
    const path = `${U}/${Q}_1.pdf`;
    const f = makeFake({ fail: { 'quotes.delete': boom() }, db: { quotes: [{ id: Q }], quote_attachments: [{ id: 'a1', quote_id: Q, storage_path: path }], objects: [path] } });
    const r = await deleteQuoteWithAttachments(f, Q);
    expect(r).toMatchObject({ ok: false, stage: 'delete' });
    expect(f.state.objects.has(path)).toBe(true);
  });
});

describe('quote number allocation (phased, regression found by the live flow gate)', () => {
  it('a NEW quote carries the allocated per-business number; edits never allocate', async () => {
    const f = makeFake();
    f.rpc.mockImplementation(async (name) => {
      f.state.calls.push(`rpc.${name}`);
      if (name === 'save_quote_atomic_version') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      if (name === 'allocate_quote_number') return { data: 100777, error: null };
      return { data: { ok: true }, error: null };
    });
    await persistQuotePhased(f, plan());
    expect(f.state.quotes[0].quote_number).toBe(100777);
    await persistQuotePhased(f, plan({ isNew: false, existingClientId: f.state.clients[0].id }));
    expect(f.state.calls.filter((c) => c === 'rpc.allocate_quote_number')).toHaveLength(1);
  });
});
