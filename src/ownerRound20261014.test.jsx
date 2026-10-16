// Owner round 2026-10-14: header plan button (in place of the avatar circle), larger business logo on quotes, landing "לידי" beside
// "לכבוד" with a role, and the landing AI launcher that is felt (protected only over actions; spring return).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planBadgeModel } from './domain/subscriptions/accountSummaryClient';

const read = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

describe('header plan button model (one source with Settings and the plans window)', () => {
  it('lifetime first, whatever the summary', () => {
    expect(planBadgeModel({ state: 'not_activated' }, 'he', { isLifetime: true })).toEqual({ label: 'לכל החיים', kind: 'lifetime' });
    expect(planBadgeModel({ state: 'ready', planId: 'free', free10: { remaining: 3 }, phase: { output: 'enforced' } }, 'en', { isLifetime: true }).label).toBe('Lifetime');
  });
  it('not active / loading / unavailable -> "Plans"', () => {
    for (const state of ['not_activated', 'not_deployed', 'loading', 'invalid', 'unprovisioned']) {
      expect(planBadgeModel({ state }, 'he')).toEqual({ label: 'מסלולים', kind: 'plans' });
      expect(planBadgeModel({ state }, 'en').label).toBe('Plans');
    }
    expect(planBadgeModel(undefined, 'he').label).toBe('מסלולים');
  });
  it('Free-10: the balance ONLY while enforced; prepared / shadow -> "Plans"', () => {
    const s = { state: 'ready', planId: 'free', free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7 } };
    expect(planBadgeModel({ ...s, phase: { output: 'enforced' } }, 'he')).toEqual({ label: 'נותרו 7/10', kind: 'free10', remaining: 7, total: 10 });
    expect(planBadgeModel({ ...s, phase: { output: 'enforced' } }, 'en').label).toBe('7/10 left');
    expect(planBadgeModel({ ...s, phase: { output: 'prepared' } }, 'he').label).toBe('מסלולים');
    expect(planBadgeModel({ ...s, phase: { output: 'shadow' } }, 'en').label).toBe('Plans');
  });
  it('a ready paid plan shows its plan name', () => {
    const r = planBadgeModel({ state: 'ready', planId: 'all_inclusive', free10: null }, 'he');
    expect(r.kind).toBe('plan');
    expect(r.label.length).toBeGreaterThan(2);
  });
});

describe('header wiring (source)', () => {
  const d = read('pages/Dashboard.jsx');
  it('the avatar circle is gone; the round plan medallion opens the plans window and is hidden for the super admin', () => {
    expect(d).not.toMatch(/dash-header-avatar|headerAvatarUrl|className="dash-header-plan"/);
    expect(d).toMatch(/\{!isSuperAdmin && \(\n\s*<HeaderPlanMedallion model=\{headerPlanBadge\} isHebrew=\{isHebrew\} onOpen=\{\(\) => setShowPricingModal\(true\)\} \/>/);
    // Owner console 2026-10-16 (approval naming L-03): the header medallion is the admin status medallion (subscriptionStatus.js)
    expect(d).toMatch(/const headerPlanBadge = statusMedallionModel\(\{ is_lifetime: isLifetimeAccount, trial_ends_at: trialEndsAt \}, accountSummary, \{ isHebrew, formatDate: statusDate \}\);/);
    expect(d.indexOf('const { summary: accountSummary')).toBeLessThan(d.indexOf('const headerPlanBadge ='));
  });
});

describe('quote letterhead logo sizes', () => {
  const css = read('quoteDocument/quoteDocument.css');
  it('screen up to 96px (phone up to 80px), print / PDF up to 80px, never distorted', () => {
    expect(css).toMatch(/\.pq-letterhead \.pq-logo-chip img \{\n {2}display: block;\n {2}max-height: 96px;\n {2}max-width: 260px;/);
    expect(css).toMatch(/\.pq-page:not\(\.pq-pdf-capturing\) \.pq-card \.pq-letterhead \.pq-logo-chip img \{\n {4}width: auto;\n {4}height: auto;\n {4}max-height: 96px;\n {4}max-width: 260px;\n {4}object-fit: contain;/);
    expect(css).toMatch(/\.pq-pdf-capturing \.pq-card \.pq-letterhead \.pq-logo-chip img \{\n {2}max-height: 80px !important;\n {2}max-width: 260px !important;/);
    expect(css).toMatch(/\.pq-page:not\(\.pq-preview\) \.pq-card \.pq-letterhead \.pq-logo-chip img \{\n {4}max-height: 80px !important;/);
    expect(css).not.toMatch(/\.pq-logo-chip img \{\n\s*width: 4[26]px;/);
  });
});

describe('landing', () => {
  const page = read('components/landing/LandingPage.jsx');
  const css = read('components/landing/landing.css');
  it('the launcher steps aside only over actions (no body text / headings / sample documents)', () => {
    const list = page.slice(page.indexOf('const PROTECTED_FROM_LAUNCHER'), page.indexOf("+ '.tl-hero a") + 140);
    expect(list).toMatch(/#plans \.tl-plan, #plans \.tl-plans-cta/);
    expect(list).toMatch(/\.tl-section a, \.tl-section button, \.tl-section summary/);
    expect(list).not.toMatch(/\.tl-doc|\.tl-section p|\.tl-faq-a|\.tl-section h2|#tl-hero-title/);
  });
  it('the return is a felt spring; reduced motion keeps a plain fade', () => {
    expect(css).toMatch(/\.tl-landing \.ai-support-btn \{ transition: opacity \.28s ease, transform \.5s cubic-bezier\(\.34, 1\.8, \.64, 1\) !important; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n {2}\.tl-landing \.ai-support-btn, \.tl-landing\.tl-launcher-aside \.ai-support-btn \{ transition: opacity \.18s ease !important; \}/);
  });
  it('"לידי" stays beside "לכבוד" on a phone', () => {
    expect(css).toMatch(/\.tl-parties, \.tl-doc--modern \.tl-parties \{ grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);/);
  });
});
