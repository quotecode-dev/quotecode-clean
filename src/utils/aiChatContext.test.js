import { describe, it, expect } from 'vitest';
import { resolveAIChatContext, allowsExistingQuoteReference, SCREEN_IDS } from './aiChatContext';

describe('resolveAIChatContext (§5 ONE CONTEXT RESOLVER, §6/§7 priority)', () => {
  it('resolves the public surface regardless of any other prop', () => {
    expect(resolveAIChatContext({ isDashboard: false, currentArea: 'clients', workflowContext: { screen: 'quote_editor', mode: 'create' } }))
      .toEqual({ screenId: 'public', isDashboard: false, objectType: 'none' });
  });

  it('resolves item_wizard as the highest-priority authenticated context, even while a quote editor is also technically open', () => {
    const ctx = resolveAIChatContext({
      isDashboard: true,
      currentArea: 'main',
      workflowContext: { screen: 'quote_editor', mode: 'create', itemWizard: { open: true, action: 'add' } },
    });
    expect(ctx.screenId).toBe('item_wizard');
    expect(ctx.objectType).toBe('item_wizard');
    expect(ctx.itemWizardAction).toBe('add');
  });

  it('resolves quote_editor_new for a brand-new, unsaved draft', () => {
    const ctx = resolveAIChatContext({ isDashboard: true, currentArea: 'main', workflowContext: { screen: 'quote_editor', mode: 'create' } });
    expect(ctx).toEqual({ screenId: 'quote_editor_new', isDashboard: true, objectType: 'draft_quote' });
  });

  it('resolves quote_editor_edit for an existing saved quote', () => {
    const ctx = resolveAIChatContext({ isDashboard: true, currentArea: 'main', workflowContext: { screen: 'quote_editor', mode: 'edit' } });
    expect(ctx).toEqual({ screenId: 'quote_editor_edit', isDashboard: true, objectType: 'saved_quote' });
  });

  it('resolves every real currentArea tab to its own screenId', () => {
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'clients', workflowContext: null }).screenId).toBe('clients');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'settings', workflowContext: null }).screenId).toBe('settings');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'finances', workflowContext: null }).screenId).toBe('finances');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'catalog', workflowContext: null }).screenId).toBe('catalog');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'plans', workflowContext: null }).screenId).toBe('plans');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'admin_clients', workflowContext: null }).screenId).toBe('admin');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'main', workflowContext: null }).screenId).toBe('quote_history');
  });

  it('falls back to neutral for an unrecognized/unmapped currentArea, never guessing', () => {
    expect(resolveAIChatContext({ isDashboard: true, currentArea: 'not_a_real_area', workflowContext: null }).screenId).toBe('neutral');
    expect(resolveAIChatContext({ isDashboard: true, currentArea: null, workflowContext: null }).screenId).toBe('neutral');
  });

  it('VISIBLE UI STATE WINS: a retained workflowContext object with no itemWizard.open never leaks item_wizard', () => {
    const ctx = resolveAIChatContext({
      isDashboard: true,
      currentArea: 'main',
      workflowContext: { screen: 'quote_editor', mode: 'edit', itemWizard: { open: false } },
    });
    expect(ctx.screenId).toBe('quote_editor_edit');
  });

  it('every screenId this function can return is a declared SCREEN_ID', () => {
    const cases = [
      { isDashboard: false },
      { isDashboard: true, workflowContext: { screen: 'quote_editor', mode: 'create', itemWizard: { open: true, action: 'edit' } } },
      { isDashboard: true, workflowContext: { screen: 'quote_editor', mode: 'create' } },
      { isDashboard: true, workflowContext: { screen: 'quote_editor', mode: 'edit' } },
      { isDashboard: true, currentArea: 'clients' },
      { isDashboard: true, currentArea: 'settings' },
      { isDashboard: true, currentArea: 'finances' },
      { isDashboard: true, currentArea: 'catalog' },
      { isDashboard: true, currentArea: 'plans' },
      { isDashboard: true, currentArea: 'admin_clients' },
      { isDashboard: true, currentArea: 'main' },
      { isDashboard: true, currentArea: null },
    ];
    for (const c of cases) {
      expect(SCREEN_IDS).toContain(resolveAIChatContext(c).screenId);
    }
  });
});

describe('allowsExistingQuoteReference (§8 NEW QUOTE CONTEXT > EXISTING QUOTE PICKER)', () => {
  it('is false only for a brand-new unsaved draft', () => {
    expect(allowsExistingQuoteReference('quote_editor_new')).toBe(false);
  });

  it('is true for every other screen, including editing an existing quote', () => {
    expect(allowsExistingQuoteReference('quote_editor_edit')).toBe(true);
    expect(allowsExistingQuoteReference('clients')).toBe(true);
    expect(allowsExistingQuoteReference('quote_history')).toBe(true);
    expect(allowsExistingQuoteReference('neutral')).toBe(true);
  });
});
