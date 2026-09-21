// Test-only harness (never bundled into the app: not referenced by index.html). Renders the REAL QuotesTab with
// synthetic quotes so the numeric-geometry browser gate can measure real coordinates. ?lang=he|en
import { createRoot } from 'react-dom/client';
import '../../src/fonts.css';
import '../../src/index.css';
import QuotesTab from '../../src/components/QuotesTab';
import { MoneyValue } from '../../src/components/NumericValue';
import { formatMoneyForCurrency } from '../../src/utils/money';

const q = new URLSearchParams(location.search);
const isHebrew = q.get('lang') !== 'en';
const fmt = (n) => formatMoneyForCurrency(n, isHebrew ? 'ILS' : 'USD');
const sym = isHebrew ? '₪' : '$';
const totals = [0, 1, 9, 10, 99, 100, 333, 1300, 10000, -1300, 9999999.99];
// ?legacy=1 reproduces the pre-fix geometry (auto-width amount, no protected slot) to prove the gate can fail.
if (q.get('legacy')) { const st = document.createElement('style'); st.textContent = '.pf-money-slot{inline-size:auto!important;min-inline-size:0!important;flex:0 1 auto!important}'; document.head.appendChild(st); }
document.documentElement.dir = isHebrew ? 'rtl' : 'ltr';
const quotes = totals.map((total, i) => ({
  id: `qq-${i}-0000000000000`, status: 'pending', signature: null,
  clients: { company_name: isHebrew ? 'לקוח בדיקה ארוך מאוד עם שם ארוך' : 'Synthetic long customer name', client_type: 'business' },
  subtotal: total, discount: 0, total, currency: isHebrew ? 'ILS' : 'USD', tax_rate: 18, view_count: 0,
  created_at: '2026-01-01T00:00:00.000Z', quote_items: [{ description: 'Item' }], client_type: 'business', email_bounced: false,
}));
const noop = () => {};
const props = {
  quotes, searchTerm: '', setSearchTerm: noop, statusFilter: 'All', setStatusFilter: noop, quoteSortField: 'date',
  quoteSortDirection: 'desc', handleQuoteSort: noop, handleCreateNewQuoteClick: noop, handleExportQuotes: noop,
  handleEditClick: noop, handleDuplicateQuote: noop, sendWhatsApp: noop, handleDeleteQuote: noop,
  handleProtectedAction: (id, a, fn) => fn(), activeTooltip: { quoteId: null, action: null }, openDropdownId: null,
  isHebrew, isLocalIsraeliBusiness: isHebrew, formatNum: fmt, formatMoneyDisplay: fmt, t: { recentHistory: 'History', searchQuote: 'Search', filterStatus: 'Status' },
  setPendingEmailQuote: noop, emailStatuses: {}, currency: isHebrew ? 'ILS' : 'USD',
};
createRoot(document.getElementById('root')).render(
  <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ padding: 8 }}>
    <QuotesTab {...props} />
    <div id="totals-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 10, marginTop: 16, width: '100%', maxWidth: 320, boxSizing: 'border-box' }}>
      {[['sub', 1300, 0.8], ['disc', -130, 0.8], ['vat', 210.6, 0.8], ['grand', 10000, 1]].map(([k, v, fs]) => (
        <>
          <span key={k + 'l'}>{k}</span>
          <MoneyValue key={k} data-testid={`tg-${k}`} hero={k === 'grand'} symbol={sym} text={fmt(v)} style={{ fontSize: `${fs}rem`, textAlign: 'right' }} />
        </>
      ))}
    </div>
  </div>
);
