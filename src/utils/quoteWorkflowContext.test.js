import { describe, it, expect } from 'vitest';
import { computeItemWizardState, computeQuoteWorkflowContext } from './quoteWorkflowContext.js';

describe('computeItemWizardState', () => {
  it('returns null when the wizard is not open', () => {
    expect(computeItemWizardState({ isOpen: false, editingItem: null })).toBeNull();
  });

  it('add mode: itemType unknown, hasMeasurements null (nothing chosen yet)', () => {
    expect(computeItemWizardState({ isOpen: true, editingItem: null })).toEqual({
      open: true, action: 'add', itemType: 'unknown', hasMeasurements: null,
    });
  });

  it('edit mode, professional item with a pricing_unit and no measurements yet', () => {
    const state = computeItemWizardState({ isOpen: true, editingItem: { pricing_unit: 'm2', measurements: [] } });
    expect(state).toEqual({ open: true, action: 'edit', itemType: 'professional', hasMeasurements: false });
  });

  it('edit mode, professional item with measurements present', () => {
    const state = computeItemWizardState({
      isOpen: true,
      editingItem: { pricing_unit: 'linear_meter', measurements: [{ width: 200, height: 90 }] },
    });
    expect(state).toEqual({ open: true, action: 'edit', itemType: 'professional', hasMeasurements: true });
  });

  it('edit mode, simple item (no pricing_unit at all)', () => {
    const state = computeItemWizardState({ isOpen: true, editingItem: { description: 'Paint', quantity: 2, unit_price: 50 } });
    expect(state).toEqual({ open: true, action: 'edit', itemType: 'simple', hasMeasurements: false });
  });

  // Context-Driven AI Chat V3, §10 "Item Wizard Context": AddItemWizard.jsx's
  // own live step/pricing-method/progress snapshot, merged in when present.
  describe('liveState merging', () => {
    it('is omitted entirely (never guessed) when no liveState is provided', () => {
      const state = computeItemWizardState({ isOpen: true, editingItem: null });
      expect(state).not.toHaveProperty('step');
      expect(state).not.toHaveProperty('pricingMethod');
    });

    it('merges a real live snapshot on top of the base add/edit shape', () => {
      const state = computeItemWizardState({
        isOpen: true,
        editingItem: null,
        liveState: { step: 'details', pricingMethod: 'area', measurementCount: 2, hasSpecification: false, hasQuantity: true, hasUnitPrice: true },
      });
      expect(state).toEqual({
        open: true, action: 'add', itemType: 'unknown', hasMeasurements: null,
        step: 'details', pricingMethod: 'area', measurementCount: 2, hasSpecification: false, hasQuantity: true, hasUnitPrice: true,
      });
    });

    it('a liveState field the caller omits stays null, never a fabricated default', () => {
      const state = computeItemWizardState({ isOpen: true, editingItem: null, liveState: { step: 'what' } });
      expect(state.step).toBe('what');
      expect(state.pricingMethod).toBeNull();
      expect(state.measurementCount).toBeNull();
      expect(state.hasSpecification).toBeNull();
    });

    it('liveState is ignored when the wizard is not open at all', () => {
      expect(computeItemWizardState({ isOpen: false, editingItem: null, liveState: { step: 'review' } })).toBeNull();
    });
  });
});

describe('computeQuoteWorkflowContext', () => {
  const base = {
    showQuoteForm: true, editingQuoteId: null, clientName: '', projectName: '',
    sections: [], quoteStructureMode: null, items: [{ description: '', quantity: '1', unit_price: '' }],
    itemWizardState: null,
  };

  it('returns null when not on the quote editor screen at all', () => {
    expect(computeQuoteWorkflowContext({ ...base, showQuoteForm: false })).toBeNull();
  });

  it('new quote before client selection: create mode, no client, no items counted (placeholder row excluded)', () => {
    const ctx = computeQuoteWorkflowContext(base);
    expect(ctx).toEqual({
      screen: 'quote_editor', mode: 'create', hasClient: false, hasProject: false,
      structureMode: 'undecided', sectionCount: 0, itemCount: 0, itemWizard: null,
    });
  });

  it('quote with client selected', () => {
    const ctx = computeQuoteWorkflowContext({ ...base, clientName: 'Some Client' });
    expect(ctx.hasClient).toBe(true);
  });

  it('quote with project but no section', () => {
    const ctx = computeQuoteWorkflowContext({ ...base, projectName: 'Renovation' });
    expect(ctx.hasProject).toBe(true);
    expect(ctx.sectionCount).toBe(0);
    expect(ctx.structureMode).toBe('undecided');
  });

  it('quote with a section present (divided structure)', () => {
    const ctx = computeQuoteWorkflowContext({
      ...base, quoteStructureMode: 'divided', sections: [{ key: 's1', name: 'Kitchen' }],
    });
    expect(ctx.structureMode).toBe('divided');
    expect(ctx.sectionCount).toBe(1);
  });

  it('explicit regular (flat) structure is distinct from undecided', () => {
    const ctx = computeQuoteWorkflowContext({ ...base, quoteStructureMode: 'regular' });
    expect(ctx.structureMode).toBe('regular');
  });

  it('real items are counted, the untouched placeholder row is not', () => {
    const ctx = computeQuoteWorkflowContext({
      ...base,
      items: [{ description: '', quantity: '1', unit_price: '' }, { description: 'Real item', quantity: '2', unit_price: '10' }],
    });
    expect(ctx.itemCount).toBe(1);
  });

  it('existing quote in edit mode', () => {
    const ctx = computeQuoteWorkflowContext({ ...base, editingQuoteId: 'quote-123' });
    expect(ctx.mode).toBe('edit');
  });

  it('carries a professional item-wizard-in-progress snapshot through unchanged', () => {
    const itemWizardState = { open: true, action: 'edit', itemType: 'professional', hasMeasurements: false };
    const ctx = computeQuoteWorkflowContext({ ...base, itemWizardState });
    expect(ctx.itemWizard).toEqual(itemWizardState);
  });
});
