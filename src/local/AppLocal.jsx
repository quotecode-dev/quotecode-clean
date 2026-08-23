import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingLocal from '../pages/LandingLocal';
import Dashboard from '../pages/Dashboard';
import AILogs from '../pages/AILogs';
import SmartPublicQuote from '../components/SmartPublicQuote';
import PublicTools from '../components/PublicTools';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import Contact from '../pages/Contact';
import { supabase } from '../shared/supabase';

export default function AppLocal() {
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
      setForgotMessage('שגיאה בשליחה: ' + error.message);
    } else {
      setForgotMessage('קישור לשחזור סיסמה נשלח בהצלחה לכתובת המייל שלך.');
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
      setUpdateMessage('שגיאה בעדכון הסיסמה: ' + error.message);
    } else {
      setUpdateMessage('הסיסמה עודכנה בהצלחה! מעביר אותך למערכת...');
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
          alignItems: 'center', zIndex: 9999, direction: 'rtl', fontFamily: "'Rubik', Arial, sans-serif"
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center', position: 'relative' }}>
            <button 
              onClick={() => setForgotPasswordOpen(false)}
              style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
            <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>שחזור סיסמה</h2>
            <p style={{ color: '#334155', fontSize: '15px', marginBottom: '20px', fontWeight: '500' }}>
              לשחזור סיסמה הקלד את כתובת המייל שלך
            </p>
            <form onSubmit={handleSendRecovery}>
              <input
                type="email"
                placeholder="כתובת אימייל"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', textAlign: 'right' }}
              />
              <button
                type="submit"
                disabled={forgotLoading}
                style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {forgotLoading ? 'שולח...' : 'שלח לשחזור סיסמה'}
              </button>
            </form>
            {forgotMessage && <p style={{ marginTop: '15px', color: forgotMessage.includes('שגיאה') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>{forgotMessage}</p>}
          </div>
        </div>
      )}

      {recoveryMode && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, direction: 'rtl', fontFamily: "'Rubik', Arial, sans-serif"
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>איפוס סיסמה חדשה</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>הזן את הסיסמה החדשה שלך לחשבון</p>
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
                placeholder="סיסמה חדשה"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', textAlign: 'right' }}
              />
              <button
                type="submit"
                disabled={updateLoading}
                style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {updateLoading ? 'מעדכן...' : 'עדכן סיסמה ושמור'}
              </button>
            </form>
            {updateMessage && <p style={{ marginTop: '15px', color: updateMessage.includes('שגיאה') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>{updateMessage}</p>}
          </div>
        </div>
      )}

      <Routes>
        <Route path="/" element={<LandingLocal />} />
        <Route path="/he" element={<LandingLocal />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai-logs" element={<AILogs />} />
        <Route path="/tools" element={<PublicTools />} />
        <Route path="/he/tools" element={<PublicTools />} />
        <Route path="/public-quote/:id" element={<SmartPublicQuote />} />
        <Route path="/quote/:id" element={<SmartPublicQuote />} />

        <Route path="/terms" element={<Terms isHebrew={true} />} />
        <Route path="/he/terms" element={<Terms isHebrew={true} />} />
        <Route path="/privacy" element={<Privacy isHebrew={true} />} />
        <Route path="/he/privacy" element={<Privacy isHebrew={true} />} />
        <Route path="/contact" element={<Contact isHebrew={true} />} />
        <Route path="/he/contact" element={<Contact isHebrew={true} />} />

        <Route path="*" element={<LandingLocal />} />
      </Routes>
    </BrowserRouter>
  );
}