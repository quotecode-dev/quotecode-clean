// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AuthScreen.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import ProFlowLogo from './ProFlowLogo';
import { CheckCircle2, AlertTriangle, Mail, Lock, LogIn, Rocket, KeyRound, X } from 'lucide-react';
import { NEON, FONT_HE, FONT_EN, neonGlowTextStyle } from '../theme/neonTheme';

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
  const isHebURL = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/he') ||
    window.location.search.includes('lang=he') ||
    localStorage.getItem('proflow_lang') === 'he'
  );

  const isEnglishEnv = typeof window !== 'undefined' && (
    window.location.search.includes('lang=en') ||
    window.location.pathname.includes('/global') ||
    (!isHebURL && (navigator.language || '').toLowerCase().startsWith('en'))
  );

  const isHebrew = isHebURL || (!isEnglishEnv && isHebURL);
  const font = isHebrew ? FONT_HE : FONT_EN;

  if (isInitializing) {
    return (
      <div style={{ fontFamily: font, background: NEON.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEON.textPrimary }}>
        <div style={{ textAlign: 'center' }}>
          <ProFlowLogo size={48} rtl={false} />
          <div style={{ marginTop: '20px', fontSize: '1rem', color: NEON.textSecondary, fontWeight: 'bold' }}>
            {isHebrew ? 'טוען את המערכת...' : 'Loading system...'}
          </div>
        </div>
      </div>
    );
  }

  if (isPasswordRecoveryMode) {
    return (
      <div style={{ fontFamily: font, background: NEON.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, padding: '30px', borderRadius: '14px', boxShadow: '0 20px 40px -12px rgba(139,92,246,0.25)', width: '100%', maxWidth: '380px', textAlign: isHebrew ? 'right' : 'left' }}>
          <h2 style={{ marginBottom: '12px', fontWeight: '800', ...neonGlowTextStyle }}>{isHebrew ? 'הגדרת סיסמה חדשה' : 'Set New Password'}</h2>
          <p style={{ color: NEON.textSecondary, fontSize: '0.85rem', marginBottom: '18px' }}>{isHebrew ? 'הזן את הסיסמה החדשה לחשבון שלך' : 'Enter your new account password'}</p>

          {recoveryUpdateMsg && (
            <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: recoveryUpdateMsg.includes('Error') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: recoveryUpdateMsg.includes('Error') ? NEON.red : NEON.emerald, fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {recoveryUpdateMsg.includes('Error') ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              {recoveryUpdateMsg}
            </div>
          )}

          <form onSubmit={handleUpdatePasswordFromRecovery}>
            <input
              type="password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder={isHebrew ? 'סיסמה חדשה' : 'New password'}
              required
              style={{ width: '100%', padding: '10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', marginBottom: '12px', fontSize: '0.95rem', direction: isHebrew ? 'rtl' : 'ltr', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <button type="submit" disabled={recoveryUpdateLoading} style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}>
              {recoveryUpdateLoading ? (isHebrew ? 'מעדכן...' : 'Updating...') : (isHebrew ? 'עדכן סיסמה ושמור' : 'Update Password & Save')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: font, background: NEON.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 20% 15%, rgba(139, 92, 246, 0.16) 0%, rgba(5, 5, 6, 0) 55%), radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.12) 0%, rgba(5, 5, 6, 0) 55%)',
        pointerEvents: 'none'
      }} />
      <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, padding: '30px', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(139,92,246,0.25)', width: '100%', maxWidth: '380px', textAlign: isHebrew ? 'right' : 'left', position: 'relative' }}>

        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ProFlowLogo size={36} rtl={isHebrew} />

          {isSignUp ? (
            <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', padding: '10px 14px', borderRadius: '8px', marginTop: '14px', marginBottom: '4px', color: NEON.violetLighter, fontSize: '0.85rem', fontWeight: 'normal', textAlign: isHebrew ? 'right' : 'left', width: '100%', boxSizing: 'border-box', lineHeight: '1.5' }}>
              {isHebrew
                ? 'כדי להירשם ולקבל את תקופת הניסיון החינמית למשך 14 יום במסלול PRO, אנא הזן את האימייל והסיסמה שלך.'
                : 'To sign up and get your 14-day free trial on the PRO plan, please enter your email and password.'}
            </div>
          ) : (
            <p style={{ color: NEON.textSecondary, fontSize: '0.9rem', marginTop: '10px', fontWeight: 'normal' }}>
              {isHebrew ? 'התחבר למערכת הניהול שלך' : 'Sign in to your management dashboard'}
            </p>
          )}
        </div>

        {authSuccess && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem', background: 'rgba(16,185,129,0.12)', color: NEON.emerald, textAlign: isHebrew ? 'right' : 'left', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} />{authSuccess}</div>}
        {authError && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.12)', color: NEON.red, textAlign: isHebrew ? 'right' : 'left', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} />{authError}</div>}

        <form onSubmit={handleAuth} autoComplete="off" data-lpignore="true">
          <input type="text" name="fake_user_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />
          <input type="password" name="fake_pass_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '4px' }}>
              <Mail size={13} color={NEON.violetLight} />
              {isHebrew ? 'כתובת אימייל' : 'Email Address'}
            </label>
            <input type="email" name="user_email_field" autoComplete="off" data-lpignore="true" data-bwignore="true" data-1p-ignore data-dashlane-ignore="true" data-form-type="other" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required placeholder="user@example.com" style={{ width: '100%', padding: '9px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.9rem' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '4px' }}>
              <Lock size={13} color={NEON.violetLight} />
              {isHebrew ? 'סיסמה' : 'Password'}
            </label>
            <input type="password" name="user_password_field" autoComplete="off" data-lpignore="true" data-bwignore="true" data-1p-ignore data-dashlane-ignore="true" data-form-type="other" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '9px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.9rem', direction: 'ltr', textAlign: 'left' }} />
          </div>
          <button type="submit" style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', boxShadow: NEON.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isSignUp ? <Rocket size={16} strokeWidth={2.5} /> : <LogIn size={16} strokeWidth={2.5} />}
            {isSignUp ? (isHebrew ? 'הרשמה למערכת' : 'Sign Up') : (isHebrew ? 'התחבר' : 'Sign In')}
          </button>
        </form>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'none', border: 'none', color: NEON.violetLight, cursor: 'pointer', fontWeight: '600', padding: 0 }}
          >
            {isSignUp
              ? (isHebrew ? 'כבר יש לך חשבון? התחבר' : 'Already have an account? Sign in')
              : (isHebrew ? 'אין לך חשבון? הירשם עכשיו!' : "Don't have an account? Sign up!")}
          </button>
          {!isSignUp && (
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              style={{ background: 'none', border: 'none', color: NEON.textSecondary, cursor: 'pointer', textDecoration: 'underline', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <KeyRound size={12} />
              {isHebrew ? 'שכחת סיסמה?' : 'Forgot password?'}
            </button>
          )}
        </div>
      </div>

      {forgotOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)', textAlign: isHebrew ? 'right' : 'left', position: 'relative' }}>
            <button onClick={() => setForgotOpen(false)} style={{ position: 'absolute', top: '14px', left: isHebrew ? '14px' : 'unset', right: isHebrew ? 'unset' : '14px', background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, display: 'flex' }}><X size={18} /></button>
            <h3 style={{ marginTop: 0, fontSize: '1.2rem', marginBottom: '8px', fontWeight: '800', ...neonGlowTextStyle }}>
              {isHebrew ? 'שחזור סיסמה' : 'Password Recovery'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.85rem', marginBottom: '16px' }}>
              {isHebrew ? 'הזן את כתובת האימייל שלך לקבלת קישור איפוס' : 'Enter your email address to receive a reset link'}
            </p>

            {resetMsg && (
              <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: resetMsg.includes('Error') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: resetMsg.includes('Error') ? NEON.red : NEON.emerald, fontWeight: 'normal' }}>
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
                style={{ width: '100%', padding: '9px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', marginBottom: '12px', direction: 'ltr', textAlign: 'left', fontSize: '0.9rem', background: NEON.bgInput, color: NEON.textPrimary }}
              />
              <button type="submit" disabled={resetLoading} style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}>
                {resetLoading ? (isHebrew ? 'שולח...' : 'Sending...') : (isHebrew ? 'שלח קישור לשחזור' : 'Send Reset Link')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
