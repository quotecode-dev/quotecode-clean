import { describe, it, expect, vi } from 'vitest';
import { scheduleFirstViewRecord } from './firstView';

function fakeDoc(state = 'visible') {
  const listeners = new Set();
  return {
    visibilityState: state,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    set(s) { this.visibilityState = s; listeners.forEach((fn) => fn()); },
    get listenerCount() { return listeners.size; },
  };
}

describe('first-view recording waits for real visibility', () => {
  it('records once after 5s visible', () => {
    vi.useFakeTimers();
    const doc = fakeDoc('visible');
    const record = vi.fn();
    scheduleFirstViewRecord({ record, doc, now: () => Date.now() });
    vi.advanceTimersByTime(4999);
    expect(record).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(record).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60000);
    expect(record).toHaveBeenCalledTimes(1);
    expect(doc.listenerCount).toBe(0);
    vi.useRealTimers();
  });
  it('a page that is never shown (background tab / prerender) records nothing', () => {
    vi.useFakeTimers();
    const record = vi.fn();
    scheduleFirstViewRecord({ record, doc: fakeDoc('hidden'), now: () => Date.now() });
    vi.advanceTimersByTime(60000);
    expect(record).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('visible time accumulates across tab switches', () => {
    vi.useFakeTimers();
    const doc = fakeDoc('visible');
    const record = vi.fn();
    scheduleFirstViewRecord({ record, doc, now: () => Date.now() });
    vi.advanceTimersByTime(3000);
    doc.set('hidden');
    vi.advanceTimersByTime(30000);
    expect(record).not.toHaveBeenCalled();
    doc.set('visible');
    vi.advanceTimersByTime(1999);
    expect(record).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(record).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('cancel (leaving the page) stops it', () => {
    vi.useFakeTimers();
    const record = vi.fn();
    const cancel = scheduleFirstViewRecord({ record, doc: fakeDoc('visible'), now: () => Date.now() });
    vi.advanceTimersByTime(2000);
    cancel();
    vi.advanceTimersByTime(10000);
    expect(record).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
