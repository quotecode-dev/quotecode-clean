// Owner console 2026-10-19 ("שזה ייושם גם בהצעת AI החכמה"): dictation in the AI smart quote - the description by voice, and the
// draft's clarification questions answered by voice (the answer joins the description and the draft is created again).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import AiQuoteDraftDialog from './AiQuoteDraftDialog';

class FakeRecorder {
  static isTypeSupported(t) { return t === 'audio/webm;codecs=opus'; }
  constructor(stream, opts) { this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)], { type: 'audio/webm' }) }); this.onstop?.(); }
}
const L = (o) => ({ quantity: null, unit: null, quantityBasis: 'stated', derivation: null, missing: null, unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none', evidence: null, ...o });
const QUESTION_DRAFT = { status: 'ok', subject: 'ריצוף', questions: ['מה שטח הריצוף לפירוק?'], unassignedMeasures: [], items: [L({ description: 'פירוק ריצוף קיים', unit: 'm2', quantityBasis: 'missing', missing: 'quantity' })] };
const FULL_DRAFT = { status: 'ok', subject: 'ריצוף', questions: [], unassignedMeasures: [], items: [L({ description: 'פירוק ריצוף קיים', quantity: 30, unit: 'm2' })] };
const props = (over = {}) => ({ isOpen: true, isHebrew: true, sym: '₪', formatMoneyDisplay: (n) => Number(n).toFixed(2), onClose: vi.fn(), onApply: vi.fn(), onOpenChat: vi.fn(), requestDraft: vi.fn(async () => QUESTION_DRAFT), ...over });

beforeEach(() => {
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
});
afterEach(() => { cleanup(); delete window.MediaRecorder; });

const recordOnce = async (testId) => {
  await act(async () => { fireEvent.click(screen.getByTestId(testId)); });
  expect(screen.getByTestId(testId).getAttribute('aria-pressed')).toBe('true');
  await act(async () => { fireEvent.click(screen.getByTestId(testId)); });
};

describe('AI smart quote dictation (Owner 2026-10-19)', () => {
  it('the description is dictated: the microphone sits under the field and the spoken text is added to it (nothing sent yet)', async () => {
    const transcribe = vi.fn(async () => ({ ok: true, text: 'פירוק ריצוף בסלון' }));
    const p = props({ transcribe });
    render(<AiQuoteDraftDialog {...p} />);
    const field = screen.getByLabelText('מה העבודה?');
    const mic = screen.getByTestId('ai-quote-draft-dictate');
    expect(field.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mic.getAttribute('aria-label')).toBe('הכתבה בקול');
    // inside the field's own box: the action row keeps exactly its two buttons (one line, uniform)
    expect(mic.parentElement.contains(field)).toBe(true);
    expect(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }).parentElement.querySelectorAll('button')).toHaveLength(2);
    fireEvent.change(field, { target: { value: 'עבודת ריצוף:' } });
    await recordOnce('ai-quote-draft-dictate');
    await waitFor(() => expect(field.value).toBe('עבודת ריצוף: פירוק ריצוף בסלון'));
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe.mock.calls[0][0].type.startsWith('audio/webm')).toBe(true);
    expect(p.requestDraft).not.toHaveBeenCalled();
  });

  // 2026-11-13 (Owner, the 13/11 spec: never a silent cut): a dictation past the field's limit keeps the start and says so, in both languages
  it('a dictation longer than the field: the first 2,000 characters go in and a message says the end did not fit; typing clears it', async () => {
    const transcribe = vi.fn(async () => ({ ok: true, text: 'א'.repeat(2100) }));
    render(<AiQuoteDraftDialog {...props({ transcribe })} />);
    const field = screen.getByLabelText('מה העבודה?');
    await recordOnce('ai-quote-draft-dictate');
    await waitFor(() => expect(field.value).toHaveLength(2000));
    expect(screen.getByTestId('ai-quote-draft-voice-cut').textContent).toBe('הטקסט ארוך מדי, ולכן נכנסו רק 2,000 התווים הראשונים. הסוף לא נכנס - אפשר לקצר ולהכתיב שוב.');
    fireEvent.change(field, { target: { value: 'קצר יותר' } });
    expect(screen.queryByTestId('ai-quote-draft-voice-cut')).toBeNull();
    cleanup();
    render(<AiQuoteDraftDialog {...props({ isHebrew: false, sym: '$', transcribe: vi.fn(async () => ({ ok: true, text: 'a'.repeat(2100) })) })} />);
    await recordOnce('ai-quote-draft-dictate');
    expect(await screen.findByTestId('ai-quote-draft-voice-cut')).toHaveTextContent('only the first 2,000 characters went in');
  });
  it('a dictation that fits shows no cut message', async () => {
    render(<AiQuoteDraftDialog {...props({ transcribe: vi.fn(async () => ({ ok: true, text: 'פירוק ריצוף' })) })} />);
    await recordOnce('ai-quote-draft-dictate');
    await waitFor(() => expect(screen.getByLabelText('מה העבודה?').value).toBe('פירוק ריצוף'));
    expect(screen.queryByTestId('ai-quote-draft-voice-cut')).toBeNull();
  });

  it('the draft questions are answered by voice: the answer joins the description and the draft is created again', async () => {
    const transcribe = vi.fn(async () => ({ ok: true, text: 'שלושים מטר' }));
    const requestDraft = vi.fn().mockResolvedValueOnce(QUESTION_DRAFT).mockResolvedValueOnce(FULL_DRAFT);
    render(<AiQuoteDraftDialog {...props({ transcribe, requestDraft })} />);
    fireEvent.change(screen.getByLabelText('מה העבודה?'), { target: { value: 'פירוק ריצוף קיים בסלון' } });
    fireEvent.click(screen.getByRole('button', { name: /יצירת טיוטה עם AI/ }));
    await screen.findByTestId('ai-quote-draft-questions');
    expect(screen.getByTestId('ai-quote-draft-answer-voice').textContent).toBe('מענה בקול לשאלות');
    await recordOnce('ai-quote-draft-answer-voice');
    await waitFor(() => expect(requestDraft).toHaveBeenCalledTimes(2));
    expect(requestDraft.mock.calls[1][0]).toBe('פירוק ריצוף קיים בסלון\nשלושים מטר');
    await waitFor(() => expect(screen.queryByTestId('ai-quote-draft-questions')).toBeNull());
    expect(screen.getByTestId('ai-quote-draft-source').textContent).toContain('שלושים מטר');
  });

  it('no transcribe from the Dashboard / no recording support -> no microphone; errors are shown plainly', async () => {
    render(<AiQuoteDraftDialog {...props()} />);
    expect(screen.queryByTestId('ai-quote-draft-dictate')).toBeNull();
    cleanup();
    render(<AiQuoteDraftDialog {...props({ transcribe: vi.fn(async () => ({ ok: false, code: 'limit' })) })} />);
    await recordOnce('ai-quote-draft-dictate');
    // Owner 2026-11-06: 'limit' = the month's SMART PACK usage is used up (the usage meter replaced the day's voice count)
    expect((await screen.findByTestId('ai-quote-draft-voice-error')).textContent).toMatch(/היתרה בחכם פלוס לחודש הזה לא מספיקה לקול/);
    cleanup();
    delete window.MediaRecorder;
    render(<AiQuoteDraftDialog {...props({ transcribe: vi.fn() })} />);
    expect(screen.queryByTestId('ai-quote-draft-dictate')).toBeNull();
  });

  it('English copy', () => {
    render(<AiQuoteDraftDialog {...props({ isHebrew: false, transcribe: vi.fn() })} />);
    expect(screen.getByTestId('ai-quote-draft-dictate').getAttribute('aria-label')).toBe('Dictate');
  });

  // 2026-11-14 (Owner: "תסדר גם את המיקרופון"): the box is the wrapper; the text scrolls only above the microphone's strip
  it('the microphone sits in its own strip at the bottom of the box - the text area never runs under it', () => {
    for (const isHebrew of [true, false]) {
      render(<AiQuoteDraftDialog {...props({ isHebrew, transcribe: vi.fn() })} />);
      const box = screen.getByTestId('ai-quote-draft-field-box');
      const field = box.querySelector('textarea');
      expect(box.style.paddingBottom).toBe('52px');
      expect(box.style.border).toMatch(/1px solid/);
      expect(field.style.paddingBottom).toBe('4px');
      expect(field.style.border).not.toMatch(/solid/);
      expect(field.style.background).toBe('transparent');
      expect(box.contains(screen.getByTestId('ai-quote-draft-dictate'))).toBe(true);
      cleanup();
    }
    // no microphone: the field keeps its own box, as before
    render(<AiQuoteDraftDialog {...props()} />);
    expect(screen.getByTestId('ai-quote-draft-field-box').style.border).toBe('');
    expect(screen.getByTestId('ai-quote-draft-field-box').querySelector('textarea').style.border).toMatch(/1px solid/);
  });
});
