// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AuthScreen.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import ProFlowLogo from './ProFlowLogo';
import TurnstileWidget from './TurnstileWidget';
import { CheckCircle2, AlertTriangle, Mail, Lock, LogIn, Rocket, KeyRound, X } from 'lucide-react';
import { NEON, FONT_HE, FONT_EN, neonGlowTextStyle } from '../theme/neonTheme';

export default function AuthScreen({
  bundleIsHebrew,
  isInitializing,
  startupStuck = false,
  onStartupRetry = null,
  onStartupSignOut = null,
  isPasswordRecoveryMode,
  newPasswordInput,
  setNewPasswordInput,
  confirmPasswordInput,
  setConfirmPasswordInput,
  handleUpdatePasswordFromRecovery,
  recoveryUpdateLoading,
  recoveryUpdateMsg,
  recoveryUpdateMsgIsError,
  isSignUp,
  setIsSignUp,
  authSuccess,
  authError,
  verifyResendEmail = null,
  verifyResendState = 'idle',
  onResendVerification = null,
  handleAuth,
  authLoading,
  emailInput,
  setEmailInput,
  passwordInput,
  setPasswordInput,
  signupFullName = '',
  setSignupFullName = () => {},
  signupBusinessName = '',
  setSignupBusinessName = () => {},
  signupTermsAccepted = false,
  setSignupTermsAccepted = () => {},
  forgotOpen,
  setForgotOpen,
  resetMsg,
  resetMsgIsError,
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

  // חוק ברזל: bundleIsHebrew (המגיע מ-Dashboard.jsx, שמקבל אותו מ-AppLocal/
  // AppGlobal - שתי קריאות ה-<Dashboard> החיות היחידות) הוא מקור האמת
  // המועדף לשפת מסכי הטרום-אימות/טעינה - לא ניחוש עצמאי מ-pathname/
  // ?lang=/localStorage שיכול להיות מיושן/שגוי ובלתי-תלוי בבאנדל בפועל.
  // הקסקדה הישנה נשמרת כרשת ביטחון בלבד למקרה שהרכיב הזה יירונדר בלי
  // bundleIsHebrew כ-boolean אמיתי.
  const isHebrew = typeof bundleIsHebrew === 'boolean' ? bundleIsHebrew : (isHebURL || (!isEnglishEnv && isHebURL));
  const font = isHebrew ? FONT_HE : FONT_EN;

  if (isInitializing) {
    return (
      <div style={{ fontFamily: font, background: NEON.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEON.textPrimary }}>
        <div style={{ textAlign: 'center' }}>
          <ProFlowLogo size={48} rtl={false} />
          <div style={{ marginTop: '20px', fontSize: '1rem', color: NEON.textSecondary, fontWeight: 'bold' }}>
            {isHebrew ? 'טוען את המערכת…' : 'Loading system...'}
          </div>
          {/* Night task 2026-10-16 (R-12, Owner-approved L-10 / L-15): the account details keep failing to load - say so, offer a way out */}
          {startupStuck && (
            <div data-testid="startup-stuck" style={{ marginTop: '16px', maxWidth: '360px', marginInline: 'auto', padding: '0 16px' }}>
              <p role="alert" style={{ fontSize: '0.9rem', color: NEON.textSecondary, margin: '0 0 14px' }}>
                {isHebrew ? 'לא הצלחנו לטעון את פרטי החשבון שלך. אנחנו ממשיכים לנסות; אפשר גם לנסות שוב עכשיו או להתנתק.' : "We couldn't load your account details. We keep trying; you can also try again now or sign out."}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: retries loading the account at once, without reloading the page - night task R-12 */}
                <button type="button" onClick={() => onStartupRetry?.()} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: NEON.gradient, color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                  {isHebrew ? 'לנסות שוב' : 'Try again'}
                </button>
                {/* PRODUCT_TRUTH_DECORATIVE: signs out of this device from the stuck loading screen - night task R-12 */}
                <button type="button" onClick={() => onStartupSignOut?.()} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${NEON.borderStrong}`, background: 'transparent', color: NEON.textPrimary, fontWeight: '700', cursor: 'pointer' }}>
                  {isHebrew ? 'התנתקות' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isPasswordRecoveryMode) {
    return (
      <div style={{ fontFamily: font, background: NEON.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, padding: '30px', borderRadius: '14px', boxShadow: '0 20px 40px -12px rgba(139,92,246,0.25)', width: '100%', maxWidth: '380px', textAlign: isHebrew ? 'right' : 'left' }}>
          <h2 style={{ marginBottom: '12px', fontWeight: '800', ...neonGlowTextStyle }}>{isHebrew ? 'הגדרת סיסמה חדשה' : 'Set New Password'}</h2>
          <p style={{ color: NEON.textSecondary, fontSize: '0.85rem', marginBottom: '18px' }}>{isHebrew ? 'הזינו את הסיסמה החדשה לחשבון שלכם' : 'Enter your new account password'}</p>

          {recoveryUpdateMsg && (
            // Auth Lifecycle Forensic Audit (2026-09-09): was
            // `recoveryUpdateMsg.includes('Error')` - never true for a
            // Hebrew message (the English word "Error" never appears in
            // "שגיאה בעדכון הסיסמה: ..."), which rendered a genuine failure
            // with success/green styling. `recoveryUpdateMsgIsError` is set
            // explicitly by the caller from normalizeAuthError()'s own
            // result, not guessed from message text.
            <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: recoveryUpdateMsgIsError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: recoveryUpdateMsgIsError ? NEON.red : NEON.emerald, fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {recoveryUpdateMsgIsError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              {recoveryUpdateMsg}
            </div>
          )}

          <form onSubmit={handleUpdatePasswordFromRecovery}>
            <input
              type="password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder={isHebrew ? 'סיסמה חדשה' : 'New password'}
              autoComplete="new-password"
              required
              style={{ width: '100%', padding: '10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', marginBottom: '12px', fontSize: '0.95rem', direction: isHebrew ? 'rtl' : 'ltr', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <input
              type="password"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              placeholder={isHebrew ? 'אימות סיסמה חדשה' : 'Confirm new password'}
              autoComplete="new-password"
              required
              style={{ width: '100%', padding: '10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', marginBottom: '12px', fontSize: '0.95rem', direction: isHebrew ? 'rtl' : 'ltr', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <button type="submit" disabled={recoveryUpdateLoading} style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}>
              {recoveryUpdateLoading ? (isHebrew ? 'מעדכן…' : 'Updating...') : (isHebrew ? 'שמירת הסיסמה החדשה' : 'Update Password & Save')}
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
                ? 'להרשמה, הזינו כתובת מייל וסיסמה. מערכת המסלולים החדשה, ובה 10 הצעות חינם או 7 ימים, המוקדם מביניהם, עדיין לא הופעלה. החשבון נפתח ללא תקופת ניסיון.'
                : 'To sign up, enter your email and password. The new plan system (including 10 free quotes or 7 days, whichever comes first) is not active yet, and the account opens without a trial period.'}
            </div>
          ) : (
            <p style={{ color: NEON.textSecondary, fontSize: '0.9rem', marginTop: '10px', fontWeight: 'normal' }}>
              {isHebrew ? 'כניסה למערכת הניהול' : 'Sign in to your management dashboard'}
            </p>
          )}
        </div>

        {authSuccess && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem', background: 'rgba(16,185,129,0.12)', color: NEON.emerald, textAlign: isHebrew ? 'right' : 'left', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} />{authSuccess}</div>}
        {authError && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.12)', color: NEON.red, textAlign: isHebrew ? 'right' : 'left', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} />{authError}</div>}
        {/* Owner 2026-10-25 (typed L-12): an unverified e-mail - send the verification e-mail again */}
        {verifyResendEmail && !isSignUp && typeof onResendVerification === 'function' && (
          <div style={{ marginBottom: '12px', textAlign: isHebrew ? 'right' : 'left' }} data-testid="auth-resend-verification">
            {verifyResendState === 'sent' ? (
              <div role="status" style={{ fontSize: '0.8rem', color: NEON.emerald }}>{isHebrew ? 'שלחנו שוב את מייל האימות. בדקו גם בתיקיית הספאם.' : 'We sent the verification email again. Check your spam folder too.'}</div>
            ) : (
              // PRODUCT_TRUTH_DECORATIVE: sends the sign-up verification e-mail again (Supabase Auth); changes no product data
              <button type="button" onClick={onResendVerification} disabled={verifyResendState === 'sending'} data-testid="auth-resend-verification-btn"
                style={{ background: 'transparent', border: `1px solid ${NEON.borderStrong}`, color: NEON.textPrimary, borderRadius: '8px', padding: '8px 14px', minHeight: '40px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {verifyResendState === 'sending' ? (isHebrew ? 'שולחים…' : 'Sending…') : (isHebrew ? 'שליחה חוזרת של מייל האימות' : 'Resend the verification email')}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleAuth} autoComplete="off" data-lpignore="true">
          <input type="text" name="fake_user_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />
          <input type="password" name="fake_pass_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '4px' }}>
              <Mail size={13} color={NEON.violetLight} />
              {isHebrew ? 'כתובת מייל' : 'Email Address'}
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
          {/* Owner 2026-10-15: optional full name + business name, and the required (never pre-ticked) Terms + Privacy consent */}
          {isSignUp && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="signup-full-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '4px' }}>
                  {isHebrew ? 'שם מלא (לא חובה)' : 'Full name (optional)'}
                </label>
                {/* PRODUCT_TRUTH_DECORATIVE: optional signup field (full name) - pre-authentication, stored with the new account only */}
                <input id="signup-full-name" type="text" data-testid="signup-full-name" maxLength={120} autoComplete="name" value={signupFullName} onChange={(e) => setSignupFullName(e.target.value)} dir="auto" style={{ width: '100%', padding: '9px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.9rem' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="signup-business-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '4px' }}>
                  {isHebrew ? 'שם העסק / החברה (לא חובה)' : 'Business / company name (optional)'}
                </label>
                {/* PRODUCT_TRUTH_DECORATIVE: optional signup field (business name) - the new account's initial business name */}
                <input id="signup-business-name" type="text" data-testid="signup-business-name" maxLength={120} autoComplete="organization" value={signupBusinessName} onChange={(e) => setSignupBusinessName(e.target.value)} dir="auto" style={{ width: '100%', padding: '9px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.9rem' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: NEON.textSecondary, marginBottom: '16px', lineHeight: 1.5, cursor: 'pointer' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: the required, unticked Terms of Use + Privacy Policy consent of the signup form */}
                <input type="checkbox" data-testid="signup-terms-consent" required checked={signupTermsAccepted} onChange={(e) => setSignupTermsAccepted(e.target.checked)} style={{ marginTop: '3px', flex: 'none', accentColor: NEON.violetLight }} />
                <span>
                  {isHebrew ? 'קראתי את ' : 'I have read and agree to the '}
                  {/* PRODUCT_TRUTH_DECORATIVE: opens the Terms of Use in a new tab (the signup form keeps its input) */}
                  <a href={isHebrew ? '/he/terms' : '/en/terms'} target="_blank" rel="noopener" style={{ color: NEON.violetLight, fontWeight: 600 }}>{isHebrew ? 'תנאי השימוש' : 'Terms of Use'}</a>
                  {isHebrew ? ' ואת ' : ' and the '}
                  {/* PRODUCT_TRUTH_DECORATIVE: opens the Privacy Policy in a new tab (the signup form keeps its input) */}
                  <a href={isHebrew ? '/he/privacy' : '/en/privacy'} target="_blank" rel="noopener" style={{ color: NEON.violetLight, fontWeight: 600 }}>{isHebrew ? 'מדיניות הפרטיות' : 'Privacy Policy'}</a>
                  {isHebrew ? ' ואני מסכים/ה להם.' : ' of TEKANGO.'}
                </span>
              </label>
            </>
          )}
          {/* Owner console 2026-10-20 (L-12): the robot check of the signup / login form */}
          <TurnstileWidget slot="auth" isHebrew={isHebrew} />
          <button type="submit" disabled={authLoading} style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: authLoading ? 'default' : 'pointer', opacity: authLoading ? 0.7 : 1, boxShadow: NEON.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isSignUp ? <Rocket size={16} strokeWidth={2.5} /> : <LogIn size={16} strokeWidth={2.5} />}
            {isSignUp ? (isHebrew ? 'הרשמה למערכת' : 'Sign Up') : (isHebrew ? 'כניסה' : 'Sign In')}
          </button>
        </form>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ background: 'none', border: 'none', color: NEON.violetLight, cursor: 'pointer', fontWeight: '600', padding: 0 }}
          >
            {isSignUp
              ? (isHebrew ? 'כבר יש חשבון? כניסה למערכת' : 'Already have an account? Sign in')
              : (isHebrew ? 'עדיין אין חשבון? הרשמה' : "Don't have an account? Sign up!")}
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
              {isHebrew ? 'הזינו את כתובת המייל שלכם לקבלת קישור איפוס' : 'Enter your email address to receive a reset link'}
            </p>

            {resetMsg && (
              // Same fix as recoveryUpdateMsg above: an explicit flag from
              // the caller's own normalizeAuthError() result, not a
              // substring guess that fails for Hebrew messages.
              <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: resetMsgIsError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: resetMsgIsError ? NEON.red : NEON.emerald, fontWeight: 'normal' }}>
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
              {/* Owner console 2026-10-20 (L-12): the robot check of the password reset form */}
              <TurnstileWidget slot="reset" isHebrew={isHebrew} />
              <button type="submit" disabled={resetLoading} style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}>
                {resetLoading ? (isHebrew ? 'שולח…' : 'Sending...') : (isHebrew ? 'שליחת קישור לשחזור' : 'Send Reset Link')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
