import { describe, it, expect } from 'vitest';
import { classifyDirectFactIntent, resolveDirectFact, formatDirectFactAnswer } from './directFacts.ts';
import { sanitizeQuoteContext } from './quoteContext.ts';

const BASE_ROW = {
  id: 'q1', user_id: 'u1', quote_number: 101041, project_name: 'Test Project', status: 'draft',
  currency: 'ILS', subtotal: 300, tax_rate: 0.17, total: 333, created_at: '2026-09-01T10:00:00.000Z', valid_until: '2026-10-01',
  quote_items: [
    { description: 'Windows', quantity: 1, unit_price: 300, total_price: 300 },
  ],
};

describe('classifyDirectFactIntent', () => {
  it('recognizes an amount question, HE and EN', () => {
    expect(classifyDirectFactIntent('מה הסכום של ההצעה הזאת?')).toBe('amount');
    expect(classifyDirectFactIntent('what is the total amount?')).toBe('amount');
  });

  it('recognizes a status question, HE and EN', () => {
    expect(classifyDirectFactIntent('מה הסטטוס של ההצעה?')).toBe('status');
    expect(classifyDirectFactIntent('what is the status?')).toBe('status');
  });

  it('recognizes a quote number question', () => {
    expect(classifyDirectFactIntent('מה מספר ההצעה?')).toBe('quote_number');
    expect(classifyDirectFactIntent('what is the quote number?')).toBe('quote_number');
  });

  it('recognizes a creation date question', () => {
    expect(classifyDirectFactIntent('מתי נוצרה ההצעה?')).toBe('creation_date');
    expect(classifyDirectFactIntent('when was this quote created?')).toBe('creation_date');
  });

  it('recognizes a validity date question', () => {
    expect(classifyDirectFactIntent('עד מתי ההצעה בתוקף?')).toBe('validity_date');
    expect(classifyDirectFactIntent('how long is this quote valid?')).toBe('validity_date');
  });

  it('recognizes an item-count question', () => {
    expect(classifyDirectFactIntent('כמה פריטים יש בהצעה?')).toBe('item_count');
    expect(classifyDirectFactIntent('how many items are in the quote?')).toBe('item_count');
  });

  it('returns null for an ordinary free-text question', () => {
    expect(classifyDirectFactIntent('איך מוסיפים פריט חדש?')).toBeNull();
    expect(classifyDirectFactIntent('How do I add a new client?')).toBeNull();
  });

  it('picks the precedence-first kind when a message could match more than one', () => {
    expect(classifyDirectFactIntent('what is the total amount and status?')).toBe('amount');
  });
});

describe('resolveDirectFact', () => {
  const ctx = sanitizeQuoteContext(BASE_ROW);

  it('resolves amount with the currency symbol', () => {
    expect(resolveDirectFact('amount', ctx, true)).toEqual({ kind: 'amount', value: '₪333.00', isDraft: false });
  });

  it('resolves status verbatim', () => {
    expect(resolveDirectFact('status', ctx, true)).toEqual({ kind: 'status', value: 'draft', isDraft: false });
  });

  it('resolves quote_number as a string', () => {
    expect(resolveDirectFact('quote_number', ctx, true)).toEqual({ kind: 'quote_number', value: '101041', isDraft: false });
  });

  it('resolves creation_date formatted per locale', () => {
    const he = resolveDirectFact('creation_date', ctx, true);
    const en = resolveDirectFact('creation_date', ctx, false);
    expect(he.value).not.toBe(en.value);
    expect(he.kind).toBe('creation_date');
  });

  it('resolves validity_date formatted per locale', () => {
    expect(resolveDirectFact('validity_date', ctx, true).kind).toBe('validity_date');
  });

  it('resolves item_count as the real item array length', () => {
    expect(resolveDirectFact('item_count', ctx, true)).toEqual({ kind: 'item_count', value: '1', isDraft: false });
  });

  it('returns null (never a fabricated value) when the underlying data is genuinely absent', () => {
    const bare = sanitizeQuoteContext({ id: 'q2', user_id: 'u1', quote_items: [] });
    expect(resolveDirectFact('amount', bare, true)).toBeNull();
    expect(resolveDirectFact('validity_date', bare, true)).toBeNull();
    expect(resolveDirectFact('creation_date', bare, true)).toBeNull();
    // item_count is always resolvable (0 is a real, meaningful answer, not "unknown")
    expect(resolveDirectFact('item_count', bare, true)).toEqual({ kind: 'item_count', value: '0', isDraft: false });
  });
});

describe('formatDirectFactAnswer', () => {
  it('leads with the exact fact, HE and EN', () => {
    const payload = { kind: 'amount', value: '₪333.00', isDraft: false };
    expect(formatDirectFactAnswer(payload, true)).toContain('₪333.00');
    expect(formatDirectFactAnswer(payload, false)).toContain('₪333.00');
    expect(formatDirectFactAnswer(payload, false).toLowerCase()).toContain('total amount');
  });
});

// IRON-ILS-001 - deterministic AI money facts follow the Local/ILS whole-shekel law.
import { resolveDirectFact as __resolveIls } from './directFacts.ts';
describe('IRON-ILS-001 directFacts amount', () => {
  const ctx = (total, currency) => ({ total, currency, status: null, quoteNumber: null, createdAt: null, validUntil: null, itemCount: null });
  it.each([[191.16, 'ILS', '₪191.00'], [100.5, 'ILS', '₪101.00'], [6532.48, 'ILS', '₪6,532.00'], [28346.16, 'ILS', '₪28,346.00'], [-100.5, 'ILS', '₪-101.00']])('ILS %s -> %s', (t, c, exp) => {
    const r = __resolveIls('amount', ctx(t, c), true);
    expect(JSON.stringify(r)).toContain(exp);
  });
  it('USD keeps full precision (market isolation)', () => {
    expect(JSON.stringify(__resolveIls('amount', ctx(191.16, 'USD'), false))).toContain('$191.16');
  });
});
