// Owner console 2026-11-26, typed: "מאשר ליישם בשחרור אחד את שורת הביטחון, הכלים החינמיים, דף היכולת בלי חלק הסרטון עד שיצולם, קובץ ההסבר
// למנועי AI ודף ההשוואה כמו בסקיצות, ולשחרר עד הלייב" + "מאשר שינוי ב-L-02, L-06, L-14 ו-L-15 לשחרור הכלים, הדפים ושורת הביטחון, כולל No card
// needed באנגלית". Guards of the free tools, the comparison page, the smart-quote capability page and /llms.txt.
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FreeQuoteTemplatePage, VatCalculatorPage } from './components/FreeTools';
import { ComparePage, SmartQuoteFeaturePage } from './pages/MarketingPages';
import { HUB_CARDS } from './shared/publicToolsGuides';
import { PUBLIC_SEO_ROUTES } from './shared/publicSeoRoutes';

const here = path.dirname(fileURLToPath(import.meta.url));
afterEach(cleanup);
const mount = (el) => render(<MemoryRouter>{el}</MemoryRouter>);
const NEW_PATHS = ['/tools/quote-template', '/tools/tax', '/compare/word-excel-whatsapp', '/features/smart-quote'];

describe('the free quote template (nothing stored, the product PDF tool)', () => {
  const fill = (he) => {
    const d = screen.getAllByLabelText(new RegExp(`^${he ? 'תיאור' : 'Description'} \\d`));
    const q = screen.getAllByLabelText(new RegExp(`^${he ? 'כמות' : 'Qty'} \\d`));
    const p = screen.getAllByLabelText(new RegExp(`^${he ? 'מחיר' : 'Price'} \\d`));
    fireEvent.change(d[0], { target: { value: he ? 'צביעת דירה' : 'Apartment painting' } }); fireEvent.change(q[0], { target: { value: '1' } }); fireEvent.change(p[0], { target: { value: '4500' } });
    fireEvent.change(d[1], { target: { value: he ? 'תיקון סדקים' : 'Crack repairs' } }); fireEvent.change(q[1], { target: { value: '3' } }); fireEvent.change(p[1], { target: { value: '250' } });
  };
  it('Hebrew: shekels with 18% VAT', () => {
    mount(<FreeQuoteTemplatePage lang="he" />); fill(true);
    expect(screen.getByTestId('free-template-total').textContent).toBe('₪6,195.00');
    expect(screen.getByTestId('free-template-doc').textContent).toContain('מע״מ (18%)');
  });
  it('English: US dollars, no tax line, no shekel / VAT', () => {
    mount(<FreeQuoteTemplatePage lang="en" />); fill(false);
    expect(screen.getByTestId('free-template-total').textContent).toBe('$5,250.00');
    const text = document.body.textContent;
    expect(text).not.toMatch(/₪|bVATb|credit card/i);
  });
  it('a line can be added (the sketch: "+ line", no remove button)', () => {
    mount(<FreeQuoteTemplatePage lang="he" />);
    fireEvent.click(screen.getByTestId('free-template-add'));
    expect(screen.getAllByLabelText(/^תיאור \d/)).toHaveLength(3);
    expect(screen.queryByLabelText(/הסרת השורה/)).toBeNull();
  });
  it('an amount is shown with thousands separators once the field is left (4,500)', () => {
    mount(<FreeQuoteTemplatePage lang="he" />);
    const p = screen.getAllByLabelText(/^מחיר \d/)[0];
    fireEvent.change(p, { target: { value: '4500' } }); fireEvent.blur(p);
    expect(p.value).toBe('4,500');
  });
  it('the PDF is made by the product PDF tool loaded on the click only, and nothing is saved anywhere', () => {
    const src = fs.readFileSync(path.join(here, 'components/FreeTools.jsx'), 'utf8');
    expect(src).toContain("await import('../utils/generateQuotePdf')");
    expect(src).not.toMatch(/^import .*generateQuotePdf/m);
    expect(src).not.toMatch(/localStorage|sessionStorage|supabase|fetch\(/);
  });
});

describe('the VAT (Israel) / sales-tax (international) calculator', () => {
  it('Hebrew adds and extracts 18%', () => {
    mount(<VatCalculatorPage lang="he" />);
    expect(screen.getByTestId('free-tax-result').textContent).toContain('₪1,180.00');
    fireEvent.click(screen.getByTestId('free-tax-extract'));
    fireEvent.change(screen.getByLabelText('סכום כולל מע״מ (₪)'), { target: { value: '1180' } });
    expect(screen.getByTestId('free-tax-result').textContent).toContain('₪1,000.00');
    expect(screen.getByTestId('free-tax-result').textContent).toContain('₪180.00');
  });
  it('English uses the typed rate, no result before a rate, no VAT / shekel', () => {
    mount(<VatCalculatorPage lang="en" />);
    expect(screen.getByTestId('free-tax-result').textContent).toContain('—');
    fireEvent.change(screen.getByLabelText('Tax rate (%)'), { target: { value: '8.25' } });
    expect(screen.getByTestId('free-tax-result').textContent).toContain('$1,082.50');
    expect(document.body.textContent).not.toMatch(/₪|bVATb|credit card/i);
  });
});

describe('the comparison page and the smart-quote capability page', () => {
  it('no competitor names; the facts of the live plans; English without shekel / VAT / credit card', () => {
    mount(<ComparePage lang="he" />);
    expect(document.body.textContent).toContain('₪30.00 לחודש כולל מע״מ');
    cleanup(); mount(<ComparePage lang="en" />);
    expect(document.body.textContent).toContain('$18 a month');
    expect(document.body.textContent).not.toMatch(/₪|bVATb|credit card/i);
  });
  it('the capability page has no video part until it is filmed (Owner) and no link to a page that does not exist', () => {
    for (const lang of ['he', 'en']) {
      mount(<SmartQuoteFeaturePage lang={lang} />);
      expect(document.querySelector('video, iframe')).toBeNull();
      const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual([`/${lang}`]);
      expect(document.querySelectorAll('li img')).toHaveLength(3);
      cleanup();
    }
    mount(<SmartQuoteFeaturePage lang="en" />);
    expect(document.body.textContent).toContain('$5 a month, or $51 a year');
    expect(document.body.textContent).not.toMatch(/₪|bVATb|credit card/i);
  });
});

describe('routing, SEO, sitemap, hub and /llms.txt', () => {
  it('the hub lists the template first and the tax calculator second, then the four calculators (both languages)', () => {
    expect(HUB_CARDS.he.map((c) => c.key)).toEqual(['quote-template', 'tax', 'currency', 'units', 'metals', 'crypto']);
    expect(HUB_CARDS.en.map((c) => c.key)).toEqual(['quote-template', 'tax', 'currency', 'units', 'metals', 'crypto']);
  });
  it('every new page is routed in both apps, registered for SEO and listed in the sitemap', () => {
    const local = fs.readFileSync(path.join(here, 'local/AppLocal.jsx'), 'utf8');
    const global = fs.readFileSync(path.join(here, 'global/AppGlobal.jsx'), 'utf8');
    const sitemap = fs.readFileSync(path.join(here, '..', 'public/sitemap.xml'), 'utf8');
    for (const p of NEW_PATHS) {
      expect(local).toContain(`path="/he${p}"`); expect(global).toContain(`path="/en${p}"`);
      for (const lang of ['he', 'en']) {
        expect(PUBLIC_SEO_ROUTES.some((r) => r.path === `/${lang}${p}`)).toBe(true);
        expect(sitemap).toContain(`<loc>https://www.tekango.com/${lang}${p}</loc>`);
      }
    }
  });
  it('/llms.txt is a static file naming the live facts and the new pages', () => {
    const t = fs.readFileSync(path.join(here, '..', 'public/llms.txt'), 'utf8');
    for (const s of ['ILS 30.00 per month, VAT included', 'USD 18.00 per month', 'ILS 10 per month', 'USD 5 per month', '10 quotes or 7 days']) expect(t).toContain(s);
    for (const p of NEW_PATHS) expect(t).toContain(`https://www.tekango.com/he${p}`);
  });
});
