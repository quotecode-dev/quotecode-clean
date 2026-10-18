// בעל המערכת 2026-10-18 ("לתקן עכשיו את הלוגו במייל?" -> "כן"): לוגו שהועלה מהמחשב מופיע במייל כתמונה פנימית (cid:).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { buildQuoteEmail, inlineLogoAttachment, INLINE_LOGO_CID, safeLogoUrl } from './emailTemplate.ts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]).toString('base64');
const base = { bizTitle: 'שיפוצי אלון', clientDisplayName: 'דנה', quoteNumberDisplay: 'A1', symbol: '₪', displayTotal: '100.00', quoteLink: 'https://example.com/q', shareText: null };

describe('לוגו שהועלה מהמחשב במייל', () => {
  it('PNG אמיתי מצורף כתמונה פנימית', () => {
    expect(inlineLogoAttachment(`data:image/png;base64,${PNG}`)).toEqual({ filename: 'logo.png', content: PNG, content_type: 'image/png', content_id: INLINE_LOGO_CID });
  });
  it('JPEG אמיתי מצורף כתמונה פנימית', () => {
    expect(inlineLogoAttachment(`data:image/jpeg;base64,${JPEG}`)).toMatchObject({ filename: 'logo.jpg', content_type: 'image/jpeg' });
  });
  it('SVG, קובץ שאינו תמונה אמיתית, קובץ גדול מ-500KB או קישור - לא מצורפים', () => {
    expect(inlineLogoAttachment(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).toBeNull();
    expect(inlineLogoAttachment(`data:image/png;base64,${Buffer.from('not an image').toString('base64')}`)).toBeNull();
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500 * 1024)]).toString('base64');
    expect(inlineLogoAttachment(`data:image/png;base64,${big}`)).toBeNull();
    expect(inlineLogoAttachment('https://example.com/logo.png')).toBeNull();
    expect(inlineLogoAttachment(null)).toBeNull();
  });
  it('במייל מופיעה התמונה הפנימית במקום שם העסק', () => {
    for (const hebrew of [true, false]) {
      const { html } = buildQuoteEmail({ ...base, hebrew, logoUrl: `cid:${INLINE_LOGO_CID}` });
      expect(html).toContain(`<img src="cid:${INLINE_LOGO_CID}"`);
    }
  });
  it('קישור לתמונה באינטרנט ממשיך לעבוד כמו היום, ו-SVG בקישור עדיין לא נכנס', () => {
    expect(safeLogoUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(safeLogoUrl('https://example.com/logo.svg')).toBeNull();
  });
  it('השליחה מצרפת את הלוגו רק כשאין קישור, ומפנה אליו מהמייל', () => {
    const src = readFileSync(join(cwd(), 'supabase', 'functions', 'send-quote-email', 'index.ts'), 'utf8');
    expect(src).toContain('const logoAttachment = linkLogo ? null : inlineLogoAttachment(rawLogo);');
    expect(src).toContain('const validLogo = linkLogo || (logoAttachment ? `cid:${INLINE_LOGO_CID}` : null);');
    expect(src).toContain('...(logoAttachment ? { attachments: [logoAttachment] } : {}),');
  });
});
