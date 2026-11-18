// 2026-11-18 (Owner console, typed: "מאשר שינוי ב-L-27: טבלת הפריטים בדף הלקוח, בעברית ובאנגלית, 12 פיקסלים משני הקצוות כמו בתמונות,
// ושחרור עד הלייב" + "מאשר את גרסת 12 הפיקסלים ששומרת על חוק המספרים, כמו בתמונות, ושחרור עד הלייב" + "תנעל את זה"): the customer page item
// table keeps 12px from BOTH outer edges on the screen, Hebrew and English; the amounts keep one box / right edge / decimal axis
// (IRON-NUMERIC-001); the "סה״כ" header no longer takes the Hebrew box-width padding of 10/11. LOCKED (L-27).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncMoneyBox } from './quoteDocument/useAmountAxis';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, 'quoteDocument/quoteDocument.css'), 'utf8');
const axis = fs.readFileSync(path.join(here, 'quoteDocument/useAmountAxis.js'), 'utf8');
const block = css.slice(css.indexOf('/* Owner console 2026-11-18 (L-27 change'));
const P = ".pq-page.pq-page[dir='DIR'] .pq-card.pq-card table.pq-commercial-table.pq-commercial-table";

describe('customer page item table: 12px from both edges (Owner 18/11, L-27)', () => {
  it('screen only: the first cell of every row 12px from the start edge, the amount column 12px from the end edge, in both directions', () => {
    expect(block.length).toBeGreaterThan(0);
    const screen = block.slice(block.indexOf('@media screen {'));
    expect(screen.startsWith('@media screen {')).toBe(true);
    expect(screen).toContain(`${P.replace('DIR', 'ltr')} tr > :first-child { padding-left: 12px !important; }`);
    expect(screen).toContain(`${P.replace('DIR', 'rtl')} tr > :first-child { padding-right: 12px !important; }`);
    expect(screen).toContain(`${P.replace('DIR', 'ltr')} td.pq-td-total { text-align: right !important; padding-right: 12px !important; }`);
    expect(screen).toContain(`${P.replace('DIR', 'rtl')} td.pq-td-total { text-align: left !important; padding-left: 12px !important; }`);
    expect(screen).toContain(`${P.replace('DIR', 'ltr')} th.pq-th-total,`);
    expect(screen).toContain(`${P.replace('DIR', 'rtl')} th.pq-th-total,`);
  });

  it('IRON-NUMERIC-001 stays: the Hebrew amount box (one width, right-aligned digits) and the totals that follow the column paddings', () => {
    expect(css).toContain(".pq-page[dir='rtl'] .pq-card .pq-commercial-table td.pq-td-total .pf-money {\n  display: inline-block !important;\n  box-sizing: border-box;\n  text-align: right !important;\n  min-width: calc(var(--pq-money-box-n, 0) * 1em) !important;\n}");
    expect(axis).toContain("box.style.setProperty('--pq-amount-pad-l', cs.paddingLeft);");
    expect(axis).toContain("box.style.setProperty('--pq-amount-pad-r', cs.paddingRight);");
    const moneyBox = axis.slice(axis.indexOf('export function syncMoneyBox(card)'), axis.indexOf('export function syncQtyCentre(card)'));
    expect(moneyBox.length).toBeGreaterThan(0);
    expect(moneyBox).not.toContain("th.style.setProperty('padding-left'");
    // the unit-price header keeps its own rule (night 16/11 item 8)
    expect(axis).toContain('export function syncPriceHead(card)');
  });

  it('the "סה״כ" header keeps no inline box-width padding (an older one is cleared)', () => {
    document.body.innerHTML = '<div class="pq-page" dir="rtl"><div class="pq-card"><table class="pq-commercial-table"><thead><tr><th class="pq-th-total" style="padding-left: 3em">סה״כ</th></tr></thead><tbody><tr><td class="pq-td-total"><span class="pf-money">₪250.00</span></td></tr></tbody></table></div></div>';
    const card = document.querySelector('.pq-card');
    syncMoneyBox(card);
    expect(document.querySelector('th.pq-th-total').style.paddingLeft).toBe('');
    expect(card.style.getPropertyValue('--pq-money-box-n')).not.toBe('');
  });
});
