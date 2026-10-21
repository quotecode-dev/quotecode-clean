// Task 29: the quote email escapes every dynamic value ONCE for its context (HTML text / attribute / URL), validates URLs separately from
// escaping, keeps the copy for safe data, and answers unexpected errors without internal details. Pure functions only - nothing is sent.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuoteEmail, safeLogoUrl, safeQuoteLink } from '../supabase/functions/send-quote-email/emailTemplate.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://www.tekango.com';
const LINK = `${ORIGIN}/public-quote/00000000-0000-4000-9000-000000012003`;
const base = (over = {}) => ({ hebrew: true, bizTitle: 'עסק סינתטי', clientDisplayName: 'דנה כהן', quoteNumberDisplay: 'A12003', symbol: '₪', displayTotal: '1,180.00',
  quoteLink: LINK, logoUrl: null, shareText: null, ...over });
const EVIL_BIZ = `A&B <script>alert(1)</script> "Q" 'x'`;
const EVIL_CLIENT = '<img src=x onerror=alert(1)>';

describe('quote email - safe data keeps the existing copy', () => {
  it('HE: header, greeting, intro, amount, link and footer', () => {
    const { html, subject } = buildQuoteEmail(base());
    expect(subject).toBe('הצעת מחיר A12003 מ-עסק סינתטי');
    expect(html).toContain('<div dir="rtl"');
    expect(html).toContain('letter-spacing: -0.5px;">עסק סינתטי</div>');
    expect(html).toContain('padding-bottom: 10px;">שלום דנה כהן,</h2>');
    expect(html).toContain('<p style="font-size: 1rem; line-height: 1.5;">מצורפת הצעת המחיר שלך ממערכת <strong>עסק סינתטי</strong>.</p>');
    expect(html).toContain('font-weight: bold;">₪1,180.00</span>');
    expect(html).toContain(`<a href="${LINK}"`);
    expect(html).toContain('margin-top: 15px;">צוות עסק סינתטי</p>');
  });
  it('EN with a logo: the alt is the business name, the src the validated URL', () => {
    const { html, subject } = buildQuoteEmail(base({ hebrew: false, bizTitle: 'Synthetic QA Business', clientDisplayName: 'Synthetic Alpha Ltd', symbol: '$', displayTotal: '1,000.00', logoUrl: 'https://cdn.example.test/logo.png' }));
    expect(subject).toBe('Quote A12003 from Synthetic QA Business');
    expect(html).toContain('<img src="https://cdn.example.test/logo.png" alt="Synthetic QA Business"');
    expect(html).toContain('Hello Synthetic Alpha Ltd,</h2>');
    expect(html).toContain('margin-top: 15px;">Synthetic QA Business Team</p>');
    expect(html).toContain('<div dir="ltr"');
  });
});

describe('quote email - hostile / special values', () => {
  for (const hebrew of [true, false]) {
    it(`${hebrew ? 'HE' : 'EN'}: business and customer names are escaped everywhere (text and alt), once`, () => {
      const { html } = buildQuoteEmail(base({ hebrew, bizTitle: EVIL_BIZ, clientDisplayName: EVIL_CLIENT, logoUrl: 'https://cdn.example.test/l.png' }));
      expect(html).not.toMatch(/<script|<img src=x|onerror=alert\(1\)>/);
      expect(html).toContain('A&amp;B &lt;script&gt;alert(1)&lt;/script&gt; &quot;Q&quot; &#39;x&#39;');
      expect(html).toContain('alt="A&amp;B &lt;script&gt;alert(1)&lt;/script&gt; &quot;Q&quot; &#39;x&#39;"');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toMatch(/&amp;(amp|lt|gt|quot|#39);/); // never double-escaped
      // the business name appears escaped in the alt, the intro and the footer (3x) - never raw
      expect(html.split('A&amp;B &lt;script&gt;').length - 1).toBe(3);
    });
  }
  it('the logo-less header shows the escaped name as text', () => {
    const { html } = buildQuoteEmail(base({ bizTitle: 'Tom & Jerry <Ltd>' }));
    expect(html).toContain('letter-spacing: -0.5px;">Tom &amp; Jerry &lt;Ltd&gt;</div>');
  });
  it('the subject is plain text (never HTML-escaped), without line breaks / control characters', () => {
    const { subject } = buildQuoteEmail(base({ hebrew: false, bizTitle: 'Tom & Jerry\r\nBcc: x@evil.test' }));
    expect(subject).toBe('Quote A12003 from Tom & Jerry Bcc: x@evil.test');
    expect(subject).not.toMatch(/[\r\n]/);
  });
  it('long Hebrew / English names are kept whole and escaped', () => {
    const long = 'חברת בדיקות ארוכה מאוד לצורך בדיקת קיצור & שות׳ '.repeat(4).trim();
    const { html } = buildQuoteEmail(base({ bizTitle: long, clientDisplayName: 'Extremely Long Synthetic Testing Company Name LLC "Holdings"' }));
    expect(html).toContain(long.replace(/&/g, '&amp;'));
    expect(html).toContain('Extremely Long Synthetic Testing Company Name LLC &quot;Holdings&quot;');
  });
  it('the owner share text path stays escaped (no double escaping of its values)', () => {
    const { html } = buildQuoteEmail(base({ shareText: 'שלום {customer} מ-{business}', bizTitle: 'A&B', clientDisplayName: '<b>x</b>' }));
    expect(html).toContain('שלום <bdi>&lt;b&gt;x&lt;/b&gt;</bdi> מ-<bdi>A&amp;B</bdi>');
    expect(html).not.toMatch(/&amp;amp;|&amp;lt;/);
  });
});

describe('URL validation (separate from escaping)', () => {
  it('logo: only absolute http(s), never SVG / script / relative / non-string', () => {
    expect(safeLogoUrl('https://cdn.example.test/l.png')).toBe('https://cdn.example.test/l.png');
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,AA', 'https://x.test/logo.SVG', '/relative.png', '', null, 42, { href: 'x' }, 'not a url']) {
      expect(safeLogoUrl(bad)).toBeNull();
    }
  });
  it('a quote in the logo URL cannot break the attribute (URL-encoded, then attribute-escaped)', () => {
    const u = safeLogoUrl('https://cdn.example.test/l.png?a="onerror=alert(1)');
    const { html } = buildQuoteEmail(base({ logoUrl: u }));
    expect(html).not.toContain('"onerror');
    expect(html).toMatch(/<img src="https:\/\/cdn\.example\.test\/l\.png\?a=%22onerror=alert\(1\)" alt=/);
  });
  it('the quote link must stay on the canonical https origin', () => {
    expect(safeQuoteLink(LINK, ORIGIN)).toBe(LINK);
    expect(safeQuoteLink(`${ORIGIN}/en/public-quote/c/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?lang=en`, ORIGIN)).toMatch(/^https:\/\/www\.tekango\.com\/en\/public-quote\/c\//);
    for (const bad of ['https://evil.test/public-quote/x', 'http://www.tekango.com/public-quote/x', 'javascript:alert(1)', '', null]) expect(safeQuoteLink(bad, ORIGIN)).toBeNull();
  });
});

describe('send-quote-email wiring (source guards)', () => {
  const src = fs.readFileSync(path.resolve(HERE, '../supabase/functions/send-quote-email/index.ts'), 'utf8');
  it('the template is built only by buildQuoteEmail (no raw name interpolation left in index.ts)', () => {
    expect(src).toContain('const { subject, html } = buildQuoteEmail({');
    expect(src).not.toMatch(/\$\{bizTitle\}|\$\{clientDisplayName\}|\$\{validLogo\}|\$\{canonicalQuoteLink\}/);
    expect(src).toContain('const safeLink = safeQuoteLink(canonicalQuoteLink, PROD_ORIGIN)');
  });
  it('typed catch: own refusals keep their exact (client-classified) text, anything else is generic', () => {
    expect(src).toMatch(/\} catch \(error: unknown\) \{\s*const message = error instanceof EmailRefusal \? error\.message : 'Email sending failed'/);
    for (const m of ['Missing RESEND_API_KEY environment variable', 'No client email on file for this quote - refusing to send.', 'Quote not found - refusing to send without a verified region/currency.']) {
      expect(src).toContain(`throw new EmailRefusal('${m}')`);
    }
    expect(src).not.toMatch(/JSON\.stringify\(\{ error: error\.message \}\)/);
  });
});
