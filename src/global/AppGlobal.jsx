// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי וסטריקט (AppGlobal.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה.
// ==========================================

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingGlobal from '../pages/LandingGlobal';
import Dashboard from '../pages/Dashboard';
import AILogs from '../pages/AILogs';
import SmartPublicQuote from '../components/SmartPublicQuote';
import PublicToolsEn from '../components/PublicToolsEn';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import Contact from '../pages/Contact';
import UpdateAvailableBanner from '../shared/UpdateAvailableBanner';

export default function AppGlobal() {
  useEffect(() => {
    // חוק ברזל: הבאנדל הגלובלי מייצג תמיד אנגלית/LTR - זהו המקום המרכזי
    // היחיד שקובע את document.documentElement.lang/dir עבור כל האפליקציה
    // (לא נגזר מ-business_settings/מטבע הצעה/עוגיית geo - זו שפת/כיוון
    // ה-UI בלבד). דפי הצעת מחיר ציבוריים (PublicQuote/PublicQuoteEn) קובעים
    // זאת בעצמם בנפרד כי הם יכולים להציג את השפה הנגדית לבאנדל שמארח אותם.
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  return (
    <BrowserRouter>
      <UpdateAvailableBanner isHebrew={false} />
      {/* Auth Lifecycle Forensic Audit (2026-09-09, §226): a second, fully
          unreachable "forgot password" modal + handleSendRecovery
          previously lived here - setForgotPasswordOpen was never called
          anywhere in this file, so it could never open. Removed. Auth
          Audit Completion task (2026-09-09, §227/§228): this file ALSO
          carried its own separate, live `recoveryMode` overlay (state +
          handleUpdatePassword + a fixed/zIndex-9999 modal rendered here,
          above every route) - genuinely reachable (unlike the modal
          above), and the exact EN twin of the same live-reproduced defect
          found in AppLocal.jsx: raw provider text ("Error updating
          password: " + error.message) rendered on failure, since it never
          routed through authErrorClassification.js. It duplicated
          Dashboard.jsx's own AuthScreen-hosted recovery UI, which already
          has every fix this file's copy lacked. Removed here too, per
          this task's own "eliminate the duplicate, one canonical
          implementation" instruction - Dashboard.jsx's own recovery flow
          (session null / isPasswordRecoveryMode driven, mounted via the
          /dashboard Route below) is the sole real implementation now. */}

      <Routes>
        <Route path="/" element={<LandingGlobal />} />
        <Route path="/en" element={<LandingGlobal />} />
        {/* bundleIsHebrew=false: מקור אמת מפורש עבור ברירות המחדל של חשבון
            חדש (מדינה/מטבע/תקנון) בהרשמה - ראו הערה מקבילה ב-Dashboard.jsx */}
        <Route path="/dashboard" element={<Dashboard bundleIsHebrew={false} />} />
        <Route path="/ai-logs" element={<AILogs />} />
        <Route path="/tools" element={<PublicToolsEn />} />
        <Route path="/en/tools" element={<PublicToolsEn />} />
        {/* חוק ברזל (Google Indexing / SEO Readiness root-cause task, 2026-09-08,
            תיקון-מסלול נכון): main.jsx בוחר AppLocal/AppGlobal ברמת ה-bootstrap
            (isEnglishEnv ? AppGlobal : AppLocal) - App.jsx (root) אינו חלק
            מה-bundle החי בכלל, כך שתיקון-נתיבים קודם שם לא שינה שום דבר ב-
            Production בפועל. PublicToolsEn כבר תמך במלואו ב-initialTab
            (מטא-דאטה/canonical/H1 ייעודיים לכל מחשבון, מכוסה ע"י
            PublicToolsRouting.test.jsx הקיים) - אבל אף נתיב לא-hub לא נרשם
            כאן, ברכיב ה-App האמיתי, מעולם. */}
        {/* חוק ברזל (המשך התיעוד למעלה, גילוי-אמצע-משימה): אותו מצב בדיוק
            כמו AppLocal.jsx - PublicToolsEn() ב-origin/main אינו מקבל props
            כלל, ותמיכת-initialTab קיימת רק כעבודת-dirty-tree נפרדת ולא-
            קשורה (590 שורות) - out-of-scope לתיקון הזה. ה-prop הוסר בכוונה
            מהנתיבים למטה כדי לא להטעות. */}
        <Route path="/en/tools/currency" element={<PublicToolsEn />} />
        <Route path="/en/tools/units" element={<PublicToolsEn />} />
        <Route path="/en/tools/metals" element={<PublicToolsEn />} />
        <Route path="/en/tools/crypto" element={<PublicToolsEn />} />
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