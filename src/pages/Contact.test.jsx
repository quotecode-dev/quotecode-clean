import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';

// Landing Pages + Business Tools TEST/Staging task (§6/§16): the Owner-
// confirmed market-routing rule (support@ for Hebrew/Israel, info@ for
// English/International) must never be normalized to one address. This
// page previously hardcoded support@ for both locales, contradicting the
// landing-page footers, which already differentiated correctly - covering
// it here so the bug can't silently return.

describe('Contact - market-specific support email routing', () => {
  it('shows support@tekango.com for the Hebrew/Israel market', () => {
    render(<MemoryRouter><Contact isHebrew={true} /></MemoryRouter>);
    expect(screen.getByText('support@tekango.com')).toBeTruthy();
    expect(screen.queryByText('info@tekango.com')).toBeNull();
  });

  it('shows info@tekango.com for the English/International market', () => {
    render(<MemoryRouter><Contact isHebrew={false} /></MemoryRouter>);
    expect(screen.getByText('info@tekango.com')).toBeTruthy();
    expect(screen.queryByText('support@tekango.com')).toBeNull();
  });
});
