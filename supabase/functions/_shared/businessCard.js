// DIGITAL BUSINESS CARD CONTRACT (Task 23 + Task 24, PROFLOW_TODO.md Phase 5: a clean public/mobile HE/EN page with TEKANGO identity,
// business contact details, logo, share link and QR, WITHOUT exposing private business data).
// ONE pure module shared by the public Edge Function `get-business-card` (Deno), the owner editor and the public page (Vite):
//   - the card is addressed by the business owner's user_id (an unguessable UUID). business_settings.id is a sequential bigint and is
//     never used, so cards cannot be enumerated.
//   - business_settings supplies the business name, phone, email, address and logo (existing fields); public.business_cards (Task 24,
//     owner-only) supplies the optional card fields, the per-channel publish choices and the card style.
//   - PUBLISHING IS OPT-IN: a contact channel appears only when the detail exists AND its show_* flag is on (all off by default); an
//     empty optional field is simply not shown. Never tax id, plan, role, email-integration keys, trial/subscription data or ids.
//   - language follows the account market (Local -> he, International -> en); the style applies to the business card ONLY.

export const BUSINESS_CARD_CONTRACT_VERSION = 2;
export const BUSINESS_CARD_COLUMNS = 'business_name, phone, email, address, logo_url, country';
export const BUSINESS_CARD_PROFILE_COLUMNS = 'display_name, job_title, slogan, about, photo_url, show_phone, show_whatsapp, show_email, show_address, style';
export const CARD_STYLES = Object.freeze(['classic', 'modern', 'visual']);
export const CARD_FIELD_LIMITS = Object.freeze({ displayName: 120, jobTitle: 80, slogan: 120, about: 600 });
export const MAX_PHOTO_CHARS = 700000; // ~500 KB as base64 - the existing logo upload rule
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_DEFAULT_NAMES = new Set(['proflow']); // the column default of a business that never entered a name
const PHOTO_RE = /^(https:\/\/\S+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/;

export const isBusinessCardId = (id) => typeof id === 'string' && UUID_RE.test(id);

const oneLine = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const multiLine = (v, max) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');

// Business settings store the address as "street|city|state|zip" (or older free text) - shown as one readable line.
export function formatCardAddress(address) {
  if (typeof address !== 'string') return '';
  return oneLine(address.split('|').map((p) => p.trim()).filter(Boolean).join(', '), 200);
}

const safeLogo = (v) => (typeof v === 'string' && (/^https:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(v)) ? v : '');
const safePhoto = (v) => (typeof v === 'string' && v.length <= MAX_PHOTO_CHARS && PHOTO_RE.test(v) ? v : '');

// The app's own WhatsApp deep-link rule (Dashboard.jsx WhatsApp sharing): digits only; "00" -> international; a leading local "0" is
// Israeli (+972) only for a Local business; otherwise 9-15 digits with an explicit international prefix. No guess -> no WhatsApp link.
export function whatsappNumber(phone, language) {
  if (typeof phone !== 'string') return '';
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  else if (p.startsWith('0')) { if (language !== 'he') return ''; p = `+972${p.slice(1)}`; }
  else if (/^\d{9,15}$/.test(p)) p = `+${p}`;
  const digits = p.startsWith('+') ? p.slice(1) : '';
  return /^\d{9,15}$/.test(digits) ? digits : '';
}
export const whatsappUrl = (phone, language) => { const n = whatsappNumber(phone, language); return n ? `https://api.whatsapp.com/send?phone=${n}` : ''; };

// public.business_cards row -> editor/profile shape (all publish flags off and Classic when there is no row yet).
export function normalizeCardProfile(row) {
  const r = row && typeof row === 'object' ? row : {};
  return {
    displayName: oneLine(r.display_name, CARD_FIELD_LIMITS.displayName),
    jobTitle: oneLine(r.job_title, CARD_FIELD_LIMITS.jobTitle),
    slogan: oneLine(r.slogan, CARD_FIELD_LIMITS.slogan),
    about: multiLine(r.about, CARD_FIELD_LIMITS.about),
    photoUrl: safePhoto(r.photo_url),
    showPhone: r.show_phone === true,
    showWhatsapp: r.show_whatsapp === true,
    showEmail: r.show_email === true,
    showAddress: r.show_address === true,
    style: CARD_STYLES.includes(r.style) ? r.style : 'classic',
  };
}

// Editor shape -> the row to store (trimmed; empty -> NULL), with the same limits the migration checks. { ok, row } or { ok:false, errors }.
export function cardProfileToRow(profile) {
  const p = profile || {};
  const errors = [];
  const text = (key, column, max, multi = false) => {
    const raw = typeof p[key] === 'string' ? p[key] : '';
    const v = multi ? multiLine(raw, max + 1) : oneLine(raw, max + 1);
    if (v.length > max) errors.push(column);
    return v ? v.slice(0, max) : null;
  };
  const row = {
    display_name: text('displayName', 'display_name', CARD_FIELD_LIMITS.displayName),
    job_title: text('jobTitle', 'job_title', CARD_FIELD_LIMITS.jobTitle),
    slogan: text('slogan', 'slogan', CARD_FIELD_LIMITS.slogan),
    about: text('about', 'about', CARD_FIELD_LIMITS.about, true),
    photo_url: p.photoUrl ? (safePhoto(p.photoUrl) || (errors.push('photo_url'), null)) : null,
    show_phone: p.showPhone === true,
    show_whatsapp: p.showWhatsapp === true,
    show_email: p.showEmail === true,
    show_address: p.showAddress === true,
    style: CARD_STYLES.includes(p.style) ? p.style : (errors.push('style'), 'classic'),
  };
  return errors.length ? { ok: false, errors } : { ok: true, row };
}

// business_settings row (+ optional business_cards row) -> the public card, or null when nothing is publishable (no real name, or the
// market is not resolved).
export function projectBusinessCard(settingsRow, profileRow = null) {
  if (!settingsRow || typeof settingsRow !== 'object') return null;
  if (settingsRow.country !== 'Local' && settingsRow.country !== 'International') return null;
  const profile = normalizeCardProfile(profileRow);
  const ownName = oneLine(settingsRow.business_name, 120);
  const businessName = profile.displayName || (ownName && !LEGACY_DEFAULT_NAMES.has(ownName.toLowerCase()) ? ownName : '');
  if (!businessName) return null;
  const language = settingsRow.country === 'Local' ? 'he' : 'en';
  const phone = oneLine(settingsRow.phone, 40);
  const email = oneLine(settingsRow.email, 160);
  const address = formatCardAddress(settingsRow.address);
  return {
    businessName,
    jobTitle: profile.jobTitle,
    slogan: profile.slogan,
    about: profile.about,
    photoUrl: profile.photoUrl,
    logoUrl: safeLogo(settingsRow.logo_url),
    style: profile.style,
    phone: profile.showPhone ? phone : '',
    whatsappUrl: profile.showWhatsapp ? whatsappUrl(phone, language) : '',
    email: profile.showEmail ? email : '',
    address: profile.showAddress ? address : '',
    language,
  };
}

export function businessCardPath(userId) { return `/card/${userId}`; }

// Browser-side re-check of the server answer (defence in depth): only the contract fields survive.
export function sanitizeBusinessCardResponse(data) {
  if (!data || typeof data !== 'object' || data.contractVersion !== BUSINESS_CARD_CONTRACT_VERSION || !data.card) return null;
  const c = data.card;
  const businessName = oneLine(c.businessName, 120);
  if (!businessName || (c.language !== 'he' && c.language !== 'en')) return null;
  const wa = typeof c.whatsappUrl === 'string' && /^https:\/\/api\.whatsapp\.com\/send\?phone=\d{9,15}$/.test(c.whatsappUrl) ? c.whatsappUrl : '';
  return {
    businessName,
    jobTitle: oneLine(c.jobTitle, CARD_FIELD_LIMITS.jobTitle),
    slogan: oneLine(c.slogan, CARD_FIELD_LIMITS.slogan),
    about: multiLine(c.about, CARD_FIELD_LIMITS.about),
    photoUrl: safePhoto(c.photoUrl),
    logoUrl: safeLogo(c.logoUrl),
    style: CARD_STYLES.includes(c.style) ? c.style : 'classic',
    phone: oneLine(c.phone, 40),
    whatsappUrl: wa,
    email: oneLine(c.email, 160),
    address: oneLine(c.address, 200),
    language: c.language,
  };
}
