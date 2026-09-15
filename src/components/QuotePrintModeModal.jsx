import { FileDown, LayoutList, X } from 'lucide-react';
import { LIGHT } from '../theme/neonTheme';

// חוק ברזל (Public Quote Redesign, Section C - Print/PDF as first-class
// output): Compact vs Expanded is chosen HERE, at print/PDF-generation
// time, via ephemeral local state on the calling page (printMode) - it
// never mutates quote.items/quote_item_measurements or the on-screen
// expandedProItems disclosure state. "Download PDF" and "Print" both route
// through this same chooser and the same window.print() call: the
// browser's native print-to-PDF ("Save as PDF" destination in the print
// dialog) is genuine, functional PDF output - not a fake/disabled button -
// while guaranteeing correct RTL Hebrew text, real selectable text, and
// accurate A4 pagination, which an image-based html2canvas/jsPDF export
// cannot reliably guarantee for a financial/legal document. Shared between
// PublicQuote.jsx (HE) and PublicQuoteEn.jsx (EN) so the two files can
// never drift on this behavior.
// חוק ברזל (Smart Quote End-to-End Structural Unification task, Locked
// Decision 12): להצעה מחולקת יש משמעות שונה-לגמרי ל-Compact/Expanded
// (יחידות-בלבד מול פירוט-מלא-לפי-יחידה) מאשר להצעה רגילה (פירוט-מידות
// מכווץ/מורחב לכל פריט) - isDivided (אופציונלי, ברירת-מחדל false לשמירת
// התנהגות-ברירת-המחדל הקיימת לכל קורא ישן) בוחר את הניסוח הנכון, בלי
// מודל/כפתורים כפולים.
export default function QuotePrintModeModal({ open, isHebrew, intent, isDivided = false, onClose, onChoose }) {
  if (!open) return null;

  const title = intent === 'pdf'
    ? (isHebrew ? 'הורדת PDF' : 'Download PDF')
    : (isHebrew ? 'הדפסת מסמך' : 'Print document');

  const compactDesc = isDivided
    ? (isHebrew ? 'שם כל יחידה וסה"כ שלה בלבד - ללא פירוט פריטים' : 'Each unit\'s name and total only - no item breakdown')
    : (isHebrew ? 'שורות פריטים וסיכום בלבד - ללא פירוט מידות מורחב' : 'Item lines and totals only - no expanded measurement detail');
  const expandedDesc = isDivided
    ? (isHebrew ? 'כל יחידה עם כל הפריטים, המידות והמפרט שלה, וסכום-ביניים ליחידה' : 'Every unit with its full items, measurements & specifications, and its own subtotal')
    : (isHebrew ? 'כולל פירוט מידות ומפרט מלא לכל פריט מקצועי' : 'Includes full measurements & specifications for every professional item');

  return (
    <div
      className="no-print"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', boxSizing: 'border-box' }}
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      <div style={{ background: 'white', padding: '22px', borderRadius: '14px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', boxSizing: 'border-box' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label={isHebrew ? 'סגור' : 'Close'}
          style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
        >
          <X size={16} strokeWidth={2.4} />
        </button>

        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: '800' }}>{title}</h4>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#64748b' }}>
          {isHebrew ? 'בחרו את רמת הפירוט למסמך:' : 'Choose how much detail to include:'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => onChoose('compact')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', textAlign: isHebrew ? 'right' : 'left' }}
          >
            <LayoutList size={18} color={LIGHT.violet} strokeWidth={2} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#1e293b' }}>{isHebrew ? 'תמציתי' : 'Compact'}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{compactDesc}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('expanded')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', textAlign: isHebrew ? 'right' : 'left' }}
          >
            <FileDown size={18} color={LIGHT.violet} strokeWidth={2} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#1e293b' }}>{isHebrew ? 'מורחב' : 'Expanded'}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{expandedDesc}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
