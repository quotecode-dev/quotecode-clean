// Owner 2026-10-15: "Back" on Terms / Privacy / Contact must work also in a new tab.
import { describe, it, expect, vi } from 'vitest';
import { goBackOrHome } from './goBackOrHome';

const win = ({ idx, referrer = '', length = 1, origin = 'https://www.tekango.com' } = {}) => ({
  history: { state: idx === undefined ? null : { idx }, length },
  document: { referrer },
  location: { origin },
  close: vi.fn(),
});

describe('goBackOrHome', () => {
  it('with in-app history: a normal back', () => {
    const nav = vi.fn(); const w = win({ idx: 2, length: 3 });
    expect(goBackOrHome(nav, true, w)).toBe('back');
    expect(nav).toHaveBeenCalledWith(-1); expect(w.close).not.toHaveBeenCalled();
  });
  it('a new tab opened by our own site (signup links): tries to close it, and falls back to the Hebrew landing', () => {
    const nav = vi.fn(); const w = win({ idx: 0, referrer: 'https://www.tekango.com/dashboard', length: 1 });
    expect(goBackOrHome(nav, true, w)).toBe('home');
    expect(w.close).toHaveBeenCalled(); expect(nav).toHaveBeenCalledWith('/he', { replace: true });
  });
  it('a direct visit / another site: never closes the tab, goes to the landing of its language', () => {
    const nav = vi.fn(); const w = win({ idx: 0, referrer: 'https://www.google.com/', length: 1 });
    expect(goBackOrHome(nav, false, w)).toBe('home');
    expect(w.close).not.toHaveBeenCalled(); expect(nav).toHaveBeenCalledWith('/en', { replace: true });
    const nav2 = vi.fn(); const w2 = win({});
    goBackOrHome(nav2, true, w2);
    expect(w2.close).not.toHaveBeenCalled(); expect(nav2).toHaveBeenCalledWith('/he', { replace: true });
  });
});
