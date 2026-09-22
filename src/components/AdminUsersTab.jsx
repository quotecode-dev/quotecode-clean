// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AdminUsersTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState } from 'react';
import { publishBlocker, resolveBlockers } from '../utils/aiHelpBlockers';
import { supabase } from '../shared/supabase';
import { ShieldCheck, CheckCircle2, AlertTriangle, Send, XCircle, ChevronDown } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import { getFunctionErrorMessage } from '../utils/functionError';
import AdminUsersView from './AdminUsersView';
import { formatShortDateTime } from '../utils/shortDate';

export default function AdminUsersTab({
  isHebrew,
  allAccounts = [],
  filteredAdminAccounts = [],
  adminSearchTerm = '',
  setAdminSearchTerm,
  handleSort,
  sortField,
  sortDirection,
  onOpenUserDetails,
}) {
  const [resetModalUser, setResetModalUser] = useState(null);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [lifetimeActionUser, setLifetimeActionUser] = useState(null);
  const [trialActionUser, setTrialActionUser] = useState(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminReasonInput, setAdminReasonInput] = useState('');
  // TEKANGO Admin V1 (Task 3.5): typed target confirmation for Delete
  // Account specifically - the one irreversible action here, so it gets
  // one extra safety layer beyond reason+password+re-auth: the admin must
  // type the target's own exact email before the submit button enables.
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
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

  // TEKANGO Admin V1 (Task 2): the KPI/table markup that consumed
  // totalU/localU/intlU/activeRecent/newUsersList/unreadNewUsersCount/
  // activeAccountsList was removed below (replaced by AdminUsersView, with
  // KPIs now owned by the shared Header/AdminOverview) - those derived
  // values (including a last-sign-in-recency "active now" count the
  // Owner's rule forbids outright) are removed with it, not left as dead
  // code that still computed a forbidden signal.

  // TEKANGO Admin V1 (Task 3.1/3.2, binding rule): "SENSITIVE ADMIN
  // ACTIONS: RE-AUTH REQUIRED... A client-side password dialog alone is
  // NOT sufficient." Every protected action below now goes through this
  // one shared two-step flow instead of the prior client-only
  // signInWithPassword-then-write pattern:
  //   1. admin-reauth-verify: the password is checked SERVER-SIDE (never
  //      just client-side), and mints a short-lived (5 min), single-use
  //      proof row bound to this exact actor+action+target+{reason}.
  //   2. the actual privileged Edge Function (admin-set-lifetime/
  //      admin-extend-trial/admin-delete-user/admin-cleanup-user-quotes)
  //      atomically claims that proof before doing anything else, then
  //      performs the write, reads back the authoritative new state, and
  //      writes an admin_audit_log row - see _shared/adminReauth.ts.
  // A stale/replayed/mismatched proof is refused by the second call even
  // if somehow forged/guessed - claiming is atomic and one-shot.
  async function runProtectedAction({ action, targetUserId, reason, functionName, extraBody = {} }) {
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('admin-reauth-verify', {
      body: { action, targetUserId, params: { reason }, password: adminPasswordInput },
    });
    if (verifyError || !verifyData?.success || !verifyData?.proofToken) {
      // AI HELP V4 §5: the protected-action owner publishes the typed blocker (never the server text); resolved on the next success
      publishBlocker('ADMIN_PROTECTED_ACTION', { scope: 'surface', surface: 'admin_clients' });
    }
    if (verifyError) {
      throw new Error(await getFunctionErrorMessage(verifyError, isHebrew ? 'אימות הסיסמה נכשל.' : 'Password verification failed.'));
    }
    if (!verifyData?.success || !verifyData?.proofToken) {
      throw new Error(verifyData?.error || (isHebrew ? 'סיסמת אדמין שגויה!' : 'Incorrect admin password!'));
    }

    const { data: actionData, error: actionError } = await supabase.functions.invoke(functionName, {
      body: { targetUserId, proofToken: verifyData.proofToken, reason, ...extraBody },
    });
    if (actionError) {
      throw new Error(await getFunctionErrorMessage(actionError, isHebrew ? 'הפעולה נכשלה.' : 'Action failed.'));
    }
    if (!actionData?.success) {
      throw new Error(actionData?.error || (isHebrew ? 'הפעולה נכשלה.' : 'Action failed.'));
    }
    resolveBlockers(['ADMIN_PROTECTED_ACTION']);
    return actionData;
  }

  function validateReasonAndTarget(targetUserId) {
    if (!targetUserId) {
      throw new Error(isHebrew ? 'לא נמצא מזהה משתמש.' : 'No user id found.');
    }
    if (!adminReasonInput.trim()) {
      throw new Error(isHebrew ? 'יש להזין סיבה לפעולה זו.' : 'A reason is required for this action.');
    }
  }

  const handleExecuteDataReset = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetError('');
    setIsResetting(true);
    try {
      const targetUserId = resetModalUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({ action: 'reset_quotes', targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-cleanup-user-quotes' });
      setResetModalUser(null);
      setAdminPasswordInput('');
      setAdminReasonInput('');
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
      // PRODUCT_TRUTH_CAPABILITY: admin_console
      if (deleteModalUser.role === 'super_admin') {
        throw new Error(isHebrew ? 'לא ניתן למחוק משתמש Super Admin!' : 'Cannot delete Super Admin!');
      }
      const targetUserId = deleteModalUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({ action: 'delete_user', targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-delete-user' });
      setDeleteModalUser(null);
      setAdminPasswordInput('');
      setAdminReasonInput('');
      setDeleteConfirmInput('');
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Delete error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08, Owner
  // mandate: "No single-click Lifetime toggle... Grant Lifetime must
  // explicitly write the new Lifetime state. Revoke Lifetime must
  // explicitly clear Lifetime state."). Writes only is_lifetime (explicit
  // column, migration 20260908000000) - plan/trial_ends_at untouched.
  // Backend (admin-set-lifetime) does its own authoritative read-back
  // after the write, on top of the guard_business_settings_plan_trial()
  // trigger's own independent server-side role re-verification.
  const handleExecuteLifetimeAction = async (e) => {
    e.preventDefault();
    if (!lifetimeActionUser) return;
    setResetError('');
    setIsResetting(true);
    const nextIsLifetime = !(lifetimeActionUser.is_lifetime === true);
    try {
      const targetUserId = lifetimeActionUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({
        action: nextIsLifetime ? 'grant_lifetime' : 'revoke_lifetime',
        targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-set-lifetime', extraBody: { grant: nextIsLifetime },
      });
      setLifetimeActionUser(null);
      setAdminPasswordInput('');
      setAdminReasonInput('');
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Lifetime action error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // TEKANGO Admin V1 (Task 3.4): Extend Trial by 14 days. The prior
  // implementation (Dashboard.jsx's own handleExtendTrial14Days) had NO
  // re-auth at all - a real gap versus Reset/Delete/Lifetime, closed here
  // by routing it through the exact same protected-action flow. Backend
  // (admin-extend-trial) independently re-enforces the "expired or no
  // active trial only" eligibility rule server-side.
  const handleExecuteTrialExtension = async (e) => {
    e.preventDefault();
    if (!trialActionUser) return;
    setResetError('');
    setIsResetting(true);
    try {
      const targetUserId = trialActionUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({ action: 'extend_trial', targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-extend-trial' });
      setTrialActionUser(null);
      setAdminPasswordInput('');
      setAdminReasonInput('');
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Trial extension error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // TEKANGO Admin V1 (Task 2): getRemainingTimeFormatted/isHebrewText/
  // getAccountDerived were only consumed by the old inline table + mobile
  // card list, both now replaced by AdminUsersView (which derives the same
  // facts itself via resolveAccountEntitlement) - removed as genuinely dead
  // code rather than left unused (isRecentActive in particular was a
  // last-sign-in-recency "active" flag, which the Owner's Admin V1 rule
  // forbids surfacing at all, so this is not just a cleanup but a removal
  // of a forbidden derived signal).

  return (
    <div className="admin-screen-host" dir={isHebrew ? 'rtl' : 'ltr'}>

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
              <label style={{ display: 'block', fontSize: '0.72rem', color: NEON.textMuted, marginBottom: '4px', fontWeight: '600' }}>
                {isHebrew ? `הקלד/י את כתובת האימייל של החשבון לאישור: ${deleteModalUser?.email || ''}` : `Type the account's exact email to confirm: ${deleteModalUser?.email || ''}`}
              </label>
              <input
                type="text"
                name="admin_delete_confirm_target"
                autoComplete="off"
                dir="ltr"
                placeholder={deleteModalUser?.email || ''}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.85rem', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary }}
                required
              />
              <textarea
                name="admin_delete_reason"
                placeholder={isHebrew ? 'סיבת הפעולה (חובה)...' : 'Reason for this action (required)...'}
                value={adminReasonInput}
                onChange={(e) => setAdminReasonInput(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.82rem', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary, resize: 'vertical', fontFamily: 'inherit' }}
                required
              />
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
                  onClick={() => { setDeleteModalUser(null); setAdminPasswordInput(''); setAdminReasonInput(''); setDeleteConfirmInput(''); setResetError(''); }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isResetting || deleteConfirmInput.trim().toLowerCase() !== (deleteModalUser?.email || '').trim().toLowerCase()}
                  style={{ flex: 1, background: NEON.redDark, color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 10px -2px rgba(239, 68, 68, 0.5)', opacity: (deleteConfirmInput.trim().toLowerCase() !== (deleteModalUser?.email || '').trim().toLowerCase()) ? 0.5 : 1 }}
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
              <textarea
                name="admin_reset_reason"
                placeholder={isHebrew ? 'סיבת הפעולה (חובה)...' : 'Reason for this action (required)...'}
                value={adminReasonInput}
                onChange={(e) => setAdminReasonInput(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.82rem', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary, resize: 'vertical', fontFamily: 'inherit' }}
                required
              />
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
                  onClick={() => { setResetModalUser(null); setAdminPasswordInput(''); setAdminReasonInput(''); setResetError(''); }}
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

      {/* Protected Actions: Lifetime grant/revoke — חוק ברזל (Explicit
          Lifetime Entitlement Model, 2026-09-08): commercial-entitlement
          mutation, hidden from the default row view (ר' כפתור ShieldCheck
          בעמודת הפעולות), אישור-סיסמה אמיתי (signInWithPassword, לא
          השוואת-מחרוזת), ואימות server-side עצמאי (guard trigger). מציג
          במפורש: חשבון-יעד, מצב נוכחי, מצב מיועד. */}
      {lifetimeActionUser && (() => {
        const targetIsLifetime = lifetimeActionUser.is_lifetime === true;
        const currentStateLabel = targetIsLifetime
          ? (isHebrew ? 'Lifetime (זכאות PRO מלאה, ללא תפוגה)' : 'Lifetime (full PRO entitlement, no expiry)')
          : (isHebrew ? 'רגיל (לא Lifetime)' : 'Standard (not Lifetime)');
        const nextStateLabel = targetIsLifetime
          ? (isHebrew ? 'רגיל (לא Lifetime) - plan/trial_ends_at הקיימים יקבעו את הזכאות בפועל, ללא שינוי בהם' : 'Standard (not Lifetime) - existing plan/trial_ends_at will determine actual entitlement, unchanged by this action')
          : (isHebrew ? 'Lifetime (זכאות PRO מלאה, ללא תפוגה, ללא תלות ב-plan/trial_ends_at)' : 'Lifetime (full PRO entitlement, no expiry, independent of plan/trial_ends_at)');
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
            <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: isHebrew ? 'right' : 'left' }}>
              <h3 style={{ marginTop: 0, color: NEON.violetLight, fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={18} />
                {targetIsLifetime
                  ? (isHebrew ? 'פעולה מוגנת: ביטול Lifetime' : 'Protected Action: Revoke Lifetime')
                  : (isHebrew ? 'פעולה מוגנת: הענקת Lifetime' : 'Protected Action: Grant Lifetime')}
              </h3>
              <p style={{ color: NEON.textSecondary, fontSize: '0.82rem', marginBottom: '4px', lineHeight: '1.4' }}>
                {isHebrew ? 'חשבון יעד:' : 'Target account:'} <strong style={{ color: NEON.textPrimary }}>{lifetimeActionUser?.email || lifetimeActionUser?.business_name || 'N/A'}</strong>
              </p>
              <p style={{ color: NEON.textSecondary, fontSize: '0.78rem', marginBottom: '4px', lineHeight: '1.4' }}>
                {isHebrew ? 'מצב נוכחי:' : 'Current state:'} <strong>{currentStateLabel}</strong>
              </p>
              <p style={{ color: NEON.textSecondary, fontSize: '0.78rem', marginBottom: '14px', lineHeight: '1.4' }}>
                {isHebrew ? 'מצב מיועד (אחרי אישור):' : 'Intended resulting state (after confirmation):'} <strong>{nextStateLabel}</strong>
              </p>

              <form onSubmit={handleExecuteLifetimeAction} autoComplete="off">
                <textarea
                  name="admin_lifetime_reason"
                  placeholder={isHebrew ? 'סיבת הפעולה (חובה)...' : 'Reason for this action (required)...'}
                  value={adminReasonInput}
                  onChange={(e) => setAdminReasonInput(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.82rem', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary, resize: 'vertical', fontFamily: 'inherit' }}
                  required
                />
                <input
                  type="password"
                  name="admin_lifetime_pwd_unique"
                  autoComplete="one-time-code"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder={isHebrew ? 'סיסמת אדמין (שלך) לאישור...' : 'Your admin password to confirm...'}
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
                    onClick={() => { setLifetimeActionUser(null); setAdminPasswordInput(''); setAdminReasonInput(''); setResetError(''); }}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    {isHebrew ? 'ביטול' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    style={{ flex: 1, background: NEON.gradient, color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: NEON.glowSoft }}
                  >
                    {isResetting
                      ? (isHebrew ? 'מבצע...' : 'Working...')
                      : targetIsLifetime
                        ? (isHebrew ? 'אשר ביטול Lifetime' : 'Confirm Revoke Lifetime')
                        : (isHebrew ? 'אשר הענקת Lifetime' : 'Confirm Grant Lifetime')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* TEKANGO Admin V1 (Task 3.4): Extend Trial by 14 days - now goes
          through the same protected-action re-auth flow as Reset/Delete/
          Lifetime (previously had none at all). Only offered from the
          action menu when the account is actually eligible (AdminUsersView
          already filters this at the button-visibility level; the backend
          independently re-enforces eligibility regardless). */}
      {trialActionUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: NEON.violetLight, fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} />
              {isHebrew ? 'פעולה מוגנת: הארכת ניסיון ב-14 יום' : 'Protected Action: Extend Trial 14 Days'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.82rem', marginBottom: '4px', lineHeight: '1.4' }}>
              {isHebrew ? 'חשבון יעד:' : 'Target account:'} <strong style={{ color: NEON.textPrimary }}>{trialActionUser?.email || trialActionUser?.business_name || 'N/A'}</strong>
            </p>
            <p style={{ color: NEON.textSecondary, fontSize: '0.78rem', marginBottom: '4px', lineHeight: '1.4' }}>
              {isHebrew ? 'תפוגה נוכחית:' : 'Current expiry:'} <strong>{trialActionUser?.trial_ends_at ? formatShortDateTime(trialActionUser.trial_ends_at, (isHebrew ? 'Local' : 'International')) : (isHebrew ? 'אין ניסיון פעיל' : 'No active trial')}</strong>
            </p>
            <p style={{ color: NEON.textSecondary, fontSize: '0.78rem', marginBottom: '14px', lineHeight: '1.4' }}>
              {isHebrew ? 'זמין רק כשהניסיון פג או שאין ניסיון פעיל. הזכאות נבדקת שוב בשרת בזמן האישור.' : 'Only available when the trial is expired or none is active. Eligibility is re-checked server-side at confirmation time.'}
            </p>

            <form onSubmit={handleExecuteTrialExtension} autoComplete="off">
              <textarea
                name="admin_trial_reason"
                placeholder={isHebrew ? 'סיבת הפעולה (חובה)...' : 'Reason for this action (required)...'}
                value={adminReasonInput}
                onChange={(e) => setAdminReasonInput(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.82rem', marginBottom: '10px', boxSizing: 'border-box', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary, resize: 'vertical', fontFamily: 'inherit' }}
                required
              />
              <input
                type="password"
                name="admin_trial_pwd_unique"
                autoComplete="one-time-code"
                data-lpignore="true"
                data-form-type="other"
                placeholder={isHebrew ? 'סיסמת אדמין (שלך) לאישור...' : 'Your admin password to confirm...'}
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
                  onClick={() => { setTrialActionUser(null); setAdminPasswordInput(''); setAdminReasonInput(''); setResetError(''); }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{ flex: 1, background: NEON.gradient, color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: NEON.glowSoft }}
                >
                  {isResetting ? (isHebrew ? 'מבצע...' : 'Working...') : (isHebrew ? 'אשר הארכת ניסיון' : 'Confirm Trial Extension')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEKANGO Admin V1 (Task 2): the section title/KPI row that used to
          render here is removed - it duplicated the shared Header's own
          Admin KPI slot (Dashboard.jsx) and AdminOverview.jsx, which the
          Owner's binding rule forbids ("no duplicated KPI region"). It also
          included an "ACTIVE (10M)" last-sign-in-recency tile, which the
          Owner's rule separately forbids outright ("no active now from weak
          timestamps"). "New in last 24h" is still reachable for real, via
          AdminOverview's own Recently Registered card (created_at-based). */}

      {/* Diagnostics - collapsed by default. Live email-test capability, moved out
          of the primary user-management flow (see redesign spec). Functionally
          unchanged from before - only its position/visibility changed. */}
      {/* TEKANGO Admin V1 (Task 2): the search input + desktop table +
          mobile card list that used to render inline here (below) are all
          replaced by AdminUsersView - the real business-first directory
          (Business+email/Plan/Trial-expiry/Registered/Market/Actions
          columns, plan/trial/market filters, pagination), which owns its
          own search box. This component (AdminUsersTab) keeps owning only
          the protected-action dialogs (reset/delete/lifetime) below and
          wires them into AdminUsersView's onReset/onDelete/onLifetime. */}
      <AdminUsersView
        accounts={allAccounts}
        orderedAccounts={filteredAdminAccounts}
        search={adminSearchTerm}
        onSearch={setAdminSearchTerm}
        onSort={handleSort}
        sortField={sortField}
        sortDirection={sortDirection}
        isHebrew={isHebrew}
        onDetails={onOpenUserDetails}
        bodyExtra={(
      <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, borderRadius: '12px', marginTop: '16px', overflow: 'hidden' }}>
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
        )}
      />
    </div>
  );
}
