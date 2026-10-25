// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-15 ואת תוכנית החזרה בכל המסכים" - the in-app back stack.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInAppBack, closeTopDialogWithEscape } from './useInAppBack';
import { backLabel } from '../utils/navLabels';

const scr = (tab, extra = {}) => ({ key: `${tab}|${extra.editor ? 'editor' : ''}|${extra.settingsView || ''}`, tab, editor: false, editorAlive: false, ...extra });

function setup(over = {}) {
  const calls = { apply: [], onRoot: 0, leaveEditor: 0 };
  const props = {
    enabled: true,
    screen: scr('main'),
    apply: (s) => calls.apply.push(s.key),
    closeTopWindow: () => false,
    mayLeaveEditor: () => true,
    leaveEditor: () => { calls.leaveEditor += 1; },
    onRoot: () => { calls.onRoot += 1; },
    scrollRoot: () => null,
    ...over,
  };
  const hook = renderHook((p) => useInAppBack(p), { initialProps: props });
  const go = (screen) => { props.screen = screen; hook.rerender({ ...props }); };
  const pop = () => act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
  return { hook, go, pop, calls, props };
}

describe('useInAppBack', () => {
  let push; let back;
  beforeEach(() => { push = vi.spyOn(window.history, 'pushState'); back = vi.spyOn(window.history, 'back').mockImplementation(() => {}); });
  afterEach(() => { push.mockRestore(); back.mockRestore(); });

  it('records the screen that was left; Back returns to it; the first screen with nothing open asks to sign out', () => {
    const { hook, go, pop, calls } = setup();
    go(scr('clients'));
    expect(hook.result.current.depth).toBe(1);
    expect(hook.result.current.previous.tab).toBe('main');
    go(scr('tasks'));
    expect(hook.result.current.previous.tab).toBe('clients');
    pop();
    expect(calls.apply).toEqual(['clients||']);
    go(scr('clients')); // the restore itself never adds a step
    expect(hook.result.current.depth).toBe(1);
    pop();
    expect(calls.apply).toEqual(['clients||', 'main||']);
    go(scr('main'));
    expect(hook.result.current.depth).toBe(0);
    pop();
    expect(calls.onRoot).toBe(1);
  });

  // Owner console 2026-10-22 (L-15 / L-22): another account in the same tab never gets the previous account's screens as Back targets
  it('another account (or a sign-out) empties the Back history; the screen reset of the switch is not recorded', () => {
    const { hook, go, props } = setup({ resetKey: 'admin-user' });
    go({ ...scr('admin_clients'), adminSection: 'users' });
    go(scr('clients'));
    expect(hook.result.current.previous.tab).toBe('admin_clients');
    // the switch: a new account id arrives in the SAME render as the reset screen (Dashboard resets during that render)
    props.resetKey = 'david'; go(scr('main'));
    expect(hook.result.current.depth).toBe(0);
    expect(hook.result.current.previous).toBeNull();
    // a switch that lands on a different screen in the same render is not recorded either
    go({ ...scr('admin_clients'), adminSection: 'users' });
    props.resetKey = null; go(scr('main'));
    expect(hook.result.current.depth).toBe(0);
    // the new account's own navigation is recorded as usual
    props.resetKey = 'david'; go(scr('main'));
    go(scr('clients'));
    expect(hook.result.current.previous.tab).toBe('main');
    expect(backLabel(hook.result.current.previous, true)).not.toMatch(/ניהול/);
  });

  // Owner console 2026-10-22, typed (L-15): a menu destination opens a clean screen; Back appears only inside a path
  it('a screen opened from the menu (startFresh) has no Back target; inside it the path is recorded again; a click that changed nothing leaves no mark', async () => {
    const { hook, go } = setup();
    go({ ...scr('admin_clients'), adminSection: 'users' });
    expect(hook.result.current.previous.tab).toBe('main');
    act(() => { hook.result.current.startFresh(); });
    go(scr('main')); // the sidebar: Admin -> Quotes
    expect(hook.result.current.depth).toBe(0);
    expect(hook.result.current.previous).toBe(null);
    go(scr('settings', { settingsView: 'business' })); // inside the path: a button on Quotes -> Business settings
    expect(hook.result.current.previous.tab).toBe('main');
    // the menu item of the screen already shown: nothing changes now, and the next in-path step is still recorded
    act(() => { hook.result.current.startFresh(); });
    await new Promise((r) => setTimeout(r, 5));
    go(scr('settings', { settingsView: 'templates' }));
    expect(hook.result.current.depth).toBe(2);
  });

  it('a screen marked notBackTarget (Admin for an account without Admin access) is never recorded', () => {
    // the page opened on an Admin link the account may not open; the Dashboard moves it to Quotes
    const { hook, go } = setup({ screen: { ...scr('admin_clients'), notBackTarget: true } });
    go(scr('main'));
    expect(hook.result.current.depth).toBe(0);
    expect(hook.result.current.previous).toBeNull();
    go(scr('clients'));
    expect(hook.result.current.previous.tab).toBe('main');
  });

  it('records the screen as it was when left (a search typed there is restored by Back)', () => {
    const { hook, go } = setup();
    go({ ...scr('main'), search: 'דוד', status: 'Sent' });
    go(scr('clients'));
    expect(hook.result.current.previous).toMatchObject({ tab: 'main', search: 'דוד', status: 'Sent' });
  });

  it('an open window closes first (Back stays on the screen)', () => {
    let open = true;
    const { go, pop, calls } = setup({ closeTopWindow: () => { if (open) { open = false; return true; } return false; } });
    go(scr('clients'));
    pop();
    expect(calls.apply).toEqual([]);
    pop();
    expect(calls.apply).toEqual(['main||']);
  });

  it('the editor: Back asks about unsaved work; "stay" keeps it, "leave" closes it and returns to where it was opened from', () => {
    let answer = false;
    const { go, pop, calls } = setup({ mayLeaveEditor: () => answer });
    go(scr('clients'));
    go(scr('main', { key: 'main|editor|', editor: true, editorAlive: true }));
    pop();
    expect(calls.apply).toEqual([]);
    expect(calls.leaveEditor).toBe(0);
    answer = true;
    pop();
    expect(calls.leaveEditor).toBe(1);
    expect(calls.apply).toEqual(['clients||']);
  });

  it('Cancel returns to the origin and consumes its step (never a second Back to the same screen)', () => {
    const { hook, go, calls } = setup();
    go(scr('clients'));
    go(scr('main', { key: 'main|editor|', editor: true, editorAlive: true }));
    expect(hook.result.current.depth).toBe(2);
    act(() => hook.result.current.returnToOrigin());
    expect(calls.apply).toEqual(['clients||']);
    go(scr('clients'));
    expect(hook.result.current.depth).toBe(1);
    expect(back).toHaveBeenCalledTimes(1); // the editor's history entry is consumed silently
  });

  it('a save sent to Business settings keeps the hidden editor as the Back target ("Back to the quote")', () => {
    const { hook, go } = setup();
    go(scr('main', { key: 'main|editor|', editor: true, editorAlive: true }));
    go(scr('settings', { settingsView: 'business', editorAlive: true }));
    expect(hook.result.current.previous.editor).toBe(true);
    expect(backLabel(hook.result.current.previous, true)).toBe('חזרה להצעה');
    expect(backLabel(hook.result.current.previous, false)).toBe('Back to the quote');
  });

  it('a closed editor is never a Back target', () => {
    const { hook, go } = setup();
    go(scr('main', { key: 'main|editor|', editor: true, editorAlive: true }));
    go(scr('main'));
    expect(hook.result.current.depth).toBe(0);
  });

  it('labels: "Back to <screen>" in the interface language, settings sub-screens by name', () => {
    expect(backLabel(scr('main'), true)).toBe('חזרה להצעות מחיר');
    expect(backLabel(scr('calendar'), true)).toBe('חזרה ליומן');
    expect(backLabel(scr('settings', { settingsView: 'reminders' }), true)).toBe('חזרה לתזכורות ואוטומציות');
    expect(backLabel(scr('statistics'), false)).toBe('Back to Statistics');
    expect(backLabel(scr('admin_clients'), false)).toBe('Back to Admin');
  });

  it('closeTopDialogWithEscape: Escape to the topmost window; a window that ignored it does not hold Back twice', () => {
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    dlg.getClientRects = () => [{}];
    const seen = [];
    dlg.addEventListener('keydown', (e) => seen.push(e.key));
    document.body.appendChild(dlg);
    const memo = { el: null };
    expect(closeTopDialogWithEscape(memo)).toBe(true);
    expect(seen).toEqual(['Escape']);
    expect(closeTopDialogWithEscape(memo)).toBe(false);
    dlg.remove();
    expect(closeTopDialogWithEscape(memo)).toBe(false);
  });
});
