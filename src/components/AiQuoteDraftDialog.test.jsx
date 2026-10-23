// Task 21: the "AI smart quote" dialog - describe -> reviewable draft -> explicit apply; honest not-deployed state; nothing saved here.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiQuoteDraftDialog from './AiQuoteDraftDialog';

const L = (o) => ({ quantity: null, unit: null, quantityBasis: 'stated', derivation: null, missing: null, unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none', ...o });
const DRAFT = { status: 'ok', subject: 'סלון', questions: [], unassignedMeasures: [], items: [
  L({ description: 'חלון אלומיניום', quantity: 3, unit: 'unit', unitPrice: 1450, catalogId: 7, catalogName: 'חלון אלומיניום', priceSource: 'catalog' }),
  L({ description: 'פירוק חלון ישן', quantity: 3, unit: 'unit' }),
] };
// Task 33: the Owner example as the v2 server returns it (40 / 22 m² kept, the dismantling area missing, one clarification question)
const OWNER_DRAFT = { status: 'ok', subject: 'ריצוף', questions: ['מה שטח הריצוף לפירוק?'], unassignedMeasures: [], items: [
  L({ description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', unitPrice: 120, catalogId: 1, catalogName: 'ריצוף למ״ר', priceSource: 'catalog' }),
  L({ description: 'ריצוף חדר ילדים', quantity: 22, unit: 'm2', catalogName: 'ריצוף', priceSource: 'catalog_unit_unverified' }),
  L({ description: 'פירוק ריצוף קיים', unit: 'm2', quantityBasis: 'missing', missing: 'quantity' }),
] };
const props = (over = {}) => ({ isOpen: true, isHebrew: true, sym: '₪', formatMoneyDisplay: (n) => Number(n).toFixed(2), onClose: vi.fn(), onApply: vi.fn(), onOpenChat: vi.fn(), requestDraft: vi.fn(async () => DRAFT), ...over });
const describeJob = (text = 'החלפת 3 חלונות בסלון') => fireEvent.change(screen.getByLabelText('מה העבודה?'), { target: { value: text } });

describe('AiQuoteDraftDialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<AiQuoteDraftDialog {...props({ isOpen: false })} />);
    expect(container.innerHTML).toBe('');
  });

  it('asks for a description first and never calls the server for a too-short one', () => {
    const p = props();
    render(<AiQuoteDraftDialog {...p} />);
    expect(screen.getByRole('dialog', { name: 'הצעת מחיר חכמה עם AI' })).toBeTruthy();
    describeJob('abc');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    expect(p.requestDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('לפחות');
  });

  it('shows the draft for review: catalog price vs "enter a price"; unticked lines are not applied; apply is explicit', async () => {
    const p = props();
    render(<AiQuoteDraftDialog {...p} />);
    describeJob();
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getByText('טיוטה מוצעת — בדקו לפני שמוסיפים')).toBeTruthy());
    expect(p.requestDraft).toHaveBeenCalledWith('החלפת 3 חלונות בסלון');
    expect(screen.getByText('₪1450.00')).toBeTruthy();
    expect(screen.getByText('יש להזין מחיר — לא נמצא פריט תואם בקטלוג')).toBeTruthy();
    expect(screen.getByTestId('ai-quote-draft-source').textContent).toContain('החלפת 3 חלונות בסלון');
    expect(screen.getByText(/שום דבר לא נשמר עד שתשמרו את ההצעה/)).toBeTruthy();
    expect(p.onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'פירוק חלון ישן' }));
    fireEvent.click(screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 1\)/ }));
    expect(p.onApply).toHaveBeenCalledWith([{ description: 'חלון אלומיניום', quantity: 3, unit: 'unit', unitPrice: 1450, catalogId: 7 }], 'סלון');
  });

  it('Owner example: shows quantity, unit, price source and what is missing; a missing quantity blocks adding until the user fills it', async () => {
    const p = props({ requestDraft: vi.fn(async () => OWNER_DRAFT) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob('ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר, פירוק ריצוף קיים');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(3));
    const qty = screen.getAllByRole('textbox', { name: 'כמות' });
    expect(qty.map((q) => q.value)).toEqual(['40', '22', '']);
    expect(screen.getAllByRole('combobox', { name: 'יחידה' }).map((u) => u.value)).toEqual(['m2', 'm2', 'm2']);
    expect(screen.getAllByTestId('ai-quote-draft-price')[0].textContent).toBe('מחיר: ₪120.00 · מהקטלוג: ריצוף למ״ר');
    expect(screen.getByText(/הפריט ״ריצוף״ נמצא בקטלוג, אבל לא ברור אם יחידת התמחור שלו תואמת/)).toBeTruthy();
    expect(screen.getByTestId('ai-quote-draft-missing').textContent).toBe('חסר: כמות');
    expect(screen.getByTestId('ai-quote-draft-questions').textContent).toContain('מה שטח הריצוף לפירוק?');
    const add = screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 3\)/ });
    expect(add.disabled).toBe(true);
    expect(screen.getByTestId('ai-quote-draft-need-quantity')).toBeTruthy();
    fireEvent.change(qty[2], { target: { value: '62,5' } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    fireEvent.click(add); // a double click never adds the lines twice
    expect(p.onApply).toHaveBeenCalledTimes(1);
    expect(p.onApply.mock.calls[0][0]).toEqual([
      { description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', unitPrice: 120, catalogId: 1 },
      { description: 'ריצוף חדר ילדים', quantity: 22, unit: 'm2', unitPrice: null, catalogId: null },
      { description: 'פירוק ריצוף קיים', quantity: 62.5, unit: 'm2', unitPrice: null, catalogId: null },
    ]);
  });

  it('editing: a changed unit drops the catalog price (verified only for the server unit); unticking a missing line also unblocks', async () => {
    const p = props({ requestDraft: vi.fn(async () => OWNER_DRAFT) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob('ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר, פירוק ריצוף קיים');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(3));
    fireEvent.change(screen.getAllByRole('combobox', { name: 'יחידה' })[0], { target: { value: 'unit' } });
    expect(screen.queryByText('₪120.00')).toBeNull();
    fireEvent.change(screen.getAllByRole('textbox', { name: 'תיאור הפריט' })[0], { target: { value: 'ריצוף חדר שינה' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'פירוק ריצוף קיים' }));
    fireEvent.click(screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 2\)/ }));
    expect(p.onApply.mock.calls[0][0][0]).toEqual({ description: 'ריצוף חדר שינה', quantity: 40, unit: 'unit', unitPrice: null, catalogId: null });
  });

  // Task 34: every line shows the part of the user's text it comes from; an unverifiable quantity arrives empty with an explicit note
  it('shows each line evidence and the "could not verify" note; the user must enter that quantity', async () => {
    const p = props({ requestDraft: vi.fn(async () => ({ status: 'ok', subject: '', questions: [], unassignedMeasures: ['22 מ״ר'], items: [
      L({ description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', evidence: 'ריצוף חדר הורים 40 מ״ר' }),
      L({ description: 'ריצוף חדר ילדים', unit: 'm2', quantityBasis: 'missing', missing: 'unverified', evidence: 'ריצוף חדר ילדים 22 מ״ר' }),
    ] })) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob('ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(2));
    expect(screen.getAllByTestId('ai-quote-draft-evidence').map((e) => e.textContent)).toEqual(['מהתיאור: „ריצוף חדר הורים 40 מ״ר”', 'מהתיאור: „ריצוף חדר ילדים 22 מ״ר”']);
    expect(screen.getByTestId('ai-quote-draft-missing').textContent).toContain('לא הצלחנו לאמת מול התיאור');
    expect(screen.getByTestId('ai-quote-draft-unassigned').textContent).toContain('22 מ״ר');
    expect(screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 2\)/ }).disabled).toBe(true);
  });
  // Night task 2026-10-22: English uses English quotation marks (never the Hebrew low mark „)
  it('English: the evidence is quoted with “ ”', async () => {
    const p = props({ isHebrew: false, sym: '$', requestDraft: vi.fn(async () => ({ status: 'ok', subject: '', questions: [], unassignedMeasures: [], items: [
      L({ description: 'Tile the master bedroom', quantity: 40, unit: 'm2', evidence: 'tile the master bedroom 40 m2' }),
    ] })) });
    render(<AiQuoteDraftDialog {...p} />);
    fireEvent.change(screen.getByLabelText('What is the job?'), { target: { value: 'tile the master bedroom 40 m2' } });
    fireEvent.click(screen.getByRole('button', { name: /Create with AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-evidence')).toHaveLength(1));
    expect(screen.getByTestId('ai-quote-draft-evidence').textContent).toBe('From your description: “tile the master bedroom 40 m2”');
  });
  // Task 35 (F1): a quantity the text could give to several jobs arrives empty with its own "ambiguous" note, never the raw code
  it('shows the "ambiguous" note for a line whose quantity could not be singled out', async () => {
    const p = props({ requestDraft: vi.fn(async () => ({ status: 'ok', subject: '', questions: [], unassignedMeasures: [], items: [
      L({ description: 'ריצוף', unit: 'm2', quantityBasis: 'missing', missing: 'ambiguous', evidence: 'ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר' }),
    ] })) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob('ריצוף חדר הורים 40 מ״ר, ריצוף חדר ילדים 22 מ״ר');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(1));
    expect(screen.getByTestId('ai-quote-draft-missing').textContent).toContain('כמה כמויות שיכולות להתאים');
    expect(screen.getByTestId('ai-quote-draft-missing').textContent).not.toContain('ambiguous');
  });

  // Task 34 extension (Owner AI specification, section ד): quantity AND unit of a missing line are decided together; the blocker names the
  // exact line and can move the focus there; "different description" never discards edits silently.
  it('a missing line with an unknown unit needs an explicit unit choice too ("no unit" included); the blocker names it and focuses the field', async () => {
    const p = props({ requestDraft: vi.fn(async () => ({ status: 'ok', subject: '', questions: [], unassignedMeasures: [], items: [
      L({ description: 'ריצוף חדר הורים', quantity: 36, unit: 'm2' }),
      L({ description: 'פירוק ריצוף קיים', quantityBasis: 'missing', missing: 'השטח במ״ר' }),
    ] })) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob('ריצוף חדר הורים 36 מ״ר, פירוק ריצוף קיים');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(2));
    const units = screen.getAllByRole('combobox', { name: 'יחידה' });
    expect(units[1].value).toBe('__choose');
    expect(screen.getByTestId('ai-quote-draft-need-quantity').textContent).toContain('„פירוק ריצוף קיים”');
    fireEvent.click(screen.getByTestId('ai-quote-draft-goto-field'));
    expect(document.activeElement).toBe(screen.getAllByRole('textbox', { name: 'כמות' })[1]);
    fireEvent.change(screen.getAllByRole('textbox', { name: 'כמות' })[1], { target: { value: '56' } });
    const add = screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 2\)/ });
    expect(add.disabled).toBe(true); // quantity alone is not enough while the unit is undecided
    fireEvent.click(screen.getByTestId('ai-quote-draft-goto-field'));
    expect(document.activeElement).toBe(units[1]);
    fireEvent.change(units[1], { target: { value: 'm2' } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(p.onApply.mock.calls[0][0][1]).toEqual({ description: 'פירוק ריצוף קיים', quantity: 56, unit: 'm2', unitPrice: null, catalogId: null });
  });

  it('"no unit" is a valid explicit choice; unticking the incomplete line also unblocks the others', async () => {
    const p = props({ requestDraft: vi.fn(async () => ({ status: 'ok', subject: '', questions: [], unassignedMeasures: [], items: [
      L({ description: 'התקנת מזגן', quantity: 1, unit: 'unit', quantityBasis: 'implied_single' }),
      L({ description: 'פירוק', quantityBasis: 'missing', missing: 'quantity' }),
    ] })) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob('התקנת מזגן ופירוק');
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(2));
    fireEvent.click(screen.getByRole('checkbox', { name: 'פירוק' }));
    expect(screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 1\)/ }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'פירוק' }));
    fireEvent.change(screen.getAllByRole('textbox', { name: 'כמות' })[1], { target: { value: '3' } });
    fireEvent.change(screen.getAllByRole('combobox', { name: 'יחידה' })[1], { target: { value: '' } });
    expect(screen.getByRole('button', { name: /הוספה להצעה \(פריטים מסומנים: 2\)/ }).disabled).toBe(false);
  });

  it('"different description" after edits asks first; "stay" keeps the edited draft, "yes" returns to the kept description', async () => {
    const p = props();
    render(<AiQuoteDraftDialog {...p} />);
    describeJob();
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(2));
    fireEvent.change(screen.getAllByRole('textbox', { name: 'כמות' })[0], { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'תיאור אחר' }));
    expect(screen.getByTestId('ai-quote-draft-again-confirm')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'להישאר בטיוטה' }));
    expect(screen.getAllByRole('textbox', { name: 'כמות' })[0].value).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: 'תיאור אחר' }));
    fireEvent.click(screen.getByRole('button', { name: 'כן, לתיאור חדש' }));
    expect(screen.getByLabelText('מה העבודה?').value).toBe('החלפת 3 חלונות בסלון');
  });

  it('"different description" returns to the text the user wrote (kept) and a new draft replaces the old one', async () => {
    const p = props();
    render(<AiQuoteDraftDialog {...p} />);
    describeJob();
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'תיאור אחר' }));
    expect(screen.getByLabelText('מה העבודה?').value).toBe('החלפת 3 חלונות בסלון');
    expect(screen.queryAllByTestId('ai-quote-draft-line')).toHaveLength(0);
  });

  it('says plainly when drafting is not deployed on this server and offers manual entry / the AI chat', async () => {
    const p = props({ requestDraft: vi.fn(async () => ({ status: 'not_deployed' })) });
    render(<AiQuoteDraftDialog {...p} />);
    describeJob();
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('עדיין לא מותקן בשרת הזה'));
    expect(p.onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'שאלו את צ׳אט ה-AI' }));
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onOpenChat).toHaveBeenCalled();
  });

  // Task 22: a fetch-level failure while the server answers is the SERVICE, never presented as a broken connection
  it.each([
    ['service_unreachable', 'ייתכן שהוא עמוס', true],
    ['unavailable', 'בדקו את החיבור לאינטרנט', true],
    ['offline', 'אין חיבור לאינטרנט', false],
    ['server_error', 'נתקל בשגיאה בשרת', true],
    // Owner 2026-10-23 (item 10): a busy server is never "not installed"; a cut answer after a long description says so
    ['too_long', 'התיאור ארוך מדי', false],
  ])('status %s shows its own message (chat fallback: %s)', async (status, text, chat) => {
    render(<AiQuoteDraftDialog {...props({ requestDraft: vi.fn(async () => ({ status })) })} />);
    describeJob();
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(text));
    expect(screen.getByRole('button', { name: 'מילוי ידני' })).toBeTruthy();
    expect(!!screen.queryByRole('button', { name: 'שאלו את צ׳אט ה-AI' })).toBe(chat);
  });

  it('English copy and LTR direction', async () => {
    render(<AiQuoteDraftDialog {...props({ isHebrew: false, sym: '$', requestDraft: vi.fn(async () => ({ status: 'provider' })) })} />);
    const dialog = screen.getByRole('dialog', { name: 'AI smart quote' });
    expect(dialog.getAttribute('dir')).toBe('ltr');
    fireEvent.change(screen.getByLabelText('What is the job?'), { target: { value: 'Replace three windows' } });
    fireEvent.click(screen.getByRole('button', { name: /Create with AI/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('did not return a draft'));
  });
});
