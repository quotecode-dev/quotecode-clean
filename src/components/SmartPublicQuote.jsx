// ==========================================
// 🚨 חוק ברזל קשיח: שפת/מע"מ הצעת המחיר הציבורית נגזרים אך ורק מנתוני ההצעה
// השמורים במסד הנתונים (currency / tax_rate) - לעולם לא מ-localStorage או משפת הדפדפן
// של הצופה. כך קישור להצעה מקומית/בינלאומית תמיד יוצג נכון, לכל צופה, בכל דפדפן.
// ==========================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';

export default function SmartPublicQuote() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null); // 'local' | 'international' | 'notfound'

  useEffect(() => {
    let cancelled = false;

    async function determineTemplate() {
      if (!id) {
        if (!cancelled) setTemplate('notfound');
        return;
      }

      const { data, error } = await supabase
        .from('quotes')
        .select('currency, tax_rate')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setTemplate('notfound');
        return;
      }

      const isLocalQuote = Number(data.tax_rate) > 0 || (data.currency || '').toUpperCase() === 'ILS';
      setTemplate(isLocalQuote ? 'local' : 'international');
    }

    determineTemplate();
    return () => { cancelled = true; };
  }, [id]);

  if (template === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  // אם ההצעה לא נמצאה, מציגים את התבנית האנגלית - היא כבר יודעת להציג הודעת "not found" תקנית
  return template === 'local' ? <PublicQuote /> : <PublicQuoteEn />;
}
