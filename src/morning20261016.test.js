// Owner console 2026-10-16 (morning): the collapsed mobile quote card shows the view count - eye + number only - in the middle of
// the number / date / status line, and the long client name stays on one line, cut. The real-render proof (320/360/390/412, HE + EN,
// centred to 1px, 6px inset) is C:\tekango-ops\journey-stack\spec-morning.mjs.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const quotesTab = fs.readFileSync(path.join(SRC, 'components', 'QuotesTab.jsx'), 'utf8').split(String.fromCharCode(13)).join('');
const card = quotesTab.slice(quotesTab.indexOf('className={`quote-card qc'));

describe('mobile quote card: eye + view count in the middle (Owner 2026-10-16)', () => {
  // Owner console 2026-11-20/21 (the simple-quotes sketch is the approved demo; typed L-07 / L-09 / L-19 / ... only as needed): the second line of the card is the number, the date and the views together, the status at the end of the line
  it('the meta line: number · date · views, then the status at the end', () => {
    const date = card.indexOf('data-qh="date"');
    const views = card.indexOf('data-qh="views"');
    const status = card.indexOf('data-qh="status"');
    expect(date).toBeGreaterThan(0);
    expect(views).toBeGreaterThan(date);
    expect(status).toBeGreaterThan(views);
    expect(card).toContain('<span className="qc-r2">');
    expect(card).toContain('<span className="qc-ln2">');
  });

  it('eye + number only; the number is an isolated LTR numeral; the accessible name is grammatical', () => {
    const views = card.slice(card.indexOf('data-qh="views"'), card.indexOf('data-qh="status"'));
    expect(views).toMatch(/<Eye size=\{13\}[^>]*aria-hidden="true" \/>/);
    expect(views).toMatch(/<bdi className="pf-num" dir="ltr">\{Number\(quote\.view_count \|\| 0\)\}<\/bdi>/);
    expect(views).not.toMatch(/צפיות<|views</);
    expect(quotesTab).toMatch(/n === 1 \? 'צפייה אחת' : `\$\{n\} צפיות`/);
    expect(quotesTab).toMatch(/n === 1 \? '1 view' : `\$\{n\} views`/);
  });

  // L-19 changed by the Owner (console 2026-11-19, typed: "מאשר שלוש נקודות עם ריחוף במחשב ובועה בנגיעה בנייד בכל המקומות כמו בתמונות, ...
  // כולל שינוי ב-L-17 ו-L-19, ושחרור עד הלייב"): still one line, a long name ends with "…" and a tap shows it whole (EllipsisText)
  it('the client name in the card stays on one line and a long name ends with an ellipsis (whole on tap)', () => {
    expect(card).toContain('<EllipsisText className="qc-nm" text={clientName} data-qh="client" />');
    expect(quotesTab).toContain("const clientName = quote.clients?.company_name || 'N/A';");
    expect(card).not.toMatch(/textOverflow: 'clip'/);
  });
});
