import { describe, it, expect, beforeEach } from 'vitest';
import {
  AI_CHAT_SCHEMA_VERSION,
  AI_CHAT_MAX_STORED_MESSAGES,
  buildPublicChatStorageKey,
  readStoredPublicTranscript,
  writeStoredPublicTranscript,
  clearStoredPublicTranscript,
  createChatContextGuard,
} from './aiChatSession';

beforeEach(() => {
  sessionStorage.clear();
});

describe('buildPublicChatStorageKey', () => {
  it('HE and EN resolve to distinct keys (market/locale partitioning)', () => {
    const he = buildPublicChatStorageKey({ isHebrew: true });
    const en = buildPublicChatStorageKey({ isHebrew: false });
    expect(he).not.toBe(en);
  });

  it('bakes the schema version into the key itself', () => {
    expect(buildPublicChatStorageKey({ isHebrew: true })).toContain(`v${AI_CHAT_SCHEMA_VERSION}`);
  });
});

describe('public transcript storage contract', () => {
  it('round-trips a valid transcript', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    const messages = [
      { role: 'assistant', content: 'שלום' },
      { role: 'user', content: 'שאלה' },
    ];
    writeStoredPublicTranscript(key, messages);
    expect(readStoredPublicTranscript(key)).toEqual(messages);
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredPublicTranscript(buildPublicChatStorageKey({ isHebrew: false }))).toBeNull();
  });

  it('HE storage does not leak into EN storage (separate keys)', () => {
    const heKey = buildPublicChatStorageKey({ isHebrew: true });
    const enKey = buildPublicChatStorageKey({ isHebrew: false });
    writeStoredPublicTranscript(heKey, [{ role: 'assistant', content: 'עברית' }]);
    expect(readStoredPublicTranscript(enKey)).toBeNull();
  });

  it('rejects corrupt JSON (falls back safely to null, not a throw)', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    sessionStorage.setItem(key, '{not valid json');
    expect(() => readStoredPublicTranscript(key)).not.toThrow();
    expect(readStoredPublicTranscript(key)).toBeNull();
  });

  it('rejects a payload with the wrong/missing schema version (legacy data is orphaned, not migrated)', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    sessionStorage.setItem(key, JSON.stringify({ messages: [{ role: 'assistant', content: 'hi' }] }));
    expect(readStoredPublicTranscript(key)).toBeNull();

    sessionStorage.setItem(key, JSON.stringify({ schemaVersion: 1, messages: [{ role: 'assistant', content: 'hi' }] }));
    expect(readStoredPublicTranscript(key)).toBeNull();
  });

  it('rejects an oversized stored transcript', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    const tooMany = Array.from({ length: AI_CHAT_MAX_STORED_MESSAGES + 1 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    sessionStorage.setItem(key, JSON.stringify({ schemaVersion: AI_CHAT_SCHEMA_VERSION, messages: tooMany }));
    expect(readStoredPublicTranscript(key)).toBeNull();
  });

  it('rejects an invalid role in a stored message', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: AI_CHAT_SCHEMA_VERSION,
      messages: [{ role: 'system', content: 'not allowed' }],
    }));
    expect(readStoredPublicTranscript(key)).toBeNull();
  });

  it('rejects non-string content in a stored message', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: AI_CHAT_SCHEMA_VERSION,
      messages: [{ role: 'user', content: 12345 }],
    }));
    expect(readStoredPublicTranscript(key)).toBeNull();
  });

  it('writeStoredPublicTranscript bounds to the last N messages', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    const many = Array.from({ length: AI_CHAT_MAX_STORED_MESSAGES + 10 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    writeStoredPublicTranscript(key, many);
    const stored = readStoredPublicTranscript(key);
    expect(stored).toHaveLength(AI_CHAT_MAX_STORED_MESSAGES);
    expect(stored[stored.length - 1].content).toBe(`m${AI_CHAT_MAX_STORED_MESSAGES + 9}`);
  });

  it('clearStoredPublicTranscript removes the entry', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    writeStoredPublicTranscript(key, [{ role: 'assistant', content: 'hi' }]);
    clearStoredPublicTranscript(key);
    expect(readStoredPublicTranscript(key)).toBeNull();
  });

  // AI Chat History UX task: `createdAt` is a new, optional, additive field.
  it('round-trips a transcript whose messages carry createdAt', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    const messages = [
      { role: 'assistant', content: 'שלום', createdAt: '2026-09-18T09:00:00.000Z' },
      { role: 'user', content: 'שאלה', createdAt: '2026-09-18T09:01:00.000Z' },
    ];
    writeStoredPublicTranscript(key, messages);
    expect(readStoredPublicTranscript(key)).toEqual(messages);
  });

  it('still accepts a legacy transcript with no createdAt on any message (pre-existing history)', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: AI_CHAT_SCHEMA_VERSION,
      messages: [{ role: 'assistant', content: 'legacy, no timestamp' }],
    }));
    expect(readStoredPublicTranscript(key)).toEqual([{ role: 'assistant', content: 'legacy, no timestamp' }]);
  });

  it('rejects a non-string createdAt rather than silently accepting a malformed value', () => {
    const key = buildPublicChatStorageKey({ isHebrew: true });
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: AI_CHAT_SCHEMA_VERSION,
      messages: [{ role: 'assistant', content: 'hi', createdAt: 12345 }],
    }));
    expect(readStoredPublicTranscript(key)).toBeNull();
  });
});

describe('createChatContextGuard', () => {
  it('starts at generation 0 and is not stale for the initial token', () => {
    const guard = createChatContextGuard();
    expect(guard.current()).toBe(0);
    expect(guard.isStale(0)).toBe(false);
  });

  it('reset() bumps the generation and makes the previously captured token stale', () => {
    const guard = createChatContextGuard();
    const token = guard.current();
    guard.reset();
    expect(guard.isStale(token)).toBe(true);
    expect(guard.isStale(guard.current())).toBe(false);
  });

  it('a reply captured before a reset is discarded (stale) after logout/market-change/reset', () => {
    const guard = createChatContextGuard();
    const requestToken = guard.current(); // captured at send-time
    guard.reset(); // logout / market change / explicit reset
    // the in-flight reply, when it resolves, must be recognized as stale
    expect(guard.isStale(requestToken)).toBe(true);
  });

  it('multiple resets keep only the latest generation current', () => {
    const guard = createChatContextGuard();
    const firstToken = guard.current();
    guard.reset();
    const secondToken = guard.current();
    guard.reset();
    expect(guard.isStale(firstToken)).toBe(true);
    expect(guard.isStale(secondToken)).toBe(true);
    expect(guard.isStale(guard.current())).toBe(false);
  });
});
