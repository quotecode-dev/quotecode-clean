// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AdminUsersTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState } from 'react';
import { supabase } from '../shared/supabase';
import { wipeUserData } from '../shared/wipeUserData';
import {
  Mail, Building2, CreditCard, Globe, Shield, Infinity as InfinityIcon, Clock, LogIn, SlidersHorizontal, CheckCircle2,
  UserPlus, Activity, Home, Users2, Crown, Gem, Layers, CircleUser, RefreshCw, Trash2, Eye, RotateCw, AlertTriangle,
  Send, CalendarClock, XCircle
} from 'lucide-react';
import { NEON } from '../theme/neonTheme';

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
  setPendingRegionChange,
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

  // בדיקת מיילי תזכורת חיה (ניסיון חינמי / מנוי בתשלום), בשתי השפות, דרך
  // ה-Edge Function send-expiration-email במצב "test" - מוגבל ל-super_admin
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
      const { data, error } = await supabase.functions.invoke('send-expiration-email', {
        body: {
          mode: 'test',
          email: testEmail,
          isHebrew: sendHebrew,
          type: testType,
          stage: testStage,
          businessName: sendHebrew ? 'עסק לדוגמה' : 'Test Business'
        }
      });

      if (error) throw new Error(await getFunctionErrorMessage(error, isHebrew ? 'שליחת מייל הבדיקה נכשלה' : 'Failed to send test email'));
      if (data?.error) throw new Error(data.error);

      setTestStatus({
        type: 'success',
        msg: isHebrew
          ? `נשלח בהצלחה ל-${testEmail} (${sendHebrew ? 'עברית' : 'אנגלית'})`
          : `Sent successfully to ${testEmail} (${sendHebrew ? 'Hebrew' : 'English'})`
      });
    } catch (err) {
      setTestStatus({ type: 'error', msg: err.message });
    } finally {
      setSendingTestLang(null);
    }
  };

  // עדכון ידני של תאריך תפוגת מנוי בתשלום - מאפס את דגלי השליחה כדי שהתזכורות
  // ייערכו מחדש מול התאריך החדש (רלוונטי עד שתחובר מערכת סליקה אמיתית)
  const handleSetSubscriptionEndDate = async (accountId, dateValue) => {
    const isoValue = dateValue ? new Date(`${dateValue}T00:00:00`).toISOString() : null;
    await supabase
      .from('business_settings')
      .update({
        subscription_ends_at: isoValue,
        subscription_reminder_3d_sent: false,
        subscription_reminder_24h_sent: false
      })
      .eq('id', accountId);
  };

  const activeAccountsList = (filteredAdminAccounts || []).filter(acc => {
    if (!acc) return false;
    const email = (acc.email || '').toLowerCase();
    const biz = (acc.business_name || '').toLowerCase();
    return !email.startsWith('deleted_') && biz !== 'deleted';
  });

  const totalU = Array.isArray(allAccounts) ? allAccounts.length : 0;
  const localU = Array.isArray(allAccounts) ? allAccounts.filter(a => (a?.country || 'Local') === 'Local').length : 0;
  const intlU = Array.isArray(allAccounts) ? allAccounts.filter(a => a?.country === 'International').length : 0;
  
  const activeRecent = Array.isArray(allAccounts) ? allAccounts.filter(a => {
    if (!a?.last_sign_in) return false;
    const now = Date.now();
    const diff = now - new Date(a.last_sign_in).getTime();
    return diff < 10 * 60 * 1000;
  }).length : 0;

  const newUsersList = Array.isArray(allAccounts) ? allAccounts.filter(a => {
    if (!a?.created_at) return false;
    const now = Date.now();
    const diff = now - new Date(a.created_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }) : [];

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
        await wipeUserData(targetUserId);
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

  const getRemainingTimeFormatted = (trialEndsAt, role, plan) => {
    try {
      const now = Date.now();
      if (role === 'super_admin') return isHebrew ? 'ללא תפוגה (Lifetime)' : 'No expiry (Lifetime)';
      const normalizedPlan = (plan || 'free').toLowerCase();
      
      if (normalizedPlan === 'basic' || normalizedPlan === 'pro') {
        return isHebrew ? 'מנוי פעיל (Active)' : 'Active Plan';
      }
      
      if (!trialEndsAt) return isHebrew ? 'ללא תפוגה (Lifetime)' : 'No expiry (Lifetime)';
      
      const diffMs = new Date(trialEndsAt).getTime() - now;
      if (diffMs <= 0) return isHebrew ? 'פג תוקף' : 'Expired';

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (days > 0) {
        return isHebrew ? `${days} ימים ו-${hours} שע'` : `${days}d ${hours}h left`;
      }
      return isHebrew ? `${hours} שע'` : `${hours}h left`;
    } catch {
      return isHebrew ? 'לא ידוע' : 'N/A';
    }
  };

  const isHebrewText = (str) => /[\u0590-\u05FF]/.test(str);

  return (
    <div style={{ background: NEON.bgCard, padding: '24px', borderRadius: '16px', border: `1px solid ${NEON.border}`, width: '100%', boxSizing: 'border-box' }} dir={isHebrew ? 'rtl' : 'ltr'}>

      {showSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: NEON.emerald }}>
              <CheckCircle2 size={28} strokeWidth={2.2} />
            </div>
            <h3 style={{ marginTop: 0, color: NEON.textPrimary, fontSize: '1.2rem', marginBottom: '8px', fontWeight: '800' }}>
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

      {/* Live Email Test Panel - trial + subscription reminders, both languages */}
      <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: NEON.textPrimary, margin: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={16} color={NEON.violetLight} strokeWidth={2.2} />
          {isHebrew ? 'בדיקת מיילי תזכורת תפוגה (חי, דרך Resend)' : 'Test Expiration Reminder Emails (Live, via Resend)'}
        </h3>
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

      <div style={{ marginBottom: '14px' }}>
        <input
          type="text"
          placeholder={isHebrew ? 'חיפוש משתמש (אימייל או שם עסק)...' : 'Search user (email or business)...'}
          value={adminSearchTerm}
          onChange={(e) => setAdminSearchTerm(e.target.value)}
          style={{ padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', width: '240px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary, outline: 'none' }}
        />
      </div>

      {/* Table container with strict width control to eliminate horizontal scroll */}
      <div style={{ background: NEON.bgElevated, borderRadius: '12px', border: `1px solid ${NEON.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', verticalAlign: 'middle' }}>
              <th style={{ padding: '10px 6px', width: '20%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('email')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Mail size={12} color="#4f46e5" />
                  <span>{isHebrew ? 'אימייל' : 'Email'}</span>
                  {sortField === 'email' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '14%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('business_name')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Building2 size={12} color="#0ea5e9" />
                  <span>{isHebrew ? 'עסק' : 'Business'}</span>
                  {sortField === 'business_name' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('plan')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <CreditCard size={12} color="#7c3aed" />
                  <span>{isHebrew ? 'חבילה' : 'Plan'}</span>
                  {sortField === 'plan' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('country')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Globe size={12} color="#10b981" />
                  <span>{isHebrew ? 'אזור' : 'Region'}</span>
                  {sortField === 'country' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('role')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <Shield size={12} color="#991b1b" />
                  <span>{isHebrew ? 'הרשאה' : 'Role'}</span>
                  {sortField === 'role' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '10%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('trial_ends_at_status')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <InfinityIcon size={12} color="#7c3aed" />
                  <span>Lifetime</span>
                  {sortField === 'trial_ends_at_status' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '15%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('trial_extension')}>
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
              <th style={{ padding: '10px 6px', textAlign: 'center', width: '13%', verticalAlign: 'middle' }}>
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
                const isSuperAdminUser = acc.role === 'super_admin';
                const isLifetime = isSuperAdminUser || acc.trial_ends_at === null || acc.trial_ends_at === undefined;
                const rawPlan = acc.plan ? acc.plan.toLowerCase() : 'free';
                // משתמש Lifetime מקבל גישה שקולה ל-PRO ללא הגבלה, גם אם שדה ה-plan הגולמי נשאר "free"/"basic"
                // (handleToggleLifetime מעדכן רק trial_ends_at ולא נוגע ב-plan) - לכן חובה לגזור את התצוגה משניהם יחד
                const planValue = (isSuperAdminUser || isLifetime) ? 'pro' : rawPlan;
                // Pro שהוענק דרך Lifetime toggle (ולא נרכש בפועל) מסומן ויזואלית בנפרד מ-Pro משלם אמיתי
                const isGrantedLifetimePro = isLifetime && !isSuperAdminUser && rawPlan !== 'pro';

                const isPaidSubscriber = planValue === 'basic' || planValue === 'pro';
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

                return (
                  <tr key={(acc.id || 'acc') + '_' + liveTick} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.78rem', height: '44px' }}>

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
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isGrantedLifetimePro ? 'rgba(139, 92, 246, 0.15)' : planValue === 'pro' ? 'rgba(139, 92, 246, 0.15)' : planValue === 'basic' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.08)', color: isGrantedLifetimePro ? NEON.violetLight : planValue === 'pro' ? NEON.violetLight : planValue === 'basic' ? NEON.sky : NEON.textSecondary }}
                        title={isHebrew
                          ? `חבילה: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (גישת Lifetime)' : ''}`
                          : `Plan: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (Lifetime Access)' : ''}`}
                      >
                        {isGrantedLifetimePro ? (
                          <Crown size={12} strokeWidth={2.2} />
                        ) : planValue === 'pro' ? (
                          <Gem size={12} fill="currentColor" strokeWidth={1} />
                        ) : planValue === 'basic' ? (
                          <Layers size={12} strokeWidth={2.2} />
                        ) : (
                          <CircleUser size={12} strokeWidth={2.2} />
                        )}
                      </span>
                    </td>

                    {/* Region Icon */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span
                        onClick={() => {
                          const newC = isIntl ? 'Local' : 'International';
                          setPendingRegionChange({ accountId: acc.id, newCountry: newC, userEmail: acc.email });
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isIntl ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: isIntl ? NEON.red : NEON.emerald, cursor: 'pointer' }}
                        title={isHebrew ? `אזור: ${currentCountry} (לחץ להחלפה)` : `Region: ${currentCountry} (Click to toggle)`}
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

                    {/* Trial Extension Column */}
                    <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isPaidSubscriber && !isSuperAdminUser ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.6rem', color: NEON.emerald, fontWeight: 'bold' }}>
                              {isHebrew ? 'מנוי בתשלום' : 'Paid - Active'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CalendarClock size={11} color={NEON.textMuted} style={{ flexShrink: 0 }} />
                              <input
                                type="date"
                                defaultValue={acc.subscription_ends_at ? acc.subscription_ends_at.slice(0, 10) : ''}
                                onBlur={(e) => handleSetSubscriptionEndDate(acc.id, e.target.value)}
                                title={isHebrew ? 'תאריך תפוגת המנוי (לתזכורות אוטומטיות)' : 'Subscription expiry date (for automatic reminders)'}
                                style={{ fontSize: '0.6rem', padding: '2px 3px', borderRadius: '4px', border: `1px solid ${NEON.borderStrong}`, background: NEON.bgInput, color: NEON.textPrimary, width: '92px' }}
                              />
                            </div>
                          </div>
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
                                {isLifetime ? (isHebrew ? 'ללא תפוגה' : 'No expiry') : (acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A')}
                              </span>
                              {!isLifetime && (
                                <span style={{ fontSize: '0.55rem', color: NEON.sky, fontWeight: 'bold' }}>
                                  {getRemainingTimeFormatted(acc.trial_ends_at, acc.role, acc.plan)}
                                </span>
                              )}
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
    </div>
  );
}