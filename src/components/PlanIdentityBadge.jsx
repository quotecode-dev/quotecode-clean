// חוק ברזל (Plan Identity Header Badge → Professional Plan-Identity Icon
// System, Owner-required 2026-09-03, PROFLOW_PROJECT_CONTEXT.md §164):
// רכיב-badge קנוני יחיד לחמש ה-displayIdentity (FREE/FREE_TRIAL/BASIC/PRO/
// LIFETIME) - במקום שכל מסך יבנה תצוגת-badge משלו. קורא אך ורק ל-
// getDisplayIdentityLabel/getDisplayIdentityVisual (planCatalog.js) - לעולם
// לא גוזר תווית/אייקון/צבע בעצמו, כדי שזהות עתידית תתווסף במקום אחד
// (planCatalog.js) ותופיע כאן אוטומטית, ללא שינוי ברכיב הזה.
//
// "מדליון" עגול עם גרדיאנט-הצבע של המשפחה (ולא הטקסט/רקע-הכולל) הוא מה
// שנושא את הזהות המקצועית המבוקשת - קומפקטי בכוונה (20px/18px קוטר) כדי
// שהכותרת תישאר אלגנטית, לא "מדליון-ענק" כמו הרפרנס המקורי. accentIcon
// (כשקיים) הוא badge-משני קטן בפינה - ההבחנה החזותית של FREE_TRIAL מ-FREE
// הרגיל ושל LIFETIME מ-PRO הרגיל לעולם אינה מסתמכת רק על צבע (יש גם הבדל-
// צורה: accentIcon נוכח/נעדר).
//
// variant="header": ל-purple gradient header (Dashboard.jsx) - הפילה עצמה
// (הרקע המרובע-מעוגל שמכיל מדליון+טקסט) נשארת "כמו" ה-badge הקיים
// "SUPER ADMIN" באותו header (רקע/מסגרת לבן-שקוף, טקסט לבן) - כי colorToken
// הקטלוגי היה חסר-ניגודיות ישירות על רקע סגול; אבל המדליון עצמו (חדש) כן
// נושא את צבע-הזהות המלא (גרדיאנט), כי הוא אלמנט-עצמאי עם ניגודיות-לבן-
// פנימית משלו, לא טקסט-על-סגול.
//
// variant="panel": לרקע בהיר/לבן (SettingsTab.jsx וכו') - הפילה עצמה
// משתמשת בצבע-הקטלוג (gradientTo כצבע-טקסט/מסגרת עדין), כי שם יש ניגודיות
// תקינה ישירות.
import {
  Leaf, Gem, Crown, Clock, Infinity as InfinityIcon,
} from 'lucide-react';
import { LIGHT as NEON } from '../theme/neonTheme';
import { getDisplayIdentityLabel, getDisplayIdentityVisual } from '../utils/planCatalog';

const ICON_RENDERERS = {
  Leaf: (size, strokeWidth) => <Leaf size={size} strokeWidth={strokeWidth} />,
  Gem: (size, strokeWidth) => <Gem size={size} strokeWidth={strokeWidth} />,
  Crown: (size, strokeWidth) => <Crown size={size} strokeWidth={strokeWidth} />,
  Clock: (size, strokeWidth) => <Clock size={size} strokeWidth={strokeWidth} />,
  Infinity: (size, strokeWidth) => <InfinityIcon size={size} strokeWidth={strokeWidth} />,
};

function renderIcon(name, size, strokeWidth) {
  const fn = ICON_RENDERERS[name] || ICON_RENDERERS.Leaf;
  return fn(size, strokeWidth);
}

// חוק ברזל (Final Dashboard/Sidebar Polish task, Owner-authorized, §D):
// variant="compact" - הבאדג' הקומפקטי-האופקי החדש לאזור-הברכה הלבן
// (Dashboard.jsx, מחליף את .dash-sidebar-plan-card הגדול שהוסר מהסיידבר).
// עדיין קורא אך ורק ל-getDisplayIdentityLabel/getDisplayIdentityVisual -
// אין כאן שום גזירת-זהות/סטטוס עצמאית. "סטטוס" (Trial/Active/LIFETIME)
// כבר מקודד בתוך ה-label הקנוני עצמו (למשל "FREE (TRIAL)"/"LIFETIME") -
// לא מפורק כאן לשני שדות נפרדים, כי המקור הקנוני עצמו לא מספק פירוק כזה
// (ולפרק אותו כאן לבד היה "להסיק מצב-תוכנית באופן עצמאי", בדיוק מה שהמשימה
// אוסרת). daysLeft (כשקיים) הוא הערך הממשי היחיד שמתווסף - מגיע תמיד
// מ-trialDaysLeft של computeEffectivePlan() הקיים כבר ב-Dashboard.jsx, לעולם
// לא מחושב כאן מחדש. upgradeAvailable מוסיף רמז חזותי בלבד (אייקון כתר קטן)
// כשההורה עתיד לעטוף את זה ב-<button> - הלוגיקה/handler עצמם נשארים
// ב-Dashboard.jsx (showUpgradeCta/setShowPricingModal, ללא שינוי).
export default function PlanIdentityBadge({ displayIdentity, isHebrew, variant = 'header', size = 'md', daysLeft = null, upgradeAvailable = false, singleLine = false }) {
  const label = getDisplayIdentityLabel(displayIdentity, isHebrew);
  const visual = getDisplayIdentityVisual(displayIdentity);

  const medallionSize = size === 'sm' ? 18 : 20;
  const accentSize = size === 'sm' ? 10 : 11;
  const fontSize = size === 'sm' ? '0.65rem' : '0.7rem';

  const isHeader = variant === 'header';

  if (variant === 'compact') {
    // חוק ברזל (Authenticated UI Coherence task, Mobile Dashboard Header
    // Recomposition, Owner mid-task correction): singleLine - וריאנט-
    // תצוגה נוסף בתוך אותו variant="compact" קנוני (לא רכיב-באדג' מקביל
    // חדש) - "PLAN · Nימים" בשורה אחת ("Use a short mobile plan label
    // such as 'FREE · 10 days'"), במקום תווית+שורת-ימים נפרדת. עדיין קורא
    // אך ורק ל-getDisplayIdentityLabel/getDisplayIdentityVisual - אפס
    // גזירת-זהות עצמאית, בדיוק כמו הגרסה הרגילה. מדליון מוקטן (18px, היה
    // 22px) ופדינג מהודק כדי שיתאים לרוחב-מובייל צר בלי לדחוק את הכותרת.
    const compactMedallion = singleLine ? 18 : 22;
    return (
      <span
        title={isHebrew ? `מסלול נוכחי: ${label}` : `Current plan: ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: singleLine ? '6px' : '8px',
          background: `${visual.gradientTo}14`,
          border: `1px solid ${visual.gradientTo}35`,
          borderRadius: '10px',
          padding: singleLine ? '5px 10px' : '6px 12px',
          minHeight: singleLine ? '30px' : '36px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: `${compactMedallion}px`, height: `${compactMedallion}px` }}>
          <span
            style={{
              width: `${compactMedallion}px`,
              height: `${compactMedallion}px`,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${visual.gradientFrom} 0%, ${visual.gradientTo} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55) inset, 0 1px 3px rgba(0,0,0,0.25)',
              flexShrink: 0,
            }}
          >
            {renderIcon(visual.icon, singleLine ? 11 : 13, 2.3)}
          </span>
          {visual.accentIcon && (
            <span
              style={{
                position: 'absolute',
                bottom: '-2px',
                [isHebrew ? 'left' : 'right']: '-2px',
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: visual.gradientTo,
                boxShadow: '0 0 0 1.5px white, 0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              {renderIcon(visual.accentIcon, 7, 3)}
            </span>
          )}
        </span>
        {singleLine ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 800, color: NEON[visual.colorToken] || NEON.textSecondary, whiteSpace: 'nowrap' }}>
            {label}
            {daysLeft != null && daysLeft > 0 && (
              <>
                <span style={{ opacity: 0.6, fontWeight: 600 }}>·</span>
                <span style={{ fontWeight: 700 }}>{isHebrew ? `${daysLeft} ימים` : `${daysLeft}d`}</span>
              </>
            )}
            {upgradeAvailable && <Crown size={10} fill="currentColor" strokeWidth={1} style={{ flexShrink: 0, opacity: 0.85 }} />}
          </span>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: NEON[visual.colorToken] || NEON.textSecondary, whiteSpace: 'nowrap' }}>
              {label}
              {upgradeAvailable && <Crown size={11} fill="currentColor" strokeWidth={1} style={{ flexShrink: 0, opacity: 0.85 }} />}
            </span>
            {daysLeft != null && daysLeft > 0 && (
              <span style={{ fontSize: '0.66rem', fontWeight: 600, color: NEON.textMuted, whiteSpace: 'nowrap' }}>
                {isHebrew ? `${daysLeft} ימים נותרו` : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </span>
            )}
          </span>
        )}
      </span>
    );
  }
  const pillStyle = isHeader
    ? {
        background: 'rgba(255,255,255,0.18)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.35)',
      }
    : {
        background: `${visual.gradientTo}1a`,
        color: NEON[visual.colorToken] || NEON.textSecondary,
        border: `1px solid ${visual.gradientTo}40`,
      };

  // חוק ברזל (§11 - Plan Identity Concept, Owner-approved 2026-09-01):
  // סידור אנכי - אייקון-הזהות ראשי/עליון, שם-המסלול טקסט קטן ישירות
  // מתחתיו (לא עוד "מדליון+טקסט אופקי" הקודם). זה שינוי-פריסה מפורש,
  // לא שינוי-סמנטיקה: displayIdentity/getDisplayIdentityVisual (planCatalog.js)
  // נשארים בדיוק כפי שהם - אותו icon/accentIcon/colorToken/gradient לכל
  // חמש הזהויות, רק צורת-ההצגה כאן משתנה. מיכל-position:relative עדיין
  // רק סביב המדליון עצמו (לא סביב כל הבאדג') כך שה-accentIcon נשאר מוגדר
  // יחסית למדליון, קבוע-מיקום בלי קשר לרוחב תווית-הטקסט מתחתיו.
  return (
    <span
      title={isHebrew ? `מסלול נוכחי: ${label}` : `Current plan: ${label}`}
      style={{
        ...pillStyle,
        fontSize,
        fontWeight: 'bold',
        padding: '6px 10px',
        borderRadius: '12px',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: `${medallionSize}px`, height: `${medallionSize}px` }}>
        <span
          style={{
            width: `${medallionSize}px`,
            height: `${medallionSize}px`,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${visual.gradientFrom} 0%, ${visual.gradientTo} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: `0 0 0 1.5px rgba(255,255,255,0.55) inset, 0 1px 3px rgba(0,0,0,0.25)`,
            flexShrink: 0,
          }}
        >
          {renderIcon(visual.icon, medallionSize === 20 ? 12 : 11, 2.3)}
        </span>
        {visual.accentIcon && (
          <span
            style={{
              position: 'absolute',
              bottom: '-2px',
              [isHebrew ? 'left' : 'right']: '-2px',
              width: `${accentSize}px`,
              height: `${accentSize}px`,
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: visual.gradientTo,
              boxShadow: '0 0 0 1.5px white, 0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {renderIcon(visual.accentIcon, accentSize - 4, 3)}
          </span>
        )}
      </span>
      <span style={{ fontSize, lineHeight: 1 }}>{label}</span>
    </span>
  );
}
