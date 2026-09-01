import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { LIGHT, FONT_HE } from '../theme/neonTheme';
import { classifyQuoteItems } from '../utils/professionalItemClassifier';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import CustomerQuoteItemRow from '../components/CustomerQuoteItemRow';
import { formatQuoteFallback } from '../utils/quoteNumber';

// Customer-facing preview: full-quote-context comparison of the CURRENT
// public quote presentation against three distinct new customer-facing
// concepts (A/B/C). Public route (no login), calls the same existing
// `get-public-quote` Edge Function SmartPublicQuote already uses -
// unmodified, zero new backend deploy - and explicitly does NOT call
// `public_increment_quote_view`, so opening this preview never inflates the
// real quote's real view count. Gated: only renders for a quote whose owning
// business is in the allowlist; every other quote shows a plain "not
// available" message, exactly like a 404.

const VARIANTS = [
  { key: 'current', label: 'התצוגה הנוכחית' },
  { key: 'A', label: 'אפשרות א׳ — נקייה' },
  { key: 'B', label: 'אפשרות ב׳ — פירוט לפי דרישה' },
  { key: 'C', label: 'אפשרות ג׳ — מקצועית מפורטת' },
];

function money(n) {
  return `₪${Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProfessionalPublicPreview() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', dto: null });
  const initialVariant = new URLSearchParams(window.location.search).get('variant');
  const [variant, setVariant] = useState(VARIANTS.some((v) => v.key === initialVariant) ? initialVariant : 'B');

  useEffect(() => {
    if (!id) { setState({ status: 'notfound', dto: null }); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke('get-public-quote', {
        body: { quote_id: id },
      });
      if (error || !data || !data.quote) {
        setState({ status: 'notfound', dto: null });
        return;
      }
      // No public_increment_quote_view call here, intentionally - see file header.
      setState({ status: 'ready', dto: data });
    })();
  }, [id]);

  if (state.status === 'loading') {
    return <div dir="rtl" style={{ fontFamily: FONT_HE, padding: '40px', textAlign: 'center' }}>טוען...</div>;
  }
  if (state.status !== 'ready') {
    return <div dir="rtl" style={{ fontFamily: FONT_HE, padding: '40px', textAlign: 'center' }}>הצעת המחיר אינה נמצאת.</div>;
  }

  const { quote, business, client, items: rawItems } = state.dto;

  // get-public-quote's response does not include user_id directly (by
  // design, for a public unauthenticated endpoint), so gating here relies on
  // the same business-name check the Owner-authorized demo is scoped to.
  // This is a deliberately narrow, temporary gate - see
  // professionalPreviewAllowlist.js for the authoritative user-id allowlist
  // used everywhere else.
  const isDavidQuote = (business?.business_name || '').includes('דוד אלומיניום');
  if (!isDavidQuote) {
    return <div dir="rtl" style={{ fontFamily: FONT_HE, padding: '40px', textAlign: 'center' }}>תצוגה זו אינה זמינה עבור הצעה זו.</div>;
  }

  // get-public-quote returns items as {description, quantity, price, total_price} -
  // the classifier expects unit_price, matching quote_items' own column name.
  const items = classifyQuoteItems(
    (rawItems || []).map((i) => ({ ...i, unit_price: i.price })),
    quote.notes || ''
  );

  const vat = Number(quote.subtotal) * Number(quote.tax_rate || 0);

  return (
    <div dir="rtl" style={{ fontFamily: FONT_HE, background: LIGHT.bg, minHeight: '100vh', padding: '16px' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>

        {/* Owner-only comparison toolbar - never shown to a real customer,
            since a real customer never has a reason to know this route
            exists. Purely a review aid. */}
        <div style={{ background: LIGHT.bgCardAlt, border: `1px solid ${LIGHT.border}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '700', color: LIGHT.violet, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            תצוגה מקדימה להשוואה — בחר גרסה
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {VARIANTS.map((v) => (
              <button
                key={v.key}
                onClick={() => setVariant(v.key)}
                style={{
                  fontFamily: FONT_HE, fontSize: '0.76rem', fontWeight: '700', padding: '7px 12px',
                  borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap',
                  border: `1px solid ${variant === v.key ? LIGHT.violet : LIGHT.border}`,
                  background: variant === v.key ? LIGHT.violet : LIGHT.bgCard,
                  color: variant === v.key ? '#fff' : LIGHT.textSecondary,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Full quote context, reusing the real PublicQuoteHeader component -
            same visual language as the actual customer experience. */}
        <PublicQuoteHeader
          isHebrew={true}
          bizLogo={business?.logo_url}
          bizName={business?.business_name}
          bizTaxId={business?.tax_id}
          bizPhone={business?.phone}
          bizEmail={business?.email}
          bizAddress={business?.address}
          quote={quote}
        />

        {client && (
          <div style={{ background: LIGHT.bgCard, border: `1px solid ${LIGHT.border}`, borderInlineStart: `3px solid ${LIGHT.violet}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: LIGHT.textMuted }}>לכבוד:</div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: LIGHT.violet }}>{(client.company_name || '').trim()}</div>
          </div>
        )}

        {/* Items - CURRENT renders as a plain table (today's real layout);
            A/B/C render as the new card-based professional presentation. */}
        {variant === 'current' ? (
          <div style={{ background: LIGHT.bgCard, border: `1px solid ${LIGHT.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: LIGHT.bgCardAlt }}>
                  <th style={{ padding: '10px 6px', textAlign: 'right', fontSize: '0.72rem', color: LIGHT.textMuted }}>תיאור פריט</th>
                  <th style={{ padding: '10px 6px', textAlign: 'center', fontSize: '0.72rem', color: LIGHT.textMuted }}>כמות</th>
                  <th style={{ padding: '10px 6px', textAlign: 'center', fontSize: '0.72rem', color: LIGHT.textMuted }}>מחיר יחידה</th>
                  <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: '0.72rem', color: LIGHT.textMuted }}>סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => <CustomerQuoteItemRow key={idx} item={item} variant="current" />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ marginBottom: '14px' }}>
            {items.map((item, idx) => <CustomerQuoteItemRow key={idx} item={item} variant={variant} />)}
          </div>
        )}

        {/* Totals - always the real, unmodified numbers. */}
        <div style={{ background: LIGHT.bgCardAlt, border: `1px solid ${LIGHT.border}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: LIGHT.textSecondary, marginBottom: '4px' }}>
            <span>סכום לפני מע״מ:</span><span>{money(quote.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: LIGHT.textSecondary, marginBottom: '8px' }}>
            <span>מע״מ ({Math.round(Number(quote.tax_rate || 0) * 100)}%):</span><span>{money(vat)}</span>
          </div>
          <div style={{ borderTop: `1px solid ${LIGHT.border}`, paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '800', fontSize: '1rem' }}>סה״כ לתשלום:</span>
            <span style={{ fontWeight: '800', fontSize: '1.2rem', color: LIGHT.violet }}>{money(quote.total)}</span>
          </div>
        </div>

        {quote.terms && (
          <div style={{ background: LIGHT.bgCard, border: `1px solid ${LIGHT.border}`, borderRadius: '12px', padding: '14px 18px', fontSize: '0.78rem', color: LIGHT.textSecondary, whiteSpace: 'pre-line' }}>
            <div style={{ fontWeight: '700', color: LIGHT.textPrimary, marginBottom: '6px' }}>תקנון ותנאים:</div>
            {quote.terms}
          </div>
        )}
      </div>
    </div>
  );
}
