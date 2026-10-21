// Task 28: the owner's manual share text in WhatsApp / "copy message" / manual email through ONE shared formatter - variables by
// market and language, bidi isolation, escaping per text / HTML / URL, the quote link exactly once, an empty default keeps the existing
// message, unsupported variables expose nothing. Synthetic only: no email / WhatsApp is ever sent.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildShareText, escapeHtml, renderShareTemplate, SHARE_VARIABLES } from '../supabase/functions/_shared/shareMessage.js';
import { emailIntroHtml } from '../supabase/functions/send-quote-email/emailIntro.ts';
import { renderShareText } from './utils/shareDefaultsClient';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
const LRI = '⁦'; const FSI = '⁨'; const PDI = '⁩';
const HE_VARS = { customer: 'דנה כהן', business: 'עסק סינתטי', number: 'A12002', total: '₪1,180.00' };
const EN_VARS = { customer: 'Synthetic Alpha Ltd', business: 'Synthetic QA Business', number: 'A12002', total: '$1,000.00' };

describe('shared formatter', () => {
  it('only the four variables; unknown braces stay literal (no other value can be pulled in)', () => {
    expect(SHARE_VARIABLES).toEqual(['{customer}', '{business}', '{number}', '{total}']);
    expect(renderShareTemplate('Hi {customer} {email} {user_id} {CUSTOMER} {total}', { ...EN_VARS, email: 'secret@x.test' }))
      .toBe('Hi Synthetic Alpha Ltd {email} {user_id} {CUSTOMER} $1,000.00');
  });
  it('HE text: values are bidi isolates (number / total LTR, names first-strong)', () => {
    expect(renderShareTemplate('שלום {customer}, הצעה {number} בסך {total}', HE_VARS, { rtl: true }))
      .toBe(`שלום ${FSI}דנה כהן${PDI}, הצעה ${LRI}A12002${PDI} בסך ${LRI}₪1,180.00${PDI}`);
  });
  it('EN text: no isolate characters', () => {
    expect(renderShareTemplate('Hello {customer}, quote {number}', EN_VARS)).toBe('Hello Synthetic Alpha Ltd, quote A12002');
  });
  it('control and bidi-override characters inside values or the template are removed', () => {
    expect(renderShareTemplate('A‮{customer}\u0007', { customer: 'x‮y⁦z' })).toBe('Axyz');
  });
  it('HTML: the template and every value are escaped; numbers are dir="ltr" <bdi>; newlines become <br/>', () => {
    const html = renderShareTemplate('<b>Hi</b> {customer}\n{number} & "{total}"', { customer: '<img src=x onerror=alert(1)>', number: 'A1', total: '$5.00' }, { format: 'html' });
    expect(html).toBe('&lt;b&gt;Hi&lt;/b&gt; <bdi>&lt;img src=x onerror=alert(1)&gt;</bdi><br/><bdi dir="ltr">A1</bdi> &amp; &quot;<bdi dir="ltr">$5.00</bdi>&quot;');
    expect(html).not.toMatch(/<img|<b>/);
    expect(escapeHtml(`'`)).toBe('&#39;');
  });
  it('empty / blank / missing template -> null (the caller keeps its existing message)', () => {
    for (const t of ['', '   ', null, undefined, '\n\n']) expect(renderShareTemplate(t, EN_VARS)).toBeNull();
    expect(buildShareText({ template: '', vars: EN_VARS, link: 'https://x', linkLabel: 'View quote:' })).toBeNull();
    expect(renderShareText('')).toBeNull();
  });
  it('the quote link is appended exactly once, after the owner text; URL encoding stays the transport\'s job', () => {
    const link = 'https://www.tekango.com/public-quote/c/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const t = buildShareText({ template: 'שלום {customer}', vars: HE_VARS, link, linkLabel: 'צפה בהצעה:', rtl: true });
    expect(t).toBe(`שלום ${FSI}דנה כהן${PDI}\n\nצפה בהצעה:\n${link}`);
    expect(t.split(link)).toHaveLength(2);
    const wa = `https://api.whatsapp.com/send?text=${encodeURIComponent(t)}`;
    expect(decodeURIComponent(wa.split('text=')[1])).toBe(t);
    expect(wa).not.toMatch(/[ \n]/);
  });
  it('the template is bounded like the database (600)', () => {
    expect(renderShareTemplate('x'.repeat(700), {})).toHaveLength(600);
  });
});

describe('manual email intro (send-quote-email, server-derived values)', () => {
  const base = { bizTitle: 'Synthetic Biz', vars: { customer: 'Dana', business: 'Synthetic Biz', number: 'A12002', total: '₪1,180.00' } };
  it('no owner text -> the built-in sentence, byte-identical (HE and EN)', () => {
    expect(emailIntroHtml({ ...base, shareText: null, hebrew: true })).toBe('מצורפת הצעת המחיר שלך ממערכת <strong>Synthetic Biz</strong>.');
    expect(emailIntroHtml({ ...base, shareText: '   ', hebrew: false })).toBe('Please find your quote attached from <strong>Synthetic Biz</strong>.');
    expect(emailIntroHtml({ ...base, shareText: 42, hebrew: false })).toBe('Please find your quote attached from <strong>Synthetic Biz</strong>.');
  });
  it('owner text -> escaped HTML with server values; no link inside (the button stays the only link)', () => {
    const html = emailIntroHtml({ ...base, shareText: 'שלום {customer} <a href="https://evil.test">x</a> {number}', hebrew: true });
    expect(html).toBe('שלום <bdi>Dana</bdi> &lt;a href=&quot;https://evil.test&quot;&gt;x&lt;/a&gt; <bdi dir="ltr">A12002</bdi>');
    expect(html).not.toMatch(/<a /);
  });
  it('the function reads the owner text for the VERIFIED owner only and never from the request body', () => {
    const src = read('../supabase/functions/send-quote-email/index.ts');
    const block = src.slice(src.indexOf('let ownerShareText'), src.indexOf('let bizCountry'));
    expect(block).toContain(".from('business_share_defaults')");
    expect(block).toContain(".select('share_text')");
    expect(block).toContain(".eq('user_id', quoteRow.user_id)");
    expect(src.indexOf('let ownerShareText')).toBeGreaterThan(src.indexOf('if (quoteRow.user_id !== callerUser.id)'));
    expect(src).not.toMatch(/body\.(shareText|share_text|message|intro)/);
    // Task 29: the fixed template moved to the pure emailTemplate.ts (HE + EN, each with the intro once)
    expect(read('../supabase/functions/send-quote-email/emailTemplate.ts').split('${introHtml}')).toHaveLength(3);
  });
});

describe('app wiring (WhatsApp + copy message share ONE message builder)', () => {
  const d = read('pages/Dashboard.jsx');
  const slice = (start, end) => d.slice(d.indexOf(start), d.indexOf(end, d.indexOf(start)));
  it('WhatsApp builds its text through quoteShareMessage; the built-in message is kept for an empty default', () => {
    const wa = slice('const sendWhatsApp = (proposal, authorized = null) => {', 'const authorizeAndSendWhatsApp');
    expect(wa).toContain('const text = quoteShareMessage(proposal, authorized?.viewLink || null);');
    expect(wa).toContain('encodeURIComponent(text)');
    const fn = slice('const quoteShareMessage = (proposal, viewLinkOverride = null) => {', 'const copyQuoteMessage');
    expect(fn).toContain('buildShareText({');
    expect(fn).toContain('rtl: isLocalQuote');
    // Task 36: the same rule (owner text first, the built-in message as the fallback), wrapped by the partial-total line of section A
    expect(fn).toContain('return appendPartialTotalNote(ownerText ?? (isLocalQuote');
    expect(fn).toContain('), proposal, isLocalQuote);');
    expect(fn).toContain('`הצעת מחיר מאת: ${senderName}');
  });
  it('copy message passes the public-share output gate BEFORE anything is copied; a refusal copies nothing', () => {
    const fn = slice('const copyQuoteMessage = async (proposal) => {', 'const sendWhatsApp = (proposal');
    expect(fn.indexOf("outputGate('public_share', outputPhase)")).toBeLessThan(fn.indexOf('navigator.clipboard.writeText'));
    expect(fn.indexOf("authorizeWithNotice({ channel: 'public_share'")).toBeLessThan(fn.indexOf('navigator.clipboard.writeText'));
    expect(fn).toMatch(/if \(!auth\.proceed\) \{[\s\S]*?return;\s*\}/);
    expect(fn).toContain('isUnfinishedSavedQuote(proposal)');
    expect(fn).toContain('window.prompt('); // a refused clipboard shows the text; never a false "copied"
  });
});

describe('quote row action', () => {
  it('HE/EN: a distinct "copy message" chip (WhatsApp / email unchanged) that runs through the protected-action gate', async () => {
    const { default: QuotesTab } = await import('./components/QuotesTab');
    expect(read('components/QuotesTab.jsx')).toMatch(/handleProtectedAction\(quote\.id, 'whatsapp', \(\) => copyQuoteMessage\(quote\)\)/);
    expect(typeof QuotesTab).toBe('function');
  });
});

describe('the copy message action in the rendered row (synthetic)', () => {
  it('clicking it calls the handler once with that quote', async () => {
    const { default: QuotesTab } = await import('./components/QuotesTab');
    const copyQuoteMessage = vi.fn();
    const quote = { id: 'q1', quote_number: 12002, status: 'sent', total: 1180, subtotal: 1000, tax_rate: 18, currency: 'ILS', created_at: '2026-10-01T00:00:00Z', clients: { company_name: 'Synthetic Alpha' }, quote_items: [] };
    const noop = () => {};
    render(<QuotesTab quotes={[quote]} isHebrew isLocalIsraeliBusiness t={{}} sym="₪" emailStatuses={{}} sendWhatsApp={noop} copyQuoteMessage={copyQuoteMessage}
      handleEditClick={noop} handleDuplicateQuote={noop} handleDeleteQuote={noop} setPendingEmailQuote={noop} handleProtectedAction={(id, a, fn) => fn()}
      activeTooltip={{ quoteId: null, action: null }} formatMoneyDisplay={(v) => Number(v).toFixed(2)} />);
    const buttons = screen.queryAllByTestId('quote-copy-message');
    if (!buttons.length) { // the actions live in the row's expandable panel
      const toggle = document.querySelector('[aria-expanded="false"]');
      if (toggle) fireEvent.click(toggle);
    }
    const btn = screen.getAllByTestId('quote-copy-message')[0];
    expect(btn.textContent).toBe('העתקת הודעה');
    fireEvent.click(btn);
    expect(copyQuoteMessage).toHaveBeenCalledTimes(1);
    expect(copyQuoteMessage.mock.calls[0][0].id).toBe('q1');
  });
});
