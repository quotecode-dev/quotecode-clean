// Owner console 2026-11-24, typed: "מאשר תיקון ארבעת הממצאים: כיוון התגיות בפוסטים, ושלוש נקודות עם בועה במייל ברשימת המשתמשים, בתוויות
// ובטקסטים במסך רשתות חברתיות ובתווית ההצעה ביומן, כולל שינוי ב-L-21, L-22 ו-L-30, שחרור עד הלייב" + "ומה עם הסכום? צריך שלפחות הוא יהיה
// XX" + "לסדר גם את הרובוט שיהיה כמו כולם" + "מאשר את תוכנית השחרור: ארבעת הממצאים, הסכום בשתי ספרות והרובוט בדף יצירת הקשר".
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, cleanup } from '@testing-library/react';
import { formatToolNumber } from './utils/publicToolsCore';

const invoke = vi.fn();
vi.mock('./shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
import AdminSocialPosts from './components/AdminSocialPosts';

const SRC = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(resolve(SRC, p), 'utf8').replace(/\r\n/g, '\n');
afterEach(cleanup);

describe('the converters: a money result always has two digits after the point', () => {
  it('formatToolNumber keeps its plain form and pads money to two digits', () => {
    expect(formatToolNumber(55479.6, 'en-US', 2, 2)).toBe('55,479.60');
    expect(formatToolNumber(61000, 'en-US', 2, 2)).toBe('61,000.00');
    expect(formatToolNumber(1234.5, 'he-IL', 2, 2)).toBe('1,234.50');
    expect(formatToolNumber(55479.6, 'en-US', 2)).toBe('55,479.6'); // the default (unit converter) is unchanged
    expect(formatToolNumber(2.5, 'en-US')).toBe('2.5');
  });
  it('every money helper of both tools pages passes two minimum digits', () => {
    expect(src('components/PublicToolsEn.jsx')).toContain("const num = (n, digits = 2) => formatToolNumber(n, 'en-US', digits, 2);");
    const he = src('components/PublicTools.jsx');
    expect(he).toContain("const money = (n, digits = 2) => formatToolNumber(n, 'he-IL', digits, 2);");
    expect(he).toContain("`$${formatToolNumber(metalUsd, 'en-US', 2, 2)}`");
    expect(he).toContain("`$${formatToolNumber(cryptoUsd, 'en-US', 2, 2)}`");
  });
});

describe('the post hashtags keep the # on the right side', () => {
  it('a Hebrew post: every hashtag (in the text and in the tags line) is its own direction box; the text does not change', async () => {
    const post = { id: 'h1', action_type: 'social_post', kind: 'system', source: 'social', status: 'proposed', created_at: '2026-11-22T05:02:32Z', decided_at: null, done_at: null,
      title_he: 'פוסט', title_en: 'Post', payload: { channel: 'tt_il', network: 'tiktok', market: 'il', accountOpen: true, art: 'quote', text: 'צריכים הצעת מחיר? #הצעת_מחיר #TEKANGO', hashtags: ['#בעלי_עסקים', '#TEKANGO'], link: 'https://www.tekango.com/he' } };
    invoke.mockResolvedValue({ data: { ok: true, canPublish: true, profile: { agent: 'social', name_he: 'שירה', name_en: 'Shira' }, posts: [post] }, error: null });
    render(<AdminSocialPosts isHebrew />);
    const text = await screen.findByTestId('social-post-text-h1');
    const boxes = [...text.querySelectorAll('bdi[dir="auto"]')].map((b) => b.textContent);
    expect(boxes).toEqual(['#הצעת_מחיר', '#TEKANGO', '#בעלי_עסקים', '#TEKANGO']);
    expect(screen.getByTestId('social-post-tags-h1').textContent).toBe('#בעלי_עסקים #TEKANGO');
    expect(text.textContent.startsWith('צריכים הצעת מחיר? #הצעת_מחיר #TEKANGO')).toBe(true);
  });
});

describe('three dots with the shared bubble (Owner rule 2026-11-19)', () => {
  it('the e-mail in the admin users list (L-21)', () => {
    const s = src('components/AdminUsersView.jsx');
    expect(s).toContain('<EllipsisText as="span" plain className="av-mail" text={a.email || \'\'} />');
    expect(s).not.toContain('<span className="av-mail" title={a.email}>{a.email}</span>');
  });
  it('the calendar chip (L-30): the bubble text is the chip text itself', () => {
    const s = src('components/CalendarTab.jsx');
    expect(s).toContain('<EllipsisText plain className="pf-cal-ev-text" text={chipText(e)}>');
    expect(s).toContain('.pf-cal-ev-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
  });
});

describe('the three existing language differences (Owner 2026-11-24: "מאשר לתקן בשחרור הזה גם את שלושת ההבדלים הקיימים")', () => {
  it('the chat card badge sits at the END corner by the page direction, its inner corner rounded', () => {
    const s = src('pages/Contact.jsx');
    expect(s).toContain("position: 'absolute', top: 0, insetInlineEnd: 0, background: '#24694c'");
    expect(s).toContain("borderEndStartRadius: '16px'");
    expect(s).not.toContain("borderBottomLeftRadius: isHebrew ? '0' : '16px'");
  });
  it('"ה-AI" never splits across two lines (non-breaking hyphen)', () => {
    const s = src('pages/Contact.jsx');
    expect(s).toContain('בעזרת עוזר ה‑AI שלנו.');
    expect(s).not.toContain('בעזרת עוזר ה-AI שלנו.');
  });
  it('the sidebar e-mail is left-to-right in both languages (shows its start, dots at the end), right-aligned in Hebrew - outside Dashboard.jsx', () => {
    const css = src('index.css');
    expect(css).toContain('.dash-app-shell .dash-sidebar-user-name { direction: ltr; }');
    expect(css).toContain('.dash-app-shell[dir="rtl"] .dash-sidebar-user-name { text-align: right; }');
  });
});

describe('the contact page in the new light colours (Owner 2026-11-24: "למה זה לא בצבעים החדשים שלנו?" -> "א")', () => {
  it('light page and white cards, navy headings / links / chat button, the system green, the dark-text logo; no dark-theme colour left', () => {
    const s = src('pages/Contact.jsx');
    expect(s).toContain("background: '#f7f8f6', minHeight: '100vh', color: '#172129'");
    expect(s).toContain('background: #ffffff;\n          border: 1px solid #d6dee1;');
    expect(s).toContain('          background: #102444;');
    expect(s).toContain('<ProFlowLogo size={32} darkText />');
    for (const old of ['#090d16', '#1f2937', '#8b5cf6', '#6366f1', '#3b82f6', '#94a3b8', '#10b981']) expect(s, old).not.toContain(old);
  });
});

describe('the contact page robot is the TEKANGO robot', () => {
  it('white on the sidebar navy, like the chat launcher; the old purple robot is gone', () => {
    const s = src('pages/Contact.jsx');
    expect(s).toContain('<TekangoBotIcon size={34} plain ink="#FFFFFF" face="#102444" />');
    expect(s).not.toContain('stroke="#8b5cf6"');
    expect(s).not.toContain("rgba(139, 92, 246, 0.15)");
  });
});
