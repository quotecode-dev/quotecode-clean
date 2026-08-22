// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AdminUsersTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React, { useState } from 'react';
import { supabase } from '../shared/supabase';

export default function AdminUsersTab({
  t,
  isHebrew,
  allAccounts = [],
  filteredAdminAccounts = [],
  adminSearchTerm = '',
  setAdminSearchTerm,
  handleSort,
  sortField,
  sortDirection,
  liveTick,
  handleUpdatePlanOnly,
  handleAdminPlanChange,
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
        await supabase.from('quote_items').delete().in('quote_id', (
          await supabase.from('quotes').select('id').eq('user_id', targetUserId)
        ).data?.map(q => q.id) || []);
        
        await supabase.from('quotes').delete().eq('user_id', targetUserId);
        await supabase.from('clients').delete().eq('user_id', targetUserId);
        await supabase.from('expenses').delete().eq('user_id', targetUserId);
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
      
      if (targetUserId) {
        const { data: userQuotes } = await supabase.from('quotes').select('id').eq('user_id', targetUserId);
        if (userQuotes && userQuotes.length > 0) {
          const qIds = userQuotes.map(q => q.id);
          await supabase.from('quote_items').delete().in('quote_id', qIds);
          await supabase.from('quote_attachments').delete().in('quote_id', qIds);
        }
        await supabase.from('quotes').delete().eq('user_id', targetUserId);
        await supabase.from('clients').delete().eq('user_id', targetUserId);
        await supabase.from('services').delete().eq('user_id', targetUserId);
        await supabase.from('expenses').delete().eq('user_id', targetUserId);
      }

      await supabase
        .from('business_settings')
        .update({ 
          business_name: 'DELETED', 
          email: `deleted_${Date.now()}@proflow.com`, 
          tax_id: '', 
          phone: '', 
          plan: 'free', 
          trial_ends_at: new Date(0).toISOString() 
        })
        .eq('id', deleteModalUser.id);

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
    } catch (err) {
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
        <div onClick={() => handleOpenNewUsersModal(newUsersList)} style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.58rem', color: '#4f46e5', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>NEW USERS (24H)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#4f46e5' }}>{unreadNewUsersCount}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.58rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>ACTIVE (10M)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#166534' }}>{activeRecent} <span style={{display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', verticalAlign: 'middle'}}/></div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>LOCAL (LCL)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{localU}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.58rem', color: '#991b1b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>INTERNATIONAL</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#991b1b' }}>{intlU}</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>TOTAL USERS</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{totalU}</div>
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input 
          type="text" 
          placeholder="Search user (email or business)..." 
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
                  <span>Email</span>
                  {sortField === 'email' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '14%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('business_name')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>Business</span>
                  {sortField === 'business_name' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('plan')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>Plan</span>
                  {sortField === 'plan' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('country')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>Region</span>
                  {sortField === 'country' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '6%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('role')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>Role</span>
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
                  <span>Trial Ext</span>
                  {sortField === 'trial_extension' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', width: '10%', cursor: 'pointer', userSelect: 'none', verticalAlign: 'middle' }} onClick={() => handleSort('last_sign_in')}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                  <span>Last Sign In</span>
                  {sortField === 'last_sign_in' && <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th style={{ padding: '10px 6px', textAlign: 'center', width: '13%', verticalAlign: 'middle' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(activeAccountsList) || activeAccountsList.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              activeAccountsList.map(acc => {
                if (!acc) return null;
                const isSuperAdminUser = acc.role === 'super_admin';
                const planValue = isSuperAdminUser ? 'pro' : (acc.plan ? acc.plan.toLowerCase() : 'free');
                
                const isPaidSubscriber = planValue === 'basic' || planValue === 'pro';
                const isLifetime = isSuperAdminUser || acc.trial_ends_at === null || acc.trial_ends_at === undefined;
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
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: planValue === 'pro' ? '#e0e7ff' : planValue === 'basic' ? '#e0f2fe' : '#f1f5f9', color: planValue === 'pro' ? '#4f46e5' : planValue === 'basic' ? '#0284c7' : '#64748b' }}
                        title={`Plan: ${planValue.toUpperCase()}`}
                      >
                        {planValue === 'pro' ? '⚡' : planValue === 'basic' ? '💼' : '🌱'}
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
                        title={`Region: ${currentCountry} (Click to toggle)`}
                      >
                        {isIntl ? '🌍' : '🏠'}
                      </span>
                    </td>

                    {/* Role Icon */}
                    <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                      <span 
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isSuperAdminUser ? '#fee2e2' : '#f1f5f9', color: isSuperAdminUser ? '#991b1b' : '#475569' }}
                        title={`Role: ${acc.role || 'user'}`}
                      >
                        {isSuperAdminUser ? '🛡️' : '👤'}
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
                          title={isLifetime ? 'Lifetime Enabled (Click to Revoke)' : 'Enable Lifetime'}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </button>
                        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: isLifetime ? '#7c3aed' : '#64748b' }}>
                          {isLifetime ? 'Lifetime' : 'Standard'}
                        </span>
                      </div>
                    </td>

                    {/* Trial Extension Column */}
                    <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isPaidSubscriber && !isSuperAdminUser ? (
                          <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 'bold', background: '#dcfce7', padding: '2px 6px', borderRadius: '8px' }}>
                            Active
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
                                title="Extend Trial by 14 Days"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </button>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                              <span style={{ fontSize: '0.62rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {isLifetime ? 'No expiry' : (acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A')}
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
                          title="View Details"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        </button>

                        <button
                          onClick={() => setResetModalUser(acc)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Reset Data"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.23-5.19"/></svg>
                        </button>

                        {!isSuperAdminUser && (
                          <button
                            onClick={() => setDeleteModalUser(acc)}
                            style={{ background: '#991b1b', color: 'white', border: 'none', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete User"
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