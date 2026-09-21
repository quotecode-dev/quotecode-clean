import { describe, it, expect } from 'vitest';
import { createBlobStore } from './draftAttachments';

// In-memory adapter with the same surface as the IndexedDB adapter; can be told to fail (quota/blocked/evicted).
function memAdapter({ failPut = false, failGet = false } = {}) {
  const m = new Map();
  return {
    put: async (r) => { if (failPut) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); m.set(r.id, r); },
    get: async (id) => { if (failGet) throw new Error('evicted'); return m.get(id); },
    delete: async (id) => { m.delete(id); },
    allByIndex: async (index, value) => [...m.values()].filter((r) => r[index] === value),
    _m: m,
  };
}
const file = (name, body = 'hello') => new File([body], name, { type: 'application/pdf', lastModified: 1 });

describe('pending attachment blobs (IndexedDB staging contract)', () => {
  it('add -> restore returns the same bytes, name and type', async () => {
    const ad = memAdapter(); const bs = createBlobStore(ad);
    const put = await bs.putFile('u1', 'd1', file('plan.pdf', 'BYTES'));
    expect(put.ok).toBe(true);
    const { files, missing } = await bs.restoreFiles('u1', 'd1', [{ blobId: put.blobId, name: 'plan.pdf', size: 5 }]);
    expect(missing).toEqual([]);
    expect(files).toHaveLength(1);
    expect(files[0].file.name).toBe('plan.pdf'); expect(files[0].file.type).toBe('application/pdf');
    expect(await files[0].file.text()).toBe('BYTES');
  });
  it('recovery failure is REPORTED (missing), never faked; other data is unaffected', async () => {
    const bs = createBlobStore(memAdapter({ failGet: true }));
    const { files, missing } = await bs.restoreFiles('u1', 'd1', [{ blobId: 'x', name: 'a.pdf', size: 1 }, { blobId: 'y', name: 'b.pdf', size: 2 }]);
    expect(files).toEqual([]); expect(missing.map((m) => m.name)).toEqual(['a.pdf', 'b.pdf']);
  });
  it('an unknown blob id is reported missing', async () => {
    const bs = createBlobStore(memAdapter());
    expect((await bs.restoreFiles('u1', 'd1', [{ blobId: 'nope', name: 'a.pdf', size: 1 }])).missing).toHaveLength(1);
  });
  it('a failed put (quota/blocked) is reported and never throws', async () => {
    const bs = createBlobStore(memAdapter({ failPut: true }));
    const r = await bs.putFile('u1', 'd1', file('a.pdf'));
    expect(r.ok).toBe(false); expect(r.error).toBe('QuotaExceededError');
  });
  it('USER + DRAFT isolation: another user or another draft cannot read the blob', async () => {
    const bs = createBlobStore(memAdapter());
    const { blobId } = await bs.putFile('uA', 'd1', file('secret.pdf'));
    expect((await bs.restoreFiles('uB', 'd1', [{ blobId, name: 'secret.pdf' }])).files).toEqual([]);
    expect((await bs.restoreFiles('uA', 'd2', [{ blobId, name: 'secret.pdf' }])).files).toEqual([]);
    expect((await bs.restoreFiles('uA', 'd1', [{ blobId, name: 'secret.pdf' }])).files).toHaveLength(1);
  });
  it('deleteBlob / deleteDraft / purgeUser remove staged files', async () => {
    const ad = memAdapter(); const bs = createBlobStore(ad);
    const a = await bs.putFile('u1', 'd1', file('a.pdf')); await bs.putFile('u1', 'd1', file('b.pdf')); await bs.putFile('u1', 'd2', file('c.pdf')); await bs.putFile('u2', 'd9', file('z.pdf'));
    await bs.deleteBlob(a.blobId); expect(ad._m.size).toBe(3);
    await bs.deleteDraft('u1', 'd1'); expect(ad._m.size).toBe(2);
    await bs.purgeUser('u1'); expect([...ad._m.values()].map((r) => r.userId)).toEqual(['u2']);
  });
});
