import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
function readSource(relativePath) {
  return readFileSync(join(__dirname, relativePath), 'utf-8');
}

// These files document their own truthfulness fixes in {/* JSX comments */}
// that necessarily quote the exact removed phrase (e.g. "Invoicing" removed
// from the headline) - checking raw source would false-positive on the
// comment explaining the fix, not the fix itself. Strip all block comments
// before asserting user-facing text is clean.
function readRenderedText(relativePath) {
  return readSource(relativePath).replace(/\/\*[\s\S]*?\*\//g, '');
}

// Proportional Workspace Correction task, §C and prior rounds: structural
// regression guards against specific false/unverifiable claims that were
// found and removed from the landing pages in earlier tasks (Invoicing,
// an unsubstantiated "500 businesses" trust signal, false PRO-exclusivity
// for a capability that is actually available on every tier). Written as
// source-text assertions (not full component renders, which need heavy
// mocking for video/AIChatWidget/matchMedia) so a future copy edit that
// silently reintroduces any of these is caught immediately.

describe('landing page copy - previously-removed false claims stay removed', () => {
  it('does not claim ProFlow issues invoices (it does not)', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    expect(en).not.toMatch(/\bInvoicing\b/);
    expect(he).not.toMatch(/הפקת חשבוניות|חשבונית מס/);
  });

  it('does not claim an unsubstantiated customer/business count', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    expect(he).not.toMatch(/500\s*עסקים/);
    expect(en).not.toMatch(/500\s*businesses/i);
  });

  it('does not market income/expense tracking (Finances) as PRO-exclusive (it is available on every plan)', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    expect(he).not.toMatch(/ניהול הכנסות והוצאות מלא/);
    expect(en).not.toMatch(/full income (&|and) expense tracking/i);
  });

  it('the new professional/trade capability card does not claim a specific plan tier for itself', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    // The capability card's own paragraph text (identified by its distinctive
    // wording) should not mention "Basic"/"Pro"/"בסיסי"/"PRO" - tier detail
    // belongs on the pricing cards only, not duplicated/risked here.
    const heMatch = he.match(/בנה הצעה לפי מידות אמיתיות[^<]*/);
    const enMatch = en.match(/Build a quote from real measurements[^<]*/);
    expect(heMatch).toBeTruthy();
    expect(enMatch).toBeTruthy();
    expect(heMatch[0]).not.toMatch(/בסיסי|PRO|Basic/i);
    expect(enMatch[0]).not.toMatch(/\bBasic\b|\bPro\b/);
  });
});
