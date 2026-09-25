// FRONTEND ROLLBACK ARTIFACT - raw-URL fallback fail-closed (2026-09-25, Codex: "SIGNED, PROJECT-ONLY ATTACHMENT NAVIGATION").
// The rollback editor opens a persisted attachment ONLY through a signed URL of a proven owner storage path of this project. A row with a
// missing / blank / malformed / foreign storage_path is refused - its stored file_url (external, or this project's public URL) is never
// returned, navigated to, or used to infer a key. A fake client records every call, so "refused before any query / signing" is asserted.
import { describe, expect, it } from 'vitest';
import { isOwnerStoragePath, resolveEditorAttachmentOpen, SIGNED_URL_SECONDS } from './attachmentCompatPath';
import { createAttachmentAccessUrl } from './quoteSaveOrchestrator'; // CANDIDATE: the signer lives here (rollback artifact: attachmentCompatPath)

const PROJECT = 'https://ljfizgrdyzxddswcedwr.supabase.co';
const OWNER = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const OTHER = '0b1c2d3e-4f50-4617-8829-3a4b5c6d7e8f';
const QUOTE = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const NEW_ROW = { id: 'a-new', file_name: 'plan.pdf', storage_path: `${OWNER}/${QUOTE}_1790285195272.pdf`, file_url: `${OWNER}/${QUOTE}_1790285195272.pdf` };
const LEGACY_ROW = { id: 'a-legacy', file_name: 'Photo.JPG', storage_path: `${OWNER}/${QUOTE}_1790285195000.JPG`, file_url: `${PROJECT}/storage/v1/object/public/quote-files/${OWNER}/${QUOTE}_1790285195000.JPG` };
const RB_ROW = { id: 'a-rb', file_name: 'offer.docx', storage_path: `${OWNER}/${QUOTE}_1790285199999.docx`, file_url: `${PROJECT}/storage/v1/object/public/quote-files/${OWNER}/${QUOTE}_1790285199999.docx` };
const OLDEST_ROW = { id: 'a-oldest', file_name: 'plan.pdf', storage_path: `${OWNER}/1790285195272_plan.pdf`, file_url: `${PROJECT}/storage/v1/object/public/quote-files/${OWNER}/1790285195272_plan.pdf` };
const VALID = [NEW_ROW, LEGACY_ROW, RB_ROW, OLDEST_ROW];

function fakeClient({ userId = OWNER, rows = VALID, bucket = 'private', signOrigin = PROJECT, rowError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getSession: async () => { calls.push('getSession'); return { data: { session: userId ? { user: { id: userId } } : null } }; } },
    from(table) {
      calls.push(`from:${table}`);
      const f = {}; const api = {
        select: () => api,
        eq: (c, v) => { f[c] = v; return api; },
        limit: async () => (rowError ? { data: null, error: rowError } : { data: rows.filter((r) => r.id === f.id && r.storage_path === f.storage_path).map((r) => ({ id: r.id })), error: null }),
      };
      return api;
    },
    storage: {
      from(bucketId) {
        calls.push(`storage:${bucketId}`);
        return {
          createSignedUrl: async (p, secs) => {
            calls.push(`sign:${p}:${secs}`);
            if (bucket === 'private' && p.split('/')[0] !== userId) return { data: null, error: { message: 'new row violates row-level security policy' } };
            return { data: { signedUrl: `${signOrigin}/storage/v1/object/sign/${bucketId}/${p}?token=t` }, error: null };
          },
        };
      },
    },
  };
}
const open = async (attachment, opts) => { const client = fakeClient(opts); const r = await resolveEditorAttachmentOpen({ client, attachment, supabaseUrl: PROJECT }); return { r, calls: client.calls }; };
const signed = (p) => `${PROJECT}/storage/v1/object/sign/quote-files/${p}?token=t`;

describe('createAttachmentAccessUrl (rollback artifact) - the raw-URL fallback is gone: no storage path -> no URL', () => {
  it.each([
    ['missing storage_path + arbitrary external HTTPS file_url', { file_url: 'https://evil.example/phish' }],
    ['missing storage_path + external HTTP file_url', { file_url: 'http://evil.example/x.pdf' }],
    ['missing storage_path + this project\'s PUBLIC object URL', { file_url: `${PROJECT}/storage/v1/object/public/quote-files/${OWNER}/${QUOTE}_1.pdf` }],
    ['null storage_path + external URL', { storage_path: null, file_url: 'https://evil.example/' }],
    ['blank storage_path + external URL', { storage_path: '', file_url: 'https://evil.example/' }],
  ])('%s -> { url: null } and nothing is signed', async (_l, attachment) => {
    const client = fakeClient();
    const r = await createAttachmentAccessUrl(client, attachment, 60);
    expect(r.url).toBeNull();
    expect(client.calls).toEqual([]);
  });
});

describe('isOwnerStoragePath - exactly <session uid>/<one safe object name>', () => {
  it.each([NEW_ROW, LEGACY_ROW, RB_ROW, OLDEST_ROW])('accepts the owner path $storage_path', (row) => { expect(isOwnerStoragePath(row.storage_path, OWNER)).toBe(true); });
  it.each([
    ['null', null], ['undefined', undefined], ['blank', ''], ['whitespace', '   '], ['number', 42],
    ['no folder', `${QUOTE}_1.pdf`], ['foreign owner folder', `${OTHER}/${QUOTE}_1.pdf`], ['uppercase owner folder', `${OWNER.toUpperCase()}/${QUOTE}_1.pdf`],
    ['traversal', `${OWNER}/../${OTHER}/${QUOTE}_1.pdf`], ['dot-dot name', `${OWNER}/..`], ['dot name', `${OWNER}/.`], ['hidden dot-dot inside', `${OWNER}/a..b.pdf`],
    ['extra segment', `${OWNER}/${QUOTE}/${QUOTE}_1.pdf`], ['bucket prefix', `quote-files/${OWNER}/${QUOTE}_1.pdf`], ['leading slash', `/${OWNER}/${QUOTE}_1.pdf`],
    ['trailing slash', `${OWNER}/${QUOTE}_1.pdf/`], ['percent-encoding', `${OWNER}/${QUOTE}%2F1.pdf`], ['backslash', `${OWNER}\\${QUOTE}_1.pdf`],
    ['space', `${OWNER}/site plan`], ['unicode', `${OWNER}/${QUOTE}_1.תוכנית`], ['query', `${OWNER}/${QUOTE}_1.pdf?x=1`], ['fragment', `${OWNER}/${QUOTE}_1.pdf#x`],
    ['url', `https://evil.example/${OWNER}/${QUOTE}_1.pdf`], ['over-long name', `${OWNER}/${'a'.repeat(256)}`],
  ])('refuses %s', (_l, p) => { expect(isOwnerStoragePath(p, OWNER)).toBe(false); });
  it('refuses when the session user id is not a canonical lowercase uuid', () => {
    for (const uid of [null, '', OWNER.toUpperCase(), 'not-a-uuid']) expect(isOwnerStoragePath(NEW_ROW.storage_path, uid)).toBe(false);
  });
});

describe('resolveEditorAttachmentOpen - fail closed; valid rows only through this project\'s signed URL of the exact object', () => {
  it.each(['private', 'public'])('valid rows (new relative, legacy, uppercase-extension legacy, rollback-written, oldest shape), bucket %s -> redirect to the signed URL of exactly that storage path', async (bucket) => {
    for (const row of VALID) {
      const { r, calls } = await open(row, { bucket });
      expect(r).toEqual({ state: 'redirect', url: signed(row.storage_path) });
      expect(calls).toEqual(['getSession', 'from:quote_attachments', 'storage:quote-files', `sign:${row.storage_path}:${SIGNED_URL_SECONDS}`]);
    }
  });
  it('a legacy row\'s stored public URL is never the result - the signed URL is minted from storage_path', async () => {
    const { r } = await open(LEGACY_ROW);
    expect(r.url).not.toBe(LEGACY_ROW.file_url); expect(r.url).toMatch(/\/object\/sign\/quote-files\//);
  });
  it.each([
    ['missing storage_path + arbitrary external HTTPS file_url', { id: 'x', file_url: 'https://evil.example/phish' }],
    ['missing storage_path + this project\'s public URL', { id: 'x', file_url: `${PROJECT}/storage/v1/object/public/quote-files/${OWNER}/${QUOTE}_1.pdf` }],
    ['blank storage_path', { id: 'x', storage_path: '  ', file_url: 'https://evil.example/' }],
    ['malformed storage_path', { id: 'x', storage_path: 'not a path', file_url: 'https://evil.example/' }],
    ['foreign owner folder', { id: 'x', storage_path: `${OTHER}/${QUOTE}_1.pdf` }],
    ['traversal', { id: 'x', storage_path: `${OWNER}/../${OTHER}/${QUOTE}_1.pdf` }],
    ['arbitrary bucket prefix', { id: 'x', storage_path: `avatars/${OWNER}/${QUOTE}_1.pdf` }],
    ['uppercase owner folder (look-alike)', { id: 'x', storage_path: `${OWNER.toUpperCase()}/${QUOTE}_1.pdf` }],
    ['no row id', { storage_path: NEW_ROW.storage_path }],
    ['not an object', null],
  ])('%s -> unavailable; no query, no signing, no URL', async (_l, attachment) => {
    const { r, calls } = await open(attachment);
    expect(r).toEqual({ state: 'unavailable' }); expect(calls).toEqual(['getSession']);
  });
  it('deleted / no-longer-visible row (RLS returns nothing for this id + storage_path) -> unavailable; nothing signed', async () => {
    const { r, calls } = await open(NEW_ROW, { rows: [LEGACY_ROW] });
    expect(r).toEqual({ state: 'unavailable' }); expect(calls).toEqual(['getSession', 'from:quote_attachments']);
    const swapped = await open({ ...NEW_ROW, storage_path: LEGACY_ROW.storage_path }); // an id paired with another row's path
    expect(swapped.r).toEqual({ state: 'unavailable' });
  });
  it('logged out -> signin; nothing queried or signed', async () => {
    const { r, calls } = await open(NEW_ROW, { userId: null });
    expect(r).toEqual({ state: 'signin' }); expect(calls).toEqual(['getSession']);
  });
  it('another tenant\'s session on the owner\'s row -> unavailable before any query', async () => {
    const { r, calls } = await open(NEW_ROW, { userId: OTHER });
    expect(r).toEqual({ state: 'unavailable' }); expect(calls).toEqual(['getSession']);
  });
  it('row query error -> error; nothing signed', async () => {
    const { r, calls } = await open(NEW_ROW, { rowError: { message: 'boom' } });
    expect(r).toEqual({ state: 'error' }); expect(calls).not.toContain(`sign:${NEW_ROW.storage_path}:${SIGNED_URL_SECONDS}`);
  });
  it('a signed URL from another origin is never followed (no open redirect)', async () => {
    for (const signOrigin of ['https://evil.example', 'https://ixabnzhjeqevtbhdfswv.supabase.co', 'http://ljfizgrdyzxddswcedwr.supabase.co']) {
      const { r } = await open(NEW_ROW, { signOrigin });
      expect(r).toEqual({ state: 'error' });
    }
  });
  it('a thrown client error resolves to error, never to a URL', async () => {
    const client = fakeClient(); client.auth.getSession = async () => { throw new Error('network'); };
    await expect(resolveEditorAttachmentOpen({ client, attachment: NEW_ROW, supabaseUrl: PROJECT })).resolves.toEqual({ state: 'error' });
  });
});
