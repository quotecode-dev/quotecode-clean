import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';

// Public Quote Section-Level Smart Dropdown task - EXACT Owner contract,
// supersedes the prior single global-dropdown design this file used to
// cover. Each real section/room is its own independently-collapsible
// commercial unit: collapsed shows ONE commercial-summary row (section
// name/description, quantity=1, unit price=section total, section total);
// expanded shows that section's own item rows with full inline Smart/
// Professional detail. No global dropdown, no per-item dropdown anywhere.
// A flat (non-divided) quote keeps the plain classic table, unchanged.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) },
}));

// Public Quote Section Dropdown Column-Geometry Lock task: jsdom does not
// perform real layout, so pixel positions cannot be measured here - the
// meaningful, practical structural proxy is the <colgroup> width contract
// itself (table-layout:fixed makes these the ONLY thing that determines
// column geometry, regardless of any row's content) - same approach these
// tests already use elsewhere in this file for structural assertions.
function getColWidths(container) {
  const table = container.querySelector('table');
  return Array.from(table.querySelectorAll('colgroup > col')).map((c) => c.style.width);
}

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

describe('PublicQuote (HE) - flat quote (no sections at all)', () => {
  it('renders the plain classic table, unchanged - no section control invented', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    expect(screen.getByText('Fixed work')).toBeInTheDocument();
    expect(screen.queryByText(/▼|▲/)).not.toBeInTheDocument();
  });

  it('a professional item with no section still shows its quantity+unit on its own row - there is no dropdown left anywhere to move it behind', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([measuredItem])} /></MemoryRouter>);
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText(/4\.40 מ"ר/)).toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
    expect(screen.queryByText(/▼|▲/)).not.toBeInTheDocument();
  });
});

describe('PublicQuote (HE) - collapsed section (default state)', () => {
  it('shows only the section name, one commercial-summary row, and the section total - zero Smart detail, zero item-level rows, zero global dropdown', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    expect(screen.getByText(/Apartment 33 ▼/)).toBeInTheDocument();
    expect(screen.getAllByText(/440/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
    expect(screen.queryByText(/מ"ר/)).not.toBeInTheDocument();
    expect(screen.queryByText(/פירוט הצעה חכמה/)).not.toBeInTheDocument();
  });

  it('a single-item section shows a real item count, "—" as unit price (never the section total mislabeled as a unit price, never 1/an invented average), and the authoritative section total (Public Quote Section Summary Row Correction task, Owner visual finding)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    const row = screen.getByText(/Apartment 33 ▼/).closest('tr');
    expect(row).toHaveTextContent('1 פריטים');
    expect(row).toHaveTextContent('—');
    expect(row).toHaveTextContent('440');
  });

  it('a 5-item section shows the real item count (5 פריטים), not a fake "1"', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ ...flatItem, description: `Item ${i + 1}`, section_id: 'sec1' }));
    const expectedTotal = items.reduce((sum, it) => sum + it.total_price, 0);
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData(items, { sections: [{ id: 'sec1', name: 'Living Room' }] })} /></MemoryRouter>);
    const row = screen.getByText(/Living Room ▼/).closest('tr');
    expect(row).toHaveTextContent('5 פריטים');
    expect(row).not.toHaveTextContent(/(^|[^0-9])1 פריטים/);
    expect(row).toHaveTextContent('—');
    expect(row).toHaveTextContent(String(expectedTotal));
  });

  it('multiple sections each collapse to their own summary row, independently', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);
    expect(screen.getByText(/Apartment 33 ▼/)).toBeInTheDocument();
    expect(screen.getByText(/Apartment 34 ▼/)).toBeInTheDocument();
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
  });
});

describe('PublicQuote (HE) - expanded section, independent state', () => {
  it('opening one section reveals only its own items and full Smart detail; the other section stays collapsed and unaffected', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));

    expect(screen.getByText(/Apartment 33 ▲/)).toBeInTheDocument();
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText('כמות: 4.40 מ"ר')).toBeInTheDocument();
    expect(screen.getByText(/0\.80 × 1\.00 מ' = 0\.80 מ"ר/)).toBeInTheDocument();
    expect(screen.getByText(/Color/)).toBeInTheDocument();
    expect(screen.getByText('סה"כ Apartment 33')).toBeInTheDocument();
    // §4 - expanded item financials unchanged: the item's own row still
    // shows its own real quantity/unit price/line total (not the section
    // summary's "N פריטים"/"—" - those only apply to the collapsed row).
    const itemRow = screen.getByText('Windows - apartment 33').closest('tr');
    expect(itemRow).toHaveTextContent('100.00');
    expect(itemRow).toHaveTextContent('440.00');
    expect(itemRow).not.toHaveTextContent('—');
    // Section B stays collapsed and shows none of section A's content.
    expect(screen.getByText(/Apartment 34 ▼/)).toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
  });

  it('opening section B afterward does not close section A - both expand independently, never an accordion', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    fireEvent.click(screen.getByText(/Apartment 34 ▼/));

    expect(screen.getByText(/Apartment 33 ▲/)).toBeInTheDocument();
    expect(screen.getByText(/Apartment 34 ▲/)).toBeInTheDocument();
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText('Fixed work 2')).toBeInTheDocument();
  });

  it('collapsing an expanded section again hides its Smart detail with zero leak, back to a summary row', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Apartment 33 ▲/));
    expect(screen.getByText(/Apartment 33 ▼/)).toBeInTheDocument();
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
  });

  it('an item with no section of its own (in an otherwise-sectioned quote) is grouped under the existing canonical "Unassigned" label (לא משויך), reused from QuoteForm.jsx - not an invented room name - and follows the exact same collapsed-summary rule (§7)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const loose = { ...flatItem, description: 'Loose item' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, loose], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    expect(screen.getByText(/לא משויך ▼/)).toBeInTheDocument();
    const row = screen.getByText(/לא משויך ▼/).closest('tr');
    expect(row).toHaveTextContent('1 פריטים');
    expect(row).toHaveTextContent('—');
    expect(row).toHaveTextContent('150');
    fireEvent.click(screen.getByText(/לא משויך ▼/));
    expect(screen.getByText('Loose item')).toBeInTheDocument();
  });
});

describe('PublicQuote (HE) - Compact/Expanded print mode sets every section at once', () => {
  const originalPrint = window.print;
  beforeEach(() => { window.print = vi.fn(); });
  afterEach(() => { window.print = originalPrint; });

  it('Compact collapses every section to its summary row; Expanded opens every section at once', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);

    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('מורחב'));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText('Fixed work 2')).toBeInTheDocument();
    expect(screen.getByText(/Color/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('תמציתי'));
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
    expect(screen.getByText(/Apartment 33 ▼/)).toBeInTheDocument();
    expect(screen.getByText(/Apartment 34 ▼/)).toBeInTheDocument();
  });
});

describe('PublicQuoteEn - flat quote (no sections at all)', () => {
  it('renders the plain classic table, unchanged', () => {
    render(<PublicQuoteEn quoteData={buildQuoteData([flatItem], { quote: { currency: 'USD' } })} />);
    expect(screen.getByText('Fixed work')).toBeInTheDocument();
    expect(screen.queryByText(/▼|▲/)).not.toBeInTheDocument();
  });

  it('a professional item with no section still shows its quantity+unit on its own row', () => {
    render(<PublicQuoteEn quoteData={buildQuoteData([measuredItem], { quote: { currency: 'USD' } })} />);
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText(/4\.40 m²/)).toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
    expect(screen.queryByText(/▼|▲/)).not.toBeInTheDocument();
  });
});

describe('PublicQuoteEn - collapsed section (default state)', () => {
  it('shows only the section name, one commercial-summary row, and the section total', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.getByText(/Apartment 33 ▼/)).toBeInTheDocument();
    expect(screen.getAllByText(/440/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText(/Color/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Smart Quote Details/)).not.toBeInTheDocument();
  });

  it('a single-item section shows a real singular item count, "—" as unit price, and the authoritative section total (Public Quote Section Summary Row Correction task, Owner visual finding)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Apartment 33' }] })} />);
    const row = screen.getByText(/Apartment 33 ▼/).closest('tr');
    expect(row).toHaveTextContent('1 item');
    expect(row).not.toHaveTextContent('1 items');
    expect(row).toHaveTextContent('—');
    expect(row).toHaveTextContent('440');
  });

  it('a 5-item section shows the real item count (5 items), not a fake "1"', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ ...flatItem, description: `Item ${i + 1}`, section_id: 'sec1' }));
    const expectedTotal = items.reduce((sum, it) => sum + it.total_price, 0);
    render(<PublicQuoteEn quoteData={buildQuoteData(items, { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Living Room' }] })} />);
    const row = screen.getByText(/Living Room ▼/).closest('tr');
    expect(row).toHaveTextContent('5 items');
    expect(row).toHaveTextContent('—');
    expect(row).toHaveTextContent(String(expectedTotal));
  });
});

describe('PublicQuoteEn - expanded section, independent state', () => {
  it('opening one section reveals only its own items and full Smart detail; the other section stays collapsed', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33, apt34], {
      quote: { currency: 'USD' },
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} />);

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));

    expect(screen.getByText(/Apartment 33 ▲/)).toBeInTheDocument();
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText('Quantity: 4.40 m²')).toBeInTheDocument();
    expect(screen.getByText(/0\.80 × 1\.00 m = 0\.80 m²/)).toBeInTheDocument();
    expect(screen.getByText(/Color/)).toBeInTheDocument();
    expect(screen.getByText('Total Apartment 33:')).toBeInTheDocument();
    // §4 - expanded item financials unchanged.
    const itemRow = screen.getByText('Windows - apartment 33').closest('tr');
    expect(itemRow).toHaveTextContent('100.00');
    expect(itemRow).toHaveTextContent('440.00');
    expect(itemRow).not.toHaveTextContent('—');
    expect(screen.getByText(/Apartment 34 ▼/)).toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
  });

  it('an item with no section is grouped under the existing canonical "Unassigned" label and follows the exact same collapsed-summary rule (§7)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const loose = { ...flatItem, description: 'Loose item' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33, loose], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Apartment 33' }] })} />);
    expect(screen.getByText(/Unassigned ▼/)).toBeInTheDocument();
    const row = screen.getByText(/Unassigned ▼/).closest('tr');
    expect(row).toHaveTextContent('1 item');
    expect(row).toHaveTextContent('—');
    expect(row).toHaveTextContent('150');
    fireEvent.click(screen.getByText(/Unassigned ▼/));
    expect(screen.getByText('Loose item')).toBeInTheDocument();
  });
});

describe('PublicQuoteEn - Compact/Expanded print mode sets every section at once', () => {
  const originalPrint = window.print;
  beforeEach(() => { window.print = vi.fn(); });
  afterEach(() => { window.print = originalPrint; });

  it('Compact collapses every section; Expanded opens every section at once', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    render(<PublicQuoteEn quoteData={buildQuoteData([apt33, apt34], {
      quote: { currency: 'USD' },
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} />);

    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Expanded'));
    expect(screen.getByText('Windows - apartment 33')).toBeInTheDocument();
    expect(screen.getByText('Fixed work 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Print Document'));
    fireEvent.click(screen.getByText('Compact'));
    expect(screen.queryByText('Windows - apartment 33')).not.toBeInTheDocument();
    expect(screen.queryByText('Fixed work 2')).not.toBeInTheDocument();
  });
});

describe('PublicQuote (HE) - column geometry lock (Public Quote Section Dropdown Column-Geometry Lock task, Owner visual finding)', () => {
  it('the table declares exactly one canonical 4-column contract (table-layout:fixed + colgroup), identical whether the quote is flat or sectioned', () => {
    const { container: flatContainer } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    const flatTable = flatContainer.querySelector('table');
    expect(flatTable.style.tableLayout).toBe('fixed');
    expect(getColWidths(flatContainer)).toEqual(['40%', '18%', '21%', '21%']);

    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const { container: sectionedContainer } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    expect(getColWidths(sectionedContainer)).toEqual(getColWidths(flatContainer));
  });

  it('expanding a section does not change the column-width contract at all - same <colgroup> before, during, and after expand (the exact defect this task corrects: content that used to widen the table under the old auto layout can no longer do so)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const { container } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    const before = getColWidths(container);

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    expect(getColWidths(container)).toEqual(before);
    // Only one <colgroup> ever exists - detail content never adds a second
    // one or duplicates/overrides the column contract.
    expect(container.querySelectorAll('table colgroup').length).toBe(1);

    fireEvent.click(screen.getByText(/Apartment 33 ▲/));
    expect(getColWidths(container)).toEqual(before);
  });

  it('opening one section leaves the column contract unaffected even with a second, still-collapsed section and an unassigned group present (multi-section stress)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const apt34 = { ...flatItem, description: 'Fixed work 2', section_id: 'sec2' };
    const loose = { ...flatItem, description: 'Loose item' };
    const { container } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33, apt34, loose], {
      sections: [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }],
    })} /></MemoryRouter>);
    const before = getColWidths(container);

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    expect(getColWidths(container)).toEqual(before);
    fireEvent.click(screen.getByText(/Apartment 34 ▼/));
    expect(getColWidths(container)).toEqual(before);
    fireEvent.click(screen.getByText(/לא משויך ▼/));
    expect(getColWidths(container)).toEqual(before);
  });

  it('the group heading and subtotal rows use colSpan to merge into the SAME 4-column contract, never a 5th column or an override', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Apartment 33 ▼/));

    const headingCell = screen.getByText(/Apartment 33 ▲/).closest('td');
    expect(headingCell.getAttribute('colspan')).toBe('4');
    const subtotalLabelCell = screen.getByText('סה"כ Apartment 33');
    expect(subtotalLabelCell.getAttribute('colspan')).toBe('3');
  });
});

describe('PublicQuoteEn - column geometry lock', () => {
  it('the table declares the exact same canonical 4-column contract as HE', () => {
    const { container } = render(<PublicQuoteEn quoteData={buildQuoteData([flatItem], { quote: { currency: 'USD' } })} />);
    const table = container.querySelector('table');
    expect(table.style.tableLayout).toBe('fixed');
    expect(getColWidths(container)).toEqual(['40%', '18%', '21%', '21%']);
  });

  it('expanding a section does not change the column-width contract', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const { container } = render(<PublicQuoteEn quoteData={buildQuoteData([apt33], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Apartment 33' }] })} />);
    const before = getColWidths(container);

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    expect(getColWidths(container)).toEqual(before);
    expect(container.querySelectorAll('table colgroup').length).toBe(1);

    fireEvent.click(screen.getByText(/Apartment 33 ▲/));
    expect(getColWidths(container)).toEqual(before);
  });
});

describe('PublicQuote (HE) - Mobile 4-column geometry correction (Public Quote Mobile 4-Column Geometry Correction task - Owner rejected the prior stacked-card Mobile layout; restored the real 4-column table, fixed by geometry only). jsdom performs no real layout and never evaluates @media rules, so pixel-level overflow cannot be asserted here - these tests verify the actual structural contract that ships: the SAME table/colgroup/row markup used at every breakpoint (no separate Mobile DOM shape, no data-label/::before mechanism reintroduced), a Mobile-only <col> class hook + CSS text containing the geometry override, and money cells protected with white-space:nowrap. Real viewport/scroll verification is a live-browser task.', () => {
  it('the collapsed/expanded/flat row structure is the exact same real <td> cells as Desktop - no data-label attribute anywhere (proof the stacked-card mechanism was fully removed, not just hidden)', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const { container } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    expect(container.querySelectorAll('[data-label]').length).toBe(0);
    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    expect(container.querySelectorAll('[data-label]').length).toBe(0);
  });

  it('each <col> carries a stable class hook (pq-col-desc/qty/price/total) the Mobile-only CSS override targets, on top of the unchanged Desktop percentage - same 4 columns, not a different DOM shape', () => {
    const { container } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    const cols = container.querySelectorAll('table.pq-commercial-table colgroup col');
    expect(cols.length).toBe(4);
    expect(cols[0].className).toBe('pq-col-desc');
    expect(cols[1].className).toBe('pq-col-qty');
    expect(cols[2].className).toBe('pq-col-price');
    expect(cols[3].className).toBe('pq-col-total');
    // Desktop/Tablet contract (>640px) is untouched - still 40/18/21/21.
    expect(Array.from(cols).map((c) => c.style.width)).toEqual(['40%', '18%', '21%', '21%']);
  });

  it('the embedded Mobile stylesheet declares a colgroup width override for all 4 column classes and tighter cell padding, and no longer contains the rejected stacked-card rules', () => {
    const { container } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([flatItem])} /></MemoryRouter>);
    const css = container.querySelector('style').textContent;
    expect(css).toMatch(/\.pq-col-desc\s*\{\s*width:\s*40%\s*!important/);
    expect(css).toMatch(/\.pq-col-qty\s*\{/);
    expect(css).toMatch(/\.pq-col-price\s*\{/);
    expect(css).toMatch(/\.pq-col-total\s*\{/);
    expect(css).toMatch(/\.pq-commercial-table th,\s*\n\s*\.pq-commercial-table td\s*\{\s*\n\s*padding: 8px 4px !important;/);
    // The rejected stacked-card technique must be gone entirely, not just overridden.
    expect(css).not.toMatch(/\.pq-commercial-table thead\s*\{\s*display:\s*none/);
    expect(css).not.toMatch(/::before/);
  });

  it('every money-bearing cell (flat rows, section summary, section items, section subtotal) is protected with white-space:nowrap, so a 7-digit total can never wrap mid-number', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    const collapsedTotalCell = screen.getByText(/Apartment 33 ▼/).closest('tr').querySelectorAll('td')[3];
    expect(collapsedTotalCell.style.whiteSpace).toBe('nowrap');

    fireEvent.click(screen.getByText(/Apartment 33 ▼/));
    const itemRow = screen.getByText('Windows - apartment 33').closest('tr');
    const itemCells = itemRow.querySelectorAll('td');
    expect(itemCells[2].style.whiteSpace).toBe('nowrap'); // Unit Price
    expect(itemCells[3].style.whiteSpace).toBe('nowrap'); // Total
  });

  it('a 7-digit section total (₪1,250,000.00) still renders as one complete, correctly-formatted string inside the real Total column, exactly where Desktop shows it', () => {
    const bigItem = { description: 'Full renovation package', quantity: 1, price: 1250000, total_price: 1250000, section_id: 'sec1' };
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([bigItem], { sections: [{ id: 'sec1', name: 'Whole House' }] })} /></MemoryRouter>);
    const row = screen.getByText(/Whole House ▼/).closest('tr');
    const cells = row.querySelectorAll('td');
    expect(cells[3]).toHaveTextContent('₪1,250,000.00');
    expect(cells[3].style.whiteSpace).toBe('nowrap');
  });

  it('no inline min-width is set anywhere on the commercial table or its wrapper that would force Desktop-width geometry on Mobile', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const { container } = render(<MemoryRouter><PublicQuote quoteData={buildQuoteData([apt33], { sections: [{ id: 'sec1', name: 'Apartment 33' }] })} /></MemoryRouter>);
    const table = container.querySelector('table.pq-commercial-table');
    expect(table.style.minWidth).toBe('');
    expect(table.parentElement.style.minWidth).toBe('');
  });
});

describe('PublicQuoteEn - Mobile 4-column geometry correction', () => {
  it('no data-label attribute anywhere - same real 4-column table structure as Desktop', () => {
    const apt33 = { ...measuredItem, section_id: 'sec1' };
    const { container } = render(<PublicQuoteEn quoteData={buildQuoteData([apt33], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Apartment 33' }] })} />);
    expect(container.querySelectorAll('[data-label]').length).toBe(0);
  });

  it('each <col> carries the Mobile class hook on top of the unchanged Desktop percentage', () => {
    const { container } = render(<PublicQuoteEn quoteData={buildQuoteData([flatItem], { quote: { currency: 'USD' } })} />);
    const cols = container.querySelectorAll('table.pq-commercial-table colgroup col');
    expect(Array.from(cols).map((c) => c.className)).toEqual(['pq-col-desc', 'pq-col-qty', 'pq-col-price', 'pq-col-total']);
    expect(Array.from(cols).map((c) => c.style.width)).toEqual(['40%', '18%', '21%', '21%']);
  });

  it('the embedded Mobile stylesheet declares the colgroup override and no longer contains the rejected stacked-card rules', () => {
    const { container } = render(<PublicQuoteEn quoteData={buildQuoteData([flatItem], { quote: { currency: 'USD' } })} />);
    const css = container.querySelector('style').textContent;
    expect(css).toMatch(/\.pq-col-total\s*\{\s*width:\s*27%\s*!important/);
    expect(css).not.toMatch(/::before/);
  });

  it('a 7-digit section total still renders as one complete string in the Total column, protected with white-space:nowrap', () => {
    const bigItem = { description: 'Full renovation package', quantity: 1, price: 1250000, total_price: 1250000, section_id: 'sec1' };
    render(<PublicQuoteEn quoteData={buildQuoteData([bigItem], { quote: { currency: 'USD' }, sections: [{ id: 'sec1', name: 'Whole House' }] })} />);
    const row = screen.getByText(/Whole House ▼/).closest('tr');
    const cells = row.querySelectorAll('td');
    expect(cells[3]).toHaveTextContent('$1,250,000.00');
    expect(cells[3].style.whiteSpace).toBe('nowrap');
  });
});
