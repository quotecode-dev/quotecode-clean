// Owner console 2026-10-19 (voice assistant, docs/VOICE_ASSISTANT_PLAN_2026-10-19.md): a microphone in the chat's typing row and
// spoken answers - voice by default, the user chooses voice / voice and text / text only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import AIChatWidget from './AIChatWidget';
import { readVoiceMode, pickRecorderMime } from './utils/voiceAssistant';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn(), played: [] }));
vi.mock('./shared/supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => mocks.invoke(...args) },
    auth: { getSession: (...args) => mocks.getSession(...args), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
  },
}));

class FakeRecorder {
  static isTypeSupported(t) { return t === 'audio/webm;codecs=opus'; }
  constructor(stream, opts) { this.stream = stream; this.mimeType = opts?.mimeType || ''; this.state = 'inactive'; FakeRecorder.last = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)], { type: 'audio/webm' }) }); this.onstop?.(); }
}

const chatAnswer = (text) => ({ data: { contractVersion: 4, answer: text, navigation: null, selectedQuoteContext: null, error: null }, error: null });
function route(over = {}) {
  mocks.invoke.mockImplementation(async (fn, { body }) => {
    if (fn === 'voice-ai' && body.mode === 'transcribe') return over.transcribe || { data: { ok: true, text: 'מה ההצעה האחרונה ששלחתי' }, error: null };
    if (fn === 'voice-ai' && body.mode === 'speak') return over.speak || { data: { ok: true, audio: 'AAAA', mime: 'audio/mpeg' }, error: null };
    return chatAnswer('ההצעה האחרונה היא מס׳ 100703 ללקוח Eden David.');
  });
}

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  sessionStorage.clear();
  localStorage.clear();
  mocks.invoke.mockReset();
  mocks.played = [];
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1', email: 'u-1@example.com' } } } });
  route();
  window.MediaRecorder = FakeRecorder;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:voice');
  globalThis.URL.revokeObjectURL = vi.fn();
  window.Audio = class { constructor(src) { this.src = src; } play() { mocks.played.push(this.src); return Promise.resolve(); } pause() {} };
});
afterEach(() => { cleanup(); delete window.MediaRecorder; });

// the signed-in identity resolves asynchronously and (by design) starts a clean chat - wait for it before talking
const openDashboardChat = async (isHebrew = true) => {
  render(<AIChatWidget isHebrew={isHebrew} isDashboard />);
  await act(async () => { await Promise.resolve(); });
  await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  fireEvent.click(screen.getByLabelText(isHebrew ? 'צ׳אט AI' : 'AI Chat'));
};
const typeAndSend = (text) => {
  fireEvent.change(screen.getByPlaceholderText('שאלו משהו…'), { target: { value: text } });
  fireEvent.click(screen.getByLabelText('שליחה'));
};

describe('voice assistant in the smart chat (Owner 2026-10-19)', () => {
  it('the microphone sits in the typing row between the text field and Send; dashboard only', async () => {
    await openDashboardChat();
    const mic = screen.getByTestId('ai-chat-mic');
    const row = mic.closest('form');
    const order = [...row.children].map((el) => el.tagName === 'INPUT' ? 'input' : el.getAttribute('data-testid') || el.getAttribute('aria-label'));
    expect(order).toEqual(['input', 'ai-chat-mic', 'שליחה']);
    expect(mic.getAttribute('aria-label')).toBe('הקלטת שאלה בקול');
    cleanup();
    render(<AIChatWidget isHebrew isDashboard={false} />);
    fireEvent.click(screen.getByLabelText('צ׳אט AI'));
    expect(screen.queryByTestId('ai-chat-mic')).toBeNull();
    expect(screen.queryByTestId('ai-chat-voice-mode')).toBeNull();
  });

  it('voice is the default: the answer is spoken, its bubble shows "spoken answer" + "show text", with the AI-voice disclosure once', async () => {
    expect(readVoiceMode()).toBe('voice');
    await openDashboardChat();
    typeAndSend('מה ההצעה האחרונה');
    await screen.findByTestId('ai-chat-spoken-answer');
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('voice-ai', { body: { mode: 'speak', text: 'ההצעה האחרונה היא מס׳ 100703 ללקוח Eden David.' } }));
    await waitFor(() => expect(mocks.played).toEqual(['blob:voice']));
    expect(screen.getByText('הקול שתשמעו נוצר על ידי בינה מלאכותית.')).toBeTruthy();
    expect(screen.queryByText('ההצעה האחרונה היא מס׳ 100703 ללקוח Eden David.')).toBeNull();
    fireEvent.click(screen.getByTestId('ai-chat-show-text'));
    expect(screen.getByText('ההצעה האחרונה היא מס׳ 100703 ללקוח Eden David.')).toBeTruthy();
    // a second answer does not repeat the disclosure
    typeAndSend('ועוד שאלה');
    await waitFor(() => expect(screen.getAllByTestId('ai-chat-spoken-answer')).toHaveLength(1));
    expect(screen.getAllByText('הקול שתשמעו נוצר על ידי בינה מלאכותית.')).toHaveLength(1);
  });

  it('the header choice: voice / voice and text / text only - remembered; text only never calls the voice service', async () => {
    await openDashboardChat();
    fireEvent.click(screen.getByTestId('ai-chat-voice-mode'));
    const items = screen.getAllByRole('menuitemradio').map((b) => [b.textContent, b.getAttribute('aria-checked')]);
    expect(items).toEqual([['קול', 'true'], ['קול וכתב', 'false'], ['כתב בלבד', 'false']]);
    fireEvent.click(screen.getByTestId('ai-chat-voice-mode-text'));
    expect(readVoiceMode()).toBe('text');
    typeAndSend('שאלה');
    await screen.findByText('ההצעה האחרונה היא מס׳ 100703 ללקוח Eden David.');
    expect(mocks.invoke.mock.calls.filter(([fn]) => fn === 'voice-ai')).toHaveLength(0);
    expect(screen.queryByTestId('ai-chat-replay')).toBeNull();
    fireEvent.click(screen.getByTestId('ai-chat-voice-mode'));
    fireEvent.click(screen.getByTestId('ai-chat-voice-mode-both'));
    typeAndSend('עוד שאלה');
    await waitFor(() => expect(mocks.invoke.mock.calls.filter(([fn]) => fn === 'voice-ai')).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText('ההצעה האחרונה היא מס׳ 100703 ללקוח Eden David.')).toHaveLength(2)); // both = the full text too
    expect(screen.getAllByTestId('ai-chat-replay')).toHaveLength(1);
  });

  it('recording: tap to start (red, timer), tap to stop -> the speech becomes the question sent to the smart chat', async () => {
    await openDashboardChat();
    await act(async () => { fireEvent.click(screen.getByTestId('ai-chat-mic')); });
    const mic = screen.getByTestId('ai-chat-mic');
    expect(mic.getAttribute('aria-pressed')).toBe('true');
    expect(mic.textContent).toContain('0:00');
    expect(FakeRecorder.last.mimeType).toBe('audio/webm;codecs=opus');
    await act(async () => { fireEvent.click(mic); });
    await waitFor(() => expect(mocks.invoke.mock.calls.some(([fn, { body }]) => fn === 'voice-ai' && body.mode === 'transcribe' && body.mime.startsWith('audio/webm') && body.audio.length > 100)).toBe(true));
    await waitFor(() => expect(mocks.invoke.mock.calls.some(([fn, { body }]) => fn === 'chat-ai' && body.messages.at(-1).content === 'מה ההצעה האחרונה ששלחתי')).toBe(true));
    expect(screen.getByText('מה ההצעה האחרונה ששלחתי')).toBeTruthy();
  });

  it('microphone refused / nothing understood / the daily limit -> a clear note, nothing sent to the chat', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn(async () => { throw new Error('denied'); });
    await openDashboardChat();
    await act(async () => { fireEvent.click(screen.getByTestId('ai-chat-mic')); });
    expect(await screen.findByText(/אין גישה למיקרופון/)).toBeTruthy();
    cleanup();
    navigator.mediaDevices.getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
    route({ transcribe: { data: null, error: { context: { status: 429 } } } });
    await openDashboardChat();
    await act(async () => { fireEvent.click(screen.getByTestId('ai-chat-mic')); });
    await act(async () => { fireEvent.click(screen.getByTestId('ai-chat-mic')); });
    expect(await screen.findByText(/מכסת הפעולות הקוליות היומית/)).toBeTruthy();
    expect(mocks.invoke.mock.calls.filter(([fn]) => fn === 'chat-ai')).toHaveLength(0);
  });

  it('English mirrors the copy', async () => {
    await openDashboardChat(false);
    expect(screen.getByTestId('ai-chat-mic').getAttribute('aria-label')).toBe('Ask by voice');
    fireEvent.click(screen.getByTestId('ai-chat-voice-mode'));
    expect(screen.getAllByRole('menuitemradio').map((b) => b.textContent)).toEqual(['Voice', 'Voice and text', 'Text only']);
  });

  it('a browser that cannot record shows no microphone', async () => {
    delete window.MediaRecorder;
    expect(pickRecorderMime()).toBeNull();
    await openDashboardChat();
    expect(screen.queryByTestId('ai-chat-mic')).toBeNull();
  });
});
