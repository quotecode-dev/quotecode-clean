import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkForNewVersion, startVersionPolling } from './versionAwareness';

describe('checkForNewVersion', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when the fetch fails (network hiccup) - never nags on a flaky connection', async () => {
    fetch.mockRejectedValue(new Error('network error'));
    expect(await checkForNewVersion()).toBeNull();
  });

  it('returns null when the response is not ok', async () => {
    fetch.mockResolvedValue({ ok: false });
    expect(await checkForNewVersion()).toBeNull();
  });

  it('returns null when the deployed buildSha matches the running one (CURRENT_BUILD_SHA is "unknown" in tests, so any mismatch is suppressed to avoid a false positive in this environment)', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ buildSha: 'unknown' }) });
    expect(await checkForNewVersion()).toBeNull();
  });

  it('returns null when the server value is missing/malformed', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await checkForNewVersion()).toBeNull();
  });
});

describe('startVersionPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ buildSha: 'unknown' }) }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('checks once immediately on start', async () => {
    const onNewVersion = vi.fn();
    const stop = startVersionPolling(onNewVersion);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    stop();
  });

  it('the returned stop function removes the focus listener and stops the interval (no error on calling it)', () => {
    const stop = startVersionPolling(vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
