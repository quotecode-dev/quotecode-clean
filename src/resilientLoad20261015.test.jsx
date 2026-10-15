// Owner 2026-10-15 (quotes vanished with zero counters until a refresh; "no user action, no refresh - a permanent fix"): the list never
// says "none" for a load that failed; the Dashboard's lists heal themselves.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QuotesTab from './components/QuotesTab';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dash = fs.readFileSync(path.join(HERE, 'pages/Dashboard.jsx'), 'utf8');
afterEach(cleanup);

const t = new Proxy({}, { get: (_o, k) => String(k) });
const props = (o = {}) => ({
  quotes: [], allQuotes: [], searchTerm: '', setSearchTerm: vi.fn(), statusFilter: 'All', setStatusFilter: vi.fn(), quoteSortField: 'created_at',
  quoteSortDirection: 'desc', handleQuoteSort: vi.fn(), handleExportQuotes: vi.fn(), handleEditClick: vi.fn(), handleDuplicateQuote: vi.fn(),
  sendWhatsApp: vi.fn(), handleDeleteQuote: vi.fn(), handleProtectedAction: vi.fn(), activeTooltip: null, openDropdownId: null, isHebrew: true,
  isLocalIsraeliBusiness: true, formatMoneyDisplay: (v) => Number(v || 0).toFixed(2), t, setPendingEmailQuote: vi.fn(), emailStatuses: {}, currency: 'ILS',
  ...o,
});

describe('the quotes list never reads a failed / pending load as "no quotes"', () => {
  it('loading: a loading line instead of "no quotes found", counters show a dash', () => {
    render(<QuotesTab {...props({ loadState: 'loading' })} />);
    expect(screen.getAllByTestId('quotes-loading')[0].textContent).toBe('טוענים את ההצעות…');
    expect(screen.queryByText('לא נמצאו הצעות מחיר במסד הנתונים.')).toBeNull();
    const values = [...document.querySelectorAll('[data-testid="quote-overview"] .quote-overview-value')].map((e) => e.textContent);
    expect(values.every((v) => v === '—')).toBe(true);
  });
  it('retrying: says it keeps trying by itself - no button, nothing to do for the user', () => {
    render(<QuotesTab {...props({ loadState: 'retrying' })} />);
    expect(screen.getAllByTestId('quotes-loading')[0].textContent).toBe('טוענים את ההצעות… החיבור איטי, ממשיכים לנסות אוטומטית.');
    expect(screen.queryByRole('button', { name: /נסו שוב|רענון/ })).toBeNull();
  });
  it('a successful answer with no quotes is the only "no quotes found"', () => {
    render(<QuotesTab {...props({ loadState: 'ok' })} />);
    expect(screen.getAllByTestId('quotes-empty')[0].textContent).toBe('לא נמצאו הצעות מחיר במסד הנתונים.');
    expect(document.querySelector('[data-qh-overview="all"] .quote-overview-value').textContent).toBe('0');
  });
  it('quotes already on screen stay visible while a reload is pending', () => {
    const q = { id: 'q1', quote_number: 100701, status: 'draft', total: 100, currency: 'ILS', created_at: '2026-10-15T10:00:00Z', clients: { company_name: 'לקוח' }, quote_items: [] };
    render(<QuotesTab {...props({ loadState: 'retrying', quotes: [q], allQuotes: [q] })} />);
    expect(screen.queryByTestId('quotes-loading')).toBeNull();
    expect(document.querySelector('[data-qh-overview="all"] .quote-overview-value').textContent).toBe('1');
  });
});

describe('Dashboard: self-healing lists (source guards)', () => {
  it('every list load goes through the self-healing loader; only a successful answer replaces a list', () => {
    expect(dash).toContain("import { loadWithRetry, isNetworkError } from '../utils/resilientLoad';");
    for (const name of ['quotes', 'clients', 'services', 'expenses', 'attachments']) expect(dash).toContain(`return loadResource('${name}', userId,`);
    expect(dash).toContain('if (res.ok && isCurrent()) {');
    expect(dash).not.toMatch(/if \(error\) console\.error\('Error fetching quotes:', error\.message\);\s*else setQuotes/);
  });
  it('a failed attachments request no longer empties the attachments', () => {
    expect(dash).toContain("if (q.error) return { ok: false, error: q.error, status: q.status };");
  });
  it('a network failure of the business settings is retried, never a sign-out', () => {
    expect(dash).toContain('if (r.error && isNetworkError(r.error, r.status)) return { ok: false, error: r.error, status: r.status };');
  });
  it('the lists load side by side and never block the settings', () => {
    expect(dash).toMatch(/fetchQuotes\(userId\);\s*fetchClients\(userId\);\s*fetchServices\(userId\);\s*fetchExpenses\(userId\);\s*fetchAllUserAttachments\(userId\);\s*await fetchSettings/);
  });
  it('an explicit load supersedes an older one (a save is never answered by a request from before it); quiet refreshes skip a busy list', () => {
    expect(dash).toContain('const isCurrent = () => gen === loadGenRef.current && seq === loadSeqRef.current[name];');
    expect(dash).toContain('if (background && inFlightRef.current[name]) return inFlightRef.current[name];');
  });
  it('back in the app, the network back and a realtime reconnect reload quietly; the page never reloads itself', () => {
    expect(dash).toContain("document.addEventListener('visibilitychange', onVisible);");
    expect(dash).toContain("window.addEventListener('online', onOnline);");
    expect(dash).toContain("diagLog('data-refresh', { reason: 'realtime-reconnect' }); fetchQuotes(userId, { background: true });");
    expect(dash).toContain('loaders[name](userId, { background: true });');
  });
  it('sign-out / another user stops older retry loops', () => {
    expect(dash.match(/loadGenRef\.current \+= 1;/g)).toHaveLength(2);
  });
  it('the quotes list receives its load state', () => {
    expect(dash).toContain('loadState={dataLoad.quotes}');
  });
});
