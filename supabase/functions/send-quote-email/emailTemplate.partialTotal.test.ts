// Task 37 (D2): the quote email says the total is partial when a line's price was never entered (durable quote_items.price_missing), in
// the email's language; without missing prices the email is byte-identical to before.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { buildQuoteEmail } from './emailTemplate.ts';

const base = { bizTitle: 'Biz', clientDisplayName: 'Dana', quoteNumberDisplay: '1007', symbol: '₪', displayTotal: '₪118.00', quoteLink: 'https://example.com/q', logoUrl: null, shareText: null };

describe('quote email: partial total', () => {
  it('Hebrew: a partial total is stated', () => {
    expect(buildQuoteEmail({ ...base, hebrew: true, partialTotal: true }).html).toContain('הסכום חלקי: יש בהצעה פריטים שטרם תומחרו.');
  });
  it('English: a partial total is stated', () => {
    expect(buildQuoteEmail({ ...base, hebrew: false, partialTotal: true }).html).toContain('Partial total: some items in this quote are not priced yet.');
  });
  it('without missing prices the email is unchanged (false and absent give the same bytes)', () => {
    for (const hebrew of [true, false]) {
      const before = buildQuoteEmail({ ...base, hebrew });
      const after = buildQuoteEmail({ ...base, hebrew, partialTotal: false });
      expect(after).toEqual(before);
      expect(after.html).not.toMatch(/הסכום חלקי|Partial total/);
    }
  });
  it('the sender reads the durable flag of THIS quote server-side (never from the request)', () => {
    const src = readFileSync(join(cwd(), 'supabase', 'functions', 'send-quote-email', 'index.ts'), 'utf8');
    expect(src).toContain(".from('quote_items').select('id').eq('quote_id', quoteId).eq('price_missing', true).limit(1)");
    expect(src).toMatch(/shareText: ownerShareText, partialTotal,/);
  });
});
