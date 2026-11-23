// Owner console 2026-11-03 (typed: "מאשר הפעלת ארבעת הסוכנים ובניית הצעה מקובץ לפי האפיון וששת ההחלטות שלי, כולל שינוי ב-L-05, L-06,
// L-09, L-12, L-14, L-15, L-17, L-22, L-23, L-24, L-25, L-27 ו-L-28, שחרור עד הלייב"): the browser side of "quote from a file".
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuoteFromFileDialog from './components/QuoteFromFileDialog';
import NewQuoteMenu from './components/NewQuoteMenu';
import { menuChoices } from './utils/newQuoteChoices';
import { catalogPriceFor, checkPickedFile, compareTotals, fileTypeOf, MAX_FILE_BYTES, parseOwnPrice } from './utils/quoteFromFileClient';

const pdf = (size = 1000, name = 'quote.pdf', type = 'application/pdf') => { const f = new File([new Uint8Array(4)], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f; };
const READ = { status: 'ok', currency: 'ILS', documentTotal: 3200, allowance: { limit: 50, remaining: 47, period: '2026-11' }, lines: [
  { description: 'ריצוף חדש', quantity: 12, unit: 'm2', unitPrice: 111, lineTotal: 1332 },
  { description: 'פינוי פסולת', quantity: 1, unit: null, unitPrice: 200, lineTotal: 200 },
] };

function open(over = {}) {
  const onApply = vi.fn();
  const readFile = vi.fn(async () => READ);
  render(<QuoteFromFileDialog isOpen isHebrew sym="₪" formatMoneyDisplay={(v) => Number(v).toFixed(2)} currency="ILS"
    catalog={[{ id: 7, name: 'פינוי  פסולת', price: 222 }, { id: 8, name: 'ריצוף', price: 999 }]} readFile={readFile} readAllowance={async () => READ.allowance}
    onClose={vi.fn()} onApply={onApply} {...over} />);
  return { onApply, readFile };
}
async function toReview() {
  const r = open();
  fireEvent.change(screen.getByTestId('quote-from-file-input'), { target: { files: [pdf()] } });
  fireEvent.click(screen.getByTestId('quote-from-file-read'));
  await waitFor(() => expect(screen.getByTestId('quote-from-file-lines')).toBeTruthy());
  return r;
}

describe('the menu: a fifth choice right after the AI smart quote (Owner decision 2)', () => {
  it('order with the file and template choices', () => {
    // Owner console 2026-11-08 (design A + stage 2 of the one quote builder, typed incl. L-09 / L-23): the regular and the measured entries are ONE "הצעת מחיר"
    expect(menuChoices(true, { file: true, template: true }).map((c) => c.id)).toEqual(['standard', 'ai', 'file', 'template']);
    // 2026-11-12 (unified quote, spec 1 row 2): the start window's four ways
    expect(menuChoices(false, { file: true }).map((c) => c.label)).toEqual(['Fill it in yourselves', 'Describe it to AI', 'Upload a file']);
    expect(menuChoices(true).map((c) => c.id)).toEqual(['standard', 'ai']);
  });
  it('clicking it calls the file handler (never the blank-quote one)', () => {
    const onFile = vi.fn(); const onStandard = vi.fn();
    render(<NewQuoteMenu isHebrew onStandard={onStandard} onAi={vi.fn()} onStructured={vi.fn()} onFile={onFile} />);
    fireEvent.click(screen.getByRole('button', { name: /הצעה חדשה|הצעת מחיר חדשה/ }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('data-choice'))).toEqual(['standard', 'ai', 'file']);
    fireEvent.click(items[2]);
    expect(onFile).toHaveBeenCalledTimes(1); expect(onStandard).not.toHaveBeenCalled();
  });
});

describe('the picked file: only PDF or JPG, up to 8 MB (Owner decision 3)', () => {
  it('types and size', () => {
    expect(fileTypeOf(pdf())).toBe('application/pdf');
    expect(fileTypeOf(pdf(10, 'a.jpg', 'image/jpeg'))).toBe('image/jpeg');
    expect(checkPickedFile(pdf(10, 'a.png', 'image/png'))).toBe('unsupported_type');
    expect(checkPickedFile(pdf(10, 'a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe('unsupported_type');
    expect(checkPickedFile(pdf(10, 'a.heic', 'image/heic'))).toBe('unsupported_type');
    expect(checkPickedFile(pdf(MAX_FILE_BYTES))).toBeNull();
    expect(checkPickedFile(pdf(MAX_FILE_BYTES + 1))).toBe('too_large');
  });
  it('a PNG is refused on the spot with the plain message; nothing is sent', () => {
    const { readFile } = open();
    fireEvent.change(screen.getByTestId('quote-from-file-input'), { target: { files: [pdf(10, 'a.png', 'image/png')] } });
    expect(screen.getByTestId('quote-from-file-error').textContent).toBe('אפשר להעלות רק קובץ PDF או JPG.');
    expect(screen.getByTestId('quote-from-file-read').disabled).toBe(true);
    expect(readFile).not.toHaveBeenCalled();
  });
  it('the small print says the file is not kept here and the provider keeps a copy for a limited time (Owner decision 6)', () => {
    open();
    const small = screen.getByTestId('quote-from-file-small-print').textContent;
    expect(small).toMatch(/אצלנו הקובץ לא נשמר ולא מצורף להצעה/);
    expect(small).toMatch(/הספק שומר עותק לזמן מוגבל/);
  });
});

describe('the review: two prices per line, totals and the gap', () => {
  it('each line shows the document price (read-only) and "your price" (catalog only on an exact name match)', async () => {
    await toReview();
    const lines = screen.getAllByTestId('quote-from-file-line');
    expect(lines).toHaveLength(2);
    expect(lines[0].querySelector('[data-testid="quote-from-file-doc-price"]').textContent).toContain('₪111.00');
    expect(lines[0].querySelector('[data-field="own"]').value).toBe('');          // "ריצוף" is not "ריצוף חדש": no guess
    expect(lines[1].querySelector('[data-field="own"]').value).toBe('222');       // exact name (spacing aside) -> the catalog price
    expect(lines[0].querySelector('[data-testid="quote-from-file-doc-price"] input')).toBeNull();
  });
  it('the empty-price block: "יש למלא מחיר", the focus jumps to the field, nothing is added (Owner decision 1)', async () => {
    const { onApply } = await toReview();
    fireEvent.click(screen.getByTestId('quote-from-file-add'));
    expect(screen.getByTestId('quote-from-file-blocked').textContent).toBe('יש למלא מחיר');
    expect(document.activeElement).toBe(screen.getAllByTestId('quote-from-file-line')[0].querySelector('[data-field="own"]'));
    expect(onApply).not.toHaveBeenCalled();
  });
  it('an unticked empty line does not block; "0" is a valid price', async () => {
    const { onApply } = await toReview();
    const [first] = screen.getAllByTestId('quote-from-file-line');
    fireEvent.change(first.querySelector('[data-field="own"]'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('quote-from-file-add'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
  it('only the owner\'s lines and prices leave the dialog - never the document price (the 111 sentinel)', async () => {
    const { onApply } = await toReview();
    const [first] = screen.getAllByTestId('quote-from-file-line');
    fireEvent.change(first.querySelector('[data-field="own"]'), { target: { value: '333' } });
    fireEvent.click(screen.getByTestId('quote-from-file-add'));
    const lines = onApply.mock.calls[0][0];
    expect(lines).toEqual([
      { description: 'ריצוף חדש', quantity: 12, unit: 'm2', unitPrice: 333, catalogId: null },
      { description: 'פינוי פסולת', quantity: 1, unit: null, unitPrice: 222, catalogId: 7 },
    ]);
    expect(JSON.stringify(lines)).not.toMatch(/111|1332|docUnitPrice|lineTotal|currency/);
  });
  it('totals and the gap: one decimal, cheaper / dearer', () => {
    expect(compareTotals([{ quantity: 2, docUnitPrice: 50, ownPrice: 45 }], { sameCurrency: true })).toEqual({ docTotal: 100, ownTotal: 90, gapPercent: -10 });
    expect(compareTotals([{ quantity: 3, docUnitPrice: 100, ownPrice: 105 }], { sameCurrency: true }).gapPercent).toBe(5);
    expect(compareTotals([{ quantity: 1, docLineTotal: 200, docUnitPrice: null, ownPrice: 190 }], { sameCurrency: true }).gapPercent).toBe(-5);
  });
  it('another currency or a missing document price -> no percentage (never a misleading gap)', () => {
    expect(compareTotals([{ quantity: 1, docUnitPrice: 100, ownPrice: 90 }], { sameCurrency: false }).gapPercent).toBeNull();
    expect(compareTotals([{ quantity: 1, docUnitPrice: null, docLineTotal: null, ownPrice: 90 }], { sameCurrency: true })).toEqual({ docTotal: null, ownTotal: 90, gapPercent: null });
  });
  it('the review shows the gap of the ticked lines', async () => {
    await toReview();
    const [first] = screen.getAllByTestId('quote-from-file-line');
    fireEvent.change(first.querySelector('[data-field="own"]'), { target: { value: '100' } });
    // document: 12 x 111 + 1 x 200 = 1532; yours: 12 x 100 + 222 = 1422 -> 7.2% lower
    expect(screen.getByTestId('quote-from-file-gap').textContent).toContain('ההצעה שלכם זולה ב-7.2%');
  });
});

describe('helpers', () => {
  it('own price parsing', () => {
    expect(parseOwnPrice('')).toBeNull(); expect(parseOwnPrice('abc')).toBeNull(); expect(parseOwnPrice('-5')).toBeNull();
    expect(parseOwnPrice('0')).toBe(0); expect(parseOwnPrice('1,250.5')).toBe(1250.5);
  });
  it('catalog: exact name only', () => {
    expect(catalogPriceFor('ריצוף חדש', [{ id: 1, name: 'ריצוף', price: 5 }])).toBeNull();
    expect(catalogPriceFor('Tile - new', [{ id: 1, name: 'tile new', price: 5 }])).toEqual({ catalogId: 1, price: 5 });
  });
});
