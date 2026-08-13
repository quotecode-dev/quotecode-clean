import React from 'react';
import ProFlowLogo from './ProFlowLogo';

export default function AuthScreen({
  isInitializing,
  isPasswordRecoveryMode,
  newPasswordInput,
  setNewPasswordInput,
  handleUpdatePasswordFromRecovery,
  recoveryUpdateLoading,
  recoveryUpdateMsg,
  isSignUp,
  setIsSignUp,
  authSuccess,
  authError,
  handleAuth,
  emailInput,
  setEmailInput,
  passwordInput,
  setPasswordInput,
  forgotOpen,
  setForgotOpen,
  resetMsg,
  handleResetSubmit,
  resetEmail,
  setResetEmail,
  resetLoading
}) {
  if (isInitializing) {
    return (
      <div style={{ fontFamily: '"Assistant", "Rubik", "Segoe UI", Tahoma, sans-serif', background: '#090d16', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <ProFlowLogo size={48} rtl={false} />
          <div style={{ marginTop: '20px', fontSize: '1rem', color: '#94a3b8', fontWeight: 'bold' }}>טוען את המערכת...</div>
        </div>
      </div>
    );
  }

  if (isPasswordRecoveryMode) {
    return (
      <div style={{ fontFamily: '"Assistant", "Rubik", "Segoe UI", Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} dir="rtl">
        <div style={{ background: 'white', padding: '30px', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '12px', fontWeight: '700' }}>הגדרת סיסמה חדשה</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '18px' }}>הזן את הסיסמה החדשה לחשבון שלך</p>
          
          {recoveryUpdateMsg && (
            <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: recoveryUpdateMsg.includes('Error') ? '#fee2e2' : '#dcfce7', color: recoveryUpdateMsg.includes('Error') ? '#991b1b' : '#166534', fontWeight: 'normal' }}>
              {recoveryUpdateMsg}
            </div>
          )}

          <form onSubmit={handleUpdatePasswordFromRecovery}>
            <input 
              type="password" 
              value={newPasswordInput} 
              onChange={(e) => setNewPasswordInput(e.target.value)} 
              placeholder="סיסמה חדשה" 
              required 
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', marginBottom: '12px', fontSize: '0.95rem', direction: 'rtl', textAlign: 'right' }} 
            />
            <button type="submit" disabled={recoveryUpdateLoading} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer' }}>
              {recoveryUpdateLoading ? 'מעדכן...' : 'עדכן סיסמה ושמור'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: '"Assistant", "Rubik", "Segoe UI", Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', maxWidth: '380px', textAlign: 'right' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
              flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', fontFamily: '"Assistant", "Rubik", "Segoe UI", sans-serif' }}>
              <span style={{ color: '#0f172a' }}>Pro</span>
              <span style={{ color: '#4f46e5', marginRight: '2px' }}>Flow</span>
            </span>
          </div>
          
          {isSignUp ? (
            <div dir="rtl" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', border: '1px solid #c7d2fe', padding: '10px 14px', borderRadius: '8px', marginTop: '14px', marginBottom: '4px', color: '#4f46e5', fontSize: '0.85rem', fontWeight: 'normal', textAlign: 'right', width: '100%', boxSizing: 'border-box', boxShadow: '0 2px 4px -1px rgba(79, 70, 229, 0.1)', lineHeight: '1.5' }}>
              כדי להירשם ולקבל את תקופת הניסיון החינמית למשך 14 יום במסלול PRO, אנא הזן את האימייל והסיסמה שלך.
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '10px', fontWeight: 'normal' }}>
              התחבר למערכת הניהול שלך
            </p>
          )}
        </div>

        {authSuccess && <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: '#dcfce7', color: '#166534', textAlign: 'right', fontWeight: 'normal' }}>{authSuccess}</div>}
        {authError && <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b', textAlign: 'right', fontWeight: 'normal' }}>{authError}</div>}

        <form onSubmit={handleAuth} autoComplete="off" data-lpignore="true">
          <input type="text" name="fake_user_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />
          <input type="password" name="fake_pass_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>כתובת אימייל</label>
            <input type="email" name="user_email_field" autoComplete="off" data-lpignore="true" data-bwignore="true" data-1p-ignore data-dashlane-ignore="true" data-form-type="other" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required placeholder="user@example.com" style={{ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#eff6ff', fontSize: '0.9rem' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>סיסמה</label>
            <input type="password" name="user_password_field" autoComplete="off" data-lpignore="true" data-bwignore="true" data-1p-ignore data-dashlane-ignore="true" data-form-type="other" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#eff6ff', fontSize: '0.9rem', direction: 'ltr', textAlign: 'left' }} />
          </div>
          <button type="submit" style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
            {isSignUp ? 'הרשמה למערכת' : 'התחבר'}
          </button>
        </form>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: '500', padding: 0 }}
          >
            {isSignUp ? 'כבר יש לך חשבון? התחבר' : 'אין לך חשבון? הירשם עכשיו!'}
          </button>
          {!isSignUp && (
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              שכחת סיסמה?
            </button>
          )}
        </div>
      </div>

      {forgotOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir="rtl">
          <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'right', position: 'relative' }}>
            <button onClick={() => setForgotOpen(false)} style={{ position: 'absolute', top: '14px', left: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>
            <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '8px', fontWeight: '700' }}>שחזור סיסמה</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>הזן את כתובת האימייל שלך לקבלת קישור איפוס</p>
            
            {resetMsg && (
              <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: resetMsg.includes('Error') ? '#fee2e2' : '#dcfce7', color: resetMsg.includes('Error') ? '#991b1b' : '#166534', fontWeight: 'normal' }}>
                {resetMsg}
              </div>
            )}

            <form onSubmit={handleResetSubmit}>
              <input 
                type="email" 
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)} 
                placeholder="user@example.com" 
                required 
                style={{ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', marginBottom: '12px', direction: 'ltr', textAlign: 'left', fontSize: '0.9rem' }} 
              />
              <button type="submit" disabled={resetLoading} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer' }}>
                {resetLoading ? 'שולח...' : 'שלח קישור לשחזור'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}