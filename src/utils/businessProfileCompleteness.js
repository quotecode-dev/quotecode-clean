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
function hasMeaningfulPhone(phone) {
  const trimmed = String(phone || '').trim();
  if (trimmed === '') return false;
  const withoutLeadingDialCode = trimmed.replace(/^\+\d+\s*/, '');
  return withoutLeadingDialCode.trim() !== '';
}

export function getMissingBusinessProfileFields({ phone, taxId, isLocalIsraeliBusiness }) {
  const hasPhone = hasMeaningfulPhone(phone);
  const hasTaxId = String(taxId || '').trim() !== '';

  const missing = [];
  if (!hasPhone) missing.push('phone');
  if (isLocalIsraeliBusiness && !hasTaxId) missing.push('taxId');
  return missing;
}

export function getBusinessProfileGateMessage({ phone, taxId, isLocalIsraeliBusiness, isHebrew }) {
  const missing = getMissingBusinessProfileFields({ phone, taxId, isLocalIsraeliBusiness });
  if (missing.length === 0) return null;

  const missingPhone = missing.includes('phone');
  const missingTaxId = missing.includes('taxId');

  if (isHebrew) {
    const parts = [];
    if (missingPhone) parts.push('טלפון עסק');
    if (missingTaxId) parts.push('ח.פ / עוסק מורשה / פטור');
    return `❌ לפני יצירת הצעת מחיר ראשונה יש להשלים בהגדרות העסק: ${parts.join(' ו')}.`;
  }

  const parts = [];
  if (missingPhone) parts.push('Business Phone');
  if (missingTaxId) parts.push('Tax ID');
  return `❌ Before creating your first quote, please complete in Business Settings: ${parts.join(' and ')}.`;
}
