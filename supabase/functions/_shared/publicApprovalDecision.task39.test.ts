// Night task 2026-10-16: the Task 39 suite (e50171dc) restored; the SQL checks now read the approval body where 20261007150600 moved it.
// IRON-SIGN-001 / IRON-QUOTE-006 / IRON-PUBLIC-001 / IRON-DATE-001 - the public approval DECISION as one coherent contract
// across its real layers in this candidate: the customer approval flow of PublicQuote (HE/Local) and PublicQuoteEn
// (EN/International), the canonical SQL predicate public.public_approve_quote (migration 20260922000000, the only
// authority), the shared OD-1 expiry zones and the get-public-quote owner flag. There is no separate decision module:
// the RPC decides, the pages gate and explain. The RPC transport and the browser canvas are isolated (hermetic); the
// pages, the signature hook, the error classifier and the SQL text are the real sources. Not a proof of the hosted DB.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import PublicQuote from '../../../src/pages/PublicQuote';
import PublicQuoteEn from '../../../src/pages/PublicQuoteEn';
import { supabase } from '../../../src/shared/supabase';
import { classifyQuoteApprovalError } from '../../../src/utils/quoteApprovalErrorClassification.js';
import { VALIDITY_TIME_ZONE } from '../../../src/utils/quoteValidity.js';

vi.mock('../../../src/shared/supabase', () => ({ supabase: { rpc: vi.fn() } }));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==';
const QID = 'a29b1fbb-f2ca-427d-88b2-6198d138eb89';
const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

const data = (over: { quote?: Record<string, unknown>; client?: Record<string, unknown> } = {}) => ({
  quote: { id: QID, quote_number: 100701, status: 'sent', signature: null, tax_rate: 0.18, client_type: 'business', is_owner_viewing: false,
    subtotal: 1000, total: 1180, created_at: '2026-10-01T09:00:00Z', ...over.quote },
  business: { business_name: 'Issuer Co' },
  client: { company_name: 'Client Ltd', ...over.client },
  items: [{ id: 'i1', description: 'Synthetic item', quantity: 1, unit_price: 1000, total_price: 1000 }],
  attachments: [],
});
const HE = { Page: PublicQuote, activate: 'לחץ/י כאן לחתימה', approve: /אשר וחתום על הצעת המחיר/, name: 'לדוגמה: ישראל ישראלי', clear: 'נקה חתימה',
  nameAlert: 'נא להזין שם מלא לפני האישור', signAlert: 'נא לחתום על גבי המסמך לפני האישור', signHeading: 'חתימת לקוח לאישור ההצעה:', signedBy: 'נחתם על ידי:', isHebrew: true };
const EN = { Page: PublicQuoteEn, activate: 'Tap to sign', approve: /Approve & Sign This Quote/, name: 'e.g. John Smith', clear: 'Clear Signature',
  nameAlert: "Please enter the signer's full name before approving", signAlert: 'Please sign the quote before approval', signHeading: 'Client Signature to Approve This Quote:', signedBy: 'Signed by:', isHebrew: false };
type Lang = typeof HE;

const mount = (L: Lang, d = data()) => render(createElement(MemoryRouter, null, createElement(L.Page as any, { quoteData: d })));
const sign = (container: HTMLElement, L: Lang) => {
  fireEvent.click(screen.getByText(L.activate));
  const canvas = container.querySelector('canvas')!;
  fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.mouseMove(canvas, { clientX: 40, clientY: 25 });
  fireEvent.mouseUp(canvas);
};
const typeName = (L: Lang, v: string) => fireEvent.change(screen.getByPlaceholderText(L.name), { target: { value: v } });
const clickApprove = (L: Lang) => fireEvent.click(screen.getByText(L.approve));
const safeMessage = (raw: string, isHebrew: boolean) => classifyQuoteApprovalError(raw, isHebrew).userMessage;

// the canonical SQL authority: the LAST definition of public_approve_quote in migration order
const MIGRATIONS = join(cwd(), 'supabase', 'migrations');
const migrationFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
// Night task 2026-10-16 (restored Task 39 suite): since 20261007150600 the approval statements live in
// public.quote_public_approve_internal (public_approve_quote is a thin wrapper with the same signature / ACL that calls it with
// p_visible = true) - the canonical body is the LATEST definition of the internal function.
const INTERNAL = 'CREATE OR REPLACE FUNCTION public.quote_public_approve_internal(';
const definers = migrationFiles.filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes(INTERNAL));
const canonicalFile = definers[definers.length - 1];
const canonicalSql = readFileSync(join(MIGRATIONS, canonicalFile), 'utf8');
const fnStart = canonicalSql.lastIndexOf(INTERNAL);
const fnBody = canonicalSql.slice(fnStart, canonicalSql.indexOf('$function$;', fnStart) + 11);
// the public wrapper (same signature + ACL as before) and the helper definitions (is_issuer_tenant_member, quote_acceptance_expired)
const WRAPPER = 'CREATE OR REPLACE FUNCTION public.public_approve_quote(';
const wrapperFile = migrationFiles.filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes(WRAPPER)).pop();
const wrapperSql = readFileSync(join(MIGRATIONS, wrapperFile), 'utf8');
const wrapperBody = wrapperSql.slice(wrapperSql.lastIndexOf(WRAPPER), wrapperSql.indexOf('$function$;', wrapperSql.lastIndexOf(WRAPPER)) + 11);
const allSql = migrationFiles.map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
const SQL_PNG_RE = /\^data:image\/png;base64,\[A-Za-z0-9\+\/\]\+=\{0,2\}\$/;

let ctxCalls: string[];
beforeEach(() => {
  ctxCalls = [];
  const ctx = new Proxy({}, { get: (_t, k) => (typeof k === 'string' && ['beginPath', 'moveTo', 'lineTo', 'stroke', 'clearRect'].includes(k) ? () => ctxCalls.push(k) : undefined), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => PNG);
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe.each([['HE / Local', HE], ['EN / International', EN]])('customer approval flow - %s', (_label, L) => {
  it('nothing typed and nothing drawn: both required-field alerts, and the server is never asked', () => {
    mount(L);
    clickApprove(L);
    expect(screen.getByText(L.nameAlert)).toBeInTheDocument();
    expect(screen.getByText(L.signAlert)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('a name without a drawn signature: only the signature alert, no request', () => {
    mount(L);
    typeName(L, 'Dana Levi');
    clickApprove(L);
    expect(screen.queryByText(L.nameAlert)).toBeNull();
    expect(screen.getByText(L.signAlert)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('a valid approval sends exactly the two RPC parameters - the signer name / company / role never leave the browser', async () => {
    const { container } = mount(L);
    typeName(L, 'Dana Levi');
    sign(container, L);
    clickApprove(L);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith('public_approve_quote', { p_quote_id: QID, p_signature_data_url: PNG });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/Dana|Client Ltd/);
  });
  it('success shows the signed record (signer + the exact signature that was sent) and removes the signing controls', async () => {
    const { container } = mount(L);
    typeName(L, 'Dana Levi');
    sign(container, L);
    clickApprove(L);
    await waitFor(() => expect(screen.getByText(new RegExp(`${L.signedBy}\\s*Dana Levi`))).toBeInTheDocument());
    expect(screen.getByAltText('Client Signature')).toHaveAttribute('src', PNG);
    expect(screen.queryByText(L.signHeading)).toBeNull();
    expect(screen.queryByText(L.approve)).toBeNull();
  });
  it('the issuer-tenant rejection is shown as the safe classified message, never the raw SQL text, and the quote stays unsigned', async () => {
    const raw = "Not permitted: a member of the business that issued this quote cannot approve or sign it on the customer's behalf";
    rpc.mockResolvedValue({ error: { message: raw, code: '42501' } });
    const { container } = mount(L);
    typeName(L, 'Dana Levi'); sign(container, L); clickApprove(L);
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(safeMessage(raw, L.isHebrew));
    expect(document.body.textContent).not.toContain('42501');
    expect(document.body.textContent).not.toContain('on the customer\'s behalf');
    expect(screen.getByText(L.signHeading)).toBeInTheDocument();
  });
  it('a quote that expired between page load and submit is refused by the server and explained as expired (not approved)', async () => {
    const raw = 'Quote expired: the validity date has passed, so it can no longer be approved or signed';
    rpc.mockResolvedValue({ error: { message: raw, code: '22023' } });
    const { container } = mount(L);
    typeName(L, 'Dana Levi'); sign(container, L); clickApprove(L);
    expect(await screen.findByRole('status')).toHaveTextContent(safeMessage(raw, L.isHebrew));
    expect(safeMessage(raw, L.isHebrew)).not.toBe(safeMessage('', L.isHebrew));
    expect(screen.queryByText(new RegExp(L.signedBy))).toBeNull();
  });
  it('a quote already signed elsewhere (no row updated) is explained as unavailable, not as a generic failure', async () => {
    const raw = 'Quote not found or cannot be approved';
    rpc.mockResolvedValue({ error: { message: raw } });
    const { container } = mount(L);
    typeName(L, 'Dana Levi'); sign(container, L); clickApprove(L);
    expect(await screen.findByRole('status')).toHaveTextContent(safeMessage(raw, L.isHebrew));
    expect(classifyQuoteApprovalError(raw, L.isHebrew).category).not.toBe(classifyQuoteApprovalError('', L.isHebrew).category);
  });
  it('a failed approval is recoverable: retrying after a network error calls the server again and can succeed', async () => {
    rpc.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({ error: null });
    const { container } = mount(L);
    typeName(L, 'Dana Levi'); sign(container, L); clickApprove(L);
    expect(await screen.findByRole('status')).toHaveTextContent(safeMessage('Failed to fetch', L.isHebrew));
    clickApprove(L);
    await waitFor(() => expect(screen.getByText(new RegExp(L.signedBy))).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe('approval flow details (HE / Local)', () => {
  it('a whitespace-only name is not a signer name', () => {
    const { container } = mount(HE);
    typeName(HE, '   ');
    sign(container, HE);
    clickApprove(HE);
    expect(screen.getByText(HE.nameAlert)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('the canvas is inert until the signer explicitly activates it (a scroll swipe is never a signature)', () => {
    const { container } = mount(HE);
    typeName(HE, 'Dana Levi');
    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 25 });
    clickApprove(HE);
    expect(screen.getByText(HE.signAlert)).toBeInTheDocument();
    expect(ctxCalls).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('clearing the drawn signature withdraws it: approving again requires a new signature', () => {
    const { container } = mount(HE);
    typeName(HE, 'Dana Levi');
    sign(container, HE);
    fireEvent.click(screen.getByText(HE.clear));
    clickApprove(HE);
    expect(screen.getByText(HE.signAlert)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('the alerts clear themselves as soon as the missing name is typed and the signature is drawn', () => {
    const { container } = mount(HE);
    clickApprove(HE);
    typeName(HE, 'Dana Levi');
    expect(screen.queryByText(HE.nameAlert)).toBeNull();
    sign(container, HE);
    expect(screen.queryByText(HE.signAlert)).toBeNull();
  });
  it('the recipient name the business entered is only a pre-filled suggestion: the signer\'s edit is what the record shows', async () => {
    const { container } = mount(HE, data({ quote: { attn_name: 'Dana', attn_role: 'Buyer' } }));
    expect(screen.getByPlaceholderText(HE.name)).toHaveValue('Dana');
    typeName(HE, 'Yossi Cohen');
    sign(container, HE); clickApprove(HE);
    await waitFor(() => expect(screen.getByText(/נחתם על ידי:\s*Yossi Cohen/)).toBeInTheDocument());
    expect(screen.queryByText(/נחתם על ידי:\s*Dana\b/)).toBeNull();
  });
  it('company / role fields are offered only to a business recipient; a private recipient signs with a name only', () => {
    mount(HE, data({ quote: { client_type: 'business' } }));
    expect(screen.getByPlaceholderText('לדוגמה: חברה בע״מ')).toBeInTheDocument();
    cleanup();
    mount(HE, data({ quote: { client_type: 'private' } }));
    expect(screen.queryByPlaceholderText('לדוגמה: חברה בע״מ')).toBeNull();
    expect(screen.queryByPlaceholderText('לדוגמה: מנכ״ל')).toBeNull();
    expect(screen.getByPlaceholderText(HE.name)).toBeInTheDocument();
  });
  it('a stored signature counts as signed even if the status was not updated: never offers a second signature (the RPC requires an unsigned row)', () => {
    mount(HE, data({ quote: { status: 'sent', signature: PNG } }));
    expect(screen.queryByText(HE.signHeading)).toBeNull();
    expect(screen.getByAltText('Client Signature')).toHaveAttribute('src', PNG);
  });
});

describe('the signed record and the acceptance window follow the account market (HE Local vs EN International)', () => {
  it('the just-signed timestamp is written in the market date order: HE DD/MM/YYYY, EN MM/DD/YYYY', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    for (const L of [HE, EN]) {
      const { container } = mount(L);
      typeName(L, 'Dana Levi'); sign(container, L); clickApprove(L);
      await waitFor(() => expect(screen.getByText(new RegExp(L.signedBy))).toBeInTheDocument());
      expect(document.body.textContent).toContain(L === HE ? '13/10/2026' : '10/13/2026');
      expect(document.body.textContent).not.toContain(L === HE ? '10/13/2026' : '13/10/2026');
      cleanup();
    }
  });
  it('without server truth, the HE page closes signing at the end of valid_until in Asia/Jerusalem', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T20:30:00Z')); // 23:30 in Jerusalem on the 13th
    mount(HE, data({ quote: { valid_until: '2026-10-13' } }));
    expect(screen.getByText(HE.signHeading)).toBeInTheDocument();
    cleanup();
    vi.setSystemTime(new Date('2026-10-13T21:30:00Z')); // 00:30 on the 14th in Jerusalem
    mount(HE, data({ quote: { valid_until: '2026-10-13' } }));
    expect(screen.queryByText(HE.signHeading)).toBeNull();
  });
  it('the EN page keeps the same quote signable at that instant (Anywhere-on-Earth), closing only at 12:00 UTC next day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T21:30:00Z'));
    mount(EN, data({ quote: { valid_until: '2026-10-13' } }));
    expect(screen.getByText(EN.signHeading)).toBeInTheDocument();
    cleanup();
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
    mount(EN, data({ quote: { valid_until: '2026-10-13' } }));
    expect(screen.queryByText(EN.signHeading)).toBeNull();
  });
});

describe('the canonical SQL predicate (public.public_approve_quote) is the single authority the pages agree with', () => {
  // night task 2026-10-16: the approval statements moved verbatim (+ p_visible) into quote_public_approve_internal (20261007150600)
  it('the canonical approval body is the latest quote_public_approve_internal; public_approve_quote is its same-signature wrapper', () => {
    expect(canonicalFile >= '20261007150600').toBe(true);
    expect(fnBody).toMatch(/RETURNS void/);
    expect(wrapperBody).toMatch(/RETURNS void/);
    expect(wrapperBody).toMatch(/quote_public_approve_internal\(p_quote_id, p_signature_data_url, (true|p_visible|v_visible)/);
  });
  it('decision order: issuer-tenant refusal, then expiry, then signature presence / size / format, and only then the update', () => {
    const at = (re: RegExp) => { const i = fnBody.search(re); expect(i, String(re)).toBeGreaterThan(-1); return i; };
    const order = [/is_issuer_tenant_member\(v_owner\)/, /quote_acceptance_expired\(v_valid_until, v_country\)/, /'Missing signature'/,
      /'Signature payload too large'/, /'Invalid signature format'/, /UPDATE public\.quotes/].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it('only an unsigned draft / sent quote can become approved; any other state raises instead of silently doing nothing', () => {
    expect(fnBody).toMatch(/LOWER\(COALESCE\(status, ''\)\) IN \('draft', 'sent'\)/);
    expect(fnBody).toMatch(/AND \(signature IS NULL OR signature = ''\)/);
    expect(fnBody).toMatch(/IF affected_rows = 0 THEN\s+RAISE EXCEPTION 'Quote not found or cannot be approved'/);
  });
  it('runs as SECURITY DEFINER with a pinned search_path; executable by anon + authenticated only (revoked from PUBLIC and service_role)', () => {
    // CREATE OR REPLACE keeps the grants of the earlier definition (the ACL lines live in the file that set them)
    expect(wrapperBody).toMatch(/SECURITY DEFINER\s+SET search_path TO 'public', 'pg_temp'/);
    expect(fnBody).toMatch(/SET search_path TO 'public', 'pg_temp'/);
    expect(allSql).toMatch(/REVOKE ALL ON FUNCTION public\.public_approve_quote\(uuid, text\) FROM PUBLIC;/);
    expect(allSql).toMatch(/REVOKE ALL ON FUNCTION public\.public_approve_quote\(uuid, text\) FROM service_role;/);
    expect(allSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.public_approve_quote\(uuid, text\) TO anon, authenticated;/);
  });
  it('the PNG the pages send satisfies the SQL signature format predicate and the base64 length rule', () => {
    expect(fnBody).toMatch(SQL_PNG_RE);
    expect(PNG).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
    expect((PNG.length - 22) % 4).toBe(0);
    expect(PNG.length).toBeLessThanOrEqual(500000);
    for (const page of ['PublicQuote.jsx', 'PublicQuoteEn.jsx']) {
      expect(readFileSync(join(cwd(), 'src', 'pages', page), 'utf8')).toMatch(/getSignatureDataUrl\(\)/);
    }
    expect(readFileSync(join(cwd(), 'src', 'shared', 'useSignaturePad.js'), 'utf8')).toMatch(/toDataURL\('image\/png'\)/);
  });
  it('both pages call the RPC with exactly the SQL parameter names - nothing the function would ignore or reject', () => {
    const params = wrapperBody.match(/public_approve_quote\(p_quote_id uuid, p_signature_data_url text\)/);
    expect(params).not.toBeNull();
    for (const page of ['PublicQuote.jsx', 'PublicQuoteEn.jsx']) {
      const src = readFileSync(join(cwd(), 'src', 'pages', page), 'utf8');
      const call = src.slice(src.indexOf("supabase.rpc('public_approve_quote'"), src.indexOf('});', src.indexOf("supabase.rpc('public_approve_quote'")));
      expect(call.match(/\bp_[a-z_]+(?=:)/g), page).toEqual(['p_quote_id', 'p_signature_data_url']);
    }
  });
  it('every customer-reachable SQL rejection has a specific (non-generic) explanation in both languages', () => {
    const raised = [...fnBody.matchAll(/RAISE EXCEPTION '((?:[^']|'')+)'/g)].map((m) => m[1].replace(/''/g, "'"));
    expect(raised.length).toBeGreaterThanOrEqual(7);
    const reachable = raised.filter((m) => m !== 'Missing quote id'); // the page always sends its own loaded quote id
    for (const isHebrew of [true, false]) {
      const generic = classifyQuoteApprovalError('', isHebrew).category;
      for (const m of reachable) expect(classifyQuoteApprovalError(m, isHebrew).category, m).not.toBe(generic);
    }
  });
  it('the issuer-tenant rule and the get-public-quote owner flag are the same predicate (caller id == quote owner)', () => {
    expect(allSql).toMatch(/SELECT auth\.uid\(\) IS NOT NULL AND p_quote_owner IS NOT NULL AND auth\.uid\(\) = p_quote_owner/);
    const handler = readFileSync(join(cwd(), 'supabase', 'functions', 'get-public-quote', 'index.ts'), 'utf8');
    expect(handler).toMatch(/const isOwner = Boolean\(callerUserId && callerUserId === quote\.user_id\);/);
  });
  it('the expiry zones are identical in SQL, the page rule and the get-public-quote copy (Local/LCL Jerusalem, else UTC-12)', () => {
    expect(allSql).toMatch(/CASE WHEN p_country IN \('Local', 'LCL'\) THEN 'Asia\/Jerusalem' ELSE 'Etc\/GMT\+12' END/);
    expect(VALIDITY_TIME_ZONE).toEqual({ Local: 'Asia/Jerusalem', International: 'Etc/GMT+12' });
    const serverCopy = readFileSync(join(cwd(), 'supabase', 'functions', 'get-public-quote', 'validity.ts'), 'utf8');
    // Codex LANG-02 (2026-10-18): the server copy and SQL 20261018000000 add the 'Israel' / 'IL' aliases of the one market rule
    expect(serverCopy).toMatch(/v === 'Local' \|\| v === 'LCL' \|\| v\.toLowerCase\(\) === 'israel' \|\| v\.toLowerCase\(\) === 'il'/);
    expect(serverCopy).toMatch(/isLocalValidityCountry\(country\) \? 'Asia\/Jerusalem' : 'Etc\/GMT\+12'/);
    expect(allSql).toMatch(/WHEN btrim\(p_country\) IN \('Local', 'LCL'\) OR lower\(btrim\(p_country\)\) IN \('israel', 'il'\) THEN 'Asia\/Jerusalem'/);
  });
  it('no client code calls a retired approval RPC (dropped by 20260929000000): public_approve_quote is the only approval path', () => {
    const dropSql = readFileSync(join(MIGRATIONS, '20260929000000_drop_legacy_approve_quote_public.sql'), 'utf8');
    expect(dropSql).toMatch(/approve_quote_public/);
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : /\.(jsx?|tsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : []);
    const rpcNames = walk(join(cwd(), 'src')).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\.rpc\('([a-z_]*approve[a-z_]*)'/g)].map((m) => m[1]));
    // + the capability-link approval added with the output authority (20261007150600), same rules through the same internal body
    expect(new Set(rpcNames)).toEqual(new Set(['public_approve_quote', 'public_approve_quote_capability']));
  });
});
