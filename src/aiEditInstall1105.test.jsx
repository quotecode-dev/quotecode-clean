// Owner console 2026-11-05 (typed: "מאשר כפתור עריכה בבינה בכל הצעה שלא נחתמה, והתקנה מדף הנחיתה עם המלצת כרום, כולל שינוי ב-L-02, L-06,
// L-09, L-11 ו-L-17, שחרור עד הלייב"). Guard tests for the install half: Samsung Internet detection (David Aluminum was blocked by Play
// Protect installing from Samsung Internet), the Chrome recommendation in InstallAppSheet, and the actionable install button + Chrome note
// in the landing band (HE + EN). The in-quote smart-edit button is guarded in src/components/QuoteForm.test.jsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The landing runs on touch devices in these tests; isSamsungInternet is forced on so the Chrome note renders. The real
// isSamsungInternet is checked separately through vi.importActual so its own logic is still covered.
vi.mock('./shared/installApp', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    canOfferInstall: () => true,
    isInstalledApp: () => false,
    isSamsungInternet: () => true,
    startInstall: vi.fn(async () => ({ result: 'explain', steps: 'browser' })),
    subscribeInstallPrompt: () => () => {},
  };
});

import LandingLocal from './pages/LandingLocal';
import LandingGlobal from './pages/LandingGlobal';
import InstallAppSheet from './components/InstallAppSheet';

afterEach(cleanup);

describe('isSamsungInternet (the real detector)', () => {
  it('matches Samsung Internet and nothing else', async () => {
    const { isSamsungInternet } = await vi.importActual('./shared/installApp');
    expect(isSamsungInternet({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36' })).toBe(true);
    expect(isSamsungInternet({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36' })).toBe(false);
    expect(isSamsungInternet({ userAgent: '' })).toBe(false);
    expect(isSamsungInternet(null)).toBe(false);
  });
});

describe('InstallAppSheet - the Chrome recommendation', () => {
  it('shows the Chrome note when recommendChrome is set, HE and EN', () => {
    const he = render(<InstallAppSheet steps="browser" isHebrew recommendChrome onClose={() => {}} />);
    expect(he.getByTestId('install-chrome-note').textContent).toMatch(/כרום/);
    he.unmount();
    render(<InstallAppSheet steps="browser" isHebrew={false} recommendChrome onClose={() => {}} />);
    expect(screen.getByTestId('install-chrome-note').textContent).toMatch(/Chrome/);
  });

  it('omits the Chrome note by default', () => {
    render(<InstallAppSheet steps="browser" isHebrew onClose={() => {}} />);
    expect(screen.queryByTestId('install-chrome-note')).toBeNull();
  });
});

describe('The landing install band - an actual install action + Chrome note', () => {
  it('HE: shows the install button and the Chrome note, and tapping it starts the install flow', async () => {
    const { startInstall } = await import('./shared/installApp');
    render(<MemoryRouter><LandingLocal /></MemoryRouter>);
    const btn = screen.getByTestId('landing-install-btn');
    expect(btn.textContent).toMatch(/התקנה למסך הבית/);
    expect(screen.getByTestId('landing-install-chrome-note').textContent).toMatch(/כרום/);
    fireEvent.click(btn);
    expect(startInstall).toHaveBeenCalled();
  });

  it('EN: shows the install button and the Chrome note', () => {
    render(<MemoryRouter><LandingGlobal /></MemoryRouter>);
    expect(screen.getByTestId('landing-install-btn').textContent).toMatch(/Add to home screen/);
    expect(screen.getByTestId('landing-install-chrome-note').textContent).toMatch(/Chrome/);
  });
});
