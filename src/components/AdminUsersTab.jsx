// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AdminUsersTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState } from 'react';
import { supabase } from '../shared/supabase';
import { wipeUserData } from '../shared/wipeUserData';

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
    <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      
      {showSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#166534' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '8px', fontWeight: '800' }}>
              {isHebrew ? 'הפעולה בוצעה בהצלחה!' : 'Action Successful!'}
            </h3>
            <button
              onClick={() => { setShowSuccessModal(false); window.location.reload(); }}
              style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
            >
              {isHebrew ? 'אישור' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {deleteModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: '#991b1b', fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800' }}>
              {isHebrew ? '⚠️ אזהרה: מחיקת משתמש לצמיתות' : '⚠️ Warning: Permanent User Deletion'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
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
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px', boxSizing: 'border-box', outline: 'none', background: '#f8fafc' }}
                required
              />

              {resetError && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px', fontWeight: 'bold' }}>
                  {resetError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setDeleteModalUser(null); setAdminPasswordInput(''); setResetError(''); }}
                  style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)' }}
                >
                  {isResetting ? (isHebrew ? 'מוחק...' : 'Deleting...') : (isHebrew ? 'מחק משתמש' : 'Delete User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: '#991b1b', fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800' }}>
              {isHebrew ? '⚠️ אישור אבטחה: איפוס נתוני משתמש' : '⚠️ Security Confirmation: Reset User Data'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
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
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px', boxSizing: 'border-box', outline: 'none', background: '#f8fafc' }}
                required
              />

              {resetError && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px', fontWeight: 'bold' }}>
                  {resetError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setResetModalUser(null); setAdminPasswordInput(''); setResetError(''); }}
                  style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '9px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)' }}
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
        <div onClick={() => handleOpenNewUsersModal(newUsersList)} style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#e0e7ff', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
          </span>
          <div style={{ fontSize: '0.58rem', color: '#4f46e5', fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'משתמשים חדשים (24 ש\')' : 'NEW USERS (24H)'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#4f46e5' }}>{unreadNewUsersCount}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </span>
          <div style={{ fontSize: '0.58rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'פעילים (10 ד\')' : 'ACTIVE (10M)'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#166534' }}>{activeRecent} <span style={{display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', verticalAlign: 'middle'}}/></div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </span>
          <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'מקומי (LCL)' : 'LOCAL (LCL)'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{localU}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </span>
          <div style={{ fontSize: '0.58rem', color: '#991b1b', fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'בינלאומי' : 'INTERNATIONAL'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#991b1b' }}>{intlU}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#eef2ff', color: '#4338ca', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{isHebrew ? 'סה"כ משתמשים' : 'TOTAL USERS'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{totalU}</div>
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input
          type="text"
          placeholder={isHebrew ? 'חיפוש משתמש (אימייל או שם עסק)...' : 'Search user (email or business)...'}
          value={adminSearchTerm}
          onChange={(e) => setAdminSearchTerm(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '240px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: 'white', outline: 'none' }}
        />
      </div>
      
      {/* Table container with strict width control to eliminate horizontal scroll */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', verticalAlign: 'middle' }}>
              <th style={{ padding: '10px 6px', width: '20%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('email')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'אימייל' : 'Email'}</span>
                  {sortField === 'email' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '14%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('business_name')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'עסק' : 'Business'}</span>
                  {sortField === 'business_name' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('plan')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'חבילה' : 'Plan'}</span>
                  {sortField === 'plan' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('country')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'אזור' : 'Region'}</span>
                  {sortField === 'country' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('role')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'הרשאה' : 'Role'}</span>
                  {sortField === 'role' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '10%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('trial_ends_at_status')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>Lifetime</span>
                  {sortField === 'trial_ends_at_status' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '15%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('trial_extension')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'הארכת ניסיון' : 'Trial Ext'}</span>
                  {sortField === 'trial_extension' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '10%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('last_sign_in')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>{isHebrew ? 'כניסה אחרונה' : 'Last Sign In'}</span>
                  {sortField === 'last_sign_in' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', textAlign: 'center', width: '13%', verticalAlign: 'middle' }}>
                {isHebrew ? 'פעולות' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(activeAccountsList) || activeAccountsList.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '0.8rem' }}>
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
                  <tr key={(acc.id || 'acc') + '_' + liveTick} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem', height: '44px' }}>
                    
                    {/* Email */}
                    <td style={{ padding: '6px 6px', fontWeight: '500', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={acc.email || ''}>
                      {acc.email || 'N/A'}
                    </td>

                    {/* Business Name */}
                    <td 
                      style={{ padding: '6px 6px', color: '#334155', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: isBizHebrew ? 'rtl' : 'ltr', textAlign: isBizHebrew ? 'right' : 'left' }} 
                      title={bizName}
                    >
                      {bizName}
                    </td>

                    {/* Plan Icon */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isGrantedLifetimePro ? '#f3e8ff' : planValue === 'pro' ? '#e0e7ff' : planValue === 'basic' ? '#e0f2fe' : '#f1f5f9', color: isGrantedLifetimePro ? '#7c3aed' : planValue === 'pro' ? '#4f46e5' : planValue === 'basic' ? '#0284c7' : '#64748b' }}
                        title={isHebrew
                          ? `חבילה: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (גישת Lifetime)' : ''}`
                          : `Plan: ${planValue.toUpperCase()}${isGrantedLifetimePro ? ' (Lifetime Access)' : ''}`}
                      >
                        {isGrantedLifetimePro ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
                        ) : planValue === 'pro' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z"/></svg>
                        ) : planValue === 'basic' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
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
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isIntl ? '#fee2e2' : '#dcfce7', color: isIntl ? '#991b1b' : '#166534', cursor: 'pointer' }}
                        title={isHebrew ? `אזור: ${currentCountry} (לחץ להחלפה)` : `Region: ${currentCountry} (Click to toggle)`}
                      >
                        {isIntl ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        )}
                      </span>
                    </td>

                    {/* Role Icon */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isSuperAdminUser ? '#fee2e2' : '#f1f5f9', color: isSuperAdminUser ? '#991b1b' : '#475569' }}
                        title={isHebrew ? `הרשאה: ${acc.role || 'user'}` : `Role: ${acc.role || 'user'}`}
                      >
                        {isSuperAdminUser ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        )}
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
                            background: isLifetime ? '#f3e8ff' : '#f8fafc', 
                            color: isLifetime ? '#7c3aed' : '#94a3b8', 
                            border: '1px solid',
                            borderColor: isLifetime ? '#d8b4fe' : '#e2e8f0',
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
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </button>
                        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: isLifetime ? '#7c3aed' : '#64748b' }}>
                          {isLifetime ? 'Lifetime' : (isHebrew ? 'רגיל' : 'Standard')}
                        </span>
                      </div>
                    </td>

                    {/* Trial Extension Column */}
                    <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isPaidSubscriber && !isSuperAdminUser ? (
                          <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 'bold', background: '#dcfce7', padding: '2px 6px', borderRadius: '8px' }}>
                            {isHebrew ? 'פעיל' : 'Active'}
                          </span>
                        ) : (
                          <>
                            {!isSuperAdminUser && (
                              <button
                                onClick={() => {
                                  if (handleExtendTrial14Days) handleExtendTrial14Days(acc.id);
                                }}
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  border: '1px solid #bae6fd',
                                  width: '24px', height: '24px',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={isHebrew ? 'הארך ניסיון ב-14 יום' : 'Extend Trial by 14 Days'}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </button>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                              <span style={{ fontSize: '0.62rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {isLifetime ? (isHebrew ? 'ללא תפוגה' : 'No expiry') : (acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A')}
                              </span>
                              {!isLifetime && (
                                <span style={{ fontSize: '0.55rem', color: '#0284c7', fontWeight: 'bold' }}>
                                  {getRemainingTimeFormatted(acc.trial_ends_at, acc.role, acc.plan)}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Last Sign In (Date only with full timestamp on hover) */}
                    <td style={{ padding: '6px 6px', fontSize: '0.7rem', color: '#475569', direction: 'ltr', textAlign: 'left', whiteSpace: 'nowrap' }} title={lastSignInFullStr}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isRecentActive ? '#22c55e' : '#ef4444', marginRight: '4px', verticalAlign: 'middle' }}></span>
                      <span>{lastSignInDateStr}</span>
                    </td>

                    {/* Actions Column */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                        
                        <button
                          onClick={() => setSelectedUserDetails(acc)}
                          style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title={isHebrew ? 'צפה בפרטים' : 'View Details'}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        </button>

                        <button
                          onClick={() => setResetModalUser(acc)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title={isHebrew ? 'איפוס נתונים' : 'Reset Data'}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.23-5.19"/></svg>
                        </button>

                        {!isSuperAdminUser && (
                          <button
                            onClick={() => setDeleteModalUser(acc)}
                            style={{ background: '#991b1b', color: 'white', border: 'none', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title={isHebrew ? 'מחק משתמש' : 'Delete User'}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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