// Task 23 (Phase 5): digital business card - client statuses, the card component, the owner screen, the public page and the Settings entry.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublicBusinessCard, businessCardShareUrl, businessCardFunctionUrl } from './utils/businessCardClient';
import BusinessCard from './components/BusinessCard';
import BusinessCardSettings from './components/BusinessCardSettings';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
const ID = '00000000-0000-4000-8000-0000000000a1';
const httpError = (status, body) => ({ name: 'FunctionsHttpError', context: { status, clone: () => ({ json: async () => body }) } });
const client = (invoke) => ({ functions: { url: 'https://ljfizgrdyzxddswcedwr.supabase.co/functions/v1', invoke } });
// Task 24: contract v2 (opt-in channels, card fields, style)
const CARD_OK = { contractVersion: 2, ok: true, card: { businessName: 'עסק בדיקה סינתטי', jobTitle: '', slogan: '', about: '', photoUrl: '', logoUrl: '', style: 'classic', phone: '+972 50-000-0000', whatsappUrl: '', email: 'qa@example.test', address: 'רחוב הבדיקה 1, חיפה', language: 'he' } };
const PROFILE_STUB = (over = {}) => ({ load: 'ok', exists: false, saved: {}, draft: { displayName: '', jobTitle: '', slogan: '', about: '', photoUrl: '', showPhone: true, showWhatsapp: false, showEmail: true, showAddress: true, style: 'classic' }, saveStatus: 'idle', styleStatus: 'idle', dirty: false, update: vi.fn(), save: vi.fn(), chooseStyle: vi.fn(), ...over });

afterEach(() => cleanup());

describe('fetchPublicBusinessCard', () => {
  it('sends only the card id and returns the sanitized card', async () => {
    const invoke = vi.fn(async () => ({ data: CARD_OK, error: null }));
    expect(await fetchPublicBusinessCard(client(invoke), ID)).toEqual({ status: 'ok', card: CARD_OK.card });
    expect(invoke).toHaveBeenCalledWith('get-business-card', { body: { id: ID } });
  });
  it('tells our uniform 404 (not_found) from a server without the function (not_deployed)', async () => {
    expect(await fetchPublicBusinessCard(client(async () => ({ data: null, error: httpError(404, { contractVersion: 2, ok: false, code: 'not_found' }) })), ID)).toEqual({ status: 'not_found' });
    expect(await fetchPublicBusinessCard(client(async () => ({ data: null, error: httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }) })), ID)).toEqual({ status: 'not_deployed' });
    expect(await fetchPublicBusinessCard(client(async () => ({ data: null, error: httpError(500, {}) })), ID)).toEqual({ status: 'server_error' });
  });
  it('a fetch-level failure: server answers -> service_unreachable, nothing answers -> unavailable (Task 22 rule)', async () => {
    const fetchFail = async () => ({ data: null, error: { name: 'FunctionsFetchError' } });
    expect(await fetchPublicBusinessCard(client(fetchFail), ID, { fetchImpl: async () => ({ type: 'opaque' }) })).toEqual({ status: 'service_unreachable' });
    expect(await fetchPublicBusinessCard(client(fetchFail), ID, { fetchImpl: async () => { throw new TypeError('x'); } })).toEqual({ status: 'unavailable' });
  });
  it('a non-UUID id never calls the server', async () => {
    const invoke = vi.fn();
    expect(await fetchPublicBusinessCard(client(invoke), '7')).toEqual({ status: 'not_found' });
    expect(invoke).not.toHaveBeenCalled();
  });
  it('share link = origin + /card/<user id UUID>; function URL as functions-js posts it', () => {
    expect(businessCardShareUrl(ID, 'https://www.tekango.com')).toBe(`https://www.tekango.com/card/${ID}`);
    expect(businessCardShareUrl('7', 'https://www.tekango.com')).toBeNull();
    expect(businessCardFunctionUrl(client())).toBe('https://ljfizgrdyzxddswcedwr.supabase.co/functions/v1/get-business-card');
  });
});

describe('BusinessCard', () => {
  it('HE card: RTL, name, LTR-isolated phone/email links, address, QR, TEKANGO identity - only public fields', () => {
    render(<BusinessCard card={CARD_OK.card} shareUrl={`https://www.tekango.com/card/${ID}`} onShare={() => {}} onCopy={() => {}} />);
    const card = screen.getByTestId('business-card');
    expect(card.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('heading', { name: 'עסק בדיקה סינתטי' })).toBeTruthy();
    expect(card.querySelector('a[href="tel:+972500000000"] bdi[dir="ltr"]').textContent).toBe('+972 50-000-0000');
    expect(card.querySelector('a[href="mailto:qa@example.test"]')).toBeTruthy();
    expect(screen.getByText('רחוב הבדיקה 1, חיפה')).toBeTruthy();
    expect(screen.getByTestId('business-card-qr').querySelector('path').getAttribute('d').length).toBeGreaterThan(100);
    expect(screen.getByText('כרטיס ביקור דיגיטלי ב-TEKANGO')).toBeTruthy();
  });
  it('EN card: LTR copy; fields that are empty are simply not shown', () => {
    render(<BusinessCard card={{ ...CARD_OK.card, language: 'en', email: '', address: '' }} shareUrl={null} />);
    expect(screen.getByTestId('business-card').getAttribute('dir')).toBe('ltr');
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByTestId('business-card-qr')).toBeNull();
    expect(screen.getByText('Digital business card by TEKANGO')).toBeTruthy();
  });
});

describe('BusinessCardSettings (owner screen)', () => {
  const props = (over = {}) => ({ isHebrew: true, isLocalIsraeliBusiness: true, userId: ID, bizName: 'עסק בדיקה סינתטי', bizPhone: '+972 50-000-0000', bizEmail: 'qa@example.test', bizAddress: 'רחוב הבדיקה 1|חיפה||', bizLogoUrl: '', onBack: vi.fn(), profile: PROFILE_STUB(), ...over });
  it.each([
    ['ok', async () => ({ data: CARD_OK, error: null }), 'הדף הציבורי של הכרטיס פעיל'],
    ['not_deployed', async () => ({ data: null, error: httpError(404, { code: 'NOT_FOUND' }) }), 'עדיין לא זמין בשרת הזה'],
    ['not_found', async () => ({ data: null, error: httpError(404, { contractVersion: 2, code: 'not_found' }) }), 'עוד לא מציג את הכרטיס'],
  ])('public page status %s is stated truthfully', async (status, invoke, text) => {
    render(<BusinessCardSettings {...props({ client: client(invoke) })} />);
    await waitFor(() => expect(screen.getByTestId('business-card-public-status').getAttribute('data-status')).toBe(status));
    expect(screen.getByTestId('business-card-public-status').textContent).toContain(text);
    expect(screen.getByTestId('business-card-link').value).toBe(`${window.location.origin}/card/${ID}`);
    expect(screen.getByTestId('business-card-preview')).toBeTruthy();
  });
  it('without a business name it asks for one instead of showing an empty card; back returns to settings', async () => {
    const p = props({ bizName: '', client: client(async () => ({ data: null, error: httpError(404, { contractVersion: 2 }) })) });
    render(<BusinessCardSettings {...p} />);
    expect(screen.getByTestId('business-card-needs-name')).toBeTruthy();
    expect(screen.queryByTestId('business-card-preview')).toBeNull();
    fireEvent.click(screen.getByTestId('business-card-back'));
    expect(p.onBack).toHaveBeenCalled();
  });
  it('copy puts the share link on the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<BusinessCardSettings {...props({ client: client(async () => ({ data: CARD_OK, error: null })) })} />);
    fireEvent.click(screen.getByTestId('business-card-preview-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/card/${ID}`));
    await waitFor(() => expect(screen.getAllByText('הקישור הועתק').length).toBeGreaterThan(0)); // Task 24: the top Share button shares the copied feedback
  });
});

describe('public page /card/:id', () => {
  it('overrides an existing robots meta and restores it on leave', async () => {
    const pre = document.createElement('meta'); pre.name = 'robots'; pre.content = 'index, follow'; document.head.appendChild(pre);
    vi.resetModules();
    vi.doMock('./shared/supabase', () => ({ supabase: { functions: { url: 'https://x.supabase.co/functions/v1', invoke: async () => ({ data: CARD_OK, error: null }) } } }));
    const { default: Page } = await import('./pages/PublicBusinessCard');
    const view = render(<MemoryRouter initialEntries={[`/card/${ID}`]}><Routes><Route path="/card/:id" element={<Page bundleIsHebrew />} /></Routes></MemoryRouter>);
    expect(pre.content).toBe('noindex, nofollow');
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    view.unmount();
    expect(pre.content).toBe('index, follow');
    pre.remove(); vi.doUnmock('./shared/supabase');
  });
  it.each([
    ['ok', { data: CARD_OK, error: null }, 'עסק בדיקה סינתטי'],
    ['not_deployed', { data: null, error: httpError(404, { code: 'NOT_FOUND' }) }, 'כרטיסי ביקור דיגיטליים עדיין לא זמינים בשרת הזה.'],
    ['not_found', { data: null, error: httpError(404, { contractVersion: 2, code: 'not_found' }) }, 'כרטיס הביקור לא נמצא'],
  ])('%s', async (_s, answer, text) => {
    vi.resetModules();
    vi.doMock('./shared/supabase', () => ({ supabase: { functions: { url: 'https://x.supabase.co/functions/v1', invoke: async () => answer } } }));
    const { default: PublicBusinessCard } = await import('./pages/PublicBusinessCard');
    render(<MemoryRouter initialEntries={[`/card/${ID}`]}><Routes><Route path="/card/:id" element={<PublicBusinessCard bundleIsHebrew />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(text, { exact: false })).toBeTruthy());
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    vi.doUnmock('./shared/supabase');
  });
});

describe('Settings entry and routes (source guards)', () => {
  it('the card button is a separate entry placed AFTER Reminders & automation in one wrapping row (visually left in RTL)', () => {
    const src = read('components/SettingsTab.jsx');
    const row = src.slice(src.indexOf('className="pf-settings-entries"'), src.indexOf("setView('businessCard')") + 200);
    expect(row.indexOf("setView('reminders')")).toBeGreaterThan(-1);
    expect(row.indexOf("setView('reminders')")).toBeLessThan(row.indexOf("setView('businessCard')"));
    expect(src).toContain("flexWrap: 'wrap'");
    expect(src).toContain("data-testid=\"settings-open-business-card\"");
  });
  it('/card/:id is routed in both app shells and the Dashboard passes the owner user id', () => {
    expect(read('local/AppLocal.jsx')).toContain('<Route path="/card/:id" element={<PublicBusinessCard bundleIsHebrew={true} />} />');
    expect(read('global/AppGlobal.jsx')).toContain('<Route path="/card/:id" element={<PublicBusinessCard bundleIsHebrew={false} />} />');
    expect(read('pages/Dashboard.jsx')).toMatch(/businessCardClient=\{supabase\}\s*\r?\n\s*businessCardUserId=\{session\?\.user\?\.id\}/);
  });
});
