import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
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
    const wrapper = getMobileWrapper(container, 'מספר הצעה');
    expect(wrapper.style.textAlign).toBe('center');
  });

  it('EN: info-stack wrapper is centered, not right-aligned', () => {
    const { container } = render(<PublicQuoteHeader {...baseProps} isHebrew={false} />);
    const wrapper = getMobileWrapper(container, 'Quote Number');
    expect(wrapper.style.textAlign).toBe('center');
  });

  it('HE and EN resolve to the identical alignment value (structural parity, not independently-tuned)', () => {
    const { container: heContainer } = render(<PublicQuoteHeader {...baseProps} isHebrew={true} />);
    const { container: enContainer } = render(<PublicQuoteHeader {...baseProps} isHebrew={false} />);
    const heWrapper = getMobileWrapper(heContainer, 'מספר הצעה');
    const enWrapper = getMobileWrapper(enContainer, 'Quote Number');
    expect(heWrapper.style.textAlign).toBe(enWrapper.style.textAlign);
  });

  it('quote-number fallback (no real quote_number yet) still centers the same way', () => {
    const { container } = render(
      <PublicQuoteHeader {...baseProps} isHebrew={true} quote={{ ...baseQuote, quote_number: null }} />
    );
    const wrapper = getMobileWrapper(container, 'מספר הצעה');
    expect(wrapper.style.textAlign).toBe('center');
    expect(wrapper.textContent).toContain('מספר הצעה');
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
      (d) => d.textContent.trim() === 'מספר הצעה'
    );
    expect(label).toBeTruthy();
    // Desktop's outer card is textAlign:center at the top-level wrapper (unchanged).
    const card = label.closest('div[style*="min-width"]');
    expect(card).toBeTruthy();
  });
});
