// Task 16 (A2) - landing quote illustration: recipient roles (public-renderer base contract) and the centred numeric
// columns of the items table (Owner decision: a LOCAL explicit exception to IRON-NUMERIC-001, landing only).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import LandingQuoteDocument from './LandingQuoteDocument';
import { buildLandingQuoteModel } from './landingQuoteModel';

const css = readFileSync(join(cwd(), 'src/components/landing/landing.css'), 'utf8');
const STYLES = ['classic', 'modern', 'visual'];
const EXPECT = {
  he: { to: 'לכבוד', attn: 'לידי', client: 'מרחבי צפון בע״מ', address: 'דרך הנמל 18, חיפה', contact: 'נועה לוי', role: 'מנהלת לוגיסטיקה', business: 'ויסטארו', businessLine: 'חלונות, דלתות ומעטפת בניין · חיפה' },
  en: { to: 'To', attn: 'Attn', client: 'Northline Workspaces Ltd.', address: '18 Harbor Way, Portland', contact: 'Nora Lane', role: 'Logistics Manager', business: 'VISTARO', businessLine: 'Windows, doors & building envelope · Portland' },
};

afterEach(() => cleanup());

describe('landing illustration - recipient model (client and contact separated)', () => {
  for (const lang of ['he', 'en']) {
    it(`${lang}: client {name, details} and contact {name, role} replace the mixed customer line`, () => {
      const m = buildLandingQuoteModel(lang);
      expect(m.client).toEqual({ name: EXPECT[lang].client, details: [EXPECT[lang].address] });
      expect(m.contact).toEqual({ name: EXPECT[lang].contact, role: EXPECT[lang].role });
      expect(m).not.toHaveProperty('customerLine');
      expect(m).not.toHaveProperty('customer');
      expect(m.labels).not.toHaveProperty('from');
      expect(m.labels.to).toBe(EXPECT[lang].to);
      expect(m.labels.attn).toBe(EXPECT[lang].attn);
    });
    it(`${lang}: the contact is optional (false/null -> none; an object -> that contact with its role)`, () => {
      expect(buildLandingQuoteModel(lang, { contact: false }).contact).toBeNull();
      expect(buildLandingQuoteModel(lang, { contact: null }).contact).toBeNull();
      expect(buildLandingQuoteModel(lang, { contact: { name: 'Sam Doe', role: 'Ops' } }).contact).toEqual({ name: 'Sam Doe', role: 'Ops' });
    });
  }
});

describe('landing illustration - recipient blocks in every style and language', () => {
  for (const lang of ['he', 'en']) {
    for (const style of STYLES) {
      it(`${lang}/${style}: client (${EXPECT[lang].to}) first and dominant, contact (${EXPECT[lang].attn}) independent, no business in the parties`, () => {
        const e = EXPECT[lang];
        const { container } = render(<LandingQuoteDocument locale={lang} style={style} />);
        const doc = container.querySelector('[data-landing-doc]');
        expect(doc.getAttribute('dir')).toBe(lang === 'he' ? 'rtl' : 'ltr');
        const parties = container.querySelector('[data-landing-parties]');
        const client = parties.querySelector('[data-role="client"]');
        const contact = parties.querySelector('[data-role="contact"]');
        expect(client).not.toBeNull();
        expect(contact).not.toBeNull();
        // role -> data
        expect(client.querySelector('small').textContent).toBe(e.to);
        expect(client.querySelector('.tl-party-name').textContent).toBe(e.client);
        expect(client.textContent).toContain(e.address);
        expect(client.textContent).not.toContain(e.contact);
        expect(contact.querySelector('small').textContent).toBe(e.attn);
        expect(contact.querySelector('.tl-party-name').textContent).toBe(e.contact);
        expect(contact.textContent).not.toContain(e.client);
        expect(contact.textContent).not.toContain(e.address);
        // DOM order: client before contact (RTL puts the client on the right, LTR on the left)
        expect([...parties.children]).toEqual([client, contact]);
        expect(client.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // client dominant, contact secondary
        expect(client.classList.contains('tl-party--client')).toBe(true);
        expect(contact.classList.contains('tl-party--contact')).toBe(true);
        // the business is not a recipient party; it stays in the header (issuer) and the footer
        expect(parties.textContent).not.toContain(e.business);
        expect(parties.textContent).not.toContain(e.businessLine);
        for (const block of container.querySelectorAll('[data-role]')) expect(block.textContent).not.toContain(e.business);
        expect(parties.textContent).not.toMatch(/מאת|עבור|\bFrom\b|Prepared for/);
        expect(container.querySelector('.tl-issuer-logo').getAttribute('alt')).toBe(e.business);
        expect(container.querySelector('.tl-doc-foot').textContent).toContain(e.business);
      });
      it(`${lang}/${style}: without a contact there is NO contact block (no empty block)`, () => {
        const { container } = render(<LandingQuoteDocument locale={lang} style={style} contact={false} />);
        const parties = container.querySelector('[data-landing-parties]');
        expect(parties.querySelector('[data-role="contact"]')).toBeNull();
        expect(parties.children).toHaveLength(1);
        expect(parties.querySelector('[data-role="client"] .tl-party-name').textContent).toBe(EXPECT[lang].client);
        expect(parties.textContent).not.toContain(EXPECT[lang].attn === 'Attn' ? 'Attn' : 'לידי');
        expect(parties.textContent).not.toContain(EXPECT[lang].contact);
      });
      it(`${lang}/${style}: an optional contact role renders inside the contact block only`, () => {
        const { container } = render(<LandingQuoteDocument locale={lang} style={style} contact={{ name: 'Sam Doe', role: 'Ops lead' }} />);
        const contact = container.querySelector('[data-role="contact"]');
        expect(contact.textContent).toContain('Sam Doe');
        expect(contact.textContent).toContain('Ops lead');
        expect(container.querySelector('[data-role="client"]').textContent).not.toContain('Ops lead');
      });
    }
  }
  it('server render keeps the hooks and the client-first order', () => {
    const html = renderToString(<LandingQuoteDocument locale="he" style="classic" />);
    expect(html.indexOf('data-role="client"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-role="client"')).toBeLessThan(html.indexOf('data-role="contact"'));
  });
});

describe('landing illustration - items table: protected numeric axis', () => {
  for (const lang of ['he', 'en']) {
    for (const style of STYLES) {
      it(`${lang}/${style}: numeric headers and cells use the protected axis; values expose integer/fraction slots`, () => {
        const { container } = render(<LandingQuoteDocument locale={lang} style={style} />);
        const band = container.querySelector('.tl-letterhead-band');
        expect(band).not.toBeNull();
        expect(band.querySelector('.tl-issuer')).not.toBeNull();
        expect(band.querySelector('.tl-meta')).not.toBeNull();
        const corner = band.querySelector('.tl-band-corner');
        const call = corner?.querySelector('.tl-header-call');
        const meta = band.querySelector('.tl-meta');
        expect(call).not.toBeNull();
        expect(call.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(meta.children).toHaveLength(style === 'visual' ? 2 : 3);
        expect(band.querySelector('.tl-doc-title')).toBeNull();
        expect(container.querySelector('.tl-doc-title')).not.toBeNull();
        const table = container.querySelector('table.tl-items');
        const ths = [...table.querySelectorAll('thead th')];
        expect(ths).toHaveLength(4);
        expect(ths[0].classList.contains('tl-num-axis')).toBe(false);
        for (const th of ths.slice(1)) expect(th.classList.contains('tl-num-axis')).toBe(true);
        expect(ths[1].classList.contains('tl-qty-axis')).toBe(true);
        expect(ths[2].classList.contains('tl-qty-axis')).toBe(false);
        expect(ths[3].classList.contains('tl-qty-axis')).toBe(false);
        const rows = [...table.querySelectorAll('tbody tr')];
        expect(rows.length).toBeGreaterThan(0);
        expect(table.querySelectorAll('.pq-media-thumb')).toHaveLength(style === 'classic' ? 0 : rows.length);
        for (const tr of rows) {
          const tds = [...tr.children];
          expect(tds[0].classList.contains('tl-num-axis')).toBe(false);
          for (const td of tds.slice(1)) {
            expect(td.classList.contains('tl-num-axis')).toBe(true);
            expect(td.getAttribute('dir')).toBe('ltr'); // LTR-isolated figures
            expect(td.querySelector('.tl-num-value')).not.toBeNull();
            expect(td.querySelector('.tl-num-integer')).not.toBeNull();
            expect(td.querySelector('.tl-num-fraction')).not.toBeNull();
          }
          expect(tds[1].classList.contains('tl-qty-axis')).toBe(true);
          expect(tds[2].classList.contains('tl-qty-axis')).toBe(false);
          expect(tds[3].classList.contains('tl-qty-axis')).toBe(false);
        }
        expect(container.querySelector('.tl-totals .tl-num-axis')).toBeNull();
        const totals = [...container.querySelectorAll('.tl-total-row')];
        expect(totals).toHaveLength(lang === 'he' ? 4 : 3);
        for (const row of totals) {
          expect(row.querySelector('.tl-total-amount .tl-num-value')).not.toBeNull();
          expect(row.querySelector('.tl-num-integer')).not.toBeNull();
          expect(row.querySelector('.tl-num-fraction')).not.toBeNull();
        }
        expect(container.querySelectorAll('.tl-doc-actions .tl-doc-action')).toHaveLength(4);
      });
    }
  }
  it('CSS: every sample has a black issuer/metadata header band with readable text', () => {
    expect(css).toMatch(/\.tl-letterhead-band \{[^}]*background:\s*#000000;[^}]*color:\s*#ffffff;/);
    expect(css).toMatch(/\.tl-letterhead-band \.tl-issuer > div > b \{\s*color:\s*#ffffff;/);
    expect(css).toMatch(/\.tl-issuer-logo \{[^}]*object-fit:\s*contain;/);
    expect(css).toMatch(/\.tl-doc-title \{[^}]*color:\s*#000000;/);
  });
  it('CSS: the compact metadata rail stays physically left in HE and physically right in EN', () => {
    expect(css).toMatch(/\.tl-brandline \{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 42%\) minmax\(0, 56%\);/);
    expect(css).toMatch(/\.tl-band-corner \{[^}]*width:\s*100%;/);
    expect(css).toMatch(/\.tl-issuer \{[^}]*align-items:\s*flex-start;/);
    expect(css).toMatch(/\.tl-letterhead-band \.tl-meta \{[^}]*width:\s*56%;[^}]*margin:\s*10px auto 0 0;/);
    expect(css).toMatch(/\.tl-doc\[dir='ltr'\] \.tl-letterhead-band \.tl-meta \{[^}]*margin-right:\s*0;[^}]*margin-left:\s*auto;/);
    expect(css).toMatch(/@container tl-document \(max-width:\s*640px\)[\s\S]*?\.tl-letterhead-band \.tl-meta,[\s\S]*?width:\s*100%;\s*margin:\s*10px 0 0;/);
    expect(css).toMatch(/\.tl-meta-cell \{[^}]*padding:\s*5px 4px;/);
    expect(css).toMatch(/\.tl-meta-cell small \{[^}]*min-height:\s*1\.3em;[^}]*white-space:\s*nowrap;/);
  });
  it('HE issuer phone keeps readable digits but inherits the RTL row alignment', () => {
    const { container } = render(<LandingQuoteDocument locale="he" style="classic" />);
    const phone = container.querySelector('.tl-issuer-phone');
    expect(phone.getAttribute('dir')).toBeNull();
    expect(phone.querySelector('bdi[dir="ltr"]').textContent).toBe('050-1234567');
    expect(css).toMatch(/\.tl-doc\[dir='rtl'\] \.tl-issuer-details \{\s*direction:\s*rtl;\s*text-align:\s*right;/);
  });
  it('CSS: item cells and every summary amount share a right edge and fixed decimal slot', () => {
    expect(css).toMatch(/\.tl-items th\.tl-num-axis,\s*\.tl-items td\.tl-num-axis\s*\{\s*text-align:\s*right;\s*\}/);
    expect(css).toMatch(/\.tl-items \.tl-num \{[^}]*font-variant-numeric:\s*tabular-nums lining-nums/);
    expect(css).toMatch(/\.tl-num-value \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 3ch;[^}]*direction:\s*ltr;[^}]*unicode-bidi:\s*isolate;/);
    expect(css).toMatch(/\.tl-num-integer \{[^}]*text-align:\s*right;/);
    expect(css).toMatch(/\.tl-num-fraction \{\s*text-align:\s*left;/);
    expect(css).toMatch(/\.tl-num-fraction--placeholder \{\s*visibility:\s*hidden;/);
    expect(css).toMatch(/\.tl-items th, \.tl-items td \{[^}]*text-align:\s*start/);
    expect(css).toMatch(/\.tl-total-row \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 22%;/);
    expect(css).toMatch(/\.tl-total-amount \{[^}]*padding-inline:\s*6px;/);
    expect(css).toMatch(/\.tl-total-row \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 27%;/);
    expect(css).toMatch(/\.tl-total-amount, \.tl-total-row\.tl-final \.tl-total-amount \{\s*padding-inline:\s*2px;\s*font-size:\s*12px;/);
    expect(css).not.toMatch(/\.tl-total-row \{[^}]*grid-template-columns:[^}]*ch;/);
    expect(css).toMatch(/\.tl-total-row\.tl-final \.tl-total-amount \{\s*font-size:\s*13\.5px;\s*font-weight:\s*600;/);
  });
  it('CSS: the quantity heading and each visible quantity value are centred without an invisible fraction slot', () => {
    expect(css).toMatch(/\.tl-items th\.tl-qty-axis,\s*\.tl-items td\.tl-qty-axis\s*\{\s*text-align:\s*center;\s*\}/);
    expect(css).toMatch(/\.tl-qty-axis \.tl-num-value\s*\{\s*display:\s*inline;\s*width:\s*auto;\s*\}/);
    expect(css).toMatch(/\.tl-qty-axis \.tl-num-fraction--placeholder\s*\{\s*display:\s*none;\s*\}/);
  });
  it('CSS: the client name is dominant in the document accent; the contact is secondary', () => {
    expect(css).toMatch(/\.tl-party--client \{[^}]*background:\s*#f3f7f7;[^}]*border-inline-start:\s*4px solid var\(--tl-q\)/);
    expect(css).toMatch(/\.tl-party--client \.tl-party-name \{[^}]*font-size:\s*19px;[^}]*font-weight:\s*800;[^}]*color:\s*var\(--tl-q\)/);
    expect(css).toMatch(/\.tl-party--contact \.tl-party-name \{[^}]*font-size:\s*13\.5px;/);
  });
});
