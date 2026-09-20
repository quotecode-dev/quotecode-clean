import { describe, it, expect } from 'vitest';
import { formatMessageTime, formatDaySeparatorLabel, computeDaySeparatorFlags } from './aiChatHistoryFormat.js';

const NOW = new Date('2026-09-18T14:32:00');
const TODAY_ISO = '2026-09-18T09:05:00.000Z';
const YESTERDAY_ISO = '2026-09-17T09:05:00.000Z';
const TWO_DAYS_AGO_ISO = '2026-09-16T09:05:00.000Z';

describe('formatMessageTime', () => {
  it('returns null for a message with no createdAt (legacy history)', () => {
    expect(formatMessageTime(undefined, true)).toBeNull();
    expect(formatMessageTime(null, false)).toBeNull();
  });

  it('returns null for an invalid date string rather than throwing', () => {
    expect(formatMessageTime('not-a-date', true)).toBeNull();
  });

  it('returns a real HH:MM-shaped time for a valid timestamp, HE and EN', () => {
    const he = formatMessageTime(TODAY_ISO, true);
    const en = formatMessageTime(TODAY_ISO, false);
    expect(he).toMatch(/^\d{1,2}:\d{2}$/);
    expect(en).toMatch(/^\d{1,2}:\d{2}$/);
  });
});

describe('formatDaySeparatorLabel', () => {
  it('returns null for a message with no createdAt', () => {
    expect(formatDaySeparatorLabel(undefined, true, NOW)).toBeNull();
  });

  it('labels a same-day message "היום" in HE and "Today" in EN', () => {
    expect(formatDaySeparatorLabel(TODAY_ISO, true, NOW)).toBe('היום');
    expect(formatDaySeparatorLabel(TODAY_ISO, false, NOW)).toBe('Today');
  });

  it('labels the prior calendar day "אתמול" in HE and "Yesterday" in EN', () => {
    expect(formatDaySeparatorLabel(YESTERDAY_ISO, true, NOW)).toBe('אתמול');
    expect(formatDaySeparatorLabel(YESTERDAY_ISO, false, NOW)).toBe('Yesterday');
  });

  it('falls back to a localized full date for anything older than yesterday', () => {
    const he = formatDaySeparatorLabel(TWO_DAYS_AGO_ISO, true, NOW);
    const en = formatDaySeparatorLabel(TWO_DAYS_AGO_ISO, false, NOW);
    expect(he).not.toBe('היום');
    expect(he).not.toBe('אתמול');
    expect(en).not.toBe('Today');
    expect(en).not.toBe('Yesterday');
    expect(he.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });
});

describe('computeDaySeparatorFlags', () => {
  it('flags the first dated message and no others when all messages share one day', () => {
    const messages = [
      { role: 'assistant', content: 'hi', createdAt: TODAY_ISO },
      { role: 'user', content: 'hello', createdAt: TODAY_ISO },
      { role: 'assistant', content: 'ok', createdAt: TODAY_ISO },
    ];
    expect(computeDaySeparatorFlags(messages, NOW)).toEqual([true, false, false]);
  });

  it('flags exactly the message where the calendar day actually changes', () => {
    const messages = [
      { role: 'assistant', content: 'a', createdAt: YESTERDAY_ISO },
      { role: 'user', content: 'b', createdAt: YESTERDAY_ISO },
      { role: 'assistant', content: 'c', createdAt: TODAY_ISO },
      { role: 'user', content: 'd', createdAt: TODAY_ISO },
    ];
    expect(computeDaySeparatorFlags(messages, NOW)).toEqual([true, false, true, false]);
  });

  it('never flags and never resets the tracker for a message without createdAt (legacy)', () => {
    const messages = [
      { role: 'assistant', content: 'legacy welcome' }, // no createdAt at all
      { role: 'user', content: 'legacy question' }, // no createdAt at all
      { role: 'assistant', content: 'new dated message', createdAt: TODAY_ISO },
      { role: 'user', content: 'another same-day message', createdAt: TODAY_ISO },
    ];
    expect(computeDaySeparatorFlags(messages, NOW)).toEqual([false, false, true, false]);
  });

  it('does not duplicate a separator for two consecutive same-day messages after a day change', () => {
    const messages = [
      { role: 'assistant', content: 'a', createdAt: TWO_DAYS_AGO_ISO },
      { role: 'assistant', content: 'b', createdAt: YESTERDAY_ISO },
      { role: 'assistant', content: 'c', createdAt: YESTERDAY_ISO },
      { role: 'assistant', content: 'd', createdAt: YESTERDAY_ISO },
    ];
    expect(computeDaySeparatorFlags(messages, NOW)).toEqual([true, true, false, false]);
  });

  it('returns an all-false array of the correct length for an all-legacy (undated) history', () => {
    const messages = [
      { role: 'assistant', content: 'a' },
      { role: 'user', content: 'b' },
    ];
    expect(computeDaySeparatorFlags(messages, NOW)).toEqual([false, false]);
  });
});
