// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AdminUsersTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState } from 'react';
import { supabase } from '../shared/supabase';
import {
  Mail, Building2, CreditCard, Globe, Shield, Infinity as InfinityIcon, Clock, LogIn, SlidersHorizontal, CheckCircle2,
  UserPlus, Activity, Home, Users2, Crown, Gem, Layers, CircleUser, RefreshCw, Trash2, Eye, RotateCw, AlertTriangle,
  Send, XCircle, ChevronDown
} from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import { getPlanDefinition, PLAN_CATALOG } from '../utils/planCatalog';

// חוק ברזל (Admin V2 Foundation — Phase 1.5, Plan Icon/Badge Wiring, Owner-
// authorized): מקור-אמת יחיד לזהות ויזואלית של חבילה - planCatalog.js -
// במקום שרשרת-ternary כפולה ובלתי-תלויה (טבלת-דסקטופ + כרטיסי-מובייל,
// שתיהן באותו קובץ, שתי גרסאות-כמעט-זהות-אך-נפרדות של אותה לוגיקה).
// אין שינוי חזותי מכוון - כל אייקון/צבע/רקע נשאר בדיוק זהה לקודם (מאומת
// ע"י בדיקה חוזרת בדפדפן אחרי השינוי), רק המקור שממנו הם נגזרים השתנה.
// Crown (Lifetime) נשאר case מיוחד מחוץ לקטלוג בכוונה - ר' planCatalog.js -
// Lifetime הוא overlay-תצוגה, לא planId בקטלוג עצמו. שימור-מדויק של ההתנהגות
// ההיסטורית: כש-isGrantedLifetimePro, הצבע/רקע תמיד היו (וממשיכים להיות)
// אלה של PRO ללא תלות ב-planValue בפועל - זו ההתנהגות הקיימת, לא שינוי.
const PLAN_ICON_RENDERERS = {
  Gem: (size) => <Gem size={size} fill="currentColor" strokeWidth={1} />,
  Layers: (size) => <Layers size={size} strokeWidth={2.2} />,
  CircleUser: (size) => <CircleUser size={size} strokeWidth={2.2} />,
};

function getPlanBadgeVisual(planValue, isGrantedLifetimePro) {
  const badge = isGrantedLifetimePro ? PLAN_CATALOG.pro.badge : getPlanDefinition(planValue).badge;
  return {
    bg: badge.bgTint,
    color: NEON[badge.colorToken],
    renderIcon: (size) => isGrantedLifetimePro
      ? <Crown size={size} strokeWidth={2.2} />
      : (PLAN_ICON_RENDERERS[badge.icon] || PLAN_ICON_RENDERERS.CircleUser)(size),
  };
}

// Edge Function errors return the real reason in the response body (e.g. "Cannot delete
// a Super Admin account") - supabase-js's default error.message is just a generic
// "non-2xx status code", so for a destructive admin action we dig out the real message.
async function getFunctionErrorMessage(error, fallback) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch {
    // fall through to the generic message below
  }
  return error?.message || fallback;
}

export default function AdminUsersTab({
  isHebrew,
  allAccounts = [],
  filteredAdminAccounts = [],
  adminSearchTerm = '',
  setAdminSearchTerm,
  handleSort,
  sortField,
  sortDirection,
  liveTick,
  setPendingLifetimeUser,
  handleToggleLifetime,
  setSelectedUserDetails,
  handleOpenNewUsersModal,
  lastSeenNewUsersTime,
  handleExtendTrial14Days
}) {
  const [resetModalUser, setResetModalUser] = useState(null);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // פאנל "אבחון" (בדיקת מיילי תזכורת חי, דרך Resend) - מכווץ כברירת מחדל
  // ומופרד מהממשק הראשי לניהול משתמשים, כדי לא לבלבל בין כלי בדיקה/פיתוח
  // לבין פעולות ניהול אמיתיות. היכולת עצמה (קריאה ל-Edge Function במצב
  // "test") לא השתנתה - רק המיקום שלה בממשק.
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testType, setTestType] = useState('trial');
  const [testStage, setTestStage] = useState('3d');
  const [testStatus, setTestStatus] = useState({ type: null, msg: '' });
  const [sendingTestLang, setSendingTestLang] = useState(null);

  // מזהי המשתמשים שהכרטיס שלהם פתוח (Accordion) בתצוגת המובייל בלבד -
  // כל כרטיס נפתח/נסגר באופן עצמאי, וברירת המחדל היא סגור לכולם כדי
  // שרשימה עם הרבה משתמשים תישאר קומפקטית וניתנת לסריקה מהירה
  const [expandedMobileRows, setExpandedMobileRows] = useState(() => new Set());
  const toggleMobileRow = (id) => {
    setExpandedMobileRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendTestEmail = async (sendHebrew) => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestStatus({ type: 'error', msg: isHebrew ? 'הזן כתובת אימייל תקינה לבדיקה' : 'Enter a valid test email address' });
      return;
    }
    setSendingTestLang(sendHebrew ? 'he' : 'en');
    setTestStatus({ type: null, msg: '' });
    try {
      // הפונקציה בצד השרת מאמתת super_admin לפי ה-JWT של המבקש עצמו (לא לפי
      // שום דבר שנשלח בגוף הבקשה), ולכן חובה שה-Authorization header יכיל
      // access_token עדכני וטרי. קריאה מפורשת ל-getSession (ולא הסתמכות על
      // הצירוף האוטומטי של supabase-js) מבטיחה טוקן רענן וחושפת הודעת שגיאה
      // ברורה אם ההתחברות פגה, במקום כשל עמום מצד ה-Edge Function.
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (sessionErr || !accessToken) {
        throw new Error(isHebrew
          ? 'ההתחברות פגה. אנא רענן את העמוד והתחבר מחדש לפני שליחת מייל בדיקה.'
          : 'Your session has expired. Please refresh the page and log in again before sending a test email.');
      }

      const functionName = testType === 'subscription' ? 'send-subscription-expiration-email' : 'send-trial-expiration-email';
      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          mode: 'test',
          email: testEmail,
          isHebrew: sendHebrew,
          stage: testStage,
          businessName: sendHebrew ? 'עסק לדוגמה' : 'Test Business'
        }
      });

      if (error) throw new Error(await getFunctionErrorMessage(error, isHebrew ? 'שליחת מייל הבדיקה נכשלה' : 'Failed to send test email'));
      if (data?.error) throw new Error(data.error);

      setTestStatus({
        type: 'success',
        msg: isHebrew
          ? `נשלח בהצלחה ל-${testEmail} (${sendHebrew ? 'עברית' : 'אנגלית'}, ${testType === 'subscription' ? 'תפוגת מנוי' : 'תום ניסיון'})`
          : `Sent successfully to ${testEmail} (${sendHebrew ? 'Hebrew' : 'English'}, ${testType === 'subscription' ? 'subscription expiration' : 'trial expiration'})`
      });
    } catch (err) {
      setTestStatus({ type: 'error', msg: err.message });
    } finally {
      setSendingTestLang(null);
    }
  };

  // Super Admin authority is role-based, not part of the managed-user/customer
  // base - excluded here (table + every KPI below) so it can never appear as
  // a "user" to manage or skew counts. Super Admin's own access to this tab
  // and to every admin action is completely unrelated to this list/KPI logic.
  const managedAccounts = Array.isArray(allAccounts) ? allAccounts.filter(a => a?.role !== 'super_admin') : [];

  const activeAccountsList = (filteredAdminAccounts || []).filter(acc => {
    if (!acc) return false;
    if (acc.role === 'super_admin') return false;
    const email = (acc.email || '').toLowerCase();
    const biz = (acc.business_name || '').toLowerCase();
    return !email.startsWith('deleted_') && biz !== 'deleted';
  });

  const totalU = managedAccounts.length;
  const localU = managedAccounts.filter(a => (a?.country || 'Local') === 'Local').length;
  const intlU = managedAccounts.filter(a => a?.country === 'International').length;

  const activeRecent = managedAccounts.filter(a => {
    if (!a?.last_sign_in) return false;
    const now = Date.now();
    const diff = now - new Date(a.last_sign_in).getTime();
    return diff < 10 * 60 * 1000;
  }).length;

  const newUsersList = managedAccounts.filter(a => {
    if (!a?.created_at) return false;
    const now = Date.now();
    const diff = now - new Date(a.created_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  const unreadNewUsersCount = newUsersList.filter(a => {
    if (!a?.created_at) return false;
    return new Date(a.created_at).getTime() > lastSeenNewUsersTime;
  }).length;

  const handleExecuteDataReset = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetError('');
    setIsResetting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('Admin session not found.');

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPasswordInput
      });

      if (authError) {
        setResetError(isHebrew ? 'סיסמת אדמין שגויה!' : 'Incorrect admin password!');
        setIsResetting(false);
        return;
      }

      const targetUserId = resetModalUser.user_id;
      if (targetUserId) {
        // ניקוי עץ ההצעות (quotes/quote_items/quote_attachments) של משתמש אחר
        // חייב לרוץ בצד השרת (Service Role): ה-RLS הרגיל (auth.uid() = user_id)
        // חוסם כל DELETE חוצה-משתמשים מהקליינט הרגיל, ובלי error גלוי - DELETE
        // שמסונן ע"י RLS ל-0 שורות מוחזר כ"הצלחה" (אין error), מה שיצר בעבר
        // הודעת "הצלחה" כוזבת בלי שנמחק בפועל שום דבר. הפונקציה הפריבילגית
        // מאמתת server-side שהקורא הוא super_admin, ומאמתת בפועל (קריאה חוזרת
        // מהמסד, לא רק "אין error") שההצעות אכן נמחקו לפני שהיא מדווחת הצלחה.
        const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-cleanup-user-quotes', {
          body: { targetUserId }
        });

        if (fnError) {
          throw new Error(await getFunctionErrorMessage(fnError, isHebrew ? 'ניקוי ההצעות נכשל.' : 'Failed to clean up quotes.'));
        }
        if (fnData?.error) {
          throw new Error(fnData.error);
        }
      }

      setResetModalUser(null);
      setAdminPasswordInput('');
      setShowSuccessModal(true);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleExecuteUserDelete = async (e) => {
    e.preventDefault();
    if (!deleteModalUser) return;
    setResetError('');
    setIsResetting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('Admin session not found.');

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPasswordInput
      });

      if (authError) {
        setResetError(isHebrew ? 'סיסמת אדמין שגויה!' : 'Incorrect admin password!');
        setIsResetting(false);
        return;
      }

      if (deleteModalUser.role === 'super_admin') {
        throw new Error(isHebrew ? 'לא ניתן למחוק משתמש Super Admin!' : 'Cannot delete Super Admin!');
      }

      const targetUserId = deleteModalUser.user_id;
      if (!targetUserId) {
        throw new Error(isHebrew ? 'לא נמצא מזהה משתמש למחיקה.' : 'No user id found to delete.');
      }

      // מחיקה מלאה חייבת לרוץ בצד השרת (Service Role): כל נתוני העסק + שורת
      // business_settings + חשבון ה-Auth עצמו - כדי שהאימייל יתפנה להרשמה חוזרת.
      // הקליינט (anon key) לעולם לא יכול לגשת ל-supabase.auth.admin.
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-delete-user', {
        body: { targetUserId }
      });

      if (fnError) {
        throw new Error(await getFunctionErrorMessage(fnError, isHebrew ? 'שגיאה במחיקת המשתמש.' : 'Failed to delete user.'));
      }
      if (fnData?.error) {
        throw new Error(fnData.error);
      }

      setDeleteModalUser(null);
      setAdminPasswordInput('');
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Delete error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // חשוב: Lifetime וניסיון פעיל הם היחידים שניתנים להוכחה אמיתית מהנתונים
  // הקיימים. שדה plan הגולמי לבדו, לאחר תום הניסיון, אינו מוכיח תשלום בפועל -
  // אין עדיין חיבור סליקה אמיתי, ולוגיקת ה-effectivePlan של Dashboard.jsx
  // עצמה כבר מתייחסת לחשבון שתם ניסיונו כ-free אלא אם כן הוענק לו Lifetime.
  // לכן, בכוונה, אין כאן יותר ניסוח "מנוי פעיל/בתשלום" עבור תום-ניסיון+plan
  // בתשלום - זה היה ניסוח מטעה. פג תוקף מוצג באופן אחיד לכל מי שאינו Lifetime.
  const getRemainingTimeFormatted = (trialEndsAt, role) => {
    try {
      if (role === 'super_admin') return isHebrew ? 'ללא תפוגה (Lifetime)' : 'No expiry (Lifetime)';
      if (!trialEndsAt) return isHebrew ? 'ללא תפוגה (Lifetime)' : 'No expiry (Lifetime)';

      const diffMs = new Date(trialEndsAt).getTime() - Date.now();
      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
          return isHebrew ? `${days} ימים ו-${hours} שע'` : `${days}d ${hours}h left`;
        }
        return isHebrew ? `${hours} שע'` : `${hours}h left`;
      }

      return isHebrew ? 'פג תוקף' : 'Expired';
    } catch {
      return isHebrew ? 'לא ידוע' : 'N/A';
    }
  };

  const isHebrewText = (str) => /[֐-׿]/.test(str);

  // חוק ברזל (Admin V2 Foundation — Phase 1, תיקון הבאג המאושר, ר' הערה
  // מקבילה ב-UserDetailsModal.jsx לפירוט מלא): הגזירה הישנה כאן טעתה
  // באותה מחלקת-באג - trial_ends_at===null כהוכחת-Lifetime בלבד, וגם
  // planValue הציג rawPlan גולמי (לא effective) עבור ניסיון-שפג. שתי
  // הבעיות מתוקנות עכשיו יחד דרך resolveAccountEntitlement() - נקודת-אמת
  // משותפת עם Dashboard.jsx/SettingsTab.jsx. הצורה המוחזרת נשמרה זהה
  // בכוונה (isSuperAdminUser/isLifetime/rawPlan/planValue/isGrantedLifetimePro)
  // כדי שה-JSX הקיים (טבלת-דסקטופ + כרטיסי-מובייל) לא ידרוש שום שינוי.
  const getAccountDerived = (acc) => {
    const resolved = resolveAccountEntitlement({ plan: acc.plan, trialEndsAt: acc.trial_ends_at, role: acc.role });
    const isSuperAdminUser = resolved.isSuperAdmin;
    const isLifetime = resolved.isLifetime || isSuperAdminUser;
    const rawPlan = resolved.rawPlan;
    // planValue הופך ל-tier המחושב (נכון תמיד), לא ל-rawPlan הגולמי -
    // מתקן את מחלקת-הבאג המלאה, כולל אייקון-החבילה בטבלה/בכרטיסי-המובייל.
    const planValue = resolved.tier;
    const isGrantedLifetimePro = resolved.isLifetime;
    const currentCountry = acc.country || 'Local';
    const isIntl = currentCountry === 'International';

    let isRecentActive = false;
    if (acc.last_sign_in) {
      const now = Date.now();
      const diffMs = now - new Date(acc.last_sign_in).getTime();
      isRecentActive = diffMs < 10 * 60 * 1000;
    }

    const bizName = acc.business_name || 'עסק חדש';
    const isBizHebrew = isHebrewText(bizName);

    const lastSignInDateObj = acc.last_sign_in ? new Date(acc.last_sign_in) : null;
    const lastSignInDateStr = lastSignInDateObj ? lastSignInDateObj.toLocaleDateString('en-GB') : 'N/A';
    const lastSignInFullStr = lastSignInDateObj ? lastSignInDateObj.toLocaleString('en-GB') : 'N/A';

    return {
      isSuperAdminUser, isLifetime, rawPlan, planValue, isGrantedLifetimePro,
      currentCountry, isIntl, isRecentActive, bizName, isBizHebrew,
      lastSignInDateStr, lastSignInFullStr,
    };
  };

  return (
    <div style={{ background: NEON.bgCard, padding: '24px', borderRadius: '16px', border: `1px solid ${NEON.border}`, width: '100%', boxSizing: 'border-box' }} dir={isHebrew ? 'rtl' : 'ltr'}>

      <style>{`
        .admin-table-desktop-wrap { display: block; }
        .admin-mobile-cards { display: none; }
        @media (max-width: 768px) {
          .admin-table-desktop-wrap { display: none; }
          .admin-mobile-cards { display: block; }
        }
      `}</style>

      {showSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: NEON.emerald }}>
              <CheckCircle2 size={28} strokeWidth={2.2} />
            </div>
            <h3 style={{ marginTop: 0, fontSize: '1.2rem', marginBottom: '8px', fontWeight: '800', ...neonGlowTextStyle }}>
              {isHebrew ? 'הפעולה בוצעה בהצלחה!' : 'Action Successful!'}
            </h3>
            <button
              onClick={() => { setShowSuccessModal(false); window.location.reload(); }}
              style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}
            >
              {isHebrew ? 'אישור' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {deleteModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: NEON.red, fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={18} />
              {isHebrew ? 'אזהרה: מחיקת משתמש לצמיתות' : 'Warning: Permanent User Deletion'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
              {isHebrew
                ? `פעולה זו תמחק לחלוטין את הרשומה ${deleteModalUser?.email || 'N/A'} ואת כל נתוניו מהמערכת. נא הקלד את סיסמת ה-Super Admin שלך לאישור:`
                : `This will permanently delete record ${deleteModalUser?.email || 'N/A'}. Enter your Super Admin password to confirm:`}
            </p>

            <form onSubmit={handleExecuteUserDelete} autoComplete="off">
              <input
                type="password"
                name="admin_delete_pwd_unique"
                autoComplete="one-time-code"
                data-lpignore="true"
                data-form-type="other"
                placeholder={isHebrew ? 'סיסמת אדמין...' : 'Admin password...'}
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary }}
                required
              />

              {resetError && (
                <div style={{ color: NEON.red, fontSize: '0.78rem', marginBottom: '10px', fontWeight: 'bold' }}>
                  {resetError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setDeleteModalUser(null); setAdminPasswordInput(''); setResetError(''); }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{ flex: 1, background: NEON.redDark, color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 10px -2px rgba(239, 68, 68, 0.5)' }}
                >
                  {isResetting ? (isHebrew ? 'מוחק...' : 'Deleting...') : (isHebrew ? 'מחק משתמש' : 'Delete User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: NEON.red, fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={18} />
              {isHebrew ? 'אישור אבטחה: איפוס נתוני משתמש' : 'Security Confirmation: Reset User Data'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
              {isHebrew
                ? `פעולה זו תמחק לצמיתות את כל ההצעות והלקוחות של המשתמש: ${resetModalUser?.email || ''}. נא הקלד את סיסמת ה-Super Admin שלך לאישור:`
                : `This will permanently delete all quotes and clients for: ${resetModalUser?.email || ''}. Please enter your Super Admin password to confirm:`}
            </p>

            <form onSubmit={handleExecuteDataReset} autoComplete="off">
              <input
                type="password"
                name="admin_reset_pwd_unique"
                autoComplete="one-time-code"
                data-lpignore="true"
                data-form-type="other"
                placeholder={isHebrew ? 'סיסמת אדמין...' : 'Admin password...'}
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary }}
                required
              />

              {resetError && (
                <div style={{ color: NEON.red, fontSize: '0.78rem', marginBottom: '10px', fontWeight: 'bold' }}>
                  {resetError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setResetModalUser(null); setAdminPasswordInput(''); setResetError(''); }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{ flex: 1, background: NEON.redDark, color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 10px -2px rgba(239, 68, 68, 0.5)' }}
                >
                  {isResetting ? (isHebrew ? 'מאפס...' : 'Resetting...') : (isHebrew ? 'אשר מחיקה סופית' : 'Confirm Deletion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Module title bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(124,58,237,0.10)', color: NEON.violet, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={19} strokeWidth={2.2} />
        </span>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: NEON.textPrimary }}>
          {isHebrew ? 'ניהול משתמשים ועסקים' : 'User & Business Management'}
        </h2>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div onClick={() => handleOpenNewUsersModal(newUsersList)} style={{ background: NEON.bgElevated, padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={12} strokeWidth={2.2} />
          </span>
          <div style={{ fontSize: '0.58rem', color: NEON.violetLight, fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'משתמשים חדשים (24 ש\')' : 'NEW USERS (24H)'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: NEON.violetLight }}>{unreadNewUsersCount}</div>
        </div>
        <div style={{ background: NEON.bgElevated, padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: NEON.emerald, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={12} strokeWidth={2.2} />
          </span>
          <div style={{ fontSize: '0.58rem', color: NEON.emerald, fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'פעילים (10 ד\')' : 'ACTIVE (10M)'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: NEON.emerald }}>{activeRecent} <span style={{display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', verticalAlign: 'middle'}}/></div>
        </div>
        <div style={{ background: NEON.bgElevated, padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: NEON.textSecondary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Home size={12} strokeWidth={2.2} />
          </span>
          <div style={{ fontSize: '0.58rem', color: NEON.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'מקומי (LCL)' : 'LOCAL (LCL)'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: NEON.textPrimary }}>{localU}</div>
        </div>
        <div style={{ background: NEON.bgElevated, padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={12} strokeWidth={2.2} />
          </span>
          <div style={{ fontSize: '0.58rem', color: NEON.red, fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'בינלאומי' : 'INTERNATIONAL'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: NEON.red }}>{intlU}</div>
        </div>
        <div style={{ background: NEON.bgElevated, padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: NEON.sky, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users2 size={12} strokeWidth={2.2} />
          </span>
          <div style={{ fontSize: '0.58rem', color: NEON.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'סה"כ משתמשים' : 'TOTAL USERS'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: NEON.textPrimary }}>{totalU}</div>
        </div>
      </div>

      {/* Diagnostics - collapsed by default. Live email-test capability, moved out
          of the primary user-management flow (see redesign spec). Functionally
          unchanged from before - only its position/visibility changed. */}
      <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setDiagnosticsOpen(o => !o)}
          style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: NEON.textSecondary }}>
            <Send size={14} color={NEON.violetLight} strokeWidth={2.2} />
            {isHebrew ? 'אבחון: בדיקת מיילי תזכורת תפוגה' : 'Diagnostics: Test Expiration Reminder Emails'}
          </span>
          <ChevronDown size={16} color={NEON.textMuted} style={{ transition: 'transform 0.2s ease', transform: diagnosticsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {diagnosticsOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            <p style={{ fontSize: '0.72rem', color: NEON.textMuted, marginTop: 0, marginBottom: '10px' }}>
              {isHebrew
                ? 'שולח מייל אמיתי (דרך Resend) במצב בדיקה בלבד - אינו נוגע בדגלי תזכורת אוטומטיים ואינו משפיע על התזמון היומי.'
                : 'Sends a real email (via Resend) in test mode only - never touches automatic reminder flags and has no effect on the daily schedule.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="email"
                placeholder={isHebrew ? 'כתובת מייל לבדיקה' : 'Test recipient email'}
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                style={{ flex: '1 1 220px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left' }}
              />
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                style={{ padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }}
              >
                <option value="trial">{isHebrew ? 'תום תקופת ניסיון' : 'Trial Expiration'}</option>
                <option value="subscription">{isHebrew ? 'תפוגת מנוי בתשלום' : 'Subscription Expiration'}</option>
              </select>
              <select
                value={testStage}
                onChange={(e) => setTestStage(e.target.value)}
                style={{ padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }}
              >
                <option value="3d">{isHebrew ? '3 ימים לפני' : '3 days before'}</option>
                <option value="24h">{isHebrew ? '24 שעות לפני' : '24 hours before'}</option>
              </select>
              <button
                type="button"
                onClick={() => handleSendTestEmail(true)}
                disabled={sendingTestLang !== null}
                style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: '1px solid rgba(167, 139, 250, 0.4)', padding: '7px 12px', borderRadius: '8px', fontWeight: '600', fontSize: '0.78rem', cursor: sendingTestLang ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Send size={12} strokeWidth={2.5} />
                {sendingTestLang === 'he' ? (isHebrew ? 'שולח...' : 'Sending...') : (isHebrew ? 'שלח בעברית' : 'Send Hebrew Test')}
              </button>
              <button
                type="button"
                onClick={() => handleSendTestEmail(false)}
                disabled={sendingTestLang !== null}
                style={{ background: 'rgba(56, 189, 248, 0.15)', color: NEON.sky, border: '1px solid rgba(56, 189, 248, 0.4)', padding: '7px 12px', borderRadius: '8px', fontWeight: '600', fontSize: '0.78rem', cursor: sendingTestLang ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Send size={12} strokeWidth={2.5} />
                {sendingTestLang === 'en' ? (isHebrew ? 'שולח...' : 'Sending...') : (isHebrew ? 'שלח באנגלית' : 'Send English Test')}
              </button>
            </div>
            {testStatus.msg && (
              <div style={{ marginTop: '8px', fontSize: '0.78rem', fontWeight: '600', color: testStatus.type === 'success' ? NEON.emerald : NEON.red, display: 'flex', alignItems: 'center', gap: '5px' }}>
                {testStatus.type === 'success' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {testStatus.msg}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input
          type="text"
          placeholder={isHebrew ? 'חיפוש משתמש (אימייל או שם עסק)...' : 'Search user (email or business)...'}
          value={adminSearchTerm}
          onChange={(e) => setAdminSearchTerm(e.target.value)}
          style={{ padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', width: '240px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary, outline: 'none' }}
        />
      </div>

      {/* Desktop table - hidden below 768px in favor of the mobile card list further down */}
      <div className="admin-table-desktop-wrap" style={{ background: NEON.bgElevated, borderRadius: '12px', border: `1px solid ${NEON.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', verticalAlign: 'middle' }}>
              <th style={{ padding: '10px 6px', width: '21%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('email')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Mail size={12} color="#4f46e5" />
                  <span>{isHebrew ? 'אימייל' : 'Email'}</span>
                  {sortField === 'email' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '15%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('business_name')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Building2 size={12} color="#0ea5e9" />
                  <span>{isHebrew ? 'עסק' : 'Business'}</span>
                  {sortField === 'business_name' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '7%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('plan')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <CreditCard size={12} color="#7c3aed" />
                  <span>{isHebrew ? 'חבילה' : 'Plan'}</span>
                  {sortField === 'plan' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '7%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('country')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Globe size={12} color="#10b981" />
                  <span>{isHebrew ? 'אזור' : 'Region'}</span>
                  {sortField === 'country' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '7%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('role')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Shield size={12} color="#991b1b" />
                  <span>{isHebrew ? 'הרשאה' : 'Role'}</span>
                  {sortField === 'role' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '11%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('trial_ends_at_status')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <InfinityIcon size={12} color="#7c3aed" />
                  <span>Lifetime</span>
                  {sortField === 'trial_ends_at_status' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '14%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('trial_extension')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Clock size={12} color="#0284c7" />
                  <span>{isHebrew ? 'הארכת ניסיון' : 'Trial Ext'}</span>
                  {sortField === 'trial_extension' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '10%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('last_sign_in')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <LogIn size={12} color="#22c55e" />
                  <span>{isHebrew ? 'כניסה אחרונה' : 'Last Sign In'}</span>
                  {sortField === 'last_sign_in' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', textAlign: 'center', width: '8%', verticalAlign: 'middle' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <SlidersHorizontal size={12} color="#475569" />
                  <span>{isHebrew ? 'פעולות' : 'Actions'}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(activeAccountsList) || activeAccountsList.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.8rem' }}>
                  {isHebrew ? 'לא נמצאו משתמשים התואמים לחיפוש.' : 'No users found matching your search.'}
                </td>
              </tr>
            ) : (
              activeAccountsList.map(acc => {
                if (!acc) return null;
                const {
                  isSuperAdminUser, isLifetime, planValue, isGrantedLifetimePro,
                  currentCountry, isIntl, isRecentActive, bizName, isBizHebrew,
                  lastSignInDateStr, lastSignInFullStr,
                } = getAccountDerived(acc);
                const planBadge = getPlanBadgeVisual(planValue, isGrantedLifetimePro);

                return (
                  <tr key={(acc.id || 'acc') + '_' + liveTick} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.78rem', height: '46px' }}>

                    {/* Email */}
                    <td style={{ padding: '6px 6px', fontWeight: '500', color: NEON.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={acc.email || ''}>
                      {acc.email || 'N/A'}
                    </td>

                    {/* Business Name */}
                    <td
                      style={{ padding: '6px 6px', color: NEON.textSecondary, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: isBizHebrew ? 'rtl' : 'ltr', textAlign: isBizHebrew ? 'right' : 'left' }}
                      title={bizName}
                    >
                      {bizName}
                    </td>

                    {/* Plan Icon */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: planBadge.bg, color: planBadge.color }}
                        title={isHebrew
                          ? `חבילה: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (גישת Lifetime)' : ''}`
                          : `Plan: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (Lifetime Access)' : ''}`}
                      >
                        {planBadge.renderIcon(12)}
                      </span>
                    </td>

                    {/* Region Icon - read-only: the region is a binding tax rule (18%
                        VAT local / 0% global) determined automatically at signup from
                        the business's detected locale. It cannot be toggled from here
                        on purpose, so currency/VAT can never drift out of sync with it. */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isIntl ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: isIntl ? NEON.red : NEON.emerald, cursor: 'default' }}
                        title={isHebrew ? `אזור: ${currentCountry} (${isIntl ? '0%' : '18%'} מע"מ - נקבע אוטומטית ולא ניתן לשינוי)` : `Region: ${currentCountry} (${isIntl ? '0%' : '18%'} VAT - set automatically, cannot be changed)`}
                      >
                        {isIntl ? <Globe size={12} strokeWidth={2.2} /> : <Home size={12} strokeWidth={2.2} />}
                      </span>
                    </td>

                    {/* Role Icon */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isSuperAdminUser ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.08)', color: isSuperAdminUser ? NEON.red : NEON.textSecondary }}
                        title={isHebrew ? `הרשאה: ${acc.role || 'user'}` : `Role: ${acc.role || 'user'}`}
                      >
                        {isSuperAdminUser ? <Shield size={12} strokeWidth={2.2} /> : <CircleUser size={12} strokeWidth={2.2} />}
                      </span>
                    </td>

                    {/* Lifetime Status Column */}
                    <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => {
                            if (!isLifetime) {
                              setPendingLifetimeUser(acc);
                            } else {
                              handleToggleLifetime(acc.id, acc.trial_ends_at);
                            }
                          }}
                          style={{
                            background: isLifetime ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.04)',
                            color: isLifetime ? NEON.violetLight : NEON.textMuted,
                            border: '1px solid',
                            borderColor: isLifetime ? 'rgba(167, 139, 250, 0.4)' : NEON.borderStrong,
                            width: '24px', height: '24px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={isHebrew
                            ? (isLifetime ? 'Lifetime מופעל (לחץ לביטול)' : 'הפעל Lifetime')
                            : (isLifetime ? 'Lifetime Enabled (Click to Revoke)' : 'Enable Lifetime')}
                        >
                          <InfinityIcon size={11} strokeWidth={2.5} />
                        </button>
                        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: isLifetime ? NEON.violetLight : NEON.textSecondary }}>
                          {isLifetime ? 'Lifetime' : (isHebrew ? 'רגיל' : 'Standard')}
                        </span>
                      </div>
                    </td>

                    {/* Trial Extension Column - Lifetime always wins the display here.
                        Everyone else (regardless of the raw `plan` field) sees their real
                        trial_ends_at date and status - "Expired" once it has passed, since
                        the stored plan value alone is not proof of active paid access (see
                        getRemainingTimeFormatted). */}
                    <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isLifetime ? (
                          <span style={{ fontSize: '0.62rem', color: NEON.textSecondary, whiteSpace: 'nowrap' }}>
                            {isHebrew ? 'ללא תפוגה' : 'No expiry'}
                          </span>
                        ) : (
                          <>
                            {!isSuperAdminUser && (
                              <button
                                onClick={() => {
                                  if (handleExtendTrial14Days) handleExtendTrial14Days(acc.id);
                                }}
                                style={{
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: NEON.sky,
                                  border: '1px solid rgba(56, 189, 248, 0.35)',
                                  width: '24px', height: '24px',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={isHebrew ? 'הארך ניסיון ב-14 יום' : 'Extend Trial by 14 Days'}
                              >
                                <RotateCw size={11} strokeWidth={2.5} />
                              </button>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                              <span style={{ fontSize: '0.62rem', color: NEON.textSecondary, whiteSpace: 'nowrap' }}>
                                {acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A'}
                              </span>
                              <span style={{ fontSize: '0.55rem', color: NEON.sky, fontWeight: 'bold' }}>
                                {getRemainingTimeFormatted(acc.trial_ends_at, acc.role)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Last Sign In (Date only with full timestamp on hover) */}
                    <td style={{ padding: '6px 6px', fontSize: '0.7rem', color: NEON.textSecondary, direction: 'ltr', textAlign: 'left', whiteSpace: 'nowrap' }} title={lastSignInFullStr}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isRecentActive ? '#22c55e' : '#ef4444', marginRight: '4px', verticalAlign: 'middle' }}></span>
                      <span>{lastSignInDateStr}</span>
                    </td>

                    {/* Actions Column */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }}>

                        <button
                          onClick={() => setSelectedUserDetails(acc)}
                          style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: 'none', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title={isHebrew ? 'צפה בפרטים' : 'View Details'}
                        >
                          <Eye size={11} strokeWidth={2.5} />
                        </button>

                        <button
                          onClick={() => setResetModalUser(acc)}
                          style={{ background: 'rgba(239, 68, 68, 0.12)', color: NEON.red, border: '1px solid rgba(248, 113, 113, 0.4)', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title={isHebrew ? 'איפוס נתונים' : 'Reset Data'}
                        >
                          <RefreshCw size={11} strokeWidth={2.5} />
                        </button>

                        {!isSuperAdminUser && (
                          <button
                            onClick={() => setDeleteModalUser(acc)}
                            style={{ background: NEON.redDark, color: 'white', border: 'none', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title={isHebrew ? 'מחק משתמש' : 'Delete User'}
                          >
                            <Trash2 size={11} strokeWidth={2.5} />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list - shown only below 768px (see .admin-mobile-cards media query
          above). Built as a collapsible accordion so a long user list stays compact and
          scannable: each row shows only identity + last-sign-in by default, and expands
          on tap to reveal badges/lifetime/trial/actions - keeps things scalable instead
          of rendering every user's full detail block on screen at once. */}
      <div className="admin-mobile-cards">
        {!Array.isArray(activeAccountsList) || activeAccountsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.8rem', background: NEON.bgElevated, borderRadius: '12px', border: `1px solid ${NEON.border}` }}>
            {isHebrew ? 'לא נמצאו משתמשים התואמים לחיפוש.' : 'No users found matching your search.'}
          </div>
        ) : (
          activeAccountsList.map(acc => {
            if (!acc) return null;
            const {
              isSuperAdminUser, isLifetime, planValue, isGrantedLifetimePro,
              currentCountry, isIntl, isRecentActive, bizName, isBizHebrew,
              lastSignInDateStr, lastSignInFullStr,
            } = getAccountDerived(acc);
            const planBadge = getPlanBadgeVisual(planValue, isGrantedLifetimePro);

            const isExpanded = expandedMobileRows.has(acc.id);

            const chipStyle = (bg, color) => ({
              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px',
              borderRadius: '7px', fontSize: '0.68rem', fontWeight: '700', background: bg, color,
              whiteSpace: 'nowrap',
            });
            const actionBtnStyle = (bg, color, border) => ({
              background: bg, color, border: border || 'none', flex: '1 1 auto', minWidth: '84px',
              padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '600',
            });

            return (
              <div key={(acc.id || 'acc') + '_mobile_' + liveTick} style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '10px' }}>

                {/* Collapsed row: last-sign-in, business name (primary) / email (secondary), chevron */}
                <div
                  onClick={() => toggleMobileRow(acc.id)}
                  role="button"
                  aria-expanded={isExpanded}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, fontSize: '0.68rem', color: NEON.textSecondary, whiteSpace: 'nowrap' }} title={lastSignInFullStr}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isRecentActive ? '#22c55e' : '#ef4444' }} />
                    {lastSignInDateStr}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: isBizHebrew ? 'rtl' : 'ltr', textAlign: isBizHebrew ? 'right' : 'left' }}>
                      {bizName}
                    </div>
                    <div style={{ color: NEON.textMuted, fontSize: '0.75rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: isBizHebrew ? 'right' : 'left' }} title={acc.email || ''}>
                      {acc.email || 'N/A'}
                    </div>
                  </div>

                  <ChevronDown
                    size={18}
                    color={NEON.textMuted}
                    style={{ flexShrink: 0, transition: 'transform 0.25s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </div>

                {/* Expanded content: badges / lifetime / trial / actions */}
                <div
                  style={{
                    maxHeight: isExpanded ? '700px' : '0px',
                    opacity: isExpanded ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.25s ease, margin-top 0.3s ease',
                    marginTop: isExpanded ? '12px' : '0px',
                  }}
                >
                {/* Plan / Region / Role badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  <span
                    style={chipStyle(planBadge.bg, planBadge.color)}
                    title={isHebrew ? `חבילה: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (גישת Lifetime)' : ''}` : `Plan: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (Lifetime Access)' : ''}`}
                  >
                    {planBadge.renderIcon(12)}
                    {planValue.toUpperCase()}
                  </span>

                  <span
                    style={chipStyle(isIntl ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', isIntl ? NEON.red : NEON.emerald)}
                    title={isHebrew ? `אזור: ${currentCountry} (${isIntl ? '0%' : '18%'} מע"מ - נקבע אוטומטית ולא ניתן לשינוי)` : `Region: ${currentCountry} (${isIntl ? '0%' : '18%'} VAT - automatic, cannot be changed)`}
                  >
                    {isIntl ? <Globe size={12} strokeWidth={2.2} /> : <Home size={12} strokeWidth={2.2} />}
                    {currentCountry} · {isIntl ? '0%' : '18%'}
                  </span>

                  <span
                    style={chipStyle(isSuperAdminUser ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.08)', isSuperAdminUser ? NEON.red : NEON.textSecondary)}
                    title={isHebrew ? `הרשאה: ${acc.role || 'user'}` : `Role: ${acc.role || 'user'}`}
                  >
                    {isSuperAdminUser ? <Shield size={12} strokeWidth={2.2} /> : <CircleUser size={12} strokeWidth={2.2} />}
                    {acc.role || 'user'}
                  </span>
                </div>

                {/* Lifetime + Trial */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${NEON.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (!isLifetime) setPendingLifetimeUser(acc);
                        else handleToggleLifetime(acc.id, acc.trial_ends_at);
                      }}
                      style={{
                        background: isLifetime ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.04)',
                        color: isLifetime ? NEON.violetLight : NEON.textMuted,
                        border: '1px solid', borderColor: isLifetime ? 'rgba(167, 139, 250, 0.4)' : NEON.borderStrong,
                        width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title={isHebrew ? (isLifetime ? 'Lifetime מופעל (לחץ לביטול)' : 'הפעל Lifetime') : (isLifetime ? 'Lifetime Enabled (Click to Revoke)' : 'Enable Lifetime')}
                    >
                      <InfinityIcon size={13} strokeWidth={2.5} />
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isLifetime ? NEON.violetLight : NEON.textSecondary }}>
                      {isLifetime ? 'Lifetime' : (isHebrew ? 'רגיל' : 'Standard')}
                    </span>
                  </div>

                  {isLifetime ? (
                    <span style={{ fontSize: '0.72rem', color: NEON.textSecondary }}>
                      {isHebrew ? 'ללא תפוגה' : 'No expiry'}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {!isSuperAdminUser && (
                        <button
                          onClick={() => { if (handleExtendTrial14Days) handleExtendTrial14Days(acc.id); }}
                          style={{ background: 'rgba(56, 189, 248, 0.15)', color: NEON.sky, border: '1px solid rgba(56, 189, 248, 0.35)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title={isHebrew ? 'הארך ניסיון ב-14 יום' : 'Extend Trial by 14 Days'}
                        >
                          <RotateCw size={13} strokeWidth={2.5} />
                        </button>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                        <span style={{ fontSize: '0.72rem', color: NEON.textSecondary }}>
                          {acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A'}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: NEON.sky, fontWeight: 'bold' }}>
                          {getRemainingTimeFormatted(acc.trial_ends_at, acc.role)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button onClick={() => setSelectedUserDetails(acc)} style={actionBtnStyle('rgba(139, 92, 246, 0.15)', NEON.violetLight)}>
                    <Eye size={13} strokeWidth={2.5} />
                    {isHebrew ? 'פרטים' : 'Details'}
                  </button>

                  <button onClick={() => setResetModalUser(acc)} style={actionBtnStyle('rgba(239, 68, 68, 0.12)', NEON.red, '1px solid rgba(248, 113, 113, 0.4)')}>
                    <RefreshCw size={13} strokeWidth={2.5} />
                    {isHebrew ? 'איפוס' : 'Reset'}
                  </button>

                  {!isSuperAdminUser && (
                    <button onClick={() => setDeleteModalUser(acc)} style={actionBtnStyle(NEON.redDark, 'white')}>
                      <Trash2 size={13} strokeWidth={2.5} />
                      {isHebrew ? 'מחק' : 'Delete'}
                    </button>
                  )}
                </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
