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

// (3) Owner console 17/11, typed: "מאשר שינוי ב-L-19: שם לקוח ארוך בכרטיס ההצעה בטלפון זז בסלייד במקום שלוש נקודות, ושחרור עד הלייב"
describe('(3) the phone / tablet quote card: a long client name slides at every width (L-19 change)', () => {
  const q = src('src/components/QuotesTab.jsx');
  const d = src('src/pages/Dashboard.jsx').split(String.fromCharCode(13)).join('');
  it('the card name is a SlideText box that clips (no ellipsis) and keeps data-qh="client"', () => {
    const card = q.slice(q.indexOf('className="quote-card"'));
    const box = card.slice(card.indexOf('<SlideText'), card.indexOf('</SlideText>'));
    expect(box).toContain('data-qh="client"');
    expect(box).toContain("textOverflow: 'clip', whiteSpace: 'nowrap'");
  });
  it('the card slide rule sits OUTSIDE every width condition (a phone runs it too)', () => {
    const style = d.slice(d.indexOf('<style>{`') + '<style>{`'.length, d.indexOf('`}</style>'));
    const at = style.indexOf('.quote-card [data-qh="client"] > .pf-slide {');
    expect(at).toBeGreaterThan(0);
    let depth = 0; for (const ch of style.slice(0, at)) { if (ch === '{') depth += 1; else if (ch === '}') depth -= 1; }
    expect(depth).toBe(0);
    expect(style).toContain('.quote-card [data-qh="client"] > .pf-slide--on { animation: pf-card-slide-move');
    expect(style).toMatch(/@keyframes pf-card-slide-move \{/);
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
