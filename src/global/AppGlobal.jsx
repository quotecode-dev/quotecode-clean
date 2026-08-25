// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי וסטריקט (AppGlobal.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה.
// ==========================================

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingGlobal from '../pages/LandingGlobal';
import Dashboard from '../pages/Dashboard';
import AILogs from '../pages/AILogs';
import SmartPublicQuote from '../components/SmartPublicQuote';
import PublicToolsEn from '../components/PublicToolsEn';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import Contact from '../pages/Contact';
import { supabase } from '../shared/supabase';

export default function AppGlobal() {
  const [, setSession] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    // חוק ברזל: הבאנדל הגלובלי מייצג תמיד אנגלית/LTR - זהו המקום המרכזי
    // היחיד שקובע את document.documentElement.lang/dir עבור כל האפליקציה
    // (לא נגזר מ-business_settings/מטבע הצעה/עוגיית geo - זו שפת/כיוון
    // ה-UI בלבד). דפי הצעת מחיר ציבוריים (PublicQuote/PublicQuoteEn) קובעים
    // זאת בעצמם בנפרד כי הם יכולים להציג את השפה הנגדית לבאנדל שמארח אותם.
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        setRecoveryEmail(session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession((prevSession) => {
        if (prevSession?.user?.id !== newSession?.user?.id) {
          return newSession;
        }
        return prevSession;
      });

      if (newSession?.user?.email) {
        setRecoveryEmail(newSession.user.email);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
    });

    if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
      setRecoveryMode(true);
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setRecoveryEmail(user.email);
      });
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSendRecovery = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin + '/dashboard',
    });

    setForgotLoading(false);

    if (error) {
      setForgotMessage('Error: ' + error.message);
    } else {
      setForgotMessage('Password recovery link sent successfully.');
      setTimeout(() => {
        setForgotPasswordOpen(false);
        setForgotMessage('');
        setForgotEmail('');
      }, 3000);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    setUpdateMessage('');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdateLoading(false);

    if (error) {
      setUpdateMessage('Error updating password: ' + error.message);
    } else {
      setUpdateMessage('Password updated successfully! Redirecting...');
      setTimeout(() => {
        setRecoveryMode(false);
        window.location.href = '/dashboard';
      }, 2000);
    }
  };

  return (
    <BrowserRouter>
      {forgotPasswordOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, direction: 'ltr', fontFamily: "'Rubik', Arial, sans-serif"
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center', position: 'relative' }}>
            <button 
              onClick={() => setForgotPasswordOpen(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
            <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>Password Recovery</h2>
            <p style={{ color: '#334155', fontSize: '15px', marginBottom: '20px', fontWeight: '500' }}>
              Enter your email address to recover your password
            </p>
            <form onSubmit={handleSendRecovery}>
              <input
                type="email"
                placeholder="Email Address"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', textAlign: 'left' }}
              />
              <button
                type="submit"
                disabled={forgotLoading}
                style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {forgotLoading ? 'Sending...' : 'Send Recovery Link'}
              </button>
            </form>
            {forgotMessage && <p style={{ marginTop: '15px', color: forgotMessage.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>{forgotMessage}</p>}
          </div>
        </div>
      )}

      {recoveryMode && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, direction: 'ltr', fontFamily: "'Rubik', Arial, sans-serif"
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>Reset Password</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Enter your new password</p>
            <form onSubmit={handleUpdatePassword}>
              <input
                type="text"
                name="username"
                value={recoveryEmail}
                readOnly
                autoComplete="username"
                style={{ display: 'none' }}
              />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', textAlign: 'left' }}
              />
              <button
                type="submit"
                disabled={updateLoading}
                style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {updateLoading ? 'Updating...' : 'Update & Save'}
              </button>
            </form>
            {updateMessage && <p style={{ marginTop: '15px', color: updateMessage.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>{updateMessage}</p>}
          </div>
        </div>
      )}

      <Routes>
        <Route path="/" element={<LandingGlobal />} />
        <Route path="/en" element={<LandingGlobal />} />
        {/* bundleIsHebrew=false: מקור אמת מפורש עבור ברירות המחדל של חשבון
            חדש (מדינה/מטבע/תקנון) בהרשמה - ראו הערה מקבילה ב-Dashboard.jsx */}
        <Route path="/dashboard" element={<Dashboard bundleIsHebrew={false} />} />
        <Route path="/ai-logs" element={<AILogs />} />
        <Route path="/tools" element={<PublicToolsEn />} />
        <Route path="/en/tools" element={<PublicToolsEn />} />
        {/* שפת/מע"מ ההצעה נגזרים מנתוני ההצעה השמורים (currency/tax_rate), לא מהיותנו בבאנדל הגלובלי */}
        <Route path="/public-quote/:id" element={<SmartPublicQuote />} />
        <Route path="/quote/:id" element={<SmartPublicQuote />} />
        <Route path="/en/public-quote/:id" element={<SmartPublicQuote />} />

        <Route path="/terms" element={<Terms isHebrew={false} />} />
        <Route path="/en/terms" element={<Terms isHebrew={false} />} />
        <Route path="/privacy" element={<Privacy isHebrew={false} />} />
        <Route path="/en/privacy" element={<Privacy isHebrew={false} />} />
        <Route path="/contact" element={<Contact isHebrew={false} />} />
        <Route path="/en/contact" element={<Contact isHebrew={false} />} />

        <Route path="*" element={<LandingGlobal />} />
      </Routes>
    </BrowserRouter>
  );
}