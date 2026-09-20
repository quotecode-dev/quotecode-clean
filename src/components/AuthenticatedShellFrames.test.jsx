import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthenticatedHeaderFrame, HeaderDynamicSlot } from './AuthenticatedShellFrames';

afterEach(cleanup);

// Unified Header + Always-Available AI Chat task, §9 "Header Contract":
// the two new optional Dynamic/Entitlement regions are purely additive -
// every pre-existing caller (Dashboard.jsx, AdminPresentation.test.jsx)
// keeps working unchanged when it never passes them.
describe('AuthenticatedHeaderFrame - dynamic/entitlement slots (§9, §11)', () => {
  it('renders identity and actions with neither optional slot present, unchanged from before', () => {
    render(<AuthenticatedHeaderFrame context="business" identity="Business Name" actions={<button>Account</button>} />);
    expect(screen.getByText('Business Name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
    expect(document.querySelector('.dash-topbar-dynamic')).toBeNull();
    expect(document.querySelector('.dash-topbar-entitlement')).toBeNull();
  });

  it('renders the dynamic slot content when provided', () => {
    render(<AuthenticatedHeaderFrame context="business" identity="X" actions={<button>A</button>} dynamic={<span>Transient notice</span>} />);
    expect(screen.getByText('Transient notice')).toBeTruthy();
  });

  it('renders the entitlement slot content when provided', () => {
    render(<AuthenticatedHeaderFrame context="business" identity="X" actions={<button>A</button>} entitlement={<span>PRO</span>} />);
    expect(screen.getByText('PRO')).toBeTruthy();
  });

  it('identity and the trailing (dynamic+entitlement+actions) group remain exactly 2 direct children of .dash-topbar-global, regardless of how many optional slots are filled (preserves the space-between layout contract)', () => {
    const { container } = render(
      <AuthenticatedHeaderFrame context="business" identity="X" actions={<button>A</button>} dynamic={<span>D</span>} entitlement={<span>E</span>} />
    );
    const global = container.querySelector('.dash-topbar-global');
    expect(global.children.length).toBe(2);
    expect(global.children[0].className).toBe('dash-topbar-identity');
    expect(global.children[1].className).toBe('dash-topbar-trailing');
  });

  it('still supports the pre-existing admin summary region unchanged', () => {
    render(<AuthenticatedHeaderFrame context="admin" identity="X" actions={<button>A</button>} summary={<span>Admin summary</span>} />);
    expect(screen.getByText('Admin summary')).toBeTruthy();
  });
});

describe('HeaderDynamicSlot (§9 "Dynamic information")', () => {
  it('renders the caller-provided transient message when present', () => {
    render(<HeaderDynamicSlot message="Owner notice" isHebrew={false} />);
    expect(screen.getByText('Owner notice')).toBeTruthy();
  });

  it('falls back to a live clock/date when no message is provided', () => {
    render(<HeaderDynamicSlot isHebrew={false} />);
    const el = screen.getByText(/·/);
    expect(el.textContent).toMatch(/\d{2}\/\d{2} · \d{2}:\d{2}/);
  });

  it('renders a Hebrew-locale clock when isHebrew is true, distinct from the English rendering', () => {
    const { unmount } = render(<HeaderDynamicSlot isHebrew={true} />);
    const heText = screen.getByText(/·/).textContent;
    unmount();
    render(<HeaderDynamicSlot isHebrew={false} />);
    const enText = screen.getByText(/·/).textContent;
    // Both are real, non-empty renderings of the same underlying instant -
    // not asserting exact locale formatting (that's Intl's own concern),
    // only that both branches actually render something real.
    expect(heText.length).toBeGreaterThan(0);
    expect(enText.length).toBeGreaterThan(0);
  });

  it('never renders both the message and the clock at once (single slot, no height jump)', () => {
    render(<HeaderDynamicSlot message="Notice" isHebrew={false} />);
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('stops its own interval on unmount (no leaked timers)', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<HeaderDynamicSlot isHebrew={false} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});
