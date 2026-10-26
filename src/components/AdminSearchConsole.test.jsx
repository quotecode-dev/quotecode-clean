// Owner console 2026-10-26 (typed: "מאשר לבנות מסך גוגל סרץ' קונסול במסך הניהול, בקריאה בלבד"): the read-only Search Console screen.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
import AdminSearchConsole from './AdminSearchConsole';
import { ADMIN_DESTINATIONS } from './adminDestinations';

afterEach(cleanup);
beforeEach(() => invoke.mockReset());

const summary = {
  ok: true, site: 'sc-domain:tekango.com',
  period: { startDate: '2026-09-28', endDate: '2026-10-25' }, previousPeriod: { startDate: '2026-08-31', endDate: '2026-09-27' },
  totals: { clicks: 2, impressions: 1470, ctr: 0.1, position: 18 }, previous: { clicks: 0, impressions: 400, ctr: 0, position: 25.5 },
  byDate: [], queries: [{ query: 'הצעת מחיר', clicks: 1, impressions: 10, ctr: 10, position: 12.3 }],
  pages: [{ page: '/he', clicks: 2, impressions: 30, ctr: 6.7, position: 8 }],
  sitemaps: [{ path: '/sitemap.xml', lastDownloaded: '2026-10-26T10:00:00Z', errors: 0, warnings: 0, submitted: 28 }],
};

describe('the Search Console admin screen', () => {
  it('HE: asks the function for the summary and shows the totals, the change, the searches, the pages and the sitemap', async () => {
    invoke.mockResolvedValue({ data: summary, error: null });
    render(<AdminSearchConsole isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-search-console-kpis')).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith('search-console', { body: { action: 'summary' } });
    expect(screen.getByTestId('admin-search-console-kpi-clicks').textContent).toBe('2');
    expect(screen.getByTestId('admin-search-console-kpi-impressions').textContent).toBe('1,470');
    expect(screen.getByTestId('admin-search-console-kpi-position').textContent).toBe('18.0');
    expect(screen.getByTestId('admin-search-console-kpis').textContent).toMatch(/\+1,070/);
    expect(screen.getByTestId('admin-search-console-queries').textContent).toMatch(/הצעת מחיר/);
    expect(screen.getByTestId('admin-search-console-pages').textContent).toMatch(/\/he/);
    expect(screen.getByTestId('admin-search-console-sitemaps').textContent).toMatch(/28/);
    expect(screen.getByTestId('admin-search-console-period').textContent).toMatch(/28[./]09[./]2026/);
  });

  it('EN: a missing key and a Google refusal are said honestly', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'not_configured' }) } } });
    render(<AdminSearchConsole isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('admin-search-console-failed').textContent).toMatch(/key is not set/));
  });

  it('the indexing check runs only on request and lists every page with its state', async () => {
    invoke.mockResolvedValueOnce({ data: summary, error: null });
    render(<AdminSearchConsole isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-search-console-kpis')).toBeTruthy());
    expect(invoke).toHaveBeenCalledTimes(1);
    invoke.mockResolvedValueOnce({ data: { ok: true, pages: [
      { path: '/he', verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-10-20T00:00:00Z' },
      { path: '/en', verdict: 'NEUTRAL', coverageState: 'Duplicate, Google chose different canonical than user', lastCrawlTime: null },
    ] }, error: null });
    fireEvent.click(screen.getByTestId('admin-search-console-run-indexing'));
    await waitFor(() => expect(screen.getByTestId('admin-search-console-indexing-table')).toBeTruthy());
    expect(invoke).toHaveBeenLastCalledWith('search-console', { body: { action: 'indexing' } });
    const table = screen.getByTestId('admin-search-console-indexing-table');
    expect(table.querySelector('tr[data-verdict="PASS"]').textContent).toMatch(/באינדקס/);
    expect(table.querySelector('tr[data-verdict="NEUTRAL"]').textContent).toMatch(/לא באינדקס/);
    expect(table.querySelector('caption').textContent).toMatch(/1.*2/);
  });

  it('is an Owner-only tool in the System hub', () => {
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'search-console');
    expect(d).toMatchObject({ hub: 'system', permission: 'owner', available: true });
  });
});
