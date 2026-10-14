// Task 30: Settings › "My subscription" (server-truthful state, ONE package, monthly / annual, one price, saving, availability; no plans
// button), the AI modal header (title never under the AI action) and the business-settings layout (ONE scroll body, auto-height preview,
// compact footer). Live geometry is proven on 5186 (evidence/task30/live/*); these guard the source contract.
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { subscriptionSectionState } from './domain/subscriptions/accountSummaryClient';
import { pricingModalModel } from './domain/subscriptions/pricingModalModel';
import PackageOfferCards from './components/PackageOfferCards';

const src = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10)); // CRLF working copies (core.autocrlf)

describe('My subscription - account state from the server only', () => {
  it('not activated / not deployed: not limited, nothing charged (no balance shown as a limit)', () => {
    for (const state of ['not_activated', 'not_deployed']) {
      expect(subscriptionSectionState({ state }, 'he')).toMatchObject({ label: 'מערכת המנויים עדיין לא פעילה', detail: 'החשבון אינו מוגבל, ולא מתבצע חיוב.' });
      expect(subscriptionSectionState({ state }, 'en')).toMatchObject({ label: 'Subscriptions are not active yet', detail: 'Your account is not limited, and nothing is charged.' });
    }
  });
  it('a ready Free summary shows the balance ONLY while Free-10 is enforced', () => {
    const base = { state: 'ready', planId: 'free', free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7 } };
    expect(subscriptionSectionState({ ...base, phase: { output: 'enforced' } }, 'he').detail).toBe('נותרו 7 מתוך 10 הצעות');
    expect(subscriptionSectionState({ ...base, phase: { output: 'shadow' } }, 'he').detail).toBe('ספירת 10 ההצעות החינמיות עדיין לא פעילה, והחשבון אינו מוגבל.');
    expect(subscriptionSectionState({ ...base, phase: { output: 'prepared' } }, 'en').detail).toBe('Free-10 counting is not active yet, and your account is not limited.');
  });
  it('loading / unavailable keep the existing fail-closed lines with retry', () => {
    expect(subscriptionSectionState({ state: 'loading' }, 'he').retry).toBe(false);
    expect(subscriptionSectionState({ state: 'invalid' }, 'en')).toMatchObject({ tone: 'error', retry: true });
  });
});

describe('My subscription - the one package, one price at a time', () => {
  const card = (isHebrew, market) => render(<PackageOfferCards model={pricingModalModel({ isHebrew, market })} isHebrew={isHebrew} only={['all_inclusive']} testIdPrefix="settings-subscription" />).container;
  it('IL: ₪30.00 monthly, ₪306.00 annual with "חיסכון של 15% — ₪54.00 בשנה" (LTR-isolated figures)', () => {
    const c = card(true, 'IL');
    expect(c.querySelectorAll('section')).toHaveLength(1);
    expect(c.querySelector('[data-price]').textContent).toBe('₪30.00');
    expect(c.querySelector('[data-period-note]')).toBeNull();
    fireEvent.click(c.querySelector('input[data-period=year]'));
    expect(c.querySelector('[data-price]').textContent).toBe('₪306.00');
    const note = c.querySelector('[data-period-note]');
    expect(note.textContent).toBe('חיסכון של 15% — ₪54.00 בשנה');
    expect([...note.querySelectorAll('bdi[dir=ltr]')].map((b) => b.textContent)).toEqual(['15%', '₪54.00']);
  });
  it('INTERNATIONAL: $18.00 / $184.00 USD with "Save approximately 15% — $32.00 per year"', () => {
    const c = card(false, 'INTERNATIONAL');
    expect(c.querySelector('[data-price]').textContent).toBe('$18.00');
    fireEvent.click(c.querySelector('input[data-period=year]'));
    expect(c.querySelector('[data-price]').textContent).toBe('$184.00');
    expect(c.querySelector('[data-period-note]').textContent).toBe('Save approximately 15% — $32.00 per year');
  });
  it('the purchase availability is stated plainly and no separate plans button remains in Settings', () => {
    expect(pricingModalModel({ isHebrew: true, market: 'IL' }).availability).toMatch(/^רכישת מנוי עדיין לא זמינה/);
    const s = src('components/SettingsTab.jsx');
    expect(s).not.toMatch(/settings-open-plans|setShowPricingModal|מסלולים ומחירים|Plans & pricing/);
    expect(s).toMatch(/data-testid="settings-subscription-availability"/);
    expect(s).toMatch(/'המנוי שלי' : 'My subscription'/);
  });
});

describe('layout contracts (source)', () => {
  it('AI modal header: the title column is never narrower than the title', () => {
    expect(src('index.css')).toMatch(/\.pf-modal-head \{ display: grid; grid-template-columns: minmax\(max-content, 1fr\) auto 1fr;/);
  });
  it('Business settings: the action cards are inside the ONE scroll body, before the quote design', () => {
    const s = src('components/SettingsTab.jsx');
    const body = s.indexOf('<div className="pf-screen-body">\n        {/* Task 30 (Owner addendum, business-settings layout)');
    expect(body).toBeGreaterThan(0);
    expect(s.indexOf('data-testid="settings-entries"')).toBeGreaterThan(body);
    expect(s.indexOf('data-testid="settings-quote-design"')).toBeGreaterThan(s.indexOf('data-testid="settings-entries"'));
  });
  it('Business settings preview: no inner scroll area (no max-height, overflow visible); the creator preview keeps its own scroll', () => {
    const css = src('components/quotePresentation/quotePresentation.css');
    expect(css).toMatch(/\.qp-settings-preview \.qp-preview-scroll \{ flex: none; max-height: none; overflow: visible; padding: 10px; \}/);
    expect(css).not.toMatch(/\.qp-settings-preview \.qp-preview-scroll \{[^}]*max-height: (min|\d)/);
    expect(css).toMatch(/\.qp-preview-scroll \{ flex: 1; min-height: 0; overflow: auto;/);
  });
  it('compact footer and the settings-scoped 8px shell reserve', () => {
    const d = src('pages/Dashboard.jsx');
    expect(d).toMatch(/<footer className="no-print dash-footer" style=\{\{ textAlign: 'center', padding: '6px 16px', marginTop: 'auto',/);
    expect(d).not.toMatch(/paddingTop: '30px', borderTop/);
    expect(d).toMatch(/\.dash-main-content:has\(\.pf-settings-screen\) \{ padding-bottom: 8px !important; \}/);
  });
});
