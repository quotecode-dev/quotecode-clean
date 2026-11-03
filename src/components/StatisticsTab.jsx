// Task 17 (2026-10-09): native quote Statistics + actionable Hot Quotes (HE/RTL + EN/LTR, desktop / tablet / mobile).
// Truth rules: KPIs come only from the loaded tenant quotes and the canonical status enum (draft/sent/approved/paid); there is no
// rejected metric and no time-to-view/approval because the data contract has no lifecycle timestamps. Money is shown per
// persisted quote currency (CurrencyTotals / formatMoneyDisplay; ILS whole-shekel per IRON-ILS-001), never combined.
// Actions reuse the existing quote-list handlers and their guards (handleProtectedAction entitlement gate, the email confirm
// modal via requestEmailSend, the canonical view/tracking link). There is no public-link copy action: no canonical one exists.
import { useMemo, useState } from 'react';
import { BarChart3, Eye, ListChecks, Mail, MessageCircle } from 'lucide-react';
import TekangoEyeIcon from './TekangoEyeIcon';
import { APP as NEON, appHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';
import { CurrencyTotals, MoneyValue } from './NumericValue';
import { QUOTE_CURRENCY_SYMBOLS, normalizeQuoteCurrency } from '../utils/money';
import { formatShortDate } from '../utils/shortDate';
import { QUOTE_STATUSES, STAT_PERIODS, computeQuoteStatistics } from '../utils/quoteStatistics';
import { displayQuoteNumber, getQuoteViewLink, quotePartyLabel } from '../utils/quoteListRows';
import { quoteDisplayStatus, quoteDisplayLabel } from '../utils/quoteStatusDisplay';

const STATUS_LABEL = {
  draft: ['טיוטה', 'Draft'], sent: ['נשלחה', 'Sent'], approved: ['אושרה', 'Approved'], paid: ['שולמה', 'Paid'],
};
const PERIOD_LABEL = { '7d': ['7 ימים', '7 days'], '30d': ['30 ימים', '30 days'], '90d': ['90 ימים', '90 days'], all: ['כל הזמן', 'All time'] };

const STATS_CSS = `
  .pf-stats-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block: 4px 14px; }
  .pf-stats-periods { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .pf-stats-period { min-block-size: 32px; padding-inline: 10px; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
  .pf-stats-period[aria-pressed="true"] { background: ${NEON.violet}; border-color: ${NEON.violet}; color: #fff; }
  .pf-stats-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-block-end: 16px; }
  .pf-stats-kpi { min-inline-size: 0; padding: 12px; border-radius: 10px; border: 1px solid ${NEON.border}; background: ${NEON.bgCardAlt}; }
  .pf-stats-kpi-label { font-size: 0.75rem; font-weight: 600; color: ${NEON.textSecondary}; margin-block-end: 4px; }
  .pf-stats-kpi-value { font-size: 1.25rem; font-weight: 800; color: ${NEON.textPrimary}; line-height: 1.2; }
  .pf-stats-kpi-sub { font-size: 0.72rem; color: ${NEON.textMuted}; margin-block-start: 2px; }
  .pf-stats-kpi-value .pf-currency-totals { font-size: 0.8em; }
  .pf-stats-hot-list { display: flex; flex-direction: column; gap: 8px; }
  .pf-stats-hot { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; align-items: center; gap: 6px 12px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${NEON.border}; border-inline-start: 3px solid ${NEON.amber}; background: ${NEON.bgCard}; }
  .pf-stats-hot-main { min-inline-size: 0; }
  .pf-stats-hot-client { font-weight: 700; font-size: 0.86rem; color: ${NEON.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-stats-hot-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 0.75rem; color: ${NEON.textSecondary}; }
  .pf-stats-hot-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 100%; }
  .pf-stats-hot-figures { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; font-size: 0.8rem; color: ${NEON.textSecondary}; }
  .pf-stats-hot-amount { font-weight: 800; color: ${NEON.textPrimary}; }
  .pf-stats-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .pf-stats-action { display: inline-flex; align-items: center; gap: 6px; min-block-size: 32px; padding-inline: 10px; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.border}; background: ${NEON.bgCardAlt}; color: ${NEON.textSecondary}; font-size: 0.75rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .pf-stats-action--primary { background: ${NEON.violetLighter}; color: ${NEON.violet}; border-color: transparent; }
  .pf-stats-note { margin-block-start: 14px; font-size: 0.72rem; color: ${NEON.textMuted}; }
  @media (max-width: 900px) {
    .pf-stats-hot { grid-template-columns: minmax(0, 1fr) auto; }
    .pf-stats-actions { grid-column: 1 / -1; justify-content: flex-start; }
  }
  @media (max-width: 560px) {
    .pf-stats-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .pf-stats-hot { grid-template-columns: minmax(0, 1fr); }
    .pf-stats-period, .pf-stats-action { min-block-size: 40px; }
  }
`;

// PRODUCT_TRUTH_CAPABILITY: quote_statistics
export default function StatisticsTab({
  quotes, isHebrew, isLocalIsraeliBusiness, currency, formatMoneyDisplay,
  handleProtectedAction, sendWhatsApp, requestEmailSend, activeTooltip, now = null, onCreateFollowUpTask = null, loadState,
}) {
  // R-10 (night task 2026-10-16, Owner-approved L-10): until the quotes have loaded, nothing here says 0 / "none" - a dash and a loading line
  const notLoaded = loadState !== undefined && loadState !== 'ok' && !(Array.isArray(quotes) && quotes.length);
  const [period, setPeriod] = useState('30d');
  const [status, setStatus] = useState('all');
  const L = (pair) => (isHebrew ? pair[0] : pair[1]);
  const accountCurrency = isLocalIsraeliBusiness ? 'ILS' : currency;
  const dateMarket = isLocalIsraeliBusiness ? 'Local' : 'International'; // the account market decides (IRON-DATE-001)
  const stats = useMemo(
    () => computeQuoteStatistics(quotes, { period, status, now: now ?? Date.now(), accountCurrency }),
    [quotes, period, status, now, accountCurrency],
  );
  const multiCurrency = stats.valueTotals.groups.length > 1;
  const kpis = [
    { key: 'created', label: ['הצעות שנוצרו', 'Quotes created'], value: stats.created },
    { key: 'awaiting', label: ['ממתינות לתגובה', 'Awaiting response'], value: stats.awaiting, sub: ['מצב: נשלחה', 'Status: sent'] },
    { key: 'viewed', label: ['נצפו לפחות פעם אחת', 'Viewed at least once'], value: stats.viewed },
    { key: 'won', label: ['אושרו / שולמו', 'Approved / paid'], value: stats.won },
    { key: 'hot', label: ['הצעות חמות', 'Hot quotes'], value: stats.hot, sub: ['3+ צפיות, טרם אושרה', '3+ views, not yet approved'] },
  ];
  const moneyCell = (quote) => {
    const code = normalizeQuoteCurrency(quote.currency);
    if (!code) return <span title={L(['להצעה אין מטבע תקין', 'This quote has no valid currency'])}>—</span>;
    return <MoneyValue className="pf-stats-hot-amount" symbol={QUOTE_CURRENCY_SYMBOLS[code]} text={formatMoneyDisplay(quote.total, code)} />;
  };
  const tooltip = (quote, action) => (activeTooltip?.quoteId === quote.id && activeTooltip?.action === action ? (
    <div className="feature-lock-tooltip" style={{ position: 'absolute', top: '105%', insetInlineStart: 0, background: NEON.textPrimary, color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'nowrap', zIndex: 5 }}>
      {L(['לא כלול במסלול הנוכחי', 'Not included in the current plan'])}
    </div>
  ) : null);

  return (
    <div className="pf-screen pf-work-screen pf-stats" data-testid="statistics-screen" style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      <style>{STATS_CSS}</style>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
        <BarChart3 size={18} color={NEON.textSecondary} strokeWidth={2} aria-hidden="true" />
        {L(['סטטיסטיקה', 'Statistics'])}
      </h2>
      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: NEON.textSecondary }}>
        {L(['מצב הצעות המחיר שלך לפי הנתונים הקיימים', 'Your quote pipeline from your current quote data'])}
      </p>

      <div className="pf-stats-filters">
        <div className="pf-stats-periods" role="group" aria-label={L(['תקופה', 'Period'])}>
          {Object.keys(STAT_PERIODS).map((p) => (
            // PRODUCT_TRUTH_CAPABILITY: quote_statistics
            <button key={p} type="button" className="pf-stats-period" aria-pressed={period === p} data-period={p} onClick={() => setPeriod(p)}>
              {L(PERIOD_LABEL[p])}
            </button>
          ))}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: NEON.textSecondary }}>
          {L(['מצב', 'Status'])}
          <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="statistics-status"
            style={{ minBlockSize: '32px', padding: '4px 8px', borderRadius: RADIUS.sm, border: `1px solid ${NEON.borderStrong}`, background: NEON.bgInput, fontSize: '0.78rem', fontWeight: '700', color: NEON.textPrimary }}>
            <option value="all">{L(['כל המצבים', 'All statuses'])}</option>
            {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{L(STATUS_LABEL[s])}</option>)}
          </select>
        </label>
      </div>

      {/* the shared screen contract: the header + filters stay static, .pf-screen-body is the ONLY vertical scroll owner */}
      <div className="pf-screen-body" data-testid="statistics-body">
      <div className="pf-stats-kpis" data-testid="statistics-kpis">
        {kpis.map((k) => (
          <div key={k.key} className="pf-stats-kpi" data-kpi={k.key}>
            <div className="pf-stats-kpi-label">{L(k.label)}</div>
            <div className="pf-stats-kpi-value"><bdi className="pf-num" dir="ltr">{notLoaded ? '—' : k.value}</bdi></div>
            {k.sub && <div className="pf-stats-kpi-sub">{L(k.sub)}</div>}
          </div>
        ))}
        <div className="pf-stats-kpi" data-kpi="conversion">
          <div className="pf-stats-kpi-label">{L(['שיעור האישורים והתשלומים מתוך ההצעות שהגיעו ללקוח', 'Current pipeline conversion'])}</div>
          <div className="pf-stats-kpi-value"><bdi className="pf-num" dir="ltr">{notLoaded ? '—' : `${stats.conversion.percent}%`}</bdi></div>
          <div className="pf-stats-kpi-sub">
            <bdi className="pf-num" dir="ltr">{`${stats.conversion.numerator}/${stats.conversion.denominator}`}</bdi>
            {' '}{L(['אושרו/שולמו מתוך ההצעות שהגיעו ללקוח (נשלחו או נצפו, אושרו, שולמו)', 'approved+paid of the quotes that reached the customer (sent or viewed, approved, paid)'])}
          </div>
        </div>
        <div className="pf-stats-kpi" data-kpi="value">
          <div className="pf-stats-kpi-label">{multiCurrency ? L(['שווי ההצעות לפי מטבע', 'Quote value by currency']) : L(['שווי ההצעות', 'Quote value'])}</div>
          <div className="pf-stats-kpi-value">
            {notLoaded ? <bdi className="pf-num" dir="ltr">—</bdi> : <CurrencyTotals totals={stats.valueTotals} formatMoneyDisplay={formatMoneyDisplay} emptyCurrency={accountCurrency} isHebrew={isHebrew} />}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px', color: NEON.textPrimary }}>
        <TekangoEyeIcon size={24} />
        {L(['הצעות חמות', 'Hot quotes'])}
        <bdi className="pf-num" dir="ltr" style={{ color: NEON.textMuted, fontWeight: 600 }}>{notLoaded ? '(—)' : `(${stats.hotQuotes.length})`}</bdi>
      </h3>
      {stats.hotQuotes.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: NEON.textMuted, padding: '10px 2px' }} data-testid="statistics-hot-empty">
          {notLoaded ? L(['טוענים את ההצעות…', 'Loading your quotes…']) : L(['אין הצעות חמות בתקופה ובמצב שנבחרו', 'No hot quotes for the selected period and status'])}
        </div>
      ) : (
        <div className="pf-stats-hot-list" data-testid="statistics-hot-list">
          {stats.hotQuotes.map((quote) => {
            const title = quote.subject || quote.quote_subject || '';
            // the real client, else the quote title, else its full number (never 'N/A', never a fabricated client)
            const party = quotePartyLabel(quote);
            return (
              <div key={quote.id} className="pf-stats-hot" data-hot-quote-id={quote.id}>
                <div className="pf-stats-hot-main">
                  <div className="pf-stats-hot-client" data-party={party.kind} title={party.text}>
                    {party.kind === 'number' ? <bdi className="pf-num" dir="ltr">{party.text}</bdi> : party.text}
                  </div>
                  <div className="pf-stats-hot-meta">
                    <bdi className="pf-num" dir="ltr" data-testid="hot-number">{displayQuoteNumber(quote)}</bdi>
                    {title && <span className="pf-stats-hot-title" title={title}>{title}</span>}
                  </div>
                </div>
                <div className="pf-stats-hot-figures">
                  {/* R-22: the SAME shown status as the quote list (a hot draft is "Viewed, awaiting", never "Draft") */}
                  <span data-testid="hot-status">{quoteDisplayLabel(quoteDisplayStatus(quote), isHebrew)}</span>
                  <span><bdi className="pf-num" dir="ltr" data-testid="hot-views">{Number(quote.view_count || 0)}</bdi> {L(['צפיות', 'views'])}</span>
                  <bdi className="pf-num" dir="ltr">{formatShortDate(quote.created_at, dateMarket)}</bdi>
                  {moneyCell(quote)}
                </div>
                <div className="pf-stats-actions">
                  {/* PRODUCT_TRUTH_CAPABILITY: public_quote_view */}
                  <button type="button" className="pf-stats-action pf-stats-action--primary" onClick={() => window.open(getQuoteViewLink(quote), '_blank')}>
                    {/* R-22: this opens the customer's page in a new tab - not the list's in-app "Open & track" panel - so it says so */}
                    <Eye size={14} aria-hidden="true" />{L(['צפייה בהצעה', 'View quote'])}
                  </button>
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    {/* PRODUCT_TRUTH_CAPABILITY: owner_whatsapp_share */}
                    <button type="button" className="pf-stats-action" onClick={() => handleProtectedAction(quote.id, 'whatsapp', () => sendWhatsApp(quote))}>
                      <MessageCircle size={14} aria-hidden="true" />{L(['וואטסאפ', 'WhatsApp'])}
                    </button>
                    {tooltip(quote, 'whatsapp')}
                  </span>
                  {/* PRODUCT_TRUTH_CAPABILITY: quote_email */}
                  <button type="button" className="pf-stats-action" onClick={() => requestEmailSend(quote)}>
                    <Mail size={14} aria-hidden="true" />{L(['שליחה במייל', 'Email'])}
                  </button>
                  {typeof onCreateFollowUpTask === 'function' && (
                    // Task 18: opens the task form pre-linked to this quote and its client; nothing is created until the user saves
                    // PRODUCT_TRUTH_CAPABILITY: quote_statistics
                    <button type="button" className="pf-stats-action" data-testid="hot-follow-up" onClick={() => onCreateFollowUpTask(quote)}>
                      <ListChecks size={14} aria-hidden="true" />{L(['יצירת משימת מעקב', 'Create follow-up task'])}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="pf-stats-note" data-testid="statistics-unsupported-note">
        {L([
          'לא מוצגים נתונים על הצעות שנדחו או על הזמן עד לצפייה ולאישור, כי עדיין אין בנתונים מצב ״נדחתה״ או מועדים שמאפשרים לחשב את פרקי הזמן האלה.',
          '"Rejected" and time-to-view/approval are not shown: the data has no rejected status and no stored lifecycle times yet.',
        ])}
      </p>
      </div>
    </div>
  );
}
