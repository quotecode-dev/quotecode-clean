import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import AdminOverview from './AdminOverview';
import AdminUsersView from './AdminUsersView';
import { AdminMarketIcon } from './AdminIdentityIcons';
import { AuthenticatedSidebarFrame } from './AuthenticatedShellFrames';
import { resolveAdminMarket } from '../utils/adminMarket';
afterEach(cleanup);
describe('Owner locked Admin presentation', () => {
  const accounts = [{ id:'local', business_name:'Local test', email:'local@example.test', country:'Local', plan:'free' }, { id:'intl', business_name:'Intl test', email:'intl@example.test', country:'International', plan:'basic' }];
  for (const isHebrew of [true,false]) it('directory uses icon-only packages/markets and Region heading '+isHebrew, () => {
    render(<AdminUsersView accounts={accounts} search="" onSearch={vi.fn()} isHebrew={isHebrew} onDetails={vi.fn()} />);
    // Static column-header table + scrolling body table share one colgroup.
    const [headTable, table] = screen.getAllByRole('table');
    expect(within(headTable).getByText(isHebrew ? 'אזור' : 'Region')).toBeTruthy();
    expect(within(headTable).getAllByRole('columnheader')[0].textContent).toContain(isHebrew ? 'עסק' : 'Business');
    expect(within(headTable).queryByText(/^(Role|תפקיד)$/)).toBeNull();
    for (const row of within(table).getAllByRole('row')) {
      const cells=within(row).getAllByRole('cell');
      expect(cells[1].textContent).toBe(''); expect(cells[4].textContent).toBe('');
      expect(within(cells[1]).getByRole('img').getAttribute('aria-label')).toBeTruthy();
      expect(within(cells[4]).getByRole('img').getAttribute('aria-label')).toBeTruthy();
    }
    expect(table.querySelector('tbody tr:first-child td:nth-child(5) svg')).toBeTruthy();
    expect(table.querySelector('tbody tr:last-child td:nth-child(5) .lucide-globe')).toBeTruthy();
  });
  it('recent registrations render real date/time and expired trial truth', () => {
    render(<AdminOverview accounts={[{id:'expired',business_name:'Test registration',email:'test@example.test',country:'International',plan:'free',created_at:'2026-09-01T10:00:00Z',trial_ends_at:'2026-09-02T10:00:00Z'}]} isHebrew={false} onOpenUser={vi.fn()} />);
    const recent=screen.getByRole('heading',{name:'Recently registered'}).closest('article');
    expect(recent.textContent).toContain('09/01/2026 10:00'); // IRON-DATE-001: International viewer -> MM/DD/YYYY, UTC product zone
    expect(recent.textContent).toContain('Trial expired:');
    expect(recent.textContent).not.toContain('=>');
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
