// IndexedDB staging of PENDING (not-yet-uploaded) quote attachments for durable drafts.
// localStorage cannot hold binary files, so new attachment blobs live here, keyed by user + draft.
// If anything fails (IndexedDB blocked, quota, eviction), callers restore every OTHER draft field and explicitly
// ask the user to re-select the file(s) - a file is never silently dropped and never falsely reported as saved.
// PRIVACY/SECURITY: entries are scoped by userId; purgeUser() runs on explicit logout; nothing here is encrypted.

const DB_NAME = 'tekango-drafts';
const STORE = 'blobs';

export function newBlobId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* fall through */ }
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const wrapReq = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error('idb request failed')); });

// Real IndexedDB adapter. Kept tiny so tests can inject an in-memory one.
export function createIdbAdapter(idbFactory = globalThis.indexedDB) {
  let dbPromise = null;
  const open = () => {
    if (!idbFactory) return Promise.reject(new Error('indexedDB unavailable'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        let req;
        try { req = idbFactory.open(DB_NAME, 1); } catch (e) { reject(e); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const os = db.createObjectStore(STORE, { keyPath: 'id' });
            os.createIndex('userId', 'userId', { unique: false });
            os.createIndex('draftKey', 'draftKey', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('idb open failed'));
        req.onblocked = () => reject(new Error('idb open blocked'));
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  };
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      let result;
      Promise.resolve(fn(t.objectStore(STORE))).then((r) => { result = r; }, reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error || new Error('idb tx failed'));
      t.onabort = () => reject(t.error || new Error('idb tx aborted'));
    });
  };
  return {
    put: (record) => tx('readwrite', (os) => wrapReq(os.put(record))),
    get: (id) => tx('readonly', (os) => wrapReq(os.get(id))),
    delete: (id) => tx('readwrite', (os) => wrapReq(os.delete(id))),
    allByIndex: (index, value) => tx('readonly', (os) => wrapReq(os.index(index).getAll(value))),
  };
}

export function createBlobStore(adapter = createIdbAdapter()) {
  const draftKey = (userId, draftId) => `${userId}:${draftId}`;
  const store = {
    // Persists one File. Returns { ok:true, blobId } or { ok:false, error } - never throws.
    async putFile(userId, draftId, file, blobId = newBlobId()) {
      try {
        await adapter.put({ id: blobId, userId, draftId, draftKey: draftKey(userId, draftId), name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified || Date.now(), blob: file, createdAt: Date.now() });
        return { ok: true, blobId };
      } catch (e) {
        return { ok: false, error: String(e?.name || e?.message || 'idb-error') };
      }
    },
    // Reconstructs Files for the given descriptors; anything missing/unreadable is reported (never faked).
    async restoreFiles(userId, draftId, descriptors) {
      const files = []; const missing = [];
      for (const d of descriptors || []) {
        try {
          const rec = await adapter.get(d.blobId);
          if (rec && rec.userId === userId && rec.draftId === draftId && rec.blob) {
            const f = new File([rec.blob], rec.name, { type: rec.type || '', lastModified: rec.lastModified });
            files.push({ file: f, blobId: d.blobId });
          } else missing.push({ name: d.name, size: d.size });
        } catch { missing.push({ name: d.name, size: d.size }); }
      }
      return { files, missing };
    },
    async deleteBlob(blobId) { try { await adapter.delete(blobId); return true; } catch { return false; } },
    async deleteDraft(userId, draftId) {
      try { const recs = await adapter.allByIndex('draftKey', draftKey(userId, draftId)); for (const r of recs || []) await adapter.delete(r.id); return true; } catch { return false; }
    },
    async purgeUser(userId) {
      try { const recs = await adapter.allByIndex('userId', userId); for (const r of recs || []) await adapter.delete(r.id); return true; } catch { return false; }
    },
  };
  return store;
}

let sharedStore = null;
export function getBlobStore() { if (!sharedStore) sharedStore = createBlobStore(); return sharedStore; }
