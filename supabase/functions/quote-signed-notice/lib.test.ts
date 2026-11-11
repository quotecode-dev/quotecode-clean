import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRESH_SIGNATURE_MS, isFreshSignature, marketOf, parseRequest, quoteNumberDisplay, SENDER, signedNoticeContent, signedQuoteLink } from './lib.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ID = '0f1e2d3c-4b5a-4968-8776-655443322110';

describe('quote-signed-notice (Owner 2026-11-11, finding 18): one email to the owner when a customer signs', () => {
  it('accepts only a quote id (UUID) - anything else is ignored', () => {
    expect(parseRequest({ quote_id: ID })).toBe(ID);
    expect(parseRequest({ quote_id: ID.toUpperCase() })).toBe(ID);
    expect(parseRequest({ quote_id: 'x' })).toBeNull();
    expect(parseRequest({ quoteId: ID })).toBeNull();
    expect(parseRequest(null)).toBeNull();
  });
  it('only a signature of the last two hours is announced', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    expect(isFreshSignature('2026-11-11T11:59:00Z', now)).toBe(true);
    expect(isFreshSignature(new Date(now - FRESH_SIGNATURE_MS - 1000).toISOString(), now)).toBe(false);
    expect(isFreshSignature(null, now)).toBe(false);
    expect(isFreshSignature('2026-11-11T13:00:00Z', now)).toBe(false);
  });
  it('the business market decides language, sender and link', () => {
    expect(marketOf('Local')).toBe('IL');
    expect(marketOf('IL')).toBe('IL');
    expect(marketOf('International')).toBe('INTERNATIONAL');
    expect(marketOf('US')).toBe('INTERNATIONAL');
    expect(SENDER.IL.from).toContain('support@tekango.com');
    expect(SENDER.INTERNATIONAL.from).toContain('info@tekango.com');
    expect(signedQuoteLink({ quoteId: ID, market: 'IL' })).toBe(`https://www.tekango.com/public-quote/${ID}`);
    expect(signedQuoteLink({ quoteId: ID, market: 'INTERNATIONAL' })).toBe(`https://www.tekango.com/en/public-quote/${ID}`);
  });
  it('the Owner wording: "<customer> חתם על הצעה <number>" with the link; English the same', () => {
    const he = signedNoticeContent({ quoteId: ID, quoteNumber: 100701, signedAt: null, clientName: 'דוד כהן', market: 'IL' });
    expect(he.subject).toBe('דוד כהן חתם על הצעה A100701');
    expect(he.text).toContain('דוד כהן חתם על הצעה A100701.');
    expect(he.text).toContain(`https://www.tekango.com/public-quote/${ID}`);
    const en = signedNoticeContent({ quoteId: ID, quoteNumber: 100701, signedAt: null, clientName: 'Acme LLC', market: 'INTERNATIONAL' });
    expect(en.subject).toBe('Acme LLC signed quote A100701');
    expect(en.text).toContain(`https://www.tekango.com/en/public-quote/${ID}`);
    expect(quoteNumberDisplay(null, ID)).toBe('#0f1e2d3c');
    // a name with line breaks never breaks the subject
    expect(signedNoticeContent({ quoteId: ID, quoteNumber: 1, signedAt: null, clientName: 'a\r\nb', market: 'IL' }).subject).toBe('a b חתם על הצעה A1');
  });
  it('the server records the quote BEFORE the email and answers the same for every id', () => {
    const src = readFileSync(resolve(here, 'index.ts'), 'utf8');
    expect(src.indexOf("from('quote_signed_owner_notices')")).toBeLessThan(src.indexOf('sendMail('));
    expect(src).toContain("ignoreDuplicates: true");
    expect(src).toContain('isFreshSignature(q.signed_at, Date.now())');
    expect(src.match(/return done\(\);/g)?.length).toBeGreaterThanOrEqual(5);
    expect(src).not.toMatch(/JSON\.stringify\(\{ ok: true, [a-z]/);
  });
});
