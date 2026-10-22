// Codex PayPlus stage-2 audit M01 (night task 2026-10-23): the account summary is read again quietly when the user returns to the tab,
// at most once a minute, and never while the tab is hidden.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fetchAccountSummary = vi.fn();
vi.mock('../domain/subscriptions/accountSummaryClient', () => ({ fetchAccountSummary: (...a) => fetchAccountSummary(...a), LOADING_SUMMARY: { state: 'loading' } }));
const { default: useAccountSummary } = await import('./useAccountSummary');

beforeEach(() => { fetchAccountSummary.mockReset(); fetchAccountSummary.mockResolvedValue({ state: 'ready', planId: 'free' }); now = 1000000; vi.spyOn(Date, 'now').mockImplementation(() => now); });
afterEach(() => { vi.restoreAllMocks(); });
let now = 0;
const SB = {}; // a stable client (a new object every render would re-run the first read)

describe('useAccountSummary refresh on return', () => {
  it('a focus reads the summary again quietly, at most once a minute', async () => {
    const { result } = renderHook(() => useAccountSummary(SB, 'u1'));
    await act(async () => {});
    expect(fetchAccountSummary).toHaveBeenCalledTimes(1);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(fetchAccountSummary).toHaveBeenCalledTimes(2);
    expect(result.current.summary.state).toBe('ready');
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(fetchAccountSummary).toHaveBeenCalledTimes(2);
    now += 61000;
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(fetchAccountSummary).toHaveBeenCalledTimes(3);
  });
  it('no user, no reads', async () => {
    renderHook(() => useAccountSummary(SB, null));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(fetchAccountSummary).not.toHaveBeenCalled();
  });
});
