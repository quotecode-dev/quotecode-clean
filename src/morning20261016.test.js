// Owner console 2026-10-16 (morning): the collapsed mobile quote card shows the view count - eye + number only - in the middle of
// the number / date / status line, and the long client name stays on one line, cut. The real-render proof (320/360/390/412, HE + EN,
// centred to 1px, 6px inset) is C:\tekango-ops\journey-stack\spec-morning.mjs.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const quotesTab = fs.readFileSync(path.join(SRC, 'components', 'QuotesTab.jsx'), 'utf8').split(String.fromCharCode(13)).join('');
const card = quotesTab.slice(quotesTab.indexOf('className="quote-card"'));

describe('mobile quote card: eye + view count in the middle (Owner 2026-10-16)', () => {
  it('the meta line is a 3-column grid: number/date, views, status at the end', () => {
    expect(card).toMatch(/gridTemplateColumns: 'minmax\(0, 1fr\) auto minmax\(0, 1fr\)'/);
    const date = card.indexOf('data-qh="date"');
    const views = card.indexOf('data-qh="views"');
    const status = card.indexOf('data-qh="status"');
    expect(date).toBeGreaterThan(0);
    expect(views).toBeGreaterThan(date);
    expect(status).toBeGreaterThan(views);
    expect(card.slice(status, status + 200)).toMatch(/justifySelf: 'end'/);
  });

  it('eye + number only; the number is an isolated LTR numeral; the accessible name is grammatical', () => {
    const views = card.slice(card.indexOf('data-qh="views"'), card.indexOf('data-qh="status"'));
    expect(views).toMatch(/<Eye size=\{13\}[^>]*aria-hidden="true" \/>/);
    expect(views).toMatch(/<bdi className="pf-num" dir="ltr">\{Number\(quote\.view_count \|\| 0\)\}<\/bdi>/);
    expect(views).not.toMatch(/צפיות<|views</);
    expect(quotesTab).toMatch(/n === 1 \? 'צפייה אחת' : `\$\{n\} צפיות`/);
    expect(quotesTab).toMatch(/n === 1 \? '1 view' : `\$\{n\} views`/);
  });

  it('the client name in the card stays on one line and is cut with an ellipsis', () => {
    const name = card.slice(card.indexOf('className="pf-font-variable"'), card.indexOf('data-qh="client"'));
    expect(name).toMatch(/overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'/);
    expect(name).toMatch(/title=\{quote\.clients\?\.company_name/);
  });
});
