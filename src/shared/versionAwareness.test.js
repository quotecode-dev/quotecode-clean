import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkForNewVersion, startVersionPolling, newerDeployedSha } from './versionAwareness';

// Owner 2026-10-15: on the 5186 working preview "Refresh" never cleared the banner after a commit (dev server: the bundle keeps
// the SHA it started with, version.json follows HEAD) - a working preview never shows it; LIVE / frozen builds keep it.
describe('newerDeployedSha', () => {
  it('a different deployed SHA on LIVE / a frozen build is a new version', () => {
    expect(newerDeployedSha({ buildSha: 'b'.repeat(40), servesWorkingTree: false }, 'a'.repeat(40))).toBe('b'.repeat(40));
    expect(newerDeployedSha({ buildSha: 'b'.repeat(40) }, 'a'.repeat(40))).toBe('b'.repeat(40));
  });
  it('a working preview (servesWorkingTree:true) never shows the banner', () => {
    expect(newerDeployedSha({ buildSha: 'b'.repeat(40), servesWorkingTree: true, dirty: true }, 'a'.repeat(40))).toBeNull();
  });
  it('same SHA, unknown values or a missing payload -> no banner', () => {
    expect(newerDeployedSha({ buildSha: 'a'.repeat(40) }, 'a'.repeat(40))).toBeNull();
    expect(newerDeployedSha({ buildSha: 'unknown' }, 'a'.repeat(40))).toBeNull();
    expect(newerDeployedSha({ buildSha: 'b'.repeat(40) }, 'unknown')).toBeNull();
    expect(newerDeployedSha(null, 'a'.repeat(40))).toBeNull();
  });
});

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

// TEST 5186 focus-loop incident (2026-10-09): focus bursts while a /version.json check is pending must not open more requests.
const flushMicrotasks = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

describe('startVersionPolling single-flight', () => {
  let release;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => ({ buildSha: 'unknown' }) }); })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a burst of focus events during an active fetch creates no extra fetch; checks resume after it settles', async () => {
    const stop = startVersionPolling(vi.fn());
    expect(fetch).toHaveBeenCalledTimes(1); // the immediate start-up check, still pending
    for (let i = 0; i < 50; i += 1) window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(5 * 60 * 1000); // the interval tick also joins the pending check
    expect(fetch).toHaveBeenCalledTimes(1);
    release();
    await flushMicrotasks();
    window.dispatchEvent(new Event('focus'));
    expect(fetch).toHaveBeenCalledTimes(2);
    release();
    stop();
  });

  it('keeps the 5-minute interval check', async () => {
    const stop = startVersionPolling(vi.fn());
    release();
    await flushMicrotasks();
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    release();
    stop();
  });

  it('still reports a newer version to the callback exactly once per check', async () => {
    const onNewVersion = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ buildSha: 'unknown' }) }));
    const stop = startVersionPolling(onNewVersion);
    for (let i = 0; i < 10; i += 1) window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(onNewVersion).not.toHaveBeenCalled(); // CURRENT_BUILD_SHA is 'unknown' under test: never a false positive
    stop();
  });
});
