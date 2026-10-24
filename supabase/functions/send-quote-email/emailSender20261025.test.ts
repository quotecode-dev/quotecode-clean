// Owner 2026-10-25: the quote e-mail comes from the business (via TEKANGO), the reply goes to the business, and it has a text part
import { describe, it, expect } from 'vitest';
import { buildQuoteEmail, senderDisplayName, replyToAddress } from './emailTemplate.ts';

describe('the sender name', () => {
  it('is the business name, never anything that could forge an address', () => {
    expect(senderDisplayName('דנדי מזגנים')).toBe('דנדי מזגנים');
    expect(senderDisplayName('PayPal <x@paypal.com>')).toBe('PayPal x paypal.com');
    expect(senderDisplayName('A "quoted"; name,\r\nBcc: x')).toBe('A quoted name Bcc x');
    expect(senderDisplayName('')).toBe(null);
    expect(senderDisplayName('x'.repeat(80))).toHaveLength(60);
  });
});

describe('the reply-to address', () => {
  it('is the business e-mail when it is one plain address and not ours', () => {
    expect(replyToAddress('doron1sinai@gmail.com')).toBe('doron1sinai@gmail.com');
    expect(replyToAddress(' shop@012.net.il ')).toBe('shop@012.net.il');
    expect(replyToAddress('support@tekango.com')).toBe(null);
    expect(replyToAddress('a@b.com, c@d.com')).toBe(null);
    expect(replyToAddress('a@b.com\r\nBcc: x@y.com')).toBe(null);
    expect(replyToAddress('')).toBe(null);
    expect(replyToAddress(null)).toBe(null);
  });
});

describe('the plain-text part', () => {
  const base = { bizTitle: 'דנדי מזגנים', clientDisplayName: 'שלומי', quoteNumberDisplay: 'A100710', symbol: '₪', displayTotal: '1,700.00', quoteLink: 'https://www.tekango.com/q/abc', logoUrl: null, shareText: null };
  it('carries the greeting, the total and the full link (HE / EN)', () => {
    const he = buildQuoteEmail({ ...base, hebrew: true });
    expect(he.text).toContain('שלום שלומי,');
    expect(he.text).toContain('סך הכל לתשלום: ₪1,700.00');
    expect(he.text).toContain('https://www.tekango.com/q/abc');
    expect(he.text).not.toMatch(/<[a-z]/i);
    const en = buildQuoteEmail({ ...base, hebrew: false, bizTitle: 'Dandy AC', symbol: '$' });
    expect(en.text).toContain('Total Amount: $1,700.00');
    expect(en.text).toContain('Dandy AC Team');
  });
});
