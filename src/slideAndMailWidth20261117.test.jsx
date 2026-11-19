// Owner console 17/11, typed:
// (1) "שינוי בחוק הפריסה של רשימת ההצעות: שם הלקוח וכותרת ההצעה בטבלה במחשב זזים בסלייד במקום שלוש נקודות, ושחרור עד הלייב"
// (2) "מאשר תיקון רוחב המיילים בטלפון: מיילי החשבון ותזכורות הניסיון והמנוי, כולל העלאת שלוש הפונקציות בהקלדה שלי, ושחרור עד הלייב"
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (p) => readFileSync(resolve(p), 'utf8');

// (1) and (3) replaced by the Owner (console 2026-11-19, typed: "שינוי בחוק הפריסה של רשימת ההצעות: שם הלקוח וכותרת ההצעה בטבלה במחשב מסתיימים
// בשלוש נקודות ומוצגים במלואם בריחוף, והעמודות הקבועות צרות לפי התוכן שלהן" + "מאשר שלוש נקודות עם ריחוף במחשב ובועה בנגיעה בנייד בכל המקומות
// כמו בתמונות, וצמצום העמודות ברשימת ההצעות, כולל שינוי ב-L-17 ו-L-19, ושחרור עד הלייב"): nothing moves any more - "…" + the whole text in a bubble
describe('(1) the desktop quote list: a long client name / quote title ends with "…" and shows whole on hover (19/11)', () => {
  const q = src('src/components/QuotesTab.jsx');
  const d = src('src/pages/Dashboard.jsx');
  it('the client name and the quote title cells are EllipsisText boxes', () => {
    expect(q).toContain('<EllipsisText className="quote-modern-client-name" text={clientName} />');
    expect(q).toContain('<EllipsisText className="quote-modern-title" text={subject} />');
    expect(q).not.toContain('SlideText');
    expect(q).not.toContain('<span className="quote-modern-title"');
  });
  it('those two cells end with an ellipsis (no clip rule any more); the status cell keeps its rule', () => {
    expect(d).not.toMatch(/\.quote-modern-title,\s*\.quote-modern-client-name \{ text-overflow: clip; \}/);
    expect(d).toMatch(/\.quote-modern-title,\s*\.quote-modern-status,\s*\.quote-modern-client-name \{[^}]*text-overflow: ellipsis;/);
  });
});

describe('(3) the phone / tablet quote card: a long client name ends with "…" and a tap shows it whole (L-19 change 19/11)', () => {
  const q = src('src/components/QuotesTab.jsx');
  const d = src('src/pages/Dashboard.jsx').split(String.fromCharCode(13)).join('');
  it('the card name is an EllipsisText box (shared .pf-ell rule) and keeps data-qh="client"', () => {
    const card = q.slice(q.indexOf('className="quote-card"'));
    const box = card.slice(card.indexOf('<EllipsisText'), card.indexOf('/>', card.indexOf('<EllipsisText')));
    expect(box).toContain('data-qh="client"');
    expect(box).toContain('text={quote.clients?.company_name');
    expect(box).not.toContain("textOverflow: 'clip'");
  });
  it('no slide rule is left anywhere (the card, the sidebar, the shared rule)', () => {
    const style = d.slice(d.indexOf('<style>{`') + '<style>{`'.length, d.indexOf('`}</style>'));
    expect(style).not.toContain('.pf-slide');
    expect(d).not.toMatch(/@keyframes pf-(card-)?slide-move/);
    expect(src('src/index.css')).toMatch(/\.pf-ell \{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; \}/);
  });
});

describe('(2) the account / trial / subscription e-mails fit a phone: the card is fluid up to 480px', () => {
  for (const f of ['supabase/functions/auth-send-email-hook/emailContent.ts', 'supabase/functions/send-subscription-expiration-email/index.ts', 'supabase/functions/send-trial-expiration-email/reminderContent.ts']) {
    it(f, () => {
      const s = src(f);
      expect(s).not.toContain('width="480"');
      expect(s).toContain('width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;');
    });
  }
});
