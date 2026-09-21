import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useQuoteDraftPersistence from './useQuoteDraftPersistence';
import { createDraftStore, flushAllDrafts, formHash, suppressDraftWrites, allowDraftWrites } from '../utils/quoteDraft';

function memStorage(opts = {}) {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts.fail) throw opts.fail; m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m,
  };
}
function fakeBlobStore({ failPut = false } = {}) {
  const blobs = new Map(); let n = 0;
  return {
    blobs,
    putFile: vi.fn(async (userId, draftId, file) => { if (failPut) return { ok: false, error: 'QuotaExceededError' }; const id = `b${++n}`; blobs.set(id, { userId, draftId, name: file.name }); return { ok: true, blobId: id }; }),
    deleteBlob: vi.fn(async (id) => { blobs.delete(id); return true; }),
    deleteDraft: vi.fn(async (userId, draftId) => { for (const [id, r] of [...blobs]) if (r.userId === userId && r.draftId === draftId) blobs.delete(id); return true; }),
    restoreFiles: vi.fn(), purgeUser: vi.fn(),
  };
}
const blank = { clientName: '', clientEmail: '', clientPhone: '', clientType: '', clientTaxId: '', clientAddress: '', quoteSubject: '', attnName: '', attnRole: '', currency: 'ILS', quoteStatus: 'Draft', validUntil: '', discount: '', terms: 'T0', warranty: 'W0', notes: '', items: [{ description: '', quantity: '1', unit_price: '' }], sections: [], quoteStructureMode: null, projectName: '' };
const base = (over = {}) => ({ enabled: true, userId: 'u1', businessId: 'b1', locale: 'he', market: 'Local', mode: 'new', quoteId: null, draftId: 'd1', payload: blank, wizard: null, files: [], pendingRemovals: [], baseServerFingerprint: null, cleanFormHash: null, defaults: { defaultTerms: 'T0', defaultWarranty: 'W0' }, ...over });
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

let storage; let store; let blobStore;
beforeEach(() => { vi.useFakeTimers(); storage = memStorage(); store = createDraftStore({ storage, project: 'p' }); blobStore = fakeBlobStore(); allowDraftWrites('u1'); });
afterEach(() => { vi.useRealTimers(); });
const mount = (props) => renderHook((p) => useQuoteDraftPersistence({ ...p, store, blobStore }), { initialProps: props });

describe('useQuoteDraftPersistence', () => {
  it('does nothing while disabled, and never persists an untouched new quote', async () => {
    const { rerender } = mount(base({ enabled: false, payload: { ...blank, clientName: 'X' } }));
    await flush(1000); expect(storage._m.size).toBe(0);
    rerender(base({ enabled: true })); await flush(1000); expect(storage._m.size).toBe(0);
  });
  it('debounces (350 ms) then writes the full payload; a fresh store on the same storage (hard reload) restores it', async () => {
    const { rerender, result } = mount(base());
    rerender(base({ payload: { ...blank, clientName: 'ACME', projectName: 'Villa', items: [{ description: 'Door', quantity: '2', unit_price: '100' }] } }));
    await flush(300); expect(storage._m.size).toBe(0);
    await flush(100);
    expect(storage._m.size).toBe(1);
    expect(result.current.status).toBe('saved'); expect(result.current.lastSavedAt).toBeTruthy();
    const reloaded = createDraftStore({ storage, project: 'p' }).latestNew('u1'); // a brand-new page load
    expect(reloaded.envelope.payload.clientName).toBe('ACME');
    expect(reloaded.envelope.payload.projectName).toBe('Villa');
    expect(reloaded.envelope.payload.items[0].description).toBe('Door');
    expect(reloaded.envelope.draftId).toBe('d1');
  });
  it('flushes IMMEDIATELY on visibilitychange->hidden (no timer needed) and on pagehide; never uses beforeunload', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const { rerender } = mount(base());
    rerender(base({ payload: { ...blank, clientName: 'A' } }));
    expect(storage._m.size).toBe(0);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(storage._m.size).toBe(1); // written synchronously, before any debounce elapsed
    expect(add.mock.calls.map((c) => c[0])).not.toContain('beforeunload');
    expect(add.mock.calls.map((c) => c[0])).toContain('pagehide');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    add.mockRestore();
  });
  it('the registry flush (used by the version-update banner) writes synchronously', async () => {
    const { rerender } = mount(base()); rerender(base({ payload: { ...blank, notes: 'n' } }));
    expect(storage._m.size).toBe(0); act(() => { flushAllDrafts(); }); expect(storage._m.size).toBe(1);
  });
  it('unmount (sign-out / route change) flushes the last edit', async () => {
    const { rerender, unmount } = mount(base()); rerender(base({ payload: { ...blank, clientName: 'last-word' } }));
    unmount(); expect(createDraftStore({ storage, project: 'p' }).latestNew('u1').envelope.payload.clientName).toBe('last-word');
  });
  it('reverting a new quote to blank removes its draft', async () => {
    const { rerender } = mount(base()); rerender(base({ payload: { ...blank, clientName: 'A' } })); await flush(400); expect(storage._m.size).toBe(1);
    rerender(base({ payload: blank })); await flush(400); expect(storage._m.size).toBe(0);
  });
  it('storage FAILURE is reported (status error + reason), never a false "saved"', async () => {
    storage = memStorage({ fail: new DOMException('full', 'QuotaExceededError') }); store = createDraftStore({ storage, project: 'p' });
    const { rerender, result } = mount(base()); rerender(base({ payload: { ...blank, clientName: 'A' } })); await flush(400);
    expect(result.current.status).toBe('error'); expect(result.current.error).toBe('quota'); expect(result.current.lastSavedAt).toBeNull();
  });
  it('EDIT mode: an untouched edit is not a draft; a changed edit is stored under the quote id with its server baseline', async () => {
    const clean = { ...blank, clientName: 'Saved client', notes: 'saved' }; const ch = formHash(clean);
    const { rerender } = mount(base({ mode: 'edit', quoteId: 'q1', draftId: null, payload: clean, cleanFormHash: ch, baseServerFingerprint: 'fp1' }));
    await flush(500); expect(storage._m.size).toBe(0);
    rerender(base({ mode: 'edit', quoteId: 'q1', draftId: null, payload: { ...clean, notes: 'edited' }, cleanFormHash: ch, baseServerFingerprint: 'fp1' })); await flush(400);
    const d = store.editFor('u1', 'q1'); expect(d.envelope.baseServerFingerprint).toBe('fp1'); expect(d.envelope.payload.notes).toBe('edited'); expect(d.envelope.cleanFormHash).toBe(ch);
  });
  it('EDIT mode before the clean baseline is captured never creates a draft', async () => {
    mount(base({ mode: 'edit', quoteId: 'q1', draftId: null, payload: { ...blank, clientName: 'x' }, cleanFormHash: null })); await flush(600); expect(storage._m.size).toBe(0);
  });
  it('a staged removal of an EXISTING attachment makes an edit dirty and is persisted', async () => {
    const clean = { ...blank, clientName: 'c' };
    mount(base({ mode: 'edit', quoteId: 'q1', draftId: null, payload: clean, cleanFormHash: formHash(clean), pendingRemovals: ['att-1'] })); await flush(400);
    expect(store.editFor('u1', 'q1').envelope.pendingAttachmentRemovals).toEqual(['att-1']);
  });
  it('ATTACHMENTS: a picked file is staged in IndexedDB immediately (not debounced) and referenced by the envelope; removal deletes the blob', async () => {
    const f = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
    const { rerender } = mount(base());
    rerender(base({ files: [f] })); await flush(0);
    expect(blobStore.putFile).toHaveBeenCalledTimes(1);
    const env = store.latestNew('u1').envelope; expect(env.pendingAttachments).toHaveLength(1); expect(env.pendingAttachments[0].name).toBe('plan.pdf');
    rerender(base({ files: [] })); await flush(400);
    expect(blobStore.blobs.size).toBe(0); // the blob is gone (draft no longer dirty -> whole draft + blobs removed)
    rerender(base({ payload: { ...blank, clientName: 'keep' }, files: [f] })); await flush(500);
    rerender(base({ payload: { ...blank, clientName: 'keep' }, files: [] })); await flush(500);
    expect(blobStore.deleteBlob).toHaveBeenCalled(); // dirty draft, file detached: exactly that blob is deleted
  });
  it('ATTACHMENTS: if staging fails the rest of the draft is still saved and the file is flagged for re-selection', async () => {
    blobStore = fakeBlobStore({ failPut: true }); const f = new File(['x'], 'plan.pdf');
    const { rerender, result } = mount(base({ payload: { ...blank, clientName: 'A' } }));
    rerender(base({ payload: { ...blank, clientName: 'A' }, files: [f] })); await flush(500);
    const env = store.latestNew('u1').envelope;
    expect(env.payload.clientName).toBe('A'); expect(env.pendingAttachments).toEqual([]); expect(env.attachmentsPersistFailed).toEqual(['plan.pdf']);
    expect(result.current.attachmentsWarning).toEqual(['plan.pdf']);
  });
  it('an unfinished item wizard counts as unsaved work and is persisted', async () => {
    const wiz = { open: true, editingItemIndex: null, wizardSectionKey: null, state: { step: 'details', description: 'half typed' } };
    mount(base({ wizard: wiz })); await flush(400);
    expect(store.latestNew('u1').envelope.wizard).toEqual(wiz);
  });
  it('discard removes the draft and its staged blobs (used after Save and after an explicit discard)', async () => {
    const f = new File(['x'], 'a.pdf'); const { rerender, result } = mount(base({ payload: { ...blank, clientName: 'A' } }));
    rerender(base({ payload: { ...blank, clientName: 'A' }, files: [f] })); await flush(500); expect(storage._m.size).toBe(1);
    await act(async () => { await result.current.discard(); });
    expect(storage._m.size).toBe(0); expect(blobStore.deleteDraft).toHaveBeenCalledWith('u1', 'd1'); expect(result.current.status).toBe('idle');
  });
  it('after an explicit logout purge, the unmounting editor cannot re-write the draft', async () => {
    const { rerender, unmount } = mount(base()); rerender(base({ payload: { ...blank, clientName: 'A' } })); await flush(400); expect(storage._m.size).toBe(1);
    store.purgeUser('u1'); suppressDraftWrites('u1');
    rerender(base({ payload: { ...blank, clientName: 'A2' } })); await flush(400); unmount();
    expect(storage._m.size).toBe(0);
  });
});
