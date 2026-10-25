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

// Owner 2026-10-25 (typed L-01, L-09): the country codes an International business can choose (the default still follows its currency)
export const DIAL_CHOICES = Object.freeze([
  { dial: '+1', label: 'US / CA (+1)' }, { dial: '+44', label: 'GB (+44)' }, { dial: '+353', label: 'IE (+353)' }, { dial: '+49', label: 'DE (+49)' },
  { dial: '+33', label: 'FR (+33)' }, { dial: '+34', label: 'ES (+34)' }, { dial: '+39', label: 'IT (+39)' }, { dial: '+31', label: 'NL (+31)' },
  { dial: '+32', label: 'BE (+32)' }, { dial: '+41', label: 'CH (+41)' }, { dial: '+43', label: 'AT (+43)' }, { dial: '+351', label: 'PT (+351)' },
  { dial: '+30', label: 'GR (+30)' }, { dial: '+45', label: 'DK (+45)' }, { dial: '+46', label: 'SE (+46)' }, { dial: '+47', label: 'NO (+47)' },
  { dial: '+48', label: 'PL (+48)' }, { dial: '+61', label: 'AU (+61)' }, { dial: '+64', label: 'NZ (+64)' }, { dial: '+27', label: 'ZA (+27)' },
  { dial: '+972', label: 'IL (+972)' },
]);

/** The business's own prefix: Israel = +972; an International business = the code of its own saved phone (its choice, Owner 2026-10-25),
 *  else by its currency (unknown -> USD, the International default). */
export function businessDial({ isLocal, currency, businessPhone = null }) {
  if (isLocal === true) return BY_CURRENCY.ILS;
  const own = storedDial(businessPhone, { currency });
  if (own) return { dial: own.dial, label: (DIAL_CHOICES.find((c) => c.dial === own.dial) || own).label };
  return BY_CURRENCY[String(currency || '').toUpperCase()] || BY_CURRENCY.USD;
}

/** "<dial> <number>" with the national trunk 0 removed after the country code ("+972" + "050-1234567" -> "+972 50-1234567"), Owner 2026-10-25. */
export function joinPhone(dial, local) {
  const n = String(local ?? '').trim().replace(/^0+(?=\d)/, '');
  return `${dial} ${n}`;
}

/** A stored phone's own prefix ("+44 20 7946 0958" -> { dial: '+44', label: 'GB (+44)', local: '20 7946 0958' }), else null. */
export function storedDial(phone, { currency } = {}) {
  const m = String(phone || '').trim().match(/^(\+\d{1,4})\s+(.*)$/);
  if (!m) return null;
  const dial = m[1];
  const code = dial === '+1' ? (String(currency || '').toUpperCase() === 'CAD' ? 'CA' : 'US') : BY_DIAL[dial];
  return { dial, label: code ? `${code} (${dial})` : dial, local: m[2].trim() };
}
