// @vitest-environment node
// Task 16 cloud-fix4 / cloud-fix4b: base-parity judging of the app palette fidelity assertions (positive + negative
// controls). cloud-fix4b (A17 H3): element + component comparison with the base inventory, relative fraction with a cap.
import { describe, it, expect } from 'vitest';
import { applyAppPaletteBase, matchViolet, purpleLimit, APP_PALETTE_BASE } from './appPaletteBase.mjs';

const ID = 'app/he/management/1440x900';
const baseEls = [
  { tag: 'button', label: 'הצעת מחיר חדשה', x: 1056, y: 117, w: 203, h: 43 },
  { tag: 'div', label: 'ס', x: 1201, y: 38, w: 52, h: 52 },
];
const baseComps = [{ x: 1056, y: 116, w: 196, h: 48, area: 9000 }, { x: 1200, y: 40, w: 52, h: 48, area: 2400 }];
const pol = { purple: { relTolerance: 0.25, absCap: 0.005 }, components: { windowPx: 16, positionTolerancePx: 24 }, cells: { [ID]: { purpleFrac: 0.0171, tealFrac: 0.0002, violetEls: baseEls, violetComps: baseComps } } };
const cell = (purple, els, comps) => ({ id: ID, violetEls: els, pixels: { cand: { violet: { comps } } }, assertions: {
  noLegacyPurple: { status: 'FAIL', kind: 'calibrated', ref: 0.0003, cand: purple },
  tealAccentPresent: { status: 'FAIL', kind: 'calibrated', ref: 0.0188, cand: 0.0001 },
} });

describe('purple fraction backstop', () => {
  it('limit = base + min(0.25 x base, 0.005)', () => {
    expect(purpleLimit(0.0094, pol)).toBe(0.0118);
    expect(purpleLimit(0.0662, pol)).toBe(0.0712);
  });
});

describe('app palette base parity (cloud-fix4b)', () => {
  it('POSITIVE: the base violet controls (same labels, slightly moved / resized) PASS; teal NOT TESTED', () => {
    const els = [{ ...baseEls[0], x: 1060, w: 196, h: 44 }, { ...baseEls[1] }];
    const [c] = applyAppPaletteBase([cell(0.0166, els, [{ x: 1056, y: 116, w: 196, h: 44, area: 8600 }, { x: 1200, y: 40, w: 52, h: 48, area: 2400 }])], pol);
    expect(c.assertions.noLegacyPurple).toMatchObject({ status: 'PASS', kind: 'base-parity', base: 0.0171, limit: 0.0214 });
    expect(c.assertions.noLegacyPurple.components).toMatchObject({ matched: 2, newEls: [], newComps: [] });
    expect(c.assertions.tealAccentPresent).toMatchObject({ status: 'NOT TESTED', base: 0.0002, ref: 0.0188 });
  });
  it('NEGATIVE: ONE new violet button FAILS even when the purple fraction stays within the backstop', () => {
    const els = [...baseEls, { tag: 'button', label: 'Export CSV', x: 300, y: 200, w: 120, h: 32 }];
    const [c] = applyAppPaletteBase([cell(0.0190, els, [...baseComps, { x: 300, y: 200, w: 120, h: 32, area: 3800 }])], pol);
    expect(c.assertions.noLegacyPurple.status).toBe('FAIL');
    expect(c.assertions.noLegacyPurple.components.newEls).toHaveLength(1);
    expect(c.assertions.noLegacyPurple.note).toMatch(/Export CSV/);
  });
  it('NEGATIVE: a second violet copy of a base control (same label) FAILS - one-to-one matching', () => {
    const els = [...baseEls, { ...baseEls[0], y: 600 }];
    expect(matchViolet({ els, comps: [] }, { els: baseEls, comps: baseComps }, pol).newEls).toHaveLength(1);
  });
  it('NEGATIVE: violet drawn without a violet background (svg fill / image) far from base violet FAILS', () => {
    const [c] = applyAppPaletteBase([cell(0.0175, baseEls, [...baseComps, { x: 600, y: 500, w: 40, h: 40, area: 1600 }])], pol);
    expect(c.assertions.noLegacyPurple.status).toBe('FAIL');
    expect(c.assertions.noLegacyPurple.components.newComps).toHaveLength(1);
  });
  it('NEGATIVE: diffuse violet above the backstop FAILS', () => {
    const [c] = applyAppPaletteBase([cell(0.0220, baseEls, baseComps)], pol);
    expect(c.assertions.noLegacyPurple.status).toBe('FAIL');
  });
  it('NEGATIVE: no candidate inventory -> FAIL (never a silent PASS)', () => {
    const c = cell(0.0170, baseEls, baseComps); delete c.violetEls;
    applyAppPaletteBase([c], pol);
    expect(c.assertions.noLegacyPurple.status).toBe('FAIL');
  });
  it('a cell without a measured base keeps the reference-calibrated verdict; non-app cells untouched', () => {
    const c = { ...cell(0.06, [], []), id: 'app/en/creator/1440x900' };
    applyAppPaletteBase([c], pol);
    expect(c.assertions.noLegacyPurple).toMatchObject({ status: 'FAIL', kind: 'calibrated' });
    const d = { id: 'doc/he/visual/1440x900', assertions: { noLegacyPurple: { status: 'FAIL', cand: 0.5 } } };
    applyAppPaletteBase([d], pol);
    expect(d.assertions.noLegacyPurple.status).toBe('FAIL');
  });
  it('the committed policy holds the measured base inventory for the 28 app cells of base c65f742', () => {
    expect(APP_PALETTE_BASE.base.commit).toBe('c65f7422cbf16ad5895d1b458431d23a5601fad1');
    expect(APP_PALETTE_BASE.base.inventory.buildSha).toBe('c65f7422cbf16ad5895d1b458431d23a5601fad1');
    const ids = Object.keys(APP_PALETTE_BASE.cells);
    expect(ids).toHaveLength(28);
    expect(ids.every((id) => id.startsWith('app/'))).toBe(true);
    expect(Object.values(APP_PALETTE_BASE.cells).every((c) => Array.isArray(c.violetEls) && c.violetEls.length > 0 && Array.isArray(c.violetComps))).toBe(true);
    expect(APP_PALETTE_BASE.purpleTolerance).toBeUndefined();
    expect(APP_PALETTE_BASE.purple.absCap).toBeLessThanOrEqual(0.005);
    expect(APP_PALETTE_BASE.purple.relTolerance).toBeLessThanOrEqual(0.25);
    expect(APP_PALETTE_BASE.components).toMatchObject({ windowPx: 16, positionTolerancePx: 24 });
  });
});
