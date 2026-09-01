import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { LIGHT, FONT_HE } from '../theme/neonTheme';
import { PROFESSIONAL_PREVIEW_USER_IDS } from '../config/professionalPreviewAllowlist';
import { classifyQuoteItems } from '../utils/professionalItemClassifier';
import ProfessionalItemComparisonCard from '../components/ProfessionalItemComparisonCard';
import { formatQuoteFallback } from '../utils/quoteNumber';

// Customer-facing preview: what would this SAME quote look like to the
// customer in the new professional presentation? Public route (no login),
// but deliberately calls the same existing `get-public-quote` Edge Function
// SmartPublicQuote already uses - unmodified, zero new backend deploy - and
// explicitly does NOT call `public_increment_quote_view`, so opening this
// preview never inflates the real quote's real view count. Gated: only
// renders for a quote whose owning business is in the allowlist; every other
// quote shows a plain "not available" message, exactly like a 404.

export default function ProfessionalPublicPreview() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', dto: null });

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

  const { quote, business, items: rawItems } = state.dto;

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

  return (
    <div dir="rtl" style={{ fontFamily: FONT_HE, background: LIGHT.bg, minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ background: LIGHT.gradient, borderRadius: '14px', padding: '18px 22px', marginBottom: '18px', color: '#fff' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            תצוגה מקדימה · כך תיראה הצעת המחיר בחוויה החדשה
          </div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '6px 0 0' }}>{formatQuoteFallback(quote)}</h1>
        </div>

        {items.map((item, idx) => (
          <ProfessionalItemComparisonCard key={item.id || idx} item={item} />
        ))}
      </div>
    </div>
  );
}
