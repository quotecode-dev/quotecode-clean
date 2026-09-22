import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NAVIGATION_ACTIONS, NAVIGATION_ACTION_IDS, isValidNavigationAction, getNavigationLabel, dispatchSafeNavigation, AI_NAVIGATE_EVENT } from './safeNavigation';

describe('NAVIGATION_ACTIONS', () => {
  it('every action has an id plus HE and EN product-owned labels', () => {
    for (const action of NAVIGATION_ACTIONS) {
      expect(typeof action.id).toBe('string');
      expect(action.he.length).toBeGreaterThan(0);
      expect(action.en.length).toBeGreaterThan(0);
    }
  });

  it('has exactly the 13 AI HELP V4 allowlisted destinations (the shared NAV_ACTIONS), no more', () => {
    expect(NAVIGATION_ACTION_IDS).toHaveLength(13);
  });
});

describe('isValidNavigationAction', () => {
  it('true for every allowlisted id', () => {
    for (const id of NAVIGATION_ACTION_IDS) {
      expect(isValidNavigationAction(id)).toBe(true);
    }
  });

  it('false for anything not on the allowlist, including a free-form URL', () => {
    expect(isValidNavigationAction('open_admin_users')).toBe(false);
    expect(isValidNavigationAction('https://evil.example.com')).toBe(false);
    expect(isValidNavigationAction('')).toBe(false);
    expect(isValidNavigationAction(null)).toBe(false);
    expect(isValidNavigationAction(undefined)).toBe(false);
  });
});

describe('getNavigationLabel', () => {
  it('returns the correct locale label for a valid action', () => {
    expect(getNavigationLabel('open_clients', true)).toBe('פתיחת לקוחות');
    expect(getNavigationLabel('open_clients', false)).toBe('Open clients');
  });

  it('returns null for an invalid action rather than a guessed label', () => {
    expect(getNavigationLabel('not_real', true)).toBeNull();
  });
});

describe('dispatchSafeNavigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches the AI_NAVIGATE_EVENT with the action in detail for a valid action', () => {
    const handler = vi.fn();
    window.addEventListener(AI_NAVIGATE_EVENT, handler);
    const result = dispatchSafeNavigation('open_finances');
    window.removeEventListener(AI_NAVIGATE_EVENT, handler);

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: 'open_finances', meta: null });
  });

  it('carries an optional meta payload through to the event detail (e.g. which quote id to open)', () => {
    const handler = vi.fn();
    window.addEventListener(AI_NAVIGATE_EVENT, handler);
    dispatchSafeNavigation('open_selected_quote', { quoteId: 'quote-123' });
    window.removeEventListener(AI_NAVIGATE_EVENT, handler);

    expect(handler.mock.calls[0][0].detail).toEqual({ action: 'open_selected_quote', meta: { quoteId: 'quote-123' } });
  });

  it('never dispatches for an invalid/unallowlisted action - no event fires', () => {
    const handler = vi.fn();
    window.addEventListener(AI_NAVIGATE_EVENT, handler);
    const result = dispatchSafeNavigation('javascript:alert(1)');
    window.removeEventListener(AI_NAVIGATE_EVENT, handler);

    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
