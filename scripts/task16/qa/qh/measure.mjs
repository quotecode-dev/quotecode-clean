// Task 16 - Quote History "usable room" measurement (LOCAL-DEV, synthetic data). Shared by layout-regression-gate.mjs and
// qh-room-compare.mjs so the gate and the base-vs-candidate comparison measure exactly the same things.
//
// list        : clientHeight of the list's own scroll container (the definition the gate has always used).
// listToBottom: px from the top of that container to the viewport bottom (informational).
// rowsFull    : list items (cards / table rows) FULLY visible inside the scroll container and the viewport.
// greetingH   : height of the dark greeting card (.dash-upper-section).
// greetLines  : visual lines of the greeting row (title + stats + AI/plan badge); statsLines: lines inside the stats block.
// qhHeadLines : visual lines of the Quote History header (title, Export CSV, search, status/filters, any metrics).
// metrics     : the Task 16 status-count metrics element is present ([data-testid="qh-metrics"]).
// amounts     : every visible money atom in the greeting card and the list - clipped = ellipsis/overflow/outside a clipping
//               ancestor/outside the viewport. A clipped amount is a FAIL whatever the room is.
// minFont     : smallest computed font-size of any visible text inside the greeting card + Quote History screen.
// targets     : every visible control (button/input/select/a) in the greeting card and the Quote History header, keyed so
//               base and candidate controls can be compared one to one (w/h in CSS px).
// overlaps    : intersecting visible text leaves inside the greeting card and the Quote History header.
export async function measureQH(page) {
  return page.evaluate(() => {
    const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const lines = (els) => { const tops = els.filter(vis).map((e) => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; }).sort((a, b) => a - b); let n = 0; let last = -1e9; for (const t of tops) { if (t - last > 8) { n++; last = t; } } return n; };
    const screen = document.querySelector('.pf-work-screen');
    const upper = document.querySelector('.dash-upper-section');
    const items = [...document.querySelectorAll('.quote-card, .pf-work-screen tbody tr')].filter(vis);
    let sc = items[0]?.parentElement;
    while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 2) break; sc = sc.parentElement; }
    const scroller = sc && sc !== document.body ? sc : null;
    const sb = scroller ? scroller.getBoundingClientRect() : null;
    const visTop = sb ? Math.max(0, sb.top) : 0; const visBot = sb ? Math.min(innerHeight, sb.top + scroller.clientHeight) : innerHeight;
    const rowsFull = items.filter((it) => { const b = it.getBoundingClientRect(); return b.top >= visTop - 0.5 && b.bottom <= visBot + 0.5; }).length;
    const firstTop = items[0] ? items[0].getBoundingClientRect().top : 1e9;
    // greeting row
    const row = document.querySelector('.dash-header-row');
    const greetEls = row ? [...row.children].filter(vis) : [];
    const stats = document.querySelector('.dash-header-stats');
    const statLeaves = stats ? [...stats.querySelectorAll('span')].filter((e) => vis(e) && e.children.length === 0 && e.textContent.trim()) : [];
    // QH header = everything in the work screen above the first list item that is a control / title / metric
    const headEls = screen ? [...screen.querySelectorAll('h2, button, input, select, [data-qh-metric]')].filter((e) => vis(e) && e.getBoundingClientRect().bottom <= firstTop + 0.5 && !e.closest('.quote-card, tbody, thead')) : [];
    // amounts
    const amountEls = [...document.querySelectorAll('.dash-upper-section .pf-money, .pf-work-screen .pf-money, .pf-work-screen [data-qh="amount"]')].filter(vis).filter((e, i, a) => a.indexOf(e) === i);
    const clipInfo = (el) => {
      const r = el.getBoundingClientRect(); const reasons = [];
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible') reasons.push(`self-overflow ${el.scrollWidth}>${el.clientWidth}`);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) reasons.push('ellipsis');
      if (r.left < -0.5 || r.right > innerWidth + 0.5) reasons.push('outside-viewport-x');
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') {
          const ab = a.getBoundingClientRect();
          if (acs.overflowX !== 'visible' && (r.left < ab.left - 0.5 || r.right > ab.right + 0.5)) { reasons.push(`clipped-x-by ${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]}`); break; }
          if (/(hidden|clip)/.test(acs.overflowY) && (r.top < ab.top - 0.5 || r.bottom > ab.bottom + 0.5)) { reasons.push(`clipped-y-by ${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]}`); break; }
        }
      }
      return reasons;
    };
    const amounts = amountEls.map((e) => ({ where: e.closest('.dash-upper-section') ? 'header' : 'list', text: e.textContent.trim(), w: Math.round(e.getBoundingClientRect().width), clipped: clipInfo(e) }))
      // list amounts below the fold of the internal scroller are not "visible"; judge only those inside the visible list box
      .filter((a, i) => { if (a.where === 'header') return true; const b = amountEls[i].getBoundingClientRect(); return b.top >= visTop - 0.5 && b.bottom <= visBot + 0.5; });
    // fonts
    const textEls = [upper, screen].filter(Boolean).flatMap((root) => [...root.querySelectorAll('*')]).filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const textInView = textEls.filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; });
    const minFontEl = textInView.reduce((m, e) => { const f = parseFloat(getComputedStyle(e).fontSize); return !m || f < m.f ? { f, t: e.textContent.trim().slice(0, 30) } : m; }, null);
    // targets
    const ctrlEls = [...(upper ? upper.querySelectorAll('button, input, select, a[href]') : []), ...headEls.filter((e) => /^(BUTTON|INPUT|SELECT)$/.test(e.tagName))].filter(vis);
    const seen = {};
    const targets = ctrlEls.map((e) => { const b = e.getBoundingClientRect(); let k = `${e.closest('.dash-upper-section') ? 'greet' : 'qh'}:${e.tagName.toLowerCase()}:${(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.textContent || '').trim().replace(/\s+/g, ' ').replace(/\d+/g, '#').slice(0, 28)}`; seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) k += `#${seen[k]}`; return { k, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; });
    // overlaps among text leaves of the greeting card and the QH header
    const leaves = [...(upper ? upper.querySelectorAll('*') : []), ...headEls.flatMap((h) => [h, ...h.querySelectorAll('*')])].filter((e) => vis(e) && e.children.length === 0 && e.textContent.trim());
    let overlaps = 0; const ov = [];
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue;
      const a = leaves[i].getBoundingClientRect(); const b = leaves[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) { overlaps++; if (ov.length < 4) ov.push([leaves[i].textContent.trim().slice(0, 20), leaves[j].textContent.trim().slice(0, 20)]); }
    }
    return {
      list: scroller ? scroller.clientHeight : null,
      listToBottom: sb ? Math.round(innerHeight - sb.top) : null,
      items: items.length, rowsFull,
      layout: screen?.getAttribute('data-qh-layout') || null,
      greetingH: upper ? Math.round(upper.getBoundingClientRect().height * 10) / 10 : null,
      greetLines: lines(greetEls), statsLines: lines(statLeaves),
      // phones (<=768): the title and the AI Chat + plan badge group share ONE row (the gate's original one-row contract)
      greetingBadgeWraps: (() => { const t = document.querySelector('.dash-header-row > .dash-header-title'); const mb = document.querySelector('.dash-header-badge-mobile'); if (!t || !mb || getComputedStyle(mb).display === 'none') return null; return Math.abs(t.getBoundingClientRect().top - mb.getBoundingClientRect().top) > 12; })(),
      qhHeadLines: lines(headEls), qhHeadBottom: headEls.length ? Math.round(Math.max(...headEls.map((e) => e.getBoundingClientRect().bottom))) : null,
      metrics: !!document.querySelector('[data-testid="qh-metrics"]'),
      // table layout: widest header label overflow past its cell's content box (px; <= 0 = the label fits its slot)
      thOverflow: (() => { const ths = [...document.querySelectorAll('.pf-work-screen thead th')].filter(vis); if (!ths.length) return null; return Math.max(...ths.map((th) => { if (!th.textContent.trim()) return -1e9; const rg = document.createRange(); rg.selectNodeContents(th); const tw = rg.getBoundingClientRect().width; const cs = getComputedStyle(th); return Math.round((tw - (th.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))) * 10) / 10; })); })(),
      revenueText: stats?.querySelector('.pf-money')?.textContent.trim() || null,
      amounts, amountsClipped: amounts.filter((a) => a.clipped.length).length,
      minFont: minFontEl ? minFontEl.f : null, minFontText: minFontEl ? minFontEl.t : null,
      targets, minTargetH: targets.length ? Math.min(...targets.map((t) => t.h)) : null,
      overlaps, overlapSamples: ov,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      greetingBg: upper ? getComputedStyle(upper).backgroundColor : null,
    };
  });
}

// Per-control target comparison: a control that is present in base and candidate must not get smaller than base when
// the candidate value is under 44px (a control that was >= 44px in base must stay >= 44px; one that was smaller in base
// must not shrink further). Controls only present on one side are listed, not judged.
export function compareTargets(baseTargets, candTargets) {
  const b = Object.fromEntries((baseTargets || []).map((t) => [t.k, t]));
  const shrunk = [];
  for (const t of candTargets || []) {
    const o = b[t.k];
    if (!o) continue;
    for (const dim of ['w', 'h']) if (t[dim] < o[dim] - 0.5 && t[dim] < 44) shrunk.push({ k: t.k, dim, base: o[dim], cand: t[dim] });
  }
  return shrunk;
}
