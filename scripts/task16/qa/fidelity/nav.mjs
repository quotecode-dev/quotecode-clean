// Task 16 - landing header navigation: role-based probe (runs identically on the reference and the candidate) and the
// policy-applied comparison. The ONLY reference deviations accepted are the ones listed in reference-overrides.json,
// each with its provenance; everything else (order, sides, geometry, unexpected items) must match or the check FAILS.
import { IN_PAGE_COLOR_LIB, readPolicy } from './common.mjs';

export const NAV_POLICY = readPolicy('reference-overrides.json');

// In-page probe. Returns the header bar items with roles + geometry, and (when a drawer toggle is visible) the
// opened drawer's items. Argument: { locale }.
export const NAV_PROBE_SOURCE = String.raw`async ({ locale }) => {
  ${IN_PAGE_COLOR_LIB}
  const other = locale === 'he' ? 'en' : 'he';
  const header = document.querySelector('header.tl-header') || document.querySelector('nav.land-nav') || [...document.querySelectorAll('header, nav, [role="banner"]')].find((e) => __vis(e) && e.getBoundingClientRect().top < 120);
  if (!header) return { missing: 'header' };
  const bar = header.querySelector('.tl-nav') || header; // the box that carries the content padding
  const hb = bar.getBoundingClientRect(); const hcs = getComputedStyle(bar);
  const inner = { left: hb.left + parseFloat(hcs.paddingLeft), right: hb.right - parseFloat(hcs.paddingRight) };
  const LANG_LABEL = /^(en|he|english|hebrew|hebrew version|עברית|אנגלית|english version)$/i;
  const roleOf = (el) => {
    const href = el.getAttribute('href') || '';
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className);
    const label = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (el.querySelector('img') || /logo/i.test(cls)) return { role: 'logo', key: 'logo' };
    if (/lang-switch|tl-lang/.test(cls) || el.hasAttribute('hreflang') || new RegExp('^/' + other + '(/|$|\\?)').test(href) || href === 'landing-' + other + '.html' || LANG_LABEL.test(label)) return { role: 'language-switch', key: 'language-switch' };
    if (href.startsWith('#') && href.length > 1) return { role: 'section', key: href };
    if (/land-cta|tl-cta|neon-btn/.test(cls) || /signup=true/.test(href)) return { role: 'cta', key: 'cta' };
    if (el.tagName === 'BUTTON' && (el.hasAttribute('aria-controls') || /menu-toggle/.test(cls))) return { role: 'menu-toggle', key: 'menu-toggle' };
    if (/\/dashboard\?lang=/.test(href) || /^(sign in|כניסה|כניסה למערכת|log in)$/i.test(label)) return { role: 'sign-in', key: 'sign-in' };
    return { role: 'other', key: 'other:' + label.slice(0, 24) };
  };
  const collect = (scope, box) => {
    const els = [...scope.querySelectorAll('a, button')].filter((e) => __vis(e) && !e.parentElement.closest('a, button'));
    // a bare brand <img> outside any link counts as the logo too (base build)
    const lone = [...scope.querySelectorAll('img')].filter((i) => __vis(i) && !i.closest('a, button'));
    return [...els, ...lone.slice(0, 1)].map((el) => {
      const r = el.getBoundingClientRect();
      const ro = el.tagName === 'IMG' ? { role: 'logo', key: 'logo' } : roleOf(el);
      return { ...ro, label: (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40), href: el.getAttribute('href'), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), cx: +(r.left + r.width / 2).toFixed(1), cy: +(r.top + r.height / 2).toFixed(1), side: (r.left + r.width / 2) > (box.left + box.right) / 2 ? 'right' : 'left' };
    });
  };
  const rtl = getComputedStyle(bar).direction === 'rtl' || locale === 'he';
  const order = (items) => items.sort((a, b) => (rtl ? b.cx - a.cx : a.cx - b.cx));
  const items = order(collect(header, inner));
  // a reference menu toggle is appended to the nav by app.js; the candidate's lives inside the header - both covered
  // drawer markup even when closed/hidden (the reference drawer exists in the DOM at every width)
  const markup = document.querySelector('#tabletMenuDrawer nav, #tl-menu-drawer nav');
  const drawerMarkup = markup ? [...markup.querySelectorAll('a, button')].map((el) => roleOf(el)).map((r) => (r.role === 'section' ? r.key : r.role)) : null;
  const out = { dir: rtl ? 'rtl' : 'ltr', vw: innerWidth, cw: Math.min(document.documentElement.clientWidth, document.body.clientWidth || Infinity), drawerMarkup, header: { x: Math.round(hb.left), w: Math.round(hb.width), h: Math.round(header.getBoundingClientRect().height), innerLeft: Math.round(inner.left), innerRight: Math.round(inner.right), cy: +(hb.top + hb.height / 2).toFixed(1), bg: __effBg(header).css }, items };
  // drawer
  const toggle = items.find((i) => i.role === 'menu-toggle');
  if (toggle) {
    const btn = [...header.querySelectorAll('button')].find((b) => __vis(b) && (b.hasAttribute('aria-controls') || /menu-toggle/.test(String(b.className))));
    btn.click();
    await new Promise((r) => setTimeout(r, 250));
    const drawer = document.querySelector('#tl-menu-drawer .tl-drawer, #tl-menu-drawer, .tl-drawer, #tabletMenuDrawer aside, [role="dialog"]');
    if (drawer && __vis(drawer)) {
      const db = drawer.getBoundingClientRect();
      const nav = drawer.querySelector('nav') || drawer;
      const dItems = [...nav.querySelectorAll('a, button')].filter((e) => __vis(e) && !/close/i.test(String(e.className)) && !e.parentElement.closest('a, button')).map((el) => {
        const ro = roleOf(el); const r = el.getBoundingClientRect();
        return { ...ro, label: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40), href: el.getAttribute('href'), y: Math.round(r.top) };
      }).sort((a, b) => a.y - b.y);
      out.drawer = { side: db.left + db.width / 2 > innerWidth / 2 ? 'right' : 'left', x: Math.round(db.left), w: Math.round(db.width), bg: __effBg(drawer).css, bgLum: +__relLum(__effBg(drawer).color).toFixed(3), items: dItems };
    } else out.drawer = { missing: true };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const close = document.querySelector('.tl-drawer-close, .tablet-menu-close');
    if (close && __vis(close)) close.click();
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}`;

export async function probeNav(page, locale) {
  return page.evaluate(`(${NAV_PROBE_SOURCE})(${JSON.stringify({ locale })})`);
}

const seq = (items) => items.map((i) => (i.role === 'section' ? i.key : i.role));

// Expected candidate header sequence derived from the reference sequence + overrides. Each element: { key, optional }.
export function expectedHeaderSequence(ref, locale, vw) {
  const refSeq = seq(ref.items).filter((k) => k !== 'language-switch'); // NAV-OWNER-NO-LANGUAGE-SWITCH
  const logo = refSeq.filter((k) => k === 'logo');
  const sections = refSeq.filter((k) => k.startsWith('#'));
  const actions = refSeq.filter((k) => ['cta', 'menu-toggle', 'sign-in'].includes(k));
  const unknown = refSeq.filter((k) => !['logo', 'cta', 'menu-toggle', 'sign-in'].includes(k) && !k.startsWith('#'));
  const exp = [];
  // NAV-BASE-SIGN-IN: optional sign-in immediately before the cta; NAV-PHONE-MENU-TOGGLE: optional toggle after it (<=520)
  const act = [];
  for (const a of actions) {
    if (a === 'cta') act.push({ key: 'sign-in', optional: true, by: 'NAV-BASE-SIGN-IN' });
    act.push({ key: a, optional: false });
  }
  if (vw <= 520 && !actions.includes('menu-toggle')) act.push({ key: 'menu-toggle', optional: true, by: 'NAV-PHONE-MENU-TOGGLE' });
  const refShape = [...logo, ...sections, ...actions].join('|') === refSeq.join('|') ? 'logo,sections,actions' : 'other';
  // NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT (Owner 2026-10-06): both locales read logo, section links, actions (HE is the RTL
  // mirror: logo far right ... actions far left). The superseded HE rule expected logo, actions, links.
  exp.push(...logo.map((k) => ({ key: k })), ...sections.map((k) => ({ key: k })), ...act);
  return { expected: exp, refSeq, refShape, unknown };
}

function matchSequence(expected, cand) {
  let i = 0;
  const trace = [];
  for (const e of expected) {
    if (cand[i] === e.key) { trace.push(`${e.key}`); i += 1; continue; }
    if (e.optional) { trace.push(`(${e.key} absent)`); continue; }
    return { ok: false, at: i, wanted: e.key, got: cand[i] ?? null, trace };
  }
  if (i < cand.length) return { ok: false, at: i, wanted: null, got: cand.slice(i), trace, note: 'unexpected extra items' };
  return { ok: true, trace };
}

// Returns assertions { headerNoLanguageSwitch, headerNavOrder, headerNavSides, headerNavGeometry, drawerNoLanguageSwitch,
// drawerNavOrder } as { status, kind, ref, cand, note, overrides }.
export function compareNav(ref, cand, locale, STATUS) {
  const G = NAV_POLICY.geometry;
  const R = (status, refV, candV, note, overrides) => ({ status, kind: 'comparison+policy', ref: refV, cand: candV, ...(note ? { note } : {}), ...(overrides ? { overrides } : {}) });
  const A = {};
  if (!ref || ref.missing || !cand || cand.missing) {
    for (const k of ['headerNoLanguageSwitch', 'headerNavOrder', 'headerNavSides', 'headerNavGeometry']) A[k] = R(STATUS.FAIL, ref?.missing || null, cand?.missing || null, 'header not found');
    return A;
  }
  const vw = cand.vw;
  const candLang = cand.items.filter((i) => i.role === 'language-switch');
  A.headerNoLanguageSwitch = R(candLang.length ? STATUS.FAIL : STATUS.PASS, ref.items.filter((i) => i.role === 'language-switch').map((i) => i.label), candLang.map((i) => `${i.label} -> ${i.href}`), 'candidate header must show no language switch', ['NAV-OWNER-NO-LANGUAGE-SWITCH']);

  const { expected, refSeq, refShape, unknown } = expectedHeaderSequence(ref, locale, vw);
  const candSeq = seq(cand.items).filter((k) => k !== 'language-switch'); // reported by headerNoLanguageSwitch
  const m = matchSequence(expected, candSeq);
  const shapeOk = refShape === 'logo,sections,actions' && unknown.length === 0;
  A.headerNavOrder = R(m.ok && shapeOk ? STATUS.PASS : STATUS.FAIL, refSeq, candSeq,
    m.ok ? (shapeOk ? `ordered role match (${m.trace.join(' > ')})` : `reference shape not understood: ${refShape} ${unknown.join(',')}`) : `mismatch at candidate item ${m.at}: wanted ${m.wanted}, got ${JSON.stringify(m.got)} (${m.note || 'order/role'})`,
    ['NAV-OWNER-NO-LANGUAGE-SWITCH', 'NAV-BASE-SIGN-IN', 'NAV-IRON-LANDING-CTA-LABEL', ...(locale === 'he' ? ['NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT'] : []), ...(vw <= 520 ? ['NAV-PHONE-MENU-TOGGLE'] : [])]);

  // sides. Logo + section links: page half (midline of the inner box) as in the reference. Action group: anchoring -
  // EN = the reference placement (group ends at the inner end edge; edge offset checked under geometry, side = right);
  // HE = Owner F1 (group packed against the logo on the right; every section link left of the group).
  const sideOf = (items, pred) => [...new Set(items.filter(pred).map((i) => i.side))];
  const isAction = (i) => ['cta', 'menu-toggle', 'sign-in'].includes(i.role);
  const refLogo = sideOf(ref.items, (i) => i.role === 'logo'); const candLogo = sideOf(cand.items, (i) => i.role === 'logo');
  const refSec = sideOf(ref.items, (i) => i.role === 'section'); const candSec = sideOf(cand.items, (i) => i.role === 'section');
  const groupSide = (h) => { const a = h.items.filter(isAction); if (!a.length) return null; const l = Math.min(...a.map((i) => i.x)); const r = Math.max(...a.map((i) => i.x + i.w)); return (h.header.innerRight - r) < (l - h.header.innerLeft) ? 'right' : 'left'; };
  const refAct = groupSide(ref); const candAct = groupSide(cand);
  const sideProblems = [];
  const anchoring = {};
  if (JSON.stringify(candLogo) !== JSON.stringify(refLogo)) sideProblems.push(`logo ${candLogo} != reference ${refLogo}`);
  const baseCol = (NAV_POLICY.overrides || []).find((o) => o.id === 'NAV-OWNER-BASE-COLUMN');
  const baseEdges = baseCol?.baseViewportEdges?.[locale]?.[String(vw)] || null;
  if (baseEdges) {
    // NAV-OWNER-BASE-COLUMN: in the base column the section links sit between the logo and the action group (EN); HE is
    // covered by the anchoring checks below (NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT).
    if (locale === 'en') {
      const lg = cand.items.find((i) => i.role === 'logo'); const ac = cand.items.filter(isAction);
      const lo = lg ? lg.x + lg.w : null; const hi = ac.length ? Math.min(...ac.map((i) => i.x)) : null;
      const outside = cand.items.filter((i) => i.role === 'section' && (lo === null || hi === null || i.x < lo || i.x + i.w > hi));
      if (outside.length) sideProblems.push(`EN section links outside logo..actions: ${outside.map((i) => i.key || i.label).join(',')}`);
    }
  } else if (refSec.length && JSON.stringify(candSec) !== JSON.stringify(refSec)) sideProblems.push(`sections ${candSec} != reference ${refSec}`);
  const acts = cand.items.filter(isAction).sort((a, b) => b.cx - a.cx); // right to left
  if (locale === 'he') {
    // NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT (Owner 2026-10-06): logo far right (checked above), the visible section links
    // immediately after it (entirely left of the logo, right of the action group), the action group at the far LEFT edge.
    const logo = cand.items.find((i) => i.role === 'logo');
    const secs = cand.items.filter((i) => i.role === 'section');
    if (acts.length && logo) {
      const groupLeft = Math.min(...acts.map((a) => a.x)); const groupRight = Math.max(...acts.map((a) => a.x + a.w));
      anchoring.actionsFarLeftOffset = Math.round(groupLeft - cand.header.innerLeft);
      anchoring.innerGaps = acts.slice(1).map((a, k) => Math.round(acts[k].x - (a.x + a.w)));
      if (Math.abs(anchoring.actionsFarLeftOffset) > G.heActionsFarEdgeTolerancePx) sideProblems.push(`HE action group not at the far left: offset ${anchoring.actionsFarLeftOffset}px (<= ${G.heActionsFarEdgeTolerancePx})`);
      if (anchoring.innerGaps.some((g) => g < 0 || g > G.actionGroupMaxInnerGapPx)) sideProblems.push(`HE action group not packed: gaps ${anchoring.innerGaps} (0..${G.actionGroupMaxInnerGapPx})`);
      if (secs.length) {
        const secLeft = Math.min(...secs.map((s) => s.x)); const secRight = Math.max(...secs.map((s) => s.x + s.w));
        anchoring.logoToLinksGap = Math.round(logo.x - secRight);
        anchoring.linksToActionsGap = Math.round(secLeft - groupRight);
        if (anchoring.logoToLinksGap < 0 || anchoring.logoToLinksGap > G.heLogoToLinksMaxGapPx) sideProblems.push(`HE links not immediately after the logo: gap ${anchoring.logoToLinksGap}px (0..${G.heLogoToLinksMaxGapPx})`);
        if (anchoring.linksToActionsGap < 0) sideProblems.push(`HE links overlap / are left of the action group (gap ${anchoring.linksToActionsGap}px)`);
      } else anchoring.collapsed = true; // links hidden at this width: never judged by hidden-node coordinates
    } else if (!logo) sideProblems.push('no logo');
    else sideProblems.push('no visible action group');
  } else if (candAct !== refAct) sideProblems.push(`EN action group anchored ${candAct} != reference ${refAct}`);
  A.headerNavSides = R(sideProblems.length ? STATUS.FAIL : STATUS.PASS, { logo: refLogo, sections: refSec, actionGroup: refAct }, { logo: candLogo, sections: candSec, actionGroup: candAct, ...anchoring }, sideProblems.join('; ') || (locale === 'he' ? 'logo far right, links immediately after it, action group far left (NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT, Owner 2026-10-06)' : 'logo/sections/action group as reference'), locale === 'he' ? ['NAV-OWNER-HE-LOGO-LINKS-ACTIONS-LEFT'] : []);

  // geometry vs the reference
  const geo = [];
  const dh = cand.header.h - ref.header.h;
  if (Math.abs(dh) > G.headerHeightTolerancePx) geo.push(`header height ${cand.header.h} vs reference ${ref.header.h}`);
  const offCentre = (h) => h.items.filter((i) => Math.abs(i.cy - h.header.cy) > G.verticalCentreTolerancePx).map((i) => `${i.role}:${(i.cy - h.header.cy).toFixed(1)}`);
  const cOff = offCentre(cand);
  if (cOff.length) geo.push(`not vertically centred: ${cOff.join(',')}`);
  const startEdge = (h, i) => (h.dir === 'rtl' ? h.header.innerRight - (i.x + i.w) : i.x - h.header.innerLeft);
  const endEdge = (h, i) => (h.dir === 'rtl' ? i.x - h.header.innerLeft : h.header.innerRight - (i.x + i.w));
  const rl = ref.items.find((i) => i.role === 'logo'); const cl = cand.items.find((i) => i.role === 'logo');
  const logoRef = rl ? startEdge(ref, rl) : null; const logoCand = cl ? startEdge(cand, cl) : null;
  if (logoRef === null || logoCand === null || Math.abs(logoCand - logoRef) > G.logoEdgeTolerancePx) geo.push(`logo start-edge offset ${logoCand} vs reference ${logoRef}`);
  let actRef = null; let actCand = null;
  if (locale === 'en') {
    const lastAct = (h) => h.items.filter(isAction).sort((a, b) => b.cx - a.cx)[0];
    const ra = lastAct(ref); const ca = lastAct(cand);
    actRef = ra ? endEdge(ref, ra) : null; actCand = ca ? endEdge(cand, ca) : null;
    if (actRef === null || actCand === null || Math.abs(actCand - actRef) > G.enActionEdgeTolerancePx) geo.push(`EN action end-edge offset ${actCand} vs reference ${actRef}`);
  }
  // absolute placement: distance of the logo (and the EN action group) from the VIEWPORT edge (client width, scrollbar
  // excluded; the candidate scrolls on <body>, so min(html, body) client width), so a content column that differs from the reference (e.g. a centred max-width box vs full bleed) FAILS
  // even when the items sit correctly inside their own box.
  const vpStart = (h, i) => (h.dir === 'rtl' ? h.cw - (i.x + i.w) : i.x);
  const logoVpRef = rl ? Math.round(vpStart(ref, rl)) : null; const logoVpCand = cl ? Math.round(vpStart(cand, cl)) : null;
  const logoVpWant = baseEdges ? baseEdges.logo : logoVpRef; const vpWho = baseEdges ? 'base c65f742 (NAV-OWNER-BASE-COLUMN)' : 'reference';
  if (logoVpWant === null || logoVpCand === null || Math.abs(logoVpCand - logoVpWant) > G.logoEdgeTolerancePx) geo.push(`logo viewport-edge offset ${logoVpCand}px vs ${vpWho} ${logoVpWant}px (content column differs)`);
  let actVpRef = null; let actVpCand = null;
  if (locale === 'en') {
    const lastAct = (h) => h.items.filter(isAction).sort((a, b) => b.cx - a.cx)[0];
    const ra = lastAct(ref); const ca = lastAct(cand);
    actVpRef = ra ? Math.round(ref.cw - (ra.x + ra.w)) : null; actVpCand = ca ? Math.round(cand.cw - (ca.x + ca.w)) : null;
    const actVpWant = baseEdges ? baseEdges.enAction : actVpRef;
    if (actVpWant === null || actVpCand === null || Math.abs(actVpCand - actVpWant) > G.enActionEdgeTolerancePx) geo.push(`EN action viewport-edge offset ${actVpCand}px vs ${vpWho} ${actVpWant}px`);
  }
  A.headerNavGeometry = R(geo.length ? STATUS.FAIL : STATUS.PASS,
    { headerH: ref.header.h, logoStartOffset: logoRef, enActionEndOffset: actRef, logoViewportOffset: logoVpRef, enActionViewportOffset: actVpRef, inner: [ref.header.innerLeft, ref.header.innerRight], clientWidth: ref.cw },
    { headerH: cand.header.h, logoStartOffset: logoCand, enActionEndOffset: actCand, logoViewportOffset: logoVpCand, enActionViewportOffset: actVpCand, inner: [cand.header.innerLeft, cand.header.innerRight], clientWidth: cand.cw },
    geo.join('; ') || `height Δ${dh}px, logo edge Δ${logoCand - logoRef}px (box) / Δ${logoVpCand - logoVpRef}px (viewport)${actCand !== null ? `, EN action edge Δ${actCand - actRef}px (box) / Δ${actVpCand - actVpRef}px (viewport)` : ''}, all items vertically centred`);

  // drawer (only where the candidate shows a toggle)
  if (cand.drawer && !cand.drawer.missing) {
    const dl = cand.drawer.items.filter((i) => i.role === 'language-switch');
    A.drawerNoLanguageSwitch = R(dl.length ? STATUS.FAIL : STATUS.PASS, ref.drawer?.items?.filter((i) => i.role === 'language-switch').map((i) => i.label) || null, dl.map((i) => `${i.label} -> ${i.href}`), 'opened drawer must show no language switch', ['NAV-OWNER-NO-LANGUAGE-SWITCH']);
    // expected drawer = the reference drawer markup (same at every width; on phones the reference shows no toggle) minus
    // the language switch, plus the optional sign-in as the last item (NAV-BASE-SIGN-IN). Nothing else.
    const refDrawer = (ref.drawer && !ref.drawer.missing ? ref.drawer.items.map((i) => (i.role === 'section' ? i.key : i.role)) : ref.drawerMarkup) || [];
    const expD = refDrawer.filter((k) => k !== 'language-switch').map((k) => ({ key: k }));
    expD.push({ key: 'sign-in', optional: true, by: 'NAV-BASE-SIGN-IN' });
    const candD = cand.drawer.items.map((i) => (i.role === 'section' ? i.key : i.role)).filter((k) => k !== 'language-switch');
    const md = refDrawer.length ? matchSequence(expD, candD) : { ok: false, note: 'no reference drawer markup' };
    const wantSide = locale === 'he' ? 'right' : 'left';
    const sideOk = cand.drawer.side === wantSide;
    A.drawerNavOrder = R(md.ok && sideOk ? STATUS.PASS : STATUS.FAIL, { items: refDrawer, source: ref.drawer && !ref.drawer.missing ? 'reference drawer (opened)' : 'reference drawer markup (no reference toggle at this width)', side: ref.drawer?.side ?? null }, { items: candD, side: cand.drawer.side, bg: cand.drawer.bg },
      `${md.ok ? `ordered match (${md.trace.join(' > ')})` : `mismatch at ${md.at}: wanted ${md.wanted}, got ${JSON.stringify(md.got)}${md.note ? ` (${md.note})` : ''}`}; drawer side ${cand.drawer.side} (want ${wantSide}: reference IMPLEMENTATION_HANDOFF.md L40 'HE navigation opens/right-aligns physically right; EN opens/left-aligns physically left')`, ['NAV-OWNER-NO-LANGUAGE-SWITCH', 'NAV-BASE-SIGN-IN', ...(vw <= 520 ? ['NAV-PHONE-MENU-TOGGLE'] : [])]);
  } else if (cand.drawer?.missing) {
    A.drawerNavOrder = R(STATUS.FAIL, null, 'toggle visible but no drawer opened', 'drawer did not open');
  }
  return A;
}
