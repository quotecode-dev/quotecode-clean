// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: צמצום תפריט הניהול לשני כפתורים ומסך מרכזי, ומשתמש מפקח עם מסך הרשאות מנהל"
// and "מאשר שינוי ב-L-17: הודעה צפייה אחת על חכם פלוס" - the two hubs, the Owner-only permissions screen, what a supervisor sees, and the
// SMART PACK bell notice. SYNTHETIC data; the Supabase client is replaced.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import AdminHub from './AdminHub';
import AdminSidebarNav from './AdminSidebarNav';
import AdminPermissions from './AdminPermissions';
import AdminDestinationHost from './AdminDestinationHost';
import AdminInquiries from './AdminInquiries';
import { SMART_PACK_ANNOUNCEMENT, activeAnnouncements } from '../utils/bellAnnouncements';
import { bellActionsFor } from '../utils/bellSubject';

const mocks = vi.hoisted(() => ({ holders: [], rpcCalls: [], rpcError: null }));
vi.mock('../shared/supabase', () => ({
  supabase: {
    rpc: async (fn, args) => {
      mocks.rpcCalls.push({ fn, args });
      if (mocks.rpcError) return { data: null, error: mocks.rpcError };
      if (fn === 'list_admin_permission_holders') return { data: mocks.holders, error: null };
      if (fn === 'set_admin_permissions') return { data: { ok: true }, error: null };
      return { data: null, error: { message: 'unknown' } };
    },
    from: () => {
      const q = { select() { return q; }, order() { return q; }, eq() { return q; }, limit() { return Promise.resolve({ data: [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: { auto_send_green: false, auto_send_yellow: false, paused: false }, error: null }); },
        in() { return Promise.resolve({ count: 2, error: null }); } };
      return q;
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));
afterEach(() => { cleanup(); mocks.holders = []; mocks.rpcCalls = []; mocks.rpcError = null; });

const OWNER = { owner: true, permissions: [] };
const host = (access, extra = {}) => ({ isHebrew: true, access, accounts: [], navigate: vi.fn(), can: (p) => access.owner || access.permissions.includes(p), ...extra });

describe('the two hubs ("ניהול" / "מערכת")', () => {
  it('the Owner sees every tool of the hub, the permissions screen included; a card opens the tool', () => {
    const h = host(OWNER);
    render(<AdminHub host={h} hubId="manage" />);
    const cards = screen.getAllByTestId(/^admin-hub-card-/).map((c) => c.dataset.testid.replace('admin-hub-card-', ''));
    expect(cards).toEqual(['overview', 'users', 'plans', 'inquiries', 'permissions']);
    fireEvent.click(screen.getByTestId('admin-hub-card-users'));
    expect(h.navigate).toHaveBeenCalledWith('users');
  });
  it('a supervisor sees only the tools granted; never the permissions screen', () => {
    render(<AdminHub host={host({ owner: false, permissions: ['users.view', 'inquiries.view'] })} hubId="manage" />);
    expect(screen.getAllByTestId(/^admin-hub-card-/).map((c) => c.dataset.testid)).toEqual(['admin-hub-card-users', 'admin-hub-card-inquiries']);
  });
  it('the "מערכת" hub in English holds System activity and the AI support log', () => {
    render(<AdminHub host={host(OWNER, { isHebrew: false })} hubId="system" />);
    expect(screen.getByText('System activity')).toBeTruthy();
    expect(screen.getByText('AI support log')).toBeTruthy();
  });
});

describe('the sidebar shows two buttons only', () => {
  it('the Owner: "ניהול" and "מערכת"; "ניהול" is active while one of its tools shows', () => {
    render(<AdminSidebarNav section="users" onSelect={() => {}} isHebrew access={OWNER} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent.replace(/\d+/g, ''))).toEqual(['ניהול', 'מערכת']);
    expect(buttons[0].className).toContain('dash-sidebar-btn-active');
    expect(buttons[1].className).not.toContain('dash-sidebar-btn-active');
  });
  it('the waiting counter sits on "ניהול"', async () => {
    render(<AdminSidebarNav section={null} onSelect={() => {}} isHebrew access={OWNER} />);
    const count = await screen.findByTestId('admin-nav-inquiries-count');
    expect(count.closest('button').textContent).toContain('ניהול');
  });
  it('a supervisor with a "מערכת" tool only sees "מערכת" and no counter', () => {
    render(<AdminSidebarNav section={null} onSelect={() => {}} isHebrew={false} access={{ owner: false, permissions: ['activity.view'] }} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['System']);
    expect(screen.queryByTestId('admin-nav-inquiries-count')).toBeNull();
  });
});

describe('the destination host', () => {
  it('the Owner opens a tool; no second back link (the shell\'s one "חזרה" button returns to the hub)', async () => {
    const { container } = render(<AdminDestinationHost sectionId="permissions" host={host(OWNER)} />);
    expect(await screen.findByTestId('permissions-empty')).toBeTruthy();
    expect(container.querySelector('[data-admin-destination="permissions"]')).toBeTruthy();
    expect(screen.queryByText(/^חזרה ל/)).toBeNull();
  });
  it('a supervisor never gets the permissions screen, even by a direct section id', () => {
    const { container } = render(<AdminDestinationHost sectionId="permissions" host={host({ owner: false, permissions: ['users.view'] })} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('"הרשאות מנהל" (the Owner only)', () => {
  const ACCOUNTS = [
    { user_id: 'u-owner', email: 'owner@tekango.test', business_name: 'TEKANGO', role: 'super_admin' },
    { user_id: 'u-dana', email: 'dana@biz.test', business_name: 'דנה שיפוצים', role: 'user' },
    { user_id: 'u-avi', email: 'avi@biz.test', business_name: 'Avi Glass', role: 'user' },
  ];
  it('no supervisors yet: says so, and lists the protected actions that stay the Owner\'s', async () => {
    render(<AdminPermissions isHebrew accounts={ACCOUNTS} />);
    expect(await screen.findByTestId('permissions-empty')).toBeTruthy();
    expect(screen.getByText(/רק בעל המערכת יכול למחוק משתמשים, להעניק מנוי לכל החיים או הארכה בחינם, ולמנות מפקחים/)).toBeTruthy();
  });
  it('add a supervisor: search an existing user (never a super admin), tick boxes, save exactly those', async () => {
    render(<AdminPermissions isHebrew accounts={ACCOUNTS} />);
    await screen.findByTestId('permissions-empty');
    fireEvent.click(screen.getByTestId('permissions-add'));
    fireEvent.change(screen.getByTestId('permissions-search'), { target: { value: 'tekango' } });
    expect(screen.queryAllByTestId('permissions-pick')).toHaveLength(0);
    fireEvent.change(screen.getByTestId('permissions-search'), { target: { value: 'biz.test' } });
    expect(screen.getAllByTestId('permissions-pick')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('permissions-pick')[0]);
    const editor = screen.getByTestId('permissions-editor');
    expect(within(editor).getAllByRole('checkbox')).toHaveLength(8);
    expect(within(editor).getAllByRole('checkbox').every((c) => !c.checked)).toBe(true);
    fireEvent.click(screen.getByTestId('permission-users.view'));
    fireEvent.click(screen.getByTestId('permission-inquiries.view'));
    fireEvent.click(screen.getByTestId('permissions-save'));
    await screen.findByTestId('permissions-notice');
    expect(mocks.rpcCalls.find((c) => c.fn === 'set_admin_permissions').args).toEqual({ p_user_id: 'u-dana', p_permissions: ['inquiries.view', 'users.view'] });
  });
  it('a supervisor is listed with their permissions in words; edit -> remove all', async () => {
    mocks.holders = [{ user_id: 'u-avi', email: 'avi@biz.test', business_name: 'Avi Glass', permissions: ['activity.view'] }];
    render(<AdminPermissions isHebrew={false} accounts={ACCOUNTS} />);
    const row = await screen.findByTestId('permissions-holder');
    expect(within(row).getByText('System activity')).toBeTruthy();
    fireEvent.click(screen.getByTestId('permissions-edit'));
    expect(screen.getByTestId('permission-activity.view').checked).toBe(true);
    fireEvent.click(screen.getByTestId('permissions-remove'));
    await waitFor(() => expect(mocks.rpcCalls.some((c) => c.fn === 'set_admin_permissions' && c.args.p_permissions.length === 0)).toBe(true));
  });
  it('a refused save says so (nothing is claimed)', async () => {
    render(<AdminPermissions isHebrew accounts={ACCOUNTS} />);
    await screen.findByTestId('permissions-empty');
    fireEvent.click(screen.getByTestId('permissions-add'));
    fireEvent.change(screen.getByTestId('permissions-search'), { target: { value: 'avi' } });
    fireEvent.click(screen.getByTestId('permissions-pick'));
    mocks.rpcError = { message: 'super_admin required' };
    fireEvent.click(screen.getByTestId('permissions-save'));
    expect((await screen.findByTestId('permissions-notice')).textContent).toBe('השמירה לא הצליחה. נסו שוב.');
  });
});

describe('a supervisor in the inquiries tab and the users list', () => {
  it('without inquiries.settings there is no settings button', async () => {
    render(<AdminInquiries isHebrew canReply={false} canSettings={false} />);
    await waitFor(() => expect(screen.queryByTestId('inquiries-settings')).toBeNull());
  });
  it('the protected user actions are wired only for the Owner (canProtect)', () => {
    const src = readFileSync('src/components/AdminUsersTab.jsx', 'utf8');
    expect((src.match(/onReset=\{!canProtect \? null :/g) || []).length).toBe(2);
    expect((src.match(/onDelete=\{!canProtect \? null :/g) || []).length).toBe(2);
    expect((src.match(/onLifetime=\{!canProtect \? null :/g) || []).length).toBe(2);
    expect(readFileSync('src/pages/Dashboard.jsx', 'utf8')).toMatch(/canProtect: isSuperAdmin,/);
  });
});

describe('the SMART PACK bell notice (L-17)', () => {
  it('one announcement, inside its window, whose one action opens the plans view', () => {
    expect(activeAnnouncements([SMART_PACK_ANNOUNCEMENT], new Date('2026-10-21T10:00:00Z'))).toHaveLength(1);
    expect(activeAnnouncements([SMART_PACK_ANNOUNCEMENT], new Date('2027-01-01T10:00:00Z'))).toHaveLength(0);
    expect(bellActionsFor({ ...SMART_PACK_ANNOUNCEMENT })).toEqual([{ kind: 'plans' }]);
  });
  it('the copy states the catalog price; Israel: added in the plans window (2026-10-25); abroad: not purchasable yet', () => {
    expect(SMART_PACK_ANNOUNCEMENT.copy.he.body).toContain('₪10 לחודש');
    // findings 1-13 (2026-10-25, L-17): plural address; "in the plans window" (an active subscriber adds it there, not "to the payment")
    expect(SMART_PACK_ANNOUNCEMENT.copy.he.body).toContain('אפשר להוסיף אותה בחלון המסלולים');
    expect(SMART_PACK_ANNOUNCEMENT.copy.he.body).not.toMatch(/שלך|בחירה שלך/);
    expect(SMART_PACK_ANNOUNCEMENT.copy.he.body).not.toContain('עם פתיחת המסלולים');
    expect(SMART_PACK_ANNOUNCEMENT.copy.en.body).toContain('$5 a month');
    expect(SMART_PACK_ANNOUNCEMENT.copy.en.body).toContain('available to buy when the plans open');
  });
});
