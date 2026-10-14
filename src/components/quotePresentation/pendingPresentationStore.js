// Task 16 - presentation choices whose server save did not happen after the quote itself was saved (function
// unavailable, saved record unknown, network). Kept on THIS device (localStorage, keyed by user + quote, 30-day TTL)
// and re-applied as an unsaved change when that quote is opened again, so the next Save retries it. Falls back to
// memory when storage is blocked - callers are told which, so the owner-facing wording stays true.
const PREFIX = 'tekango:quote-presentation-pending:v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const memory = new Map();

const keyFor = (userId, quoteId) => `${PREFIX}:${userId}:${quoteId}`;
function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// Returns 'device' when written to durable storage, 'memory' when only kept for this session.
export function stashPendingPresentation(userId, quoteId, value) {
  if (!userId || !quoteId) return 'memory';
  const k = keyFor(userId, quoteId);
  memory.set(k, value);
  try {
    const s = storage();
    if (!s) return 'memory';
    s.setItem(k, JSON.stringify({ v: 1, at: Date.now(), value }));
    return 'device';
  } catch {
    return 'memory';
  }
}

export function takePendingPresentation(userId, quoteId, now = Date.now()) {
  if (!userId || !quoteId) return null;
  const k = keyFor(userId, quoteId);
  let value = memory.has(k) ? memory.get(k) : null;
  memory.delete(k);
  try {
    const s = storage();
    const raw = s ? s.getItem(k) : null;
    if (raw) {
      s.removeItem(k);
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1 && Number.isFinite(parsed.at) && now - parsed.at <= TTL_MS && parsed.value && typeof parsed.value === 'object') value = parsed.value;
    }
  } catch { /* corrupt / blocked: memory value (if any) stands */ }
  return value;
}

export function clearPendingPresentation(userId, quoteId) {
  if (!userId || !quoteId) return;
  const k = keyFor(userId, quoteId);
  memory.delete(k);
  try { storage()?.removeItem(k); } catch { /* ignore */ }
}

// Explicit logout: nothing of this user's pending choices stays on the device.
export function purgePendingPresentations(userId) {
  if (!userId) return;
  const prefix = `${PREFIX}:${userId}:`;
  for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  try {
    const s = storage();
    if (!s) return;
    const keys = [];
    for (let i = 0; i < s.length; i += 1) { const k = s.key(i); if (k && k.startsWith(prefix)) keys.push(k); }
    keys.forEach((k) => s.removeItem(k));
  } catch { /* ignore */ }
}

export function __resetPendingForTests() {
  memory.clear();
}
