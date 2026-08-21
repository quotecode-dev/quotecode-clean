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

  return (
    <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div 
          onClick={() => handleOpenNewUsersModal(newUsersList)}
          style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
          title="Click to view new users list"
        >
          <div style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
            NEW USERS (24H)
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#4f46e5' }}>{unreadNewUsersCount}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>ACTIVE (10M)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#166534' }}>{activeRecent} <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', verticalAlign: 'middle'}}/></div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>LOCAL (LCL)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{localU}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#991b1b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>INTERNATIONAL</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#991b1b' }}>{intlU}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>TOTAL USERS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{totalU}</div>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder="Search user (email or business)..." 
          value={adminSearchTerm}
          onChange={(e) => setAdminSearchTerm(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', width: '280px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', background: 'white', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
        />
      </div>
      
      {/* Modern Clean Table */}
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '950px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('email')}>
                Email {sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('business_name')}>
                Business Name {sortField === 'business_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('plan')}>
                Plan {sortField === 'plan' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('country')}>
                Region {sortField === 'country' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('role')}>
                Role {sortField === 'role' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('trial_ends_at_status')}>
                Lifetime Status {sortField === 'trial_ends_at_status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('trial_extension')}>
                Trial Extension {sortField === 'trial_extension' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('last_sign_in')}>
                Last Sign In {sortField === 'last_sign_in' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '12px 10px', textAlign: 'center', width: '160px' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(activeAccountsList) || activeAccountsList.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem' }}>
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
                
                const pBg = planValue === 'pro' ? '#e0e7ff' : planValue === 'basic' ? '#e0f2fe' : '#f1f5f9';
                const pColor = planValue === 'pro' ? '#4f46e5' : planValue === 'basic' ? '#0284c7' : '#64748b';

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
                  <tr key={(acc.id || 'acc') + '_' + liveTick} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px 10px', fontWeight: '500', color: '#1e293b' }}>
                      {acc.email || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#334155', fontWeight: '500' }}>{acc.business_name || 'עסק חדש'}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '8px', background: pBg, color: pColor, fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        {planValue}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
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
                            cursor: 'pointer', outline: 'none'
                          }}
                        >
                          <option value="Local">LCL</option>
                          <option value="International">Intl</option>
                        </select>
                        <div style={{ position: 'absolute', [isHebrew ? 'left' : 'right']: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: rColor }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', color: acc.role === 'super_admin' ? '#ef4444' : '#64748b', fontWeight: '600' }}>
                      {acc.role || 'user'}
                    </td>

                    {/* עמודה 1: Lifetime Status */}
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            width: '32px', height: '32px',
                            borderRadius: '50%', 
                            cursor: 'pointer', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s'
                          }}
                          title={isLifetime ? 'Lifetime Enabled (Click to Revoke)' : 'Enable Lifetime'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </button>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isLifetime ? '#7c3aed' : '#64748b' }}>
                          {isLifetime ? 'Lifetime' : 'Standard'}
                        </span>
                      </div>
                    </td>

                    {/* עמודה 2: Trial Extension */}
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isPaidSubscriber && !isSuperAdminUser ? (
                          <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 'bold', background: '#dcfce7', padding: '4px 10px', borderRadius: '12px' }}>
                            {isHebrew ? 'מנוי פעיל' : 'Active'}
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
                                  width: '32px', height: '32px',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                  transition: 'all 0.2s'
                                }}
                                title="Extend Trial by 14 Days"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </button>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {isLifetime ? '(No expiry)' : `Ends: ${acc.trial_ends_at ? new Date(acc.trial_ends_at).toLocaleDateString('en-GB') : 'N/A'}`}
                              </span>
                              {!isLifetime && (
                                <span style={{ fontSize: '0.62rem', color: '#0284c7', fontWeight: 'bold' }}>
                                  ⏱️ {getRemainingTimeFormatted(acc.trial_ends_at, acc.role, acc.plan)}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px', fontSize: '0.75rem', color: '#475569', direction: 'ltr', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isRecentActive ? '#22c55e' : '#ef4444', marginRight: '6px', verticalAlign: 'middle' }}></span>
                      <span>{acc.last_sign_in ? new Date(acc.last_sign_in).toLocaleString('en-GB') : 'N/A'}</span>
                    </td>

                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedUserDetails(acc)}
                          style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                          title="View Details"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          <span>Details</span>
                        </button>
                        <button
                          onClick={() => setResetModalUser(acc)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                          title="Reset Data"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.23-5.19"/></svg>
                          <span>Reset</span>
                        </button>
                        {!isSuperAdminUser && (
                          <button
                            onClick={() => setDeleteModalUser(acc)}
                            style={{ background: '#991b1b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                            title="Delete User"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            <span>Delete</span>
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