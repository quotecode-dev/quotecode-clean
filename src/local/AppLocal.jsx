import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingLocal from '../pages/LandingLocal';
import Dashboard from '../pages/Dashboard';
import AILogs from '../pages/AILogs';
import SmartPublicQuote from '../components/SmartPublicQuote';
import PublicTools from '../components/PublicTools';
import ProfessionalQuotePreview from '../pages/ProfessionalQuotePreview';
import ProfessionalPublicPreview from '../pages/ProfessionalPublicPreview';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import Contact from '../pages/Contact';
import UpdateAvailableBanner from '../shared/UpdateAvailableBanner';

export default function AppLocal() {
  useEffect(() => {
    // חוק ברזל: הבאנדל המקומי מייצג תמיד עברית/RTL - זהו המקום המרכזי
    // היחיד שקובע את document.documentElement.lang/dir עבור כל האפליקציה
    // (לא נגזר מ-business_settings/מטבע הצעה/עוגיית geo - זו שפת/כיוון
    // ה-UI בלבד). דפי הצעת מחיר ציבוריים (PublicQuote/PublicQuoteEn) קובעים
    // זאת בעצמם בנפרד כי הם יכולים להציג את השפה הנגדית לבאנדל שמארח אותם.
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
  }, []);

  return (
    <BrowserRouter>
      <UpdateAvailableBanner isHebrew={true} />
      {/* Auth Lifecycle Forensic Audit (2026-09-09, §226): a second, fully
          unreachable "forgot password" modal + handleSendRecovery
          previously lived here (identical shape to App.jsx's own copy,
          which is not even imported by main.jsx) - setForgotPasswordOpen
          was never called anywhere in this file, so it could never open.
          Removed. Auth Audit Completion task (2026-09-09, §227/§228): this
          file ALSO carried its own separate, live `recoveryMode` overlay
          (state + handleUpdatePassword + a fixed/zIndex-9999 modal rendered
          here, above every route) - genuinely reachable (unlike the modal
          above), and live-reproduced to leak raw English provider text
          inside Hebrew on failure ("שגיאה בעדכון הסיסמה: Auth session
          missing!") since it never routed through authErrorClassification.js.
          It duplicated Dashboard.jsx's own AuthScreen-hosted recovery UI,
          which already has every fix this file's copy lacked. Removed here
          too, per this task's own "eliminate the duplicate, one canonical
          implementation" instruction - Dashboard.jsx's own recovery flow
          (session null / isPasswordRecoveryMode driven, mounted via the
          /dashboard Route below) is the sole real implementation now. */}

      <Routes>
        <Route path="/" element={<LandingLocal />} />
        <Route path="/he" element={<LandingLocal />} />
        {/* bundleIsHebrew=true: מקור אמת מפורש עבור ברירות המחדל של חשבון
            חדש (מדינה/מטבע/תקנון) בהרשמה - ראו הערה מקבילה ב-Dashboard.jsx */}
        <Route path="/dashboard" element={<Dashboard bundleIsHebrew={true} />} />
        <Route path="/ai-logs" element={<AILogs />} />
        <Route path="/tools" element={<PublicTools />} />
        <Route path="/he/tools" element={<PublicTools />} />
        {/* חוק ברזל (Google Indexing / SEO Readiness root-cause task, 2026-09-08,
            תיקון-מסלול נכון): main.jsx בוחר AppLocal/AppGlobal ברמת ה-bootstrap
            (isEnglishEnv ? AppGlobal : AppLocal) - App.jsx (root) אינו חלק
            מה-bundle החי בכלל, כך שתיקון-נתיבים קודם שם לא שינה שום דבר ב-
            Production בפועל. PublicTools כבר תמך במלואו ב-initialTab (מטא-
            דאטה/canonical/H1 ייעודיים לכל מחשבון, מכוסה ע"י
            PublicToolsRouting.test.jsx הקיים) - אבל אף נתיב לא-hub לא נרשם
            כאן, ברכיב ה-App האמיתי, מעולם. זה שורש-הבעיה האמיתי - אומת חי
            מול Production אחרי הפריסה הראשונה (כותרת/H1 גנריים, לא של
            המחשבון) לפני התיקון הזה. */}
        {/* חוק ברזל (המשך התיעוד למעלה, גילוי-אמצע-משימה): PublicTools()
            ב-origin/main אינו מקבל props כלל כרגע (0 פרמטרים) - תמיכת-
            initialTab (מטא-דאטה/canonical/H1 ייחודיים לכל מחשבון) קיימת רק
            כעבודת-dirty-tree נפרדת ולא-קשורה, גדולה בהרבה מ"חיווט נתיבים"
            (599 שורות ב-PublicTools.jsx בלבד) - אומתה כ-out-of-scope לתיקון
            הזה (לא "תיקון-נתיב מדויק", אלא תכונת-מוצר נפרדת שלמה, לא
            מבודדת-בבטחה בזמן הסביר של המשימה הזו). ה-prop initialTab הוסר
            בכוונה מהנתיבים למטה - הצגתו כאן הייתה מטעה (לא עושה דבר בפועל
            נגד הרכיב הנוכחי). מה שבאמת מתוקן כאן: הנתיבים עצמם קיימים
            ומחזירים תוכן-אמיתי-ורלוונטי (מרכז-הכלים המלא, עם כל 4 המחשבונים
            נגישים ללחיצה) במקום לנפול ל-wildcard (LandingLocal) כפי שקרה
            קודם - שיפור אמיתי ומוכח, גם בלי ייחוד-מטא-דאטה-פר-מחשבון. */}
        <Route path="/he/tools/currency" element={<PublicTools />} />
        <Route path="/he/tools/units" element={<PublicTools />} />
        <Route path="/he/tools/metals" element={<PublicTools />} />
        <Route path="/he/tools/crypto" element={<PublicTools />} />
        <Route path="/public-quote/:id" element={<SmartPublicQuote />} />
        <Route path="/quote/:id" element={<SmartPublicQuote />} />
        {/* David Aluminum professional-item demo, Owner-authorized, David-only -
            see src/config/professionalPreviewAllowlist.js. Deliberately not
            mirrored into AppGlobal.jsx - International accounts never see it. */}
        <Route path="/professional-preview" element={<ProfessionalQuotePreview />} />
        <Route path="/public-quote/:id/preview" element={<ProfessionalPublicPreview />} />

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