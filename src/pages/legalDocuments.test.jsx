// Task 39 (Owner final scope 2026-10-13): the public documents carry the Owner's details, the purchase / renewal / cancellation / refund
// terms "when a subscription is purchased" next to the true availability (nothing purchasable today), the Owner's final refund decision,
// the approved Privacy §3 disclosure, a factual accessibility statement and the cancellation-request path - in HE and EN, with no
// placeholders, no Hebrew on the English pages, the phone on the Israeli site only.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Terms from './Terms';
import Privacy from './Privacy';
import Contact from './Contact';
import AccessibilityModal from '../components/AccessibilityModal';

const text = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>).container.textContent;
const HEB = /[א-ת]/;
const PLACEHOLDER = /\[[^\]]*\]|TBD|lorem|placeholder|טרם נקבעו תנאי/i;

describe('Terms', () => {
  const he = text(<Terms isHebrew />); const en = text(<Terms isHebrew={false} />);
  it('names the operator and contact per site (phone on the Israeli site only)', () => {
    expect(he).toMatch(/שלמה סיני/); expect(he).toMatch(/023716913/); expect(he).toMatch(/שרה אהרונסון, רמת גן/); expect(he).toMatch(/050-2993806/); expect(he).toMatch(/support@tekango\.com/);
    expect(en).toMatch(/Shlomo Sinai/); expect(en).toMatch(/023716913/); expect(en).toMatch(/info@tekango\.com/);
    expect(en).not.toMatch(/050-2993806|2993806/);
  });
  it('purchase / renewal / cancellation / refund terms apply when a subscription is purchased, beside the true availability', () => {
    expect(he).toMatch(/בעת רכישת מנוי/); expect(he).toMatch(/אישור מפורש/); expect(he).toMatch(/רכישת מנוי ותשלום מקוון עדיין אינם פעילים/);
    expect(en).toMatch(/when a subscription is purchased/); expect(en).toMatch(/explicit approval/); expect(en).toMatch(/subscription purchase and online payment are not active yet/);
    expect(`${he}${en}`).not.toMatch(/PayPlus|checkout is active|תשלום פעיל/i);
  });
  it('the Owner\'s refund decision: pro-rata unused period, fee only where lawful + disclosed, capped, annual discount kept', () => {
    expect(he).toMatch(/החלק היחסי של התקופה שלא נוצלה/); expect(he).toMatch(/הנמוך מבין 5% ממחיר העסקה או 100 ₪/); expect(he).toMatch(/ההנחה השנתית לא תישלל/);
    expect(he).toMatch(/לא תתווסף אוטומטית עמלה של חברת האשראי/); expect(he).toMatch(/הפסקת החידוש/); expect(he).toMatch(/סיום מוקדם/);
    expect(en).toMatch(/proportional part of the unused period/); expect(en).toMatch(/lower of 5% of the transaction price/); expect(en).toMatch(/annual discount is not clawed back/);
    expect(en).toMatch(/no card-company fee is added automatically/); expect(en).toMatch(/stopping the renewal/); expect(en).toMatch(/early termination/);
    expect(he).toMatch(/ביטול מנוי אינו סגירת חשבון/); expect(en).toMatch(/Cancelling a subscription is not closing the account/);
    expect(he).toMatch(/אינו ביטול אוטומטי/); expect(en).toMatch(/not an automatic cancellation/);
  });
  it('approved facts kept (prices, Free-10 counting); no placeholders; no Hebrew on the English page; no ILS on the English page', () => {
    expect(he).toMatch(/30\.00 ₪ לחודש או 306\.00 ₪ לשנה/); expect(en).toMatch(/18\.00 USD per month or 184\.00 USD per year/);
    expect(he).toMatch(/הפקה חוזרת של אותה גרסה לאותו לקוח/);
    for (const t of [he, en]) expect(t).not.toMatch(PLACEHOLDER);
    expect(en).not.toMatch(HEB); expect(en).not.toMatch(/₪|\bILS\b|\bNIS\b/);
  });
  it('the cancellation section has the stable anchor the landing / plans window link to', () => {
    const { container } = render(<MemoryRouter><Terms isHebrew /></MemoryRouter>);
    expect(container.querySelector('#cancellation')).toBeTruthy();
  });
});

describe('Privacy', () => {
  const he = text(<Privacy isHebrew />); const en = text(<Privacy isHebrew={false} />);
  it('keeps the approved §3 disclosure (Supabase / OpenAI / Resend) verbatim in meaning', () => {
    expect(he).toMatch(/Supabase/); expect(he).toMatch(/OpenAI/); expect(he).toMatch(/Resend/); expect(he).toMatch(/ובהם גם פרטי לקוח כמו שם, איש קשר, מייל וטלפון/); expect(he).not.toMatch(/אינה מצרפת לשאלה באופן אוטומטי/);
    expect(en).toMatch(/Supabase/); expect(en).toMatch(/OpenAI/); expect(en).toMatch(/Resend/); expect(en).toMatch(/including client details such as name, contact person, email and phone/); expect(en).not.toMatch(/does not automatically attach/);
  });
  it('responsible party, conditional payment wording, marketing separation; no absolute-deletion promise', () => {
    // Owner 2026-10-15: the operator's identity appears only in the Terms; the Privacy Policy points there
    expect(he).toMatch(/מפעיל השירות, כמפורט בתנאי השימוש/); expect(en).toMatch(/its operator, as set out in the Terms of Use/);
    expect(`${he}${en}`).not.toMatch(/שלמה סיני|Shlomo Sinai|023716913|2993806/);
    expect(he).toMatch(/בעת ביצוע רכישה, ספק התשלום החיצוני/); expect(en).toMatch(/When a purchase is made, the external payment provider/);
    expect(he).toMatch(/אינה הסכמה לדיוור שיווקי/); expect(en).toMatch(/is not consent to marketing emails/);
    expect(`${he}${en}`).not.toMatch(/מחיקתו המוחלטת|complete deletion/);
    expect(en).not.toMatch(HEB);
    for (const t of [he, en]) expect(t).not.toMatch(PLACEHOLDER);
  });
});

describe('Contact + accessibility statement', () => {
  it('no operator name / registration no. / address / phone (Owner 2026-10-15: Terms only); the cancellation-request mailto', () => {
    const he = render(<MemoryRouter><Contact isHebrew /></MemoryRouter>).container;
    const en = render(<MemoryRouter><Contact isHebrew={false} /></MemoryRouter>).container;
    expect(he.querySelector('[data-testid="contact-phone"]')).toBeNull();
    expect(`${he.textContent}${en.textContent}`).not.toMatch(/שלמה סיני|Shlomo Sinai|023716913|2993806|שרה אהרונסון|Aharonson/);
    expect(he.textContent).toMatch(/פרטי המפעיל מופיעים בתנאי השימוש/); expect(en.textContent).toMatch(/The operator's details are set out in the Terms of Use/);
    expect(en.querySelector('[data-testid="contact-phone"]')).toBeNull();
    expect(he.querySelector('[data-testid="contact-cancel-request"]').getAttribute('href')).toMatch(/^mailto:support@tekango\.com\?subject=/);
    expect(en.querySelector('[data-testid="contact-cancel-request"]').getAttribute('href')).toMatch(/^mailto:info@tekango\.com\?subject=/);
    expect(en.querySelector('[data-testid="contact-business"]').textContent).not.toMatch(HEB);
  });
  it('the accessibility statement: real date, verified adjustments, stated limitation, real contact; no full-compliance claim', () => {
    const he = render(<AccessibilityModal isOpen isHebrew onClose={() => {}} />).container.textContent;
    const en = render(<AccessibilityModal isOpen isHebrew={false} onClose={() => {}} />).container.textContent;
    expect(he).toMatch(/13 באוקטובר 2026/); expect(he).toMatch(/support@tekango\.com/); expect(he).not.toMatch(/2993806/); expect(he).toMatch(/דרך הצ׳אט באתר/); expect(he).toMatch(/איננו מצהירים על עמידה מלאה/);
    expect(en).toMatch(/October 13, 2026/); expect(en).toMatch(/info@tekango\.com/); expect(en).toMatch(/we do not claim full conformance/); expect(en).not.toMatch(/2993806/);
    expect(`${he}${en}`).not.toMatch(/Beta|WCAG 2\.1 AA compliant|עומד(ת)? בתקן/);
  });
});
