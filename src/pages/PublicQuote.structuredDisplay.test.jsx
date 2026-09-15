import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';

// Smart Quote Guided UX Completion task, Part E - customer-facing
// structured display. This proves the RENDERING logic given a rich
// quoteData object (matching the shape get-public-quote/index.ts now
// returns once the same migrations reach the environment it runs against -
// this task did not deploy that Edge Function, per its own TEST/local-only
// STOP boundary, so this is component-level proof, not a live pipeline
// proof). A flat item (no pricing_unit) must render byte-identically to
// before - these fixtures mirror PublicQuote.businessAccountGate.test.jsx's
// own minimal-quoteData convention.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) },
}));

function buildQuoteData(items, overrides = {}) {
  return {
    quote: {
      id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89',
      quote_number: 100701,
      status: 'draft',
      signature: null,
      tax_rate: 0.18,
      client_type: 'business',
      is_owner_viewing: false,
      total: 650,
      ...overrides.quote,
    },
    business: { business_name: 'Test Business', ...overrides.business },
    client: { company_name: 'Test Client', ...overrides.client },
    items,
    sections: overrides.sections || [],
    attachments: [],
  };
}

const flatItem = { description: 'Fixed work', quantity: 1, price: 150, total_price: 150 };
const measuredItem = {
  description: 'Windows - apartment 33',
  quantity: 1,
  price: 100,
  total_price: 440,
  pricing_unit: 'm2',
  calculated_quantity: 4.4,
  quantity_source: 'calculated',
  calculation_method: 'area',
  specification: [{ label: 'Color', value: 'White' }],
  measurements: [
    { width: 0.8, height: 1.0, unit: 'm', calculated_area: 0.8, label: '', is_pricing_driving: true },
    { width: 1.0, height: 1.2, unit: 'm', calculated_area: 1.2, label: '', is_pricing_driving: true },
    { width: 1.2, height: 1.5, unit: 'm', calculated_area: 1.8, label: '', is_pricing_driving: true },
    { width: 0.6, height: 1.0, unit: 'm', calculated_area: 0.6, label: '', is_pricing_driving: true },
  ],
};

describe('PublicQuote (HE) - structured display', () => {
  it('a flat item renders exactly as before - no expand affordance, raw quantity shown', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    expect(screen.getByText('Fixed work')).toBeInTheDocument();
    expect(screen.queryByText(/הצג פרטים/)).not.toBeInTheDocument();
  });

  it('a professional item shows the calculated quantity + unit, and details are collapsed by default', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([measuredItem])} /></MemoryRouter>);
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText(/4\.40/)).toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
    expect(screen.getByText(/הצג פרטים/)).toBeInTheDocument();
  });

  it('expanding shows every measurement row and the specification, matching the create-time synthetic scenario (4 rows -> 4.40 m^2)', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([measuredItem])} /></MemoryRouter>);
    fireEvent.click(screen.getByText(/הצג פרטים/));
    // חוק ברזל (Smart Quote Final Visual Correction task - "HE MEASUREMENT
    // UNIT LOCALIZATION - ABSOLUTE"): פלט-לקוח HE לעולם לא מציג m/m² גולמי -
    // מ'/מ"ר בלבד, דרך formatMeasurementLine המשותף.
    expect(screen.getByText(/0\.80 × 1\.00 מ' = 0\.80 מ"ר/)).toBeInTheDocument();
    expect(screen.getByText(/1\.00 × 1\.20 מ' = 1\.20 מ"ר/)).toBeInTheDocument();
    expect(screen.getByText(/1\.20 × 1\.50 מ' = 1\.80 מ"ר/)).toBeInTheDocument();
    expect(screen.getByText(/0\.60 × 1\.00 מ' = 0\.60 מ"ר/)).toBeInTheDocument();
    expect(screen.getByText(/Color/)).toBeInTheDocument();
    expect(screen.getByText(/White/)).toBeInTheDocument();
  });

  it('the money total for a mixed structured + fixed quote still totals correctly (structured display never changes the amount)', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([measuredItem, flatItem])} /></MemoryRouter>);
    expect(screen.getAllByText(/440/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/150/).length).toBeGreaterThan(0);
  });

  it('shows a group heading when the item belongs to a real group (Part M), and no heading when no groups exist', () => {
    const grouped = { ...measuredItem, section_id: 'sec1' };
    const { rerender } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([grouped], { sections: [{ id: 'sec1', name: 'Ground floor' }] })} /></MemoryRouter>);
    expect(screen.getByText('Ground floor')).toBeInTheDocument();

    rerender(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    expect(screen.queryByText('Ground floor')).not.toBeInTheDocument();
  });

  it('shows a per-unit subtotal at the end of each real group when Expanded (Group-Terminology-as-Work-Units UX Fix task, Part 7)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);
    // Final Public Quote Restoration task: a divided quote now opens
    // collapsed by default - the per-unit footer caption only renders once
    // Expanded is explicitly chosen (the header total is always visible
    // regardless, but this test's own intent is the footer caption).
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('מורחב'));
    expect(screen.getByText('סה"כ Apartment 33')).toBeInTheDocument();
    expect(screen.getByText('סה"כ Apartment 34')).toBeInTheDocument();
    expect(screen.getAllByText(/440/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/150/).length).toBeGreaterThan(0);
  });

  it('a divided quote defaults to COLLAPSED on first render (Final Public Quote Restoration task - supersedes the old Locked Decision 11 "defaults to Expanded")', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    // Unit name + total are always visible (even collapsed) - item content is not.
    expect(screen.getByText('Apartment 33')).toBeInTheDocument();
    expect(screen.getAllByText(/440/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    // The viewer opens the one unit-level disclosure control to reveal it.
    fireEvent.click(screen.getByRole('button', { name: /^(הרחב יחידה|Expand unit)$/ }));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
  });

  it('a regular (non-divided) quote defaults to Compact - unchanged pre-existing behavior', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    expect(screen.getByText('Fixed work')).toBeInTheDocument();
  });
});

describe('PublicQuote (HE) - Compact/Expanded (Smart Quote End-to-End Structural Unification task, Locked Decision 12)', () => {
  const originalPrint = window.print;
  beforeEach(() => { window.print = vi.fn(); });
  afterEach(() => { window.print = originalPrint; });

  it('Compact mode for a divided quote shows ONLY unit name + unit total - no item rows, no measurements, no specification', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('תמציתי'));
    expect(screen.getByText('Apartment 33')).toBeInTheDocument();
    expect(screen.getByText('Apartment 34')).toBeInTheDocument();
    expect(screen.getAllByText(/440/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/150/).length).toBeGreaterThan(0);
    // The item-level content itself must be entirely gone in Compact.
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
    expect(screen.queryByText(/הצג פרטים/)).not.toBeInTheDocument();
  });

  it('switching back to Expanded from the same modal restores the full per-unit item breakdown', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('תמציתי'));
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('מורחב'));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
  });

  it('Compact/Expanded for a REGULAR quote keeps its pre-existing meaning (item-level measurement detail toggle), never a units-only view', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([measuredItem])} /></MemoryRouter>);
    // Regular quote: item itself always shows regardless of print mode.
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('תמציתי'));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('מורחב'));
    // Expanded now force-opens every item's own measurement/specification detail.
    expect(screen.getByText(/Color/)).toBeInTheDocument();
    expect(screen.getByText(/0\.80 × 1\.00 מ' = 0\.80 מ"ר/)).toBeInTheDocument();
  });

  it('the print-mode modal describes Compact/Expanded in unit terms for a divided quote, not item-measurement terms', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    fireEvent.click(screen.getByText('הדפס מסמך'));
    expect(screen.getByText(/שם כל יחידה וסה"כ שלה בלבד/)).toBeInTheDocument();
  });
});

describe('PublicQuoteEn - structured display', () => {
  it('a flat item renders exactly as before', () => {
    render(<PublicQuoteEn quoteData={buildQuoteData([flatItem], { quote: { currency: 'USD' } })} />);
    expect(screen.getByText('Fixed work')).toBeInTheDocument();
    expect(screen.queryByText(/Show details/)).not.toBeInTheDocument();
  });

  it('a professional item shows the calculated quantity + unit, collapsed by default, expandable to the full measurement breakdown', () => {
    render(<PublicQuoteEn quoteData={buildQuoteData([measuredItem], { quote: { currency: 'USD' } })} />);
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText(/4\.40/)).toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show details/));
    // EN customer output keeps real m/m² (only HE gets localized to מ'/מ"ר) -
    // spacing around × now matches formatMeasurementLine's shared format.
    expect(screen.getByText(/0\.80 × 1\.00 m = 0\.80 m²/)).toBeInTheDocument();
    expect(screen.getByText(/Color/)).toBeInTheDocument();
  });

  it('shows a group heading when the item belongs to a real group', () => {
    const grouped = { ...measuredItem, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([grouped], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Ground floor' }] })} />);
    expect(screen.getByText('Ground floor')).toBeInTheDocument();
  });

  it('shows a per-unit subtotal at the end of the group when Expanded', () => {
    const grouped = { ...measuredItem, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([grouped], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Ground floor' }] })} />);
    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Expanded'));
    expect(screen.getByText('Total Ground floor:')).toBeInTheDocument();
  });

  it('a divided quote defaults to COLLAPSED on first render (Final Public Quote Restoration task)', () => {
    const grouped = { ...measuredItem, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([grouped], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Ground floor' }] })} />);
    expect(screen.getByText('Ground floor')).toBeInTheDocument();
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^(Expand unit)$/ }));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
  });
});

describe('PublicQuoteEn - Compact/Expanded (Locked Decision 12)', () => {
  const originalPrint = window.print;
  beforeEach(() => { window.print = vi.fn(); });
  afterEach(() => { window.print = originalPrint; });

  it('Compact mode for a divided quote shows only unit name + unit total', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33, apt34], {
      quote: { currency: 'USD' },
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} />);
    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Compact'));
    expect(screen.getByText('Apartment 33')).toBeInTheDocument();
    expect(screen.getByText('Apartment 34')).toBeInTheDocument();
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
  });

  it('Expanded restores the full per-unit item breakdown', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Apartment 33' }] })} />);
    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Compact'));
    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Expanded'));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
  });

  it('regular quote Compact/Expanded keeps its item-measurement-detail meaning', () => {
    render(<PublicQuoteEn quoteData={buildQuoteData([measuredItem], { quote: { currency: 'USD' } })} />);
    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Expanded'));
    expect(screen.getByText(/Color/)).toBeInTheDocument();
  });
});
