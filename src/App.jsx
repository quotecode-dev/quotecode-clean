import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import LandingGlobal from './pages/LandingGlobal';
import LandingLocal from './pages/LandingLocal';
import Dashboard from './pages/Dashboard';
import PublicQuote from './pages/PublicQuote';
import PublicTools from './components/PublicTools';
import PublicToolsEn from './components/PublicToolsEn';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Contact from './pages/Contact';
import { supabase } from './supabase';
import { isHebrewEnv } from './utils/regionConfig';

function RootHandler() {
  const navigate = useNavigate();

  const search = window.location.search;
  const hash = window.location.hash;
  const isEnglishQuery = search.includes('lang=en') || search.includes('en=true');

  const storedLang = localStorage.getItem('proflow_lang');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const browserLang = navigator.language || navigator.userLanguage || '';
  
  const isHebrewUser = storedLang === 'he' || (!storedLang && (timeZone === 'Asia/Jerusalem' || browserLang.toLowerCase().startsWith('he')));

  useEffect(() => {
    if (hash.includes('type=recovery') || search.includes('type=recovery')) {
      navigate('/dashboard' + hash + search, { replace: true });
      return;
    }

    if (isEnglishQuery) {
      localStorage.setItem('proflow_lang', 'en');
      return;
    }

    if (isHebrewUser) {
      localStorage.setItem('proflow_lang', 'he');
      if (window.location.pathname === '/') {
        navigate('/he', { replace: true });
      }
    } else {
      localStorage.setItem('proflow_lang', 'en');
    }
  }, [navigate, hash, search, isEnglishQuery, isHebrewUser]);

  // פתרון הברזל לריצוד: החלטה סינכרונית מיידית ברינדור הראשון
  if (isHebrewUser && !isEnglishQuery) {
    return <LandingLocal />;
  }

  return <LandingGlobal />;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  const queryParams = new URLSearchParams(window.location.search);
  
  const currentCountry = session?.user?.user_metadata?.country || (window.location.pathname.startsWith('/he') ? 'Local' : 'International');
  const isHebrew = isHebrewEnv(currentCountry, session) || 
                   window.location.pathname.startsWith('/he') || 
                   queryParams.get('lang') === 'he';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        setRecoveryEmail(session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // חוק הברזל: מעדכן את הסשן רק אם המשתמש התחבר/התנתק בפועל או ה-ID השתנה,
      // כדי למנוע איפוס טפסים וריענוני סרק מיותרים כשחוזרים לטאב מהדפדפן.
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
      redirectTo: window.location.origin + (!isHebrew ? '/dashboard?lang=en' : '/dashboard'),
    });

    setForgotLoading(false);

    if (error) {
      setForgotMessage(!isHebrew ? 'Error: ' + error.message : 'שגיאה בשליחה: ' + error.message);
    } else {
      setForgotMessage(!isHebrew ? 'Recovery link sent successfully to your email.' : 'קישור לשחזור סיסמה נשלח בהצלחה לכתובת המייל שלך.');
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

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdateLoading(false);

    if (error) {
      setUpdateMessage(!isHebrew ? 'Error updating password: ' + error.message : 'שגיאה בעדכון הסיסמה: ' + error.message);
    } else {
      if (window.PasswordCredential) {
        try {
          const userEmail = recoveryEmail || data?.user?.email;
          if (userEmail) {
            navigator.credentials.store(new PasswordCredential({
              id: userEmail,
              password: newPassword
            }));
          }
        } catch (err) {
          console.error(err);
        }
      }

      setUpdateMessage(!isHebrew ? 'Password updated successfully! Redirecting...' : 'הסיסמה עודכנה בהצלחה! מעביר אותך למערכת...');
      setTimeout(() => {
        setRecoveryMode(false);
        window.location.href = !isHebrew ? '/dashboard?lang=en' : '/dashboard';
      }, 2000);
    }
  };

  return (
    <BrowserRouter>
      {/* חלון שחזור סיסמה */}
      {forgotPasswordOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, direction: !isHebrew ? 'ltr' : 'rtl', fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center', position: 'relative' }}>
            <button 
              onClick={() => setForgotPasswordOpen(false)}
              style={{ position: 'absolute', top: '15px', [!isHebrew ? 'right' : 'left']: '15px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
            <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>{!isHebrew ? 'Password Recovery' : 'שחזור סיסמה'}</h2>
            <p style={{ color: '#334155', fontSize: '15px', marginBottom: '20px', fontWeight: '500' }}>
              {!isHebrew ? 'Enter your email address to recover your password' : 'לשחזור סיסמה הקלד את כתובת המייל שלך'}
            </p>
            <form onSubmit={handleSendRecovery}>
              <input
                type="email"
                placeholder={!isHebrew ? 'Email address' : 'כתובת אימייל'}
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', textAlign: !isHebrew ? 'left' : 'right' }}
              />
              <button
                type="submit"
                disabled={forgotLoading}
                style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {forgotLoading ? (!isHebrew ? 'Sending...' : 'שולח...') : (!isHebrew ? 'Send Recovery Link' : 'שלח לשחזור סיסמה')}
              </button>
            </form>
            {forgotMessage && <p style={{ marginTop: '15px', color: forgotMessage.includes('שגיאה') || forgotMessage.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>{forgotMessage}</p>}
          </div>
        </div>
      )}

      {/* חלון עדכון סיסמה חדשה */}
      {recoveryMode && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, direction: !isHebrew ? 'ltr' : 'rtl', fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>{!isHebrew ? 'Set New Password' : 'איפוס סיסמה חדשה'}</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>{!isHebrew ? 'Enter your new account password' : 'הזן את הסיסמה החדשה שלך לחשבון'}</p>
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
                placeholder={!isHebrew ? 'New password' : 'סיסמה חדשה'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box', textAlign: !isHebrew ? 'left' : 'right' }}
              />
              <button
                type="submit"
                disabled={updateLoading}
                style={{ width: '100%', padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {updateLoading ? (!isHebrew ? 'Updating...' : 'מעדכן...') : (!isHebrew ? 'Update Password & Save' : 'עדכן סיסמה ושמור')}
              </button>
            </form>
            {updateMessage && <p style={{ marginTop: '15px', color: updateMessage.includes('שגיאה') || updateMessage.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px' }}>{updateMessage}</p>}
          </div>
        </div>
      )}

      <Routes>
        <Route path="/" element={<RootHandler />} />
        <Route path="/he" element={<LandingLocal />} />
        <Route path="/en" element={<LandingGlobal />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tools" element={<PublicTools />} />
        <Route path="/en/tools" element={<PublicToolsEn />} />
        <Route path="/public-quote/:id" element={<PublicQuote />} />
        <Route path="/quote/:id" element={<PublicQuote />} />
        
        {/* --- דפים משפטיים וצור קשר --- */}
        <Route path="/he/terms" element={<Terms isHebrew={true} />} />
        <Route path="/he/privacy" element={<Privacy isHebrew={true} />} />
        <Route path="/he/contact" element={<Contact isHebrew={true} />} />
        
        <Route path="/en/terms" element={<Terms isHebrew={false} />} />
        <Route path="/en/privacy" element={<Privacy isHebrew={false} />} />
        <Route path="/en/contact" element={<Contact isHebrew={false} />} />

        <Route path="*" element={<LandingGlobal />} />
      </Routes>
    </BrowserRouter>
  );
}