// Owner console 2026-10-19 ("כן לצילום מסך, וגם לא צריך להיות כפתור אלא העתק הדבק, מה שאתה חושב לנכון"): one screenshot per chat
// question - pasted into the field (computer) or picked with the paperclip (phone); sent once with that question, never again.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import AIChatWidget from './AIChatWidget';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock('./shared/supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => mocks.invoke(...args) },
    auth: { getSession: (...args) => mocks.getSession(...args), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
  },
}));
const PNG_BYTES = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (ch) => ch.charCodeAt(0));
const pngFile = () => new File([PNG_BYTES], 'shot.png', { type: 'image/png' });

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  sessionStorage.clear(); localStorage.clear();
  localStorage.setItem('tekango.voiceMode', 'text');
  mocks.invoke.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1', email: 'u-1@example.com' } } } });
  mocks.invoke.mockResolvedValue({ data: { contractVersion: 4, answer: 'רואים את חלון התבניות, והוא ריק.', navigation: null, selectedQuoteContext: null, error: null }, error: null });
});
afterEach(() => { cleanup(); delete window.matchMedia; });

const openChat = async ({ dashboard = true, phone = false } = {}) => {
  if (phone) window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  render(<AIChatWidget isHebrew isDashboard={dashboard} />);
  await act(async () => { await Promise.resolve(); });
  await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  fireEvent.click(screen.getByLabelText('צ׳אט AI'));
};
const pasteImage = async () => {
  const file = pngFile();
  await act(async () => {
    fireEvent.paste(screen.getByPlaceholderText('שאלו משהו…'), { clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }], files: [file] } });
  });
};

describe('a screenshot in the smart chat (Owner 2026-10-19)', () => {
  it('pasting an image shows it above the typing row; sending carries it ONCE with that question', async () => {
    await openChat();
    await pasteImage();
    await screen.findByTestId('ai-chat-screenshot-preview');
    fireEvent.change(screen.getByPlaceholderText('שאלו משהו…'), { target: { value: 'למה כתוב שאין תבניות?' } });
    fireEvent.click(screen.getByLabelText('שליחה'));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.screenshot).toMatch(/^data:image\/(png|jpeg);base64,/);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'למה כתוב שאין תבניות?' });
    expect(screen.queryByTestId('ai-chat-screenshot-preview')).toBeNull();
    expect(await screen.findByTestId('ai-chat-user-screenshot')).toBeTruthy();
    // the next question goes without the image, and the image never rides in the transcript
    fireEvent.change(screen.getByPlaceholderText('שאלו משהו…'), { target: { value: 'ועכשיו?' } });
    fireEvent.click(screen.getByLabelText('שליחה'));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke.mock.calls[1][1].body.screenshot).toBeUndefined();
    expect(JSON.stringify(mocks.invoke.mock.calls[1][1].body.messages)).not.toMatch(/data:image/);
  });

  it('an image alone is sent with a default question; the preview can be removed; a text paste is untouched', async () => {
    await openChat();
    await pasteImage();
    fireEvent.click(await screen.findByTestId('ai-chat-screenshot-remove'));
    expect(screen.queryByTestId('ai-chat-screenshot-preview')).toBeNull();
    await pasteImage();
    await screen.findByTestId('ai-chat-screenshot-preview');
    fireEvent.click(screen.getByLabelText('שליחה'));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke.mock.calls[0][1].body.messages.at(-1).content).toBe('מה רואים בצילום המסך, ומה לעשות?');
    const input = screen.getByPlaceholderText('שאלו משהו…');
    const ev = fireEvent.paste(input, { clipboardData: { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }], files: [] } });
    expect(ev).toBe(true); // not prevented - the text pastes normally
  });

  it('the phone gets a paperclip in the typing row (same size as the microphone); the computer pastes only', async () => {
    await openChat({ phone: true });
    const clip = screen.getByTestId('ai-chat-attach');
    expect(clip.getAttribute('aria-label')).toBe('צירוף צילום מסך');
    expect(clip.closest('form')).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByTestId('ai-chat-screenshot-file'), { target: { files: [pngFile()] } }); });
    await screen.findByTestId('ai-chat-screenshot-preview');
    cleanup();
    delete window.matchMedia;
    await openChat();
    expect(screen.queryByTestId('ai-chat-attach')).toBeNull();
  });

  it('the public chat (not signed in) takes no screenshot', async () => {
    await openChat({ dashboard: false });
    await pasteImage();
    expect(screen.queryByTestId('ai-chat-screenshot-preview')).toBeNull();
  });
});
