// Task 23 + Task 24: the digital business card contract - only public, opted-in fields ever leave the server.
import { describe, it, expect } from 'vitest';
import {
  projectBusinessCard, formatCardAddress, isBusinessCardId, sanitizeBusinessCardResponse, BUSINESS_CARD_COLUMNS, BUSINESS_CARD_PROFILE_COLUMNS,
  businessCardPath, normalizeCardProfile, cardProfileToRow, whatsappNumber, whatsappUrl, BUSINESS_CARD_CONTRACT_VERSION, CARD_STYLES,
} from './businessCard.js';

const SETTINGS = {
  business_name: '  עסק בדיקה   סינתטי ', phone: '+972 50-000-0000', email: 'qa@example.test', address: 'רחוב הבדיקה 1|חיפה||3100000',
  logo_url: 'https://example.test/logo.png', country: 'Local',
  tax_id: 'TAX-SECRET', plan: 'PLAN-SECRET', role: 'ROLE-SECRET', emailjs_public_key: 'EMAILJS-SECRET', trial_ends_at: 'TRIAL-SECRET', user_id: 'USER-SECRET', id: 987654,
};
const PROFILE = { display_name: 'דנה כהן', job_title: 'מתקינה', slogan: 'חלונות שמתאימים', about: 'עסק משפחתי.\nמאז 2010.', photo_url: 'data:image/png;base64,iVBORw0KGgo=',
  show_phone: true, show_whatsapp: true, show_email: false, show_address: true, style: 'modern' };

describe('projectBusinessCard', () => {
  it('without a profile: name + logo only - every contact channel stays unpublished (opt-in)', () => {
    const card = projectBusinessCard(SETTINGS);
    expect(card).toEqual({ businessName: 'עסק בדיקה סינתטי', jobTitle: '', slogan: '', about: '', photoUrl: '', logoUrl: 'https://example.test/logo.png', style: 'classic',
      phone: '', whatsappUrl: '', email: '', address: '', language: 'he' });
  });
  it('with a profile: the card name, texts, photo, style and ONLY the opted-in channels; nothing private', () => {
    const card = projectBusinessCard(SETTINGS, PROFILE);
    expect(card).toEqual({ businessName: 'דנה כהן', jobTitle: 'מתקינה', slogan: 'חלונות שמתאימים', about: 'עסק משפחתי.\nמאז 2010.', photoUrl: 'data:image/png;base64,iVBORw0KGgo=',
      logoUrl: 'https://example.test/logo.png', style: 'modern', phone: '+972 50-000-0000', whatsappUrl: 'https://api.whatsapp.com/send?phone=972500000000', email: '', address: 'רחוב הבדיקה 1, חיפה, 3100000', language: 'he' });
    expect(JSON.stringify(card)).not.toMatch(/SECRET|987654/);
  });
  it('an opted-in channel without the underlying detail is not shown', () => {
    const card = projectBusinessCard({ ...SETTINGS, phone: '', email: '', address: '' }, { ...PROFILE, show_email: true });
    expect([card.phone, card.whatsappUrl, card.email, card.address]).toEqual(['', '', '', '']);
  });
  it('no card without a real name (settings or card name) or a resolved market', () => {
    expect(projectBusinessCard({ ...SETTINGS, business_name: '' })).toBeNull();
    expect(projectBusinessCard({ ...SETTINGS, business_name: 'ProFlow' })).toBeNull();
    expect(projectBusinessCard({ ...SETTINGS, business_name: '' }, { display_name: 'Card name' }).businessName).toBe('Card name');
    expect(projectBusinessCard({ ...SETTINGS, country: 'Unknown' }, PROFILE)).toBeNull();
    expect(projectBusinessCard(null)).toBeNull();
  });
  it('photo and logo are kept only as safe image URLs', () => {
    expect(projectBusinessCard(SETTINGS, { ...PROFILE, photo_url: 'javascript:alert(1)' }).photoUrl).toBe('');
    expect(projectBusinessCard(SETTINGS, { ...PROFILE, photo_url: 'data:image/svg+xml;base64,PHN2Zz4=' }).photoUrl).toBe('');
    expect(projectBusinessCard({ ...SETTINGS, logo_url: 'http://insecure.test/x.png' }).logoUrl).toBe('');
  });
  it('the server reads explicit column lists (never *) without private columns', () => {
    expect(BUSINESS_CARD_COLUMNS).toBe('business_name, phone, email, address, logo_url, country');
    expect(BUSINESS_CARD_PROFILE_COLUMNS).toBe('display_name, job_title, slogan, about, photo_url, show_phone, show_whatsapp, show_email, show_address, style');
    expect(CARD_STYLES).toEqual(['classic', 'modern', 'visual']);
  });
});

describe('WhatsApp - the app\'s own deep-link rule, no guessing', () => {
  it.each([
    ['+972 50-000-0000', 'he', '972500000000'],
    ['050-000-0000', 'he', '972500000000'],
    ['00972500000000', 'en', '972500000000'],
    ['+1 (555) 010-0100', 'en', '15550100100'],
    ['050-000-0000', 'en', ''], // a local leading 0 is resolved only for an Israeli (Local) business
    ['12345', 'he', ''],
    ['', 'he', ''],
  ])('%s (%s) -> %s', (phone, lang, expected) => {
    expect(whatsappNumber(phone, lang)).toBe(expected);
    expect(whatsappUrl(phone, lang)).toBe(expected ? `https://api.whatsapp.com/send?phone=${expected}` : '');
  });
});

describe('profile <-> row', () => {
  it('no row -> every flag off, Classic', () => {
    expect(normalizeCardProfile(null)).toEqual({ displayName: '', jobTitle: '', slogan: '', about: '', photoUrl: '', showPhone: false, showWhatsapp: false, showEmail: false, showAddress: false, style: 'classic' });
  });
  it('stores trimmed values, empty as NULL, booleans strict', () => {
    const r = cardProfileToRow({ displayName: '  Dana  ', jobTitle: '', slogan: ' ', about: ' a\n\n\n\nb ', photoUrl: '', showPhone: true, showWhatsapp: 'yes', style: 'visual' });
    expect(r).toEqual({ ok: true, row: { display_name: 'Dana', job_title: null, slogan: null, about: 'a\n\nb', photo_url: null, show_phone: true, show_whatsapp: false, show_email: false, show_address: false, style: 'visual' } });
  });
  it('refuses over-long text, a bad photo and an unknown style (same limits as the migration)', () => {
    expect(cardProfileToRow({ displayName: 'x'.repeat(121), style: 'classic' })).toEqual({ ok: false, errors: ['display_name'] });
    expect(cardProfileToRow({ about: 'x'.repeat(601), style: 'classic' }).errors).toEqual(['about']);
    expect(cardProfileToRow({ photoUrl: 'http://x.test/a.png', style: 'classic' }).errors).toEqual(['photo_url']);
    expect(cardProfileToRow({ style: 'neon' }).errors).toEqual(['style']);
  });
});

describe('ids, address and the browser re-check', () => {
  it('only an owner user_id UUID is a card id', () => {
    expect(isBusinessCardId('00000000-0000-4000-8000-0000000000a1')).toBe(true);
    expect(isBusinessCardId('7')).toBe(false);
    expect(businessCardPath('00000000-0000-4000-8000-0000000000a1')).toBe('/card/00000000-0000-4000-8000-0000000000a1');
  });
  it('formats "street|city|state|zip" and plain addresses', () => {
    expect(formatCardAddress('1 Test St|Springfield|IL|62701')).toBe('1 Test St, Springfield, IL, 62701');
    expect(formatCardAddress(null)).toBe('');
  });
  it('keeps only contract fields of the current contract version', () => {
    const card = projectBusinessCard(SETTINGS, PROFILE);
    expect(BUSINESS_CARD_CONTRACT_VERSION).toBe(2);
    expect(sanitizeBusinessCardResponse({ contractVersion: 2, card: { ...card, tax_id: 'x' } })).toEqual(card);
    expect(sanitizeBusinessCardResponse({ contractVersion: 1, card })).toBeNull();
    expect(sanitizeBusinessCardResponse({ contractVersion: 2, card: { ...card, whatsappUrl: 'https://evil.test/?phone=1' } }).whatsappUrl).toBe('');
    expect(sanitizeBusinessCardResponse({ contractVersion: 2, card: { ...card, style: 'neon' } }).style).toBe('classic');
  });
});
