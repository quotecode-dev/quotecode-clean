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
    expect(mic.textContent).toBe('הכתבה בקול');
    fireEvent.change(field, { target: { value: 'עבודת ריצוף:' } });
    await recordOnce('ai-quote-draft-dictate');
    await waitFor(() => expect(field.value).toBe('עבודת ריצוף: פירוק ריצוף בסלון'));
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe.mock.calls[0][0].type.startsWith('audio/webm')).toBe(true);
    expect(p.requestDraft).not.toHaveBeenCalled();
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
    expect((await screen.findByTestId('ai-quote-draft-voice-error')).textContent).toMatch(/מכסת הפעולות הקוליות/);
    cleanup();
    delete window.MediaRecorder;
    render(<AiQuoteDraftDialog {...props({ transcribe: vi.fn() })} />);
    expect(screen.queryByTestId('ai-quote-draft-dictate')).toBeNull();
  });

  it('English copy', () => {
    render(<AiQuoteDraftDialog {...props({ isHebrew: false, transcribe: vi.fn() })} />);
    expect(screen.getByTestId('ai-quote-draft-dictate').textContent).toBe('Dictate');
  });
});
