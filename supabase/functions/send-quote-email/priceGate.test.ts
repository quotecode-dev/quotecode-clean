// Task 38 (Owner D1 = block, SERVER side): send-quote-email never emails a quote with a missing price to a customer; an intentional 0
// is a price; a state that cannot be verified refuses (fail closed). The refusal is decided BEFORE anything else is read for the email
// and before the email provider is called; a foreign caller is refused for ownership first (no price state leaks).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { decidePriceGate, PRICE_MISSING_REFUSAL, PRICE_UNVERIFIED_REFUSAL } from './priceGate.ts';

const src = readFileSync(join(cwd(), 'supabase', 'functions', 'send-quote-email', 'index.ts'), 'utf8');

describe('decidePriceGate (pure)', () => {
  it('no flagged row -> allowed (a priced quote and an intentional 0 are both prices)', () => {
    expect(decidePriceGate([], null)).toEqual({ ok: true });
  });
  it('a flagged row -> refused with the stable missing-price refusal', () => {
    expect(decidePriceGate([{ id: 'x' }], null)).toEqual({ ok: false, code: 'QUOTE_PRICE_MISSING', message: PRICE_MISSING_REFUSAL });
  });
  it.each([
    ['a DB error', [], { message: 'column does not exist' }],
    ['no data at all', null, null],
    ['a malformed answer', { id: 'x' }, null],
  ])('%s -> refused as unverifiable (fail closed)', (_l, rows, err) => {
    expect(decidePriceGate(rows as never, err as never)).toEqual({ ok: false, code: 'QUOTE_PRICE_UNVERIFIED', message: PRICE_UNVERIFIED_REFUSAL });
  });
  it('the refusal messages carry their stable code (the UI classifies them)', () => {
    expect(PRICE_MISSING_REFUSAL.startsWith('QUOTE_PRICE_MISSING:')).toBe(true);
    expect(PRICE_UNVERIFIED_REFUSAL.startsWith('QUOTE_PRICE_UNVERIFIED:')).toBe(true);
  });
});

describe('send-quote-email uses the gate at the right place', () => {
  const at = (s: string) => src.indexOf(s);
  it('the gate runs after the ownership check and before every other email read and the provider call', () => {
    const owner = at("Forbidden: you may only send your own quote");
    const gate = at('const priceGate = decidePriceGate(');
    const refuse = at('if (!priceGate.ok) throw new EmailRefusal(priceGate.message)');
    expect(owner).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(owner);
    expect(refuse).toBeGreaterThan(gate);
    for (const later of ["from('business_share_defaults')", "from('business_settings')", "from('clients')", 'buildQuoteEmail({', 'api.resend.com']) {
      expect(at(later)).toBeGreaterThan(refuse);
    }
  });
  it('the flag is read with its error (an unverifiable state is never treated as "no missing price")', () => {
    expect(src).toMatch(/const \{ data: missingRows, error: missingErr \} = await supabaseAdmin\.from\('quote_items'\)\.select\('id'\)\.eq\('quote_id', quoteId\)\.eq\('price_missing', true\)\.limit\(1\)/);
    expect(src).toContain('decidePriceGate(missingRows, missingErr)');
  });
});
