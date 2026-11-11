// Unified quote (Owner console 2026-11-11, spec section 5 "AI"): "two identical apartments, in each ..." -> a full structure to check:
// places, × N, work, rooms, billing. Opt-in and additive; a count or a room the text does not write is never kept; when the text does not
// say whether the places are identical the server asks and nothing is multiplied; the catalog's price basis is the verified price unit.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  validateDraftRequest, buildDraftMessages, draftResponseSchema, DRAFT_RESPONSE_SCHEMA, parseDraftModelOutput, sanitizeDraftResponse,
  AI_QUOTE_DRAFT_CONTRACT_VERSION, parsePlaces, roomOf,
} from '../supabase/functions/_shared/aiQuoteDraft.js';
import { draftLinesToQuoteItems } from './utils/aiQuoteDraftClient';
import AiQuoteDraftDialog from './components/AiQuoteDraftDialog';

const noChanges = { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null };
const line = (o) => ({ description: 'ריצוף', evidence: '', quantity: null, unit: null, quantityBasis: 'missing', derivation: null, missing: null, catalogId: null, place: null, room: null, ...o });

describe('the request and the prompt (opt-in)', () => {
  it('structure only when the browser asks; the structured schema adds places and each item\'s place and room', () => {
    expect(validateDraftRequest({ description: 'שתי דירות זהות' }).value.structure).toBeUndefined();
    expect(validateDraftRequest({ description: 'שתי דירות זהות', structure: true }).value.structure).toBe(true);
    expect(validateDraftRequest({ description: 'שתי דירות זהות', structure: 'yes' }).value.structure).toBeUndefined();
    expect(draftResponseSchema(false)).toBe(DRAFT_RESPONSE_SCHEMA);
    const s = draftResponseSchema(true).schema;
    expect(s.required).toContain('places');
    expect(s.properties.items.items.required).toEqual(expect.arrayContaining(['place', 'room']));
    expect(DRAFT_RESPONSE_SCHEMA.schema.required).not.toContain('places');
    const withS = buildDraftMessages({ description: 'x', isHebrew: true, catalog: [], structure: true })[0].content;
    const without = buildDraftMessages({ description: 'x', isHebrew: true, catalog: [] })[0].content;
    expect(withS).toContain('places:');
    expect(without).not.toContain('places:');
  });
});

describe('the server check of places and rooms', () => {
  const text = 'שתי דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר';
  it('two identical apartments, flooring in the kitchen of each: one place × 2, the line in it, room kitchen', () => {
    const out = { subject: 'ריצוף', questions: [], changes: noChanges,
      places: [{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }],
      items: [line({ evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'p1', room: 'kitchen' })] };
    const r = parseDraftModelOutput(JSON.stringify(out), [], text, null, { structure: true, isHebrew: true });
    expect(r.places).toEqual([{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }]);
    expect(r.items[0]).toMatchObject({ quantity: 12, unit: 'm2', place: 'p1', room: 'kitchen' });
  });
  it('a count the text does not write becomes 1; a room the text does not name is dropped; an unknown place key is dropped', () => {
    expect(parsePlaces([{ key: 'p1', kind: 'apartment', name: '', count: 3, identical: 'yes' }], text)[0].count).toBe(1);
    expect(parsePlaces([{ key: 'p1', kind: 'castle', name: '', count: 2, identical: 'yes' }], text)).toEqual([]);
    expect(roomOf('bathroom', text)).toBeNull();
    expect(roomOf('kitchen', text)).toBe('kitchen');
    expect(roomOf('מחסן', 'צבע במחסן')).toBe('מחסן');
    expect(roomOf('all', text)).toBe('all');
    const out = { subject: '', questions: [], changes: noChanges, places: [],
      items: [line({ evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'p9', room: 'bathroom' })] };
    const r = parseDraftModelOutput(JSON.stringify(out), [], text, null, { structure: true, isHebrew: true });
    expect(r.items[0]).toMatchObject({ place: null, room: null });
  });
  it('several places and the text does not say whether the work is the same: the server asks, in the business language', () => {
    const t3 = 'שלוש דירות, ריצוף 20 מ״ר';
    const out = { subject: '', questions: [], changes: noChanges, places: [{ key: 'p1', kind: 'apartment', name: '', count: 3, identical: 'unclear' }],
      items: [line({ evidence: 'ריצוף 20 מ״ר', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'p1' })] };
    expect(parseDraftModelOutput(JSON.stringify(out), [], t3, null, { structure: true, isHebrew: true }).questions[0]).toBe('האם העבודות ב-3 הדירות זהות?');
    const en = { ...out, items: [line({ description: 'Tiling', evidence: 'tiling 20 m2', quantity: 20, unit: 'm2', quantityBasis: 'stated', place: 'p1' })] };
    expect(parseDraftModelOutput(JSON.stringify(en), [], 'three apartments, tiling 20 m2', null, { structure: true, isHebrew: false }).questions[0]).toBe('Is the work the same in all 3 apartments?');
  });
  it('without the opt-in nothing new is returned (an older browser sees the same answer)', () => {
    const out = { subject: '', questions: [], changes: noChanges, items: [line({ evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated' })] };
    const r = parseDraftModelOutput(JSON.stringify(out), [], text, null);
    expect('places' in r).toBe(false);
    expect('place' in r.items[0]).toBe(false);
    expect('room' in r.items[0]).toBe(false);
  });
  it('the catalog price basis is the verified price unit (the name says no unit); no basis = as before', () => {
    const out = { subject: '', questions: [], changes: noChanges, items: [line({ evidence: 'ריצוף במטבח 12 מ״ר', quantity: 12, unit: 'm2', quantityBasis: 'stated', catalogId: 'c1' })] };
    const withBasis = parseDraftModelOutput(JSON.stringify(out), [{ id: 'c1', name: 'ריצוף', price: 150, price_basis: 'm2' }], text, null);
    expect(withBasis.items[0]).toMatchObject({ unitPrice: 150, priceSource: 'catalog' });
    const noBasis = parseDraftModelOutput(JSON.stringify(out), [{ id: 'c1', name: 'ריצוף', price: 150 }], text, null);
    expect(noBasis.items[0]).toMatchObject({ unitPrice: null, priceSource: 'catalog_unit_unverified' });
  });
});

describe('the browser side', () => {
  it('the browser re-check keeps places and each line\'s place and room; the line keeps its room in the form', () => {
    const d = sanitizeDraftResponse({ contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, subject: '', items: [{ description: 'ריצוף', quantity: 12, unit: 'm2', quantityBasis: 'stated', place: 'p1', room: 'kitchen' }],
      questions: [], unassignedMeasures: [], changes: {}, places: [{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }, { key: 'x', kind: 'castle' }] });
    expect(d.places).toEqual([{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }]);
    expect(d.items[0]).toMatchObject({ place: 'p1', room: 'kitchen' });
    expect(draftLinesToQuoteItems([{ description: 'ריצוף', quantity: 12, unit: 'm2', unitPrice: null, room: 'kitchen' }])[0].room).toBe('kitchen');
  });

  it('the review window shows the suggested structure and where each line is; applying passes the places', async () => {
    const onApply = vi.fn();
    const result = { status: 'ok', subject: '', questions: [], unassignedMeasures: [], changes: { updates: [], deletes: [], notes: null, discountPercent: null },
      places: [{ key: 'p1', kind: 'apartment', name: '', count: 2, identical: 'yes' }],
      items: [{ description: 'ריצוף', quantity: 12, unit: 'm2', quantityBasis: 'stated', derivation: null, missing: null, evidence: 'ריצוף במטבח 12 מ״ר', unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none', place: 'p1', room: 'kitchen' }] };
    render(<AiQuoteDraftDialog isOpen isHebrew onClose={vi.fn()} onApply={onApply} requestDraft={async () => result} formatMoneyDisplay={(v) => String(v)} sym="₪" />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'שתי דירות זהות, בכל אחת ריצוף במטבח 12 מ״ר' } });
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getByTestId('ai-quote-draft-structure')).toBeTruthy());
    expect(screen.getByTestId('ai-quote-draft-structure').textContent).toBe('המבנה המוצע: דירה × 2');
    expect(screen.getByTestId('ai-quote-draft-where').textContent).toBe('מקום: דירה · מטבח');
    fireEvent.click(screen.getByRole('button', { name: /הוספה להצעה/ }));
    expect(onApply.mock.calls[0][0][0]).toMatchObject({ place: 'p1', room: 'kitchen' });
    expect(onApply.mock.calls[0][3]).toEqual(result.places);
  });
});
