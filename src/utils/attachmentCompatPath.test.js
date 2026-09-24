// MD-2 (First-LIVE cutover compatibility, 2026-09-25): the attachment-path matcher and the signed-URL trust check.
import { describe, expect, it } from 'vitest';
import { isTrustedSignedAttachmentUrl, matchAttachmentCompatPath } from './attachmentCompatPath';
import { buildAttachmentPath, newUuid } from './quoteSaveOrchestrator';

const OWNER = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const QUOTE = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const PATH = `${OWNER}/${QUOTE}_1790285195272.pdf`;
const PROJECT = 'https://ljfizgrdyzxddswcedwr.supabase.co';
const SIGNED = `${PROJECT}/storage/v1/object/sign/quote-files/${PATH}?token=abc.def.ghi`;

describe('matchAttachmentCompatPath - exactly the save flow\'s storage-path shape', () => {
  it('an old tab\'s relative href resolves (from /dashboard, /, /dashboard/ and with query/hash) to a path that matches and rebuilds the same storage path', () => {
    for (let i = 0; i < 50; i += 1) {
      const uid = newUuid(); const qid = newUuid();
      for (const name of ['plan.PDF', 'photo.jpeg', 'noext', 'a.b.c.docx', 'x.t@r!gz', '']) {
        const stored = buildAttachmentPath(uid, qid, name, 1790000000000 + i);
        for (const base of ['https://www.tekango.com/dashboard', 'https://www.tekango.com/', 'https://www.tekango.com/dashboard/', 'https://www.tekango.com/dashboard?lang=he#quotes']) {
          const { pathname } = new URL(stored, base);
          const m = matchAttachmentCompatPath(pathname);
          expect(m).not.toBeNull();
          expect(m.storagePath).toBe(stored);
          expect(m.ownerId).toBe(uid); expect(m.quoteId).toBe(qid);
        }
      }
    }
  });
  it.each([
    ['legacy LIVE-baseline object name', `/${OWNER}/1790285195272_plan.pdf`],
    ['traversal', `/${OWNER}/../${QUOTE}_1.pdf`],
    ['encoded traversal', `/${OWNER}/%2e%2e/${QUOTE}_1.pdf`],
    ['encoded slash', `/${OWNER}%2F${QUOTE}_1.pdf`],
    ['encoded dot', `/${OWNER}/${QUOTE}_1%2Epdf`],
    ['uppercase uuid', `/${OWNER.toUpperCase()}/${QUOTE}_1.pdf`],
    ['bucket prefix', `/quote-files/${OWNER}/${QUOTE}_1.pdf`],
    ['storage API path', `/storage/v1/object/public/quote-files/${OWNER}/${QUOTE}_1.pdf`],
    ['extra segment', `/${OWNER}/${QUOTE}/${QUOTE}_1.pdf`],
    ['other prefix', `/he/${OWNER}/${QUOTE}_1.pdf`],
    ['double slash', `//${OWNER}/${QUOTE}_1.pdf`],
    ['backslash', `/${OWNER}\\${QUOTE}_1.pdf`],
    ['no stamp', `/${OWNER}/${QUOTE}.pdf`],
    ['long ext', `/${OWNER}/${QUOTE}_1.abcdefghijk`],
    ['upper ext', `/${OWNER}/${QUOTE}_1.PDF`],
    ['trailing slash', `/${OWNER}/${QUOTE}_1.pdf/`],
    ['malformed uuid', `/${OWNER.slice(0, -1)}/${QUOTE}_1.pdf`],
    ['app route /dashboard', '/dashboard'],
    ['app route /he/tools', '/he/tools'],
    ['app route public quote', `/public-quote/${QUOTE}`],
    ['app route quote', `/quote/${QUOTE}`],
    ['app route preview', `/public-quote/${QUOTE}/preview`],
    ['empty', ''],
  ])('refuses %s', (_label, p) => {
    expect(matchAttachmentCompatPath(p)).toBeNull();
  });
  it('refuses non-strings', () => {
    for (const v of [null, undefined, 42, {}, ['/x']]) expect(matchAttachmentCompatPath(v)).toBeNull();
  });
});

describe('isTrustedSignedAttachmentUrl - never an open redirect', () => {
  it('accepts exactly this project\'s signed-object URL for this object', () => {
    expect(isTrustedSignedAttachmentUrl(SIGNED, PROJECT, PATH)).toBe(true);
  });
  it.each([
    ['other origin', SIGNED.replace('ljfizgrdyzxddswcedwr', 'ixabnzhjeqevtbhdfswv')],
    ['attacker origin', `https://evil.example/storage/v1/object/sign/quote-files/${PATH}?token=x`],
    ['http downgrade', SIGNED.replace('https://', 'http://')],
    ['credentials in URL', SIGNED.replace('https://', 'https://u:p@')],
    ['public object URL', `${PROJECT}/storage/v1/object/public/quote-files/${PATH}`],
    ['other bucket', SIGNED.replace('/quote-files/', '/avatars/')],
    ['other object', SIGNED.replace('_1790285195272', '_1')],
    ['no token', `${PROJECT}/storage/v1/object/sign/quote-files/${PATH}`],
    ['javascript URL', 'javascript:alert(1)'],
    ['protocol-relative', `//evil.example/storage/v1/object/sign/quote-files/${PATH}?token=x`],
    ['garbage', 'not a url'],
    ['null', null],
  ])('refuses %s', (_label, url) => {
    expect(isTrustedSignedAttachmentUrl(url, PROJECT, PATH)).toBe(false);
  });
  it('refuses when the configured project URL is missing or not http(s)', () => {
    expect(isTrustedSignedAttachmentUrl(SIGNED, undefined, PATH)).toBe(false);
    expect(isTrustedSignedAttachmentUrl(SIGNED, 'ftp://x', PATH)).toBe(false);
  });
});
