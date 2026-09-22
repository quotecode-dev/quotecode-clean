import { formatShortDate, deviceCalendarDate } from './shortDate';
// AI Chat History UX (timestamps + day separators) - pure, framework-agnostic
// helpers so day-separator/legacy-compatibility logic is directly unit-
// testable without mounting AIChatWidget. Mirrors this project's own
// existing locale convention for message-adjacent times (see
// UserDetailsModal.jsx / PublicQuote.jsx: 'he-IL' for Hebrew, 'en-GB' for
// English - both render 24-hour time by default, matching this task's own
// "localized 24-hour time" requirement without hardcoding one locale
// globally).
//
// Never fabricates a time/date for a message that lacks `createdAt` (legacy
// history predating this feature, or any future malformed entry) - such
// messages simply render with no time badge and never trigger a day
// separator, per this task's own explicit "do not invent a fake time" rule.

function toValidDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMessageTime(isoString, isHebrew) {
  const date = toValidDate(isoString);
  if (!date) return null;
  return date.toLocaleTimeString(isHebrew ? 'he-IL' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDaySeparatorLabel(isoString, isHebrew, now = new Date()) {
  const date = toValidDate(isoString);
  if (!date) return null;
  if (isSameLocalDay(date, now)) return isHebrew ? 'היום' : 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return isHebrew ? 'אתמול' : 'Yesterday';
  // IRON-DATE-001: the device's own day (Today/Yesterday are device-relative), ordered by the market (DD/MM/YYYY | MM/DD/YYYY).
  return formatShortDate(deviceCalendarDate(date), isHebrew ? 'Local' : 'International');
}

// Returns a boolean array (same length as `messages`) - true at index i means
// "render a day separator immediately before message i". Only messages with
// a valid `createdAt` participate; a message without one never receives or
// triggers a separator, and never resets the "last known day" tracker (so a
// legacy gap in the middle of history can't cause a spurious/duplicate
// separator once real dates resume).
export function computeDaySeparatorFlags(messages) {
  const flags = new Array(messages.length).fill(false);
  let lastKnownDay = null;
  messages.forEach((msg, idx) => {
    const date = toValidDate(msg?.createdAt);
    if (!date) return;
    if (!lastKnownDay || !isSameLocalDay(date, lastKnownDay)) {
      flags[idx] = true;
    }
    lastKnownDay = date;
  });
  return flags;
}
