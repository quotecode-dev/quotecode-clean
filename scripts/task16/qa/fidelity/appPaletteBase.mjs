// Task 16 cloud-fix4 (2026-10-06): base parity for the app palette assertions of fidelity-compare.mjs.
// noLegacyPurple / tealAccentPresent are calibrated on the static teal reference prototype. The app palette is the base
// c65f742 violet again (A16, Owner rule S-B8), and the full reference is not authority (round-4 item 7). For every cell
// listed in app-palette-base.json, the cell is judged against the MEASURED base inventory instead:
//   noLegacyPurple    (cloud-fix4b, A17 H3: the former "+0.01 absolute" let a new violet button through) PASS only if ALL of
//     (1) elements   every violet-PAINTED element of the candidate viewport (own background colour or a gradient stop in
//                    the purpleFrac violet range, box >= 16x16, outermost) matches a DISTINCT base violet element of the same
//                    cell: same accessible label, or its centre inside the base box grown by positionTolerancePx;
//     (2) components every solid violet pixel component of the candidate screenshot (opening by components.windowPx; violet
//                    text drops out) lies in a candidate violet element or within positionTolerancePx of a base violet
//                    component (catches violet drawn without a background: svg fills, images, borders);
//     (3) fraction   candidate purpleFrac <= base + min(relTolerance x base, absCap) - backstop for diffuse violet.
//   tealAccentPresent NOT TESTED (the reference teal accent has no authority over the base palette)
// Cells not listed keep their reference-calibrated verdict. The reference value stays in the cell for context.
import { readPolicy } from './common.mjs';

export const APP_PALETTE_BASE = readPolicy('app-palette-base.json');

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const within = (p, r, t) => p.x >= r.x - t && p.x <= r.x + r.w + t && p.y >= r.y - t && p.y <= r.y + r.h + t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function purpleLimit(base, policy = APP_PALETTE_BASE) {
  const p = policy.purple;
  return +(base + Math.min(p.relTolerance * base, p.absCap)).toFixed(4);
}

// Pure: which candidate violet elements / components have no base counterpart.
export function matchViolet(cand, base, policy = APP_PALETTE_BASE) {
  const t = policy.components?.positionTolerancePx;
  if (typeof t !== 'number') throw new Error('app-palette-base.json: components.positionTolerancePx missing');
  const used = new Set();
  const matchedEls = [];
  const newEls = [];
  for (const e of cand.els || []) {
    const c = centre(e);
    const free = (base.els || []).map((b, i) => ({ b, i })).filter(({ i }) => !used.has(i));
    const byLabel = norm(e.label) ? free.filter(({ b }) => norm(b.label) === norm(e.label)) : [];
    const pool = byLabel.length ? byLabel : free.filter(({ b }) => within(c, b, t));
    if (!pool.length) { newEls.push(e); continue; }
    pool.sort((a, b2) => dist(centre(a.b), c) - dist(centre(b2.b), c));
    used.add(pool[0].i);
    matchedEls.push({ cand: e, base: pool[0].b, by: byLabel.length ? 'label' : 'position' });
  }
  const newComps = [];
  for (const k of cand.comps || []) {
    const c = centre(k);
    if ((cand.els || []).some((e) => within(c, e, 2))) continue; // painted by an element: judged by (1)
    if ((base.comps || []).some((b) => within(c, b, t))) continue;
    newComps.push(k);
  }
  return { matchedEls, newEls, newComps };
}

export function applyAppPaletteBase(cells, policy = APP_PALETTE_BASE, STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_TESTED: 'NOT TESTED' }) {
  for (const c of cells) {
    const b = policy.cells?.[c.id];
    const A = c.assertions;
    if (!b || !A) continue;
    if (A.noLegacyPurple && typeof A.noLegacyPurple.cand === 'number') {
      const a = A.noLegacyPurple;
      const limit = purpleLimit(b.purpleFrac, policy);
      const haveInventory = Array.isArray(b.violetEls) && Array.isArray(b.violetComps) && Array.isArray(c.violetEls) && !!c.pixels?.cand?.violet;
      const m = haveInventory ? matchViolet({ els: c.violetEls, comps: c.pixels.cand.violet.comps }, { els: b.violetEls, comps: b.violetComps }, policy) : null;
      const fracOk = a.cand <= limit;
      const compOk = m ? m.newEls.length === 0 && m.newComps.length === 0 : false;
      const why = [];
      if (!fracOk) why.push(`purpleFrac ${a.cand} > limit ${limit}`);
      if (!m) why.push('violet inventory missing (base or candidate) - component comparison not possible');
      else {
        if (m.newEls.length) why.push(`new violet element(s) not in base: ${m.newEls.slice(0, 4).map((e) => `${e.tag} "${e.label}" ${e.w}x${e.h}@${e.x},${e.y}`).join('; ')}`);
        if (m.newComps.length) why.push(`new violet area(s) not in base: ${m.newComps.slice(0, 4).map((k) => `${k.w}x${k.h}@${k.x},${k.y}`).join('; ')}`);
      }
      A.noLegacyPurple = {
        status: fracOk && compOk ? STATUS.PASS : STATUS.FAIL, kind: 'base-parity', ref: a.ref, base: b.purpleFrac, limit, cand: a.cand,
        components: m ? { matched: m.matchedEls.length, baseEls: b.violetEls.length, newEls: m.newEls, newComps: m.newComps } : null,
        note: `APP-PALETTE-BASE (cloud-fix4b): every violet element / solid violet area must have a base c65f742 counterpart and purpleFrac <= base + min(${policy.purple.relTolerance} x base, ${policy.purple.absCap})${why.length ? ` - FAIL: ${why.join(' | ')}` : ''}`,
      };
    }
    if (A.tealAccentPresent) {
      const a = A.tealAccentPresent;
      A.tealAccentPresent = { status: STATUS.NOT_TESTED, kind: 'base-parity', ref: a.ref, base: b.tealFrac, cand: a.cand, note: 'APP-PALETTE-BASE: the reference teal accent has no authority over the base palette (S-B8, round-4 item 7)' };
    }
  }
  return cells;
}
