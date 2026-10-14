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
const visibleTextOutsideCode = (root) => {
  const clone = root.cloneNode(true);
  clone.querySelectorAll('code').forEach((c) => c.remove());
  return clone.textContent;
};

beforeEach(() => {
  rpcState.calls.length = 0;
  rpcState.summary = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 });
});
afterEach(cleanup);

describe('Owner locked Admin presentation', () => {
  const accounts = [{ id:'local', business_name:'Local test', email:'local@example.test', country:'Local', plan:'free', trial_ends_at:'2026-09-02T10:00:00+00:00', is_lifetime:false }, { id:'intl', business_name:'Intl test', email:'intl@example.test', country:'International', plan:'basic', trial_ends_at:null, is_lifetime:true }];
  for (const isHebrew of [true,false]) it('directory: markets stay icon-only, Region heading, plan column from the server only, indicators column (Owner A7 / A8) '+isHebrew, async () => {
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={isHebrew} onDetails={vi.fn()} />);
    // Static column-header table + scrolling body table share one colgroup.
    const [headTable, table] = screen.getAllByRole('table');
    expect(within(headTable).getByText(isHebrew ? 'אזור' : 'Region')).toBeTruthy();
    expect(within(headTable).getAllByRole('columnheader')[0].textContent).toContain(isHebrew ? 'עסק' : 'Business');
    expect(within(headTable).getAllByRole('columnheader')[1].textContent).toBe(isHebrew ? 'מסלול' : 'Plan');
    // Owner 2026-10-14 (Codex spec A7 / A8, approved): human indicator tags replace the raw legacy record in the list.
    expect(within(headTable).getAllByRole('columnheader')[2].textContent).toContain(isHebrew ? 'חיוויים' : 'Indicators');
    expect(within(headTable).queryByText(/^(Role|תפקיד)$/)).toBeNull();
    await screen.findByText(isHebrew ? 'מערך המסלולים החדש: טרם הופעל' : 'New plan system: not active yet');
    for (const row of within(table).getAllByRole('row')) {
      const cells=within(row).getAllByRole('cell');
      // plan cell: neutral dash + full sentence for assistive tech; never a legacy identity
      expect(cells[1].textContent).toBe('—' + (isHebrew ? 'מערך המסלולים טרם הופעל' : 'Plan system not active yet'));
      expect(cells[4].textContent).toBe('');
      expect(within(cells[4]).getByRole('img').getAttribute('aria-label')).toBeTruthy();
    }
    const tagsOf = (sel) => [...table.querySelectorAll(sel + ' td:nth-child(3) [data-indicator]')].map((c) => c.getAttribute('data-indicator'));
    expect(tagsOf('tbody tr:first-child')).toEqual(['legacy_trial_ended']);
    expect(tagsOf('tbody tr:last-child')).toEqual(['lifetime']);
    expect(table.querySelector('tbody tr:first-child td:nth-child(3)').textContent).toBe(isHebrew ? 'ניסיון ישן הסתיים' : 'Legacy trial ended');
    expect(table.querySelector('tbody tr:last-child td:nth-child(3)').textContent).toBe(isHebrew ? 'לכל החיים' : 'Lifetime');
    expect(table.querySelector('tbody td:nth-child(3) code')).toBeNull();
    expect(table.querySelector('tbody tr:first-child td:nth-child(5) svg')).toBeTruthy();
    expect(table.querySelector('tbody tr:last-child td:nth-child(5) .lucide-globe')).toBeTruthy();
    // "Lifetime" is allowed only as the A7 indicator tag and the A8 filter option; every other legacy label stays banned.
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('[data-indicator="lifetime"], option[value="lifetime"]').forEach((n) => n.remove());
    expect(visibleTextOutsideCode(clone)).not.toMatch(LEGACY_LABELS);
    // not-active is global: ONE probe call, no per-row fan-out
    expect(rpcState.calls.filter(([fn]) => fn === 'get_account_summary_for_admin')).toHaveLength(1);
    // no legacy plan/trial filters any more; the only status filter is the A8 indicator filter
    expect(screen.queryByRole('combobox', { name: /plan|trial|חבילה|ניסיון/i })).toBeNull();
    expect(screen.getByRole('combobox', { name: isHebrew ? 'סינון לפי חיווי' : 'Filter by indicator' })).toBeTruthy();
  });

  it('directory: ready summaries show canonical names and the Free-10 balance (HE and EN), parsed from the RPC with legacy stripped', async () => {
    rpcState.summary = (uid) => ({ data: uid === 'local' ? { ...freeReady(7), legacy: { plan: 'pro', trialEndsAt: null, isLifetime: false } } : { ...ready(), legacy: { plan: 'basic', trialEndsAt: null, isLifetime: true } }, error: null });
    const { unmount } = render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={false} onDetails={vi.fn()} />);
    const table = screen.getAllByRole('table')[1];
    await waitFor(() => expect(table.querySelector('tbody tr:first-child td:nth-child(2)').textContent).toContain('Free'));
    expect(table.querySelector('tbody tr:first-child td:nth-child(2)').textContent).toContain('7/10');
    expect(table.querySelector('tbody tr:last-child td:nth-child(2)').textContent).toContain('Classic');
    expect(screen.queryByText('New plan system: not active yet')).toBeNull();
    unmount();
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew onDetails={vi.fn()} />);
    const heTable = screen.getAllByRole('table')[1];
    await waitFor(() => expect(heTable.querySelector('tbody tr:first-child td:nth-child(2)').textContent).toContain('חינם'));
    expect(heTable.querySelector('tbody tr:last-child td:nth-child(2)').textContent).toContain('קלאסיק');
  });

  it('recent registrations render real date/time and no trial/plan identity', async () => {
    render(<AdminOverview accounts={[{id:'expired',business_name:'Test registration',email:'test@example.test',country:'International',plan:'free',created_at:'2026-09-01T10:00:00Z',trial_ends_at:'2026-09-02T10:00:00Z'}]} isHebrew={false} onOpenUser={vi.fn()} onGoToUsers={vi.fn()} onGoToPlans={vi.fn()} />);
    const recent=screen.getByRole('heading',{name:'Recently registered'}).closest('article');
    expect(recent.textContent).toContain('09/01/2026 10:00'); // IRON-DATE-001: International viewer -> MM/DD/YYYY, UTC product zone
    expect(recent.textContent).not.toMatch(/trial/i);
    expect(recent.textContent).not.toContain('=>');
    await screen.findByText('New plan system: not active yet');
    const legacy = screen.getByRole('article', { name: 'Legacy record (history)' });
    expect([...legacy.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['plan=free', 'is_lifetime=null', 'trial_ends_at<=now']);
    expect(visibleTextOutsideCode(document.body)).not.toMatch(LEGACY_LABELS);
    expect(screen.queryByText(/Paid plans|On trial|Needs attention|Trials ending/)).toBeNull();
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
  it('first-LIVE profile: sensitive actions are not rendered at all (no disabled buttons, no backend-hold copy); details stays available', () => {
    const onDetails=vi.fn();
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={false} onDetails={onDetails} />);
    fireEvent.click(screen.getAllByRole('button',{name:'User details: Local test'})[0]);
    expect(onDetails).toHaveBeenCalledOnce();
    expect(screen.queryByText(/delete|extend trial|reset quote|backend|on hold/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /lifetime|delete|trial/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
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
        const legacy = screen.getByRole('region', { name: isHebrew ? 'רשומת מורשת (היסטוריה)' : 'Legacy record (history)' });
        expect([...legacy.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['plan=pro', 'trial_ends_at=2026-10-20T00:00:00+00:00', 'is_lifetime=false']);
        expect(legacy.querySelector('.admin-badge, [role="img"]')).toBeNull();
        expect(visibleTextOutsideCode(document.body)).not.toMatch(LEGACY_LABELS);
        expect(rpcState.calls.find(([fn]) => fn === 'get_account_summary_for_admin')[1]).toEqual({ p_user_id: 'user-1' });
      });
    }
  }
  it('ready Free summary -> canonical name, Free-10 balance, subscription status; legacy record comes from the RPC legacy key', async () => {
    rpcState.summary = () => ({ data: { ...freeReady(4), legacy: { plan: 'BASIC', trialEndsAt: null, isLifetime: true } }, error: null });
    render(<AdminUserDetails account={account} isHebrew={false} onBack={vi.fn()} />);
    expect(await screen.findByText('Free')).toBeTruthy();
    expect(screen.getByText('4 of 10 remaining')).toBeTruthy();
    expect(screen.getByText('No subscription')).toBeTruthy();
    const legacy = screen.getByRole('region', { name: 'Legacy record (history)' });
    expect([...legacy.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['plan=basic', 'trial_ends_at=null', 'is_lifetime=true']);
    expect(visibleTextOutsideCode(document.body)).not.toMatch(LEGACY_LABELS);
  });
  it('ready paid summary (HE) -> קלאסיק and no Free balance row', async () => {
    rpcState.summary = () => ({ data: ready({ plan: { id: 'modern' } }), error: null });
    render(<AdminUserDetails account={account} isHebrew onBack={vi.fn()} />);
    expect(await screen.findByText('מודרן')).toBeTruthy();
    expect(screen.queryByText(/מתוך 10/)).toBeNull();
    expect(screen.getByText('מנוי פעיל')).toBeTruthy();
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
    it(`plans view (${isHebrew ? 'HE' : 'EN'}): plan-system statement + labelled legacy breakdown, accounts open details`, async () => {
      const onOpenUser = vi.fn();
      render(<AdminPlans accounts={accounts} isHebrew={isHebrew} onOpenUser={onOpenUser} />);
      await screen.findByText(isHebrew ? 'מערך המסלולים החדש: טרם הופעל' : 'New plan system: not active yet');
      const legacy = screen.getByRole('article', { name: isHebrew ? 'רשומת מורשת (היסטוריה)' : 'Legacy record (history)' });
      expect([...legacy.querySelectorAll('code')].map((c) => c.textContent).sort()).toEqual(['plan=free', 'plan=pro', 'is_lifetime=false', 'is_lifetime=true', 'trial_ends_at<=now', 'trial_ends_at=null'].sort());
      expect(visibleTextOutsideCode(document.body)).not.toMatch(LEGACY_LABELS);
      fireEvent.click(screen.getAllByRole('button')[0]);
      expect(onOpenUser).toHaveBeenCalledWith(accounts[1]);
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
    expect(await screen.findByText(/Extend legacy trial/)).toBeTruthy();
    expect(screen.getByText(/Legacy operation: is_lifetime=true/)).toBeTruthy();
    expect(screen.getByText(/Legacy operation: is_lifetime=false/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Grant Lifetime|Revoke Lifetime|Extend Trial\b/);
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
      const allowed = f === 'AdminUsersView.jsx' ? ['Lifetime'] : [];
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
    expect(src).toContain("isHebrew ? 'הארכת ניסיון (מורשת)' : 'Extend legacy trial'");
  });
});
