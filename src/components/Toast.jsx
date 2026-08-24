import { useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

// התראה קטנה, לא-חוסמת, שנעלמת מעצמה - מיועדת להודעות הצלחה/שגיאה קצרות
// בהקשרים בהירים (עמוד הצעת מחיר ציבורי, PricingModal) שאינם שייכים
// לעיצוב הכהה (NEON) של האפליקציה המאומתת. אינה מחליפה מודאל שדורש
// אישור מפורש - זו בכוונה לא-חוסמת ונעלמת מעצמה אחרי durationMs.
export default function Toast({ toast, onDismiss, isHebrew, durationMs = 4000 }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const bg = isError ? '#fef2f2' : '#f0fdf4';
  const border = isError ? '#fecaca' : '#bbf7d0';
  const color = isError ? '#b91c1c' : '#166534';
  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <div
      role="status"
      aria-live="polite"
      dir={isHebrew ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: '10px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.85rem',
        fontWeight: '600',
        boxShadow: '0 10px 24px -8px rgba(0,0,0,0.2)',
        zIndex: 10001,
        maxWidth: '90vw',
        textAlign: isHebrew ? 'right' : 'left',
      }}
    >
      <Icon size={16} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      <span>{toast.message}</span>
    </div>
  );
}
