// Owner 2026-10-23 (typed L-09 / L-17, morning report item 6): saving a template keeps a fractional quantity exactly (2.5 stays 2.5).
import { describe, it, expect } from 'vitest';
import { buildTemplateContent, templateToFormState } from './quoteTemplates';
import { getActiveQuantity } from './professionalQuoteItem';

let n = 0;
const newKey = () => `k${n += 1}`;

describe('a template keeps a fractional quantity', () => {
  it('a plain line of 2.5 is saved as 2.5 and comes back as 2.5 (never 3)', () => {
    const content = buildTemplateContent({ items: [{ description: 'Painting', quantity: '2.5', unit_price: '100' }] }, { prices: true });
    const back = templateToFormState(content, newKey);
    expect(getActiveQuantity(back.items[0])).toBe(2.5);
    expect(Number(back.items[0].unit_price)).toBe(100);
  });

  it('a whole quantity and a measured line are unchanged', () => {
    const content = buildTemplateContent({ items: [
      { description: 'Doors', quantity: '3', unit_price: '50' },
      { description: 'Wall', quantity: '1', unit_price: '20', pricing_unit: 'sqm', calculated_quantity: 12.75 },
    ] }, { prices: true });
    expect(content.items[0]).toMatchObject({ quantity: 3 });
    expect(content.items[0].calculated_quantity).toBeUndefined();
    expect(content.items[1]).toMatchObject({ quantity: 1, pricing_unit: 'sqm', calculated_quantity: 12.75 });
    const back = templateToFormState(content, newKey);
    expect(getActiveQuantity(back.items[0])).toBe(3);
    expect(getActiveQuantity(back.items[1])).toBe(12.75);
  });
});
