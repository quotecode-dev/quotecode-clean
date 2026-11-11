// Owner 2026-11-11 (findings 17 + 21): phone examples and the display of a stored phone follow the country code - an Israeli example in
// Israel, a US example for +1 - and a US / Canada number is shown grouped like an Israeli one is ("+1 (202) 555-0143", as 050-2993806).
// Display only: the stored value ("<dial> <number>", utils/phoneDial.js joinPhone) never changes.

/** The example inside a phone field after its country code. */
export function phonePlaceholder(dial) {
  if (dial === '+972') return '50-1234567';
  if (dial === '+1') return '(555) 123-4567';
  return '1234 567890';
}

/** "+1 2025550143" / "+1 202-555-0143" -> "+1 (202) 555-0143"; every other value is returned trimmed, unchanged. */
export function formatIntlPhoneDisplay(phone) {
  const raw = String(phone ?? '').trim();
  const m = raw.match(/^\+1[\s-]*(.*)$/);
  if (!m) return raw;
  const digits = m[1].replace(/\D/g, '');
  if (digits.length !== 10) return raw;
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
