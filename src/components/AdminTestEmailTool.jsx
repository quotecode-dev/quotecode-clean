import { useState } from 'react';
import { Send, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { invokeWithFreshSession } from '../shared/invokeWithFreshSession';
import { getFunctionErrorMessage } from '../utils/functionError';
import { t } from '../domain/admin/adminCopy';

// Admin diagnostics: the existing legacy test-email tool, moved unchanged in behaviour from the users screen to System activity ›
// Diagnostic tools (Owner 2026-10-16, admin spec §4.5 / D-08 + the approved activity sketch). It sends a REAL email (Resend) in test
// mode only - never touches automatic reminder flags and has no effect on the daily schedule. The protected version (allow-listed
// recipient, reason + password, audit) is part B of the spec.
export default function AdminTestEmailTool({ isHebrew }) {
  const [testEmail, setTestEmail] = useState('');
  const [testType, setTestType] = useState('trial');
  const [testStage, setTestStage] = useState('3d');
  const [testStatus, setTestStatus] = useState({ type: null, msg: '' });
  const [sendingTestLang, setSendingTestLang] = useState(null);

  const handleSendTestEmail = async (sendHebrew) => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestStatus({ type: 'error', msg: isHebrew ? 'הזן כתובת אימייל תקינה לבדיקה' : 'Enter a valid test email address' });
      return;
    }
    setSendingTestLang(sendHebrew ? 'he' : 'en');
    setTestStatus({ type: null, msg: '' });
    try {
      // the server function verifies super_admin from the caller's own JWT, so a fresh access token must be present
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (sessionErr || !accessToken) {
        throw new Error(isHebrew
          ? 'ההתחברות פגה. אנא רענן את העמוד והתחבר מחדש לפני שליחת מייל בדיקה.'
          : 'Your session has expired. Please refresh the page and log in again before sending a test email.');
      }
      const functionName = testType === 'subscription' ? 'send-subscription-expiration-email' : 'send-trial-expiration-email';
      const { data, error } = await invokeWithFreshSession(functionName, {
        body: { mode: 'test', email: testEmail, isHebrew: sendHebrew, stage: testStage, businessName: sendHebrew ? 'עסק לדוגמה' : 'Test Business' },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, isHebrew ? 'שליחת מייל הבדיקה נכשלה' : 'Failed to send test email'));
      if (data?.error) throw new Error(data.error);
      setTestStatus({
        type: 'success',
        msg: isHebrew
          ? `נשלח בהצלחה ל-${testEmail} (${sendHebrew ? 'עברית' : 'אנגלית'}, ${testType === 'subscription' ? 'תפוגת מנוי - תבנית מורשת' : 'תום ניסיון - תבנית מורשת'})`
          : `Sent successfully to ${testEmail} (${sendHebrew ? 'Hebrew' : 'English'}, ${testType === 'subscription' ? 'subscription expiration - legacy template' : 'trial expiration - legacy template'})`,
      });
    } catch (err) {
      setTestStatus({ type: 'error', msg: err.message });
    } finally {
      setSendingTestLang(null);
    }
  };

  return (
    <article className="av-card av-section" aria-label={t(isHebrew, 'כלי אבחון', 'Diagnostic tools')}>
      <h3>{t(isHebrew, 'כלי אבחון', 'Diagnostic tools')}</h3>
      <details>
        <summary style={{ minHeight: 44, cursor: 'pointer', alignContent: 'center' }}>{t(isHebrew, 'מיילי בדיקה ותבניות מורשת', 'Test email & legacy templates')}</summary>
        <p className="av-muted av-small">{t(isHebrew, 'שולח מייל אמיתי במצב בדיקה בלבד - אינו נוגע בתזכורות האוטומטיות ואינו משפיע על התזמון היומי. אין הפעלה של תזכורות ניסיון.', 'Sends a real email in test mode only - never touches the automatic reminders and has no effect on the daily schedule. This does not activate trial reminders.')}</p>
        <div className="av-toolbar">
          <label className="av-field av-search">
            <span>{t(isHebrew, 'נמען בדיקה', 'Test recipient')}</span>
            <input type="email" dir="ltr" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </label>
          <label className="av-field">
            <span>{t(isHebrew, 'תבנית', 'Template')}</span>
            <select value={testType} onChange={(e) => setTestType(e.target.value)}>
              <option value="trial">{t(isHebrew, 'תום ניסיון · תבנית מורשת', 'Trial expiration · legacy template')}</option>
              <option value="subscription">{t(isHebrew, 'תפוגת מנוי · תבנית מורשת', 'Subscription expiration · legacy template')}</option>
            </select>
          </label>
          <label className="av-field">
            <span>{t(isHebrew, 'שלב התבנית', 'Template stage')}</span>
            <select value={testStage} onChange={(e) => setTestStage(e.target.value)}>
              <option value="3d">{t(isHebrew, '3 ימים לפני', '3 days before')}</option>
              <option value="24h">{t(isHebrew, '24 שעות לפני', '24 hours before')}</option>
            </select>
          </label>
        </div>
        <div className="av-pills">
          {/* PRODUCT_TRUTH_DECORATIVE: sends a real Hebrew test expiration-reminder email; internal admin diagnostic tool */}
          <button type="button" className="av-btn" onClick={() => handleSendTestEmail(true)} disabled={sendingTestLang !== null}>
            <Send size={15} aria-hidden="true" />{sendingTestLang === 'he' ? t(isHebrew, 'שולח...', 'Sending...') : t(isHebrew, 'שליחת בדיקה בעברית', 'Send Hebrew test')}
          </button>
          {/* PRODUCT_TRUTH_DECORATIVE: sends a real English test expiration-reminder email; internal admin diagnostic tool */}
          <button type="button" className="av-btn" onClick={() => handleSendTestEmail(false)} disabled={sendingTestLang !== null}>
            <Send size={15} aria-hidden="true" />{sendingTestLang === 'en' ? t(isHebrew, 'שולח...', 'Sending...') : t(isHebrew, 'שליחת בדיקה באנגלית', 'Send English test')}
          </button>
        </div>
        {testStatus.msg && (
          <div className={`av-notice ${testStatus.type === 'success' ? 'av-info' : 'av-bad'} av-section`} role="status" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {testStatus.type === 'success' ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
            {testStatus.msg}
          </div>
        )}
        <p className="av-tiny av-muted av-section">{t(isHebrew, 'הארכת ניסיון ותיק: אינה זמינה עד הכרעת הבעלים והוכחת השפעה בשרת.', 'Legacy trial extension: unavailable until an owner decision and verified server effect.')}</p>
      </details>
    </article>
  );
}
