// Task 24: digital business card editor - profile storage client, the ONE profile state, the card and the editor tabs.
// Task 26 (Owner correction 2026-10-11): Classic / Modern with images / Visual are QUOTE presentation styles, never business-card styles -
// the card has ONE presentation, the editor has no design tab, Business settings has no card style section, and a style value a local row
// may carry is passed back unchanged and never rendered.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCardProfile, saveCardProfile } from './utils/businessCardProfileClient';
import { useBusinessCardProfile } from './hooks/useBusinessCardProfile';
import BusinessCard from './components/BusinessCard';
import BusinessCardSettings from './components/BusinessCardSettings';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
const ID = '00000000-0000-4000-8000-0000000000a1';
const MISSING = { code: 'PGRST205', message: "Could not find the table 'public.business_cards' in the schema cache" };
const ROW = { display_name: 'דנה', job_title: 'מתקינה', slogan: null, about: null, photo_url: null, show_phone: true, show_whatsapp: false, show_email: false, show_address: false, style: 'modern' };

// minimal Supabase table double recording reads / writes
function table({ loadResult = { data: ROW, error: null }, saveResult } = {}) {
  const calls = { selects: [], upserts: [] };
  const from = (name) => {
    const q = {
      select(cols) { calls.selects.push({ name, cols }); return q; },
      eq(k, v) { q.eq_ = [k, v]; return q; },
      maybeSingle: async () => loadResult,
      upsert(row, opts) { calls.upserts.push({ name, row, opts }); return { select: () => ({ single: async () => saveResult ?? { data: { ...row }, error: null } }) }; },
    };
    return q;
  };
  return { client: { from, functions: { url: 'https://x.supabase.co/functions/v1', invoke: async () => ({ data: null, error: { name: 'FunctionsHttpError', context: { status: 404, clone: () => ({ json: async () => ({ code: 'NOT_FOUND' }) }) } } }) } }, calls };
}

afterEach(() => cleanup());

describe('profile storage client (contract unchanged; the local, unapplied migration keeps its columns)', () => {
  it('loads the owner row with the explicit column list; missing table -> unavailable', async () => {
    const t = table();
    const r = await loadCardProfile(t.client, ID);
    expect(r.status).toBe('ok');
    expect(r.exists).toBe(true);
    expect(t.calls.selects[0]).toEqual({ name: 'business_cards', cols: 'display_name, job_title, slogan, about, photo_url, show_phone, show_whatsapp, show_email, show_address, style' });
    expect((await loadCardProfile(table({ loadResult: { data: null, error: MISSING } }).client, ID)).status).toBe('unavailable');
    expect((await loadCardProfile(table({ loadResult: { data: null, error: null } }).client, ID))).toMatchObject({ status: 'ok', exists: false });
  });
  it('saves exactly the contract row for the owner (upsert on user_id); invalid input is never sent', async () => {
    const t = table();
    const r = await saveCardProfile(t.client, ID, { displayName: ' דנה ', jobTitle: '', showPhone: true, style: 'classic' });
    expect(r.status).toBe('ok');
    expect(t.calls.upserts).toEqual([{ name: 'business_cards', row: { user_id: ID, display_name: 'דנה', job_title: null, slogan: null, about: null, photo_url: null, show_phone: true, show_whatsapp: false, show_email: false, show_address: false, style: 'classic' }, opts: { onConflict: 'user_id' } }]);
    const bad = table();
    expect(await saveCardProfile(bad.client, ID, { about: 'x'.repeat(601), style: 'classic' })).toEqual({ status: 'invalid', errors: ['about'] });
    expect(bad.calls.upserts).toHaveLength(0);
    expect((await saveCardProfile(table({ saveResult: { data: null, error: MISSING } }).client, ID, { style: 'classic' })).status).toBe('unavailable');
  });
});

describe('useBusinessCardProfile - one state, save; no style choice (Task 26)', () => {
  it('edits stay in the draft until save; a stored style value is passed back unchanged, never changed by the card flow', async () => {
    const t = table();
    const { result } = renderHook(() => useBusinessCardProfile(t.client, ID));
    await waitFor(() => expect(result.current.load).toBe('ok'));
    expect(result.current.chooseStyle).toBeUndefined();
    expect(result.current.styleStatus).toBeUndefined();
    act(() => result.current.update({ slogan: 'חדש' }));
    expect(result.current.dirty).toBe(true);
    await act(async () => { await result.current.save(); });
    expect(t.calls.upserts).toHaveLength(1);
    expect(t.calls.upserts[0].row).toMatchObject({ slogan: 'חדש', display_name: 'דנה', style: 'modern' }); // untouched, not reinterpreted
    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.dirty).toBe(false);
  });
  it('without the table on this server: edits work in the session, save reports unavailable', async () => {
    const t = table({ loadResult: { data: null, error: MISSING }, saveResult: { data: null, error: MISSING } });
    const { result } = renderHook(() => useBusinessCardProfile(t.client, ID));
    await waitFor(() => expect(result.current.load).toBe('unavailable'));
    act(() => result.current.update({ jobTitle: 'מתקין' }));
    expect(result.current.draft.jobTitle).toBe('מתקין');
    await act(async () => { await result.current.save(); });
    expect(result.current.saveStatus).toBe('unavailable');
  });
});

describe('BusinessCard - ONE presentation', () => {
  const base = { businessName: 'עסק', jobTitle: 'מתקין', slogan: 'סלוגן', about: 'אודות', photoUrl: '', logoUrl: '', phone: '', whatsappUrl: '', email: '', address: '', language: 'he' };
  it('the same card whatever style value a row carries (classic / modern / visual / missing); complete without any image', () => {
    const html = [];
    for (const style of ['classic', 'modern', 'visual', undefined]) {
      const { unmount } = render(<BusinessCard card={{ ...base, style }} />);
      const card = screen.getByTestId('business-card');
      expect(card.className).toBe('pf-bcard');
      expect(card.hasAttribute('data-style')).toBe(false);
      expect(card.querySelector('.pf-bcard-banner')).toBeNull();
      expect(screen.getByRole('heading', { name: 'עסק' })).toBeTruthy();
      expect(card.querySelector('.pf-bcard-head img')).toBeNull(); // only the TEKANGO identity logo (footer) is an image
      expect(card.querySelector('.pf-bcard-initial')).toBeTruthy();
      html.push(card.outerHTML);
      unmount();
    }
    expect(new Set(html).size).toBe(1);
  });
  it('the avatar is the business photo first, else its logo', () => {
    const photo = 'data:image/png;base64,iVBORw0KGgo=';
    const logo = 'https://example.test/logo.png';
    const { unmount } = render(<BusinessCard card={{ ...base, photoUrl: photo, logoUrl: logo }} />);
    expect(screen.getByTestId('business-card').querySelector('.pf-bcard-avatar').getAttribute('src')).toBe(photo);
    unmount();
    render(<BusinessCard card={{ ...base, logoUrl: logo }} />);
    expect(screen.getByTestId('business-card').querySelector('.pf-bcard-avatar').getAttribute('src')).toBe(logo);
  });
  it('shows only the channels present in the card; WhatsApp opens the app link in a new tab', () => {
    render(<BusinessCard card={{ ...base, phone: '+972 50-000-0000', whatsappUrl: 'https://api.whatsapp.com/send?phone=972500000000' }} />);
    const card = screen.getByTestId('business-card');
    expect([...card.querySelectorAll('[data-channel]')].map((e) => e.getAttribute('data-channel'))).toEqual(['phone', 'whatsapp']);
    const wa = card.querySelector('[data-channel=whatsapp]');
    expect(wa.getAttribute('href')).toBe('https://api.whatsapp.com/send?phone=972500000000');
    expect(wa.getAttribute('target')).toBe('_blank');
    expect(wa.getAttribute('rel')).toContain('noopener');
  });
  it('the card source carries no style variants any more', () => {
    expect(read('components/BusinessCard.jsx')).not.toMatch(/pf-bcard--|card\.style|pf-bcard-banner/);
  });
});

describe('BusinessCardSettings - the editor', () => {
  const profileState = (over = {}) => ({ load: 'ok', exists: false, saved: {}, draft: { displayName: '', jobTitle: '', slogan: '', about: '', photoUrl: '', showPhone: false, showWhatsapp: false, showEmail: false, showAddress: false, style: 'classic' }, saveStatus: 'idle', dirty: false, update: vi.fn(), save: vi.fn(), ...over });
  const props = (over = {}) => ({ isHebrew: true, isLocalIsraeliBusiness: true, userId: ID, client: table().client, bizName: 'עסק בדיקה סינתטי', bizPhone: '+972 50-000-0000', bizEmail: '', bizAddress: 'רחוב הבדיקה 1|חיפה||', bizLogoUrl: '', onBack: vi.fn(), profile: profileState(), ...over });

  it('create title, TWO tabs (no design tab), no style choice and no quote preview; company fields edit the draft', () => {
    const p = props();
    render(<BusinessCardSettings {...p} />);
    expect(screen.getByTestId('business-card-title').textContent).toContain('יצירת כרטיס ביקור');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['פרטי חברה', 'דרכי תקשורת']);
    expect(screen.queryByTestId('card-tab-design')).toBeNull();
    const root = screen.getByTestId('business-card-settings');
    expect(root.querySelector('[data-style], [role=radiogroup], [data-pq-style], .qp-card')).toBeNull();
    expect(root.textContent).not.toMatch(/Classic|Modern|Visual|עיצוב|סגנון/);
    expect(screen.getByText('כל השדות כאן לא חובה. שדה ריק פשוט לא יופיע בכרטיס.')).toBeTruthy();
    fireEvent.change(screen.getByTestId('card-field-slogan'), { target: { value: 'חלונות שמתאימים' } });
    expect(p.profile.update).toHaveBeenCalledWith({ slogan: 'חלונות שמתאימים' });
  });
  it('edit title once a card exists; the live preview renders the draft (a stored style value changes nothing)', () => {
    render(<BusinessCardSettings {...props({ profile: profileState({ exists: true, draft: { ...profileState().draft, displayName: 'דנה כהן', jobTitle: 'מתקינה', style: 'visual' } }) })} />);
    expect(screen.getByTestId('business-card-title').textContent).toContain('עריכת כרטיס ביקור');
    const preview = screen.getByTestId('business-card-preview');
    expect(preview.className).toBe('pf-bcard');
    expect(preview.textContent).toContain('דנה כהן');
    expect(preview.textContent).toContain('מתקינה');
  });
  it('contact options: offered only when the detail exists; ticking calls update; nothing is shown before opting in', () => {
    const p = props();
    render(<BusinessCardSettings {...p} />);
    fireEvent.click(screen.getByTestId('card-tab-channels'));
    expect(screen.getByTestId('card-channel-email').disabled).toBe(true); // no email in Business settings
    expect(screen.getByText('אין אימייל בהגדרות העסק')).toBeTruthy();
    expect(screen.getByTestId('card-channel-phone').disabled).toBe(false);
    expect(screen.getByTestId('card-channel-whatsapp').disabled).toBe(false);
    expect(screen.getByTestId('business-card-preview').querySelectorAll('[data-channel]')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('card-channel-phone'));
    expect(p.profile.update).toHaveBeenCalledWith({ showPhone: true });
  });
  it('save is disabled while saving is not available on this server', () => {
    render(<BusinessCardSettings {...props({ profile: profileState({ load: 'unavailable', dirty: true }) })} />);
    expect(screen.getByTestId('business-card-save-unavailable').textContent).toContain('עדיין לא זמינה בשרת הזה');
    expect(screen.getByTestId('card-save').disabled).toBe(true);
  });
  it('a photo larger than 500KB or of another type is refused with a message', async () => {
    render(<BusinessCardSettings {...props()} />);
    const input = screen.getByTestId('card-photo-input');
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } });
    expect(await screen.findByText('אפשר להעלות רק PNG, JPG או WebP.')).toBeTruthy();
    const big = new File([new Uint8Array(500 * 1024 + 1)], 'big.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText('התמונה גדולה מ-500KB. בחרו קובץ קטן יותר.')).toBeTruthy();
  });
});

describe('Business settings layout (source guards)', () => {
  const src = read('components/SettingsTab.jsx');
  it('no card style section and no card style picker; the editor keeps the shared card profile', () => {
    expect(src).not.toMatch(/settings-card-style|BusinessCardStylePicker|chooseStyle|styleSectionTitle/);
    expect(fs.existsSync(path.resolve(HERE, 'components/BusinessCardStylePicker.jsx'))).toBe(false);
    expect(src).toContain('profile={cardProfile}');
  });
  it('the card profile is never wired into quotes, quote presentation, PDFs or reminders', () => {
    for (const f of ['components/QuoteForm.jsx', 'pages/Dashboard.jsx', 'components/RemindersSettings.jsx', 'components/quotePresentation/BusinessQuoteStyleSection.jsx', 'components/quotePresentation/SettingsQuotePreview.jsx', 'pages/PublicQuote.jsx', 'pages/PublicQuoteEn.jsx']) {
      expect(read(f)).not.toMatch(/useBusinessCardProfile|BusinessCardStylePicker|business_cards|BusinessCard\b/);
    }
  });
});
