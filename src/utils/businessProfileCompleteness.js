import { isValidEmailAddress } from './emailAddress';
// Post-LIVE Priority 1, Fix B (business profile completeness gate, 2026-09-16):
// a fresh business can sign up and reach the app with business_settings.phone
// and .tax_id both empty - Public Quote then silently hides the Call/
// WhatsApp actions (phone) and the business profile stays incomplete for
// future invoicing (tax ID). Per Owner direction: do NOT block signup or
// entering the app - gate only the first NEW quote's save/send completion.
//
// HE/Local: require both phone and tax ID (ordinary Israeli business
// identity, via the existing single tax_id field - no new column, no format
// validation beyond non-empty, since no canonical validated format rule
// exists yet in this project to reuse safely).
//
// EN/International: require phone only. tax_id is deliberately NOT required
// here - the concept of a business tax/registration identifier varies too
// widely across jurisdictions to safely hard-require universally without a
// dedicated Owner product decision; requiring it uniformly risked blocking
// legitimate International businesses/sole-proprietors who have none. This
// mirrors the explicit "STOP and report" instruction for that specific
// sub-case rather than inventing a global tax rule.
// SettingsTab.jsx's phone field always writes `${dialCode} ${localNumber}`
// (see handleLocalPhoneChange) - even when the local number itself is
// blank, bizPhone ends up as e.g. "+1 " rather than a true empty string.
// A plain non-empty check would then treat a dial-code-only value as a
// real phone number. Stripping a leading "+<digits>" dial code before
// checking for any remaining content closes that gap.
// Owner 2026-10-18: a number stored WITHOUT the space ("+972501234567") was stripped whole by /^\+\d+\s*/ and blocked the
// first quote although Settings showed the phone. Only a dial code ALONE ("+972", "+1") is missing; the dial code is stripped
// only when a space separates it from the rest.
function hasMeaningfulPhone(phone) {
  const trimmed = String(phone || '').trim();
  if (trimmed === '') return false;
  if (/^\+\d{1,4}$/.test(trimmed)) return false;
  const withoutLeadingDialCode = trimmed.replace(/^\+\d{1,4}\s+/, '');
  return withoutLeadingDialCode.trim() !== '';
}

// Owner 2026-10-25 (typed L-15): the business name (the sign-up default "עסק חדש" / "New Business" counts as missing) and the business
// e-mail (the address the customer's reply goes to) are required too - checked only when the caller passes them.
const DEFAULT_BUSINESS_NAMES = Object.freeze(['עסק חדש', 'new business']);
export function getMissingBusinessProfileFields({ phone, taxId, isLocalIsraeliBusiness, name, email }) {
  const hasPhone = hasMeaningfulPhone(phone);
  const hasTaxId = String(taxId || '').trim() !== '';

  const missing = [];
  if (!hasPhone) missing.push('phone');
  if (isLocalIsraeliBusiness && !hasTaxId) missing.push('taxId');
  if (name !== undefined) {
    const n = String(name || '').trim();
    if (!n || DEFAULT_BUSINESS_NAMES.includes(n.toLowerCase())) missing.push('name');
  }
  if (email !== undefined && !isValidEmailAddress(email)) missing.push('email');
  return missing;
}

export function getBusinessProfileGateMessage({ phone, taxId, isLocalIsraeliBusiness, isHebrew, name, email }) {
  const missing = getMissingBusinessProfileFields({ phone, taxId, isLocalIsraeliBusiness, name, email });
  if (missing.length === 0) return null;

  const missingPhone = missing.includes('phone');
  const missingTaxId = missing.includes('taxId');

  if (isHebrew) {
    const parts = [];
    if (missingPhone) parts.push('טלפון העסק');
    if (missingTaxId) parts.push('ח.פ / עוסק מורשה / פטור');
    if (missing.includes('name')) parts.push('שם העסק');
    if (missing.includes('email')) parts.push('מייל העסק');
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ו${parts[parts.length - 1]}` : parts[0];
    return `❌ לפני יצירת הצעת מחיר ראשונה יש להשלים בהגדרות העסק: ${list}.${name !== undefined ? ' אחרי המילוי לוחצים „שמירת הגדרות העסק”, וחוזרים להצעה.' : ''}`;
  }

  const parts = [];
  if (missingPhone) parts.push('Business Phone');
  if (missingTaxId) parts.push('Tax ID');
  if (missing.includes('name')) parts.push('Business Name');
  if (missing.includes('email')) parts.push('Business Email');
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `❌ Before creating your first quote, please complete in Business Settings: ${list}.${name !== undefined ? ' Then press “Save Business Settings” and you will return to your quote.' : ''}`;
}
