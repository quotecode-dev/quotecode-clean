// Task 26 (Owner correction 2026-10-11): Classic / Modern with images / Visual are QUOTE presentation styles. Business settings → "quote
// design" shows, on every selection, the approved sample quote rendered by the REAL customer page (PublicQuote / PublicQuoteEn,
// previewMode) in that style - immediately, without saving or leaving the screen. Included styles still become the business default (the
// existing server-enforced set_default); a style outside the tier is previewed "preview only" and never becomes the default. Nothing here
// reads or writes the digital business card.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import BusinessQuoteStyleSection from './components/quotePresentation/BusinessQuoteStyleSection';
import { presentationCopy } from './components/quotePresentation/presentationCopy';
import { buildSampleQuote } from './quoteDocument/sampleQuotes';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
afterEach(() => cleanup());
// the customer page uses the router (as inside the Dashboard)
const render = (ui) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const ctl = (over = {}) => {
  const lang = over.lang || 'he';
  return { copy: presentationCopy(lang), lang, context: { status: 'ready' }, tier: 'classic', businessDefault: 'classic', makeDefault: vi.fn(async () => ({ ok: true })), reloadContext: vi.fn(), ...over };
};
const preview = () => screen.getByTestId('qp-settings-preview');
const docStyle = () => preview().querySelector('.pq-card').getAttribute('data-pq-style');
const card = (style) => screen.getByTestId(`qp-default-style-select-${style}`);

describe('Business settings - quote design live preview', () => {
  it('opens on the business default and renders the real sample quote document (HE / ILS page)', () => {
    render(<BusinessQuoteStyleSection ctl={ctl()} />);
    expect(preview().getAttribute('data-preview-style')).toBe('classic');
    expect(docStyle()).toBe('classic');
    expect(preview().querySelector('.pq-page').getAttribute('dir')).toBe('rtl');
    const sample = buildSampleQuote({ locale: 'he', style: 'classic' });
    expect(preview().textContent).toContain(sample.quoteData.business.business_name);
    expect(screen.getByTestId('qp-default-style-previewed-classic')).toBeTruthy();
    expect(screen.getByTestId('qp-settings-preview-label').textContent).toContain('לא על כרטיס הביקור הדיגיטלי');
  });

  it('each of the three selections immediately shows that style; locked styles are preview-only and never become the default', async () => {
    const c = ctl();
    render(<BusinessQuoteStyleSection ctl={c} />);
    for (const style of ['modern', 'visual']) {
      await act(async () => { fireEvent.click(card(style)); });
      expect(preview().getAttribute('data-preview-style')).toBe(style);
      expect(docStyle()).toBe(style);
      expect(screen.getByTestId(`qp-default-style-previewed-${style}`)).toBeTruthy();
      expect(screen.getByTestId('qp-settings-preview-label').textContent).toBe(presentationCopy('he').previewOnlyLabel);
      expect(screen.getByTestId(`qp-default-style-card-${style}`).className).toContain('is-locked');
    }
    await act(async () => { fireEvent.click(card('classic')); });
    expect(docStyle()).toBe('classic');
    expect(c.makeDefault).not.toHaveBeenCalled(); // classic already is the default; locked styles never are
    expect(screen.queryByRole('dialog')).toBeNull(); // no modal covers the preview
  });

  it('an included style becomes the business default (existing server path) AND is previewed at once', async () => {
    const c = ctl({ tier: 'visual', lang: 'en' });
    render(<BusinessQuoteStyleSection ctl={c} />);
    expect(preview().querySelector('.pq-page').getAttribute('dir')).toBe('ltr'); // EN / International page
    await act(async () => { fireEvent.click(card('modern')); });
    expect(c.makeDefault).toHaveBeenCalledWith('modern');
    expect(docStyle()).toBe('modern');
    expect(screen.getByTestId('qp-settings-preview-label').textContent).toBe(presentationCopy('en').settingsPreviewNote);
    expect(within(screen.getByTestId('qp-settings-default-style')).getByText(presentationCopy('en').defaultSaved('Modern with images'))).toBeTruthy();
  });

  it('the section is named as quote design in both languages', () => {
    expect(presentationCopy('he').settingsSectionTitle).toBe('עיצוב הצעות המחיר');
    expect(presentationCopy('en').settingsSectionTitle).toBe('Quote design');
    expect(read('components/SettingsTab.jsx')).toContain(".settingsSectionTitle}");
  });

  it('the preview uses the real renderer and the approved sample, and never the business card', () => {
    const src = read('components/quotePresentation/SettingsQuotePreview.jsx');
    expect(src).toMatch(/import PublicQuote from '\.\.\/\.\.\/pages\/PublicQuote'/);
    expect(src).toMatch(/import PublicQuoteEn from '\.\.\/\.\.\/pages\/PublicQuoteEn'/);
    expect(src).toMatch(/buildSampleQuote/);
    expect(src).toMatch(/previewMode/);
    for (const f of ['components/quotePresentation/SettingsQuotePreview.jsx', 'components/quotePresentation/BusinessQuoteStyleSection.jsx', 'components/quotePresentation/QuoteStylePicker.jsx']) {
      expect(read(f)).not.toMatch(/BusinessCard|businessCard|business_cards|Reminder/);
    }
    for (const f of ['components/BusinessCard.jsx', 'components/BusinessCardSettings.jsx', 'hooks/useBusinessCardProfile.js', 'pages/PublicBusinessCard.jsx']) {
      expect(read(f)).not.toMatch(/quotePresentation|QuoteStylePicker|quoteStyles|PublicQuote/);
    }
  });
});
