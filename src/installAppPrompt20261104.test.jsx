// Owner console 2026-11-04 (typed: "מאשר את תוכנית ההתקנה, כולל שינוי ב-L-11 ו-L-17"): installing TEKANGO from inside the site - the daily
// tip first on a phone or tablet not yet running from the icon (once, like every tip), a standing "Install the app" row in the phone's
// "More" menu, Chrome's own install window when offered, otherwise the iPhone / browser explanation. HE / RTL and EN / LTR.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { DAILY_TIPS, pickDailyTip, parseTipState, markTipShown, tipBellItems } from './utils/dailyTips';
import DailyTipCard from './components/DailyTipCard';
import InstallAppSheet, { INSTALL_APP_ICON } from './components/InstallAppSheet';
import { captureInstallPrompt, hasNativeInstallPrompt, isInstalledApp, isAppleMobile, canOfferInstall, startInstall, __resetInstallPromptForTests } from './shared/installApp';

afterEach(() => { cleanup(); __resetInstallPromptForTests(); });

const fakeWin = ({ coarse = true, standalone = false, ua = 'Mozilla/5.0 (Linux; Android 14) Mobile', touch = 5, iosStandalone } = {}) => {
  const handlers = {};
  return {
    handlers,
    navigator: { userAgent: ua, maxTouchPoints: touch, standalone: iosStandalone },
    matchMedia: (q) => ({ matches: (q.includes('pointer: coarse') && coarse) || (q.includes('display-mode: standalone') && standalone) }),
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
};
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

describe('the install tip', () => {
  const tip = DAILY_TIPS.find((t) => t.id === 'install_app');
  it('comes first on a phone or tablet not yet installed, with the approved words in both languages', () => {
    expect(DAILY_TIPS[0].id).toBe('install_app');
    expect(tip).toMatchObject({ icon: 'app', action: 'install' });
    expect(tip.he).toEqual({ text: 'אפשר להתקין את TEKANGO במסך הבית ולפתוח אותה כמו אפליקציה, במסך מלא.', action: 'להתקנה' });
    expect(tip.en).toEqual({ text: 'You can add TEKANGO to your home screen and open it like an app, full screen.', action: 'Install' });
    const s = parseTipState(null);
    expect(pickDailyTip({ quotesCount: 4, unsentQuote: { id: 'q' }, installable: true }, s, '2026-11-04').id).toBe('install_app');
    expect(pickDailyTip({ quotesCount: 4, unsentQuote: { id: 'q' }, installable: false }, s, '2026-11-04').id).toBe('twin_before_send');
  });
  it('once, like every tip: seen = never again; the rest keep their order the next day', () => {
    const s = markTipShown(parseTipState(null), 'install_app', '2026-11-04');
    expect(pickDailyTip({ installable: true }, s, '2026-11-04')).toBeNull();
    expect(pickDailyTip({ installable: true, quotesCount: 1 }, s, '2026-11-05').id).toBe('smart_quote');
    expect(DAILY_TIPS.slice(1).map((t) => t.id)).toEqual(['twin_before_send', 'smart_quote', 'file_quote', 'voice', 'ai_chat', 'templates']);
  });
  it('after it closes it stays in the bell as a read item with the same "Install" action', () => {
    const items = tipBellItems(markTipShown(parseTipState(null), 'install_app', '2026-11-04', { at: '2026-11-04T10:00:00Z' }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: 'tip:install_app', tipAction: 'install', preRead: true });
    expect(items[0].copy.he.action).toBe('להתקנה');
  });
  it('the card wears the TEKANGO app icon, RTL in Hebrew and LTR in English', () => {
    const { unmount } = render(<DailyTipCard tip={tip} isHebrew onAction={() => {}} onDismiss={() => {}} onTurnOff={() => {}} />);
    expect(screen.getByTestId('daily-tip').getAttribute('dir')).toBe('rtl');
    expect(screen.getByTestId('daily-tip-app-icon').getAttribute('src')).toBe(INSTALL_APP_ICON);
    expect(screen.getByTestId('daily-tip-action').textContent).toBe('להתקנה');
    unmount();
    render(<DailyTipCard tip={tip} isHebrew={false} onAction={() => {}} onDismiss={() => {}} onTurnOff={() => {}} />);
    expect(screen.getByTestId('daily-tip').getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('daily-tip-action').textContent).toBe('Install');
  });
});

describe('detecting the device and the installed app', () => {
  it('a touch phone or tablet that is not installed gets the offer; a desktop or the installed app does not', () => {
    expect(canOfferInstall(fakeWin())).toBe(true);
    expect(canOfferInstall(fakeWin({ coarse: false, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', touch: 0 }))).toBe(false);
    expect(canOfferInstall(fakeWin({ standalone: true }))).toBe(false);
    expect(isInstalledApp(fakeWin({ iosStandalone: true }))).toBe(true);
  });
  it('iPhone and an iPad that reports itself as a Mac are Apple mobile', () => {
    expect(isAppleMobile({ userAgent: IPHONE })).toBe(true);
    expect(isAppleMobile({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe(false);
  });
});

describe('tapping Install', () => {
  beforeEach(() => __resetInstallPromptForTests());
  it("Android: Chrome's own install window, kept from the page load and used once", async () => {
    const w = fakeWin();
    captureInstallPrompt(w);
    const prompt = vi.fn(() => Promise.resolve());
    const ev = { preventDefault: vi.fn(), prompt };
    w.handlers.beforeinstallprompt(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(hasNativeInstallPrompt()).toBe(true);
    expect(await startInstall(w)).toEqual({ result: 'prompted' });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(hasNativeInstallPrompt()).toBe(false);
  });
  it('iPhone: the Share steps; another browser without the window: the menu steps', async () => {
    expect(await startInstall(fakeWin({ ua: IPHONE }))).toEqual({ result: 'explain', steps: 'ios' });
    expect(await startInstall(fakeWin())).toEqual({ result: 'explain', steps: 'browser' });
  });
  it('the app installed: the kept window is dropped', () => {
    const w = fakeWin();
    captureInstallPrompt(w);
    w.handlers.beforeinstallprompt({ preventDefault() {}, prompt() {} });
    w.handlers.appinstalled();
    expect(hasNativeInstallPrompt()).toBe(false);
  });
});

describe('the explanation window', () => {
  it('HE / RTL: the iPhone steps, the TEKANGO icon, "הבנתי" closes', () => {
    const onClose = vi.fn();
    render(<InstallAppSheet steps="ios" isHebrew onClose={onClose} />);
    const d = screen.getByTestId('install-app-sheet');
    expect(d.getAttribute('dir')).toBe('rtl');
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.textContent).toContain('התקנת TEKANGO במסך הבית');
    expect(d.textContent).toContain('לוחצים על כפתור השיתוף בדפדפן');
    expect(d.textContent).toContain('בוחרים "הוספה למסך הבית".');
    expect(d.querySelector('img').getAttribute('src')).toBe(INSTALL_APP_ICON);
    fireEvent.click(screen.getByTestId('install-app-ok'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('EN / LTR: the browser-menu steps; Escape closes', () => {
    const onClose = vi.fn();
    render(<InstallAppSheet steps="browser" isHebrew={false} onClose={onClose} />);
    const d = screen.getByTestId('install-app-sheet');
    expect(d.getAttribute('dir')).toBe('ltr');
    expect(d.textContent).toContain('Open the browser menu (the three dots).');
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the wiring', () => {
  const dash = readFileSync('src/pages/Dashboard.jsx', 'utf8');
  const main = readFileSync('src/main.jsx', 'utf8');
  it('main.jsx keeps Chrome\'s offer from the page load; still no service worker', () => {
    expect(main).toMatch(/import \{ captureInstallPrompt \} from '\.\/shared\/installApp'/);
    expect(main).toMatch(/^captureInstallPrompt\(\);\r?$/m);
    expect(main).not.toMatch(/serviceWorker/);
  });
  it('the Dashboard: the tip knows the device, its action installs, the "More" row only when not installed, the bell item leaves once installed', () => {
    expect(dash).toMatch(/installable: canOfferInstall\(\),/);
    expect(dash).toMatch(/tip\.action === 'install'\) runInstallApp\(\)/);
    expect(dash).toMatch(/\{canOfferInstall\(\) && \(/);
    expect(dash).toMatch(/data-testid="mobile-more-install-app"/);
    expect(dash).toContain("isHebrew ? 'התקנת האפליקציה' : 'Install the app'");
    expect(dash).toMatch(/it\.tipAction !== 'install' \|\| canOfferInstall\(\)/);
    expect(dash).toMatch(/\{installSheet && <InstallAppSheet /);
  });
});
