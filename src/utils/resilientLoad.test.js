// Owner 2026-10-15 (permanent fix for quotes vanishing until a refresh): the shared self-healing load.
import { describe, it, expect, vi } from 'vitest';
import { loadWithRetry, isAuthExpiredError, isNetworkError, RETRY_DELAYS_MS } from './resilientLoad';

const noSleep = vi.fn(async () => {});

describe('loadWithRetry', () => {
  it('retries a failing load by itself until it succeeds, with a growing pause', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { message: 'TypeError: Failed to fetch' }, status: 0 })
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ ok: true, data: [1, 2] });
    const sleep = vi.fn(async () => {});
    const res = await loadWithRetry(run, { sleep });
    expect(res).toEqual({ ok: true, data: [1, 2] });
    expect(run).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });
  it('the pause stops growing at the last step and the load keeps trying', async () => {
    let n = 0;
    const run = vi.fn(async () => (++n < 10 ? { ok: false, error: { message: 'Failed to fetch' } } : { ok: true, data: 'x' }));
    const sleep = vi.fn(async () => {});
    await loadWithRetry(run, { sleep });
    expect(sleep.mock.calls.slice(-3).map((c) => c[0])).toEqual([30000, 30000, 30000]);
    expect(RETRY_DELAYS_MS.at(-1)).toBe(30000);
  });
  it('an expired sign-in refreshes the session before the next attempt', async () => {
    const refreshAuth = vi.fn(async () => {});
    const run = vi.fn().mockResolvedValueOnce({ ok: false, error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 }).mockResolvedValueOnce({ ok: true, data: [] });
    const res = await loadWithRetry(run, { refreshAuth, sleep: noSleep });
    expect(res.ok).toBe(true);
    expect(refreshAuth).toHaveBeenCalledTimes(1);
  });
  it('stops (cancelled, never an empty success) once the session / user changed', async () => {
    let current = true;
    const run = vi.fn(async () => { current = false; return { ok: false, error: { message: 'Failed to fetch' } }; });
    const res = await loadWithRetry(run, { isCurrent: () => current, sleep: noSleep });
    expect(res).toEqual({ ok: false, cancelled: true });
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('reports each retry (diagnostics / the slow-connection note)', async () => {
    const onRetry = vi.fn();
    const run = vi.fn().mockResolvedValueOnce({ ok: false, error: { message: 'x' }, status: 503 }).mockResolvedValueOnce({ ok: true, data: 1 });
    await loadWithRetry(run, { onRetry, sleep: noSleep });
    expect(onRetry).toHaveBeenCalledWith(1, { message: 'x' }, 503);
  });
});

describe('error kinds', () => {
  it('auth expiry', () => {
    expect(isAuthExpiredError({ message: 'JWT expired', code: 'PGRST301' })).toBe(true);
    expect(isAuthExpiredError({ message: 'x' }, 401)).toBe(true);
    expect(isAuthExpiredError({ message: 'permission denied' }, 403)).toBe(false);
  });
  it('network', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isNetworkError({ message: 'x' }, 0)).toBe(true);
    expect(isNetworkError({ message: 'Load failed' })).toBe(true);
    expect(isNetworkError({ message: 'duplicate key' }, 409)).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
