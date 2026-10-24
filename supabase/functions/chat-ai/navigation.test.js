import { describe, it, expect } from 'vitest';
import { extractNavigationAction, NAVIGATION_ACTION_IDS } from './navigation.ts';
import { NAVIGATION_ACTION_IDS as FRONTEND_NAVIGATION_ACTION_IDS } from '../../../src/utils/safeNavigation.js';

describe('frontend/edge navigation allowlist parity', () => {
  it('the Edge enum and the frontend enum are identical, in the same order', () => {
    expect([...NAVIGATION_ACTION_IDS]).toEqual(FRONTEND_NAVIGATION_ACTION_IDS);
  });

  it('matches the exact AI HELP V4 §11 closed allowlist (the §8.1 seven plus the product-owned V4 destinations)', () => {
    expect([...NAVIGATION_ACTION_IDS]).toEqual([
      'open_dashboard', 'open_quote_history', 'open_new_quote', 'open_clients', 'open_catalog', 'open_finances', 'open_business_settings',
      'open_business_details', 'open_business_phone', 'open_business_tax_id', 'open_plan_information', 'open_selected_quote', 'open_admin',
    ]);
  });
});

describe('extractNavigationAction', () => {
  it('no marker present - no navigation, answer unchanged', () => {
    const r = extractNavigationAction('Here is how to do it.', false);
    expect(r.action).toBeNull();
    expect(r.answer).toBe('Here is how to do it.');
  });

  it('a valid trailing marker is parsed and stripped from the visible answer', () => {
    const r = extractNavigationAction('You can see your quotes here.\nNAVIGATE: open_quote_history', false);
    expect(r.action).toBe('open_quote_history');
    expect(r.answer).toBe('You can see your quotes here.');
  });

  it('is case-insensitive on both the marker keyword and the action id', () => {
    const r = extractNavigationAction('Text.\nnavigate: OPEN_CLIENTS', false);
    expect(r.action).toBe('open_clients');
  });

  it('an unknown action id is rejected (fails closed to no navigation), never forwarded as-is', () => {
    const r = extractNavigationAction('Text.\nNAVIGATE: open_admin_panel', false);
    expect(r.action).toBeNull();
    expect(r.answer).toBe('Text.');
  });

  it('a free-form URL is never accepted as a navigation action', () => {
    const r = extractNavigationAction('Text.\nNAVIGATE: https://evil.example.com', false);
    expect(r.action).toBeNull();
  });

  it('a script/injection-shaped payload in the marker is rejected, not executed or forwarded', () => {
    const r = extractNavigationAction('Text.\nNAVIGATE: <script>alert(1)</script>', false);
    expect(r.action).toBeNull();
  });

  it('open_selected_quote is rejected when no quote context was authorized this turn (prevents hallucinated navigation to an unauthorized quote)', () => {
    const r = extractNavigationAction('Text.\nNAVIGATE: open_selected_quote', false);
    expect(r.action).toBeNull();
    expect(r.answer).toBe('Text.');
  });

  it('open_selected_quote is accepted when quote context was authorized this turn', () => {
    const r = extractNavigationAction('Text.\nNAVIGATE: open_selected_quote', true);
    expect(r.action).toBe('open_selected_quote');
  });

  it('every other allowlisted action is accepted regardless of quote-context state', () => {
    for (const id of NAVIGATION_ACTION_IDS) {
      if (id === 'open_selected_quote') continue;
      const r = extractNavigationAction(`Text.\nNAVIGATE: ${id}`, false);
      expect(r.action, id).toBe(id);
    }
  });

  it('handles empty/non-string input without throwing', () => {
    expect(() => extractNavigationAction('', false)).not.toThrow();
    expect(() => extractNavigationAction(undefined, false)).not.toThrow();
    expect(extractNavigationAction(undefined, false).action).toBeNull();
  });
});
