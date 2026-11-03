// @vitest-environment node
// F17 (Owner console 2026-11-03, typed: "מאשר בניית קבצים מצורפים ללקוח בדרך הנעילה עם ההצעה, כולל שינוי ב-L-05, L-17 ו-L-24,
// שחרור עד הלייב"): the customer link shows exactly the files bound in the issued snapshot, each with its own short-lived link.
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { parseIssuedAttachments, serveCapability, serveGrant, type CapabilityDeps } from './publicAccess';
import { canonicalSnapshotPath, mintToken, tokenHash } from '../_shared/capabilityToken';
import { canonicalJson } from '../subscription-authority/authorizeOutput';

const OWNER = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const ATT = '33333333-3333-4333-8333-333333333333';
const A1 = '77777777-7777-4777-8777-777777777777';
const A2 = '88888888-8888-4888-8888-888888888888';
const path = (id: string, ext: string, att = ATT, owner = OWNER, q = Q) => `issued-documents/${owner}/${q}/${att}/attachments/${id}.${ext}`;
const file = (id: string, ext: string, extra: Record<string, unknown> = {}) =>
  ({ id, fileName: `${id.slice(0, 4)}.${ext}`, objectPath: path(id, ext), sha256: 'f'.repeat(64), bytes: 10, mime: 'application/pdf', ...extra });

function snapshot(attachments?: unknown[]) {
  return {
    kind: 'tekango-issued-quote-document', schemaVersion: 1, attemptId: ATT, ownerId: OWNER, quoteId: Q, customerBinding: 'c1',
    requestedChannel: 'send', preparedAt: '2026-11-03T10:00:00Z', contentDigest: 'a'.repeat(64), issuerDigest: 'b'.repeat(64), presentationDigest: 'c'.repeat(64),
    document: { documentProjection: 'quote-document/v1', quote: { id: Q, quote_number: 1, valid_until: '2999-01-01', currency: 'ILS', total: 1 },
      customer: null, sections: [], items: [], attachmentCount: attachments?.length ?? 0, attachmentManifest: [] },
    issuer: null, presentation: { presentationProjection: 'presentation/v1', style: 'classic', styleVersion: 1, branding: null, media: [] },
    ...(attachments ? { attachments } : {}),
  };
}

async function world(attachments?: unknown[], sign: (p: string) => Promise<string | null> = async (p) => `https://signed.example/${p}?t=1`) {
  const bytes = new TextEncoder().encode(canonicalJson(snapshot(attachments)));
  const snapshotPath = canonicalSnapshotPath(OWNER, Q, ATT);
  const bound = { ok: true, userId: OWNER, quoteId: Q, attemptId: ATT, snapshotPath, snapshotSha256: createHash('sha256').update(bytes).digest('hex') };
  const token = mintToken(); const hash = await tokenHash(token);
  const grant = mintToken(); const grantHash = await tokenHash(grant);
  const incidents: string[] = [];
  const signAttachment = vi.fn(sign);
  const deps = {
    resolve: async (h: string) => (h === hash ? { ...bound, capabilityId: '44444444-4444-4444-8444-444444444444', ops: ['view', 'approve'] } : { ok: false }),
    redeem: async (h: string) => (h === grantHash ? bound : { ok: false }),
    readSnapshot: async (p: string) => (p === snapshotPath ? bytes : null),
    readLiveQuote: async () => ({ user_id: OWNER, status: 'Sent', signature: null }),
    signAttachment, callerUserId: null, outputPhase: 'enforced', now: () => new Date('2026-11-03T12:00:00Z'),
    onIncident: (c: string) => incidents.push(c),
  } as unknown as CapabilityDeps;
  return { deps, token, grant, incidents, signAttachment };
}

describe('F17: the customer link carries the issued files', () => {
  it('each bound file comes back as { id, file_name, url } in the bound order, signed from its own issued copy', async () => {
    const w = await world([file(A1, 'pdf'), file(A2, 'jpg', { mime: 'image/jpeg' })]);
    const r = await serveCapability(w.deps, w.token);
    expect(r.status).toBe(200);
    expect(r.body.attachments).toEqual([
      { id: A1, file_name: '7777.pdf', url: `https://signed.example/${path(A1, 'pdf')}?t=1` },
      { id: A2, file_name: '8888.jpg', url: `https://signed.example/${path(A2, 'jpg')}?t=1` },
    ]);
    expect(w.signAttachment.mock.calls.map((c) => c[0])).toEqual([path(A1, 'pdf'), path(A2, 'jpg')]);
    expect(w.incidents).toEqual([]);
  });

  it('a snapshot issued before (no list) still shows no files and signs nothing', async () => {
    const w = await world();
    const r = await serveCapability(w.deps, w.token);
    expect(r.body.attachments).toEqual([]);
    expect(w.signAttachment).not.toHaveBeenCalled();
  });

  it('a file whose link cannot be signed is left out (incident); the quote itself still opens', async () => {
    const w = await world([file(A1, 'pdf'), file(A2, 'pdf')], async (p) => (p.includes(A1) ? null : `https://signed.example/${p}`));
    const r = await serveCapability(w.deps, w.token);
    expect(r.status).toBe(200);
    expect((r.body.attachments as { id: string }[]).map((a) => a.id)).toEqual([A2]);
    expect(w.incidents).toEqual(['issued_attachment_unavailable']);
  });

  it('the final PDF / Print grant carries the same files', async () => {
    const w = await world([file(A1, 'pdf')]);
    const r = await serveGrant(w.deps, w.grant, 'final_pdf');
    expect(r.status).toBe(200);
    expect((r.body.attachments as { id: string }[]).map((a) => a.id)).toEqual([A1]);
  });
});

describe('F17: only copies in the attempt\'s own folder are ever signed', () => {
  const bound = { userId: OWNER, quoteId: Q, attemptId: ATT, snapshotPath: canonicalSnapshotPath(OWNER, Q, ATT), snapshotSha256: 'a'.repeat(64) };
  it.each([
    ['another owner', file(A1, 'pdf', { objectPath: path(A1, 'pdf', ATT, '66666666-6666-4666-8666-666666666666') })],
    ['another quote', file(A1, 'pdf', { objectPath: path(A1, 'pdf', ATT, OWNER, '55555555-5555-4555-8555-555555555555') })],
    ['another attempt', file(A1, 'pdf', { objectPath: path(A1, 'pdf', '99999999-9999-4999-8999-999999999999') })],
    ['the editor path itself', file(A1, 'pdf', { objectPath: `${OWNER}/${Q}_1.pdf` })],
    ['an id that is not the file', file(A1, 'pdf', { objectPath: path(A2, 'pdf') })],
    ['no name', file(A1, 'pdf', { fileName: '' })],
    ['a bad hash', file(A1, 'pdf', { sha256: 'xyz' })],
    ['no size', file(A1, 'pdf', { bytes: 0 })],
  ])('%s -> dropped', (_label, entry) => {
    expect(parseIssuedAttachments(snapshot([entry]), bound)).toEqual({ list: [], dropped: 1 });
  });
  it('a valid entry is kept', () => {
    expect(parseIssuedAttachments(snapshot([file(A1, 'pdf')]), bound)).toEqual({ list: [{ id: A1, fileName: '7777.pdf', objectPath: path(A1, 'pdf') }], dropped: 0 });
  });
});
