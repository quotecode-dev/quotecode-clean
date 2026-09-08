import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddItemWizard from './AddItemWizard';

// Owner-Approved Smart Quote UX, Stage 2: focused regression coverage for
// the new guided item-entry wizard. This component never touches Dashboard
// state itself (getActiveQuantity/calculation utilities are the canonical,
// already-tested source - see professionalQuoteItem.test.js) - these tests
// verify the wizard's own step flow, validation, and the exact item-object
// shape it hands to onAdd (which the coordinator manually live-verified
// round-trips correctly through the existing item-editing UI).

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onAdd: vi.fn(),
  isHebrew: false,
  sym: '$',
  formatNum: (n) => Number(n).toFixed(2),
  services: [{ id: 1, name: 'Design consultation', price: 150 }],
  sections: [],
  defaultSectionKey: null,
  canUseProfessionalQuotes: true,
  onRequestUpgrade: vi.fn(),
};

function setValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  fireEvent.input(el, { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddItemWizard - entry method selection', () => {
  it('renders all three entry methods on step 1', () => {
    render(<AddItemWizard {...baseProps} />);
    expect(screen.getByText('By units')).toBeTruthy();
    expect(screen.getByText('By area or length')).toBeTruthy();
    expect(screen.getByText('From my catalog')).toBeTruthy();
  });

  it('calls onRequestUpgrade and does not advance when the area/length method is locked', () => {
    render(<AddItemWizard {...baseProps} canUseProfessionalQuotes={false} />);
    fireEvent.click(screen.getByText('By area or length'));
    expect(baseProps.onRequestUpgrade).toHaveBeenCalledTimes(1);
    // Next remains disabled since no method was actually selected.
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
  });
});

describe('AddItemWizard - simple "by units" flow', () => {
  it('walks through all 4 steps and produces the correct item shape (quantity x price)', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);

    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));

    setValue(document.getElementById('wiz-description'), 'Consulting hours');
    fireEvent.click(screen.getByText('Next'));

    setValue(document.getElementById('wiz-quantity'), '5');
    setValue(document.getElementById('wiz-unit-price'), '50');
    fireEvent.click(screen.getByText('Next'));

    // Review step shows the correct computed total (5 x 50 = 250), not a
    // second independent calculator - just quantity * unit_price.
    expect(screen.getByText('$250.00')).toBeTruthy();

    fireEvent.click(screen.getByText('Add item'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const item = onAdd.mock.calls[0][0];
    expect(item.description).toBe('Consulting hours');
    expect(item.quantity).toBe('5');
    expect(item.unit_price).toBe('50');
    expect(item.pricing_unit).toBeUndefined();
  });

  it('shows a plain-language validation message instead of silently blocking on missing quantity', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-quantity'), '0');
    setValue(document.getElementById('wiz-unit-price'), '10');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Please enter a quantity greater than 0')).toBeTruthy();
  });

  it('preserves entered values when navigating Back then Next again', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Kept value');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Back'));
    expect(document.getElementById('wiz-description').value).toBe('Kept value');
  });
});

describe('AddItemWizard - measured (area/linear) flow', () => {
  it('computes area (width x height) using the canonical helper, not a second calculator, and stores meters while displaying cm', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));

    setValue(document.getElementById('wiz-width'), '300');
    setValue(document.getElementById('wiz-height'), '200');
    expect(screen.getByText('300 × 200 cm = 6.00 m²')).toBeTruthy();
    setValue(document.getElementById('wiz-unit-price-m'), '200');
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('$1200.00')).toBeTruthy();
    fireEvent.click(screen.getByText('Add item'));

    const item = onAdd.mock.calls[0][0];
    expect(item.pricing_unit).toBe('m2');
    expect(item.calculation_method).toBe('area');
    expect(item.quantity_source).toBe('calculated');
    expect(item.calculated_quantity).toBe(6);
    // Storage stays in meters (existing metre-based contract), the cm labels are a UI-only concern.
    expect(item.measurements[0].width).toBe(3);
    expect(item.measurements[0].height).toBe(2);
    expect(item.measurements[0].is_pricing_driving).toBe(true);
  });

  it('switches to linear length and computes using width only, height field hidden', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Railing');
    fireEvent.click(screen.getByText('Next'));

    fireEvent.click(screen.getByText('Length'));
    expect(document.getElementById('wiz-height')).toBeNull();
    setValue(document.getElementById('wiz-width'), '500');
    expect(screen.getByText('500 cm = 5.00 linear meters')).toBeTruthy();
    setValue(document.getElementById('wiz-unit-price-m'), '40');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add item'));

    const item = onAdd.mock.calls[0][0];
    expect(item.pricing_unit).toBe('linear_meter');
    expect(item.calculation_method).toBe('linear');
    expect(item.calculated_quantity).toBe(5);
  });

  it('explains exactly what dimension is missing instead of a silent/disabled result', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '300');
    setValue(document.getElementById('wiz-unit-price-m'), '10');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Please enter a height greater than 0/)).toBeTruthy();
  });
});

describe('AddItemWizard - catalog flow', () => {
  it('pre-fills description and price from the selected catalog service', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('From my catalog'));
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(document.getElementById('wiz-catalog-select'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Add item'));

    const item = onAdd.mock.calls[0][0];
    expect(item.description).toBe('Design consultation');
    expect(item.unit_price).toBe(150);
    expect(item.isFromCatalog).toBe(true);
  });

  it('requires a catalog selection before allowing add', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('From my catalog'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add item'));
    expect(screen.getByText('Please choose a catalog item')).toBeTruthy();
    expect(baseProps.onAdd).not.toHaveBeenCalled();
  });

  it('shows the real catalog price as the live total once a catalog item is selected on the Review step (regression: previously showed $0.00)', () => {
    // Real bug found live with a genuinely non-empty TEST catalog: the
    // catalog <select> lives inside the REVIEW step itself (there is no
    // separate DESCRIBE/QUANTIFY step for catalog items) - its onChange
    // only ever updated catalogServiceId, never unitPrice, so the live
    // total shown during review stayed frozen at $0.00 even though the
    // item actually added afterward got the correct price (handleConfirm
    // independently re-looks-up the service). This only reproduces via the
    // exact real-world sequence: select the method, advance to Review,
    // THEN choose from the dropdown - not by pre-selecting before Next.
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('From my catalog'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.queryByText('$0.00')).toBeNull();
    fireEvent.change(document.getElementById('wiz-catalog-select'), { target: { value: '1' } });
    expect(screen.getByText('$150.00')).toBeTruthy();
    expect(screen.queryByText('$0.00')).toBeNull();
  });
});

describe('AddItemWizard - optional specifications never affect price', () => {
  it('adding specification rows does not change the computed total or the item price fields', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Item with spec');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-quantity'), '2');
    setValue(document.getElementById('wiz-unit-price'), '30');
    fireEvent.click(screen.getByText('Next'));

    fireEvent.click(screen.getByText('Details shown to the customer — do not affect price'));
    fireEvent.click(screen.getByText('+ Add detail row'));
    setValue(screen.getByLabelText('Label'), 'Color');
    setValue(screen.getByLabelText('Value'), 'Anthracite grey');

    expect(screen.getByText('$60.00')).toBeTruthy(); // still 2 x 30, unaffected by the spec row
    fireEvent.click(screen.getByText('Add item'));

    const item = onAdd.mock.calls[0][0];
    expect(item.unit_price).toBe('30');
    expect(item.specification).toEqual([{ label: 'Color', value: 'Anthracite grey' }]);
  });
});

describe('AddItemWizard - section assignment', () => {
  it('assigns the chosen section_key on the created item, defaulting to null (no section)', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} sections={[{ key: 'sec1', name: 'Kitchen' }]} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-quantity'), '1');
    setValue(document.getElementById('wiz-unit-price'), '10');
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(document.getElementById('wiz-section'), { target: { value: 'sec1' } });
    fireEvent.click(screen.getByText('Add item'));
    expect(onAdd.mock.calls[0][0].section_key).toBe('sec1');
  });

  it('pre-selects defaultSectionKey when opened from a specific section', () => {
    render(<AddItemWizard {...baseProps} sections={[{ key: 'sec1', name: 'Kitchen' }]} defaultSectionKey="sec1" />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-quantity'), '1');
    setValue(document.getElementById('wiz-unit-price'), '10');
    fireEvent.click(screen.getByText('Next'));
    expect(document.getElementById('wiz-section').value).toBe('sec1');
  });
});

// Owner-mandated verification gap ("modal focus entry/containment/return"):
// a real live-browser check found focus stayed on <body> when the wizard
// opened at step 1 (no field to auto-focus there) - a genuine bug, not a
// hypothetical. These lock in the fix.
describe('AddItemWizard - modal focus management', () => {
  it('moves focus into the dialog itself when opened at step 1 (no field exists there to focus)', async () => {
    render(<AddItemWizard {...baseProps} />);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });
  });

  it('moves focus to the first field once a step with an input is reached', async () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById('wiz-description'));
    });
  });

  it('restores focus to the element that had it before the dialog opened, on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(<AddItemWizard {...baseProps} isOpen={false} />);
    rerender(<AddItemWizard {...baseProps} isOpen={true} />);
    rerender(<AddItemWizard {...baseProps} isOpen={false} />);
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

describe('AddItemWizard - Hebrew/RTL', () => {
  it('renders Hebrew labels and RTL direction', () => {
    render(<AddItemWizard {...baseProps} isHebrew={true} sym="₪" />);
    expect(screen.getByRole('dialog').getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('לפי יחידות')).toBeTruthy();
    expect(screen.getByText('לפי שטח או אורך')).toBeTruthy();
  });
});

describe('AddItemWizard - mobile input sizing', () => {
  it('text inputs use a 16px font size (prevents iOS auto-zoom)', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    expect(document.getElementById('wiz-description').style.fontSize).toBe('16px');
  });
});

// Owner Visual Review - Correction 1 ("Make progress understandable"): the
// step indicator must communicate both number and label, and must announce
// itself accessibly (role="progressbar" + aria-valuetext), not just paint
// colored bars.
describe('AddItemWizard - labeled step indicator (Owner Visual Review, Correction 1)', () => {
  it('shows all 4 step labels and marks the current step accessibly', () => {
    render(<AddItemWizard {...baseProps} />);
    expect(screen.getByText('Item type')).toBeTruthy();
    expect(screen.getByText('Item details')).toBeTruthy();
    expect(screen.getByText('Calculation')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuetext')).toContain('Item type');
  });

  it('advances aria-valuenow as the user moves through steps', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By units'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
  });

  it('renders the same accessible progressbar in the narrow (mobile) layout, still naming the current step and total', () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: true, media: query,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {},
    });
    render(<AddItemWizard {...baseProps} />);
    expect(screen.getByText('Item type')).toBeTruthy();
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    window.matchMedia = original;
  });

  it('Hebrew step labels render correctly', () => {
    render(<AddItemWizard {...baseProps} isHebrew={true} sym="₪" />);
    expect(screen.getByText('סוג הפריט')).toBeTruthy();
    expect(screen.getByText('פרטי הפריט')).toBeTruthy();
    expect(screen.getByText('חישוב')).toBeTruthy();
    expect(screen.getByText('סיכום')).toBeTruthy();
  });
});

// Owner Visual Review - Correction 2 ("Clarify the measurement screen"):
// exact wording the Owner required, and the live area/price formula shown
// before Next - not just the dimension-to-area line that already existed.
describe('AddItemWizard - measurement screen wording and live formula (Owner Visual Review, Correction 2)', () => {
  it('uses "Enter the item measurements" instead of "How is it measured?"', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Enter the item measurements')).toBeTruthy();
    expect(screen.queryByText('How is it measured?')).toBeNull();
  });

  it('uses "Price per m²" for area and "Price per metre" for linear', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Price per m²')).toBeTruthy();
    fireEvent.click(screen.getByText('Length'));
    expect(screen.getByText('Price per metre')).toBeTruthy();
  });

  it('Hebrew measurement wording matches the Owner-specified strings exactly', () => {
    render(<AddItemWizard {...baseProps} isHebrew={true} sym="₪" />);
    fireEvent.click(screen.getByText('לפי שטח או אורך'));
    fireEvent.click(screen.getByText('הבא'));
    setValue(document.getElementById('wiz-description'), 'חלון');
    fireEvent.click(screen.getByText('הבא'));
    expect(screen.getByText('הזן את מידות הפריט')).toBeTruthy();
    expect(screen.getByText('מחיר לכל מ"ר')).toBeTruthy();
  });

  it('shows the live full formula (area x price = total) before Next, matching the Owner-specified example', () => {
    render(<AddItemWizard {...baseProps} isHebrew={true} sym="₪" formatNum={(n) => Number(n).toFixed(2)} />);
    fireEvent.click(screen.getByText('לפי שטח או אורך'));
    fireEvent.click(screen.getByText('הבא'));
    setValue(document.getElementById('wiz-description'), 'חלון');
    fireEvent.click(screen.getByText('הבא'));
    setValue(document.getElementById('wiz-width'), '200');
    setValue(document.getElementById('wiz-height'), '180');
    setValue(document.getElementById('wiz-unit-price-m'), '300');
    expect(screen.getByText('200 × 180 ס"מ = 3.60 מ"ר')).toBeTruthy();
    expect(screen.getByText('3.60 מ"ר × ₪300.00 = ₪1080.00')).toBeTruthy();
  });

  it('does not show the pricing formula line before a valid price is entered (the plain dimension-to-area line may still show)', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '200');
    setValue(document.getElementById('wiz-height'), '180');
    expect(screen.getByText('200 × 180 cm = 3.60 m²')).toBeTruthy();
    expect(screen.queryByText(/\$.*×.*=/)).toBeNull();
  });
});

// Owner Visual Review - Correction 3 ("Improve the review screen"): the full
// formula and complete field breakdown, plus direct Edit jumps that preserve
// every entered value (not just Back/Next).
describe('AddItemWizard - review screen full formula, fields, and Edit jumps (Owner Visual Review, Correction 3)', () => {
  function walkToReviewMeasure() {
    render(<AddItemWizard {...baseProps} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '300');
    setValue(document.getElementById('wiz-height'), '200');
    setValue(document.getElementById('wiz-unit-price-m'), '200');
    fireEvent.click(screen.getByText('Next'));
  }

  it('shows the calculation method, dimensions, unit price, final quantity, and the full formula', () => {
    walkToReviewMeasure();
    expect(screen.getByText('By area')).toBeTruthy();
    expect(screen.getByText('300 × 200 cm')).toBeTruthy();
    expect(screen.getByText('$200.00')).toBeTruthy();
    expect(screen.getByText('6.00')).toBeTruthy();
    expect(screen.getByText('6.00 m² × $200.00 = $1200.00')).toBeTruthy();
    // The standalone total must still be present and findable on its own
    // (existing contract other tests already depend on).
    expect(screen.getByText('$1200.00')).toBeTruthy();
  });

  it('"Edit" beside the calculation group jumps to the QUANTIFY step with every value preserved', () => {
    walkToReviewMeasure();
    fireEvent.click(screen.getAllByText('Edit')[1]);
    expect(document.getElementById('wiz-width').value).toBe('300');
    expect(document.getElementById('wiz-height').value).toBe('200');
    expect(document.getElementById('wiz-unit-price-m').value).toBe('200');
  });

  it('"Edit item type" jumps back to CHOOSE_METHOD without losing the already-entered measurement values', () => {
    walkToReviewMeasure();
    fireEvent.click(screen.getByText('Edit item type'));
    expect(screen.getByText('How would you like to add this item?')).toBeTruthy();
    fireEvent.click(screen.getByText('By area or length'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    expect(document.getElementById('wiz-width').value).toBe('300');
  });
});
