// Owner console 2026-11-19, typed:
// "מאשר שלוש נקודות עם ריחוף במחשב ובועה בנגיעה בנייד בכל המקומות כמו בתמונות, וצמצום העמודות ברשימת ההצעות, כולל שינוי ב-L-17 ו-L-19, ושחרור עד הלייב"
// "שינוי בחוק הפריסה של רשימת ההצעות: שם הלקוח וכותרת ההצעה בטבלה במחשב מסתיימים בשלוש נקודות ומוצגים במלואם בריחוף, והעמודות הקבועות צרות לפי התוכן שלהן"
// law 50: "שינוי בחוק 50: שם או טקסט ארוך שמסתיים בשלוש נקודות ומוצג במלואו בריחוף או בלחיצה אינו נחשב מילה חתוכה"
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EllipsisText from './components/EllipsisText';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, rel), 'utf8');

describe('one shared "…" + bubble in every place that used to move (19/11)', () => {
  it('no moving text is left in the app (no SlideText, no .pf-slide, no data-slide-text)', () => {
    for (const f of ['components/QuotesTab.jsx', 'pages/Dashboard.jsx', 'components/QuoteTemplateDialogs.jsx', 'components/quoteTree/QuoteTreeEditor.jsx', 'components/quoteTree/quoteTree.css', 'components/leads/LeadsView.jsx', 'components/leads/leads.css', 'components/ClientsTab.jsx', 'index.css']) {
      const s = read(f);
      expect(s, f).not.toMatch(/SlideText|pf-slide|data-slide-text/);
    }
    expect(fs.existsSync(path.join(here, 'components/SlideText.jsx'))).toBe(false);
  });
  it('the box carries the whole text for the law-50 scan: data-full-text and title, both equal to its text', () => {
    const { container } = render(<EllipsisText text="Carter Renovations LLC, 14 Herzl Street" />);
    const box = container.firstChild;
    expect(box.getAttribute('data-full-text')).toBe('Carter Renovations LLC, 14 Herzl Street');
    expect(box.getAttribute('title')).toBe(box.textContent);
    expect(box.className).toBe('pf-ell');
  });
  it('the client list (L-17): name, contact and date on a computer, name and contact on a phone', () => {
    const c = read('components/ClientsTab.jsx');
    expect(c).toContain("import EllipsisText from './EllipsisText';");
    expect((c.match(/<EllipsisText/g) || []).length).toBe(5);
    expect(c).toContain('text={client.company_name}');
    expect(c).toContain("text={client.phone || client.email || ''}");
    expect(c).toContain('text={client.phone || client.email}');
  });
  it('the templates window, the leads and the quote editor use it', () => {
    expect(read('components/QuoteTemplateDialogs.jsx')).toContain('<EllipsisText className="tk-tpl-group-name" text={g.name || C.wholeTemplate} />');
    expect(read('components/leads/LeadsView.jsx')).toContain('<EllipsisText className={`ld-slide ${className}`} dir={dir} text={text} />');
    expect(read('components/quoteTree/QuoteTreeEditor.jsx')).toContain('<EllipsisText className="qt-row-name-box" text={details ? `${it.description} · ${details}` : it.description} />');
  });
  it('the bubble is the system\'s small dark bubble (the feature-lock tooltip look)', () => {
    const css = read('index.css');
    expect(css).toMatch(/\.pf-ell-bubble \{[^}]*background: #1f1b2e; color: #fff;/);
    expect(css).toMatch(/\.pf-ell-bubble \{[^}]*border-radius: 6px;/);
    expect(css).toMatch(/\.pf-ell-bubble \{[^}]*max-width: min\(480px, calc\(100vw - 32px\)\);/); // widened 19/11 (fields1119: a long e-mail never breaks inside a word)
  });
});

describe('the quote list columns as narrow as their content (IRON-QH-LAYOUT-001 change 19/11)', () => {
  const q = read('components/QuotesTab.jsx');
  const d = read('pages/Dashboard.jsx');
  it('QuotesTab measures quote number, status, views and date (header included) besides the amount', () => {
    for (const v of ["['--qm-num-w', '.quote-modern-number', 0]", "['--qm-st-w', '.quote-modern-status', 3]", "['--qm-vw-w', '.quote-modern-views', 4]", "['--qm-dt-w', '.quote-modern-date', 5]"]) expect(q).toContain(v);
    expect(q).toContain("host.style.setProperty('--qm-amt-w'");
  });
  it('the grid: measured fixed tracks, client 3 parts and title 2 parts, the date keeps its 100px floor', () => {
    expect(d).toContain('--qm-cols: var(--qm-num-w, 84px) minmax(0, 3fr) minmax(0, 2fr) var(--qm-st-w, 136px) var(--qm-vw-w, 68px) max(100px, var(--qm-dt-w, 100px)) max(88px, var(--qm-amt-w, 88px));');
  });
});

// Owner console 2026-11-19, typed: "מאשר שינוי ב-L-25 וב-L-26: בטלפון ובטאבלט לאורך, שם או משימה ארוכים בפס ההודעה החמה מסתיימים בשלוש נקודות,
// ונגיעה בשורה פותחת בועה עם כל השורה, ואת שאר התוכנית"
describe('the hot banner phone line: "…" and a tap on the line opens the whole line (L-25 / L-26, 19/11)', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  const fire = (el, type, pointerType) => { const ev = new Event(type, { bubbles: true, cancelable: true }); ev.pointerType = pointerType; el.dispatchEvent(ev); };
  it('a tap on the count beside a shortened name opens the bubble with the whole line, tells the banner to stop, a second tap closes it', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () { return this.classList && this.classList.contains('nm') ? 300 : 0; });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return this.classList && this.classList.contains('nm') ? 120 : 0; });
    const onBubble = vi.fn(); const onBanner = vi.fn();
    render(<div onClick={onBanner}><span className="line"><EllipsisText as="mark" plain tapLine className="nm" text="דוד כהן מאלומיניום הצפון" onBubble={onBubble}
      bubble={<>דוד כהן מאלומיניום הצפון צפה בהצעה 12 פעמים ועדיין לא חתם.</>}><bdi>דוד כהן מאלומיניום הצפון</bdi></EllipsisText><span className="rest"> צפה 12</span></span></div>);
    expect(onBubble).not.toHaveBeenCalled();
    const rest = document.querySelector('.rest');
    act(() => { fire(rest, 'pointerdown', 'touch'); rest.click(); });
    expect(screen.getByRole('tooltip').textContent).toBe('דוד כהן מאלומיניום הצפון צפה בהצעה 12 פעמים ועדיין לא חתם.');
    expect(onBubble).toHaveBeenLastCalledWith(true);
    expect(onBanner).not.toHaveBeenCalled();
    const nm = document.querySelector('.nm');
    expect(nm.getAttribute('data-full-text')).toBe('דוד כהן מאלומיניום הצפון');
    expect(nm.getAttribute('title')).toBe('דוד כהן מאלומיניום הצפון');
    act(() => { fire(nm, 'pointerdown', 'touch'); nm.click(); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onBubble).toHaveBeenLastCalledWith(false);
  });
  it('a name that fits: no bubble, the tap goes on as before', () => {
    const onBanner = vi.fn();
    render(<div onClick={onBanner}><span><EllipsisText as="mark" plain tapLine text="Dan" bubble="Dan viewed this quote 3 times" /><span className="rest"> 3</span></span></div>);
    const rest = document.querySelector('.rest');
    act(() => { fire(rest, 'pointerdown', 'touch'); rest.click(); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onBanner).toHaveBeenCalledTimes(1);
  });
  it('all three phone lines (viewed quote, overdue task, expiring quote) use it with the computer sentence and stop the rotation; the count / days stay outside the "…"', () => {
    const q = read('components/QuotesTab.jsx');
    expect(q.match(/<EllipsisText as="(mark|bdi)" plain tapLine className="[^"]*qhb-short-name"/g)).toHaveLength(4);
    expect(q.match(/onBubble={setHotPaused}/g)).toHaveLength(4);
    expect(q).toContain('bubble={hotLine} onBubble={setHotPaused}');
    expect(q.match(/bubble={stepLine}/g)).toHaveLength(3);
    expect(q).toContain('<span className="quote-hot-banner-text">{hotLine}</span>');
    expect(q.split('<span className="quote-hot-banner-text">{stepLine}</span>').length - 1).toBe(2);
    expect(q.match(/<span className="qhb-short-rest">/g)).toHaveLength(3);
    expect(read('index.css')).toContain('.pf-ell-bubble .quote-hot-banner-name { color: inherit; background: transparent; font-weight: 700; }');
  });
});

// Owner console 2026-11-19, answer א: "שם המקום בכפתור יורד לשורה נוספת ונראה במלואו, כמו כותרת המקום שמעליו"
describe('"+ add a heading inside": a long place name wraps inside the button (19/11, answer א)', () => {
  // Owner console 2026-11-20/21 (the simple-quotes sketch is the approved demo; typed L-07 / L-09 / L-14 / L-29 ... only as needed): "add a section inside" is an item of the section's "⋯" menu - a short fixed label, no place name in it (nothing to wrap)
  it('the menu item says "הוספת חלק בתוך" / "Add a section inside" without the name', () => {
    const tree = read('components/quoteTree/QuoteTreeEditor.jsx');
    expect(tree).toContain("hInside: 'הוספת חלק בתוך'");
    expect(tree).toContain("hInside: 'Add a section inside'");
    expect(tree).toContain("{ label: t.hInside, icon: <PlusCircle {...sizeOf(16)} />, testId: 'qt-add-inside',");
  });
});

// the agents' review of 19/11: a number never shows in part; the Hebrew bubble sits at the text's start (no scroll-bar offset); a tapped
// editor row name keeps its plain look (the approved pictures)
describe('review fixes (19/11)', () => {
  afterEach(() => cleanup());
  it('every number run is one unbreakable box - "הרצל 120" never reads "הרצל 0…"; the text itself is unchanged', () => {
    render(<EllipsisText className="nb" dir="rtl" text="חברת הניהול ברחוב הרצל 120, דירה 3/4" />);
    const box = document.querySelector('.nb');
    expect([...box.querySelectorAll('.pf-ell-num')].map((n) => n.textContent)).toEqual(['120', '3/4']);
    expect(box.textContent).toBe('חברת הניהול ברחוב הרצל 120, דירה 3/4');
    expect(box.getAttribute('data-full-text')).toBe(box.textContent);
    expect(read('index.css')).toContain('.pf-ell-num { display: inline-block; }');
  });
  it('the bubble edge lands on the text edge in both languages (no scroll-bar offset); a touch screen keeps no hover look on the tapped row name', () => {
    const e = read('components/EllipsisText.jsx');
    expect(e).toContain('const want = Math.max(8, Math.min(bubble.rtl ? bubble.edge - w : bubble.edge, vw - w - 8));');
    expect(e).toContain('if (Math.abs(got - want) > 0.5) el.style.left = ');
    expect(read('components/quoteTree/quoteTree.css')).toContain('@media (hover: none) { .qt-row-name:hover:not(:focus-visible) { color: #0f172a; text-decoration: none; } }');
  });
});
