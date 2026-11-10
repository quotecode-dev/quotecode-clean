// Owner console 2026-11-10 (finding 3, typed: "מאשר תוכנית ממצא 3: עיצוב, לוגו ותמונות מתעדכנים אצל הלקוח עד החתימה ונעולים מרגע החתימה,
// כולל שינוי ב-L-04, L-06, L-15, L-17, L-24, L-26, L-27"): the customer's link shows the current appearance until the signature.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { planDraftSave, resolveLivePresentation, presentationFingerprint, signedPath } from './lib.ts';

const NOW = new Date('2026-11-10T10:00:00.000Z');
const U = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const business = { business_name: 'Biz', logo_url: 'https://x/logo-new.png' };

describe('finding 3 - live until the signature, locked from it', () => {
  it('a sent (issued), unsigned quote still saves its appearance; a signed one does not', () => {
    const base = { issued: { v: 1, style: 'classic' }, existingDraft: null, media: [], tier: 'modern', ownedAssetIds: [], now: NOW };
    expect(planDraftSave({ ...base, quote: { status: 'sent' }, style: 'modern' })).toMatchObject({ ok: true });
    expect(planDraftSave({ ...base, quote: { status: 'sent', signature: 'data:image/png;base64,AA==' }, style: 'modern' })).toMatchObject({ ok: false, code: 'quote_locked' });
  });
  it('the live presentation = the current draft style + the business branding now; none without a draft', () => {
    const live = resolveLivePresentation({ draft: { style: 'modern', media: [] }, quote: { status: 'sent' }, tier: 'modern', defaultStyle: null, business, now: NOW });
    expect(live).toMatchObject({ style: 'modern' });
    expect(JSON.stringify(live.branding)).toContain('logo-new.png');
    expect(resolveLivePresentation({ draft: null, quote: { status: 'sent' }, tier: 'modern', defaultStyle: null, business, now: NOW })).toBe(null);
  });
  it('the fingerprint changes with the style, the logo or the media, and is stable otherwise', () => {
    const a = { style: 'classic', styleVersion: 1, branding: { logo_url: 'a' }, media: [] };
    expect(presentationFingerprint(a)).toBe(presentationFingerprint({ ...a }));
    expect(presentationFingerprint(a)).not.toBe(presentationFingerprint({ ...a, style: 'modern' }));
    expect(presentationFingerprint(a)).not.toBe(presentationFingerprint({ ...a, branding: { logo_url: 'b' } }));
    expect(presentationFingerprint(a)).not.toBe(presentationFingerprint({ ...a, media: [{ assetId: 'x' }] }));
  });
  it('the signed record has its own path next to issued.json', () => {
    expect(signedPath(U, Q)).toMatch(/\/quotes\/22222222-2222-4222-8222-222222222222\/signed\.json$/);
  });
  it('public_get by capability: live until signed, the signed record once locked (written once), fingerprint in the answer', () => {
    const src = readFileSync(join(cwd(), 'supabase/functions/quote-presentation/index.ts'), 'utf8');
    expect(src).toMatch(/if \(isLockedQuote\(quote\)\) \{[\s\S]*signedPath\(uid, quote\.id\)[\s\S]*writeJson\(admin, signedPath\(uid, quote\.id\), atSignature, false\)/);
    expect(src).toMatch(/mode = 'live'/);
    expect(src).toMatch(/fingerprint: presentationFingerprint\(pres\)/);
  });
});
