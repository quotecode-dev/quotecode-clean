// Owner console 17/11, typed:
// (1) "שינוי בחוק הפריסה של רשימת ההצעות: שם הלקוח וכותרת ההצעה בטבלה במחשב זזים בסלייד במקום שלוש נקודות, ושחרור עד הלייב"
// (2) "מאשר תיקון רוחב המיילים בטלפון: מיילי החשבון ותזכורות הניסיון והמנוי, כולל העלאת שלוש הפונקציות בהקלדה שלי, ושחרור עד הלייב"
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (p) => readFileSync(resolve(p), 'utf8');

describe('(1) the desktop quote list: a long client name / quote title slides instead of an ellipsis', () => {
  const q = src('src/components/QuotesTab.jsx');
  const d = src('src/pages/Dashboard.jsx');
  it('the client name and the quote title cells are SlideText boxes', () => {
    expect(q).toContain('<SlideText as="span" className="quote-modern-client-name" title={clientName}>{clientName}</SlideText>');
    expect(q).toContain('<SlideText as="span" className="quote-modern-title" title={subject}>{subject}</SlideText>');
    expect(q).not.toContain('<span className="quote-modern-client-name"');
    expect(q).not.toContain('<span className="quote-modern-title"');
  });
  it('those two cells clip (the slide moves inside) - no ellipsis; the status cell keeps its rule', () => {
    expect(d).toMatch(/\.quote-modern-title,\s*\.quote-modern-client-name \{ text-overflow: clip; \}/);
    expect(d).toMatch(/\.quote-modern-title,\s*\.quote-modern-status,\s*\.quote-modern-client-name \{[^}]*text-overflow: ellipsis;/);
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
