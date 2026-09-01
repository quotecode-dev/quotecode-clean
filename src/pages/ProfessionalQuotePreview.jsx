import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { LIGHT, FONT_HE } from '../theme/neonTheme';
import { isProfessionalPreviewEnabled } from '../config/professionalPreviewAllowlist';
import { classifyQuoteItems } from '../utils/professionalItemClassifier';
import ProfessionalItemComparisonCard from '../components/ProfessionalItemComparisonCard';
import { formatQuoteFallback } from '../utils/quoteNumber';

// Business-side (authenticated) preview: "how would MY existing quote look in
// the new professional item experience?" Read-only - fetches the account's
// own quote(s) via the normal authenticated Supabase client (same RLS every
// other Dashboard read already uses), never writes anything. Gated to the
// professionalPreviewAllowlist only; any other logged-in account sees a
// plain "not available" message and nothing else.

export default function ProfessionalQuotePreview() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', quote: null, items: null });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!isProfessionalPreviewEnabled(userId)) {
        setState({ status: 'forbidden', quote: null, items: null });
        return;
      }

      const { data: quotes, error } = await supabase
        .from('quotes')
        .select('*, clients(company_name, contact_name), quote_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !quotes || quotes.length === 0) {
        setState({ status: 'empty', quote: null, items: null });
        return;
      }

      const quote = quotes[0];
      const classified = classifyQuoteItems(quote.quote_items || [], quote.notes || '');
      setState({ status: 'ready', quote, items: classified });
    })();
  }, []);

  if (state.status === 'loading') {
    return <div dir="rtl" style={{ fontFamily: FONT_HE, padding: '40px', textAlign: 'center' }}>טוען...</div>;
  }

  if (state.status === 'forbidden') {
    return (
      <div dir="rtl" style={{ fontFamily: FONT_HE, padding: '40px', textAlign: 'center', color: LIGHT.textSecondary }}>
        התצוגה המקדימה הזו אינה זמינה עבור חשבון זה.
      </div>
    );
  }

  if (state.status === 'empty') {
    return <div dir="rtl" style={{ fontFamily: FONT_HE, padding: '40px', textAlign: 'center' }}>לא נמצאה הצעת מחיר.</div>;
  }

  const { quote, items } = state;
  const publicUrl = `${window.location.origin}/public-quote/${quote.id}/preview`;

  return (
    <div dir="rtl" style={{ fontFamily: FONT_HE, background: LIGHT.bg, minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: LIGHT.violet, fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
        >
          → חזרה ללוח הבקרה
        </button>

        <div style={{ background: LIGHT.gradient, borderRadius: '14px', padding: '18px 22px', marginBottom: '18px', color: '#fff' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            תצוגה מקדימה · חוויית הצעת מחיר מקצועית חדשה
          </div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '6px 0 4px' }}>
            הצעה {formatQuoteFallback(quote)} · {(quote.clients?.company_name || '').trim()}
          </h1>
          <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
            זו תצוגה להדגמה בלבד — ההצעה המקורית שלך לא השתנתה ולא נשמרה מחדש.
          </div>
        </div>

        {items.map((item) => (
          <ProfessionalItemComparisonCard key={item.id} item={item} />
        ))}

        <div style={{ background: LIGHT.bgCardAlt, border: `1px solid ${LIGHT.border}`, borderRadius: '12px', padding: '14px 18px', marginTop: '10px', fontSize: '0.8rem', color: LIGHT.textSecondary }}>
          רוצה לראות איך זה נראה ללקוח שלך?{' '}
          <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: LIGHT.violet, fontWeight: '700' }}>
            פתח את התצוגה ללקוח
          </a>
        </div>
      </div>
    </div>
  );
}
