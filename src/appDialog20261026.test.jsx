// Owner console 2026-10-26 (typed: "מאשר החלפת חלונות הדפדפן בחלון של המערכת בעברית ובאנגלית, כולל שינוי ב-L-01, L-09, L-13, L-15, L-17,
// L-24, L-26, L-27, L-28 ובבדיקות השומרות שלהם"): no browser dialog is left in the app; the app's own window speaks the user's language
// and direction, answers one question at a time, and Escape / the backdrop / the phone Back give the safe answer.
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { askConfirm, askChoice, showNotice, showCopyText, andAllowed, whenAllowed, leaveLabels } from './components/AppDialog';
import { authorizeWithNotice } from './domain/subscriptions/outputAuthority';
import { useInAppBack } from './hooks/useInAppBack';

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe('no browser dialog is left', () => {
  it('no source file calls window.confirm / alert / prompt (only the no-page fallbacks of the dialog module and the attachment notice)', () => {
    const files = walk(join(cwd(), 'src')).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\.|[\\/]test[\\/]/.test(f));
    const hits = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/\b(window|win|w)\??\.(confirm|alert|prompt)\??\.?\(/.test(code)) hits.push(`${f.slice(cwd().length + 1)}:${i + 1}`);
      });
    }
    expect(hits.map((h) => h.replace(/\\/g, '/').replace(/:\d+$/, ''))).toEqual(['src/components/AppDialog.jsx', 'src/components/AppDialog.jsx', 'src/utils/freshAttachmentLink.js']);
  });
});

describe('the app window', () => {
  it('Hebrew: right to left, Hebrew buttons; the confirming button answers true', async () => {
    const p = askConfirm('לצאת בלי לשמור?', true, leaveLabels(true));
    const d = await screen.findByTestId('app-dialog-confirm');
    expect(d.getAttribute('dir')).toBe('rtl');
    expect(d.getAttribute('lang')).toBe('he');
    expect(d.getAttribute('role')).toBe('alertdialog');
    expect(screen.getByTestId('app-dialog-yes').textContent).toBe('לצאת בלי לשמור');
    expect(screen.getByTestId('app-dialog-no').textContent).toBe('להישאר');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('app-dialog-no'))); // the safe answer has the focus
    expect(d.closest('.no-print')).not.toBeNull(); // never printed (L-28)
    await act(async () => { fireEvent.click(screen.getByTestId('app-dialog-yes')); });
    await expect(p).resolves.toBe(true);
  });
  it('English: left to right, default Continue / Cancel; Cancel answers false', async () => {
    const p = askConfirm('Continue?', false);
    const d = await screen.findByTestId('app-dialog-confirm');
    expect(d.getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('app-dialog-yes').textContent).toBe('Continue');
    expect(screen.getByTestId('app-dialog-no').textContent).toBe('Cancel');
    await act(async () => { fireEvent.click(screen.getByTestId('app-dialog-no')); });
    await expect(p).resolves.toBe(false);
  });
  it('Escape = the safe answer, and never reaches the screen underneath', async () => {
    const under = vi.fn();
    document.addEventListener('keydown', under);
    const p = askConfirm('המשך?', true);
    await screen.findByTestId('app-dialog-confirm');
    await act(async () => { fireEvent.keyDown(document.activeElement, { key: 'Escape' }); });
    await expect(p).resolves.toBe(false);
    expect(under).not.toHaveBeenCalled();
    document.removeEventListener('keydown', under);
  });
  it('the backdrop = the safe answer; questions come one at a time, in order', async () => {
    const a = askConfirm('first', false);
    const b = askConfirm('second', false);
    await screen.findByTestId('app-dialog-confirm');
    expect(screen.getAllByTestId('app-dialog-confirm')).toHaveLength(1);
    expect(screen.getByTestId('app-dialog-text').textContent).toBe('first');
    await act(async () => { fireEvent.mouseDown(screen.getByTestId('app-dialog-backdrop')); });
    await expect(a).resolves.toBe(false);
    await waitFor(() => expect(screen.getByTestId('app-dialog-text').textContent).toBe('second'));
    await act(async () => { fireEvent.click(screen.getByTestId('app-dialog-yes')); });
    await expect(b).resolves.toBe(true);
  });
  it('a notice (one button) and a text to copy by hand (selected)', async () => {
    const n = showNotice('הקובץ הזה כבר לא מצורף להצעה.', true);
    await screen.findByTestId('app-dialog-notice');
    expect(screen.getByTestId('app-dialog-close').textContent).toBe('הבנתי');
    await act(async () => { fireEvent.click(screen.getByTestId('app-dialog-close')); });
    await expect(n).resolves.toBeUndefined();
    const c = showCopyText('Hi Dana, here is your quote', false, 'The browser did not allow copying. Copy the message from here:');
    await screen.findByTestId('app-dialog-copy');
    const area = screen.getByTestId('app-dialog-copy-text');
    expect(area.value).toBe('Hi Dana, here is your quote');
    await waitFor(() => expect(document.activeElement).toBe(area));
    expect(screen.getByTestId('app-dialog-close').textContent).toBe('Close');
    await act(async () => { fireEvent.click(screen.getByTestId('app-dialog-close')); });
    await expect(c).resolves.toBeUndefined();
  });
  it('andAllowed / whenAllowed: an answer at once or a pending question; the next step only after yes', async () => {
    expect(andAllowed(true, () => 'next')).toBe('next');
    expect(andAllowed(false, () => 'next')).toBe(false);
    await expect(andAllowed(Promise.resolve(true), () => 'next')).resolves.toBe('next');
    await expect(andAllowed(Promise.resolve(false), () => 'next')).resolves.toBe(false);
    const run = vi.fn();
    whenAllowed(false, run); await whenAllowed(Promise.resolve(false), run);
    expect(run).not.toHaveBeenCalled();
    whenAllowed(true, run); await whenAllowed(Promise.resolve(true), run);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('the free-quote question waits for the answer (never a Promise read as yes)', () => {
  const invoke = (consume) => vi.fn(async (_n, { body }) => (body.action === 'output_notice'
    ? { data: { ok: true, quoteId: 'q1', wouldConsume: consume, remaining: 7, contentDigest: 'd'.repeat(64) } }
    : { data: { ok: true, proceed: true, publicPath: '/q/x' } }));
  it('a pending "no" cancels: nothing is authorized', async () => {
    const inv = invoke(true);
    const r = await authorizeWithNotice({ channel: 'send', quoteId: 'q1', invoke: inv, confirm: () => Promise.resolve(false), isHebrew: true });
    expect(r).toEqual({ proceed: false, mode: 'cancelled', code: 'cancelled_by_owner' });
    expect(inv).toHaveBeenCalledTimes(1);
  });
});

describe('the phone Back while the question window is open', () => {
  const scr = (tab, extra = {}) => ({ key: `${tab}|`, tab, editor: false, editorAlive: false, ...extra });
  it('keeps the place while asking; "stay" changes nothing; "leave" drops the kept place silently and steps back', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    let resolveAnswer;
    const applied = [];
    const props = { enabled: true, screen: scr('main'), apply: (s) => applied.push(s.key), closeTopWindow: () => false, mayLeaveEditor: () => true,
      mayLeaveScreen: () => new Promise((r) => { resolveAnswer = r; }), leaveEditor: () => {}, onRoot: () => {}, scrollRoot: () => null };
    const hook = renderHook((p) => useInAppBack(p), { initialProps: props });
    props.screen = scr('settings', { settingsView: 'reminders' }); hook.rerender({ ...props });
    const pushedBefore = push.mock.calls.length;
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(push.mock.calls.length).toBe(pushedBefore + 1); // the place is kept while the question is open
    await act(async () => { resolveAnswer(false); });
    expect(applied).toEqual([]);
    expect(back).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await act(async () => { resolveAnswer(true); });
    expect(back).toHaveBeenCalledTimes(1); // the kept place is dropped silently
    expect(applied).toEqual(['main|']);
    expect(hook.result.current.depth).toBe(0);
    push.mockRestore(); back.mockRestore();
  });
});

// Owner console 2026-10-26 (typed L-17 approval, Codex F-08): the unknown-currency template question has two named answers and Cancel;
// Escape / the backdrop / Back cancel - never "without prices"
describe('a question with named answers', () => {
  it('each answer is returned by name; Escape and the backdrop return null (cancel)', async () => {
    const opts = { options: [{ value: 'with', label: 'Use the prices' }, { value: 'without', label: 'Without prices' }], cancel: 'Cancel' };
    let p = askChoice('Use the prices?', false, opts);
    await screen.findByTestId('app-dialog-choice');
    expect(screen.getByTestId('app-dialog-no').textContent).toBe('Cancel');
    await act(async () => { fireEvent.click(screen.getByTestId('app-dialog-choice-without')); });
    await expect(p).resolves.toBe('without');
    p = askChoice('Use the prices?', false, opts);
    await screen.findByTestId('app-dialog-choice');
    await act(async () => { fireEvent.keyDown(document.activeElement, { key: 'Escape' }); });
    await expect(p).resolves.toBeNull();
    p = askChoice('Use the prices?', false, opts);
    await screen.findByTestId('app-dialog-choice');
    await act(async () => { fireEvent.mouseDown(screen.getByTestId('app-dialog-backdrop')); });
    await expect(p).resolves.toBeNull();
  });
  it('the template flow: cancel stops before any quote opens; "without prices" removes the prices only', () => {
    const d = readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8').replace(/\r/g, '');
    const fn = d.slice(d.indexOf('const handleUseTemplate = async (content) => {'), d.indexOf('if (handleCreateNewQuoteClick() === false) return;'));
    expect(fn).toContain('const choice = await askChoice(');
    expect(fn).toContain('if (choice === null) return;');
    expect(fn).toContain("if (choice === 'without') templateItems = withoutPrices(f.items);");
  });
});
