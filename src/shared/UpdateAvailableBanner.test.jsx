import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { registerDraftFlush } from '../utils/quoteDraft';

// The version-update banner is the ONE place the app reloads the page, and only on the user's click. Unsaved quote
// work must be flushed to durable storage BEFORE that reload, and there must be no automatic reload.
vi.mock('./versionAwareness', () => ({ startVersionPolling: (cb) => { setTimeout(cb, 0); return () => {}; } }));
import UpdateAvailableBanner from './UpdateAvailableBanner';

describe('UpdateAvailableBanner + durable drafts', () => {
  const realLocation = window.location;
  let reload;
  beforeEach(() => { vi.useFakeTimers(); reload = vi.fn(); Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, writable: true, configurable: true }); });
  afterEach(() => { vi.useRealTimers(); Object.defineProperty(window, 'location', { value: realLocation, writable: true, configurable: true }); });

  it('never reloads by itself when a new version is detected', async () => {
    render(<UpdateAvailableBanner isHebrew={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(screen.getByRole('status').textContent).toMatch(/new version/i);
    expect(reload).not.toHaveBeenCalled();
  });
  it('flushes every live draft BEFORE the user-initiated reload', async () => {
    const order = [];
    const off = registerDraftFlush(() => order.push('flush'));
    reload.mockImplementation(() => order.push('reload'));
    render(<UpdateAvailableBanner isHebrew />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    fireEvent.click(screen.getByRole('button', { name: 'רענן' }));
    expect(order).toEqual(['flush', 'reload']);
    off();
  });
});
