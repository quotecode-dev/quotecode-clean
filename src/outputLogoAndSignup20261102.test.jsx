// Owner console 2026-11-01 (typed: "מאשר שינוי ב-L-01: ייבוא לוגו ישן גם בהדפסה ובהורדת PDF מעמוד ההצעה, בעברית ובאנגלית, שחרור עד הלייב";
// "מאשר שינוי ב-L-12: אירוע נרשם אחד לגוגל בלי פרטים מזהים ועדכון סעיף 4 במדיניות הפרטיות, שחרור עד הלייב").
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { importOwnerLogo } from './utils/logoImport';
import { reportSignup, GA_MEASUREMENT_ID } from './shared/siteAnalytics';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const client = (logo, { session = true, readError = null } = {}) => ({
  auth: { getSession: async () => ({ data: { session: session ? { user: { id: 'owner-1' } } : null } }) },
  from: vi.fn(() => ({ select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: id === 'owner-1' && logo ? { logo_url: logo } : null, error: readError }) }) }) })),
});

describe('L-01: the quote page imports an old logo before a print or PDF', () => {
  it.each([['src/pages/PublicQuote.jsx'], ['src/pages/PublicQuoteEn.jsx']])('%s passes the import to the authorization', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/authorizeWithNotice\(\{ channel: finalChannel,[^\n]*importLogo: \(\) => importOwnerLogo\(/);
  });
  it('the owner\'s own stored logo goes to the same server import', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
    expect(await importOwnerLogo({ client: client(`data:image/png;base64,${PNG}`), invoke })).toBe(true);
    expect(invoke).toHaveBeenCalledWith('subscription-authority', { body: { action: 'import_logo', dataBase64: PNG } });
  });
  it.each([
    ['no session', () => client(`data:image/png;base64,${PNG}`, { session: false })],
    ['no logo', () => client('')],
    ['a read error', () => client(`data:image/png;base64,${PNG}`, { readError: { message: 'x' } })],
    ['an unreadable logo', () => client('data:image/png,notbase64')],
  ])('%s: nothing is imported and the refusal stays', async (_n, make) => {
    const invoke = vi.fn();
    expect(await importOwnerLogo({ client: make(), invoke })).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
  it('a refused import keeps the refusal', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: false, code: 'invalid_asset' }, error: null }));
    expect(await importOwnerLogo({ client: client(`data:image/png;base64,${PNG}`), invoke })).toBe(false);
  });
});

const sid = `_ga_${GA_MEASUREMENT_ID.slice(2)}`;
const COOKIE = `proflow_lang=he; _ga=GA1.1.111.222; ${sid}=GS2.1.s1793567387$o54$g1`;
const env = ({ host = 'www.tekango.com', cookie = COOKIE, beacon = vi.fn(() => true) } = {}) => ({
  beacon,
  win: { location: { hostname: host, origin: `https://${host}`, pathname: '/dashboard' }, navigator: { sendBeacon: beacon } },
  doc: { cookie },
});

describe('L-12: one sign-up event without identifying details', () => {
  it('sends the event once, with the measurement ids only and a public page as its address', () => {
    const e = env();
    expect(reportSignup({ isHebrew: true, win: e.win, doc: e.doc, consent: null })).toBe(true);
    expect(e.beacon).toHaveBeenCalledTimes(1);
    const u = new URL(e.beacon.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe('https://www.google-analytics.com/g/collect');
    expect(Object.fromEntries(u.searchParams)).toEqual({ v: '2', tid: GA_MEASUREMENT_ID, cid: '111.222', en: 'sign_up', dl: 'https://www.tekango.com/he', sid: '1793567387' });
  });
  it('the English site needs the visitor\'s acceptance', () => {
    const e = env();
    expect(reportSignup({ isHebrew: false, win: e.win, doc: e.doc, consent: null })).toBe(false);
    expect(e.beacon).not.toHaveBeenCalled();
    expect(reportSignup({ isHebrew: false, win: e.win, doc: e.doc, consent: 'granted' })).toBe(true);
    expect(new URL(e.beacon.mock.calls[0][0]).searchParams.get('dl')).toBe('https://www.tekango.com/en');
  });
  it.each([
    ['a declined choice', { consent: 'denied' }, {}],
    ['a visitor never measured (no _ga cookie)', { consent: null }, { cookie: 'proflow_lang=he' }],
    ['another host', { consent: null }, { host: 'localhost' }],
  ])('%s: nothing is sent', (_n, args, over) => {
    const e = env(over);
    expect(reportSignup({ isHebrew: true, win: e.win, doc: e.doc, ...args })).toBe(false);
    expect(e.beacon).not.toHaveBeenCalled();
  });
  it('the app sends it only for a new account, and no third-party script enters the app', () => {
    const dash = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(dash).toContain('if (data?.user && !(data.user.identities && data.user.identities.length === 0)) reportSignup({ isHebrew: bundleIsHebrew });');
    expect(dash).not.toMatch(/googletagmanager/);
  });
  it('the Privacy Policy says so in both languages and still has no advertising cookies', () => {
    const p = readFileSync('src/pages/Privacy.jsx', 'utf8');
    expect(p).toContain('אירוע אחד, ״נרשם״, בלי שם, בלי מייל ובלי פרט מזהה אחר');
    expect(p).toContain('one “signed up” event is sent to Google Analytics, with no name, no email and no other identifying detail');
    expect(p).toContain('איננו משתמשים בעוגיות פרסום');
    expect(p).toContain('We do not use advertising cookies');
  });
});
