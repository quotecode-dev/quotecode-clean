import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';

export default function SmartPublicQuote() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', dto: null });
  const processedIdRef = useRef(null);

  useEffect(() => {
    if (!id) {
      setState({ status: 'notfound', dto: null });
      return;
    }

    // מונע קריאה כפולה כתוצאה מ-double-invoke של useEffect ב-React 18
    // StrictMode (dev בלבד) - ה-ref שורד בין ה-mount/cleanup/remount הכפול,
    // בניגוד ל-state, ולכן מבטיח בקשת רשת אחת בפועל לכל id נתון, אך עדיין
    // מאפשר fetch חדש אם המשתמש עובר בפועל להצעה אחרת (id שונה) באותה sesion.
    if (processedIdRef.current === id) return;
    processedIdRef.current = id;

    (async () => {
      const { data, error } = await supabase.functions.invoke('get-public-quote', {
        body: { quote_id: id },
      });

      // Stale-response guard: apply this result only if `id` is still the
      // most-recently-requested id. Unlike a per-effect `cancelled` closure,
      // this is never flipped by React 18 StrictMode's dev-only synthetic
      // cleanup (which never touches processedIdRef) - only a genuine
      // navigation to a different quote id changes it.
      if (processedIdRef.current !== id) return;

      if (error) {
        const status = error?.context?.status;
        setState({ status: status === 404 ? 'notfound' : 'error', dto: null });
        return;
      }

      if (!data || !data.quote) {
        setState({ status: 'error', dto: null });
        return;
      }

      setState({ status: 'ready', dto: data });

      // Fire-and-forget: ה-RPC עצמו כבר לא סופר צפיות של הבעלים
      // (auth.uid() = quotes.user_id) - נבדק ואומת ב-Phase 2. אין צורך
      // לשכפל את אותה בדיקה כאן.
      supabase.rpc('public_increment_quote_view', { p_quote_id: id }).then(
        () => {},
        () => {}
      );
    })();
  }, [id]);

  if (state.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (state.status !== 'ready') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', textAlign: 'center', padding: '20px', gap: '6px' }}>
        <h2>Quote not found or expired.</h2>
        <h2 dir="rtl">הצעת המחיר אינה נמצאת או שפג תוקפה.</h2>
      </div>
    );
  }

  const { quote } = state.dto;
  const isLocalQuote = Number(quote.tax_rate) > 0 || (quote.currency || '').toUpperCase() === 'ILS';

  return isLocalQuote ? <PublicQuote quoteData={state.dto} /> : <PublicQuoteEn quoteData={state.dto} />;
}
