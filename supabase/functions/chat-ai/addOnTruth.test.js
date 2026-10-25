// Owner console 2026-10-20 (L-14): the SMART PACK add-on facts reach the chat / email assistant prompt - exact prices per market, optional,
// billed with the main plan, NOT purchasable yet.
import { describe, it, expect } from 'vitest';
import { buildAddOnTruthBlock } from './addOnTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { buildSystemPrompt } from './validation.ts';

describe('add-on truth (L-14, 2026-10-20)', () => {
  it('HE: the Israeli price incl. VAT, the contents in Hebrew, purchasable in Israel (Owner 2026-10-25)', () => {
    const b = buildAddOnTruthBlock(true, AI_FACTS.addOns);
    expect(b).toContain('חכם פלוס');
    expect(b).toContain('₪10.00 per month or ₪102.00 per year, VAT included');
    expect(b).toContain('צ׳אט קולי');
    // Owner console 2026-10-25 (typed findings 1-13 approval, L-14): both real paths; no "removed at any time"
    expect(b).toContain('with a NEW subscription, tick it when paying for the package');
    expect(b).toContain('adds it from the "Add SMART PACK" box there - a pro-rated charge now until the end of the current monthly or yearly period');
    expect(b).not.toContain('removed at any time');
    expect(b).not.toContain('CANNOT be purchased');
    expect(b).not.toContain('$5.00');
  });
  it('EN: the USD price, the contents in English, nothing "coming soon" (Customer Twin is live); not purchasable abroad yet', () => {
    const b = buildAddOnTruthBlock(false, AI_FACTS.addOns);
    expect(b).toContain('CANNOT be purchased yet in this market');
    expect(b).not.toContain('It can be purchased');
    expect(b).toContain('$5.00 per month or $51.00 per year (USD)');
    expect(b).not.toContain('Coming soon');
    expect(b).not.toContain('₪');
  });
  it('the system prompt carries the block in both languages; no block without facts', () => {
    expect(buildSystemPrompt({ isHebrew: true })).toContain('SUBSCRIPTION ADD-ONS');
    expect(buildSystemPrompt({ isHebrew: false })).toContain('SMART PACK');
    expect(buildAddOnTruthBlock(true, [])).toBe('');
  });
});
