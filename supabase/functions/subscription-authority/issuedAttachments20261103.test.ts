// @vitest-environment node
// F17 (Owner console 2026-11-03, typed: "מאשר בניית קבצים מצורפים ללקוח בדרך הנעילה עם ההצעה, כולל שינוי ב-L-05, L-17 ו-L-24,
// שחרור עד הלייב"): at issue, every attached file is copied once to the attempt's own folder and bound in the immutable snapshot.
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createQuoteOutputOrchestrator, issuedAttachmentPath, sourceAttachmentExt } from './authorizeOutput';
import { bucketSnapshotStorage, quoteAttachmentSource, rpcOutputSql, storageMediaAssetSource, storagePresentationSource,
  type BucketApi, type Rpc } from './adapters';

const U = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const A1 = '77777777-7777-4777-8777-777777777777';
const A2 = '88888888-8888-4888-8888-888888888888';
const DIGEST = 'd'.repeat(64);
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

function memoryBucket(): BucketApi & { objects: Map<string, Uint8Array>; uploads: string[] } {
  const objects = new Map<string, Uint8Array>();
  const uploads: string[] = [];
  return {
    objects, uploads,
    upload: async (path, bytes, opts) => {
      uploads.push(path);
      if (objects.has(path) && !opts.upsert) return { error: { statusCode: '409', message: 'The resource already exists' } };
      objects.set(path, new Uint8Array(bytes)); return { error: null };
    },
    download: async (path) => {
      const b = objects.get(path);
      return b ? { data: { arrayBuffer: async () => b.slice().buffer }, error: null } : { data: null, error: { status: 404, message: 'Object not found' } };
    },
    remove: async (paths) => { for (const p of paths) objects.delete(p); return { error: null }; },
  };
}

type Row = { id: string; file_name: string; storage_path: string };
function world(rows: Row[], opts: { attachmentCount?: number; files?: Record<string, string> } = {}) {
  const bucket = memoryBucket();
  for (const [p, text] of Object.entries(opts.files ?? {})) bucket.objects.set(p, new TextEncoder().encode(text));
  const state = { seq: 0, aborted: [] as string[], finalized: [] as string[] };
  const rpc: Rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'prepare_quote_output') {
      const id = `aaaaaaaa-0000-4000-8000-${String(++state.seq).padStart(12, '0')}`;
      return { data: { ok: true, state: 'preparing', attemptId: id, ownerId: U, quoteId: Q, customerBinding: 'c1', channel: args.p_channel, style: args.p_style,
        styleVersion: args.p_style_version, mediaCount: args.p_media_count, snapshotPath: `issued-documents/${U}/${Q}/${id}.json`, contentDigest: DIGEST,
        currentDigest: DIGEST, issuerDigest: 'e'.repeat(64), currentIssuerDigest: 'e'.repeat(64), presentationDigest: args.p_presentation_digest,
        reservedAt: '2026-11-03T09:59:00Z', document: { documentProjection: 'quote-document/v1', quote: { id: Q }, attachmentCount: opts.attachmentCount ?? rows.length, attachmentManifest: [] },
        issuer: { issuerProjection: 'issuer/v1', business_name: 'B', logo_url: null } }, error: null };
    }
    if (fn === 'finalize_quote_output') {
      state.finalized.push(args.p_attempt_id as string);
      return { data: { ok: true, state: 'finalized', attemptId: args.p_attempt_id, quoteId: Q, firstChannel: 'send', consumed: true, accountMode: 'free_10',
        finalizedAt: '2026-11-03T10:00:00Z', descriptor: { path: args.p_snapshot_path, sha256: args.p_sha256, bytes: args.p_bytes, schemaVersion: 1,
          contentDigest: DIGEST, issuerDigest: 'e'.repeat(64), presentationDigest: args.p_presentation_digest } }, error: null };
    }
    if (fn === 'abort_quote_output') { state.aborted.push(String(args.p_failure_code)); return { data: { ok: true }, error: null }; }
    if (fn === 'mark_quote_output_snapshot_deleted') return { data: { ok: true }, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  }) as Rpc;
  const incidents: string[] = [];
  const orchestrator = createQuoteOutputOrchestrator({ sql: rpcOutputSql(rpc), storage: bucketSnapshotStorage(bucket),
    presentation: storagePresentationSource(bucket), assets: storageMediaAssetSource(bucket),
    attachments: quoteAttachmentSource(bucket, async () => ({ data: rows, error: null })),
    onIncident: (i) => incidents.push(`${i.code}:${i.detail}`) });
  const send = (key = 'key-0001-abcdef') => orchestrator.output({ userId: U }, { quoteId: Q, channel: 'send', idempotencyKey: key, expectedDigest: DIGEST });
  const snapshotOf = (attemptSeq: number) => {
    const id = `aaaaaaaa-0000-4000-8000-${String(attemptSeq).padStart(12, '0')}`;
    const b = bucket.objects.get(`issued-documents/${U}/${Q}/${id}.json`);
    return { id, json: b ? JSON.parse(new TextDecoder().decode(b)) : null };
  };
  return { bucket, state, send, snapshotOf, incidents };
}

const src = (ms: number, ext: string) => `${U}/${Q}_${ms}.${ext}`;

describe('F17: the attached files enter the issued version', () => {
  it('each file is copied once to the attempt folder and bound (name, path, sha256, bytes, type) in the snapshot', async () => {
    const w = world([{ id: A1, file_name: 'תוכנית.pdf', storage_path: src(1, 'pdf') }, { id: A2, file_name: 'photo.JPG', storage_path: src(2, 'JPG') }],
      { files: { [src(1, 'pdf')]: 'PDF-BYTES', [src(2, 'JPG')]: 'JPEG-BYTES' } });
    const r = await w.send();
    expect(r.status).toBe(200);
    const { id, json } = w.snapshotOf(1);
    const p1 = issuedAttachmentPath(U, Q, id, A1, 'pdf'); const p2 = issuedAttachmentPath(U, Q, id, A2, 'jpg');
    expect(new TextDecoder().decode(w.bucket.objects.get(p1))).toBe('PDF-BYTES');
    expect(new TextDecoder().decode(w.bucket.objects.get(p2))).toBe('JPEG-BYTES');
    expect(json.attachments).toEqual([
      { id: A1, fileName: 'תוכנית.pdf', objectPath: p1, sha256: sha('PDF-BYTES'), bytes: 9, mime: 'application/pdf' },
      { id: A2, fileName: 'photo.JPG', objectPath: p2, sha256: sha('JPEG-BYTES'), bytes: 10, mime: 'image/jpeg' },
    ]);
    expect(p1).toBe(`issued-documents/${U}/${Q}/${id}/attachments/${A1}.pdf`);
  });

  it('a file replaced AFTER issue never changes the issued copy', async () => {
    const w = world([{ id: A1, file_name: 'a.pdf', storage_path: src(1, 'pdf') }], { files: { [src(1, 'pdf')]: 'V1' } });
    await w.send();
    w.bucket.objects.set(src(1, 'pdf'), new TextEncoder().encode('V2-CHANGED'));
    const { id, json } = w.snapshotOf(1);
    expect(new TextDecoder().decode(w.bucket.objects.get(issuedAttachmentPath(U, Q, id, A1, 'pdf')))).toBe('V1');
    expect(json.attachments[0].sha256).toBe(sha('V1'));
  });

  it('no attached file: the snapshot has no attachments key (byte-identical to before)', async () => {
    const w = world([]);
    expect((await w.send()).status).toBe(200);
    expect(Object.keys(w.snapshotOf(1).json)).not.toContain('attachments');
  });

  it('a retry finds the copy already there: the existing copy is bound, never overwritten', async () => {
    const w = world([{ id: A1, file_name: 'a.pdf', storage_path: src(1, 'pdf') }], { files: { [src(1, 'pdf')]: 'NEW' } });
    const id = 'aaaaaaaa-0000-4000-8000-000000000001';
    w.bucket.objects.set(issuedAttachmentPath(U, Q, id, A1, 'pdf'), new TextEncoder().encode('FIRST'));
    expect((await w.send()).status).toBe(200);
    expect(w.snapshotOf(1).json.attachments[0].sha256).toBe(sha('FIRST'));
    expect(w.bucket.uploads.filter((p) => p.includes('/attachments/'))).toEqual([]);
  });

  it('a foreign path or a missing object is skipped with an incident; the quote is still issued', async () => {
    const w = world([
      { id: A1, file_name: 'other.pdf', storage_path: `66666666-6666-4666-8666-666666666666/${Q}_1.pdf` },
      { id: A2, file_name: 'gone.pdf', storage_path: src(2, 'pdf') },
    ]);
    expect((await w.send()).status).toBe(200);
    expect(Object.keys(w.snapshotOf(1).json)).not.toContain('attachments');
    expect(w.incidents).toEqual([`attachment_skipped:${A1}: path`, `attachment_skipped:${A2}: missing`]);
  });

  it('a row count that differs from the bound document is a changed quote: aborted, nothing copied', async () => {
    const w = world([{ id: A1, file_name: 'a.pdf', storage_path: src(1, 'pdf') }], { attachmentCount: 2, files: { [src(1, 'pdf')]: 'X' } });
    const r = await w.send();
    expect(r).toEqual({ status: 409, body: { ok: false, code: 'quote_changed' } });
    expect(w.state.finalized).toEqual([]);
    expect([...w.bucket.objects.keys()].filter((p) => p.includes('/attachments/'))).toEqual([]);
  });

  it('a storage failure while copying keeps the attempt open (503, no abort, no finalize)', async () => {
    const w = world([{ id: A1, file_name: 'a.pdf', storage_path: src(1, 'pdf') }], { files: { [src(1, 'pdf')]: 'X' } });
    w.bucket.upload = async () => ({ error: { statusCode: '500', message: 'boom' } });
    const r = await w.send();
    expect(r).toEqual({ status: 503, body: { ok: false, code: 'storage_unavailable' } });
    expect(w.state.finalized).toEqual([]);
    expect(w.state.aborted).toEqual([]);
  });
});

describe('F17: only the editor upload path of this owner and quote is copied', () => {
  it.each([
    [`${U}/${Q}_1712345678901.pdf`, 'pdf'], [`${U}/${Q}_1.PNG`, 'png'],
    [`66666666-6666-4666-8666-666666666666/${Q}_1.pdf`, null], [`${U}/99999999-9999-4999-8999-999999999999_1.pdf`, null],
    [`${U}/../${Q}_1.pdf`, null], [`/${U}/${Q}_1.pdf`, null], [`${U}/x/${Q}_1.pdf`, null], [`${U}/${Q}_1.toolongextension`, null], [null, null],
  ])('%j -> %j', (path, ext) => { expect(sourceAttachmentExt(path, U, Q)).toBe(ext); });
});
