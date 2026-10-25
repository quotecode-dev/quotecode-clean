import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Admin summary RPC + audit log RPC are faked here: no network, no real client.
const rpcState = vi.hoisted(() => ({ summary: () => ({ data: null, error: { code: 'PGRST202', message: 'not found' }, status: 404 }), calls: [] }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn, args) => {
      rpcState.calls.push([fn, args]);
      if (fn === 'get_admin_audit_log') return { data: [], error: null };
      if (fn === 'get_account_summary_for_admin') return rpcState.summary(args.p_user_id);
      return { data: null, error: { code: 'PGRST202' }, status: 404 };
    }),
    from: () => ({ select: () => ({ eq: async () => ({ count: 0, error: null }) }) }),
  },
}));

import AdminOverview from './AdminOverview';
import AdminUsersView from './AdminUsersView';
import AdminPlans from './AdminPlans';
import AdminUserDetails from './AdminUserDetails';
import AdminSystemActivity from './AdminSystemActivity';
import { AdminMarketIcon } from './AdminIdentityIcons';
import { AuthenticatedSidebarFrame } from './AuthenticatedShellFrames';
import { resolveAdminMarket } from '../utils/adminMarket';
import { fetchAdminAccountSummary, legacyOperationsRetired, planStateText } from '../domain/subscriptions/adminAccountSummary';

const ready = (overrides = {}) => ({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'off', catalog: 'off', billing: 'off' }, market: 'IL',
  plan: { id: 'classic' }, subscriptionStatus: 'active', capabilities: ['quote_style.classic'], eligiblePlans: {}, free10: null,
  catalog: { active: 3, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: true }, priceCatalogVersion: null, ...overrides,
});
const freeReady = (remaining = 7) => ready({ plan: { id: 'free' }, subscriptionStatus: 'none', free10: { limit: 10, consumed: 10 - remaining, reserved: 0, remaining }, catalog: { active: 1, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false } });

// Legacy marketing identities that must never be shown as an active Admin label (OD-16).
const LEGACY_LABELS = /\b(Basic|BASIC|Pro|PRO|FREE|FREE_TRIAL|LIFETIME|Lifetime)\b|On trial|Trial expired|Active trial|בניסיון|ניסיון פג|ניסיון פעיל|14[- ]?(day|days|יום)|unlimited|ללא הגבלה|5-20/;
// Visible text outside the legacy audit <code> values.
// Owner console 2026-10-16, typed: "מאשר שינוי ב-L-07 להחלפת הקודים בסטטוס מנוי עם אייקונים" - ONE subscription status (icon + words)
// replaces the raw legacy codes; its own words (מנוי לכל החיים / Lifetime subscription) are allowed only inside the status element.
const visibleTextOutsideStatus = (root) => {
  const clone = root.cloneNode(true);
  // + the admin redesign (Owner 2026-10-16): the status words in the chart legends, the status cards and the status filter options
  clone.querySelectorAll('code, .admin-account-status, [data-segment], [data-status], select option, .av-datatable, svg desc, svg title').forEach((c) => c.remove());
  return clone.textContent;
};

beforeEach(() => {
  rpcState.calls.length = 0;
  rpcState.summary = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 });
});
afterEach(cleanup);

describe('Owner locked Admin presentation', () => {
  const accounts = [{ id:'local', business_name:'Local test', email:'local@example.test', country:'Local', plan:'free', trial_ends_at:'2026-09-02T10:00:00+00:00', is_lifetime:false }, { id:'intl', business_name:'Intl test', email:'intl@example.test', country:'International', plan:'basic', trial_ends_at:null, is_lifetime:true }];
  // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - spec §4.2: 7 columns (the Role column removed, an Admin tag beside an admin account), the
  // user's own medallion + the status words in Plan, extra facts only in Indicators, the region an icon with its name, dates by the
  // account's market; the plan state from the server only (one global "not active" probe); no legacy identity, no raw code.
  for (const isHebrew of [true,false]) it('directory: 7 columns, status medallion + words, region icon, server-only plan, one probe '+isHebrew, async () => {
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={isHebrew} onDetails={vi.fn()} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent.replace(/[↑↓]/g, '').trim())).toEqual(isHebrew
      ? ['עסק', 'מסלול', 'מדדים', 'הרשמה', 'כניסה אחרונה', 'אזור', 'פעולות']
      : ['Business', 'Plan', 'Indicators', 'Registered', 'Last sign-in', 'Region', 'Actions']);
    expect(within(table).queryByText(/^(תפקיד|הרשאה|Role)$/)).toBeNull();
    await screen.findByText(isHebrew ? 'מערך המסלולים החדש: טרם הופעל' : 'New plan system: not active yet');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('[data-status]').getAttribute('data-status'))).toEqual(['trial_ended', 'lifetime']);
    expect(rows[0].querySelector('td:nth-child(2) .pmm svg')).toBeTruthy();
    expect(rows[0].querySelector('td:nth-child(2) strong').textContent).toBe(isHebrew ? 'פג תוקף' : 'Expired');
    expect(rows[1].querySelector('td:nth-child(2) strong').textContent).toBe(isHebrew ? 'מנוי לכל החיים' : 'Lifetime subscription');
    expect(rows[0].querySelector('td:nth-child(3)').textContent).toBe(isHebrew ? 'ניסיון ותיק' : 'Legacy trial');
    // review 2026-10-16: the visible dash + a screen-reader text (an aria-label on a plain span is not announced reliably)
    expect(rows[1].querySelector('td:nth-child(3) [aria-hidden="true"]').textContent).toBe('—');
    expect(rows[1].querySelector('td:nth-child(3) .av-sr-only').textContent).toMatch(/אין חיוויים|No indicators/);
    for (const r of rows) expect(within(r.querySelector('td:nth-child(6)')).getByRole('img').getAttribute('aria-label')).toBeTruthy();
    expect(rows[0].querySelector('td:nth-child(6) svg')).toBeTruthy();
    expect(rows[1].querySelector('td:nth-child(6) .lucide-globe')).toBeTruthy();
    expect(table.querySelector('code')).toBeNull();
    expect(document.body.textContent).not.toMatch(/plan=|is_lifetime=|trial_ends_at/);
    expect(visibleTextOutsideStatus(document.body)).not.toMatch(LEGACY_LABELS);
    // not-active is global: ONE probe call, no per-row fan-out
    expect(rpcState.calls.filter(([fn]) => fn === 'get_account_summary_for_admin')).toHaveLength(1);
    // the one status filter (the subscription status); no legacy plan / trial filter
    expect(screen.queryByRole('combobox', { name: /plan|trial|חבילה|ניסיון/i })).toBeNull();
    expect(screen.getByRole('combobox', { name: isHebrew ? 'סינון לפי מצב' : 'Filter by status' })).toBeTruthy();
  });

  // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - spec §5 (D-01 / D-06): the period from the server only; Free-10 from the server counter only.
  it('directory: a ready server summary shows the server status - annual from the period, 10 free quotes from the counter', async () => {
    const plain = [{ id: 'p1', user_id: 'u1', business_name: 'Paid one', email: 'p1@example.test', country: 'Local' }, { id: 'p2', user_id: 'u2', business_name: 'Free one', email: 'p2@example.test', country: 'International' }];
    rpcState.summary = (uid) => ({ data: uid === 'u1' ? { ...ready({ plan: { id: 'all_inclusive' } }), billingPeriod: 'year' } : { ...freeReady(7), phase: { output: 'enforced', catalog: 'off', billing: 'off' } }, error: null });
    render(<AdminUsersView accounts={plain} search="" onSearch={vi.fn()} isHebrew={false} onDetails={vi.fn()} />);
    const table = screen.getByRole('table');
    await waitFor(() => expect(table.querySelector('tbody tr:first-child [data-status]').getAttribute('data-status')).toBe('paid_annual'));
    expect(table.querySelector('tbody tr:first-child td:nth-child(2) strong').textContent).toBe('Annual subscription');
    expect(table.querySelector('tbody tr:last-child td:nth-child(2) strong').textContent).toBe('10 free quotes · 3/10 used');
    expect(screen.queryByText('New plan system: not active yet')).toBeNull();
  });
  // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - spec §4.1: recent registrations with the account-market date, the subscription mix ring chart.
  it('overview: recent registrations with the Israeli admin date (IRON-DATE-001 amendment); the subscription mix lists the main statuses', async () => {
    render(<AdminOverview accounts={[{id:'expired',business_name:'Test registration',email:'test@example.test',country:'International',plan:'free',created_at:'2026-09-01T10:00:00Z',trial_ends_at:'2026-09-02T10:00:00Z'}]} isHebrew={false} onOpenUser={vi.fn()} onGoToUsers={vi.fn()} />);
    const recent = screen.getByRole('heading', { name: 'Recent registrations' }).closest('article');
    // IRON-DATE-001 admin amendment (Owner console 2026-10-22, typed; L-22 opened): every admin date is Israeli DD/MM/YYYY, also for an
    // International account and in the English interface (what the user sees keeps the account market)
    expect(recent.textContent).toContain('01/09/2026');
    expect(recent.textContent).not.toContain('09/01/2026');
    expect(recent.textContent).not.toMatch(/trial/i);
    await screen.findByText('New plan system: not active yet');
    const mix = screen.getByRole('article', { name: 'Subscription mix' });
    expect([...mix.querySelectorAll('.av-legend [data-segment]')].map((r) => [r.getAttribute('data-segment'), r.querySelector('b').textContent])).toEqual([
      ['free10', '0'], ['trial', '0'], ['trial_ended', '1'], ['paid_monthly', '0'], ['paid_annual', '0'], ['lifetime', '0']]);
    // the approved overview sketch (Owner 2026-10-16 "נא להצמד לאפיון של קודקס"): colour dots in the ring legend
    expect(mix.querySelector('.av-legend .av-dot')).toBeTruthy();
    expect(screen.getByTestId('admin-kpi-managed').textContent).toBe('1');
    expect(document.body.querySelector('code')).toBeNull();
    expect(visibleTextOutsideStatus(document.body)).not.toMatch(LEGACY_LABELS);
    expect(screen.queryByText(/Paid plans|On trial|Needs attention|Trials ending|online now/i)).toBeNull();
  });
  it('mobile shared drawer traps focus and Escape requests closure', () => {
    const original=window.matchMedia;
    window.matchMedia=()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()});
    const originalRects=HTMLElement.prototype.getClientRects;
    HTMLElement.prototype.getClientRects=function() { return [{}]; };
    const close=vi.fn();
    const { unmount }=render(<AuthenticatedSidebarFrame drawerEnabled open onClose={close} isHebrew={false}><button>Last action</button></AuthenticatedSidebarFrame>);
    const first=screen.getByRole('button',{name:'Close menu'}); const last=screen.getByRole('button',{name:'Last action'});
    expect(document.activeElement).toBe(first);
    last.focus(); fireEvent.keyDown(document,{key:'Tab'}); expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document,{key:'Escape'}); expect(close).toHaveBeenCalledOnce();
    unmount(); window.matchMedia=original; HTMLElement.prototype.getClientRects=originalRects;
  });
  it('unknown market is not Local and does not borrow International globe approval', () => {
    expect(resolveAdminMarket({country:'Unknown'})).toEqual({market:'Unknown',countryCode:null});
    render(<AdminMarketIcon account={{country:'Unknown'}} isHebrew={false} />);
    expect(screen.getByRole('img').textContent).toBe('—'); expect(document.querySelector('svg')).toBeNull();
  });
  it('stored actual international country resolves its own flag, invalid categories remain unknown', () => {
    expect(resolveAdminMarket({country:'US'})).toEqual({market:'International',countryCode:'US'});
    expect(resolveAdminMarket({country:'ZZ'}).market).toBe('Unknown');
    expect(resolveAdminMarket({country:'United States'}).countryCode).toBe('US');
    expect(resolveAdminMarket({country:'UK'}).countryCode).toBe('GB');
    render(<AdminMarketIcon account={{country:'US'}} isHebrew={false} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('United States');
    expect(screen.getByRole('img').querySelector('img').getAttribute('src')).toBe('/flags/us.svg');
  });
  // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - spec §4.2: a visible Details button; the protected actions only through the More actions menu,
  // and only when the host wires them (no disabled placeholders, no backend-hold copy).
  it('users row: Details is visible; without wired handlers no protected action is rendered', () => {
    const onDetails=vi.fn();
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={false} onDetails={onDetails} />);
    fireEvent.click(screen.getAllByRole('button',{name:'Details: Local test'})[0]);
    expect(onDetails).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
    expect(screen.queryByText(/backend|on hold/i)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('users row: the More actions menu lists Lifetime by state, reset, delete last; opening it asks for nothing', () => {
    const onReset = vi.fn(); const onDelete = vi.fn(); const onLifetime = vi.fn();
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={false} onDetails={vi.fn()} onReset={onReset} onDelete={onDelete} onLifetime={onLifetime} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions: Intl test' })[0]);
    const menu = screen.getByRole('menu');
    expect([...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.getAttribute('data-action'))).toEqual(['revoke', 'reset', 'delete']);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(menu).getAllByRole('menuitem')[2]);
    expect(onDelete).toHaveBeenCalledWith(accounts[1]);
  });
});

describe('Admin User Details: server plan state + legacy audit section (OD-16/OD-20)', () => {
  const account = { id: 'row-1', user_id: 'user-1', business_name: 'Biz', email: 'biz@example.test', plan: 'pro', trial_ends_at: '2026-10-20T00:00:00+00:00', is_lifetime: false, role: 'user', country: 'Local' };
  const cases = [
    ['not deployed (PGRST202)', () => ({ data: null, error: { code: 'PGRST202' }, status: 404 }), 'מערך המסלולים טרם הופעל', 'Plan system not active yet'],
    ['not activated', () => ({ data: { ok: false, code: 'not_activated' }, error: null }), 'מערך המסלולים טרם הופעל', 'Plan system not active yet'],
    ['account not provisioned', () => ({ data: { ok: false, code: 'account_not_provisioned' }, error: null }), 'החשבון טרם שויך למסלול', 'Not assigned to a plan yet'],
    ['forbidden / other error', () => ({ data: null, error: { code: '42501' } }), 'מצב המסלול אינו זמין כרגע', 'Plan state unavailable right now'],
  ];
  for (const [name, reply, he, en] of cases) {
    for (const isHebrew of [true, false]) {
      it(`${name} -> neutral line (${isHebrew ? 'HE' : 'EN'}); legacy values only in the labelled history section`, async () => {
        rpcState.summary = reply;
        render(<AdminUserDetails account={account} isHebrew={isHebrew} onBack={vi.fn()} />);
        expect((await screen.findByTestId('admin-plan-neutral')).textContent).toBe(isHebrew ? he : en);
        // Owner console 2026-10-16, typed: "מאשר שינוי ב-L-07 להחלפת הקודים בסטטוס מנוי עם אייקונים" - ONE subscription status (icon + words); the legacy plan field is not shown
        // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - spec §4.3: the head status (the user's own medallion), "Plan & usage" with the
        // quota counter from the server only ("—" while not active), the issued quotes a separate count; no raw code
        const usage = screen.getByRole('article', { name: isHebrew ? 'מסלול וניצול' : 'Plan & usage' });
        expect(usage.textContent).toContain(isHebrew ? 'ניצול מכסה—' : 'Quota usage—');
        expect(['trial', 'trial_ended']).toContain(document.querySelector('[data-status]').getAttribute('data-status'));
        expect(document.body.textContent).not.toMatch(/plan=|is_lifetime=|trial_ends_at/);
        expect(visibleTextOutsideStatus(document.body)).not.toMatch(LEGACY_LABELS);
        expect(rpcState.calls.find(([fn]) => fn === 'get_account_summary_for_admin')[1]).toEqual({ p_user_id: 'user-1' });
      });
    }
  }
  it('ready Free summary with the Free-10 counter enforced -> "3/10 used · 7 remaining" from the server', async () => {
    rpcState.summary = () => ({ data: { ...freeReady(7), phase: { output: 'enforced', catalog: 'off', billing: 'off' } }, error: null });
    render(<AdminUserDetails account={account} isHebrew={false} onBack={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('[data-status]').getAttribute('data-status')).toBe('free10'));
    expect(screen.getByRole('article', { name: 'Plan & usage' }).textContent).toContain('3/10 used · 7 remaining');
  });
  it('ready paid summary without a billing period -> "Subscription needs verification", never a default month', async () => {
    rpcState.summary = () => ({ data: ready({ plan: { id: 'modern' } }), error: null });
    render(<AdminUserDetails account={{ ...account, trial_ends_at: null }} isHebrew={false} onBack={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('[data-status]').getAttribute('data-status')).toBe('paid_unverified'));
    expect(screen.queryByText('Monthly subscription')).toBeNull();
  });
});

describe('Admin summary client (read-only RPC, strict parser, legacy stripped)', () => {
  it('PGRST202 / 404 -> not_deployed; other error -> unavailable; throw -> unavailable', async () => {
    expect((await fetchAdminAccountSummary({ rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) }, 'u')).summary.state).toBe('not_deployed');
    expect((await fetchAdminAccountSummary({ rpc: async () => ({ data: null, error: { code: 'X' }, status: 404 }) }, 'u')).summary.state).toBe('not_deployed');
    expect((await fetchAdminAccountSummary({ rpc: async () => ({ data: null, error: { code: '42501' } }) }, 'u')).summary.state).toBe('unavailable');
    expect((await fetchAdminAccountSummary({ rpc: async () => { throw new Error('offline'); } }, 'u')).summary.state).toBe('unavailable');
  });
  it('a ready payload with a legacy key parses (legacy is not part of account-summary/v1) and the legacy values are kept apart', async () => {
    const rpc = vi.fn(async () => ({ data: { ...ready(), legacy: { plan: 'pro', trialEndsAt: '2026-01-01T00:00:00Z', isLifetime: false } }, error: null }));
    const r = await fetchAdminAccountSummary({ rpc }, 'user-9');
    expect(rpc).toHaveBeenCalledWith('get_account_summary_for_admin', { p_user_id: 'user-9' });
    expect(r.summary.state).toBe('ready');
    expect(r.summary.planId).toBe('classic');
    expect(r.legacy).toEqual({ plan: 'pro', trialEndsAt: '2026-01-01T00:00:00Z', isLifetime: false });
  });
  it('a Free payload claiming catalog product images fails closed (strict shared parser)', async () => {
    const r = await fetchAdminAccountSummary({ rpc: async () => ({ data: { ...freeReady(3), capabilities: ['quote_style.classic', 'catalog_product_image.upload'] }, error: null }) }, 'u');
    expect(r.summary.state).toBe('invalid');
    expect(planStateText(r.summary, false)).toBe('Plan state unavailable right now');
  });
  it('no user id -> no RPC call', async () => {
    const rpc = vi.fn();
    expect((await fetchAdminAccountSummary({ rpc }, null)).summary.state).toBe('unavailable');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('legacy operations retire only when the output (free_issue) phase is enforced', () => {
    expect(legacyOperationsRetired({ state: 'ready', phase: { output: 'enforced', catalog: 'off', billing: 'off' } })).toBe(true);
    for (const output of ['off', 'prepared', 'shadow']) expect(legacyOperationsRetired({ state: 'ready', phase: { output, catalog: 'off', billing: 'off' } })).toBe(false);
    for (const state of ['loading', 'not_deployed', 'not_activated', 'unprovisioned', 'unavailable', 'invalid']) expect(legacyOperationsRetired({ state })).toBe(false);
  });
});

describe('Admin Plans / Activity: legacy history only, no legacy plan identity', () => {
  const accounts = [
    { id: 'a', business_name: 'A', email: 'a@example.test', plan: 'pro', trial_ends_at: null, is_lifetime: false, created_at: '2026-09-01T10:00:00Z' },
    { id: 'b', business_name: 'B', email: 'b@example.test', plan: 'free', trial_ends_at: '2020-01-01T00:00:00Z', is_lifetime: true, created_at: '2026-09-02T10:00:00Z' },
  ];
  for (const isHebrew of [true, false]) {
    // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - spec §4.4: the subscription mix ring chart (monthly / annual at 0), the
    // data quality card, a card per status that opens the users list filtered to it; no second accounts list, no raw code.
    it(`plans view (${isHebrew ? 'HE' : 'EN'}): ring chart + data quality + work by plan, no raw code`, async () => {
      const onGoToUsers = vi.fn();
      render(<AdminPlans accounts={accounts} isHebrew={isHebrew} onGoToUsers={onGoToUsers} />);
      await screen.findByText(isHebrew ? 'מערך המסלולים החדש: טרם הופעל' : 'New plan system: not active yet');
      // the approved plans sketch: the ring card is "מסלולים ומנויים" / "Plans & subscriptions"
      const mix = screen.getByRole('article', { name: isHebrew ? 'מסלולים ומנויים' : 'Plans & subscriptions' });
      expect([...mix.querySelectorAll('.av-legend [data-segment]')].map((r) => [r.getAttribute('data-segment'), r.querySelector('b').textContent])).toEqual([
        ['free10', '0'], ['trial', '0'], ['trial_ended', '0'], ['paid_monthly', '0'], ['paid_annual', '0'], ['lifetime', '1'], ['free10_inactive', '1']]);
      expect(screen.getByRole('article', { name: isHebrew ? 'איכות ושלמות המידע' : 'Data quality & coverage' })).toBeTruthy();
      expect(document.body.querySelector('code')).toBeNull();
      expect(document.body.textContent).not.toMatch(/plan=|is_lifetime=|trial_ends_at/);
      expect(visibleTextOutsideStatus(document.body)).not.toMatch(LEGACY_LABELS);
      fireEvent.click(document.querySelector('[data-status="lifetime"] button'));
      expect(onGoToUsers).toHaveBeenCalledOnce();
    });
  }
  it('system activity labels past trial / is_lifetime actions as legacy operations', async () => {
    const { supabase } = await import('../shared/supabase');
    supabase.rpc.mockImplementationOnce(async () => ({ data: [
      { id: 1, action: 'extend_trial', outcome: 'success', reason: 'r', created_at: '2026-09-01T10:00:00Z' },
      { id: 2, action: 'grant_lifetime', outcome: 'success', reason: 'r', created_at: '2026-09-01T10:00:00Z' },
      { id: 3, action: 'revoke_lifetime', outcome: 'denied', reason: 'r', created_at: '2026-09-01T10:00:00Z' },
    ], error: null }));
    render(<AdminSystemActivity accounts={[]} isHebrew={false} />);
    // the approved activity sketch defaults to the last 7 days; these events are older - the period filter shows all
    fireEvent.change(await screen.findByLabelText('Period'), { target: { value: 'all' } });
    await waitFor(() => expect(document.querySelector('[data-action="extend_trial"] strong').textContent).toBe('Legacy trial extended'));
    // Owner console 2026-10-16, typed: "מאשר שינוי ב-L-07 להחלפת הקודים בסטטוס מנוי עם אייקונים" - ONE subscription status (icon + words) wording in the history
    expect(document.querySelector('[data-action="grant_lifetime"] strong').textContent).toBe('Lifetime subscription granted');
    expect(document.querySelector('[data-action="revoke_lifetime"] strong').textContent).toBe('Lifetime subscription revoked');
    expect(document.body.textContent).not.toMatch(/is_lifetime=|Grant Lifetime|Revoke Lifetime|Extend Trial\b/);
  });
});

describe('Admin sources: no active legacy plan labels (static, comments stripped)', () => {
  const dir = join(cwd(), 'src', 'components');
  const files = readdirSync(dir).filter((f) => /^Admin.*\.jsx$/.test(f) && !f.includes('.test.'));
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  for (const f of files) {
    it(`${f}: no Basic/Pro/FREE/LIFETIME/trial-days/unlimited user-visible literal, no legacy entitlement resolver`, () => {
      const code = strip(readFileSync(join(dir, f), 'utf8'));
      const literals = [...code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
      // Owner A7 / A8 (2026-10-14): the single literal 'Lifetime' is allowed in the users list as the indicator filter option.
      // Owner console 2026-10-16 (L-07 approval, admin actions back): the Lifetime row action's labels and the Lifetime dialog's
      // English explanation are the only other exact literals allowed.
      const allowed = f === 'AdminUsersView.jsx'
        ? ['Lifetime', 'Revoke Lifetime: ${name(a)}', 'Grant Lifetime: ${name(a)}']
        : f === 'AdminUsersTab.jsx'
          ? ['Lifetime: the app and the chat show the account as a "Lifetime subscription" with every capability open and no charge. In the plan system it does not change a plan or a balance.',
            // Owner console 2026-10-16 (L-07, codes -> subscription status): the Lifetime dialog states in words
            'מנוי לכל החיים', 'Lifetime subscription', 'ללא מנוי לכל החיים', 'No Lifetime subscription',
            // Owner console 2026-10-17 ("מאשר תיקון כל 16 הממצאים של קודקס", AV-03): the revoke dialog explains the revoke
            // Owner 2026-10-25 ("ביקשתי לשנות בכל המקומות"): no "not yet active" once the plan system is active
            'ביטול LIFETIME: החשבון חוזר למצב שנקבע לפי נתוני החשבון והשרת (למשל מסלול החינם), ללא חיוב. מסלול או יתרה אינם נוצרים מהביטול.',
            'Revoking Lifetime: the account returns to the state its own data and the server give it (for example the Free plan), with no charge. Revoking creates no plan or balance.']
          : f === 'AdminSystemActivity.jsx'
            ? ['הענקת מנוי לכל החיים', 'Lifetime subscription granted', 'ביטול מנוי לכל החיים', 'Lifetime subscription revoked']
            : [];
      const offenders = literals.filter((l) => !allowed.includes(l) && /\b(Basic|BASIC|Pro|PRO|FREE_TRIAL|LIFETIME|Lifetime)\b|14[- ]?(day|days|יום)|unlimited|ללא הגבלה|5-20/.test(l));
      expect(offenders, f).toEqual([]);
      expect(code, f).not.toMatch(/resolveAccountEntitlement|getDisplayIdentityLabel|AdminPackageIcon/);
    });
  }
  it('AdminUsersTab legacy operations: submit disabled and handler refused once retired; server refusal localized', () => {
    const src = readFileSync(join(dir, 'AdminUsersTab.jsx'), 'utf8');
    expect(src.match(/disabled=\{isResetting \|\| legacyRetired\}/g)).toHaveLength(2);
    expect(src.match(/if \(legacyRetired\) throw new Error\(legacyRetiredText\);/g)).toHaveLength(2);
    expect(src).toContain("message === 'legacy_trial_retired' ? legacyRetiredText : message");
    // // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20 לשינויים שבאפיון" - the trial dialog is the shared protected dialog (its copy in domain/admin/adminCopy.js)
    expect(src).toContain('kind="trial"');
  });
});
