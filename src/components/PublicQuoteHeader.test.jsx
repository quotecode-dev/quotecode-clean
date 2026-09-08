import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PublicQuoteHeader from './PublicQuoteHeader';

// AUDIT-005 (PROFLOW_PROJECT_CONTEXT.md §128/§129): the Mobile info-stack
// (quote number/date/validity) must share one deterministic center axis,
// identically in HE and EN - not isHebrew-conditional, matching the money
// numeric alignment lesson (a text-alignment axis is not a locale property).

function mockMobileMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function mockDesktopMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

const baseQuote = {
  id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89',
  quote_number: null,
  created_at: '2026-08-18T00:00:00Z',
  valid_until: '2026-08-25T00:00:00Z',
};

const baseProps = {
  bizLogo: null,
  bizName: 'Test Business',
  bizTaxId: '512345678',
  bizPhone: '0587004161',
  bizEmail: 'test@example.com',
  bizAddress: null,
  quote: baseQuote,
};

// Find the Mobile info-stack wrapper: the div whose direct child renders the
// "quote number" label, one level up from the centered quote-number sub-box.
function getMobileWrapper(container, labelText) {
  const label = Array.from(container.querySelectorAll('div')).find(
    (d) => d.textContent.trim() === labelText
  );
  return label.parentElement.parentElement;
}

describe('PublicQuoteHeader - Mobile info-stack alignment (AUDIT-005)', () => {
  beforeEach(() => {
    mockMobileMatchMedia();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('HE: info-stack wrapper is centered, not left-aligned', () => {
    const { container } = render(<PublicQuoteHeader {...baseProps} isHebrew={true} />);
    const wrapper = getMobileWrapper(container, 'מס׳ הצעה');
    expect(wrapper.style.textAlign).toBe('center');
  });

  it('EN: info-stack wrapper is centered, not right-aligned', () => {
    const { container } = render(<PublicQuoteHeader {...baseProps} isHebrew={false} />);
    const wrapper = getMobileWrapper(container, 'Quote #');
    expect(wrapper.style.textAlign).toBe('center');
  });

  it('HE and EN resolve to the identical alignment value (structural parity, not independently-tuned)', () => {
    const { container: heContainer } = render(<PublicQuoteHeader {...baseProps} isHebrew={true} />);
    const { container: enContainer } = render(<PublicQuoteHeader {...baseProps} isHebrew={false} />);
    const heWrapper = getMobileWrapper(heContainer, 'מס׳ הצעה');
    const enWrapper = getMobileWrapper(enContainer, 'Quote #');
    expect(heWrapper.style.textAlign).toBe(enWrapper.style.textAlign);
  });

  it('quote-number fallback (no real quote_number yet) still centers the same way', () => {
    const { container } = render(
      <PublicQuoteHeader {...baseProps} isHebrew={true} quote={{ ...baseQuote, quote_number: null }} />
    );
    const wrapper = getMobileWrapper(container, 'מס׳ הצעה');
    expect(wrapper.style.textAlign).toBe('center');
    expect(wrapper.textContent).toContain('מס׳ הצעה');
  });
});

describe('PublicQuoteHeader - Desktop branch unaffected by the Mobile fix', () => {
  beforeEach(() => {
    mockDesktopMatchMedia();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('HE Desktop still renders the existing centered card unchanged', () => {
    const { container } = render(<PublicQuoteHeader {...baseProps} isHebrew={true} />);
    const label = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent.trim() === 'מס׳ הצעה'
    );
    expect(label).toBeTruthy();
    // Desktop's outer card is textAlign:center at the top-level wrapper (unchanged).
    const card = label.closest('div[style*="min-width"]');
    expect(card).toBeTruthy();
  });
});

// Faded PDF Logo Correction task: locks in the two source-verified pieces of
// the real fix (crossOrigin canvas-safety on the logo <img>, and the
// .pq-logo-chip class hook the capture-only CSS override targets) in both
// Mobile and Desktop branches, and in both languages, since the component is
// shared. jsdom cannot prove canvas/PDF rendering quality (a real browser
// visual check did that - see PROFLOW_CODEX_CHECKPOINT.md) - this only
// locks in the markup the fix depends on so it cannot silently regress.
describe('PublicQuoteHeader - logo canvas-safety (Faded PDF Logo Correction task)', () => {
  const logoProps = { ...baseProps, bizLogo: 'https://dummyimage.com/240x90/1e5ad2/ffffff.png' };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Desktop HE: logo img has crossOrigin=anonymous and sits inside a .pq-logo-chip wrapper', () => {
    mockDesktopMatchMedia();
    const { container } = render(<PublicQuoteHeader {...logoProps} isHebrew={true} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.crossOrigin).toBe('anonymous');
    expect(img.closest('.pq-logo-chip')).toBeTruthy();
  });

  it('Desktop EN: logo img has crossOrigin=anonymous and sits inside a .pq-logo-chip wrapper', () => {
    mockDesktopMatchMedia();
    const { container } = render(<PublicQuoteHeader {...logoProps} isHebrew={false} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.crossOrigin).toBe('anonymous');
    expect(img.closest('.pq-logo-chip')).toBeTruthy();
  });

  it('Mobile HE: logo img has crossOrigin=anonymous and sits inside a .pq-logo-chip wrapper', () => {
    mockMobileMatchMedia();
    const { container } = render(<PublicQuoteHeader {...logoProps} isHebrew={true} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.crossOrigin).toBe('anonymous');
    expect(img.closest('.pq-logo-chip')).toBeTruthy();
  });

  it('Mobile EN: logo img has crossOrigin=anonymous and sits inside a .pq-logo-chip wrapper', () => {
    mockMobileMatchMedia();
    const { container } = render(<PublicQuoteHeader {...logoProps} isHebrew={false} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.crossOrigin).toBe('anonymous');
    expect(img.closest('.pq-logo-chip')).toBeTruthy();
  });

  it('falls back to plain (non-CORS) loading on image error, instead of permanently breaking on-screen display', () => {
    mockDesktopMatchMedia();
    const { container } = render(<PublicQuoteHeader {...logoProps} isHebrew={true} />);
    const img = container.querySelector('img');
    expect(img.crossOrigin).toBe('anonymous');
    fireEvent.error(img);
    expect(img.crossOrigin).toBeNull();
  });

  it('no-logo path never renders an <img> at all (business-name fallback unaffected by the fix)', () => {
    mockDesktopMatchMedia();
    const { container } = render(<PublicQuoteHeader {...baseProps} isHebrew={true} bizLogo={null} />);
    expect(container.querySelector('img')).toBeFalsy();
    expect(container.textContent).toContain('Test Business');
  });
});
