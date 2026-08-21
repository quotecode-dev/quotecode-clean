// ==============================================================================
// 🚨 חוק ברזל קשוח (AdminUsersTab.jsx): ניהול מתקדם של משתמשים ומחיקה מאובטחת.
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

      const { error: deleteSettingErr } = await supabase.from('business_settings').delete().eq('id', deleteModalUser.id);
      if (deleteSettingErr) throw deleteSettingErr;

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

  return (
    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #e2e8f0' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      
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

      {/* מודל אבטחה למחיקת משתמש בסיסמת אדמין עם מניעת שמירה בדפדפן */}
      {deleteModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: '#991b1b', fontSize: '1.1rem', marginBottom: '8px', fontWeight: '800' }}>
              {isHebrew ? '⚠️ אזהרה: מחיקת משתמש לצמיתות' : '⚠️ Warning: Permanent User Deletion'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '14px', lineHeight: '1.4' }}>
              {isHebrew 
                ? `פעולה זו תמחק לחלוטין את המשתמש ${deleteModalUser?.email || ''} ואת כל נתוניו מהמערכת. נא הקלד את סיסמת ה-Super Admin שלך לאישור:` 
                : `This will permanently delete user ${deleteModalUser?.email || ''}. Enter your Super Admin password to confirm:`}
            </p>
            
            <form onSubmit={handleExecuteUserDelete} autoComplete="off">
              <input
                type="password"
                name="admin_delete_password_field_secure"
                autoComplete="new-password"
                data-lpignore="true"
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

      {/* מודל איפוס נתונים עם מניעת שמירה בדפדפן */}
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
                name="admin_reset_password_field_secure"
                autoComplete="new-password"
                data-lpignore="true"
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div 
          onClick={() => handleOpenNewUsersModal(newUsersList)}
          style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
          title="Click to view new users list"
        >
          <div style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '6px'}}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            NEW USERS (24H)
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#4f46e5' }}>{unreadNewUsersCount}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>ACTIVE (10M)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#166534' }}>{activeRecent} <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#166534'}}/></div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>LOCAL (LCL)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{localU}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#991b1b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>INTERNATIONAL</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#991b1b' }}>{intlU}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>TOTAL USERS</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{totalU}</div>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <input 
          type="text" 
          placeholder="Search user (email or business)..." 
          value={adminSearchTerm}
          onChange={(e) => setAdminSearchTerm(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '220px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: '#f8fafc' }}
        />
      </div>
      
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '780px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('email')}>
                Email {sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('business_name')}>
                Business Name {sortField === 'business_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('plan')}>
                Plan {sortField === 'plan' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('country')}>
                Region {sortField === 'country' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('role')}>
                Role {sortField === 'role' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('trial_ends_at_status')}>
                Trial / Lifetime Status {sortField === 'trial_ends_at_status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('last_sign_in')}>
                Last Sign In {sortField === 'last_sign_in' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: '130px' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(filteredAdminAccounts) || filteredAdminAccounts.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              filteredAdminAccounts.map(acc => {
                if (!acc) return null;
                const isSuperAdminUser = acc.role === 'super_admin';
                const planValue = isSuperAdminUser ? 'pro' : (acc.plan ? acc.plan.toLowerCase() : 'free');
                
                const isPaidSubscriber = planValue === 'basic' || planValue === 'pro';
                const isLifetime = isSuperAdminUser || acc.trial_ends_at === null || acc.trial_ends_at === undefined;
                const currentCountry = acc.country || 'Local';
                
                const pBg = planValue === 'pro' ? '#e0e7ff' : planValue === 'basic' ? '#e0f2fe' : '#f1f5f9';
                const pColor = planValue === 'pro' ? '#4f46e5' : planValue === 'basic' ? '#0284c7' : '#64748b';
                const pBorder = planValue === 'pro' ? '#c7d2fe' : planValue === 'basic' ? '#bae6fd' : '#e2e8f0';

                const rBg = currentCountry === 'Local' ? '#dcfce7' : '#fee2e2';
                const rColor = currentCountry === 'Local' ? '#166534' : '#991b1b';
                const rBorder = currentCountry === 'Local' ? '#bbf7d0' : '#fecaca';

                let isRecentActive = false;
                if (acc.last_sign_in) {
                  const now = Date.now();
                  const diffMs = now - new Date(acc.last_sign_in).getTime();
                  isRecentActive = diffMs < 10 * 60 * 1000;
                }

                return (
                  <tr key={(acc.id || 'acc') + '_' + liveTick} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                    <td style={{ padding: '10px 6px', fontWeight: '500', color: '#1e293b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{acc.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px', color: '#334155' }}>{acc.business_name || 'עסק חדש'}</td>
                    <td style={{ padding: '10px 6px' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <select 
                          value={planValue} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'ext_14') {
                              if (handleExtendTrial14Days) handleExtendTrial14Days(acc.id);
                              e.target.value = planValue;
                            } else {
                              handleUpdatePlanOnly(acc.id, val);
                            }
                          }}
                          style={{ 
                            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                            padding: isHebrew ? '4px 10px 4px 24px' : '4px 24px 4px 10px', 
                            borderRadius: '8px', 
                            border: `1px solid ${pBorder}`, 
                            background: pBg, 
                            fontSize: '0.7rem', 
                            fontWeight: '800', 
                            color: pColor,
                            cursor: 'pointer', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <option value="free">FREE</option>
                          <option value="basic">BASIC</option>
                          <option value="pro">PRO</option>
                          <option value="ext_14">+14d EXT</option>
                        </select>
                        <div style={{ position: 'absolute', [isHebrew ? 'left' : 'right']: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: pColor }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <select 
                          value={currentCountry} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingRegionChange({ accountId: acc.id, newCountry: val, userEmail: acc.email });
                          }}
                          style={{ 
                            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                            padding: isHebrew ? '4px 10px 4px 24px' : '4px 24px 4px 10px', 
                            borderRadius: '8px', 
                            border: `1px solid ${rBorder}`, 
                            background: rBg, 
                            fontSize: '0.7rem', 
                            fontWeight: '800', 
                            color: rColor,
                            cursor: 'pointer', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <option value="Local">LCL</option>
                          <option value="International">Intl</option>
                        </select>
                        <div style={{ position: 'absolute', [isHebrew ? 'left' : 'right']: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: rColor }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px', color: acc.role === 'super_admin' ? '#ef4444' : '#64748b', fontWeight: '600' }}>
                      {acc.role || 'user'}
                    </td>
                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                        {isPaidSubscriber && !isSuperAdminUser ? (
                          <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 'bold', background: '#dcfce7', padding: '4px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                            {isHebrew ? 'מנוי פעיל (Active)' : 'Active Plan'}
                          </span>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                if (!isLifetime) {
                                  setPendingLifetimeUser(acc);
                                } else {
                                  handleToggleLifetime(acc.id, acc.trial_ends_at);
                                }
                              }}
                              style={{ 
                                background: isLifetime ? '#f3e8ff' : '#f1f5f9', 
                                color: isLifetime ? '#6d28d9' : '#475569', 
                                border: '1px solid',
                                borderColor: isLifetime ? '#e9d5ff' : '#cbd5e1',
                                padding: '4px 10px', 
                                borderRadius: '20px', 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              title={isLifetime ? 'Click to revoke lifetime' : 'Click to grant lifetime'}
                            >
                              {isLifetime ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              )}
                              <span>{isLifetime ? 'Lifetime' : 'Trial'}</span>
                            </button>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {isLifetime ? '(No expiry)' : `Ends: ${acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A'}`}
                              </span>
                              {!isLifetime && (
                                <span style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: 'bold' }}>
                                  ⏱️ {getRemainingTimeFormatted(acc.trial_ends_at, acc.role, acc.plan)}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px', fontSize: '0.75rem', color: '#475569', direction: 'ltr', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span title={isRecentActive ? 'Active recently' : 'Inactive'} style={{ fontSize: '0.60rem' }}>
                        <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isRecentActive ? '#22c55e' : '#ef4444'}}></span>
                      </span>
                      <span>{acc.last_sign_in ? new Date(acc.last_sign_in).toLocaleString('en-GB') : 'N/A'}</span>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedUserDetails(acc)}
                          style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.6rem' }}
                          title="Details"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => setResetModalUser(acc)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.6rem' }}
                          title="Reset Data"
                        >
                          Reset
                        </button>
                        {!isSuperAdminUser && (
                          <button
                            onClick={() => setDeleteModalUser(acc)}
                            style={{ background: '#991b1b', color: 'white', border: 'none', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.6rem' }}
                            title="Delete User"
                          >
                            Delete
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