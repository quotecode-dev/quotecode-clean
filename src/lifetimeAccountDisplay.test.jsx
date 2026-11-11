// Owner console 2026-10-14: an account the Owner granted lifetime (business_settings.is_lifetime) sees "Lifetime subscription - no
// charge" in Settings › "My subscription" and in the plans window, and is offered no package / price / cancellation line. Every other
// account is unchanged. Display only.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PricingModal from './components/PricingModal';
import { lifetimeAccountModel, subscriptionSectionState } from './domain/subscriptions/accountSummaryClient';

afterEach(() => cleanup());
const src = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

describe('lifetime account model', () => {
  it('HE / EN wording, no plan id, no retry', () => {
    expect(lifetimeAccountModel('he')).toMatchObject({ state: 'lifetime', label: 'מנוי לכל החיים', detail: 'ללא חיוב — אין צורך לרכוש מנוי.', planId: null, retry: false });
    expect(lifetimeAccountModel('en')).toMatchObject({ label: 'Lifetime subscription', detail: 'No charge — no subscription purchase needed.' });
  });
  it('Settings state: lifetime overrides "subscriptions are not active yet"; a non-lifetime account is unchanged', () => {
    for (const state of ['not_activated', 'not_deployed', 'loading', 'invalid']) {
      expect(subscriptionSectionState({ state }, 'he', { isLifetime: true }).label).toBe('מנוי לכל החיים');
    }
    expect(subscriptionSectionState({ state: 'not_activated' }, 'he').label).toBe('מערכת המנויים עדיין לא פעילה');
    expect(subscriptionSectionState({ state: 'not_activated' }, 'he', { isLifetime: false }).label).toBe('מערכת המנויים עדיין לא פעילה');
  });
});

describe('plans window', () => {
  it.each([[true, /מנוי לכל החיים/, /₪30/], [false, /Lifetime subscription/, /\$18/]])('isHebrew=%s lifetime: the lifetime line, no package, price, availability or cancellation', (he, line, price) => {
    const { getByTestId, queryByTestId, container } = render(<PricingModal isOpen onClose={() => {}} isHebrew={he} isLocalIsraeliBusiness={he} accountSummary={{ state: 'not_activated' }} isLifetime />);
    expect(getByTestId('plans-modal-lifetime').textContent).toMatch(line);
    for (const id of ['plans-modal-current', 'plans-modal-availability', 'plans-modal-price-note', 'plans-modal-cancellation']) expect(queryByTestId(id)).toBeNull();
    expect(container.textContent).not.toMatch(price);
    expect(container.querySelector('[data-price]')).toBeNull();
  });
  it('a non-lifetime account still sees the package and its price', () => {
    const { queryByTestId, container } = render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={{ state: 'not_activated' }} />);
    expect(queryByTestId('plans-modal-lifetime')).toBeNull();
    expect(container.textContent).toMatch(/30/);
    expect(queryByTestId('plans-modal-availability')).not.toBeNull();
  });
});

describe('wiring (source)', () => {
  it('Settings hides the package for a lifetime account (never for super admin lifetime) and Dashboard passes the resolved lifetime fact', () => {
    const s = src('components/SettingsTab.jsx');
    expect(s).toMatch(/const lifetimeAccount = isLifetime === true && !isSuperAdmin;/);
    expect(s).toMatch(/\{!isSuperAdmin && !lifetimeAccount && \(/);
    const d = src('pages/Dashboard.jsx');
    expect(d).toMatch(/const \{ isLifetime: isLifetimeAccount \} = resolvedIdentity;/);
    expect(d.match(/isLifetime=\{isLifetimeAccount\}/g)).toHaveLength(2);
  });
});
