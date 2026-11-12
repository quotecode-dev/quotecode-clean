// Owner console 2026-10-25, typed: "מאשר שינוי ב-L-15, L-01, L-09: חזרה במסכי המשנה ובעורך לפי ההמלצה" - one Back on a settings
// sub-screen, every way out asks about unsaved changes, and the editor gets a Back that keeps the draft.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useInAppBack } from './hooks/useInAppBack';

const src = (f) => readFileSync(f, 'utf8');
const scr = (tab, extra = {}) => ({ key: `${tab}|${extra.settingsView || ''}`, tab, editor: false, editorAlive: false, ...extra });

describe('the phone Back asks the screen first', () => {
  let push; let back;
  beforeEach(() => { push = vi.spyOn(window.history, 'pushState'); back = vi.spyOn(window.history, 'back').mockImplementation(() => {}); });
  afterEach(() => { push.mockRestore(); back.mockRestore(); });
  it('a screen that refuses (the user kept the unsaved changes) stays; one that agrees goes back', () => {
    let allow = false;
    const applied = [];
    const props = { enabled: true, screen: scr('main'), apply: (s) => applied.push(s.key), closeTopWindow: () => false, mayLeaveEditor: () => true,
      mayLeaveScreen: () => allow, leaveEditor: () => {}, onRoot: () => {}, scrollRoot: () => null };
    const hook = renderHook((p) => useInAppBack(p), { initialProps: props });
    props.screen = scr('settings', { settingsView: 'reminders' }); hook.rerender({ ...props });
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(applied).toEqual([]);
    expect(hook.result.current.depth).toBe(1);
    allow = true;
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(applied).toEqual(['main|']);
  });
});

describe('the wiring', () => {
  it('the Dashboard: a sub-screen registers its question; the menu and the phone Back ask it; the sub-screen shows only its own Back', () => {
    const d = src('src/pages/Dashboard.jsx');
    // Owner console 2026-10-26 (typed approval naming L-15 / L-01): each question may be the app's own window (pending)
    expect(d).toContain('const mayLeaveSettingsScreen = () => andAllowed(subLeaveGuardRef.current ? subLeaveGuardRef.current() : true, mayLeaveSettings);');
    expect(d).toContain('const guardedNav = (go) => whenAllowed(andAllowed(showQuoteForm ? mayLeaveEditor() : true, mayLeaveSettingsScreen), () => { inAppBack.startFresh(phoneHome()); go(); });');
    expect(d).toContain("mayLeaveScreen: () => activeTab !== 'settings' || mayLeaveSettingsScreen(),");
    expect(d).toContain("!(activeTab === 'settings' && ['reminders', 'shareDefaults', 'businessCard'].includes(settingsView))");
    expect(d).toContain('onBack={inAppBack.back}\n'.replace('\n', '').trim());
  });
  it('the three sub-screens register the same question as their own Back (the business card now asks too)', () => {
    expect(src('src/components/RemindersSettings.jsx')).toContain('registerLeaveGuard(() => !dirty || askConfirm(C.leaveUnsaved, isHebrew, leaveLabels(isHebrew)))');
    expect(src('src/components/ShareDefaultsSettings.jsx')).toContain('registerLeaveGuard(() => !unsaved || askConfirm(C.leaveUnsaved, isHebrew, leaveLabels(isHebrew)))');
    const card = src('src/components/BusinessCardSettings.jsx');
    expect(card).toContain('registerLeaveGuard(() => !profile.dirty || askConfirm(C.leaveUnsaved, isHebrew, leaveLabels(isHebrew)))');
    expect(card).toContain('onClick={() => whenAllowed(!profile.dirty || askConfirm(C.leaveUnsaved, isHebrew, leaveLabels(isHebrew)), onBack)} data-testid="business-card-back"');
  });
  it('the editor: a Back that keeps the draft, next to the unchanged Cancel', () => {
    const q = src('src/components/QuoteForm.jsx');
    expect(q).toContain('<button type="button" onClick={onBack} data-testid="editor-back"');
    expect(q).toContain("{isHebrew ? 'ביטול וחזרה לרשימה' : 'Cancel & Return'}");
    expect(q.indexOf('data-testid="editor-back"')).toBeLessThan(q.indexOf("'ביטול וחזרה לרשימה'"));
  });
});
