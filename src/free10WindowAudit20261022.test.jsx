// Codex audit 2026-10-21 (Owner answer "כן, לתקן"): the Free-plan end window - H07 a working way to the plans window while paying is
// possible (a dead end before); M06 it opens at its top. Billing off (today) = the choice stays shown as not available yet.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Free10UpgradeWindow from './components/Free10UpgradeWindow';

const HERE = path.dirname(fileURLToPath(import.meta.url));
afterEach(cleanup);
const props = (over = {}) => ({ open: true, onClose: vi.fn(), isHebrew: true, market: 'IL', free10: { limit: 10, consumed: 10, reserved: 0, remaining: 0 }, ...over });

describe('the Free-plan end window', () => {
  it('billing off (today): the choice is disabled and says it is not available yet', () => {
    render(<Free10UpgradeWindow {...props()} />);
    expect(screen.getByTestId('free10-upgrade-choose').disabled).toBe(true);
    expect(screen.getByTestId('free10-upgrade-unavailable').textContent).toBe('רכישת מנוי עדיין לא זמינה במערכת, ולא מתבצע חיוב.');
  });
  it('paying possible (HE / EN): the choice is active, opens the plans window, and the "not available" line is gone', () => {
    const onChoose = vi.fn();
    const { rerender } = render(<Free10UpgradeWindow {...props({ onChoose })} />);
    const btn = screen.getByTestId('free10-upgrade-choose');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('בחירת מנוי');
    expect(screen.queryByTestId('free10-upgrade-unavailable')).toBeNull();
    fireEvent.click(btn);
    expect(onChoose).toHaveBeenCalledTimes(1);
    rerender(<Free10UpgradeWindow {...props({ onChoose, isHebrew: false })} />);
    expect(screen.getByTestId('free10-upgrade-choose').textContent).toBe('Choose a subscription');
    expect(screen.getByTestId('free10-upgrade-window').getAttribute('dir')).toBe('ltr');
  });
  it('opens at its top: the first focus is the close X above the title', () => {
    render(<Free10UpgradeWindow {...props({ isHebrew: false })} />);
    const x = screen.getByTestId('free10-upgrade-x');
    expect(document.activeElement).toBe(x);
    expect(x.compareDocumentPosition(screen.getByText('Keep working without limits')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Dashboard wiring (source guard)', () => {
  const dash = fs.readFileSync(path.join(HERE, 'pages', 'Dashboard.jsx'), 'utf8').replace(/\r\n/g, '\n');
  it('the choice is offered only while the server says paying is possible, and it closes this window and opens the plans window', () => {
    expect(dash).toMatch(/onChoose=\{packageCheckoutAvailable\(accountSummary, isLifetimeAccount\) \? \(\) => \{ setFree10Window\(false\); setShowPricingModal\(true\); \} : null\}/);
  });
});
