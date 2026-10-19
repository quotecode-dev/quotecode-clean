// Owner 2026-10-19 ("הקידומת אמורה להיות לפי הגדרות העסק אם המשתמש מלונדון אז קידומות של לונדון"): the client window's phone prefix
// follows the business (the same rule as the quote form: an Israeli business = +972, otherwise by the business currency); a phone that
// already carries its own prefix keeps it (editing a London client's number never rewrites it as +1).
const BY_CURRENCY = Object.freeze({
  ILS: { dial: '+972', label: 'IL (+972)' },
  GBP: { dial: '+44', label: 'GB (+44)' },
  EUR: { dial: '+49', label: 'DE (+49)' },
  CAD: { dial: '+1', label: 'CA (+1)' },
  AUD: { dial: '+61', label: 'AU (+61)' },
  USD: { dial: '+1', label: 'US (+1)' },
});
const BY_DIAL = Object.freeze({ '+972': 'IL', '+44': 'GB', '+49': 'DE', '+61': 'AU', '+33': 'FR', '+34': 'ES', '+39': 'IT', '+31': 'NL', '+353': 'IE', '+41': 'CH', '+43': 'AT', '+32': 'BE' });

/** The business's own prefix: Israel = +972; otherwise by the business currency (unknown -> USD, the International default). */
export function businessDial({ isLocal, currency }) {
  if (isLocal === true) return BY_CURRENCY.ILS;
  return BY_CURRENCY[String(currency || '').toUpperCase()] || BY_CURRENCY.USD;
}

/** A stored phone's own prefix ("+44 20 7946 0958" -> { dial: '+44', label: 'GB (+44)', local: '20 7946 0958' }), else null. */
export function storedDial(phone, { currency } = {}) {
  const m = String(phone || '').trim().match(/^(\+\d{1,4})\s+(.*)$/);
  if (!m) return null;
  const dial = m[1];
  const code = dial === '+1' ? (String(currency || '').toUpperCase() === 'CAD' ? 'CA' : 'US') : BY_DIAL[dial];
  return { dial, label: code ? `${code} (${dial})` : dial, local: m[2].trim() };
}
