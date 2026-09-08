// ==============================================================================
// 🚨 חוק ברזל קשוח (Dashboard.jsx): הודעות צפות מודרניות במרכז המסך ושמירה על יציבות.
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../shared/supabase';
import ProFlowLogo from '../components/ProFlowLogo';
import BrandName from '../components/BrandName';
import AccessibilityModal from '../components/AccessibilityModal';
import AIChatWidget from '../AIChatWidget';
import PlanIdentityBadge from '../components/PlanIdentityBadge';
import { isHebrewEnv, formatDateLocal, calculateQuoteFinancials, getMarketRoutingCorrection } from '../utils/regionConfig';
import { isProfessionalPreviewEnabled } from '../config/professionalPreviewAllowlist';
import { isQuoteImmutable } from '../utils/quoteLock';
import { computeEffectivePlan } from '../utils/planEntitlements';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import { shouldShowUpgradeCta } from '../utils/planCatalog';
import { formatQuoteFallback, getQuoteOrderSortKey } from '../utils/quoteNumber';
import { formatMoney } from '../utils/money';
import { compareClients } from '../utils/clientSort';
import { withActiveQuantities, getActiveQuantity, sumMeasurementAreas, getDefaultProfessionalUnit, isMeasurableUnit, resolveCalculationMethod, computeMeasurementValue, normalizeSpecificationRows } from '../utils/professionalQuoteItem';
import { computeTransparentTrimBounds } from '../utils/logoTrim';
import ExcelJS from 'exceljs';

import PricingModal from '../components/PricingModal';
import EditClientModal from '../components/EditClientModal';
import EditExpenseModal from '../components/EditExpenseModal';
import LifetimeConfirmModal from '../components/LifetimeConfirmModal';
import UserDetailsModal from '../components/UserDetailsModal';
import EmailConfirmModal from '../components/EmailConfirmModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import SignOutModal from '../components/SignOutModal';
import ClientsTab from '../components/ClientsTab';
import FinancesTab from '../components/FinancesTab';
import QuoteForm from '../components/QuoteForm';
import QuotesTab from '../components/QuotesTab';

import AuthScreen from '../components/AuthScreen';
import ServicesCatalog from '../components/ServicesCatalog';
import SettingsTab from '../components/SettingsTab';
import AdminUsersTab from '../components/AdminUsersTab';
// חוק ברזל: ה-Dashboard (ה"קליפה" של בעל העסק - ניווט/KPI/היסטוריית הצעות/
// טאבים) עבר לערכת הנושא הבהירה שאושרה ע"י הבעלים (LIGHT), דרך אותה טכניקת
// alias-at-import שכבר משמשת ב-QuotesTab.jsx/ServicesCatalog.jsx - שינוי
// שורת ה-import היחיד הזה משנה את *כל* השימושים הקיימים ב-NEON.xxx בקובץ,
// בלי לגעת בכל אחד מהם בנפרד. AdminUsersTab.jsx (Super Admin) מייבא NEON
// האמיתי (הכהה) בעצמו ונשאר כך בכוונה - עיצובו מחדש אושר בעיקרון בנפרד
// ואינו בתחום המשימה הזו.
import { LIGHT as NEON, FONT_HE, FONT_EN, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW, SHELL } from '../theme/neonTheme';
import {
  AlertTriangle, Shield, LogOut, FileText,
  Users2, PlusCircle, Settings as SettingsIcon, BarChart3, Flame,
  MessagesSquare, Accessibility as AccessibilityIcon, Package, X, Sparkles, Eye,
  MessageCircle, ChevronDown, MoreHorizontal
} from 'lucide-react';

// חוק ברזל (Money Consolidation - Global Surface Audit finding I-1): גרסה
// קודמת עשתה Math.round() לפני העיצוב, ומחקה בשקט אגורות/סנטים מכל מקום
// שקורא ל-formatNum כאן (KPI הכנסות, היסטוריית הצעות, טופס יצירת הצעה,
// קטלוג, פיננסים, ייצוא CSV, וואטסאפ) - formatNum כאן נשאר אותו שם/חתימה
// (כדי לא לגעת בעשרות נקודות קריאה ו-props בקבצי-הבן) אבל מאציל עכשיו
// ל-formatMoney הקנוני (utils/money.js) שאינו מעגל בכלל - האגורות/סנטים
// נשמרים בכל מקום שמשתמש ב-formatNum הזה, כולל בעקיפין דרך props ל-
// QuoteForm.jsx/QuotesTab.jsx/ServicesCatalog.jsx/FinancesTab.jsx.
const formatNum = (val) => formatMoney(val);

// קורא geo טרי ואמין ישירות מהשרת (api/geo.js), לא מעוגייה/localStorage
// שהלקוח יכול לשנות או שיכולים להיות ישנים. משמש אך ורק לברירת המחדל של
// חשבון business_settings *חדש* (ר' fetchSettings למטה) - לעולם לא לחשבון
// קיים. אם הקריאה נכשלת/geo לא זמין, מחזיר null - ואז fetchSettings אינו
// מנחש אזור בעצמו אלא מבקש בחירה מפורשת מהמשתמש (ר' needsRegionChoice).
const fetchFreshGeoCountry = async () => {
  try {
    const res = await fetch('/api/geo');
    if (!res.ok) return null;
    const data = await res.json();
    // מנורמל ל-uppercase כאן (ולא סומך על הפורמט שהשרת מחזיר) לפני שמושווה
    // ל-'IL' בהמשך.
    return data?.country ? String(data.country).toUpperCase() : null;
  } catch {
    return null;
  }
};

const DEFAULT_TERMS_HEB = `תנאים כלליים:
1. תוקף ההצעה: ההצעה בתוקף ל-30 ימים מיום הצעת המחיר.
2. מחירים: המחירים כוללים מע"מ, אלא אם צוין אחרת.
3. תשלום: התשלום יתבצע במזומן או באמצעות העברה בנקאית, בתנאים שיוסכמו מראש.
4. אספקה: אספקת המוצרים תתבצע תוך 30 ימי עבודה ממועד אישור ההזמנה והתשלום, אלא אם כן צוין אחרת.`;

const DEFAULT_TERMS_ENG = `General Terms:
1. Validity: This quote is valid for 30 days from issuance.
2. Payment: Payment shall be made in cash or via bank transfer as agreed in advance.
3. Delivery: Product delivery within 30 business days from order confirmation and payment.`;

// חוק ברזל: אזור/מטבע/תקנון של חשבון *חדש* אינם נגזרים יותר מהבאנדל
// (AppLocal/AppGlobal) שהציג את הדשבורד - הם נקבעים אך ורק ע"י geo טרי
// מהשרת, או בבחירה מפורשת של המשתמש אם geo נכשל (ר' fetchSettings ->
// createNewBusinessSettings / handleRegionChoiceSelect למטה).
export default function Dashboard({ bundleIsHebrew } = {}) {
  const now = new Date();

  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [recoveryUpdateMsg, setRecoveryUpdateMsg] = useState('');
  const [recoveryUpdateLoading, setRecoveryUpdateLoading] = useState(false);

  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allUserAttachments, setAllUserAttachments] = useState([]);
  
  const [bizCountry, setBizCountry] = useState(() => {
    if (typeof window === 'undefined') return 'International';
    const cached = localStorage.getItem('proflow_cached_country');
    if (cached) return cached;
    return 'International';
  });

  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isExplicitEnglish = (typeof window !== 'undefined' && window.location.pathname.startsWith('/en')) || queryParams.get('lang') === 'en';
  const isExplicitHebrew = (typeof window !== 'undefined' && window.location.pathname.startsWith('/he')) || queryParams.get('lang') === 'he';

  // חוק ברזל: השפה המוצגת בדשבורד המחובר נגזרת אך ורק מהאזור המשפטי האמיתי
  // של העסק (bizCountry, שמגיע ממסד הנתונים). ?lang=/‎/he/‎/en בכתובת אינם
  // רשאים עוד לעקוף אותה עבור חשבון קיים - הם עדיין משמשים רק לבחירת
  // הבאנדל (AppLocal/AppGlobal) לפני התחברות, ולברירת המחדל של חשבון חדש.
  const isHebrew = isHebrewEnv(bizCountry, session);

  const [statusMsg, setStatusMsg] = useState({ text: '', type: 'success' });
  // חוק ברזל (תיקון בעלים - הודעת "התחברת בהצלחה"): ההודעה תפסה שורה
  // קבועה בפריסה (עד שנדרסה ע"י setStatusMsg הבא) ולא נעלמה מעצמה. במקום
  // לבנות מנגנון התראות גלובלי חדש, נוסף כאן טיימר יחיד שמנקה אוטומטית כל
  // statusMsg (לא רק הודעת ההתחברות - זהו אותו state משותף לכל 15+ נקודות
  // הקריאה הקיימות) כעבור ~2.7 שניות, בהתאמה לאופי ה"טוסט" הזמני שהטקסט
  // עצמו כבר רומז עליו ("...בהצלחה!"). הרינדור עצמו הוזז לשכבת-על צפה מעל
  // הכותרת הסגולה (ר' למטה) כדי שלא ידחוף תוכן כלל, גם לפני שהטיימר מפעיל.
  useEffect(() => {
    if (!statusMsg.text) return;
    const timer = setTimeout(() => setStatusMsg({ text: '', type: 'success' }), 2700);
    return () => clearTimeout(timer);
  }, [statusMsg.text]);
  const [alertModalMsg, setAlertModalMsg] = useState(null); // חלון צף מודרני במרכז המסך עבור הודעות שגיאה/התרעה
  
  const [emailStatuses, setEmailStatuses] = useState({});

  const [activeTab, setActiveTab] = useState('main');
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [financeReportType, setFinanceReportType] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [settingId, setSettingId] = useState(null);
  const [bizName, setBizName] = useState('TEKANGO');
  // חוק ברזל (Business Professional Profile, Owner Night Run task, §160.4):
  // אותה תבנית בדיוק כמו defaultWarranty (Item 23) - שדה business_settings
  // נוסף, נטען ב-fetchSettings, נשמר ב-handleSaveSettings, מוצג ב-SettingsTab.jsx.
  // '' (ולא null) הוא ערך-ברירת-המחדל התקין - "לא נבחר עדיין", מתפרש כ-'general'
  // (ללא הצעת-ברירת-מחדל) ב-getDefaultProfessionalUnit.
  const [professionalDomain, setProfessionalDomain] = useState('');
  // חוק ברזל: אם אין עדיין business_settings וגם geo טרי לא היה זמין, אסור
  // לנחש אזור משפטי משפה/באנדל/עוגייה - יש לבקש בחירה מפורשת מהמשתמש (ר'
  // fetchSettings/createNewBusinessSettings למטה). needsRegionChoice חוסם
  // רינדור הדשבורד המלא עד שנבחר אזור, בדיוק כמו isInitializing.
  const [needsRegionChoice, setNeedsRegionChoice] = useState(false);
  const [pendingNewAccount, setPendingNewAccount] = useState(null);
  // מצב טעינה/שגיאה עבור ניסיון יצירת business_settings (אוטומטי מ-geo או
  // מבחירה מפורשת). isCreatingBusinessSettingsRef הוא ref (לא state) בכוונה -
  // עדכון ref הוא מיידי/סינכרוני, ולכן חוסם הפעלה כפולה/מקבילה גם אם שני
  // קליקים קורים לפני שריצה חוזרת של React "רואה" עדכון state קודם.
  const isCreatingBusinessSettingsRef = useRef(false);
  const [isCreatingBusinessSettings, setIsCreatingBusinessSettings] = useState(false);
  const [regionChoiceError, setRegionChoiceError] = useState(null);
  const [bizTaxId, setBizTaxId] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizLogoUrl, setBizLogoUrl] = useState('');
  // חוק ברזל (Final Dashboard/Sidebar Polish task, §A - No-Logo/Load-Failure
  // Behavior): true רק כשה-<img> הממשי נכשל בפועל (onError), לא ניחוש/
  // בדיקה-מוקדמת. מתאפס אוטומטית בכל פעם ש-bizLogoUrl עצמו משתנה (ר'
  // ה-useEffect למטה + key={bizLogoUrl} על ה-<img> עצמו) - כך שכתובת-לוגו
  // חדשה תמיד מקבלת ניסיון-טעינה נקי, לעולם לא נשארת "תקועה" על כישלון של
  // כתובת קודמת שכבר הוחלפה.
  const [sidebarLogoFailed, setSidebarLogoFailed] = useState(false);
  useEffect(() => { setSidebarLogoFailed(false); }, [bizLogoUrl]);
  // חוק ברזל (Authenticated UI Coherence task, Business Logo Presentation):
  // חיתוך שוליים-שקופים אוטומטי ולא-הרסני, לתצוגת הסיידבר בלבד - לעולם לא
  // נוגע ב-bizLogoUrl/ברשומת ה-DB/בקובץ המקורי עצמו, רק מחשב, ברצף עצמאי,
  // תמונת-canvas חתוכה ומחזיקה אותה ב-state נפרד (trimmedLogoSrc). "בטוח-
  // כשל" במלואו: כל שלב (טעינת התמונה, קריאת ImageData - עלולה להיכשל
  // עם SecurityError על תמונה חוצה-מקור ללא CORS תואם) עטוף try/catch,
  // וכל כישלון פשוט משאיר trimmedLogoSrc כ-null, כך שה-JSX למטה נופל חזרה
  // אוטומטית ל-bizLogoUrl הגולמי - בדיוק ההתנהגות הקיימת מלפני המשימה הזו,
  // ללא רגרסיה. computeTransparentTrimBounds (utils/logoTrim.js) בודק אך
  // ורק שקיפות-אמיתית (alpha===0) - לוגו עם רקע-לבן מכוון לעולם לא ייחתך
  // בטעות, רק padding שקוף אמיתי בתוך קובץ PNG/SVG. גודל-הפלט מוגבל
  // ל-400px (הצד הארוך) לפני חיתוך, כדי שלא ליצור canvas/dataURL ענק
  // עבור לוגו מקור ברזולוציה גבוהה במיוחד.
  const [trimmedLogoSrc, setTrimmedLogoSrc] = useState(null);
  useEffect(() => {
    setTrimmedLogoSrc(null);
    if (!bizLogoUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const MAX_DIM = 400;
        const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = w;
        sourceCanvas.height = h;
        const sourceCtx = sourceCanvas.getContext('2d');
        sourceCtx.drawImage(img, 0, 0, w, h);
        const imageData = sourceCtx.getImageData(0, 0, w, h);
        const bounds = computeTransparentTrimBounds(imageData.data, w, h);
        if (!bounds.trimmed || cancelled) return;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = bounds.width;
        outCanvas.height = bounds.height;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(sourceCanvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        const dataUrl = outCanvas.toDataURL('image/png');
        if (!cancelled) setTrimmedLogoSrc(dataUrl);
      } catch {
        // חוצה-מקור בלי CORS תואם, canvas לא-נתמך, או כל כישלון אחר -
        // נופל חזרה בשקט ל-bizLogoUrl הגולמי דרך trimmedLogoSrc שנשאר null.
      }
    };
    img.onerror = () => {};
    img.src = bizLogoUrl;
    return () => { cancelled = true; };
  }, [bizLogoUrl]);
  const [bizPlan, setBizPlan] = useState('free');
  const [bizRole, setBizRole] = useState('user');

  const [defaultTerms, setDefaultTerms] = useState(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
  const [defaultWarranty, setDefaultWarranty] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [activeTooltip] = useState({ quoteId: null, action: null });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  const [hotQuoteIndex, setHotQuoteIndex] = useState(0);
  // חוק ברזל (Authenticated UI Coherence task, Dashboard Header Compression):
  // מצב תצוגה טהור (לא לוגיקה עסקית) - האם ההתראה הדקה של Hot Quote
  // מורחבת (חושפת טקסט מלא, לא חתוך). מתאפס אוטומטית בכל רוטציה (ר'
  // ה-useEffect הקיים שמקדם hotQuoteIndex) כדי שמצב-הרחבה לא "ידבק"
  // להצעה-חמה הבאה שברוטציה, שהיא לרוב הצעה שונה לגמרי.
  const [hotQuoteExpanded, setHotQuoteExpanded] = useState(false);
  // חוק ברזל (Authenticated UI Coherence task, Mobile Navigation Redesign):
  // ניווט-מובייל-תחתון צומצם מ-6 יעדים ל-5 (Owner-required limit) - Settings
  // ו-Catalog (שני היעדים בתדירות-הנמוכה יותר, לפי המבנה הקיים כבר - שניהם
  // כבר טאבים "שקטים" יותר מ-Quotes/Clients/Finances) אוחדו ליעד "עוד"/
  // "More" יחיד, שנפתח כ-popover קומפקטי מעל שורת-הניווט - לא הוסתרו, רק
  // אורגנו מחדש. New Quote נשאר בדיוק כפי שהיה - בולט, לא הוזז לתוך "עוד".
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  const [editingClient, setEditingClient] = useState(null);
  // חוק ברזל (Consolidated Open UI Corrections task, §G1): state נפרד
  // (לא "editingClient עם client.id ריק") כדי לשמור על ההבחנה המפורשת בין
  // "עריכת לקוח קיים" ל"יצירת לקוח חדש" ברורה בקוד עצמו, בלי לסמוך על
  // בדיקת-נוכחות-שדה עדינה.
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');

  const [currency, setCurrency] = useState('ILS');

  const [liveTick, setLiveTick] = useState(0);

  const [lastSeenNewUsersTime, setLastSeenNewUsersTime] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem('proflow_last_seen_new_users') || 0);
  });

  const [quoteSubject, setQuoteSubject] = useState('');
  const [attnName, setAttnName] = useState('');
  const [attnRole, setAttnRole] = useState('');
  const [quoteFiles, setQuoteFiles] = useState([]);

  // 🚨 חוק ברזל: אזור (country) הוא שדה משפטי/מס שנקבע אך ורק ע"י המנהל בטבלת
  // המשתמשים, ואינו קשור לשפת התצוגה (isHebrew) של מי שצפה בו. חיבור בין
  // השניים (כפי שהיה כאן בעבר) עלול לגרום למטבע/מע"מ סותרים - למשל עסק
  // "International" (0% מע"מ) שמקבל הצעות ב-ILS רק כי הדפדפן/מטמון שפתו עברית.
  const isLocalIsraeliBusiness = bizCountry === 'Local' || bizCountry === 'LCL';

  const upperCurr = (currency || '').toUpperCase();
  const sym = isLocalIsraeliBusiness ? '₪' : (upperCurr === 'EUR' ? '€' : upperCurr === 'GBP' ? '£' : '$');

  const handleOpenNewUsersModal = (newUsersList) => {
    const nowTime = Date.now();
    localStorage.setItem('proflow_last_seen_new_users', nowTime.toString());
    setLastSeenNewUsersTime(nowTime);
    setSelectedUserDetails({ isNewUsersListModal: true, users: newUsersList });
  };

  useEffect(() => {
    if (session) {
      window.history.pushState({ dashboard: true }, '', window.location.href);

      const handlePopState = () => {
        window.history.pushState({ dashboard: true }, '', window.location.href);
        setShowSignOutModal(true);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [session]);

  // Item 25 - סנכרון אוטומטי חד-פעמי בין הבאנדל הנוכחי (bundleIsHebrew,
  // שנקבע אנונימית לפני ההתחברות ב-main.jsx: URL/localStorage/geo/שפת
  // דפדפן) לבין האזור האמיתי של החשבון המחובר (bizCountry, ממסד הנתונים,
  // דרך isHebrew למעלה). אם הם לא תואמים - התוכן כבר נכון (isHebrew תמיד
  // מנצח, ר' הערה למעלה), אבל document.dir/lang נשאר תקוע על מה שהבאנדל
  // קבע פעם אחת ב-mount (AppLocal.jsx/AppGlobal.jsx) ולעולם לא מתעדכן.
  // התיקון היחיד האפשרי הוא ניווט מלא (reload) לנתיב הקנוני הקיים כבר
  // (?lang=he/en - אותו מנגנון בעדיפות עליונה שכבר קיים ב-main.jsx, לא
  // נתיב חדש) כדי שבאנדל אחר בכלל ימומש. חד-פעמי מטבעו: אחרי ה-reload
  // isHebrew ו-bundleIsHebrew כבר יתאימו (הבאנדל החדש נכון), כך שהתנאי
  // למטה כבר לא מתקיים ואין לולאה. ההחלטה עצמה (מתי מותר לתקן, לעולם לא
  // ניחוש) היא getMarketRoutingCorrection הטהורה ב-regionConfig.js - נבדקת
  // ישירות ביחידה, בלי React/Supabase - ה-effect כאן רק מפעיל אותה ומבצע
  // את ה-side effect היחיד (הניווט) כשהיא מחזירה יעד.
  useEffect(() => {
    const correctLang = getMarketRoutingCorrection({
      hasSession: !!session?.user?.id,
      isInitializing,
      isPasswordRecoveryMode,
      needsRegionChoice,
      settingId,
      bundleIsHebrew,
      isHebrew,
    });
    if (correctLang) {
      window.location.href = '/dashboard?lang=' + correctLang;
    }
  }, [session, isInitializing, isPasswordRecoveryMode, needsRegionChoice, settingId, bundleIsHebrew, isHebrew]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTick(prev => prev + 1);
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // מאזין חי לעדכוני שורת quotes - כשה-Webhook של Resend (resend-email-webhook)
  // מסמן הצעה כ"הוחזרה" בעקבות כתובת לא קיימת, הנורית בטבלה הופכת לאדומה
  // מיידית בלי צורך לרענן את העמוד
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`quotes-email-status-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quotes', filter: `user_id=eq.${userId}` }, (payload) => {
        setQuotes(prev => prev.map(q => q.id === payload.new.id ? { ...q, ...payload.new } : q));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    
    if (hash.includes('type=recovery') || search.includes('type=recovery')) {
      setIsPasswordRecoveryMode(true);
    }

    const params = new URLSearchParams(search);
    if (params.get('signup') === 'true') {
      setIsSignUp(true);
    }

    const initAuth = async () => {
      setIsInitializing(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user?.id) {
        await loadData(session.user.id, session.user.email, session.user.user_metadata);
      }
      setIsInitializing(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        let isNewUser = false;
        setSession((prevSession) => {
          if (prevSession?.user?.id !== newSession?.user?.id) {
            isNewUser = true;
            return newSession;
          }
          return prevSession;
        });
        if (isNewUser && newSession?.user?.id) {
          // כמו ב-initAuth למעלה: יש לחסום את רינדור ה-Dashboard (שם bizCountry
          // קובע שפה/כיוון) עד ש-loadData/fetchSettings מסיימים לטעון את
          // האזור האמיתי של המשתמש *החדש*. בלי זה, מעבר בין חשבונות באותו
          // טאב (או כניסה ראשונה) היה מרנדר לרגע עם bizCountry הישן/ברירת
          // המחדל, לפני שהוא מתוקן - בדיוק ה"הבזק" בשפה הלא-נכונה שאסור שיקרה.
          setIsInitializing(true);
          await loadData(newSession.user.id, newSession.user.email, newSession.user.user_metadata);
          setIsInitializing(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setQuotes([]);
        setClients([]);
        setServices([]);
        setExpenses([]);
        setAllUserAttachments([]);
        setSettingId(null);
        setBizCountry('International');
        localStorage.removeItem('proflow_cached_country');
        setIsInitializing(false);
      } else if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const hotQuotes = quotes.filter(q => (q.view_count || 0) >= 3 && q.status !== 'approved' && q.status !== 'paid');
    if (hotQuotes.length > 1) {
      const interval = setInterval(() => {
        setHotQuoteIndex(prev => (prev + 1) % hotQuotes.length);
        setHotQuoteExpanded(false);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [quotes]);

  const handleToggleDropdown = (e, quoteId) => {
    e.stopPropagation();
    if (openDropdownId === quoteId) {
      setOpenDropdownId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 250;

      const menuWidth = 210;
      let calculatedLeft = isHebrew ? rect.right - menuWidth : rect.left;
      if (calculatedLeft + menuWidth > window.innerWidth - 10) {
        calculatedLeft = window.innerWidth - menuWidth - 10;
      }
      if (calculatedLeft < 10) {
        calculatedLeft = 10;
      }

      setDropdownPos({
        top: openUpward ? rect.top - 245 : rect.bottom + 6,
        left: calculatedLeft
      });
      setOpenDropdownId(quoteId);
    }
  };
  
  const [sortField, setSortField] = useState('default_online');
  const [sortDirection, setSortDirection] = useState('desc');

  const [clientSortField, setClientSortField] = useState('company_name');
  const [clientSortDirection, setClientSortDirection] = useState('asc');

  const [quoteSortField, setQuoteSortField] = useState('created_at');
  const [quoteSortDirection, setQuoteSortDirection] = useState('desc');

  const handleQuoteSort = (field) => {
    if (quoteSortField === field) {
      setQuoteSortDirection(quoteSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setQuoteSortField(field);
      setQuoteSortDirection('asc');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'last_sign_in' ? 'desc' : 'asc');
    }
  };

  const handleClientSort = (field) => {
    if (clientSortField === field) {
      setClientSortDirection(clientSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setClientSortField(field);
      setClientSortDirection('asc');
    }
  };

  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pendingLifetimeUser, setPendingLifetimeUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientType, setClientType] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  
  const [quoteStatus, setQuoteStatus] = useState('Draft');
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState('');
  const [terms, setTerms] = useState(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
  const [warranty, setWarranty] = useState('');
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '' }]);
  // חוק ברזל (§168 - Project/Section hierarchy, PROFLOW_TODO.md 30.C):
  // sections נשאר מערך ריק כברירת-מחדל - הצעה שלא נוגעת בו מתנהגת זהה-
  // בייט להצעה שטוחה קיימת. כל section הוא {key, id?, name, sort_order} -
  // key הוא מזהה-הצטרפות מנורמל (id אמיתי אחרי טעינה, tempKey לפני-שמירה
  // חדש - ר' addSection למטה), items מפנים אליו דרך item.section_key. אין
  // "מבנה כפוי" - זו תוספת אופציונלית בלבד, לעולם לא שדה-חובה.
  const [sections, setSections] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(isHebrew ? 'ענן / תשתית' : 'Cloud / Infrastructure');
  const [isRecurring, setIsRecurring] = useState(false);

  const [pendingEmailQuote, setPendingEmailQuote] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // חוק ברזל (Trial Expiration -> FREE, Full Entitlement Audit + Fix):
  // נקודת-אמת יחידה, ר' src/utils/planEntitlements.js לפירוט מלא של שורש
  // הבעיה שתוקנה כאן (ניסיון שפג היה נשאר PRO לצמיתות כי raw plan נשאר
  // 'pro' לצמיתות אחרי הרשמה) והנימוק המלא לכל ענף בנוסחה. SettingsTab.jsx
  // (שער העלאת לוגו) קורא לאותו effectivePlan דרך prop, לא מחשב נוסחה
  // משלו יותר - כדי שלא יהיו שתי נוסחאות סותרות (ר' התיקון המקביל שם).
  const { effectivePlan, isTrialExpired, trialDaysLeft } = computeEffectivePlan({ plan: bizPlan, trialEndsAt, now });

  const isSuperAdmin = bizRole === 'super_admin';
  const isPro = isSuperAdmin || effectivePlan === 'pro';

  // חוק ברזל (Stage 1 - Plan Identity / Trial / Lifetime Centralization,
  // PROFLOW_PROJECT_CONTEXT.md §148): קריאה נוספת לנקודת-האמת הקנונית
  // (resolveAccountEntitlement, כבר בשימוש ב-AdminUsersTab.jsx/
  // UserDetailsModal.jsx) עבור שני השדות היחידים ש-Dashboard.jsx לא חישב
  // בעצמו קודם - isLifetime ו-displayIdentity (אחת מחמש הזהויות הקנוניות:
  // FREE/FREE_TRIAL/BASIC/PRO/LIFETIME). מכוון לא מחליף/משנה את effectivePlan/
  // isPro/isBasicOrAbove למעלה - הנוסחה הזו כבר נכונה ובדוקה במלואה (כולל
  // התיקון ההיסטורי לניסיון-שפג), אין סיבה לגעת בה. שני הקריאות מחשבות את
  // אותה עובדה בפועל (plan/trialEndsAt/role זהים) - לא סתירה, לא שתי נוסחאות
  // עצמאיות, רק שהשנייה חושפת מידע נוסף שכבר קיים בפונקציה המשותפת.
  const resolvedIdentity = resolveAccountEntitlement({ plan: bizPlan, trialEndsAt, role: bizRole, now });
  const { isLifetime, displayIdentity, entitlement } = resolvedIdentity;

  // חוק ברזל (אותה משימה): כלל-ראייה יחיד לכפתור "שדרג חבילה", גם כאן וגם
  // ב-SettingsTab.jsx (ר' shouldShowUpgradeCta ב-planCatalog.js) - התחליף
  // לשני הכללים שהיו סותרים בפועל (§147.1/§148). עבור Dashboard.jsx עצמו,
  // זו אינה שינוי-התנהגות - !isPro && !isSuperAdmin כבר היה מזהה בדיוק אותם
  // מקרים (Lifetime/ניסיון-פעיל שניהם effectivePlan==='pro' כבר קודם).
  const showUpgradeCta = shouldShowUpgradeCta({ tier: effectivePlan, isLifetime, isSuperAdmin });

  // חוק ברזל (Trial Notification, TEST Acceptance Package 1 - עבר כמה
  // תיקוני עיצוב לפי הבהרות בעלים במהלך המשימה, האחרון שבהם: הפרדה מפורשת
  // בין שני מצבים שונים לגמרי, לא עוד עיצוב אחיד אחד:
  // (א) ניסיון פעיל רגיל (לא מתקרב לסיום, לא פג) - טיקר טקסט-בלבד, סגול
  //     ProFlow, בלי רקע/מסגרת/צל/כפתור שדרוג, נע ברציפות (ימין→שמאל
  //     בעברית, שמאל→ימין באנגלית) פעם אחת, ~7 שניות, ואז נעלם מה-DOM
  //     (onAnimationEnd) - ר' TRIAL_TICKER_DURATION_MS/isPlainActiveTrial.
  // (ב) מתקרב לסיום/פג - נשאר הסרגל הסגול-מלא הקודם (כרטיס, לא טיקר) עם
  //     כניסה/שהייה/יציאה - "מצב זה לא עוצב-מחדש בתיקון הזה", נשאר בדיוק
  //     כפי שהיה - ר' TRIAL_NOTICE_ENTER_MS/EXIT_MS/REST_MS/trialNoticeExiting.
  // שני המצבים חולקים trialNoticeVisible/trialNoticeShownRef (מוצג פעם
  // אחת בלבד לכל טעינת Dashboard, לא שוב רק כי המשתמש/ת עברו טאב).
  // isSuperAdmin אף פעם לא רואה אף אחד מהם. לוגיקת הזכאות עצמה
  // (effectivePlan/isPro למעלה) לא נגעה בה כלל בשום שלב - זו רק שכבת תצוגה.
  const isExpiringSoon = trialDaysLeft !== null && trialDaysLeft <= 5 && trialDaysLeft > 0 && !isSuperAdmin;
  const TRIAL_NOTICE_ENTER_MS = 1200;
  const TRIAL_NOTICE_EXIT_MS = 1000;
  const TRIAL_NOTICE_REST_MS = 6000;
  const TRIAL_TICKER_DURATION_MS = 8200;
  const [trialNoticeVisible, setTrialNoticeVisible] = useState(false);
  // חוק ברזל (Slider Location Correction task - Exact Owner Target): כלל-
  // הברזל הקודם כאן (Trial Notice Vertical Position) כבר לא רלוונטי - שתי
  // הגרסאות עברו ל-QuotesTab.jsx (שורת-הבקרה של Quote History), כך שאין
  // יותר מרווח-אנכי-מותנה בכותרת הסגולה בכלל לתחזק (ר' ה-JSX של dash-
  // header-bar, marginBottom חזר לקבוע 14px). hasVisibleTrialNotice נמחק
  // בהתאם - לא נדרש יותר.
  const [trialNoticeExiting, setTrialNoticeExiting] = useState(false);
  const trialNoticeShownRef = useRef(false);
  const trialNoticeAutoHideRef = useRef(null);
  const trialNoticeExitRef = useRef(null);
  const startTrialNoticeExit = () => {
    clearTimeout(trialNoticeAutoHideRef.current);
    setTrialNoticeExiting(true);
    trialNoticeExitRef.current = setTimeout(() => {
      setTrialNoticeVisible(false);
      setTrialNoticeExiting(false);
    }, TRIAL_NOTICE_EXIT_MS);
  };
  useEffect(() => {
    if (isSuperAdmin || trialNoticeShownRef.current || !trialEndsAt) return;
    trialNoticeShownRef.current = true;
    setTrialNoticeVisible(true);
    // מצב הכרטיס (מתקרב לסיום/פג) משתמש בטיימר ה-JS הזה, בלי שינוי. מצב
    // הטיקר (ניסיון פעיל רגיל) נעלם בעצמו דרך onAnimationEnd ברגע שהתנועה
    // הרציפה מסתיימת (ר' render למטה) - אבל תחת prefers-reduced-motion
    // (שם האנימציה מבוטלת לגמרי דרך CSS) onAnimationEnd לעולם לא היה נורה
    // בלעדי גיבוי - לכן טיימר JS זהה-במשך משמש כרשת ביטחון בשני המקרים
    // (קריאה כפולה ל-setTrialNoticeVisible(false) תמימה - idempotent).
    if (isTrialExpired || isExpiringSoon) {
      trialNoticeAutoHideRef.current = setTimeout(() => startTrialNoticeExit(), TRIAL_NOTICE_REST_MS);
    } else {
      trialNoticeAutoHideRef.current = setTimeout(() => setTrialNoticeVisible(false), TRIAL_TICKER_DURATION_MS);
    }
    return () => {
      clearTimeout(trialNoticeAutoHideRef.current);
      clearTimeout(trialNoticeExitRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialEndsAt, isSuperAdmin]);
  const dismissTrialNotice = () => {
    if (isTrialExpired || isExpiringSoon) {
      startTrialNoticeExit();
    } else {
      // מצב הטיקר: אין שלב-יציאה נפרד להפעיל - X סוגר מיידית.
      clearTimeout(trialNoticeAutoHideRef.current);
      setTrialNoticeVisible(false);
    }
  };
  const t = {
    appName: bizName || 'TEKANGO',
    appSub: isHebrew ? 'מערכת ניהול עסק והצעות מחיר' : 'Global SaaS Business & Quoting Platform',
    totalQuotes: isHebrew ? 'סך הכל הצעות' : 'TOTAL QUOTES',
    approvedPaid: isHebrew ? 'אושר / שולם' : 'APPROVED / PAID',
    totalRevenue: isHebrew ? 'סך הכנסות' : 'TOTAL REVENUE',
    totalExpenses: isHebrew ? 'סך הוצאות' : 'TOTAL EXPENSES',
    netProfit: isHebrew ? 'רווח נקי' : 'NET PROFIT',
    clientName: isHebrew ? 'שם הלקוח' : 'Client Name',
    clientEmail: isHebrew ? 'אימייל הלקוח' : 'Client Email',
    clientPhone: isHebrew ? 'טלפון הלקוח' : 'Client Phone',
    currency: isHebrew ? 'מטבע' : 'Currency',
    status: isHebrew ? 'סטטוס' : 'Status',
    validUntil: isHebrew ? 'בתוקף עד' : 'Valid Until',
    discount: isHebrew ? 'הנחה (%)' : 'Discount (%)',
    quoteItems: isHebrew ? 'פריטי ההצעה' : 'Quote Items',
    addItem: isHebrew ? '+ הוסף פריט ידנית' : '+ Add Custom Item',
    quickAdd: isHebrew ? 'בחר שירות מהקטלוג...' : 'Choose from catalog...',
    description: isHebrew ? 'תיאור' : 'Description',
    quantity: isHebrew ? 'כמות' : 'Qty',
    unitPrice: isHebrew ? 'מחיר יחידה' : 'Unit Price',
    totalPrice: isHebrew ? 'סכום' : 'Amount',
    total: isHebrew ? 'סה"כ' : 'Total',
    subtotal: isHebrew ? 'סכום ביניים:' : 'Subtotal:',
    vat: isHebrew ? 'מע"מ (18%):' : 'VAT (18%):',
    totalAmount: isHebrew ? 'סה"כ לתשלום:' : 'Total Amount:',
    generateSave: isHebrew ? 'הפק ושמור בענן' : 'Generate & Save to Cloud',
    updateQuote: isHebrew ? 'עדכן הצעה בענן' : 'Update Quote in Cloud',
    cancelEdit: isHebrew ? 'ביטול עריכה' : 'Cancel Edit',
    recentHistory: isHebrew ? 'היסטוריית הצעות מחיר' : 'Recent Quotes History',
    servicesCatalog: isHebrew ? 'קטלוג שירותים ומוצרים' : 'Services & Products Catalog',
    expensesManagement: isHebrew ? 'ניהול הוצאות עסק' : 'Business Expenses Management',
    addExpenseBtn: isHebrew ? 'הוסף הוצאה' : 'Add Expense',
    businessSettings: isHebrew ? 'הגדרות עסק וחבילה' : 'Business Settings',
    saveSettings: isHebrew ? 'שמור הגדרות עסק' : 'Save Business Settings',
    businessNameLabel: isHebrew ? 'שם העסק' : 'Business Name',
    taxIdLabel: isHebrew ? 'ח.פ / עוסק מורשה' : 'Tax ID',
    logoUrlLabel: isHebrew ? 'כתובת תמונת לוגו (URL)' : 'Logo Image URL',
    addService: isHebrew ? 'הוסף לקטלוג' : 'Add to Catalog',
    serviceName: isHebrew ? 'שם השירות / המוצר' : 'Service Name',
    defaultPrice: isHebrew ? 'מחיר קבוע' : 'Fixed Price',
    searchQuote: isHebrew ? 'חיפוש שם לקוח או מס׳ הצעה...' : 'Search client or quote #...',
    filterStatus: isHebrew ? 'כל הסטטוסים' : 'All Statuses',
    actions: isHebrew ? 'פעולות' : 'Actions',
    edit: isHebrew ? 'ערוך הצעה' : 'Edit Quote',
    duplicate: isHebrew ? 'שכפל הצעה' : 'Duplicate Quote',
    delete: isHebrew ? 'מחק הצעה' : 'Delete Quote',
    clientsManagement: isHebrew ? 'ניהול לקוחות' : 'Clients Management',
    quotesNav: isHebrew ? 'הצעות מחיר' : 'Quotes',
    settingsNav: isHebrew ? 'הגדרות עסק' : 'Business Settings',
    clientsNav: isHebrew ? 'לקוחות' : 'Clients',
    financesNav: isHebrew ? 'פיננסים' : 'Finances',
    catalogNav: isHebrew ? 'קטלוג' : 'Catalog',
    usersAdminNav: isHebrew ? 'ניהול משתמשים' : 'Users Admin',
    // חוק ברזל (תיקון בעלים - הצעה חמה): הכותרת "הצעה חמה!"/"Hot Quote!"
    // כבר מוצגת פעם אחת בכותרת הכרטיס (dash-kpi-label) - הטקסט כאן חוזר
    // עליה שוב היה כפילות מיותרת. הטקסט עודכן להשתמש ב-view_count האמיתי
    // (לא מומצא) עם דקדוק יחיד/רבים נכון, במקום "מספר פעמים" הגנרי.
    // חוק ברזל (תיקון בעלים - הדגשת נתונים): מחזיר עכשיו JSX (לא מחרוזת)
    // כדי להדגיש בסגול (אותו גוון בדיוק כמו הבאנר הראשי - NEON.violet,
    // שכן NEON כבר מכונה כאן ל-LIGHT) רק את שם הלקוח ואת מספר הצפיות עצמו
    // - שאר המשפט נשאר בצבע הטקסט הרגיל של הכרטיס, לא כל המשפט בסגול.
    hotQuoteAlert: (name, viewCount) => {
      const purpleStrong = { color: NEON.violet, fontWeight: '800' };
      if (isHebrew) {
        return (
          <>
            <span style={purpleStrong}>{name}</span>
            {' צפה בהצעה '}
            {viewCount === 1 ? (
              <span style={purpleStrong}>פעם אחת</span>
            ) : (
              <>
                <span style={purpleStrong}>{viewCount}</span>
                {' פעמים'}
              </>
            )}
            {' ועדיין לא חתם.'}
          </>
        );
      }
      return (
        <>
          <span style={purpleStrong}>{name}</span>
          {' viewed this quote '}
          {viewCount === 1 ? (
            <span style={purpleStrong}>once</span>
          ) : (
            <>
              <span style={purpleStrong}>{viewCount}</span>
              {' times'}
            </>
          )}
          {" and hasn't signed yet."}
        </>
      );
    }
  };

  async function loadData(userId, userEmail, userMetadata) {
    await fetchQuotes(userId);
    await fetchClients(userId);
    await fetchServices(userId);
    await fetchExpenses(userId);
    await fetchAllUserAttachments(userId);
    await fetchSettings(userId, userEmail, userMetadata);
  }

  async function fetchQuotes(userId) {
    const { data, error } = await supabase
      .from('quotes')
      .select(`*, clients ( company_name, email, phone, client_type, tax_id, address, terms, notes ), quote_items ( * )`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching quotes:', error.message);
    else setQuotes(data || []);
  }

  async function fetchClients(userId) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, email, phone, client_type, created_at, user_id, tax_id, address, terms, notes')
      .eq('user_id', userId);
    if (error) {
      console.error('Error fetching clients:', error.message);
    } else {
      setClients(data || []);
    }
  }

  async function fetchServices(userId) {
    const { data, error } = await supabase.from('services').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (error) console.error('Error fetching services:', error.message);
    else setServices(data || []);
  }

  async function fetchExpenses(userId) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false });
    if (error) console.error('Error fetching expenses:', error.message);
    else setExpenses(data || []);
  }

  async function fetchAllUserAttachments(userId) {
    const { data: quotesData } = await supabase.from('quotes').select('id').eq('user_id', userId);
    if (quotesData && quotesData.length > 0) {
      const quoteIds = quotesData.map(q => q.id);
      const { data: attData } = await supabase.from('quote_attachments').select('*').in('quote_id', quoteIds);
      setAllUserAttachments(attData || []);
    } else {
      setAllUserAttachments([]);
    }
  }

  async function fetchSettings(userId, userEmail, userMetadata) {
    const nowIso = new Date().toISOString();

    let { data } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setSettingId(data.id);
      setBizName(data.business_name || 'TEKANGO');
      setBizTaxId(data.tax_id || '');
      setBizEmail(data.email || userEmail || '');
      setBizPhone(data.phone || '');
      setBizAddress(data.address || '');
      setBizLogoUrl(data.logo_url || '');
      setBizPlan(data.plan || 'pro');
      setBizRole(data.role || 'user');
      
      const countryVal = data.country || 'International';
      // setBizCountry חייב לרוץ תמיד: זו הדרך היחידה שבה bizCountry (ולכן
      // sym/isLocalIsraeliBusiness בהמשך) מתעדכן מהמדינה האמיתית שבמסד
      // הנתונים. גדר ה-?lang= הייתה חוסמת את זה לגמרי בזמן תצוגה מקדימה
      // בשפה השנייה - כלומר bizCountry היה נשאר תקוע לצמיתות על ניחוש
      // הרינדור הראשון (state ה-useState ההתחלתי, שנקרא רק פעם אחת ולפני
      // שההגעתה האמיתית ממסד הנתונים בכלל חוזרת), גם אחרי שההגעתה
      // האמיתית התקבלה. רק כתיבת המטמון proflow_cached_country עצמו
      // נשארת מותנית, כדי שתצוגה מקדימה חד-פעמית לא "תדביק" ביקורים
      // עתידיים בדפדפן הזה.
      setBizCountry(countryVal);
      if (!isExplicitEnglish && !isExplicitHebrew) {
        localStorage.setItem('proflow_cached_country', countryVal);
      }
      
      const defaultFallbackTerms = (countryVal === 'International') ? DEFAULT_TERMS_ENG : DEFAULT_TERMS_HEB;
      let defTerms = data.default_terms && data.default_terms.trim() !== '' ? data.default_terms : defaultFallbackTerms;
      // Item 23 Warranty: אין תבנית ברירת מחדל קשיחה כמו ב-Terms - שדה ריק
      // הוא מצב תקין ("אין סעיף אחריות"), לא צריך fallback טקסט מומצא.
      let defWarranty = data.default_warranty || '';

      setDefaultTerms(defTerms);
      setDefaultWarranty(defWarranty);
      setTrialEndsAt(data.trial_ends_at !== undefined ? data.trial_ends_at : null);
      
      // כמו ב-isLocalIsraeliBusiness: המטבע נגזר אך ורק מ-countryVal (השדה
      // שהמנהל קובע), ולא מ-isHebrew - אחרת ערך שגוי היה נכתב בחזרה למסד
      // הנתונים בכל התחברות (ראו update מטה) ומשבש את המע"מ/מטבע של העסק.
      // הגנה נוספת: ל-International אסור בהחלט ILS (גם אם הגיע כך ממסד
      // הנתונים ממקור ישן/פגום) - אחרת הערך היה גם מוצג וגם נכתב בחזרה
      // (update מטה) ומנציח את הפגם.
      const dataCurrUpper = (data.currency || '').toUpperCase();
      let userCurr = (countryVal === 'Local' || countryVal === 'LCL')
        ? 'ILS'
        : (['USD', 'EUR', 'GBP'].includes(dataCurrUpper) ? dataCurrUpper : 'USD');

      setCurrency(userCurr);
      setTerms(defTerms);
      setWarranty(defWarranty);

      await supabase
        .from('business_settings')
        .update({ last_sign_in: nowIso, currency: userCurr })
        .eq('user_id', userId);

      if (data.role === 'super_admin') {
        fetchAllAccounts();
      }
    } else {
      // חוק ברזל: אזור משפטי לחשבון *חדש* חייב לבוא אך ורק מ-(1) signup_market
      // שנשמר ב-user_metadata ברגע ה-signUp() עצמו - זהו הבאנדל שבו המשתמש
      // בפועל נרשם, ואינו תלוי בדפדפן/IP/geo של מי שלוחץ על קישור האימות
      // (יכול להיות מכשיר/דפדפן/מדינה אחרים לגמרי), (2) geo טרי ואמין שנשלף
      // עכשיו ממש מהשרת (api/geo.js - לא מעוגייה/localStorage שהלקוח יכול
      // לשנות) - fallback רק כאשר signup_market אינו זמין (חשבון legacy
      // שנוצר לפני התיקון הזה), או (3) בחירה מפורשת של המשתמש עצמו - לעולם
      // לא ניחוש שקט מבוסס bundleIsHebrew/?lang=/נתיב/localStorage/שפת
      // דפדפן. אם גם signup_market וגם geo טרי אינם זמינים, לא יוצרים עדיין
      // שורת business_settings בכלל - מבקשים מהמשתמש לבחור אזור במפורש (ר'
      // needsRegionChoice / handleRegionChoiceSelect ומסך הבחירה המינימלי
      // ב-return הראשי).
      const signupMarket = userMetadata?.signup_market;
      if (signupMarket === 'Local' || signupMarket === 'International') {
        await createNewBusinessSettings(userId, userEmail, signupMarket);
      } else {
        const freshGeoCountry = await fetchFreshGeoCountry();
        if (freshGeoCountry) {
          await createNewBusinessSettings(userId, userEmail, freshGeoCountry === 'IL' ? 'Local' : 'International');
        } else {
          setPendingNewAccount({ userId, userEmail });
          setNeedsRegionChoice(true);
        }
      }
    }
  }

  // יוצרת בפועל את שורת business_settings הראשונה עבור המשתמש - הנקודה
  // היחידה בקוד שמבצעת INSERT כזה, גם מהנתיב האוטומטי (geo טרי הצליח) וגם
  // מבחירה מפורשת של המשתמש. country חייב להיות בדיוק 'Local' או
  // 'International' - כל ערך אחר נדחה בלי לגעת במסד הנתונים.
  //
  // חוק ברזל - הגנה מפני insert כפול/מרוץ: isCreatingBusinessSettingsRef
  // (ref, לא state) נבדק ונכתב באופן סינכרוני מיד עם הכניסה לפונקציה, לפני
  // כל await - כך שקריאה שנייה (קליק כפול, או קליק על שני הכפתורים
  // ברצף) נחסמת גם אם React עדיין לא הספיק לרנדר מחדש עם ה-state המעודכן.
  // ה-state המקביל (isCreatingBusinessSettings) קיים בנפרד רק כדי להניע
  // את מצב הטעינה/disabled בממשק.
  //
  // חוק ברזל - כישלון: אם ה-insert נכשל או לא מחזיר newData תקין, לעולם
  // לא ממשיכים לרנדר דשבורד חלקי. מעבירים/משאירים את המשתמש במסך בחירת
  // אזור מפורש (גם אם הניסיון הזה היה אוטומטי מ-geo, לא בחירה ידנית) עם
  // הודעת שגיאה מקומית, כדי שיוכל לנסות שוב.
  async function createNewBusinessSettings(userId, userEmail, country) {
    if (country !== 'Local' && country !== 'International') {
      console.error('createNewBusinessSettings: invalid country', country);
      return false;
    }
    if (isCreatingBusinessSettingsRef.current) {
      return false;
    }
    isCreatingBusinessSettingsRef.current = true;
    setIsCreatingBusinessSettings(true);
    setRegionChoiceError(null);

    const nowIso = new Date().toISOString();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    const detectedTerms = country === 'Local' ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG;
    const detectedCurr = country === 'Local' ? 'ILS' : 'USD';

    const defaultPayload = {
      user_id: userId,
      email: userEmail,
      business_name: country === 'Local' ? 'עסק חדש' : 'New Business',
      country,
      currency: detectedCurr,
      plan: 'pro',
      role: 'user',
      default_terms: detectedTerms,
      trial_ends_at: trialEndDate.toISOString(),
      last_sign_in: nowIso
    };

    const { data: newData, error: insertError } = await supabase
      .from('business_settings')
      .insert([defaultPayload])
      .select()
      .maybeSingle();

    if (insertError || !newData) {
      console.error("Auto-init error:", insertError);
      setPendingNewAccount({ userId, userEmail });
      setNeedsRegionChoice(true);
      setRegionChoiceError(isHebrew ? 'לא הצלחנו ליצור את החשבון כרגע. נסה שוב.' : "We couldn't create your account right now. Please try again.");
      isCreatingBusinessSettingsRef.current = false;
      setIsCreatingBusinessSettings(false);
      return false;
    }

    setSettingId(newData.id);
    setBizName(newData.business_name);
    setBizEmail(newData.email);
    setBizPhone(newData.phone || '');
    setBizAddress(newData.address || '');
    setBizPlan(newData.plan);
    setBizRole(newData.role);
    // ר' הערה מקבילה למעלה - setBizCountry לא מותנה בגדר lang=, רק כתיבת
    // המטמון המשותף.
    setBizCountry(newData.country || country);
    if (!isExplicitEnglish && !isExplicitHebrew) {
      localStorage.setItem('proflow_cached_country', newData.country || country);
    }
    setDefaultTerms(newData.default_terms || detectedTerms);
    setTrialEndsAt(newData.trial_ends_at);
    setCurrency((newData.country === 'Local' || newData.country === 'LCL') ? 'ILS' : (newData.currency || detectedCurr));
    setTerms(newData.default_terms || detectedTerms);

    setNeedsRegionChoice(false);
    setPendingNewAccount(null);
    setRegionChoiceError(null);
    isCreatingBusinessSettingsRef.current = false;
    setIsCreatingBusinessSettings(false);
    return true;
  }

  // מופעלת רק ע"י לחיצה מפורשת של המשתמש על "ישראל"/"בינלאומי" במסך
  // הבחירה. createNewBusinessSettings עצמה כבר מגנה מפני הפעלה כפולה/
  // מקבילה (ref סינכרוני) - אין צורך בבדיקה נוספת כאן.
  async function handleRegionChoiceSelect(country) {
    if (!pendingNewAccount) return;
    await createNewBusinessSettings(pendingNewAccount.userId, pendingNewAccount.userEmail, country);
  }

  async function fetchAllAccounts() {
    const { data, error } = await supabase.from('business_settings').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setAllAccounts(data);
    }
  }

  async function handleToggleLifetime(accountId, currentTrialEnds) {
    const newTrialEnds = currentTrialEnds === null ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;
    const updatePayload = { trial_ends_at: newTrialEnds };

    let { data, error } = await supabase
      .from('business_settings')
      .update(updatePayload)
      .eq('id', accountId)
      .select();

    if ((error || !data || data.length === 0) && accountId) {
      const targetAcc = allAccounts.find(a => a.id === accountId);
      if (targetAcc && targetAcc.user_id) {
        const res = await supabase
          .from('business_settings')
          .update(updatePayload)
          .eq('user_id', targetAcc.user_id)
          .select();
        error = res.error;
      }
    }

    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה בעדכון גישת המשתמש: ' + error.message : 'Error updating user access: ' + error.message);
    } else {
      setStatusMsg({ text: isHebrew ? 'סטטוס הגישה עודכן בהצלחה!' : 'Access status updated successfully!', type: 'success' });
      fetchAllAccounts();
    }
  }

  async function handleExtendTrial14Days(accountId) {
    const acc = allAccounts.find(a => a.id === accountId);
    if (!acc) return;

    const trialNow = new Date();
    if (acc.trial_ends_at && new Date(acc.trial_ends_at) > trialNow) {
      const daysLeft = Math.ceil(
        (new Date(acc.trial_ends_at) - trialNow) /
        (1000 * 60 * 60 * 24)
      );

      setAlertModalMsg(
        isHebrew
          ? `⚠️ לא ניתן להאריך! למשתמש יש עוד ${daysLeft} ימים פעילים בתקופת הניסיון.`
          : `⚠️ Cannot extend! User has ${daysLeft} active days remaining.`
      );

      return;
    }

    const newEnd = new Date(
      trialNow.getTime() + 14 * 24 * 60 * 60 * 1000
    );

    const { error } = await supabase
      .from('business_settings')
      .update({ trial_ends_at: newEnd.toISOString() })
      .eq('id', accountId);

    if (error) setAlertModalMsg('Error extending trial: ' + error.message);
    else {
      setStatusMsg({ text: isHebrew ? 'תקופת הניסיון הוארכה ב-14 יום בהצלחה!' : 'Trial extended by 14 days successfully!', type: 'success' });
      fetchAllAccounts();
    }
  }

  function emailEmailValidation(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|co\.il|org|net|edu|gov|io|info|biz|co|me|tv|ws)$/i;
    return re.test(trimmed);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (!session?.user?.id) return;

    const enforcedCurrency = isLocalIsraeliBusiness ? 'ILS' : currency;

    const payload = {
      business_name: bizName,
      tax_id: bizTaxId,
      email: bizEmail,
      phone: bizPhone,
      address: bizAddress,
      logo_url: bizLogoUrl,
      default_terms: defaultTerms,
      default_warranty: defaultWarranty,
      country: bizCountry,
      currency: enforcedCurrency,
      user_id: session.user.id
    };

    if (settingId) {
      const { error } = await supabase.from('business_settings').update(payload).eq('id', settingId);
      if (error) setAlertModalMsg(isHebrew ? 'שגיאה בעדכון ההגדרות: ' + error.message : 'Error updating settings: ' + error.message);
      else {
        localStorage.setItem('proflow_cached_country', bizCountry);
        setStatusMsg({ text: isHebrew ? 'הגדרות העסק עודכנו בהצלחה!' : 'Business settings updated successfully!', type: 'success' });
      }
    } else {
      // חוק ברזל: createNewBusinessSettings() היא הנקודה היחידה בקובץ הזה
      // שמורשית ליצור שורת business_settings חדשה - עם אזור שכבר אומת
      // (geo טרי או בחירה מפורשת של המשתמש). לא יוצרים כאן שורה חדשה
      // בעצמנו בשום מקרה - זה היה עוקף את חוזה האזור המאומת ומאפשר יצירת
      // חשבון עם אזור מנוחש. אם settingId חסר בזמן שמירת הגדרות, זהו מצב
      // לא-תקין (הוא אמור כבר להיות מוגדר ע"י fetchSettings/
      // createNewBusinessSettings לפני שהדשבורד בכלל נגיש) - נכשלים
      // בבטחה במקום לנחש/ליצור.
      console.error('handleSaveSettings: missing settingId - refusing to insert a new business_settings row (see createNewBusinessSettings).');
      setAlertModalMsg(isHebrew ? 'לא ניתן לשמור את ההגדרות כרגע. טען מחדש את העמוד ונסה שוב.' : 'Settings cannot be saved right now. Please reload the page and try again.');
    }
  }

  async function handleSaveUpdatedClient(updatedClient) {
    if (updatedClient.email && updatedClient.email.trim() !== '' && !emailEmailValidation(updatedClient.email)) {
      setAlertModalMsg(isHebrew ? '❌ אימייל לא חוקי!' : '❌ Invalid email address!');
      return;
    }

    const { error } = await supabase
      .from('clients')
      .update({
        company_name: updatedClient.company_name,
        email: updatedClient.email ? updatedClient.email.trim() : '',
        phone: updatedClient.phone,
        client_type: updatedClient.client_type,
        tax_id: updatedClient.tax_id,
        address: updatedClient.address,
        notes: updatedClient.notes
      })
      .eq('id', updatedClient.id);

    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה בעדכון הלקוח: ' + error.message : 'Error updating client: ' + error.message);
    } else {
      setStatusMsg({ text: isHebrew ? 'הלקוח עודכן בהצלחה!' : 'Client updated successfully!', type: 'success' });
      if (session?.user?.id) fetchClients(session.user.id);
    }
  }

  // חוק ברזל (Consolidated Open UI Corrections task, §G1): "New Client"
  // הוא יכולת אמיתית שלא הייתה קיימת קודם באפליקציה כפעולה עצמאית - לקוחות
  // עד כה נוצרו רק באופן עקיף דרך יצירת הצעת-מחיר חדשה (ר' handleSaveQuote,
  // supabase.from('clients').insert(...) שם). זו לא "המצאת סמנטיקה עסקית
  // חדשה" - רק השלמת CRUD קיים-בחלקו (Read/Update/Delete כבר קיימים,
  // Create חסר) תוך שימוש באותם שדות/ולידציה/טבלה בדיוק שכבר קיימים,
  // באותו payload שכבר מוכר משני מקומות אחרים בקובץ הזה (fetchClients
  // מרעננת את הרשימה בסוף, זהה לחלוטין ל-handleSaveUpdatedClient). מודל-
  // ה-EditClientModal הקיים משמש מחדש (לא רכיב-מודל שני מקביל) - ר' ה-prop
  // isNew החדש שלו.
  async function handleCreateClient(newClient) {
    if (newClient.email && newClient.email.trim() !== '' && !emailEmailValidation(newClient.email)) {
      setAlertModalMsg(isHebrew ? '❌ אימייל לא חוקי!' : '❌ Invalid email address!');
      return;
    }
    if (!session?.user?.id) return;

    const { error } = await supabase.from('clients').insert([{
      company_name: newClient.company_name,
      email: newClient.email ? newClient.email.trim() : '',
      phone: newClient.phone,
      client_type: newClient.client_type,
      tax_id: newClient.tax_id,
      address: newClient.address,
      notes: newClient.notes,
      user_id: session.user.id
    }]);

    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה ביצירת הלקוח: ' + error.message : 'Error creating client: ' + error.message);
    } else {
      setStatusMsg({ text: isHebrew ? 'הלקוח נוצר בהצלחה!' : 'Client created successfully!', type: 'success' });
      fetchClients(session.user.id);
    }
  }

  async function handleSaveUpdatedExpense(updatedExpense) {
    const { error } = await supabase
      .from('expenses')
      .update({
        description: updatedExpense.description,
        amount: updatedExpense.amount,
        category: updatedExpense.category,
        is_recurring: updatedExpense.is_recurring
      })
      .eq('id', updatedExpense.id);

    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה בעדכון ההוצאה: ' + error.message : 'Error updating expense: ' + error.message);
    } else {
      setStatusMsg({ text: isHebrew ? 'ההוצאה עודכנה בהצלחה!' : 'Expense updated successfully!', type: 'success' });
      if (session?.user?.id) fetchExpenses(session.user.id);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    if (!session?.user?.id) return;

    const { error } = await supabase.from('expenses').insert([{
      user_id: session.user.id,
      description: expenseDesc,
      amount: Number(expenseAmount),
      category: expenseCategory,
      is_recurring: isRecurring,
      expense_date: new Date().toISOString().split('T')[0]
    }]);

    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה בהוספת ההוצאה: ' + error.message : 'Error adding expense: ' + error.message);
    } else {
      setExpenseDesc('');
      setExpenseAmount('');
      setIsRecurring(false);
      fetchExpenses(session.user.id);
      setStatusMsg({ text: isHebrew ? 'ההוצאה נוספה בהצלחה!' : 'Expense added successfully!', type: 'success' });
    }
  }

  // חוק ברזל: כל ארבע זרימות המחיקה (הוצאה/הצעה/לקוח/שירות) פוצלו לזוג
  // פונקציות - request* (בונה טקסט דינמי ופותח את DeleteConfirmModal, לא
  // נוגע במסד הנתונים) ו-execute* (לוגיקת המחיקה המקורית, ללא שום שינוי,
  // שרצה אך ורק מתוך handleConfirmDelete בלחיצה על אישור). window.confirm()
  // הוא סינכרוני; מודאל הוא א-סינכרוני מטבעו, ולכן לא ניתן להחליף inline -
  // סדר הקריאות/השאילתות/הבדיקות המקוריות בכל execute* נשאר זהה לחלוטין.
  async function executeDeleteExpense(expenseId) {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) setAlertModalMsg(isHebrew ? 'שגיאה במחיקת ההוצאה: ' + error.message : 'Error deleting expense: ' + error.message);
    else fetchExpenses(session.user.id);
  }

  function requestDeleteExpense(expenseId, description) {
    const trimmed = (description || '').trim();
    setPendingDelete({
      type: 'expense',
      id: expenseId,
      title: isHebrew ? 'למחוק את ההוצאה?' : 'Delete this expense?',
      message: trimmed
        ? (isHebrew ? `"${trimmed}" תימחק מרשימת ההוצאות.` : `"${trimmed}" will be removed from your expenses.`)
        : (isHebrew ? 'ההוצאה תימחק מרשימת ההוצאות.' : 'This expense will be removed from your expenses.'),
      confirmLabel: isHebrew ? 'מחיקה' : 'Delete',
    });
  }

  async function executeDeleteQuote(quoteId) {
    const targetQuote = quotes.find(q => q.id === quoteId);
    if (isQuoteImmutable(targetQuote)) {
      setAlertModalMsg(
        isHebrew
          ? 'לא ניתן למחוק הצעה חתומה.'
          : 'Cannot delete a signed quote.'
      );
      return;
    }
    await supabase.from('quote_items').delete().eq('quote_id', quoteId);
    await supabase.from('quote_attachments').delete().eq('quote_id', quoteId);
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה במחיקת ההצעה: ' + error.message : 'Error deleting quote: ' + error.message);
    } else {
      setStatusMsg({ text: isHebrew ? 'הצעת המחיר נמחקה בהצלחה!' : 'Quote deleted successfully!', type: 'success' });
      if (session?.user?.id) {
        fetchQuotes(session.user.id);
        fetchAllUserAttachments(session.user.id);
      }
    }
  }

  function requestDeleteQuote(quoteId, { number, clientName } = {}) {
    const targetQuote = quotes.find(q => q.id === quoteId);
    if (isQuoteImmutable(targetQuote)) {
      setAlertModalMsg(
        isHebrew
          ? 'לא ניתן למחוק הצעה חתומה.'
          : 'Cannot delete a signed quote.'
      );
      return;
    }
    // חוק ברזל (Quote Number Mobile/Surface Consistency, סבב זה): ה-fallback
    // הפנימי כאן היה slice(0,6) גולמי - פורמט שונה מ-formatQuoteFallback
    // הקנוני (8 תווים) שכל שאר האפליקציה כבר מאוחדת עליו. בפועל הקורא
    // היחיד הקיים (QuotesTab.jsx) כבר מעביר number=formatQuoteFallback(quote)
    // תמיד-אמיתי, כך שה-fallback הזה כבר לא הופעל בפועל - אבל תוקן בכל
    // זאת להיות עקבי (משתמש ב-targetQuote שכבר נשלף למעלה) כדי שקורא
    // עתידי כלשהו לא ייצור בטעות פורמט שלישי שונה.
    //
    // עדכון 2026-08-28 (Pre-Commit Release-Candidate Audit, HIGH-1 fix):
    // idLabel כבר תמיד מגיע מפורמט מלא של formatQuoteFallback (או ישירות
    // מ-number שכבר עבר דרכה ב-QuotesTab.jsx) - "A123" (מספר אמיתי) או
    // "#abcd1234" (fallback) - שני המקרים כבר כוללים את התו הפותח שלהם.
    // ה-"#" הקבוע שהיה כאן בתבנית ההודעה הוסיף תו כפול: "#A123" (שגוי) או
    // "##abcd1234" (האש כפול) - בכל מחיקת הצעה, בשתי השפות. הוסר; ה-
    // הודעה צורכת את idLabel בדיוק כפי שכבר מפורמט, בלי תו קידומת נוסף.
    const idLabel = number || formatQuoteFallback(targetQuote || { id: quoteId });
    const message = isHebrew
      ? (clientName ? `${idLabel} · ${clientName} — ההצעה תימחק לצמיתות.` : `${idLabel} — ההצעה תימחק לצמיתות.`)
      : (clientName ? `${idLabel} · ${clientName} — this quote will be permanently deleted.` : `${idLabel} — this quote will be permanently deleted.`);
    setPendingDelete({
      type: 'quote',
      id: quoteId,
      title: isHebrew ? 'למחוק את ההצעה?' : 'Delete this quote?',
      message,
      confirmLabel: isHebrew ? 'מחיקה' : 'Delete',
    });
  }

  async function executeDeleteClient(clientId) {
    const { data: clientQuotes, error: fetchErr } = await supabase
      .from('quotes')
      .select('status, signature')
      .eq('client_id', clientId);

    if (fetchErr) {
      setAlertModalMsg(isHebrew ? 'שגיאה בבדיקת הצעות הלקוח: ' + fetchErr.message : 'Error checking client quotes: ' + fetchErr.message);
      return;
    }

    const hasSignedOrApproved = clientQuotes && clientQuotes.some(q =>
      (q.status && (q.status.toLowerCase() === 'approved' || q.status.toLowerCase() === 'paid' || q.status.toLowerCase() === 'signed')) ||
      (q.signature && q.signature.trim() !== '')
    );

    if (hasSignedOrApproved) {
      setAlertModalMsg(isHebrew ? 'שגיאה חמורה: לא ניתן למחוק לקוח שיש לו הצעה חתומה או מאושרת במערכת!' : 'Error: Cannot delete a client with a signed or approved quote!');
      return;
    }

    if (clientQuotes && clientQuotes.length > 0) {
      setAlertModalMsg(isHebrew ? 'שגיאה: לא ניתן למחוק לקוח שיש לו הצעות מחיר פעילות במערכת!' : 'Error: Cannot delete a client with existing quotes!');
      return;
    }

    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה במחיקת הלקוח: ' + error.message : 'Error deleting client: ' + error.message);
    } else {
      setStatusMsg({ text: isHebrew ? 'הלקוח נמחק בהצלחה!' : 'Client deleted successfully!', type: 'success' });
      if (session?.user?.id) fetchClients(session.user.id);
    }
  }

  function requestDeleteClient(clientId, clientName) {
    const trimmed = (clientName || '').trim();
    setPendingDelete({
      type: 'client',
      id: clientId,
      title: isHebrew ? 'למחוק את הלקוח?' : 'Delete this client?',
      message: trimmed
        ? (isHebrew ? `"${trimmed}" יימחק מהמערכת.` : `"${trimmed}" will be removed from your system.`)
        : (isHebrew ? 'הלקוח יימחק מהמערכת.' : 'This client will be removed from your system.'),
      confirmLabel: isHebrew ? 'מחיקה' : 'Delete',
    });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.type === 'quote') await executeDeleteQuote(pendingDelete.id);
      else if (pendingDelete.type === 'client') await executeDeleteClient(pendingDelete.id);
      else if (pendingDelete.type === 'expense') await executeDeleteExpense(pendingDelete.id);
      else if (pendingDelete.type === 'service') await executeDeleteService(pendingDelete.id);
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  const exportToCSV = (dataArray, filename) => {
    if (!dataArray || dataArray.length === 0) {
      setAlertModalMsg(isHebrew ? 'אין נתונים לייצוא.' : 'No data to export.');
      return;
    }
    const keys = Object.keys(dataArray[0]);
    const csvContent = [
      keys.join(','),
      ...dataArray.map(row => keys.map(key => JSON.stringify(row[key] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportQuotes = async () => {
    if (!filteredQuotes || filteredQuotes.length === 0) {
      setAlertModalMsg(isHebrew ? 'אין נתונים לייצוא.' : 'No data to export.');
      return;
    }

    const INTL_CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };
    const localStatusLabels = { draft: 'טיוטה', sent: 'נשלח', approved: 'אושר', paid: 'שולם' };
    const intlStatusLabels = { draft: 'Draft', sent: 'Sent', approved: 'Approved', paid: 'Paid' };

    const reportBizName = bizName || 'TEKANGO';
    const align = isLocalIsraeliBusiness ? 'right' : 'left';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(isLocalIsraeliBusiness ? 'הצעות מחיר' : 'Quotes', {
      views: [{ rightToLeft: isLocalIsraeliBusiness }]
    });

    const headers = isLocalIsraeliBusiness
      ? ['מספר הצעה', 'שם לקוח', 'אימייל', 'סטטוס', 'סכום', 'בתוקף עד', 'תאריך יצירה']
      : ['Quote Number', 'Client', 'Email', 'Status', 'Amount', 'Valid Until', 'Created At'];

    sheet.columns = [16, 26, 28, 14, 16, 16, 16].map(width => ({ width }));

    sheet.mergeCells(1, 1, 1, headers.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = isLocalIsraeliBusiness
      ? `${reportBizName} – דוח הצעות מחיר`
      : `${reportBizName} – Quotes Report`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: align, vertical: 'middle' };

    sheet.mergeCells(2, 1, 2, headers.length);
    const dateCell = sheet.getCell(2, 1);
    dateCell.value = isLocalIsraeliBusiness
      ? `תאריך הפקה: ${formatDateLocal(new Date().toISOString(), true)}`
      : `Export Date: ${formatDateLocal(new Date().toISOString(), false, INTL_CURRENCY_SYMBOLS[(currency || '').toUpperCase()] ? (currency || '').toUpperCase() : 'USD')}`;
    dateCell.font = { size: 10, color: { argb: 'FF000000' } };
    dateCell.alignment = { horizontal: align, vertical: 'middle' };

    const headerRow = sheet.getRow(4);
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: align, vertical: 'middle' };
    });

    filteredQuotes.forEach((quote, i) => {
      const row = sheet.getRow(5 + i);
      const statusKey = quote.status ? quote.status.toLowerCase() : 'draft';
      const quoteNumber = formatQuoteFallback(quote);
      const clientName = quote.clients?.company_name || '';
      const clientEmail = quote.clients?.email || '';

      let statusLabel, amountText, validUntilText, createdAtText;

      if (isLocalIsraeliBusiness) {
        statusLabel = localStatusLabels[statusKey] || statusKey;
        amountText = `₪${formatNum(quote.total)}`;
        validUntilText = quote.valid_until ? formatDateLocal(quote.valid_until, true) : '';
        createdAtText = quote.created_at ? formatDateLocal(quote.created_at, true) : '';
      } else {
        statusLabel = intlStatusLabels[statusKey] || statusKey;
        const quoteCurrency = (quote.currency || '').toUpperCase();
        const accountCurrency = (currency || '').toUpperCase();
        const safeCurrency = INTL_CURRENCY_SYMBOLS[quoteCurrency]
          ? quoteCurrency
          : (INTL_CURRENCY_SYMBOLS[accountCurrency] ? accountCurrency : 'USD');
        amountText = `${INTL_CURRENCY_SYMBOLS[safeCurrency]}${formatNum(quote.total)}`;
        validUntilText = quote.valid_until ? formatDateLocal(quote.valid_until, false, safeCurrency) : '';
        createdAtText = quote.created_at ? formatDateLocal(quote.created_at, false, safeCurrency) : '';
      }

      [quoteNumber, clientName, clientEmail, statusLabel, amountText, validUntilText, createdAtText].forEach((v, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = v;
        cell.font = { color: { argb: 'FF000000' } };
        cell.alignment = { horizontal: align, vertical: 'middle' };
      });
    });

    const bufferData = await workbook.xlsx.writeBuffer();
    const blob = new Blob([bufferData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'quotes_report.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExpenses = () => {
    const exportData = filteredExpensesForReport.map(e => ({
      ID: e.id,
      Description: e.description,
      Category: e.category,
      Amount: e.amount,
      Date: e.expense_date,
      Recurring: e.is_recurring ? 'Yes' : 'No'
    }));
    exportToCSV(exportData, 'expenses_report.csv');
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!emailEmailValidation(emailInput)) {
      setAuthError(isHebrew ? 'כתובת האימייל אינה תקינה או פיקטיבית.' : 'Invalid email address.');
      return;
    }

    if (isSignUp) {
      const { data: existingBiz } = await supabase
        .from('business_settings')
        .select('email')
        .eq('email', emailInput)
        .maybeSingle();

      if (existingBiz) {
        setAuthError(isHebrew ? 'האימייל כבר רשום במערכת! אנא התחבר או אפס סיסמה.' : 'Email already registered! Please sign in or use password reset.');
        return;
      }

      // signup_market נשמר ב-user_metadata ברגע ה-signUp() עצמו - מקור האמת
      // היחיד לאזור המשפטי של החשבון החדש ל-Tier 2 (ר' fetchSettings למעלה),
      // בלתי-תלוי לחלוטין בדפדפן/IP/geo של מי שילחץ בהמשך על קישור האימות
      // במייל. bundleIsHebrew (prop שמגיע מ-AppLocal/AppGlobal, שתי הקריאות
      // החיות היחידות ל-<Dashboard>) הוא המקור היחיד שמותר כאן - fail-closed
      // בכוונה: אם איכשהו לא הגיע כ-boolean אמיתי (למשל קורא עתידי ששכח
      // להעביר אותו), אין שום ניחוש חלופי (לא isHebrew המקומי - שנגזר
      // מ-bizCountry/session ומיועד לתצוגת חשבון *קיים* בלבד, לא localStorage,
      // לא שפת דפדפן, לא geo) - פשוט לא נרשמים, ומוצגת שגיאה כללית. emailRedirectTo
      // מוצמד לדומיין הקנוני המפורש בכוונה (לא window.location.origin), כדי
      // שהאימות תמיד יחזור ל-www.tekango.com גם אם ההרשמה בוצעה
      // דרך quotecode.vercel.app.
      if (typeof bundleIsHebrew !== 'boolean') {
        setAuthError(isHebrew
          ? 'שגיאת הגדרה: לא ניתן לקבוע את אזור החשבון. רענן את העמוד ונסה שוב.'
          : 'Configuration error: unable to determine account region. Please refresh the page and try again.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: {
          emailRedirectTo: 'https://www.tekango.com/dashboard',
          data: { signup_market: bundleIsHebrew ? 'Local' : 'International' }
        }
      });
      if (error) {
        setAuthError(isHebrew ? 'האימייל כבר רשום במערכת! אנא התחבר או אפס סיסמה.' : 'Email already registered! Please sign in or use password reset.');
      } else {
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          setAuthError(isHebrew ? 'האימייל כבר קיים! אנא התחבר.' : 'Email already exists! Please sign in.');
        } else {
          setAuthSuccess(bundleIsHebrew ? 'ההרשמה הצליחה! מאתחל פרופיל עם תקופת ניסיון...' : 'Sign up successful! Initializing user profile with free trial...');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
      if (error) {
        setAuthError(isHebrew ? 'שגיאת התחברות: בדוק את הפרטים או אפס סיסמה.' : 'Login error: check your credentials or reset password.');
      } else {
        setStatusMsg({ text: bundleIsHebrew ? 'התחברת בהצלחה' : 'Logged in successfully', type: 'success' });
      }
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    setResetLoading(false);
    if (error) {
      setResetMsg((isHebrew ? 'שגיאה: ' : 'Error: ') + error.message);
    } else {
      setResetMsg(isHebrew ? 'קישור לאיפוס סיסמה נשלח בהצלחה לאימייל שלך!' : 'Password recovery link sent successfully to your email!');
      setTimeout(() => {
        setForgotOpen(false);
        setResetMsg('');
        setResetEmail('');
      }, 3000);
    }
  };

  const handleUpdatePasswordFromRecovery = async (e) => {
    e.preventDefault();
    setRecoveryUpdateLoading(true);
    setRecoveryUpdateMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPasswordInput });
    setRecoveryUpdateLoading(false);
    if (error) {
      setRecoveryUpdateMsg((isHebrew ? 'שגיאה בעדכון הסיסמה: ' : 'Error updating password: ') + error.message);
    } else {
      setRecoveryUpdateMsg(isHebrew ? 'הסיסמה עודכנה בהצלחה! מעביר אותך...' : 'Password updated successfully! Redirecting...');
      setTimeout(() => {
        setIsPasswordRecoveryMode(false);
        window.location.href = window.location.origin;
      }, 2000);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = (sectionKey = null) => setItems([...items, { description: '', quantity: '1', unit_price: '', isFromCatalog: false, section_key: sectionKey }]);

  // חוק ברזל (§168 - Project/Section hierarchy, PROFLOW_TODO.md 30.C):
  // section.key הוא tempKey חדש בלבד (מזהה-לקוח, לעולם לא uuid אמיתי) עד
  // לשמירה - בדיוק כמו שפריט/מדידה חדשים לא נושאים id עד שהשרת מקצה אחד.
  // sort_order נגזר מהמיקום בזמן-שמירה (ר' handleSaveQuote), לא נשמר כאן.
  const addSection = () => {
    const key = `tmp_section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSections(prev => [...prev, { key, name: '', sort_order: prev.length }]);
    return key;
  };

  const renameSection = (key, name) => {
    setSections(prev => prev.map(s => (s.key === key ? { ...s, name } : s)));
  };

  // מסיר section - הפריטים ששייכים אליו לא נמחקים, רק "יוצאים" מהקטגוריה
  // (section_key מתאפס), זהה למשמעות ON DELETE SET NULL בסכימה עצמה.
  const removeSection = (key) => {
    setSections(prev => prev.filter(s => s.key !== key));
    setItems(prev => prev.map(it => (it.section_key === key ? { ...it, section_key: null } : it)));
  };

  const handleAddFromCatalog = (e) => {
    const sId = e.target.value;
    if (!sId) return;
    const svc = services.find(s => s.id.toString() === sId);
    if (svc) {
      if (items.length === 1 && items[0].description === '' && items[0].unit_price === '') {
        setItems([{ description: svc.name, quantity: '1', unit_price: svc.price, isFromCatalog: true }]);
      } else {
        setItems([...items, { description: svc.name, quantity: '1', unit_price: svc.price, isFromCatalog: true }]);
      }
    }
    e.target.value = ''; 
  };

  const removeItem = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  // חוק ברזל (Professional Quotes Stage F - Advanced Reuse, PROFLOW_PROJECT_CONTEXT.md
  // §155.18 שורה F, §165): "שכפול פריט מקצועי" - מרחיב את דפוס-השכפול הקיים כבר
  // (handleDuplicateQuote, keepId:false) לרמת-פריט-בודד בתוך הטופס הנוכחי, לא
  // הצעה שלמה. מוסיף עותק מיד אחרי הפריט המקורי (לא בסוף הרשימה) - כדי שהעותק
  // יישאר הגיוני-מבחינה-קונטקסטואלית לצד המקור. id מוסר לגמרי (גם ברמת-הפריט
  // וגם בכל measurement) - זו תמיד שורה חדשה שתיווצר מחדש בשמירה הבאה, בדיוק
  // כמו כל שכפול אחר בקוד הזה. entitlement.professionalQuoteReuse (PRO+, לא
  // professionalQuotes/Core) הוא השער - הכפתור עצמו תמיד גלוי לפריט מקצועי
  // (Visible-but-Locked, §155.14) כדי ש-BASIC יידע שהיכולת קיימת.
  const duplicateItem = (index) => {
    setItems(prev => {
      const original = prev[index];
      const copy = { ...original, measurements: (original.measurements || []).map(m => ({ ...m })) };
      delete copy.id;
      copy.measurements.forEach(m => delete m.id);
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  // חוק ברזל (Professional Quotes Stage C, §158): התנהגות ברמת-פריט בלבד -
  // אין מצב-הצעה גלובלי (§3/§25/§26 בעלים). בחירת יחידה ריקה חוזרת לפריט
  // Simple רגיל (מוחקת את כל השדות המקצועיים, לא רק pricing_unit). מעבר
  // ל-m² מאתחל שורת-מידה ריקה אחת אם עדיין אין; מעבר ליחידה אחרת לא מוחק
  // מדידות קיימות (רק לא נעשה בהן שימוש) - "לא לאבד נתונים בשקט" (§22).
  const handleProfessionalUnitChange = (index, unitId) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      if (!unitId) {
        return {
          ...(it.id !== undefined ? { id: it.id } : {}),
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          isFromCatalog: it.isFromCatalog,
          section_key: it.section_key,
        };
      }
      const next = { ...it, pricing_unit: unitId };
      // חוק ברזל (§168 - real calculation-method framework, 30.B/30.E):
      // isMeasurableUnit/resolveCalculationMethod מחליפים את הבדיקה
      // הבודדת-לקבוע-אחד הקודמת (unitId === MEASURABLE_UNIT_ID) - יחידה
      // עתידית-נמדדת = רשומה חדשה ב-UNIT_CALCULATION_METHOD בלבד.
      if (isMeasurableUnit(unitId)) {
        const method = resolveCalculationMethod(unitId, 'calculated');
        const existingMeasurements = (it.measurements && it.measurements.length > 0)
          ? it.measurements
          : [{ width: '', height: '', unit: 'm', calculated_area: null, label: '', is_pricing_driving: true }];
        next.measurements = existingMeasurements;
        next.quantity_source = 'calculated';
        next.calculation_method = method;
        const sum = sumMeasurementAreas(existingMeasurements, method);
        next.calculated_quantity = sum != null ? sum : '';
      } else {
        next.quantity_source = 'manual';
        next.calculation_method = resolveCalculationMethod(unitId, 'manual');
        if (next.calculated_quantity == null) next.calculated_quantity = '';
      }
      return next;
    }));
  };

  const addMeasurementRow = (itemIndex) => {
    setItems(prev => prev.map((it, i) => i === itemIndex
      ? { ...it, measurements: [...(it.measurements || []), { width: '', height: '', unit: 'm', calculated_area: null, label: '', is_pricing_driving: true }] }
      : it));
  };

  const removeMeasurementRow = (itemIndex, rowIndex) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it;
      const rows = (it.measurements || []).filter((_, ri) => ri !== rowIndex);
      const sum = sumMeasurementAreas(rows, it.calculation_method);
      return { ...it, measurements: rows, calculated_quantity: it.quantity_source === 'calculated' ? (sum != null ? sum : '') : it.calculated_quantity };
    }));
  };

  const handleMeasurementChange = (itemIndex, rowIndex, field, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it;
      const rows = (it.measurements || []).map((m, ri) => {
        if (ri !== rowIndex) return m;
        const updated = { ...m, [field]: value };
        if (field === 'width' || field === 'height') {
          updated.calculated_area = computeMeasurementValue(it.calculation_method, updated.width, updated.height);
        }
        return updated;
      });
      const sum = sumMeasurementAreas(rows, it.calculation_method);
      return { ...it, measurements: rows, calculated_quantity: it.quantity_source === 'calculated' ? (sum != null ? sum : '') : it.calculated_quantity };
    }));
  };

  // חוק ברזל (§168 - specification-vs-pricing-driving, 30.E "Pricing Unit
  // ≠ Specification Data"): הופך שורת-מידה בין "משפיעה על מחיר" (ברירת
  // מחדל) ל"מוצג ללקוח בלבד" - הנתון עצמו (width/height/label) לעולם לא
  // נמחק, רק מוצא/נכנס לסכום calculated_quantity.
  const toggleMeasurementPricingDriving = (itemIndex, rowIndex) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it;
      const rows = (it.measurements || []).map((m, ri) => (ri === rowIndex ? { ...m, is_pricing_driving: m.is_pricing_driving === false } : m));
      const sum = sumMeasurementAreas(rows, it.calculation_method);
      return { ...it, measurements: rows, calculated_quantity: it.quantity_source === 'calculated' ? (sum != null ? sum : '') : it.calculated_quantity };
    }));
  };

  // חוק ברזל (§8 בעלים - Manual Override): החזרה ל"כמות מחושבת" משחזרת
  // מהמדידות הקיימות ב-state (לעולם לא נמחקות כשעוברים לידני) - "כשהמשתמש
  // חוזר לכמות מחושבת, חישוב המדידה חייב להישאר זמין".
  const toggleManualQuantityOverride = (itemIndex) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it;
      if (it.quantity_source === 'manual') {
        const method = resolveCalculationMethod(it.pricing_unit, 'calculated');
        const sum = sumMeasurementAreas(it.measurements, method);
        return { ...it, quantity_source: 'calculated', calculation_method: method, calculated_quantity: sum != null ? sum : '' };
      }
      return { ...it, quantity_source: 'manual', calculation_method: 'manual' };
    }));
  };

  const handleManualQuantityChange = (itemIndex, value) => {
    setItems(prev => prev.map((it, i) => i === itemIndex ? { ...it, calculated_quantity: value } : it));
  };

  // חוק ברזל (§168 - specification-only data, 30.E "generic JSONB bag"):
  // רשימת {label,value} חופשית-לחלוטין - התוויות עצמן הן נתון-משתמש, לא
  // רשימת-שדות קבועה של האפליקציה. לעולם לא משפיעה על calculated_quantity/
  // total_price - תצוגה בלבד (עריכה + Public Quote).
  const addSpecificationRow = (itemIndex) => {
    setItems(prev => prev.map((it, i) => i === itemIndex
      ? { ...it, specification: [...(it.specification || []), { label: '', value: '' }] }
      : it));
  };

  const handleSpecificationChange = (itemIndex, rowIndex, field, value) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it;
      const rows = (it.specification || []).map((s, ri) => (ri === rowIndex ? { ...s, [field]: value } : s));
      return { ...it, specification: rows };
    }));
  };

  const removeSpecificationRow = (itemIndex, rowIndex) => {
    setItems(prev => prev.map((it, i) => (i === itemIndex ? { ...it, specification: (it.specification || []).filter((_, ri) => ri !== rowIndex) } : it)));
  };

  async function handleAddService(e) {
    e.preventDefault();
    if (!session?.user?.id) return;
    const { error } = await supabase.from('services').insert([{ name: newServiceName, price: Number(newServicePrice), user_id: session.user.id }]);
    if (error) setAlertModalMsg(isHebrew ? 'שגיאה בהוספת השירות: ' + error.message : 'Error adding service: ' + error.message);
    else {
      setNewServiceName('');
      setNewServicePrice('');
      fetchServices(session.user.id);
      setStatusMsg({ text: isHebrew ? 'השירות נוסף לקטלוג בהצלחה!' : 'Service added to catalog successfully', type: 'success' });
    }
  }

  async function handleSaveEditedService(serviceId) {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('services')
      .update({ name: editServiceName, price: Number(editServicePrice) })
      .eq('id', serviceId);

    if (error) {
      setAlertModalMsg(isHebrew ? 'שגיאה בעדכון השירות: ' + error.message : 'Error updating service: ' + error.message);
    } else {
      setEditingServiceId(null);
      setEditServiceName('');
      setEditServicePrice('');
      fetchServices(session.user.id);
      setStatusMsg({ text: isHebrew ? 'השירות עודכן בהצלחה!' : 'Service updated successfully!', type: 'success' });
    }
  }

  async function executeDeleteService(id) {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) setAlertModalMsg(isHebrew ? 'שגיאה במחיקת השירות: ' + error.message : 'Error deleting service: ' + error.message);
    else fetchServices(session.user.id);
  }

  function requestDeleteService(id, serviceName) {
    const trimmed = (serviceName || '').trim();
    setPendingDelete({
      type: 'service',
      id,
      title: isHebrew ? 'להסיר מהקטלוג?' : 'Remove from catalog?',
      message: trimmed
        ? (isHebrew ? `"${trimmed}" יוסר מהקטלוג ולא ניתן יהיה לשחזר אותו.` : `"${trimmed}" will be removed from your catalog and can't be recovered.`)
        : (isHebrew ? 'השירות יוסר מהקטלוג ולא ניתן יהיה לשחזר אותו.' : 'This service will be removed from your catalog and can\'t be recovered.'),
      confirmLabel: isHebrew ? 'מחיקה' : 'Delete',
    });
  }

  const sendWhatsApp = (proposal) => {
    const clientNameVal = proposal.clients?.company_name || (isHebrew ? 'לקוח' : 'Client');
    let rawPhone = proposal.clients?.phone ? proposal.clients.phone.trim() : '';
    
    let cleanPhone = rawPhone.replace(/[^\d+]/g, '');

    if (cleanPhone.startsWith('00')) {
      cleanPhone = '+' + cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('0') && !cleanPhone.startsWith('00')) {
      cleanPhone = '+972' + cleanPhone.slice(1);
    } else if (/^\d{9,15}$/.test(cleanPhone)) {
      cleanPhone = '+' + cleanPhone;
    }
    
    const phoneForUrl = cleanPhone.replace('+', '');

    const proposalCurr = (proposal.currency || currency || 'USD').toUpperCase();
    // הסמל נגזר אך ורק מקוד המטבע השמור על ההצעה עצמה - לא מסיווג העסק
    // הנוכחי (isLocalIsraeliBusiness), כדי שהצעה ישנה ב-ILS תמשיך להציג ₪
    // גם אם סיווג העסק שונה מאז ל-International (ולהפך).
    const proposalSym = proposalCurr === 'ILS' ? '₪' : (proposalCurr === 'EUR' ? '€' : proposalCurr === 'GBP' ? '£' : '$');

    // שפת הקישור נגזרת מנתוני ההצעה עצמה (currency/tax_rate) ולא מהגדרת השפה של המשתמש המחובר
    const isLocalQuote = Number(proposal.tax_rate) > 0 || proposalCurr === 'ILS';
    const quoteViewLink = isLocalQuote
      ? `${window.location.origin}/public-quote/${proposal.id}`
      : `${window.location.origin}/en/public-quote/${proposal.id}?lang=en`;

    const senderName = bizName || 'TEKANGO';
    // כמו הקישור והסמל למעלה - נוסח ההודעה נגזר מנתוני ההצעה עצמה
    // (isLocalQuote), לא משפת התצוגה הנוכחית של המשתמש המחובר.
    // formatQuoteFallback משתמש ב-quote_number האמיתי כשקיים (יכול כבר
    // להיות ערך אמיתי היום, ממקור global-sequence קיים-מראש - ר'
    // PROFLOW_TODO.md item 17), ונופל בבטחה למספר ה-UUID המקוצר אחרת.
    const proposalNumberDisplay = formatQuoteFallback(proposal);
    const text = isLocalQuote
      ? `הצעת מחיר מאת: ${senderName}\n\nהי ${clientNameVal}, הנה הצעת המחיר שלך מספר ${proposalNumberDisplay} בסך ${proposalSym}${formatNum(proposal.total)}. בתוקף עד ${proposal.valid_until || 'ללא הגבלה'}.\n\nצפה בהצעה:\n${quoteViewLink}`
      : `Quote from: ${senderName}\n\nHi ${clientNameVal}, here is your quote ${proposalNumberDisplay} totaling ${proposalSym}${formatNum(proposal.total)}. Valid until ${proposal.valid_until || 'N/A'}.\n\nView quote:\n${quoteViewLink}`;
    
    const url = phoneForUrl 
      ? `https://api.whatsapp.com/send?phone=${phoneForUrl}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      
    window.open(url, '_blank');
  };

  const executeEmailSend = async (quote) => {
    const clientEmailVal = quote.clients?.email || quote.client_email || '';
    
    if (!clientEmailVal || !emailEmailValidation(clientEmailVal)) {
      setEmailStatuses(prev => ({ ...prev, [quote.id]: 'failed' }));
      setAlertModalMsg(isHebrew ? '❌ שגיאה: כתובת האימייל של הלקוח אינה חוקית או חסרה!' : '❌ Invalid client email address!');
      return;
    }

    setStatusMsg({ text: isHebrew ? 'שולח אימייל דרך הענן...' : 'Sending email via cloud...', type: 'success' });

    try {
      const quoteCurr = (quote.currency || currency || 'USD').toUpperCase();
      // ראו הערה המקבילה ב-sendWhatsApp למעלה - הסמל נגזר מהמטבע השמור
      // על ההצעה, לא מסיווג העסק הנוכחי.
      const quoteSym = quoteCurr === 'ILS' ? '₪' : (quoteCurr === 'EUR' ? '€' : quoteCurr === 'GBP' ? '£' : '$');
      // שפת הקישור נגזרת מנתוני ההצעה עצמה (currency/tax_rate) ולא מהגדרת השפה של המשתמש המחובר
      const isLocalQuote = Number(quote.tax_rate) > 0 || quoteCurr === 'ILS';
      const quoteLink = isLocalQuote
        ? `${window.location.origin}/public-quote/${quote.id}`
        : `${window.location.origin}/en/public-quote/${quote.id}?lang=en`;
      
      const clientNameVal = quote.clients?.company_name || quote.client_name || 'Client';

      const payload = {
        to: clientEmailVal,
        clientName: clientNameVal,
        quoteId: quote.id,
        total: formatNum(quote.total),
        currencySymbol: quoteSym,
        quoteLink: quoteLink,
        businessName: bizName,
        logoUrl: bizLogoUrl,
        businessLogo: bizLogoUrl,
        logo: bizLogoUrl,
        isHebrew: isHebrew
      };

      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: payload
      });

      if (error) {
        throw error;
      }
      
      if (data && data.error) {
        throw new Error(data.error);
      }

      // שליחה מחדש מנקה סימון "הוחזר" קודם - אחרת נורית אדומה ישנה הייתה
      // ממשיכה להיראות גם אחרי שהכתובת תוקנה ונשלחה בהצלחה מחדש. הכשל
      // האמיתי (אם יש) יגיע מאוחר יותר דרך ה-Webhook ויעדכן שוב לאדום.
      await supabase.from('quotes').update({ email_bounced: false, email_bounce_reason: null, email_bounced_at: null }).eq('id', quote.id);
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, email_bounced: false, email_bounce_reason: null, email_bounced_at: null } : q));

      setEmailStatuses(prev => ({ ...prev, [quote.id]: 'success' }));
      setStatusMsg({ text: isHebrew ? '📧 האימייל נשלח בהצלחה!' : '📧 Email sent successfully!', type: 'success' });
    } catch (err) {
      console.error("Email send error:", err);
      setEmailStatuses(prev => ({ ...prev, [quote.id]: 'failed' }));
      setAlertModalMsg(isHebrew ? '❌ שליחת האימייל נכשלה.' : '❌ Email sending failed.');
    }
  };

  // חוק ברזל (Entitlement/Quota Centralization, §150, סעיף 4 - Capability
  // Centralization): קורא ישירות ל-entitlement.editDuplicate/whatsappDelete
  // (resolveAccountEntitlement, למעלה) במקום isBasicOrAbove/isPro שנגזרו
  // בנפרד - אותה עובדה בפועל בכל מקרה רגיל (שתי הנוסחאות מבוססות tier זהה),
  // אבל עכשיו נקודת-אמת אחת שגם מוכנה-מראש עבור תיקון-Lifetime עתידי.
  const handleProtectedAction = (quoteId, actionType, callback) => {
    if (actionType === 'edit' || actionType === 'duplicate') {
      if (!entitlement.editDuplicate) {
        setShowPricingModal(true);
        return;
      }
    }
    if (actionType === 'whatsapp' || actionType === 'delete') {
      if (!entitlement.whatsappDelete) {
        setShowPricingModal(true);
        return;
      }
    }
    callback();
  };

  // תצוגה (preview) בלבד - לעולם לא מקור אמת לשמירה. handleSaveQuote (Step
  // 1-3) שולף מחדש מהשרת ומחשב בנפרד את הערכים שבאמת נשמרים; שינוי כאן
  // משפיע רק על מה שהמשתמש רואה בטופס לפני לחיצה על "שמור". אותה
  // calculateQuoteFinancials בדיוק (ללא נוסחת מע"מ עצמאית נוספת) כדי
  // שהתצוגה תתאים ל-total שבאמת יישמר: להצעה חדשה - אזור/תעריף נגזרים
  // מ-bizCountry הנוכחי (כמו שהיה גם קודם); לעריכת הצעה קיימת - אזור נגזר
  // ממטבע ההצעה הקיימת ו-tax_rate ההיסטורי שלה משמש override, בדיוק לפי
  // אותו עיקרון fail-closed שכבר אושר ב-Step 2 (לעולם לא לגזור tax_rate
  // מחדש מהגדרות האזור הנוכחיות של החשבון עבור הצעה קיימת).
  const editingOriginalQuote = editingQuoteId ? quotes.find(q => q.id === editingQuoteId) : null;

  const previewRegionCountry = editingOriginalQuote
    ? ((editingOriginalQuote.currency || '').toUpperCase() === 'ILS' ? 'Local' : 'International')
    : bizCountry;

  const previewTaxRateOverride = (editingOriginalQuote
    && typeof editingOriginalQuote.tax_rate === 'number'
    && Number.isFinite(editingOriginalQuote.tax_rate)
    && editingOriginalQuote.tax_rate >= 0)
    ? editingOriginalQuote.tax_rate
    : undefined;

  // חוק ברזל (Professional Quotes Stage C, §158): calculateQuoteFinancials
  // עצמה (regionConfig.js) לא נגעה - עדיין קוראת item.quantity ישירות, כפי
  // שהייתה תמיד. withActiveQuantities מנרמל עותק-items לפני הקריאה כך
  // שפריט מקצועי מתומחר לפי calculated_quantity (כשקיים), לא ה-quantity
  // הגולמי (שנשאר 1/integer, לא נוגע בו כלל - ר' Stage A/§155.8).
  const previewFinancials = calculateQuoteFinancials({
    country: previewRegionCountry,
    clientType,
    items: withActiveQuantities(items),
    discount,
    taxRateOverride: previewTaxRateOverride,
  });

  const subtotal = previewFinancials.enteredSubtotal;
  const discountAmount = previewFinancials.discountAmount;
  // clientTypeAmbiguous (הצעה מקומית חדשה לפני שנבחר סוג לקוח): מציגים 0%
  // מע"מ כברירת מחדל ניטרלית עד שהמשתמש יבחר בפועל - לא מנחשים Business
  // ולא Private. handleSaveQuote חוסם בכל מקרה שמירה במצב הזה (fail-closed).
  const taxRate = previewFinancials.taxRate ?? 0;
  const taxAmount = previewFinancials.taxAmount ?? 0;
  const totalAmount = previewFinancials.total ?? (subtotal - discountAmount);

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyQuotesCount = quotes.filter(q => {
    const qDate = new Date(q.created_at);
    return qDate.getMonth() === currentMonth && qDate.getFullYear() === currentYear;
  }).length;

  // חוק ברזל (Entitlement/Quota Centralization, §150, סעיף 3 - Fix Item 50):
  // מקור יחיד קנוני - entitlement.monthlyQuoteLimit (resolveAccountEntitlement,
  // למעלה) - במקום נוסחת-ternary עצמאית שהוכפלה כאן ובשער האכיפה למטה
  // (handleSaveQuote) בנפרד. תיקון-חיווט בלבד, לא נוסחה חדשה - ר' התיעוד
  // המלא ב-PROFLOW_PROJECT_CONTEXT.md §149/§150.
  const planLimit = entitlement.monthlyQuoteLimit === Infinity ? '∞' : entitlement.monthlyQuoteLimit;

  const totalQuotesCount = quotes.length;
  const totalRevenue = quotes.filter(q => q.status?.toLowerCase() === 'approved' || q.status?.toLowerCase() === 'paid').reduce((sum, q) => sum + Number(q.total || 0), 0);

  const reportYear = now.getFullYear();
  const reportMonth = now.getMonth();

  const filteredQuotesForReport = quotes.filter(q => {
    if (!(q.status?.toLowerCase() === 'approved' || q.status?.toLowerCase() === 'paid')) return false;
    const qDate = new Date(q.created_at);

    if (financeReportType === 'custom') {
      if (!startDate && !endDate) return true;
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      return qDate >= start && qDate <= end;
    }

    if (qDate.getFullYear() !== reportYear) return false;

    if (financeReportType === 'monthly') {
      return qDate.getMonth() === reportMonth;
    } else if (financeReportType === 'quarterly') {
      const currentQuarter = Math.floor(reportMonth / 3);
      const qQuarter = Math.floor(qDate.getMonth() / 3);
      return qQuarter === currentQuarter;
    } else if (financeReportType === 'half-yearly') {
      const currentHalf = reportMonth < 6 ? 0 : 1;
      const qHalf = qDate.getMonth() < 6 ? 0 : 1;
      return qHalf === currentHalf;
    } else {
      return true;
    }
  });

  const filteredExpensesForReport = expenses.filter(exp => {
    const expDate = new Date(exp.expense_date);
    if (exp.is_recurring) return true;

    if (financeReportType === 'custom') {
      if (!startDate && !endDate) return true;
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      return expDate >= start && expDate <= end;
    }

    if (expDate.getFullYear() !== reportYear) return false;

    if (financeReportType === 'monthly') {
      return expDate.getMonth() === reportMonth;
    } else if (financeReportType === 'quarterly') {
      const currentQuarter = Math.floor(reportMonth / 3);
      const expQuarter = Math.floor(expDate.getMonth() / 3);
      return expQuarter === currentQuarter;
    } else if (financeReportType === 'half-yearly') {
      const currentHalf = reportMonth < 6 ? 0 : 1;
      const expHalf = expDate.getMonth() < 6 ? 0 : 1;
      return expHalf === currentHalf;
    } else {
      return true;
    }
  });

  const adminTotalQuotesCount = filteredQuotesForReport.length;
  const adminTotalRevenue = filteredQuotesForReport.reduce((sum, q) => sum + Number(q.total || 0), 0);
  const adminTotalExpenses = filteredExpensesForReport.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const adminNetProfit = adminTotalRevenue - adminTotalExpenses;

  // חוק ברזל (Task F item 2, real defect found+fixed): monthNames היה קבוע-
  // אנגלי-בלבד ('Jan'..'Dec') ומועבר כ-name לכל נקודת-chartData ללא תלות
  // בשפה - כך שבדף ה-Finances העברי הופיעו קיצורי-חודש אנגליים גולמיים
  // (למשל "Oct") על ה-XAxis. תוקן: קיצורים עבריים כש-isHebrew===true
  // (המשתנה הקיים כבר בהיקף-הפונקציה, ר' שורה 141), אנגליים אחרת. לא נוגע
  // בשום דבר אחר בלוגיקת-הצבירה שמתחת (income/expense נשארים זהים).
  const monthNames = isHebrew
    ? ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = monthNames.map((name, index) => {
    let income = 0;
    let expense = 0;
    
    quotes.forEach(q => {
      if (q.status?.toLowerCase() === 'approved' || q.status?.toLowerCase() === 'paid') {
        const d = new Date(q.created_at);
        if (d.getFullYear() === reportYear && d.getMonth() === index) {
          income += Number(q.total || 0);
        }
      }
    });

    expenses.forEach(exp => {
      const d = new Date(exp.expense_date);
      if (exp.is_recurring) {
        if (d.getFullYear() < reportYear || (d.getFullYear() === reportYear && d.getMonth() <= index)) {
          expense += Number(exp.amount || 0);
        }
      } else if (d.getFullYear() === reportYear && d.getMonth() === index) {
        expense += Number(exp.amount || 0);
      }
    });

    return { name, Income: income, Expenses: expense };
  });

  const showQuoteForm = isCreatingQuote || editingQuoteId !== null;

  // חוק ברזל (Professional Quotes Stage C, §158): נקודת-מיפוי משותפת אחת
  // מ-quote_items(+quote_item_measurements) הגולמיים (כפי שנשלפים כבר
  // מ-fetchQuotes, ר' quote_item_measurements(*) שנוסף לשם) אל צורת ה-item
  // שה-form state (items) משתמש בה - נקראת גם מ-handleEditClick וגם
  // מ-handleDuplicateQuote כדי שלא תהיה שתי נוסחאות-מיפוי בלתי-תלויות.
  // keepId=true (עריכה): שומר את quote_item.id האמיתי (נדרש לנתיב עדכון-
  // description-בלבד הקיים) ואת quote_item_measurements[].id (לא בשימוש-
  // ישיר כרגע אך משומר לעקביות). keepId=false (שכפול): לעולם לא סוחב id
  // ישן - שורות חדשות לגמרי ייווצרו בשמירה הבאה, בדיוק כמו שהתנהגות-
  // השכפול הקיימת כבר עושה עבור quote_items עצמם.
  const mapQuoteItemToFormItem = (item, { keepId }) => ({
    ...(keepId ? { id: item.id } : {}),
    description: item.description,
    quantity: item.quantity || '1',
    unit_price: item.unit_price,
    isFromCatalog: false,
    pricing_unit: item.pricing_unit || null,
    calculated_quantity: (item.calculated_quantity !== undefined && item.calculated_quantity !== null) ? item.calculated_quantity : '',
    quantity_source: item.quantity_source || null,
    specification: normalizeSpecificationRows(item.specification),
    // חוק ברזל (§168 - Project/Section hierarchy, 30.C): section_key
    // מנורמל ל-section_id האמיתי (keepId:true, עריכה) - נקודת-הצטרפות
    // יציבה מול ה-sections שנטענו במקביל (ר' handleEditClick/
    // handleDuplicateQuote). keepId:false (שכפול): section_key מסופק
    // בנפרד ע"י הקורא (מיפוי id-ישן→tempKey-חדש), לא כאן.
    section_key: keepId ? (item.section_id || null) : undefined,
    calculation_method: item.calculation_method || null,
    measurements: (item.quote_item_measurements || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(m => ({
        ...(keepId ? { id: m.id } : {}),
        width: m.width !== undefined && m.width !== null ? m.width : '',
        height: m.height !== undefined && m.height !== null ? m.height : '',
        unit: m.unit || 'm',
        calculated_area: m.calculated_area,
        label: m.label || '',
        is_pricing_driving: m.is_pricing_driving !== false,
      })),
  });

  const handleEditClick = async (quote) => {
    if (isQuoteImmutable(quote)) {
      setAlertModalMsg(isHebrew ? 'לא ניתן לערוך הצעה מאושרת/חתומה.' : 'Cannot edit an approved/signed quote.');
      return;
    }

    setEditingQuoteId(quote.id);
    setIsCreatingQuote(false);
    setClientName(quote.clients?.company_name || '');
    setClientEmail(quote.clients?.email || '');
    setClientPhone(quote.clients?.phone || '');
    setClientType(quote.client_type || quote.clients?.client_type || '');
    setClientTaxId(quote.clients?.tax_id || '');
    setClientAddress(quote.clients?.address || '');
    setQuoteSubject(quote.subject || quote.quote_subject || '');
    setAttnName(quote.attn_name || '');
    setAttnRole(quote.attn_role || '');
    setProjectName(quote.project_name || '');
    // חוק ברזל (§168 - Project/Section hierarchy, 30.C): sections נטענות
    // עם key===id (מזהה-הצטרפות אמיתי ויציב, ר' mapQuoteItemToFormItem
    // למעלה שכבר ממפה item.section_id ל-section_key בדיוק לאותו ערך).
    setSections((quote.quote_sections || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(s => ({ key: s.id, id: s.id, name: s.name, sort_order: s.sort_order || 0 })));

    const quoteCurr = quote.currency || (isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
    setCurrency(quoteCurr);

    setQuoteStatus(quote.status ? quote.status.charAt(0).toUpperCase() + quote.status.slice(1) : 'Draft');
    setValidUntil(quote.valid_until || '');
    setDiscount(quote.discount || ''); 

    let editTerms = quote.terms || (isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    let editNotes = quote.notes || '';
    let editWarranty = quote.warranty || '';

    setTerms(editTerms);
    setNotes(editNotes);
    setWarranty(editWarranty);

    if (quote.quote_items && quote.quote_items.length > 0) {
      // שומרים את ה-id האמיתי של כל quote_item בזמן טעינת עריכה - זהו המזהה
      // היחיד שמאפשר בהמשך (handleSaveQuote) לבצע UPDATE ממוקד ובטוח של
      // description בלבד על עריכה לא-פיננסית, בלי DELETE+INSERT ובלי להסתמך
      // על סדר המערך. פריטים חדשים שנוספים אחר-כך (addItem/מקטלוג) נשארים
      // בלי id בכוונה - הוספת/הסרת פריט היא ממילא שינוי פיננסי.
      setItems(quote.quote_items.map(item => mapQuoteItemToFormItem(item, { keepId: true })));
    } else {
      setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
    }

    const { data: attData } = await supabase.from('quote_attachments').select('*').eq('quote_id', quote.id);
    setQuoteFiles(attData ? attData.map(f => ({ ...f, size: f.file_size })) : []);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatusMsg({ text: isHebrew ? `עורך הצעה ${formatQuoteFallback(quote)}...` : `Editing Quote ${formatQuoteFallback(quote)}...`, type: 'success' });
  };

  // חוק ברזל (תיקון בעלים מאושר): setActiveTab('main') נוסף כאן כי ה-CTA
  // "הצעת מחיר חדשה" הוא פעולת-על גלובלית של הדשבורד, נגישה מתוך כל טאב
  // (Clients/Finances/Settings/Catalog) - אך טופס ההצעה עצמו מוצג רק תחת
  // activeTab === 'main' (ר' showQuoteForm למטה). בלי השורה הזו, לחיצה
  // מטאב שאינו 'main' עדכנה state פנימי (isCreatingQuote) בלי לרנדר שום
  // דבר גלוי - זה היה הפער שדווח ותוקן כאן, לא מומש טופס נפרד/כפול.
  const handleCreateNewQuoteClick = () => {
    setActiveTab('main');
    setIsCreatingQuote(true);
    setEditingQuoteId(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientType('');
    setClientTaxId('');
    setClientAddress('');
    setQuoteSubject('');
    setAttnName('');
    setAttnRole('');
    setValidUntil('');
    setDiscount('');
    setCurrency(isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
    setTerms(defaultTerms);
    setWarranty(defaultWarranty);
    setNotes('');
    setQuoteFiles([]);
    setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
    setSections([]);
    setProjectName('');
  };

  const handleDuplicateQuote = async (quote) => {
    setEditingQuoteId(null); 
    setIsCreatingQuote(true);
    setClientName(quote.clients?.company_name || '');
    setClientEmail(quote.clients?.email || '');
    setClientPhone(quote.clients?.phone || '');
    setClientType(quote.client_type || quote.clients?.client_type || '');
    setClientTaxId(quote.clients?.tax_id || '');
    setClientAddress(quote.clients?.address || '');
    setQuoteSubject(quote.subject || quote.quote_subject || '');
    setAttnName(quote.attn_name || '');
    setAttnRole(quote.attn_role || '');
    
    // אם ההצעה המקורית הייתה ILS (למשל מלפני שהעסק סווג כ-International),
    // אין להעתיק זאת להצעה החדשה - מטבע לא חוקי לחשבון International.
    const originalDupCurr = (quote.currency || '').toUpperCase();
    const quoteCurr = isLocalIsraeliBusiness
      ? 'ILS'
      : (['USD', 'EUR', 'GBP'].includes(originalDupCurr) ? originalDupCurr : (currency || 'USD'));
    setCurrency(quoteCurr);

    setQuoteStatus('Draft');
    setValidUntil(quote.valid_until || '');
    setDiscount(quote.discount || '');

    let dupTerms = quote.terms || (isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    let dupNotes = quote.notes || '';
    // Item 23 Warranty: שכפול מעתיק את ה-warranty של הצעת המקור עצמה (בדיוק
    // כמו dupTerms למעלה), לא את ברירת המחדל הנוכחית של העסק - עקבי עם
    // סמנטיקת השכפול הקיימת עבור כל שדה עריכה אחר בהצעה המשוכפלת.
    let dupWarranty = quote.warranty || '';

    setTerms(dupTerms);
    setNotes(dupNotes);
    setWarranty(dupWarranty);
    setQuoteFiles([]);
    setProjectName(quote.project_name || '');

    // חוק ברזל (§168 - Project/Section hierarchy, 30.C, Advanced Reuse
    // §155.18 שורה F): שכפול-הצעה מקצועי - כל section מקבל tempKey חדש
    // לגמרי (לעולם לא סוחב id ישן, זהה לדפוס הקיים כבר לכל quote_item/
    // measurement משוכפלים), ומיפוי old-id→new-tempKey ממופה לכל item
    // ששייך אליו כדי שהמבנה ההיררכי (לא רק הפריטים עצמם) ישוכפל נכון
    // ויישאר עצמאי-לגמרי מהמקור.
    const oldSections = (quote.quote_sections || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const sectionIdToNewKey = new Map();
    const newSections = oldSections.map((s, idx) => {
      const key = `tmp_section_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;
      sectionIdToNewKey.set(s.id, key);
      return { key, name: s.name, sort_order: idx };
    });
    setSections(newSections);

    if (quote.quote_items && quote.quote_items.length > 0) {
      setItems(quote.quote_items.map(item => {
        const mapped = mapQuoteItemToFormItem(item, { keepId: false });
        mapped.section_key = item.section_id ? (sectionIdToNewKey.get(item.section_id) || null) : null;
        return mapped;
      }));
    } else {
      setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatusMsg({ text: isHebrew ? 'ההצעה נטענה לשכפול.' : 'Quote loaded for duplication.', type: 'success' });
  };

  const handleCancelEdit = () => {
    setEditingQuoteId(null);
    setIsCreatingQuote(false);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientType('');
    setClientTaxId('');
    setClientAddress('');
    setQuoteSubject('');
    setAttnName('');
    setAttnRole('');
    setValidUntil('');
    setDiscount('');
    setTerms(defaultTerms);
    setWarranty(defaultWarranty);
    setNotes('');
    setQuoteFiles([]);
    setCurrency(isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
    setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
    setSections([]);
    setProjectName('');
    setStatusMsg({ text: isHebrew ? 'הפעולה בוטלה.' : 'Action cancelled.', type: 'success' });
  };

  async function handleSaveQuote(e) {
    e.preventDefault();
    if (!session?.user?.id) return;

    if (clientEmail && clientEmail.trim() !== '' && !emailEmailValidation(clientEmail)) {
      setAlertModalMsg(isHebrew ? '❌ שגיאה: כתובת האימייל של הלקוח אינה חוקית!' : '❌ Invalid email address!');
      return;
    }

    try {
      // מקור אמת פיננסי אמין לעריכת הצעה קיימת: שולפים מחדש את ההצעה ואת
      // פריטיה ישירות מהשרת - לא מסתמכים על quotes.find (state מקומי שעלול
      // להיות מיושן). זה בדיוק מנגנון הכשל שגרם לתקרית ה-VAT ההיסטורית
      // (עריכה שהתבססה על מצב לקוח לא-רענן ודרסה tax_rate/currency תקינים).
      let authoritativeQuote = null;
      let authoritativeItems = null;

      if (editingQuoteId) {
        const { data: fetchedQuote, error: fetchQuoteErr } = await supabase
          .from('quotes')
          .select('id, currency, client_type, tax_rate, subtotal, discount, total, status')
          .eq('id', editingQuoteId)
          .single();

        const { data: fetchedItems, error: fetchItemsErr } = await supabase
          .from('quote_items')
          .select('id, description, quantity, unit_price, total_price')
          .eq('quote_id', editingQuoteId);

        if (fetchQuoteErr || !fetchedQuote || fetchItemsErr || !fetchedItems) {
          setAlertModalMsg(isHebrew
            ? 'לא ניתן היה לאמת את מצב ההצעה הקיים מול השרת. השמירה בוטלה כדי למנוע פגיעה בנתונים פיננסיים.'
            : 'Could not verify the existing quote against the server. Save cancelled to protect financial data.');
          return;
        }

        authoritativeQuote = fetchedQuote;
        authoritativeItems = fetchedItems;

        if (isQuoteImmutable(authoritativeQuote)) {
          setAlertModalMsg(isHebrew ? 'לא ניתן לעדכן הצעה מאושרת/חתומה.' : 'Cannot edit an approved/signed quote.');
          return;
        }
      }

      if (!editingQuoteId && !isSuperAdmin) {
        // חוק ברזל (§150, סעיף 3): אותו entitlement.monthlyQuoteLimit בדיוק
        // כמו planLimit למעלה - אכיפה וחיווט חייבים לצרוך את אותו ערך קנוני
        // יחיד (ר' §24 בעלים - DISPLAY QUOTA === ENFORCEMENT QUOTA === CANONICAL
        // ENTITLEMENT QUOTA).
        const limit = entitlement.monthlyQuoteLimit;
        if (monthlyQuotesCount >= limit) {
          setAlertModalMsg(
            isHebrew ? `הגעת למכסת ההצעות החודשית לחבילה שלך (${limit} הצעות). שדרג כדי ליצור עוד!` : `Monthly quote limit reached for your plan (${limit} quotes). Upgrade to create more!`
          );
          return;
        }
      }

      // --- זיהוי דטרמיניסטי: האם זוהי עריכה פיננסית או לא-פיננסית? ---
      // שדות פיננסיים-סמנטיים בלבד: items/quantities/unit_prices/discount/
      // client_type. שינוי טקסט/סדר מערך/ייצוג string-מול-number שאינו משנה
      // את המשמעות הפיננסית בפועל אינו נספר כשינוי (numKey מנרמל את שניהם;
      // מיון ה-pairs הופך את הבדיקה לבלתי-תלויה בסדר). אם multiset הזוגות
      // (quantity, unit_price) זהה, סכום הביניים המחושב יהיה זהה במדויק בכל
      // מקרה - כך שאין צורך "לתפוס" שינוי קוסמטי כזה כפיננסי.
      let isFinancialEdit = true;
      let effectiveClientType = clientType;
      let financialQuotePatch = null;
      let descriptionUpdates = null;
      let newQuoteFinancials = null;

      if (editingQuoteId) {
        const numKey = (v) => Number(v || 0).toFixed(6);
        const normType = (v) => v || '';

        const currentItemPairs = items.map(it => `${numKey(it.quantity)}|${numKey(it.unit_price)}`).sort();
        const authoritativeItemPairs = authoritativeItems.map(it => `${numKey(it.quantity)}|${numKey(it.unit_price)}`).sort();
        const itemsChanged = currentItemPairs.length !== authoritativeItemPairs.length
          || currentItemPairs.some((v, i) => v !== authoritativeItemPairs[i]);

        const discountChanged = numKey(discount) !== numKey(authoritativeQuote.discount);
        const clientTypeChanged = normType(clientType) !== normType(authoritativeQuote.client_type);

        isFinancialEdit = itemsChanged || discountChanged || clientTypeChanged;
        effectiveClientType = clientTypeChanged ? normType(clientType) : normType(authoritativeQuote.client_type);

        if (!isFinancialEdit) {
          // עריכה לא-פיננסית: משמרים במדויק (verbatim) את כל השדות
          // הפיננסיים כפי שנשלפו מהשרת - בלי לגזור currency/client_type/
          // tax_rate מחדש מהגדרות העסק/אזור הנוכחיים. זה כולל שימור
          // client_type ריק/legacy בדיוק כפי שהוא שמור בהצעה הקיימת.
          financialQuotePatch = {
            currency: authoritativeQuote.currency,
            client_type: authoritativeQuote.client_type,
            tax_rate: authoritativeQuote.tax_rate,
            subtotal: authoritativeQuote.subtotal,
            discount: authoritativeQuote.discount,
            total: authoritativeQuote.total,
          };

          // מיפוי בטוח של עריכת description בלבד: לעולם לא לפי index (סדר
          // עלול להשתנות) - רק לפי quote_items.id האמיתי שנשמר על כל פריט
          // בזמן טעינת העריכה (ר' handleEditClick). אם המיפוי אינו בדיוק
          // חד-חד-ערכי (id חסר על פריט, id כפול, או שסט ה-id-ים של הטופס
          // אינו זהה בדיוק לסט ה-id-ים האמיתי) - נכשלים בבטחה ולא כותבים
          // כלום, כדי לא להחיל תיאור על פריט לא-נכון ולא ליפול חזרה על
          // DELETE+INSERT (שהיה מוחק/מייצר id-ים חדשים).
          const formIds = items.map(it => it.id);
          const authoritativeIds = authoritativeItems.map(it => it.id);
          const formIdsMappingSafe =
            formIds.length === authoritativeIds.length &&
            formIds.every(id => id !== undefined && id !== null) &&
            new Set(formIds).size === formIds.length &&
            formIds.every(id => authoritativeIds.includes(id));

          if (!formIdsMappingSafe) {
            setAlertModalMsg(isHebrew
              ? 'לא ניתן היה למפות בבטחה את פריטי ההצעה לצורך שמירת שינוי בתיאור. השמירה בוטלה כדי למנוע שיוך תיאור לפריט הלא-נכון.'
              : 'Could not safely map this quote\'s items to save a description change. Save cancelled to avoid applying a description to the wrong item.');
            return;
          }

          descriptionUpdates = items
            .filter(formItem => {
              const authItem = authoritativeItems.find(a => a.id === formItem.id);
              return (formItem.description || '') !== (authItem.description || '');
            })
            .map(formItem => ({ id: formItem.id, description: formItem.description || '' }));
        } else {
          const curr = (authoritativeQuote.currency || '').toUpperCase();
          let region;
          if (curr === 'ILS') region = 'Local';
          else if (curr === 'USD' || curr === 'EUR' || curr === 'GBP') region = 'International';
          else {
            setAlertModalMsg(isHebrew
              ? 'לא ניתן לקבוע אזור/מטבע אמין להצעה זו לצורך חישוב פיננסי. השמירה בוטלה.'
              : 'Could not determine a reliable region/currency for this quote for financial recalculation. Save cancelled.');
            return;
          }

          if (region === 'Local' && effectiveClientType !== 'business' && effectiveClientType !== 'private') {
            setAlertModalMsg(isHebrew
              ? 'יש לבחור סוג לקוח תקין (עסקי/פרטי) כדי לשמור שינוי פיננסי בהצעה מקומית.'
              : 'A valid client type (Business/Private) is required to save a financial change on a Local quote.');
            return;
          }

          // ה-tax_rate ההיסטורי השמור על ההצעה הוא מקור האמת היחיד - לעולם
          // לא לגזור אותו מחדש מאזור/הגדרות החשבון הנוכחיים. אם הוא חסר או
          // לא-תקין (הצעה legacy פגומה), נכשלים בבטחה כאן ולא סומכים על
          // calculateQuoteFinancials שיתייחס אליו כ"לא סופק" ויחזור לברירת
          // מחדל אזורית - זה בדיוק ההתנהגות שהתקרית המקורית נגרמה ממנה.
          const persistedTaxRate = authoritativeQuote.tax_rate;
          const persistedTaxRateValid = typeof persistedTaxRate === 'number' && Number.isFinite(persistedTaxRate) && persistedTaxRate >= 0;
          if (!persistedTaxRateValid) {
            setAlertModalMsg(isHebrew
              ? 'שיעור המע"מ השמור בהצעה זו חסר או לא תקין. לא ניתן לבצע שינוי פיננסי בבטחה. השמירה בוטלה.'
              : 'This quote\'s persisted tax rate is missing or invalid. A financial change cannot be safely saved. Save cancelled.');
            return;
          }

          const result = calculateQuoteFinancials({
            country: region,
            clientType: effectiveClientType,
            items: withActiveQuantities(items),
            discount,
            taxRateOverride: persistedTaxRate,
          });

          if (result.clientTypeAmbiguous || result.taxRateOverrideInvalid) {
            setAlertModalMsg(isHebrew
              ? 'לא ניתן היה לחשב את הנתונים הפיננסיים של ההצעה בבטחה. השמירה בוטלה.'
              : 'Could not safely calculate this quote\'s financial data. Save cancelled.');
            return;
          }

          financialQuotePatch = {
            currency: authoritativeQuote.currency,
            client_type: effectiveClientType,
            tax_rate: result.taxRate,
            subtotal: result.enteredSubtotal,
            discount: Number(discount || 0),
            total: result.total,
          };
        }
      } else {
        // הצעה חדשה: אותה נקודת אמת פיננסית יחידה (calculateQuoteFinancials)
        // כמו בעריכה פיננסית - בלי override (מקבלים tax_rate מהאזור הנוכחי,
        // isLocalIsraeliBusiness/bizCountry, בדיוק כמו שה-currency הקיים כבר
        // נגזר מהם). ל-Local, client_type תקין (business/private) הוא חובה
        // fail-closed לפני כל כתיבה - לא מנחשים Business/Private כברירת מחדל.
        if (isLocalIsraeliBusiness && clientType !== 'business' && clientType !== 'private') {
          setAlertModalMsg(isHebrew
            ? 'יש לבחור סוג לקוח תקין (עסקי/פרטי) כדי ליצור הצעת מחיר מקומית.'
            : 'A valid client type (Business/Private) is required to create a Local quote.');
          return;
        }

        const result = calculateQuoteFinancials({
          country: bizCountry,
          clientType,
          items: withActiveQuantities(items),
          discount,
        });

        const requiredFieldsValid = [result.enteredSubtotal, result.taxRate, result.total]
          .every(v => typeof v === 'number' && Number.isFinite(v));

        if (result.clientTypeAmbiguous || !requiredFieldsValid) {
          setAlertModalMsg(isHebrew
            ? 'לא ניתן היה לחשב את הנתונים הפיננסיים של ההצעה בבטחה. השמירה בוטלה.'
            : 'Could not safely calculate this quote\'s financial data. Save cancelled.');
          return;
        }

        newQuoteFinancials = {
          subtotal: result.enteredSubtotal,
          tax_rate: result.taxRate,
          total: result.total,
          discount: Number(discount || 0),
        };
      }

      let clientId;
      const existingClient = clients.find(c => c.company_name?.toLowerCase() === clientName.toLowerCase() && c.user_id === session.user.id);
      
      const clientPayload = {
        company_name: clientName,
        email: clientEmail ? clientEmail.trim() : '',
        phone: clientPhone,
        client_type: clientType,
        tax_id: clientTaxId,
        address: clientAddress,
        notes: notes,
        user_id: session.user.id
      };

      if (existingClient) {
        clientId = existingClient.id;
        await supabase.from('clients').update(clientPayload).eq('id', clientId);
      } else {
        const { data: newClientData, error: clientError } = await supabase.from('clients').insert([clientPayload]).select();
        if (clientError) throw clientError;
        clientId = newClientData[0].id;
      }

      // תשלום payload פיננסי: להצעה קיימת נובע *אך ורק* מ-financialQuotePatch
      // (שכבר נגזר מהמצב האמין שנשלף מהשרת למעלה) - לעולם לא מ-subtotal/
      // taxRate/totalAmount המחושבים בגוף הקומפוננטה (שעלולים להסתמך על
      // quotes.find/bizCountry לא-רענן). להצעה חדשה ההתנהגות נשארת זהה
      // לחלוטין להתנהגות הקודמת.
      const quotePayload = editingQuoteId
        ? {
            client_id: clientId,
            client_type: financialQuotePatch.client_type,
            currency: financialQuotePatch.currency,
            subtotal: financialQuotePatch.subtotal,
            tax_rate: financialQuotePatch.tax_rate,
            total: financialQuotePatch.total,
            discount: financialQuotePatch.discount,
            status: quoteStatus.toLowerCase(),
            valid_until: validUntil || null,
            terms: terms,
            warranty: warranty,
            notes: notes,
            subject: quoteSubject || '',
            quote_subject: quoteSubject || '',
            user_id: session.user.id
          }
        : {
            client_id: clientId,
            client_type: clientType,
            currency: isLocalIsraeliBusiness ? 'ILS' : currency,
            subtotal: newQuoteFinancials.subtotal,
            tax_rate: newQuoteFinancials.tax_rate,
            total: newQuoteFinancials.total,
            discount: newQuoteFinancials.discount,
            status: quoteStatus.toLowerCase(),
            valid_until: validUntil || null,
            terms: terms,
            warranty: warranty,
            notes: notes,
            subject: quoteSubject || '',
            quote_subject: quoteSubject || '',
            user_id: session.user.id
          };

      let quoteId;
      // עריכה פיננסית והצעה חדשה: ממשיכים בדיוק כמו קודם - delete+insert
      // מלא מה-state הנוכחי של items. עריכה לא-פיננסית: **אין** delete+insert
      // בכלל (איפס כתיבה אם אין שינוי description; אחרת UPDATE ממוקד per-id
      // בלבד, ר' descriptionUpdates למעלה) - כך שאין שינוי quantity/unit_price/
      // total_price ואין regeneration של quote_item id-ים על עריכה לא-פיננסית.
      let itemsForPersist = items;

      // חוק ברזל (item 18 - Attn/לידי, חבילת יישום מקומית בלבד): attn_name/
      // attn_role עדיין לא קיימות בסביבה החיה (ה-migration המקומי לא הופעל
      // שם - ר' supabase/migrations/20260828000000_add_quote_attn_contact.sql).
      // בניגוד ל-quote_number (RPC נפרד שנכשל בשקט), כאן מדובר בעמודות רגילות
      // בתוך אותו INSERT/UPDATE, שיגרמו לכל הבקשה להיכשל אם העמודה לא קיימת -
      // לכן: ניסיון ראשון כולל attn, ורק אם השגיאה מפורשות מזכירה attn_name/
      // attn_role (זיהוי מדויק, לא בליעת שגיאות אחרות) - ניסיון חוזר זהה
      // בלי השדות האלה, זהה-בייט להתנהגות הקודמת. ברגע שה-migration יופעל
      // בסביבה החיה, הניסיון הראשון יתחיל להצליח אוטומטית בלי שינוי קוד נוסף.
      // חוק ברזל (item 27 - Attn/לידי Client-Name Fallback): אם איש-הקשר
      // (attnName) ריק או רק-רווחים (trim), הנמען שנכתב בפועל ל-attn_name
      // נופל חזרה לשם הלקוח עצמו (אותו clientName שנכתב הרגע ל-
      // clientPayload.company_name למעלה, ר' שורה ~2209) - נכתב כערך אמיתי
      // (snapshot) בזמן השמירה, לא מחושב ב-render. attn_name הוא כבר עמודת
      // תוכן רגילה הנתונה לאותה נעילת guard_quote_immutability() כמו terms/
      // warranty/notes (ר' supabase/migrations/20260830000000_capture_base_
      // schema_tables.sql שורה 213-214) - שום שינוי DB/trigger לא נדרש כאן,
      // ההצעה נשארת היסטורית-יציבה בדיוק כמו כל שדה-תוכן אחר. ערך attn
      // מפורש (אחרי trim) תמיד משתמר כמות שהוא - לעולם לא נדרס בשקט.
      const trimmedAttnName = (attnName || '').trim();
      const resolvedAttnName = trimmedAttnName || clientName || null;
      const attnFields = { attn_name: resolvedAttnName, attn_role: attnRole || null };
      const isMissingAttnColumnError = (err) => {
        const msg = String(err?.message || '');
        return msg.includes('attn_name') || msg.includes('attn_role');
      };

      if (editingQuoteId) {
        let { error: updateError } = await supabase.from('quotes').update({ ...quotePayload, ...attnFields }).eq('id', editingQuoteId);
        if (updateError && isMissingAttnColumnError(updateError)) {
          ({ error: updateError } = await supabase.from('quotes').update(quotePayload).eq('id', editingQuoteId));
        }
        if (updateError) throw updateError;
        quoteId = editingQuoteId;

        if (isFinancialEdit) {
          await supabase.from('quote_items').delete().eq('quote_id', quoteId);
        } else {
          for (const upd of descriptionUpdates) {
            const { error: descUpdateError } = await supabase
              .from('quote_items')
              .update({ description: upd.description })
              .eq('id', upd.id)
              .eq('quote_id', quoteId);
            if (descUpdateError) throw descUpdateError;
          }
          itemsForPersist = null;
        }
      } else {
        // עדכון 2026-08-28 (Quote Number Transition audit): ההערה הקודמת כאן
        // הניחה ש-quote_number "יישאר ללא ערך" כשה-RPC הזה נכשל - זה שגוי.
        // allocate_quote_number(uuid) אכן לא קיימת עדיין בסביבה החיה, אז
        // הקריאה נכשלת בשקט כמתואר, אבל quotes.quote_number עצמה כבר קיימת
        // שם כעמודה integer NOT NULL עם DEFAULT מ-global sequence משלה
        // (מנגנון קיים-מראש, לא של המאגר הזה - ר' PROFLOW_TODO.md item 17
        // לפרטי ה-audit) - כך שה-INSERT ממשיך להצליח, אבל מקבל מספר גלובלי
        // לא-מתוכנן במקום ליפול פשוט בלי מספר בכלל (זו התגלית "A90" המתועדת
        // שם). ההתנהגות כאן נשארת בכוונה ללא שינוי בסבב הזה - שינוי לכישלון
        // מבוקר (fail-closed) יהיה חלק מהשחרור המתואם העתידי, לא נכפה כאן
        // נגד הסכימה החיה הנוכחית שעדיין לא עברה migration.
        try {
          const { data: allocatedNumber, error: allocError } = await supabase.rpc('allocate_quote_number', { p_user_id: session.user.id });
          if (!allocError && typeof allocatedNumber === 'number') {
            quotePayload.quote_number = allocatedNumber;
          }
        } catch {
          // מכוון: שום דבר לא צריך לקרות כאן - ר' ההסבר למעלה.
        }

        let { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{ ...quotePayload, ...attnFields }]).select();
        if (quoteError && isMissingAttnColumnError(quoteError)) {
          ({ data: quoteData, error: quoteError } = await supabase.from('quotes').insert([quotePayload]).select());
        }
        if (quoteError) throw quoteError;
        quoteId = quoteData[0].id;
      }

      if (itemsForPersist) {
        // TEKANGO AUTHENTICATED UI RELEASE task: the Professional Quotes
        // persistence layer (quote_sections table, and quote_items'
        // pricing_unit/calculated_quantity/quantity_source/specification/
        // section_id/calculation_method columns, and the quote_item_measurements
        // table) depends on three Supabase migrations that are TEST-only and
        // explicitly not applied to Production in this release. The
        // Professional-item authoring UI (AddItemWizard, measurement/
        // specification editing, section management) ships and renders
        // exactly as approved in TEST - this is a persistence-boundary
        // exclusion only, not a UI change: total_price still reflects
        // whatever active quantity the item actually has (getActiveQuantity
        // falls back to plain `quantity` for a non-Professional item, so
        // this is byte-identical to the prior INSERT for every item that
        // doesn't use a Professional pricing unit).
        const quoteItemsToInsert = itemsForPersist.map((item) => ({
          quote_id: quoteId,
          description: item.description,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          total_price: getActiveQuantity(item) * Number(item.unit_price || 0),
        }));

        const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsToInsert);
        if (itemsError) throw itemsError;
      }

      for (let file of quoteFiles) {
        if (!file.id) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${quoteId}_${Date.now()}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;
          const { error: uploadErr } = await supabase.storage.from('quote-files').upload(filePath, file);
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('quote-files').getPublicUrl(filePath);
            await supabase.from('quote_attachments').insert([{
              quote_id: quoteId,
              file_name: file.name,
              file_url: publicUrl,
              file_size: file.size,
              storage_path: filePath
            }]);
          }
        }
      }

      setStatusMsg({
        // חוק ברזל (Quote Number Mobile/Surface Consistency, סבב זה):
        // slice(0,6) גולמי הוחלף ב-formatQuoteFallback הקנוני (8 תווים,
        // ומספר אמיתי אוטומטית אחרי migration) - editingOriginalQuote כבר
        // קיים בהיקף (נשלף למעלה), ו-quote_number אינו משתנה בעריכה
        // (immutability trigger), כך שהוא עדיין מייצג את ההצעה הנוכחית.
        text: editingQuoteId
          ? (isHebrew ? `הצעת מחיר ${formatQuoteFallback(editingOriginalQuote || { id: editingQuoteId })} עודכנה בהצלחה!` : `Quote ${formatQuoteFallback(editingOriginalQuote || { id: editingQuoteId })} successfully updated!`)
          // מציגים את הסכום שבאמת נשמר (newQuoteFinancials.total) ולא את
          // totalAmount המחושב בגוף הקומפוננטה - עבור הצעה מקומית פרטית חדשה
          // הם אינם זהים (totalAmount עדיין מניח "נטו + מע"מ מעליו").
          : (isHebrew ? `הצעת המחיר הופקה ונשמרה בענן בהצלחה! סה"כ: ${sym}${formatNum(newQuoteFinancials.total)}` : `Quote successfully created and saved to cloud! Total: ${sym}${formatNum(newQuoteFinancials.total)}`),
        type: 'success'
      });
      
      setEditingQuoteId(null);
      setIsCreatingQuote(false);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientType('');
      setClientTaxId('');
      setClientAddress('');
      setQuoteSubject('');
    setAttnName('');
    setAttnRole('');
      setValidUntil('');
      setDiscount('');
      setTerms(defaultTerms);
      setWarranty(defaultWarranty);
      setNotes('');
      setQuoteFiles([]);
      setCurrency(isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
      setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
      setSections([]);
      setProjectName('');
      loadData(session.user.id, session.user.email);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setAlertModalMsg((isHebrew ? 'שגיאה בשמירת ההצעה: ' : 'Error saving quote: ') + err.message);
    }
  }

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = (quote.clients?.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          quote.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || (quote.status || 'draft').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    let aVal, bVal;
    if (quoteSortField === 'id') {
      // חוק ברזל (Quote History Final Polish task, Order Number Sorting Fix
      // - שורש הבעיה שהבעלים דיווח עליו): מספר-ההזמנה המוצג ללקוח
      // (formatQuoteFallback, למשל "A100713") נגזר מ-quote.quote_number
      // (מספר שלם אמיתי) - אבל המיון כאן השווה בטעות את a.id/b.id, ה-UUID
      // הפנימי של השורה, שאין לו שום קשר לרצף המוצג. בפועל זה מיין
      // לקסיקוגרפית לפי UUID אקראי, לא לפי הרצף שהמשתמש רואה בכלל. התיקון
      // (ר' getQuoteOrderSortKey ב-utils/quoteNumber.js לפירוט המלא/לבדיקות
      // הממוקדות) עטוף בפונקציה טהורה נפרדת וניתנת-לבדיקה במקום לוגיקה
      // מוטבעת כאן, כדי לא לשכתב את מנגנון-המיון הכללי (aVal/bVal + עלייה/
      // ירידה הגנרית למטה) - רק מפתח-המיון של השדה הזה עצמו השתנה.
      aVal = getQuoteOrderSortKey(a);
      bVal = getQuoteOrderSortKey(b);
    } else if (quoteSortField === 'client') {
      aVal = a.clients?.company_name || '';
      bVal = b.clients?.company_name || '';
    } else if (quoteSortField === 'clientType') {
      // Item 26 Owner QA Micro-Fix: sort by the raw clients.client_type
      // source-of-truth value ('business'/'private') only - never by icon,
      // tooltip, or translated display text, so ordering stays identical
      // and deterministic across HE and EN.
      aVal = a.clients?.client_type || '';
      bVal = b.clients?.client_type || '';
    } else if (quoteSortField === 'total') {
      aVal = Number(a.total || 0);
      bVal = Number(b.total || 0);
    } else if (quoteSortField === 'status') {
      aVal = a.status || '';
      bVal = b.status || '';
    } else if (quoteSortField === 'views') {
      aVal = Number(a.view_count || 0);
      bVal = Number(b.view_count || 0);
    } else {
      aVal = a.created_at || '';
      bVal = b.created_at || '';
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return quoteSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return quoteSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredClients = clients.filter(client => {
    const term = clientSearchTerm.toLowerCase();
    return (client.company_name && client.company_name.toLowerCase().includes(term)) ||
           (client.email && client.email.toLowerCase().includes(term)) ||
           (client.tax_id && client.tax_id.toLowerCase().includes(term));
  }).sort((a, b) => compareClients(a, b, { field: clientSortField, direction: clientSortDirection, isHebrew }));

  const filteredAdminAccounts = allAccounts.filter(acc => {
    const term = adminSearchTerm.toLowerCase();
    return (acc.email && acc.email.toLowerCase().includes(term)) || 
           (acc.business_name && acc.business_name.toLowerCase().includes(term));
  }).sort((a, b) => {
    const nowMs = Date.now();
    const isOnlineA = a.last_sign_in ? (nowMs - new Date(a.last_sign_in).getTime() < 10 * 60 * 1000) : false;
    const isOnlineB = b.last_sign_in ? (nowMs - new Date(b.last_sign_in).getTime() < 10 * 60 * 1000) : false;

    if (sortField === 'default_online') {
      if (isOnlineA && !isOnlineB) return -1;
      if (!isOnlineA && isOnlineB) return 1;

      const timeA = a.last_sign_in ? new Date(a.last_sign_in).getTime() : 0;
      const timeB = b.last_sign_in ? new Date(b.last_sign_in).getTime() : 0;
      return timeB - timeA;
    }

    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    if (sortField === 'last_sign_in' || sortField === 'trial_ends_at') {
      const timeA = aVal ? new Date(aVal).getTime() : 0;
      const timeB = bVal ? new Date(bVal).getTime() : 0;
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
    }

    if (sortField === 'trial_ends_at_status') {
      const statusA = (a.trial_ends_at === null || a.trial_ends_at === undefined) ? '1' : '0';
      const statusB = (b.trial_ends_at === null || b.trial_ends_at === undefined) ? '1' : '0';
      return sortDirection === 'asc' ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
    }

    if (sortField === 'country') {
      const aValStr = a.country || 'Local';
      const bValStr = b.country || 'Local';
      return sortDirection === 'asc' ? aValStr.localeCompare(bValStr) : bValStr.localeCompare(aValStr);
    }

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (isInitializing || isPasswordRecoveryMode || !session) {
    return (
      <AuthScreen
        bundleIsHebrew={bundleIsHebrew}
        isInitializing={isInitializing}
        isPasswordRecoveryMode={isPasswordRecoveryMode}
        newPasswordInput={newPasswordInput}
        setNewPasswordInput={setNewPasswordInput}
        handleUpdatePasswordFromRecovery={handleUpdatePasswordFromRecovery}
        recoveryUpdateLoading={recoveryUpdateLoading}
        recoveryUpdateMsg={recoveryUpdateMsg}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        authSuccess={authSuccess}
        authError={authError}
        handleAuth={handleAuth}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        forgotOpen={forgotOpen}
        setForgotOpen={setForgotOpen}
        resetMsg={resetMsg}
        handleResetSubmit={handleResetSubmit}
        resetEmail={resetEmail}
        setResetEmail={setResetEmail}
        resetLoading={resetLoading}
      />
    );
  }

  // חוק ברזל: מסך זה חוסם את הדשבורד המלא רק ברגע החד-פעמי שבו מתגלה
  // חשבון חדש לגמרי שעבורו geo טרי מהשרת נכשל - הוא לא יופיע לחשבון קיים
  // (ה-if הזה כלל לא נבדק אחרי שנוצרה שורת business_settings), לא בכל
  // כניסה רגילה, ולא בעמודי נחיתה/הצעות ציבוריות (הרכיב הזה קיים רק בתוך
  // Dashboard.jsx המאומת). שפת הטקסט/כיוון כאן היא תצוגה בלבד (isHebrew) -
  // הערך שנשמר בפועל נקבע אך ורק ע"י הכפתור שנלחץ (ר' handleRegionChoiceSelect).
  if (needsRegionChoice) {
    return (
      <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: isHebrew ? FONT_HE : FONT_EN, background: NEON.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center', boxShadow: '0 20px 40px -12px rgba(139,92,246,0.25)' }}>
          <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'center' }}>
            <ProFlowLogo size={36} rtl={isHebrew} />
          </div>
          <h2 style={{ marginBottom: '10px', fontWeight: '800', ...neonGlowTextStyle }}>
            {isHebrew ? 'באיזה אזור פועל העסק שלך?' : 'Where is your business located?'}
          </h2>
          <p style={{ color: NEON.textSecondary, fontSize: '0.85rem', marginBottom: '16px' }}>
            {isHebrew
              ? 'לא הצלחנו לזהות זאת אוטומטית - זה קובע שפה, מטבע ומע"מ עבור החשבון שלך.'
              : "We couldn't detect this automatically - it determines your account's language, currency and VAT."}
          </p>
          {regionChoiceError && (
            <p style={{ color: NEON.red, fontSize: '0.85rem', marginBottom: '16px' }}>
              {regionChoiceError}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => handleRegionChoiceSelect('Local')}
              disabled={isCreatingBusinessSettings}
              style={{ padding: '12px', borderRadius: '8px', border: 'none', background: NEON.gradient, color: 'white', fontWeight: '700', fontSize: '0.95rem', cursor: isCreatingBusinessSettings ? 'default' : 'pointer', opacity: isCreatingBusinessSettings ? 0.6 : 1 }}
            >
              {isHebrew ? 'ישראל' : 'Israel'}
            </button>
            <button
              onClick={() => handleRegionChoiceSelect('International')}
              disabled={isCreatingBusinessSettings}
              style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${NEON.borderStrong}`, background: 'transparent', color: NEON.textPrimary, fontWeight: '700', fontSize: '0.95rem', cursor: isCreatingBusinessSettings ? 'default' : 'pointer', opacity: isCreatingBusinessSettings ? 0.6 : 1 }}
            >
              {isHebrew ? 'בינלאומי' : 'International'}
            </button>
          </div>
          {isCreatingBusinessSettings && (
            <p style={{ color: NEON.textSecondary, fontSize: '0.8rem', marginTop: '14px' }}>
              {isHebrew ? 'יוצר את החשבון...' : 'Creating your account...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  const hotQuotesList = quotes.filter(q => (q.view_count || 0) >= 3 && q.status !== 'approved' && q.status !== 'paid');
  const currentHotQuote = hotQuotesList.length > 0 ? hotQuotesList[hotQuoteIndex % hotQuotesList.length] : null;
  const currentHotClientName = currentHotQuote?.clients?.company_name || 'Client';
  const currentHotViewCount = Number(currentHotQuote?.view_count || 0);
  // חוק ברזל (Authenticated UI Coherence task, Dashboard Header Compression,
  // Hot Quote View Affordance): אותה נוסחת-קישור-ציבורי-לפי-מטבע בדיוק כמו
  // getQuoteViewLink הקיים כבר ב-QuotesTab.jsx (משוכפלת מקומית, לא
  // מיוצאת/משותפת - אותו עיקרון קיים בפרויקט הזה) - "an existing safe
  // behavior," לא כלל-ניתוב חדש שהומצא כאן.
  const getHotQuoteViewLink = (quote) => {
    const isLocalQuote = Number(quote?.tax_rate) > 0 || (quote?.currency || '').toUpperCase() === 'ILS';
    return isLocalQuote
      ? `${window.location.origin}/public-quote/${quote.id}`
      : `${window.location.origin}/en/public-quote/${quote.id}?lang=en`;
  };

  return (
    <div className="dash-app-shell" dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: isHebrew ? FONT_HE : FONT_EN, background: NEON.bg, color: NEON.textPrimary, minHeight: '100vh', display: 'flex', flexDirection: 'column', letterSpacing: '-0.01em', overflowX: 'hidden' }}>

      <style>{`
        @keyframes popupBounce {
          0% { transform: scale(0.6) translateY(8px); opacity: 0; }
          70% { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes trialSlideInRTL {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes trialSlideOutRTL {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(110%); opacity: 0; }
        }
        @keyframes trialSlideInLTR {
          from { transform: translateX(-110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes trialSlideOutLTR {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-110%); opacity: 0; }
        }
        @keyframes trialSlideCenterRTL {
          0%   { left: 160%; }
          16%  { left: 50%; }
          85%  { left: 50%; }
          100% { left: -60%; }
        }
        @keyframes trialSlideCenterLTR {
          0%   { left: -60%; }
          16%  { left: 50%; }
          85%  { left: 50%; }
          100% { left: 160%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dash-trial-slidebar { animation: none !important; }
          .dash-trial-ticker-lane { display: flex !important; justify-content: center !important; align-items: center !important; }
          .dash-trial-ticker-text {
            animation: none !important;
            position: static !important;
            transform: none !important;
          }
        }
        .feature-lock-tooltip {
          animation: popupBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .mobile-bottom-nav {
          display: none !important;
        }
        .dash-trial-compact {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
        }
        /* חוק ברזל (Authenticated UI Coherence task, Desktop Header
           Position Correction): רשת-3-עמודות סימטרית לדסקטופ - עמודות-
           הקצה השוות (1fr) מבטיחות שעמודת-האמצע (auto, הסטטיסטיקות)
           תמיד ממורכזת ביחס לרוחב-השורה כולו. justify-self:start על
           הכותרת ו-justify-self:end על שני עטיפות-הבאדג' קובעים מיקום-
           קצה מדויק בתוך העמודה שלהם - direction (יורש מהאב, rtl/ltr)
           קובע אוטומטית איזו עמודה פיזית היא "start"/"end", בלי תנאי
           isHebrew. */
        .dash-header-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
        }
        .dash-header-row > .dash-header-title {
          justify-self: start;
        }
        .dash-header-row > .dash-header-stats {
          justify-self: center;
        }
        .dash-header-row > .dash-header-badge-desktop,
        .dash-header-row > .dash-header-badge-mobile {
          justify-self: end;
        }
        /* חוק ברזל (Authenticated UI Coherence task, Mobile Dashboard
           Header Recomposition, Owner mid-task correction): מובייל חוזר
           ל-flex+order (הרשת-3-העמודות היא אך ורק לדסקטופ) - כרטיס-סיכום
           מובייל בעל 3 שורות מכוונות: שורה 1 = כותרת+באדג'-קומפקטי (יחד,
           ממורכזים אנכית, order 1/2); שורה 2 = dash-header-stats (order 3,
           flex-basis:100% - "שבירה נקייה" לשורה נפרדת); שורה 3 = Hot
           Quote (מותנה, יליד נפרד אחרי השורה הזו ב-JSX). breakpoint אחיד
           (768px) - זהה בדיוק ל-.mobile-bottom-nav/.dash-topbar הקיימים
           כבר, כדי שכל רכיבי-המובייל יתחלפו יחד באותו רוחב. */
        @media (max-width: 768px) {
          .dash-header-row {
            display: flex;
            flex-wrap: wrap;
          }
          .dash-header-badge-desktop {
            display: none !important;
          }
          .dash-header-badge-mobile {
            display: flex !important;
            order: 2;
            justify-self: auto;
          }
          .dash-header-title {
            order: 1;
            flex: 1 1 auto;
          }
          .dash-header-stats {
            order: 3;
            flex-basis: 100%;
            justify-content: flex-start;
            justify-self: auto;
            margin-top: 6px;
          }
        }
        .dash-neon-btn {
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .dash-neon-btn:hover {
          filter: brightness(1.08);
        }
        .dash-tab-btn {
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        {/* V2 Visual Completion Pass: the .dash-header-bar/.dash-header-logo-wrap/
            .dash-header-actions/.dash-header-profile/.dash-header-plan-badge-center/
            .dash-header-plan-badge-mobile-row/.dash-email-text/.dash-admin-badge-text
            rules that used to live here were dead CSS (UI-specialist-flagged) -
            the purple header-bar those classNames styled was already removed
            from the JSX in the Phase 1 sidebar/topbar pass; nothing in the
            current tree still uses those selectors (confirmed by a fresh grep
            before deleting). .dash-admin-logs-text is the one still-live
            selector from that old block (used by dash-topbar's AI Support Logs
            button) - its rule is preserved on its own below. */}
        @media (max-width: 640px) {
          .dash-admin-logs-text {
            display: none;
          }
        }
        /* חוק ברזל (תיקון בעלים מאושר - צפיפות מובייל): שינויים מתחת
           נכנסים אך ורק מתחת ל-768px - הדסקטופ נשאר בדיוק כפי שהיה, בלי
           שום שינוי לרוחב/ריווח/עוצמת הצפיפות שלו. כרטיסי ה-KPI/הצעה חמה
           מוקטנים כאן כ-30% (padding/gap/גודל אייקון/גודל טקסט הערך) -
           הערכים והתוויות עצמם נשארים קריאים ולא משתנים בחישוב. */
        @media (max-width: 768px) {
          /* חוק ברזל (תיקון בעלים - רוחב אפליקציה מאומתת במובייל): ה-
             padding הקבוע 10px של מעטפת התוכן הראשית (.dash-main-content)
             היה זהה בדסקטופ ובמובייל - במדידה חיה ב-390px נתן רוחב תוכן
             370px (94.9%), מחוץ ליעד הבעלים 4-8px לצד (376-382px רוחב
             תוכן). הוקטן כאן ל-6px רק מתחת ל-768px, בלי לגעת בערך
             הדסקטופ המקורי (10px, לא במדיה query זו). */
          .dash-main-content {
            padding: 6px !important;
          }
          .dash-kpi-grid {
            gap: 8px !important;
            margin-bottom: 10px !important;
            /* חוק ברזל (תיקון בעלים - העברה 2): grid-template-columns של
               הדסקטופ (repeat(auto-fit, minmax(200px, 1fr))) קרס לעמודה
               בודדת במובייל כי הרוחב הזמין (~370px) לא מספיק לשתי עמודות
               של 200px+gap. כפיית 2 עמודות שוות כאן פותרת זאת - "הצעה
               חמה" נשאר ברוחב מלא (span שתי העמודות) ע"י dash-kpi-hot
               למטה, בעוד סה"כ הצעות/הכנסות חולקות את השורה השנייה. */
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .dash-kpi-hot {
            grid-column: 1 / -1 !important;
          }
          .dash-kpi-card {
            padding: 10px !important;
            gap: 8px !important;
            border-radius: 10px !important;
          }
          .dash-kpi-icon {
            width: 32px !important;
            height: 32px !important;
          }
          .dash-kpi-icon svg {
            width: 15px !important;
            height: 15px !important;
          }
          .dash-kpi-value {
            font-size: 1.15rem !important;
          }
          .dash-kpi-label {
            font-size: 0.65rem !important;
          }
          .dash-kpi-sub {
            font-size: 0.75rem !important;
          }
          /* חוק ברזל (Option B - Dashboard Section Boundary task, מובייל):
             אותו עיקרון-צפיפות כמו יתר הכרטיסים מתחת ל-768px - padding
             מוקטן, לא מבנה שונה. הגבול עצמו (border/radius/background)
             לא נגוע - זהה בכל רוחב, רק המרווח הפנימי מצטמצם. */
          .dash-upper-section {
            padding: 8px !important;
          }
          /* מרווח תחתון מספיק כדי שהתוכן האחרון בכל טאב (כולל שורת ההצעה
             האחרונה בהיסטוריה) יוכל לגלול לגמרי מעל אזור כפתור צאט ה-AI
             הצף וניווט התחתון הקבועים - בלי זה, תוכן בתחתית העמוד יכול
             להישאר "תקוע" מאחורי הכפתור הצף לצמיתות. גובה מדוד בפועל:
             ניווט תחתון ~58px + כפתור AI Chat יושב כ-85px מהתחתית - 100px
             נוסף מבטיח מרווח בטוח. */
          .dash-footer {
            padding-bottom: 100px !important;
          }
          /* חוק ברזל (תיקון בעלים - העברה 2): הודעת "תקופת ניסיון" נמדדה
             בפועל בגובה 67px עם flex-wrap ל-2 שורות ב-390px, כי הטקסט
             המלא ארוך מדי לרוחב הזמין. nowrap + טקסט מקוצר ייעודי
             (dash-trial-compact) במקום הטקסט המלא (dash-trial-full)
             מצמצם לשורה אחת קומפקטית בלי לאבד מידע חשוב. */
          .dash-trial-alert {
            flex-wrap: nowrap !important;
            padding: 6px 10px !important;
          }
          .dash-trial-full {
            display: none !important;
          }
          .dash-trial-compact {
            display: inline !important;
          }
        }

        /* ProFlow V2 Phase 1 — shared shell: sidebar (desktop/tablet-landscape)
           + light topbar. Sidebar/topbar are new; every element they contain
           reuses pre-existing state/handlers only (see JSX above) - this
           block is pure presentation. Breakpoint (768px) intentionally
           matches .mobile-bottom-nav's own existing breakpoint above, so
           there is no width range where neither nav is visible. */
        /* OWNER CORRECTION (RTL/LTR Sidebar Position task, supersedes the
           "sidebar always physically LEFT in both languages" rule stated in
           every prior V2 round from the Visual Transformation Pass onward):
           that rule was introduced by mistake and is EXPLICITLY CORRECTED
           here, not merely revisited. The historical rounds that built and
           relied on it (documented in PROFLOW_PROJECT_CONTEXT.md/HANDOFF.md)
           are preserved as an accurate record of what was implemented and
           why at the time - they are not deleted or rewritten - but the
           rule itself no longer governs. New canonical rule: Hebrew/RTL ->
           sidebar physically RIGHT, workspace physically LEFT of it;
           English/LTR -> sidebar physically LEFT, workspace physically
           RIGHT of it (i.e. the sidebar now sits at the natural inline-start
           edge of each language, matching ordinary RTL/LTR product
           convention, rather than being pinned to one physical side
           regardless of language). Mechanism: this container's own
           direction now tracks the real page language instead of being
           permanently forced to ltr - since the sidebar (<aside>) is still
           the first DOM child before .dash-shell-main, a flex row's first
           child sits at the container's own inline-start, which is now
           correctly the physical right under Hebrew's dir:rtl and the
           physical left under English's dir:ltr. No language-specific
           duplicate markup/pages were introduced - this is the same single
           JSX tree for both languages, mirrored automatically by dir, per
           the project's own established directional-mirroring convention
           used everywhere else in this file. */
        .dash-shell-body {
          display: flex;
          flex-direction: row;
          direction: ${isHebrew ? 'rtl' : 'ltr'};
          flex: 1 1 auto;
          min-height: 0;
        }
        /* V2 Dark Sidebar (Owner-approved direction, this round): the light/
           white sidebar from the immediately-prior round is superseded -
           the Owner confirmed the dark-navy concept discussed earlier in
           this V2 effort is the actual target. Colors only vs. the
           immediately-prior structure. */
        /* Internal content direction (UNCHANGED by the physical-position
           correction above): the sidebar's own direction has always tracked
           isHebrew independently of its physical placement, and still does
           - Hebrew sidebar content is genuinely RTL (right-aligned text,
           icon right-of-label), English content is genuinely LTR. What
           changed is only WHERE the sidebar physically sits (see
           .dash-shell-body above), never how its own content reads.
           border-inline-end below (changed from a hardcoded border-right)
           is now a logical property so it resolves to the correct physical
           edge automatically as the sidebar's own side changes with
           language: right-edge border when the sidebar direction is ltr
           (English, sidebar physically left, content area to its right),
           left-edge border when rtl (Hebrew, sidebar physically right,
           content area to its left) - a hardcoded border-right would have
           put the seam on the wrong edge for Hebrew after this correction. */
        .dash-sidebar {
          direction: ${isHebrew ? 'rtl' : 'ltr'};
          width: 232px;
          flex-shrink: 0;
          background: ${SHELL.sidebarBg};
          border-inline-end: 1px solid ${SHELL.sidebarBorder};
          display: flex;
          flex-direction: column;
          padding: 20px 14px;
          box-sizing: border-box;
        }
        /* Sidebar Branding Hierarchy (Owner-authorized reversal): the
           business identity is the PRIMARY brand element at the top of the
           sidebar - "my business running on ProFlow", not "ProFlow, with my
           business name somewhere below." This is a deliberate, scoped
           exception to ProFlowLogo.jsx's own general "the platform brand in
           every header is always the uniform ProFlow logo, never a
           business-uploaded image" comment - that rule is about customer-
           facing/system chrome in general; the Owner has explicitly
           authorized business-logo-primary specifically for this
           authenticated sidebar, in writing.
           Desktop Header Removal task (further prominence increase): mark
           38px->52px, name 0.98rem->1.1rem, more breathing room (padding/
           gap increased), and a border-bottom separator - all deliberately
           modest (not doubled/tripled) to stay "balanced" and not consume
           excessive sidebar height, per the Owner's own explicit constraint.
           Long names now wrap up to 2 lines (-webkit-line-clamp) instead of
           a hard single-line ellipsis, so a genuinely long business name
           degrades gracefully without breaking the sidebar's own layout -
           still safely bounded (clamped, not unbounded growth).
           Final Dashboard/Sidebar Polish task, §A (logo-first refinement):
           when a valid logo exists, this block now renders ONLY the light-
           canvas logo image (see .dash-sidebar-brand-logo-canvas below) -
           the owner already knows their own business name, so repeating it
           in text beside a real uploaded logo was redundant. The mark+name
           fallback (unchanged) still renders exactly as before whenever
           there is no logo, the URL is empty, or the image genuinely fails
           to load (onError-driven, not a guess - see sidebarLogoFailed
           state above the component's return statement). align-items/gap
           below still work correctly for both the single-child (logo) and
           two-child (mark+name) cases without any conditional CSS. */
        .dash-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 2px 6px 16px;
          margin-bottom: 10px;
          border-bottom: 1px solid ${SHELL.sidebarBorder};
        }
        .dash-sidebar-brand-mark {
          width: 52px;
          height: 52px;
          border-radius: ${RADIUS.md};
          background: ${NEON.gradient};
          color: #ffffff;
          font-weight: 800;
          font-size: 1.3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        /* Final Dashboard/Sidebar Polish task, §A (valid-logo case): when a
           real business logo exists and loads, it is now the ONLY identity
           element shown (no repeated bizName text beside/beneath it, per
           the Owner's explicit instruction) - so it needs real presence, a
           light neutral canvas so a black/dark-transparent logo doesn't
           disappear against the dark sidebar (the exact failure mode a
           plain img on ${SHELL.sidebarBg} would have), and object-fit:
           contain (never cover/crop) so the uploaded file's own aspect
           ratio is always fully preserved - square/wide/tall logos all
           fit safely without stretching or cropping.
           Authenticated UI Coherence task, §Business Logo: stage enlarged
           further (76px->92px height, 10px->7px padding) so the logo uses
           nearly all available stage width, per the Owner's own explicit
           "larger, more intentional... nearly all available stage width"
           requirement - still bounded (a fixed maximum height, not
           unbounded growth) so no upload can break the sidebar's layout.
           Border opacity raised (0.14->0.55) so the required "subtle 1px
           white border" genuinely reads as a border against the dark
           sidebar backdrop, not just an invisible near-transparent line.
           Consolidated Open UI Corrections task, §E (real defect found +
           fixed): the canvas above was a FIXED-size box (width:100%,
           height:92px) with the image centered inside via object-fit:
           contain - correct for preventing crop/stretch, but for any logo
           whose own aspect ratio doesn't happen to match the box's own
           (e.g. a compact/near-square mark, or a wide-but-short lockup),
           this left large areas of the box's own white background fill
           visible around a comparatively small rendered image - exactly
           the Owner's own "small logo inside a large solid-white card"
           finding, not a false complaint. Fixed by making the canvas
           SHRINK-WRAP to the image's own actual rendered size (bounded by
           max-width/max-height, not a fixed width/height) - width:100%
           replaced with max-width:100% + margin:0 auto (auto-margin
           centering is a standard, reliable flex-item technique - .dash-
           sidebar-brand is already display:flex, so the canvas centers
           within its row's available space with zero free height/width
           remaining once it shrinks to content); height:92px replaced
           with max-height. The net effect: a genuinely wide/lockup-style
           logo still uses nearly all available width (unchanged from
           before, since a wide image's OWN natural size already approaches
           the max-width bound); a compact/near-square logo now renders in
           a correspondingly compact frame - the white area always hugs
           the actual image, never balloons into an oversized card around
           it. Border changed from white (which was only ever visible
           against the dark sidebar, and became largely redundant once the
           box tightly hugs the image) to a subtle dark tint
           (rgba(0,0,0,0.10)) so it reads as a genuine frame against the
           white padding fill itself, exactly the Owner's "border must
           visually read as a border, not as a white background panel"
           requirement - the box-shadow (unchanged) still provides
           separation from the dark sidebar. Padding reduced 7px->5px, per
           the Owner's own explicit "approximately 4-6px" spec. The
           whitespace-trim mechanism (trimmedLogoSrc/logoTrim.js) is
           completely unaffected by this change - it operates on the image
           source before this CSS ever sees it, and continues to be used
           exactly as before (see the img src below).
           Whitespace investigation finding (recorded, not guessed): the
           visible empty space around a real uploaded logo can come from
           either (a) this canvas's own CSS padding (now minimal, 7px) or
           (b) transparent pixels baked into the uploaded PNG/SVG file
           itself, which no CSS change can ever remove - only pixel-level
           inspection of the actual file can distinguish these. Since no
           TEST account available to this task has an uploaded logo with
           baked-in whitespace to inspect empirically, a conservative,
           non-destructive, fail-safe automatic trim was implemented
           instead of guessing: trimmedLogoSrc (state above, computed by
           computeTransparentTrimBounds in utils/logoTrim.js) reads the
           real uploaded image via an offscreen <canvas>, finds the
           bounding box of only genuinely transparent (alpha===0) border
           pixels - never "white" pixels, so a logo with an intentional
           white background is never miscropped - and renders a cropped
           data URL in place of the raw file for the sidebar's own display
           only. The original bizLogoUrl/stored file is never read-modified
           or re-uploaded; any failure (CORS-tainted canvas, unsupported
           format, no transparency to trim) silently falls back to the
           exact prior raw-image behavior via trimmedLogoSrc staying null -
           see the useEffect above the component's return statement. */
        .dash-sidebar-brand-logo-canvas {
          max-width: 100%;
          max-height: 92px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: ${RADIUS.md};
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: 0 2px 8px -2px rgba(0,0,0,0.35);
          padding: 5px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .dash-sidebar-brand-logo-img {
          max-width: 100%;
          max-height: 82px;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
        }
        .dash-sidebar-brand-name {
          min-width: 0;
          flex: 1 1 auto;
          color: ${SHELL.sidebarTextActive};
          font-size: 1.1rem;
          font-weight: 800;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
          text-align: ${isHebrew ? 'right' : 'left'};
        }
        /* Brand lockup exception, deliberate: the ProFlow icon-mark +
           wordmark is a logotype (Latin-script brand text), not
           translatable UI copy - conventional RTL products (Hebrew Gmail/
           Slack/Facebook) keep a brand lockup's own internal orientation
           fixed regardless of interface language, the same way this
           project's own ProFlowLogo component already always renders "Pro"
           + "Flow" left-to-right. Only the ProFlowLogo element itself is
           exempted this way (it self-manages via its own hardcoded internal
           dir="ltr" span, confirmed from its own source); the "Powered by"
           label is real translatable UI copy and follows the sidebar's own
           per-language direction like every other row.
           Desktop Header Removal task (Owner correction - relocation, not a
           new decision): this lockup moves from directly beneath the
           business-brand block (top) to the very bottom of the sidebar,
           after the user/plan identity footer, as the final quiet platform
           signature - see the JSX further below where it now renders inside
           .dash-sidebar-footer, last. Centered (was start-aligned) since it
           now terminates the whole sidebar as a signature line rather than
           sitting inside a left-to-right-reading block; a border-top
           separator (was margin-bottom spacing before the nav) marks it as
           its own distinct zone, matching the border-bottom now used on the
           business-brand block above - still deliberately quiet, never
           competing with the business name.
           Final Dashboard/Sidebar Polish task, §F: opacity nudged 0.55->
           0.72 - the Owner's own words were "it must remain quiet and
           secondary, but it must be readable... increase contrast only
           enough to meet that requirement," so this is a small, deliberate
           bump, not a redesign of the lockup's treatment. */
        .dash-sidebar-platform-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 6px 0;
          margin-top: 10px;
          border-top: 1px solid ${SHELL.sidebarBorder};
          opacity: 0.72;
        }
        .dash-sidebar-platform-brand-label {
          font-size: 0.62rem;
          font-weight: 600;
          color: ${SHELL.sidebarTextMuted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        /* Desktop Header Removal task, §E/§G: new sidebar utility zone -
           AI Chat action (all users) + relocated Super Admin "AI Support
           Logs" action - sits after primary navigation, before the user/
           plan/footer identity region, per the Owner's own explicit
           ordering. Deliberately reuses .dash-sidebar-btn's own quiet nav
           language (not the strong-gradient CTA style) so it reads as a
           secondary action, never competing with "New Quote" above it. */
        .dash-sidebar-utility {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding-top: 10px;
          margin-top: 8px;
          border-top: 1px solid ${SHELL.sidebarBorder};
        }
        .dash-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1 1 auto;
          overflow-y: auto;
        }
        .dash-sidebar-cta {
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${NEON.gradient};
          color: #ffffff;
          border: none;
          border-radius: ${RADIUS.sm};
          padding: 11px 14px;
          font-weight: 800;
          font-size: 0.86rem;
          cursor: pointer;
          box-shadow: ${NEON.glow};
          margin-bottom: 14px;
          font-family: inherit;
        }
        .dash-sidebar-btn {
          display: flex;
          align-items: center;
          gap: 11px;
          background: transparent;
          color: ${SHELL.sidebarText};
          border: none;
          border-inline-start: 3px solid transparent;
          border-radius: ${RADIUS.sm};
          padding: 9px 12px;
          font-weight: 600;
          font-size: 0.86rem;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
          font-family: inherit;
        }
        .dash-sidebar-btn:hover {
          background: ${SHELL.sidebarItemHoverBg};
          color: ${SHELL.sidebarTextActive};
        }
        /* Restrained active state - a subtle purple tint + a thin accent
           edge, not a solid-purple block (Owner explicit: "avoid making
           every nav item a large solid-purple button"; the CTA above
           remains the one deliberately strong-purple element). */
        .dash-sidebar-btn-active {
          background: rgba(139,92,246,0.16);
          border-inline-start: 3px solid #a78bfa;
          color: #c4b5fd;
          font-weight: 700;
        }
        .dash-sidebar-btn-active:hover {
          background: rgba(139,92,246,0.22);
        }
        .dash-sidebar-btn-ghost {
          opacity: 0.85;
          font-size: 0.78rem;
        }
        /* Final Dashboard/Sidebar Polish task, §B: restrained purple/pink
           accent - more visible than a plain .dash-sidebar-btn row (a
           subtle gradient wash + a matching 1px border), but deliberately
           NOT another solid-fill button like .dash-sidebar-cta ("New
           Quote") - that CTA must stay the one visually strongest action.
           font-weight bumped 600->700 for a touch more presence, matching
           the slightly stronger visual weight without changing size/scale
           relative to the other nav icons (still 17px, same stroke width). */
        .dash-sidebar-btn-ai {
          background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(236,72,153,0.10));
          border: 1px solid rgba(167,139,250,0.30);
          color: #d8b4fe;
          font-weight: 700;
        }
        .dash-sidebar-btn-ai:hover {
          background: linear-gradient(135deg, rgba(167,139,250,0.22), rgba(236,72,153,0.16));
          border-color: rgba(167,139,250,0.45);
          color: #e9d5ff;
        }
        .dash-sidebar-btn-ai:focus-visible {
          outline: 2px solid #c4b5fd;
          outline-offset: 1px;
        }
        .dash-sidebar-footer {
          border-top: 1px solid ${SHELL.sidebarBorder};
          padding-top: 12px;
          margin-top: 10px;
        }
        .dash-sidebar-admin-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255,255,255,0.08);
          color: ${SHELL.sidebarText};
          font-size: 0.62rem;
          font-weight: 800;
          padding: 3px 7px;
          border-radius: 4px;
          margin-bottom: 8px;
          border: 1px solid ${SHELL.sidebarBorder};
        }
        .dash-sidebar-user {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dash-sidebar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${NEON.gradient};
          color: #ffffff;
          font-weight: 800;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dash-sidebar-user-text {
          min-width: 0;
          flex: 1 1 auto;
        }
        .dash-sidebar-user-name {
          color: ${SHELL.sidebarTextActive};
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: ${isHebrew ? 'right' : 'left'};
        }
        .dash-sidebar-signout {
          background: none;
          border: none;
          color: ${SHELL.sidebarTextMuted};
          cursor: pointer;
          flex-shrink: 0;
          padding: 5px;
          border-radius: ${RADIUS.sm};
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dash-sidebar-signout:hover {
          background: ${SHELL.sidebarItemHoverBg};
          color: ${SHELL.sidebarTextActive};
        }
        /* Task G (Owner-authorized, Mobile Sign Out): mobile counterpart of
           the desktop .dash-sidebar-signout button above - same restrained
           destructive red language already used elsewhere in this file for
           the Hot Quote alert (rgba(220,38,38,...) background/border, see
           its own rule further below), same :focus-visible outline token
           (2px solid NEON.violet, 1px offset) already established by
           .dash-sidebar-btn-ai/.dash-topbar-ai-btn above - reused, not
           reinvented. */
        .dash-mobile-signout-btn:hover {
          background: rgba(220,38,38,0.12) !important;
        }
        .dash-mobile-signout-btn:focus-visible {
          outline: 2px solid ${NEON.violet};
          outline-offset: 1px;
        }

        .dash-shell-main {
          direction: ${isHebrew ? 'rtl' : 'ltr'};
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        /* Desktop Shell Height/Scroll Contract (Owner-approved): the sidebar
           must stay fully visible/fixed while only the main workspace
           scrolls - one intentional primary scroll area, not the whole
           page growing indefinitely as Quote History gains rows. Desktop-
           only (min-width:769px, the exact inverse of the sidebar's own
           existing ≤768px hide breakpoint below) - mobile is completely
           unaffected and keeps its current, already-tested, natural
           whole-page scroll (explicit Owner requirement: "do not force the
           desktop fixed-sidebar pattern onto phones"). min-height:0 on
           every flex link in the chain is required, not decorative - a
           flex item's default min-height:auto is exactly what silently
           breaks nested flex+overflow scrolling (the parent would grow to
           fit content instead of the child scrolling) if omitted. */
        @media (min-width: 769px) {
          .dash-app-shell {
            height: 100vh;
            overflow: hidden;
          }
          .dash-shell-outer {
            min-height: 0;
            height: 100%;
          }
          .dash-shell-body {
            min-height: 0;
          }
          .dash-sidebar {
            height: 100%;
          }
          .dash-shell-main {
            min-height: 0;
            height: 100%;
          }
          .dash-main-content {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
          }
          /* Proportional Workspace Correction (Owner real-visual-review
             correction, 2026-09-05): the immediately-prior "Desktop
             Workspace Width" round added two rules, both removed here -
             a .dash-shell-outer max-width:none!important (decoupling the
             shell from --pf-dashboard-shell-total-width entirely) and a
             separately max-width+margin:auto-centered .dash-content-
             container - specifically to make the workspace wider. The
             Owner's real-browser review found this both far too wide
             (~1240px vs. an intended ~15-20% over the true ~748px
             baseline) and, independently, reintroduced a blank gap between
             the sidebar and the workspace: decoupling the content from the
             shell's own bound meant the content centered itself in the
             leftover viewport space instead of staying attached to the
             sidebar as one contiguous shell - exactly the defect the
             variable's own Round-2 history (src/index.css) was created to
             prevent in the first place. Removing both overrides restores
             the single-source-of-truth design: the shell's own inline
             maxWidth (var(--pf-dashboard-shell-total-width), unchanged
             below) is once again the only thing bounding+centering
             sidebar+content together, now at that variable's new, smaller,
             Owner-corrected 1120px value (src/index.css) instead of at
             ~1240px with the shell bound removed - both wider than the
             pre-existing 980px baseline (as intended) and contiguous with
             the sidebar (as required), from one number instead of two
             competing wrappers. */
        }
        /* Cross-Surface Visual Consolidation (§9): the topbar is the seam
           between the dark sidebar and the light workspace - previously a
           flat white card with a plain grey border, reading as a separate,
           disconnected surface rather than part of one shell. A restrained
           gradient wash ties the two together without turning the topbar
           itself dark or purple-heavy. Restrained: ~6% tint fading to the
           existing white card color by the visual center, one thin colored
           shadow line instead of a flat grey border.
           OWNER CORRECTION (RTL/LTR Sidebar Position task): this gradient's
           direction was previously hardcoded left-to-right and deliberately
           NOT conditioned on isHebrew, because the sidebar itself used to
           be pinned physically left in both languages - that premise is now
           corrected (see .dash-shell-body above: the sidebar is physically
           RIGHT for Hebrew, LEFT for English), so the wash must now follow
           the sidebar's own new per-language physical side instead of
           always starting from the left, or it would visually wash away
           from the sidebar under Hebrew instead of adjacent to it. */
        .dash-topbar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 20px;
          background: linear-gradient(${isHebrew ? 'to left' : 'to right'}, rgba(124,58,237,0.06), ${NEON.bgCard} 60%);
          border-bottom: 1px solid ${NEON.border};
          box-shadow: 0 1px 0 rgba(124,58,237,0.05);
          flex-wrap: wrap;
        }
        .dash-topbar-identity {
          font-weight: 800;
          font-size: 1rem;
          color: ${NEON.textPrimary};
          min-width: 0;
        }
        .dash-topbar-bizname {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
          display: inline-block;
        }
        .dash-topbar-logo-img {
          max-height: 32px;
          max-width: 160px;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
        }
        .dash-topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dash-topbar-ghost-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: ${RADIUS.pill};
          border: 1px solid ${NEON.border};
          background: ${NEON.bgCardAlt};
          color: ${NEON.textSecondary};
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
        }
        /* Desktop Header Removal task, §G (status toast): was position:
           absolute, anchored to .dash-topbar's own position:relative box
           (bottom:-14px, tucked just under the topbar). Now that the
           topbar is hidden on desktop (see the desktop-only display:none
           rule below), that anchor no longer exists there - re-anchored as
           a viewport-fixed overlay instead (like the AI Chat widget/modals
           already are), so it keeps working identically on desktop and
           mobile regardless of the topbar's own visibility. top:16px keeps
           it near the top of the screen without permanently reserving a
           row. Renamed from .dash-topbar-toast since it is no longer
           topbar-scoped - role/aria-live/success-error styling/animation/
           dismissal timing all unchanged.
           Real defect found by the UI specialist's own arithmetic, fixed
           before this could be reported complete: centering on the raw
           viewport (left:50%) ignores that the sidebar occupies a real
           232px on one physical side on desktop - at desktop widths
           between the 769px floor and ~884px, a toast at its own 420px
           max-width would overlap the sidebar by up to ~57px whenever a
           message was long enough to hit that cap (the sidebar sits at
           x:0-232 in English, or at the mirrored right-hand 232px in
           Hebrew - a literal viewport-center does not know either exists).
           Fixed below (desktop-only) by re-centering on the WORKSPACE
           region specifically (viewport minus the 232px sidebar) instead
           of the raw viewport - shifted by half the sidebar's own width
           (116px) toward whichever side the workspace actually occupies,
           per the sidebar's own already-corrected per-language physical
           side. Mobile is unaffected (no sidebar exists there, so raw-
           viewport centering was already correct and remains the base
           rule below 769px). */
        .dash-status-toast {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          padding: 8px 18px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 8px 20px -6px rgba(0,0,0,0.35);
          max-width: min(calc(100% - 24px), 420px);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          animation: popupBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @media (min-width: 769px) {
          .dash-status-toast {
            left: calc(50% ${isHebrew ? '- 116px' : '+ 116px'});
          }
        }
        /* Desktop Header Removal task, §7 mount-scoping mechanism: hides
           only the AI Chat widget's own floating trigger button when it is
           nested inside .dash-ai-chat-mount specifically (the authenticated
           Dashboard's own mount, added further below) - NOT a global rule
           on .ai-support-btn itself, so Landing/Contact/every other public
           surface's own separate AIChatWidget mount is completely
           unaffected. The popup panel itself is untouched by this rule -
           only the always-visible closed-state trigger is hidden; opening
           it via the new sidebar action (which dispatches the existing
           open-proflow-ai-chat CustomEvent) still works normally since the
           widget itself, its listener, and its popup all remain mounted
           and functional - only its own default trigger button is hidden
           on any viewport. Authenticated UI Coherence task, Mobile
           Navigation - Owner correction: this rule was previously
           desktop-only (>=769px); the mobile floating launcher was found
           to visually obscure Quote History cards in real mobile testing
           and to read as an unclear/retro icon - it is now unconditionally
           hidden on the authenticated Dashboard at every viewport, mobile
           included. Mobile AI access moves to a new compact, stable
           .dash-topbar-ai-btn action in the mobile-visible topbar instead
           (see the JSX further below) - same open-proflow-ai-chat event,
           same AIChatWidget/popup, no second implementation. Landing/
           Contact/every other public surface's own separate AIChatWidget
           mount remains completely unaffected (this selector only ever
           matches inside .dash-ai-chat-mount, the authenticated
           Dashboard's own mount). */
        .dash-ai-chat-mount .ai-support-btn {
          display: none !important;
        }
        .dash-topbar-ai-btn {
          display: none;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px;
          background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(236,72,153,0.10));
          border: 1px solid rgba(139,92,246,0.30);
          border-radius: ${RADIUS.pill};
          color: ${NEON.violet};
          font-weight: 700;
          font-size: 0.78rem;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .dash-topbar-ai-btn:hover {
          background: linear-gradient(135deg, rgba(167,139,250,0.22), rgba(236,72,153,0.16));
        }
        .dash-topbar-ai-btn:focus-visible {
          outline: 2px solid ${NEON.violet};
          outline-offset: 1px;
        }
        @media (max-width: 768px) {
          .dash-topbar-ai-btn {
            display: inline-flex;
          }
        }
        /* Desktop Header Removal task, §C (Owner-authorized): the separate
           desktop workspace top strip is removed - business identity now
           lives solely in the enhanced sidebar brand block (desktop), the
           Admin AI-logs action and the AI Chat action both moved into the
           new sidebar utility zone, and the status toast was re-anchored
           above (fixed, decoupled from the topbar entirely). This rule
           hides ONLY the topbar's own visible presentation on desktop -
           the topbar's underlying JSX (business-identity/admin-button
           markup) is intentionally left otherwise unchanged and REMAINS
           FULLY VISIBLE ON MOBILE below 768px, since mobile has no other
           on-screen business-identity display once the sidebar itself is
           hidden there (display:none below 768px, unchanged) - removing it
           on mobile too would have been a real informational regression
           the Owner's own task scope never authorized ("desktop top
           strip" / "desktop .dash-topbar presentation" throughout). The
           AIChatWidget mount and the status toast were already extracted
           out of the topbar's own JSX entirely (see above/below) precisely
           because a display:none ancestor would otherwise have taken any
           position:fixed descendant down with it - this hide rule alone,
           without that extraction, would have silently broken AI Chat and
           the status toast on desktop. */
        @media (min-width: 769px) {
          .dash-topbar {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .dash-sidebar {
            display: none;
          }
          .dash-topbar {
            padding: 10px 12px;
          }
          .dash-topbar-bizname {
            max-width: 140px;
            font-size: 0.9rem;
          }
        }
      `}</style>

      {/* חלון צף מודרני (Modal) עבור כל הודעות השגיאה והאזהרות */}
      {alertModalMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center', animation: 'popupBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(239, 68, 68, 0.12)', color: NEON.red, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', fontWeight: '800', marginBottom: '8px', ...neonGlowTextStyle }}>
              {isHebrew ? 'שים לב' : 'Attention'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.88rem', marginBottom: '20px', lineHeight: '1.4' }}>
              {alertModalMsg}
            </p>
            <button
              className="dash-neon-btn"
              onClick={() => setAlertModalMsg(null)}
              style={{ width: '100%', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}
            >
              {isHebrew ? 'הבנתי, סגור' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop Header Removal task, §C/§E/§G: standalone, always-mounted
          shell-level overlays - moved out of the now desktop-hidden
          .dash-topbar so they keep working regardless of its visibility.
          Both use position:fixed internally (like the modals immediately
          below), so their exact DOM location has no visual effect; this is
          simply where the file already mounts this class of element. */}
      {/* AIChatWidget: same real component/props/isDashboard flag as
          before, only its DOM location changed - its own listener for the
          open-proflow-ai-chat CustomEvent (already used by Contact.jsx
          elsewhere in the app) remains active regardless of which trigger
          fires it. .dash-ai-chat-mount is the scoping hook the desktop-only
          CSS rule above uses to hide only this mount's own floating
          trigger button on desktop - Landing/Contact/every other page's
          own separate AIChatWidget mount is untouched. */}
      <div className="dash-ai-chat-mount">
        <AIChatWidget isHebrew={isHebrew} isDashboard={true} />
      </div>

      {/* Status toast: same statusMsg state/role="status"/aria-live="polite"/
          success-error styling/animation/dismissal lifecycle as before -
          only its container class (.dash-status-toast, was .dash-topbar-
          toast) and positioning (viewport-fixed, was absolute-relative-to-
          the-topbar) changed, since its old anchor point no longer exists
          on desktop. Renders identically on both desktop and mobile now,
          decoupled from the topbar's own visibility either way. */}
      {statusMsg.text && (
        <div
          role="status"
          aria-live="polite"
          className="dash-status-toast no-print"
          style={{
            background: statusMsg.type === 'success' ? '#ffffff' : '#dc2626',
            color: statusMsg.type === 'success' ? NEON.violet : '#ffffff',
            border: statusMsg.type === 'success' ? `1px solid ${NEON.border}` : 'none',
          }}
        >
          {statusMsg.type !== 'success' && <AlertTriangle size={14} strokeWidth={2.5} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <AccessibilityModal isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} isHebrew={isHebrew} />
      <PricingModal 
        isOpen={showPricingModal} 
        onClose={() => setShowPricingModal(false)} 
        isHebrew={isHebrew} 
        isLocalIsraeliBusiness={isLocalIsraeliBusiness} 
        currentPlan={bizPlan}
        userId={session?.user?.id}
        onPlanUpdated={() => loadData(session?.user?.id, session?.user?.email)}
        currency={currency}
      />

      <SignOutModal 
        isOpen={showSignOutModal} 
        onClose={() => setShowSignOutModal(false)} 
        onConfirm={() => {
          setShowSignOutModal(false);
          handleSignOut();
        }}
        isHebrew={isHebrew}
      />
      
      <EditClientModal
        isOpen={editingClient !== null || isCreatingClient}
        onClose={() => { setEditingClient(null); setIsCreatingClient(false); }}
        client={isCreatingClient ? {} : editingClient}
        onSave={isCreatingClient ? handleCreateClient : handleSaveUpdatedClient}
        isHebrew={isHebrew}
        isNew={isCreatingClient}
      />

      <EditExpenseModal 
        isOpen={editingExpense !== null}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        onSave={handleSaveUpdatedExpense}
        isHebrew={isHebrew}
      />

      <LifetimeConfirmModal 
        isOpen={pendingLifetimeUser !== null}
        onClose={() => setPendingLifetimeUser(null)}
        onConfirm={async () => {
          if (!pendingLifetimeUser) return;
          const u = pendingLifetimeUser;
          setPendingLifetimeUser(null);
          await handleToggleLifetime(u.id, u.trial_ends_at);
        }}
        userEmail={pendingLifetimeUser?.email || ''}
        isHebrew={isHebrew}
      />

      <UserDetailsModal
        isOpen={selectedUserDetails !== null}
        onClose={() => setSelectedUserDetails(null)}
        user={selectedUserDetails}
        isHebrew={isHebrew}
      />

      <EmailConfirmModal 
        isOpen={pendingEmailQuote !== null} 
        onClose={() => setPendingEmailQuote(null)} 
        onConfirm={() => {
          const q = pendingEmailQuote;
          setPendingEmailQuote(null);
          executeEmailSend(q);
        }}
        clientEmail={pendingEmailQuote?.clients?.email || ''}
        isHebrew={isHebrew}
      />

      <DeleteConfirmModal
        isOpen={pendingDelete !== null}
        isHebrew={isHebrew}
        title={pendingDelete?.title}
        message={pendingDelete?.message}
        confirmLabel={pendingDelete?.confirmLabel}
        cancelLabel={isHebrew ? 'ביטול' : 'Cancel'}
        isDeleting={isDeleting}
        onCancel={() => { if (!isDeleting) setPendingDelete(null); }}
        onConfirm={handleConfirmDelete}
      />

      {/* חוק ברזל (Owner Visual QA Correction task, Desktop Width - Balanced
          Geometry, סבב שני): padding נשאר צנוע (16px) בדסקטופ בלבד - העבודה
          המהותית של השוליים המאוזנים עכשיו מתבצעת ע"י --pf-dashboard-
          desktop-content-width עצמו (min(1320px, 72vw), ר' src/index.css) -
          אסטרטגיה יחסית-ל-viewport ששומרת על יחס ניצול-רוחב יציב (~72%)
          בכל הרזולוציות, לא padding קבוע. ה-16px כאן הוא רק "כרית ביטחון"
          צנועה, לא המנגנון העיקרי יותר. Mobile (@media max-width:768px
          למעלה) עדיין דורס ל-6px עם !important - לא נוגע כלל, בלי שינוי. */}
      {/* ProFlow V2 Phase 1 — authenticated User Shell (Owner-approved mockup,
          PROFLOW_PROJECT_CONTEXT.md §V2-1). New sidebar+topbar shell only -
          every destination/handler/state below is the exact same one the
          old purple header-bar + horizontal tab row used to call; nothing
          was renamed, added, or removed functionally. Sidebar hidden ≤768px
          (same breakpoint the pre-existing, untouched .mobile-bottom-nav
          already uses below) - narrow viewports keep using that proven
          mobile nav unchanged, so no new mobile interaction was invented. */}
      {/* V2 Visual Transformation Pass, Round 2 (Owner URGENT width
          correction): the TOTAL shell (sidebar + workspace together) is now
          bounded to --pf-dashboard-shell-total-width (~980px, centered) -
          see src/index.css for the full rationale. This is a NEW outer
          wrapper around .dash-shell-body specifically for this; the page's
          own background (NEON.bg, set on the root div) still extends full
          browser width behind it, so the shell visually "floats" centered,
          the same composition principle Public Quote's own document uses. */}
      <div className="dash-shell-outer" style={{ maxWidth: 'var(--pf-dashboard-shell-total-width)', margin: '0 auto', width: '100%', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
      <div className="dash-shell-body">
        <aside className="dash-sidebar no-print">
          {/* Sidebar Branding Hierarchy: business identity primary (logo if
              the business uploaded one, else an initial-letter mark in the
              same brand gradient the CTA/avatar already use elsewhere - no
              invented data, bizLogoUrl/bizName are the same real fields the
              topbar/quote documents already use), ProFlow secondary/quiet
              directly beneath it as a restrained "Powered by" platform-brand
              lockup. Both real-data-driven, no placeholder content. */}
          <div className="dash-sidebar-brand">
            {bizLogoUrl && !sidebarLogoFailed ? (
              <div className="dash-sidebar-brand-logo-canvas">
                {/* חוק ברזל (Authenticated UI Coherence task, Business Logo
                    Presentation): trimmedLogoSrc (כשקיים - ר' ה-useEffect
                    למעלה) הוא רק תצוגה חתוכה-שוליים-שקופים של אותה תמונה
                    בדיוק, לעולם לא מקור-אמת חדש - onError עדיין קורא ל-
                    setSidebarLogoFailed בדיוק כמו קודם, כך שגם אם הגרסה
                    החתוכה נכשלת (מצב לא-סביר, אבל בטוח-כשל) ה-fallback
                    הקיים עדיין פועל זהה. */}
                <img
                  key={bizLogoUrl}
                  src={trimmedLogoSrc || bizLogoUrl}
                  alt={bizName || (isHebrew ? 'לוגו העסק' : 'Business logo')}
                  className="dash-sidebar-brand-logo-img"
                  onError={() => setSidebarLogoFailed(true)}
                />
              </div>
            ) : (
              <>
                <div className="dash-sidebar-brand-mark">
                  <span>{(bizName || session.user.email || '?').trim().charAt(0).toUpperCase()}</span>
                </div>
                <span className="dash-sidebar-brand-name" title={bizName || ''}>
                  {bizName || (isHebrew ? 'העסק שלי' : 'My Business')}
                </span>
              </>
            )}
          </div>
          <nav className="dash-sidebar-nav">
            {!isSuperAdmin && (
              <button onClick={handleCreateNewQuoteClick} className="dash-sidebar-cta">
                <PlusCircle size={17} strokeWidth={2.4} />
                {isHebrew ? 'הצעת מחיר חדשה' : 'New Quote'}
              </button>
            )}

            {[
              { key: 'main', icon: FileText, label: t.quotesNav },
              { key: 'settings', icon: SettingsIcon, label: t.settingsNav },
              { key: 'clients', icon: Users2, label: t.clientsNav },
              { key: 'finances', icon: BarChart3, label: t.financesNav },
              { key: 'catalog', icon: Package, label: t.catalogNav },
              ...(isSuperAdmin ? [{ key: 'admin_clients', icon: Shield, label: t.usersAdminNav }] : [])
            ].map(({ key, icon: TabIcon, label }) => (
              <button
                key={key}
                className={activeTab === key ? 'dash-sidebar-btn dash-sidebar-btn-active' : 'dash-sidebar-btn'}
                onClick={() => { setActiveTab(key); setIsCreatingQuote(false); setEditingQuoteId(null); }}
              >
                <TabIcon size={17} strokeWidth={2.2} />
                <span>{label}</span>
              </button>
            ))}

            {/* Final Dashboard/Sidebar Polish task, §B (position/reuse):
                the AI action sits INSIDE the primary nav's own top-down
                flow, immediately after the nav-items map (below Catalog) -
                a normal-flow child of .dash-sidebar-nav, not a floating
                sibling with a large empty gap above it. Reuses the exact
                same open-proflow-ai-chat CustomEvent as before (unchanged -
                see the standalone AIChatWidget mount elsewhere in this
                file) - no second chat implementation.
                Authenticated UI Coherence task (label/icon correction,
                supersedes the Final Dashboard/Sidebar Polish task's own
                "AI"-only label): visible label restored to "AI Chat"/"צ׳אט
                AI", the Owner's newest exact spec. Icon changed again -
                plain Sparkles read as too abstract; now a composite modern
                outline speech-bubble (MessageCircle, matching the same
                icon family/size/stroke-weight as every other sidebar nav
                icon) with a small sparkle accent badge in its corner
                (same "medallion + small corner accent" composition already
                established in PlanIdentityBadge.jsx elsewhere in this
                project) - explicitly not the old boxy robot/computer icon,
                not a monitor/terminal/DOS glyph, not emoji, not a raster
                image. DOM order is still [icon, label] - under the
                sidebar's own inherited direction (no isHebrew-conditional
                branch needed here, same "single DOM order, mirrored by
                dir" convention as the rest of this file) this already
                places the icon at each language's true inline-start: RIGHT
                of the label for Hebrew, LEFT of the label for English,
                exactly the Owner's own explicit requirement. title/
                aria-label unchanged (already the Owner's own exact
                required strings from the prior round, not reopened here).
                dash-sidebar-btn-ai (unchanged CSS) still adds a restrained
                purple/pink wash+border - more visible than a plain nav
                row, still deliberately secondary to the solid-purple New
                Quote CTA above. */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-proflow-ai-chat'))}
              className="dash-sidebar-btn dash-sidebar-btn-ai"
              title={isHebrew ? 'פתיחת צ׳אט AI' : 'Open AI Chat'}
              aria-label={isHebrew ? 'פתיחת צ׳אט AI' : 'Open AI Chat'}
            >
              <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <MessageCircle size={17} strokeWidth={2.2} />
                <Sparkles size={9} strokeWidth={2.5} style={{ position: 'absolute', top: '-3px', [isHebrew ? 'left' : 'right']: '-4px', color: '#f0abfc' }} />
              </span>
              <span>{isHebrew ? 'צ׳אט AI' : 'AI Chat'}</span>
            </button>

            {/* Owner-authorized David Aluminum professional-item demo entry
                points - gated to exactly one real account via
                professionalPreviewAllowlist.js, unchanged from before this
                task (same allowlist call, same two destinations). TEMPORARY,
                per PROFLOW_TODO.md item 30.F - not final product navigation. */}
            {isProfessionalPreviewEnabled(session?.user?.id) && (
              <>
                <a href="/professional-preview" className="dash-sidebar-btn dash-sidebar-btn-ghost">
                  <Sparkles size={17} strokeWidth={2.2} />
                  <span>{isHebrew ? 'תצוגה מקדימה: חוויה חדשה' : 'New Experience Preview'}</span>
                </a>
                <a href="/public-quote/a29b1fbb-f2ca-427d-88b2-6198d138eb89/preview?lang=he" className="dash-sidebar-btn dash-sidebar-btn-ghost">
                  <Eye size={17} strokeWidth={2.2} />
                  <span>{isHebrew ? 'בדיקת תצוגה חדשה' : 'QA: New Quote View'}</span>
                </a>
              </>
            )}
          </nav>

          {/* Desktop Header Removal task, §G, updated by Final Dashboard/
              Sidebar Polish task §B: sidebar utility zone - now holds only
              the relocated Super Admin "AI Support Logs" action (the AI
              Chat action itself moved into the primary nav's own flow
              above, immediately below Catalog - see the comment there for
              the full rationale; it deliberately stayed OUT of the nav's
              own top-down rhythm and was NOT moved, per the Owner's
              explicit "do not move Super Admin utilities... merely to
              achieve this" instruction). */}
          <div className="dash-sidebar-utility">
            {/* Relocated Super Admin "AI Support Logs" action (was inside
                dash-topbar-actions, itself now hidden on desktop - see
                .dash-topbar's own desktop-only display:none rule above).
                Preserved for mobile in its original topbar location
                (topbar remains visible on mobile, unaffected by this task -
                only its desktop presentation was removed) - this is the
                desktop-only equivalent, mutually exclusive by breakpoint
                with the sidebar itself (display:none below 768px), so
                there is no double-render at any single viewport width.
                Same handler/destination/permission condition, unchanged. */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => { window.location.href = '/ai-logs'; }}
                className="dash-sidebar-btn dash-sidebar-btn-ghost"
              >
                <MessagesSquare size={17} strokeWidth={2.2} />
                <span>AI Support Logs</span>
              </button>
            )}
          </div>

          <div className="dash-sidebar-footer">
            {isSuperAdmin && (
              <span className="dash-sidebar-admin-badge">
                <Shield size={12} strokeWidth={2.5} />
                SUPER ADMIN
              </span>
            )}
            {/* Final Dashboard/Sidebar Polish task, §C: the large standalone
                plan card that used to render here (PlanIdentityBadge
                variant="panel" + a separate "Upgrade Plan" text button) is
                REMOVED - it did not belong in the nav/footer flow, per the
                Owner's explicit instruction. Nothing about plan identity,
                entitlement resolution, trial calculation, upgrade logic, the
                click handler, or the pricing destination was removed or
                changed - the exact same displayIdentity/showUpgradeCta/
                setShowPricingModal now drive the new compact PlanIdentityBadge
                variant="compact" instead, in the dashboard's own greeting
                area (§D, see the greeting JSX further below) - relocated,
                not deleted. See PlanIdentityBadge.jsx's own new "compact"
                variant for the single canonical source of the badge's
                content (still only getDisplayIdentityLabel/Visual, never a
                second, independently-derived plan-state guess). */}
            <div className="dash-sidebar-user">
              {/* Final Dashboard/Sidebar Polish task, §F: this block's job
                  is to identify the actual signed-in INDIVIDUAL, not the
                  business (already shown prominently at the top of the
                  sidebar via the logo/brand block - repeating it here was
                  the exact redundancy the Owner flagged: "do not
                  redundantly present the business name there when it does
                  not represent the individual user"). This app has no
                  separate stored "person name" field - email is the one
                  real, reliable per-user identifier - so both the avatar
                  initial and the identity line now derive from
                  session.user.email only, never bizName. The old second
                  line (which repeated the same email a second time) is
                  removed as the redundancy it was, not because email
                  itself was wrong data - it was already the correct data,
                  just needlessly duplicated under a business-name label. */}
              <div className="dash-sidebar-avatar">{(session.user.email || '?').trim().charAt(0).toUpperCase()}</div>
              <div className="dash-sidebar-user-text">
                <div className="dash-sidebar-user-name" title={session.user.email}>{session.user.email}</div>
              </div>
              <button onClick={() => setShowSignOutModal(true)} className="dash-sidebar-signout" title={isHebrew ? 'התנתק' : 'Sign Out'} aria-label={isHebrew ? 'התנתק' : 'Sign Out'}>
                <LogOut size={15} strokeWidth={2.3} />
              </button>
            </div>
            {/* Desktop Header Removal task, §B: ProFlow's platform lockup -
                the final, quiet signature at the very bottom of the
                sidebar, after the user identity, per the Owner's explicit
                "final platform signature at the bottom" instruction. Same
                real ProFlowLogo component/props as before.
                Final Dashboard/Sidebar Polish task, §F (readability bump):
                the Owner's own words - "it must remain quiet and secondary,
                but it must be readable... increase contrast only enough to
                meet that requirement" - opacity nudged 0.55->0.72 (see the
                CSS rule's own comment), a modest, deliberately small
                increase, not a redesign. */}
            <div className="dash-sidebar-platform-brand">
              <span className="dash-sidebar-platform-brand-label">{isHebrew ? 'מופעל על ידי' : 'Powered by'}</span>
              <ProFlowLogo size={13} />
            </div>
          </div>
        </aside>

        <div className="dash-shell-main">
          {/* Topbar: everything that used to live inside the purple
              dash-header-bar (business identity/plan badge/AI entry/upgrade
              CTA/admin logs button/status toast) now renders here, on the
              light V2 surface, instead of on a purple gradient - same
              components/handlers/props, new visual container only. */}
          <div className="dash-topbar no-print">
            <div className="dash-topbar-identity">
              {bizLogoUrl ? (
                <img src={bizLogoUrl} alt={bizName} className="dash-topbar-logo-img" />
              ) : (
                <span className="dash-topbar-bizname">{bizName}</span>
              )}
            </div>
            {/* V2 Visual Transformation Pass: the plan badge + Upgrade CTA
                that used to render here moved into the sidebar's new plan
                card (see dash-sidebar-footer above) - the Owner explicitly
                rejected a standalone plan badge floating in the topbar
                corner. isSuperAdmin never had a plan badge/upgrade CTA
                either way (both were already conditional on it being
                false/absent). */}
            {/* Desktop Header Removal task: the AIChatWidget mount and the
                status toast were extracted out of this container entirely
                (see the standalone mount block near the other modals,
                above the shell) - both are position:fixed overlays that
                would otherwise be taken down by this container's own
                desktop-only display:none rule. The Admin AI-logs button
                stays here, preserved for its original mobile audience
                (this whole .dash-topbar is desktop-hidden, mobile-visible
                as of this task) - a separate, desktop-only equivalent now
                lives in the sidebar's own utility zone above. */}
            <div className="dash-topbar-actions">
              {/* חוק ברזל (Authenticated UI Coherence task, Mobile AI
                  Clarification, Owner correction): כפתור AI יציב בכותרת-
                  המובייל, מחליף את המשגר-הצף שהוסר. אותו אייקון-מרוכב
                  בדיוק (MessageCircle+Sparkles קטן בפינה) כמו כפתור ה-AI
                  בסיידבר-הדסקטופ - עקביות אייקונוגרפית מלאה בין שני
                  המיקומים, לא סמל שונה. אותו event בדיוק (open-proflow-
                  ai-chat) - לא מימוש-צ'אט שני. ~36px גובה (ר' CSS
                  dash-topbar-ai-btn), מוצג רק ≤768px (מובייל), אף פעם לא
                  יוצר שורת-כותרת נוספת - יליד רגיל בתוך dash-topbar-actions
                  הקיים כבר, לא overlay/position:fixed. */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-proflow-ai-chat'))}
                className="dash-topbar-ai-btn"
                title={isHebrew ? 'פתיחת צ׳אט AI' : 'Open AI Chat'}
                aria-label={isHebrew ? 'פתיחת צ׳אט AI' : 'Open AI Chat'}
              >
                <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                  <MessageCircle size={16} strokeWidth={2.2} />
                  <Sparkles size={8} strokeWidth={2.5} style={{ position: 'absolute', top: '-3px', [isHebrew ? 'left' : 'right']: '-4px', color: '#a855f7' }} />
                </span>
                <span>{isHebrew ? 'צ׳אט AI' : 'AI Chat'}</span>
              </button>
              {isSuperAdmin && (
                <button className="dash-topbar-ghost-btn" onClick={() => { window.location.href = '/ai-logs'; }}>
                  <MessagesSquare size={14} />
                  <span className="dash-admin-logs-text">AI Support Logs</span>
                </button>
              )}
            </div>
          </div>

      <div className="dash-main-content" style={{ flex: '1 1 auto', padding: '16px' }}>
        {/* Width history (condensed - full narrative now lives in
            PROFLOW_PROJECT_CONTEXT.md §54/§56/§58/§184/§186, not repeated
            in full here across every round): this content wrapper used to
            own its own max-width, aliased at various points to Public
            Quote's 980px, then to an independent 1600px, then (Round 2,
            same day as §186) deliberately removed in favor of the shared
            .dash-shell-outer total-shell cap.
            Desktop Workspace Width task (Owner-authorized, this round):
            the Round 2 total-shell cap (~980px for sidebar+content
            TOGETHER) measured, on real desktop widths, as far too narrow
            for a data-heavy app - tables/filters/financial data were
            compressed while large empty gutters sat outside the whole
            shell. Fix, desktop-only (see the `@media (min-width: 769px)`
            block below): .dash-shell-outer's own max-width is lifted so it
            no longer binds content width at all, and THIS wrapper
            (className dash-content-container) now owns its own fluid
            max-width again (~1200-1280px) with its own 24-32px edge
            padding as the "outer gutter" - fluid below that cap (fills
            whatever the sidebar's fixed 232px leaves), never touching the
            sidebar's own width/side/colors/behavior. Mobile is completely
            untouched: no rule below applies under 769px, so this div keeps
            its plain width:100%/no-max-width/no-padding behavior exactly
            as before. Public Quote's own --pf-desktop-content-width/980px
            remains completely untouched and unreferenced here. */}
        <div className="dash-content-container" style={{ width: '100%' }}>

          {/* V2 Visual Completion Pass: greeting banner (Image 1 reference).
              Presentational only - greets the real business name already in
              scope (bizName), no new data fetch, no fabricated content.
              Same visibility gate as the KPI grid below (main tab overview
              only, not inside other tabs or the Create Quote screen) - this
              same gate also covers the compact plan badge added below, so
              no separate !isSuperAdmin check is needed for it.
              Desktop Header Removal task, §D: now the FIRST visible
              workspace element (the topbar that used to sit above it is
              desktop-hidden - see .dash-topbar's own rule). Sizing/spacing
              modestly increased (title 1.25rem->1.4rem, subtitle 0.85rem->
              0.9rem) to read as a genuine compact header replacing the
              removed topbar - targets the Owner's own ~70-80px total
              height figure, still restrained (no background/gradient band
              added - text-only).
              Final Dashboard/Sidebar Polish task, §E: greeting copy
              replaced again, per the Owner's own exact new spec (both
              lines are new text, not a re-wording of the prior "שלום, ברוך
              שובך!" - that itself is now superseded). Uses only the real
              bizName already in scope - never an owner/person name derived
              from email or metadata (this app has no such field). Safe
              market-correct fallback ("העסק שלך"/"your business", second-
              person to agree with "שובך"/"Welcome back") only when bizName
              is genuinely empty - never invented otherwise. Subtitle line
              gets single-line ellipsis truncation (minWidth:0 on its own
              flex child + overflow/textOverflow on the <p> itself) so a
              long business name degrades safely without growing the
              header's own height or pushing the KPI cards down.
              §D (compact plan badge): moved out of the removed sidebar
              plan card (§C) into this same row, opposite the greeting text.
              Physical side is direction-aware via plain DOM order + this
              row's own inherited direction (no isHebrew-conditional
              left/right) - greeting text is the first child (lands at the
              row's inline-start: right for Hebrew, left for English), the
              badge is the second child (inline-end: left for Hebrew, right
              for English) - exactly the Owner's own required placement,
              via the same "single DOM order, mirrored by dir" convention
              used everywhere else in this file. flexWrap lets the badge
              drop beneath the greeting on a narrow/mobile width instead of
              overflowing. Same real displayIdentity/showUpgradeCta/
              setShowPricingModal as the removed sidebar card - only
              relocated, never re-derived (PlanIdentityBadge's own
              variant="compact" still reads only the canonical
              getDisplayIdentityLabel/Visual functions). daysLeft is the
              real trialDaysLeft from computeEffectivePlan() above, passed
              through only when displayIdentity is actually FREE_TRIAL -
              never a separately-computed/guessed value, and never shown
              for any other identity. The whole badge becomes a real
              <button> (upgrade-clickable) only when showUpgradeCta is
              true; otherwise it renders as the same non-interactive badge
              PlanIdentityBadge already produces by default. */}
          {/* חוק ברזל (Owner-Approved Option B Spec Correction task): הבעלים
              שיחזר את ה-reference החזותי המקורי המאושר ל-Option B, ותיקן
              את הביצוע הקודם (שהשתמש ב-NEON.border/#e4e1ee ו-radius 14px -
              לא תואם). הספק המדויק, בלי פרשנות/סובסטיטוציה של טוקן-ערכת-
              נושא: border-color #E9D5FF (ולא NEON.border), 1px solid,
              border-radius 12px (ולא 14px), background #FFFFFF, ללא צל.
              transition 200ms על height (ר' גם על ה-KPI grid/nav-row
              הפנימיים שמפעילים את שינוי-הגובה בפועל) - מעבר חלק כשה-
              layout הפנימי משתנה (למשל רשת ה-KPI קורסת לשתי עמודות
              ב-media query הקיים). הגובה עדיין נגזר מהתוכן בפועל לחלוטין -
              אין height/minHeight/maxHeight קבועים בכל צורה, רק ה-transition
              עצמו נוסף מעל ההתנהגות התוכן-מונעת הקיימת, לא מחליף אותה.
              המבנה עצמו (מה נכלל בתוך המעטפת: כותרת סגולה + שורת ניווט +
              KPI-grid מותנה) לא נגוע - רק הסגנון החזותי של המעטפת עצמה. */}
          {/* חוק ברזל (Trial Bar Zero-Layout-Shift Fix task): position:'relative'
              נוסף כאן (שינוי CSS טהור, ללא השפעה חזותית כלשהי על Frame A
              עצמו) כדי לשמש כ-containing-block ל-Trial Notice, שהפך ליליד
              position:'absolute' בתוך המעטפת הזו (ר' לפני הסגירה למטה) -
              כך שהוא מוצא לחלוטין מזרימת-המסמך הרגילה ותורם 0px לגובה בזרימה,
              בכל מצב (מוצג/מוסתר/במעבר) - הפתרון הקודם (§89, block רגיל
              בזרימה, מרונדר-מותנה) יצר ~44px קפיצת-layout כשה-Trial Notice
              הופיע/נעלם, בדיוק הבעיה שהבעלים דיווח עליה. */}
          {/* V2 Visual passes: border color + shadow + radius changed (radius
              12px->16px, QA-verified as having zero effect on the Trial
              Notice's positioning math below - border-radius doesn't affect
              box height/offset). The actual preservation constraint - the
              ONE thing that must stay byte-identical - is position:'relative'
              + the exact 14px padding + the transition value, since those
              are what the Trial Notice's `top: calc(100% - 6px)` overlay
              (rendered as this div's own last children, further down) is
              measured against. Confirmed still identical below. */}
          {/* חוק ברזל (Consolidated Open UI Corrections task, §F - Blank Top
              Strip root cause + fix): Frame A (dash-upper-section) עצמה
              הייתה מרונדרת ללא-תנאי בכל טאב - רק התוכן שבתוכה (כותרת/
              סטטיסטיקות/באדג'/Hot Quote, ושתי גרסאות Trial Notice) היה
              מותנה ב-activeTab==='main'. בכל טאב אחר (Clients/Finances/
              Catalog/Settings/Admin) זה הציג קופסה לבנה-מעוגלת ריקה
              (padding:14px+border+shadow+radius, ~28px גובה, ללא תוכן) -
              בדיוק ה"רצועה לבנה ריקה שנראית כמו שדה-חיפוש שנכשל בטעינה"
              שהבעלים דיווח עליה. תוקן במקור-המשותף (לא תיקון פר-עמוד): כל
              ה-div עטוף עכשיו באותו תנאי בדיוק שכבר שולט על תוכנו - כשהוא
              false, שום דבר לא מרונדר (לא עוד קופסה-ריקה תופסת מקום), וכש-
              true ההתנהגות זהה ב-100% למה שהייתה. Trial Notice (שני
              הענפים, ילידים אחרונים בתוך ה-div) כבר היו מוגבלים לאותו תנאי
              בעצמם, כך שהעטיפה הזו לא משנה את הנראות שלהם באף מצב - רק
              מסירה את המעטפת-הריקה שהייתה קיימת בלעדם. */}
          {activeTab === 'main' && !showQuoteForm && !isSuperAdmin && (
          <div className="dash-upper-section" style={{ position: 'relative', background: '#FFFFFF', border: `1px solid ${NEON.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.sm, padding: '14px', marginBottom: '16px', transition: 'height 0.2s ease' }}>

          {/* חוק ברזל (Trial Bar Owner-Reference Correction task): מרווח-כותרת
              קבוע (14px) - אין עוד marginBottom מותנה כאן. ה-Trial Notice
              עצמו כבר לא מרונדר בתוך dash-header-bar כלל (לא absolute, לא
              יליד-flex פנימי) - הוא רכיב עצמאי ב"מסלול" (track) הצר בין
              Frame A (dash-upper-section, נסגר למטה) לשורת-הבקרה של Quote
              History, בדיוק לפי הרפרנס החזותי המאושר שהבעלים סיפק. ר' לפני
              הסגירה למטה למיקום ה-DOM/positioning בפועל (עודכן שוב במשימת
              Zero-Layout-Shift Fix - ר' חוק-הברזל למעלה). */}
          {/* ProFlow V2 Phase 1 (Owner-approved mockup, PROFLOW_PROJECT_CONTEXT.md
              §V2-1): the purple gradient header-bar + horizontal tab-pill row
              that used to open dash-upper-section here were moved, not
              deleted - business identity/plan badge/AI entry/upgrade CTA/
              admin logs/sign-out now render in the new light dash-topbar, and
              the tab-navigation + "New Quote" CTA + David-only QA links now
              render as the new dash-sidebar's vertical nav (both new blocks
              sit above dash-shell-body, see the JSX right before
              dash-main-content opens below). dash-upper-section itself is
              intentionally UNTOUCHED as a wrapper (still position:'relative',
              still the same padding) - it now wraps only the KPI grid + the
              Trial Notice absolute-overlay pair, exactly as before, so the
              Trial Notice's tuned `calc(100% - 6px)` offset (measured against
              THIS wrapper's own box) keeps working unmodified. */}
          {/* חוק ברזל (Authenticated UI Coherence task, Dashboard Header
              Compression): הכותרת (h1+badge, שהייתה div נפרד מחוץ ל-Frame
              A) והרשת המקורית של שלושה כרטיסי-KPI גדולים (בתוך Frame A)
              מוזגו לרצועה קומפקטית אחת - "greeting and business identity;
              compact Total Quotes and Total Revenue values; small plan/
              trial badge on the opposite side," בדיוק שלוש הקבוצות
              שהמשימה מפרטת, כל אחת ~80-90px גבוה כולל ריפוד Frame A -
              יעד הגובה הכולל של הבעלים. חשוב: המיזוג נשאר בתוך Frame A
              עצמו (position:'relative', 14px padding, transition - כולם
              ללא שינוי, ר' ההערה מעל פתיחת ה-div) - כי עוגן ה-Trial Notice
              (`top: calc(100% - 6px)`, יליד אחרון בתוך Frame A) הוא
              יחסי-אחוזים לגובה הפנימי של Frame A עצמו, לא לפיקסל קשיח -
              כך שכיווץ תוכן Frame A (במקום להזיז את ה-Trial Notice לרכיב
              חדש/נפרד) משמר את חוזה-המיקום המדויק הזה אוטומטית, בלי
              לגעת במנגנון עצמו כלל. "Greeting and business identity" הוא
              רק שורת ה-h1 עצמה - לא עוד משפט-הסבר נפרד תחתיה (bizName
              כבר מוצג בבירור בכותרת הסיידבר/לוגו, ר' .dash-sidebar-brand
              למעלה - חזרה נוספת עליו כאן במשפט-הסבר שלם הייתה בדיוק
              ה"long redundant explanatory sentence" שהמשימה מבקשת להסיר). */}
          {activeTab === 'main' && !showQuoteForm && !isSuperAdmin && (() => {
            // חוק ברזל (Authenticated UI Coherence task, Mobile Dashboard
            // Header Recomposition, Owner mid-task correction): פונקציית-
            // עזר מקומית (לא state/hook - נבנית מחדש בכל render, בדיוק
            // כמו renderPlanBadge להלן) כדי לא לשכפל את לוגיקת-ה-
            // showUpgradeCta/setShowPricingModal פעמיים (גרסת-דסקטופ
            // דו-שורתית + גרסת-מובייל חד-שורתית) - אותו handler/gating
            // בדיוק, רק singleLine (prop חדש ב-PlanIdentityBadge, אותו
            // רכיב קנוני יחיד) משתנה בין שתי הקריאות.
            const renderPlanBadge = (singleLine) => (
              showUpgradeCta ? (
                <button
                  type="button"
                  onClick={() => setShowPricingModal(true)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', flexShrink: 0, display: 'flex' }}
                  title={isHebrew ? 'שדרג חבילה' : 'Upgrade Plan'}
                >
                  <PlanIdentityBadge
                    displayIdentity={displayIdentity}
                    isHebrew={isHebrew}
                    variant="compact"
                    singleLine={singleLine}
                    daysLeft={displayIdentity === 'FREE_TRIAL' ? trialDaysLeft : null}
                    upgradeAvailable
                  />
                </button>
              ) : (
                <PlanIdentityBadge
                  displayIdentity={displayIdentity}
                  isHebrew={isHebrew}
                  variant="compact"
                  singleLine={singleLine}
                  daysLeft={displayIdentity === 'FREE_TRIAL' ? trialDaysLeft : null}
                />
              )
            );
            // חוק ברזל (אותה משימה): רצועת-הסטטיסטיקות (Total Quotes/
            // Total Revenue, תוויות מפורשות) - זהה בין דסקטופ למובייל,
            // רק המיקום החזותי (dash-header-stats, order/flex-basis
            // דרך CSS media query) משתנה בין השניים.
            const statsRow = (
              <div className="dash-header-stats" style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isHebrew ? 'flex-end' : 'flex-start' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '5px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary }}>
                      {isHebrew ? 'סה״כ הצעות:' : 'Total Quotes:'}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: NEON.textPrimary }}>
                      {totalQuotesCount}
                    </span>
                  </span>
                  {!isPro && (
                    <span style={{ fontSize: '0.62rem', color: NEON.amber, fontWeight: '700', whiteSpace: 'nowrap' }}>
                      {isHebrew ? `החודש: ${monthlyQuotesCount}/${planLimit}` : `This month: ${monthlyQuotesCount}/${planLimit}`}
                    </span>
                  )}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '5px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary }}>
                    {isHebrew ? 'סך הכנסות:' : 'Total Revenue:'}
                  </span>
                  <span className="pf-money" style={{ fontSize: '1.05rem', fontWeight: '800', color: NEON.textPrimary }}>
                    {sym}{formatNum(totalRevenue)}
                  </span>
                </span>
              </div>
            );
            return (
              <>
                {/* חוק ברזל (אותה משימה): שורה 1 - כותרת+באדג' יחד, ממורכזים
                    אנכית כ"קומפוזיציה אחת" (alignItems:'center' על השורה
                    עצמה - הדרישה המפורשת מהבהרת-הבעלים הקודמת, נשמרת). דסקטופ:
                    dash-header-stats (הילד השני ב-DOM) נשאר על אותה שורה,
                    בין הכותרת לבאדג'. מובייל (≤640px, ר' ה-CSS): dash-header-
                    stats מקבל order+flex-basis:100% שדוחף אותו לשורה נפרדת
                    משלו למטה - הכותרת+הבאדג' (order ברירת-מחדל/מפורש נמוך
                    יותר) נשארים יחד על שורה 1, לא "נשברים" ע"י ה-DOM-order
                    המקורי שלהם (שהיה [כותרת, סטטיסטיקות, באדג'] - אילו
                    הסטטיסטיקות פשוט "נשברו" ל-100% ברוחב בלי order מפורש,
                    הבאדג' (אחריהן ב-DOM) היה נדחק לשורה שלישית נפרדת, לא
                    נשאר עם הכותרת - בדיוק התקלה שהבעלים דיווח עליה). באדג'-
                    המובייל (singleLine, "PLAN · Nימים") ובאדג'-הדסקטופ
                    (דו-שורתי) שניהם מרונדרים תמיד - CSS display:none לפי
                    breakpoint קובע איזה אחד בפועל נראה, לא JS - כך שאין
                    "קפיצת-hydration" בין השניים. */}
                {/* חוק ברזל (Authenticated UI Coherence task, Desktop Header
                    Position Correction, Owner mid-task correction): רשת-3-
                    עמודות אמיתית (1fr auto 1fr) במקום flex+space-between -
                    ה-flex הקודם מיקם את הסטטיסטיקות "במרחב שנותר" בין שני
                    אלמנטים לא-שווים (כותרת רחבה מול באדג' צר), לא במרכז
                    האמיתי של השורה. עמודות-הקצה השוות (1fr, 1fr) מבטיחות
                    שעמודת-האמצע (auto, הסטטיסטיקות) תמיד ממורכזת ביחס
                    לרוחב-השורה כולו, ללא תלות ברוחב-כותרת/באדג' בפועל -
                    בדיוק הדרישה "centered relative to the entire
                    workspace." סדר-ה-DOM שונה בכוונה ל-[כותרת, סטטיסטיקות,
                    באדג'] (היה [כותרת, באדג', סטטיסטיקות]) כדי שמיקום-
                    האוטומטי של הרשת ימקם נכון עמודה-1/2/3 בדסקטופ; במובייל
                    (≤768px, ר' CSS) השורה חוזרת ל-flex+order כמו קודם -
                    סדר-ה-DOM החדש לא משנה שם, order מפורש שולט. dir:rtl/ltr
                    (יורש מהאב) קובע אוטומטית איזו עמודת-קצה היא ימין/שמאל -
                    אין כאן שום תנאי isHebrew על מיקום-פיזי, אותו עיקרון
                    "סדר-DOM יחיד, משתקף ע"י dir" שמשמש בכל הקובץ הזה. */}
                <div className="dash-header-row" style={{ gap: '14px', minHeight: '44px' }}>
                  <h1 className="dash-header-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', lineHeight: 1.2, color: NEON.textPrimary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isHebrew ? `ברוך שובך` : `Welcome back`}
                  </h1>

                  {statsRow}

                  <div className="dash-header-badge-desktop" style={{ display: 'flex', flexShrink: 0 }}>
                    {renderPlanBadge(false)}
                  </div>
                  <div className="dash-header-badge-mobile" style={{ display: 'none', flexShrink: 0 }}>
                    {renderPlanBadge(true)}
                  </div>
                </div>

              {/* חוק ברזל (Dashboard Header Compression, Hot Quote): כרטיס-
                  KPI ענק (רדיוס 14px, ריפוד 16px, אייקון עגול 40px) הפך
                  להתראה דקה חד-שורתית (~44px), בתוך Frame A עדיין (ר'
                  ההערה למעלה על עוגן ה-Trial Notice) - מוצגת רק כש-
                  hotQuotesList.length>0, בדיוק כמו קודם. יציבות-הגיאומטריה
                  הקיימת (רוטציית-4-שניות בין שמות-לקוח משתנים) נשמרת
                  באמצעות overflow/whiteSpace/textOverflow על שורה אחת,
                  לא עוד line-clamp דו-שורתי, כי כל ה"כרטיס" עצמו עכשיו
                  שורה אחת בלבד. אפקט-הרחבה: לחיצה עוד/מקלדת חושפת את
                  הטקסט המלא (ללא קיצוץ) בשורה שנייה - state מקומי טהור,
                  לא לוגיקה עסקית חדשה - ו"תצפה בהצעה" אמיתית (getQuoteViewLink
                  המקביל, אותה נוסחת קישור-ציבורי-לפי-מטבע שכבר קיימת ב-
                  QuotesTab.jsx, לא בדויה). */}
              {hotQuotesList.length > 0 && currentHotQuote && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setHotQuoteExpanded(prev => !prev)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHotQuoteExpanded(prev => !prev); } }}
                  aria-expanded={hotQuoteExpanded}
                  style={{ marginTop: '8px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: RADIUS.sm, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px', cursor: 'pointer' }}
                >
                  <Flame size={15} color={NEON.red} fill={NEON.red} strokeWidth={1} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: NEON.red, fontWeight: '800', flexShrink: 0 }}>{isHebrew ? 'הצעה חמה!' : 'Hot Quote!'}</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.78rem', color: NEON.textPrimary, fontWeight: '600', overflow: hotQuoteExpanded ? 'visible' : 'hidden', textOverflow: hotQuoteExpanded ? 'clip' : 'ellipsis', whiteSpace: hotQuoteExpanded ? 'normal' : 'nowrap' }}>
                    {t.hotQuoteAlert(currentHotClientName, currentHotViewCount)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(getHotQuoteViewLink(currentHotQuote), '_blank'); }}
                    title={isHebrew ? 'צפה בהצעה' : 'View quote'}
                    aria-label={isHebrew ? 'צפה בהצעה' : 'View quote'}
                    style={{ flexShrink: 0, background: 'rgba(220,38,38,0.10)', border: 'none', borderRadius: RADIUS.sm, width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: NEON.red }}
                  >
                    <Eye size={13} strokeWidth={2.2} />
                  </button>
                  <ChevronDown size={15} strokeWidth={2.4} color={NEON.red} style={{ flexShrink: 0, transform: hotQuoteExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                </div>
              )}
            </>
            );
          })()}

          {/* חוק ברזל (Trial Bar Zero-Layout-Shift Fix task, 2026-08-31):
              §89's block-in-normal-flow implementation (מרונדר-מותנה,
              marginBottom:16px) יצר ~44px קפיצת-layout אמיתית כשה-Trial
              Notice הופיע/נעלם - נמדד: שורת-הבקרה top:337.39px כשמוצג מול
              293.39px כשמוסתר. הבעלים אישר את המיקום (המסלול בין Frame A
              לשורת-הבקרה) אך דרש 0px תרומת-גובה-בזרימה, ללא יוצא מן הכלל.
              הפתרון: הרכיב עצמו הפך ליליד אחרון בתוך dash-upper-section
              (Frame A, שקיבל position:'relative' למעלה - שינוי CSS טהור),
              עם position:'absolute' משלו (top:'calc(100% - 6px)' - עודכן
              במשימת A1 Trial-Bar-Vertical-Adjustment, ר' חוק-ברזל נפרד
              למטה לפני הרכיב עצמו; היה 'calc(100% + 2px)' לפני כן - שינוי
              בערך ה-offset בלבד, לא במנגנון עצמו. left:0,
              right:0) - כך שהוא מוצא לחלוטין מזרימת-המסמך: תמיד תורם 0px
              לגובה, בכל מצב (מוצג/מוסתר/במעבר-אנימציה), מבלי תלות בהתאמת-
              רוחב-פינוי מדויקת למסלול הטבעי הקיים ממילא (~31px בין תחתית
              Frame A לתחתית ה-margin/padding הקיימים כבר, ללא קשר לרכיב).
              left:0/right:0 כאן מתייחסים ל-padding-box של Frame A עצמו
              (14px padding קיים) - כך שרוחב-הבר תואם את רוחב-התוכן הפנימי
              של Frame A (איפה שהכותרת/ה-KPI בפועל יושבים), לא את הגבול
              החיצוני שלו - עקבי יותר ובלי חשבון אינסטים-שליליים שביר. שני
              המשתנים (dash-trial-slidebar למתקרב-לסיום/פג, dash-trial-
              ticker-lane לניסיון-פעיל-רגיל) עברו לכאן זהים ב-100% בטקסט/
              אנימציות - רק ה-DOM-מיקום/positioning השתנו (בפעם השלישית
              בסשן הזה). marginBottom הוסר (חסר-משמעות ל-position:absolute).
              zIndex:5 מבטיח שהבר מצויר מעל שכניו במקרה של חפיפה חזותית
              קלה בתוך המסלול הצר - "safe overlay strategy" לפי דרישת
              הבעלים המפורשת, לא תקלה. */}
          {activeTab === 'main' && !showQuoteForm && trialNoticeVisible && (isTrialExpired || isExpiringSoon) && (
            <div
              role="status"
              aria-live="polite"
              className="dash-trial-slidebar no-print"
              style={{
                position: 'absolute',
                top: 'calc(100% - 6px)',
                left: 0,
                right: 0,
                zIndex: 5,
                overflow: 'hidden',
                boxSizing: 'border-box',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 30px',
                fontSize: '0.78rem',
                fontWeight: '500',
                color: '#ffffff',
                background: NEON.gradient,
                boxShadow: NEON.glow,
                animation: `${isHebrew ? (trialNoticeExiting ? 'trialSlideOutRTL' : 'trialSlideInRTL') : (trialNoticeExiting ? 'trialSlideOutLTR' : 'trialSlideInLTR')} ${trialNoticeExiting ? TRIAL_NOTICE_EXIT_MS : TRIAL_NOTICE_ENTER_MS}ms ease-in-out forwards`
              }}
            >
              <AlertTriangle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              {/* חוק ברזל (A2 - Owner Product Decision, Trial Bar Corrections task):
                  הודעת "פג-תוקף" עודכנה למדויק לפי החלטת-בעלים - הטקסט
                  הישן כלל "אנא שדרג" (call-to-action לשדרוג) שהבעלים ביקש
                  להסיר במפורש, בלי תחליף/CTA אחר. הניסוח החדש רק מציין את
                  היעד בפועל (FREE) ללא הנעה-לפעולה. אנגלית תורגמה במבנה-
                  משפט מקביל (שתי פסוקיות: הניסיון הסתיים + המעבר ל-FREE),
                  גם בלי CTA. ה-branch השני (isExpiringSoon, "מסתיימת בעוד
                  X ימים") לא נגע כלל - המשימה ביקשה לתקן רק את הודעת-הפג-
                  תוקף. שינוי טקסט בלבד - לוגיקת-הזכאות/isTrialExpired/
                  effectivePlan לא נגעו. */}
              <span style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isTrialExpired
                  ? (isHebrew ? 'תקופת הניסיון הסתיימה, הועברת למסלול FREE' : "Your trial has ended — you've been moved to the FREE plan.")
                  : (isHebrew ? `תקופת הניסיון שלך מסתיימת בעוד ${trialDaysLeft} ימים!` : `Your trial period expires in ${trialDaysLeft} days!`)}
              </span>
              <button
                onClick={dismissTrialNotice}
                aria-label={isHebrew ? 'סגור' : 'Close'}
                style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '18px', height: '18px', minWidth: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, position: 'absolute', insetInlineEnd: '10px' }}
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          )}

          {/* חוק ברזל (Authenticated UI Coherence task, Duplicate Trial
              Messaging Removal): הטיקר של "ניסיון פעיל רגיל" (isPlainActiveTrial)
              הוסר מכאן - הוא היה מציג בדיוק אותו מספר-ימים-שנותרו
              ({isHebrew ? `${trialDaysLeft} ימים נותרו` : `${trialDaysLeft} days left`})
              שהבאדג' הקומפקטי (PlanIdentityBadge variant="compact",
              daysLeft) כבר מציג תמיד למעלה - כפילות אמיתית, לא רק דמיון,
              per the Owner's own explicit "Remove duplicate remaining-
              trial messaging when the compact plan badge already
              communicates the same state" instruction. הענף השני
              (isExpiringSoon/isTrialExpired, למעלה) לא הוסר - הוא נושא
              דחיפות/מעבר-מצב אמיתיים ("מסתיימת בעוד X ימים!"/"הניסיון
              הסתיים, הועברת ל-FREE") שהבאדג' השקט אינו מתקשר, לא רק ספירת-
              ימים. מנגנון-ה-state המשותף (trialNoticeVisible/
              trialNoticeShownRef/הטיימרים ב-useEffect למעלה) לא נגע כלל -
              יש לו כבר timeout ב-JS עצמאי (TRIAL_TICKER_DURATION_MS) שאינו
              תלוי ב-onAnimationEnd של הטיקר שהוסר, כך שההתנהגות של הענף
              האחר (המוצג) נשארת זהה ב-100%. משתנה isPlainActiveTrial עצמו
              הוסר גם הוא (הפך ל-dead code ללא ה-JSX שצרך אותו) - זהו
              שינוי-תצוגה בלבד, לא שינוי בלוגיקת-הזכאות/trialDaysLeft/
              effectivePlan עצמם. */}

          </div>
          )}
          {/* חוק ברזל (Option B task): סוגר כאן את dash-upper-section - הכותרת
              הסגולה + שורת הניווט + רשת ה-KPI (כשקיימת) הם כל התוכן שבתוכה.
              QuotesTab נשאר מחוץ למעטפת בכוונה, כדי שהיסטוריית ההצעות תמשיך
              להיות "כרטיס" עצמאי משלה בדיוק כפי שהייתה (ר' ה-div העוטף
              הקיים בתוך QuotesTab.jsx עצמו, לא נגוע) - שני כרטיסים לבנים
              עם border תואם, לא כרטיס-על אחד ענק. Trial Notice עצמו עבר
              להיות יליד אחרון בתוך dash-upper-section (position:absolute,
              ר' למעלה) - Zero-Layout-Shift Fix task. */}

          {/* חוק ברזל (החלטת בעלים מאושרת): הקטלוג הוצא מהתצוגה הראשית
              של הדשבורד ועבר לטאב עצמאי משלו ("קטלוג" - ר' activeTab
              === 'catalog' למטה). היסטוריית הצעות תופסת כעת את מלוא
              רוחב אזור התוכן הראשי - אין עוד עמודה שנייה/דו-טורי כאן. */}
          {activeTab === 'main' && !showQuoteForm && (
              <QuotesTab
                quotes={filteredQuotes}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                quoteSortField={quoteSortField}
                quoteSortDirection={quoteSortDirection}
                handleQuoteSort={handleQuoteSort}
                handleExportQuotes={handleExportQuotes}
                handleEditClick={handleEditClick}
                handleDuplicateQuote={handleDuplicateQuote}
                sendWhatsApp={sendWhatsApp}
                executeEmailSend={executeEmailSend}
                handleDeleteQuote={requestDeleteQuote}
                handleProtectedAction={handleProtectedAction}
                activeTooltip={activeTooltip}
                openDropdownId={openDropdownId}
                setOpenDropdownId={setOpenDropdownId}
                dropdownPos={dropdownPos}
                dropdownRef={dropdownRef}
                handleToggleDropdown={handleToggleDropdown}
                isHebrew={isHebrew}
                isLocalIsraeliBusiness={isLocalIsraeliBusiness}
                sym={sym}
                formatNum={formatNum}
                t={t}
                setPendingEmailQuote={setPendingEmailQuote}
                emailStatuses={emailStatuses}
                currency={currency}
              />
          )}

          {activeTab === 'main' && showQuoteForm && (
            <QuoteForm
              editingQuoteId={editingQuoteId}
              editingQuoteNumber={editingOriginalQuote?.quote_number ?? null}
              onSave={handleSaveQuote}
              onCancel={handleCancelEdit}
              clientName={clientName} setClientName={setClientName}
              clientEmail={clientEmail} setClientEmail={setClientEmail}
              clientPhone={clientPhone} setClientPhone={setClientPhone}
              clientType={clientType} setClientType={setClientType}
              clientTaxId={clientTaxId} setClientTaxId={setClientTaxId}
              clientAddress={clientAddress} setClientAddress={setClientAddress}
              quoteSubject={quoteSubject} setQuoteSubject={setQuoteSubject}
              attnName={attnName} setAttnName={setAttnName}
              attnRole={attnRole} setAttnRole={setAttnRole}
              currency={currency} setCurrency={setCurrency}
              quoteStatus={quoteStatus} setQuoteStatus={setQuoteStatus}
              validUntil={validUntil} setValidUntil={setValidUntil}
              discount={discount} setDiscount={setDiscount}
              terms={terms} setTerms={setTerms}
              defaultTerms={defaultTerms}
              defaultWarranty={defaultWarranty}
              warranty={warranty} setWarranty={setWarranty}
              notes={notes} setNotes={setNotes}
              items={items} setItems={setItems}
              sections={sections} addSection={addSection} renameSection={renameSection} removeSection={removeSection}
              projectName={projectName} setProjectName={setProjectName}
              services={services}
              clients={clients}
              isHebrew={isHebrew}
              isLocalIsraeliBusiness={isLocalIsraeliBusiness}
              t={t}
              sym={sym}
              formatNum={formatNum}
              subtotal={subtotal}
              discountAmount={discountAmount}
              taxAmount={taxAmount}
              totalAmount={totalAmount}
              taxRate={taxRate}
              addItem={addItem}
              removeItem={removeItem}
              handleItemChange={handleItemChange}
              handleAddFromCatalog={handleAddFromCatalog}
              canUseAttachments={entitlement.attachments}
              canUseProfessionalQuotes={entitlement.professionalQuotes}
              businessDefaultProfessionalUnit={getDefaultProfessionalUnit(professionalDomain)}
              duplicateItem={duplicateItem}
              canUseProfessionalQuoteReuse={entitlement.professionalQuoteReuse}
              handleProfessionalUnitChange={handleProfessionalUnitChange}
              addMeasurementRow={addMeasurementRow}
              removeMeasurementRow={removeMeasurementRow}
              handleMeasurementChange={handleMeasurementChange}
              toggleManualQuantityOverride={toggleManualQuantityOverride}
              handleManualQuantityChange={handleManualQuantityChange}
              toggleMeasurementPricingDriving={toggleMeasurementPricingDriving}
              addSpecificationRow={addSpecificationRow}
              handleSpecificationChange={handleSpecificationChange}
              removeSpecificationRow={removeSpecificationRow}
              onOpenPricingModal={() => setShowPricingModal(true)}
              quoteFiles={quoteFiles}
              setQuoteFiles={setQuoteFiles}
              allUserAttachments={allUserAttachments}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsTab
              filteredClients={filteredClients}
              clientSearchTerm={clientSearchTerm}
              setClientSearchTerm={setClientSearchTerm}
              clientSortField={clientSortField}
              clientSortDirection={clientSortDirection}
              handleClientSort={handleClientSort}
              setEditingClient={setEditingClient}
              handleDeleteClient={requestDeleteClient}
              onCreateClient={() => setIsCreatingClient(true)}
              quotes={quotes}
              isHebrew={isHebrew}
              currency={currency}
              t={t}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              t={t}
              isHebrew={isHebrew}
              handleSaveSettings={handleSaveSettings}
              bizName={bizName}
              setBizName={setBizName}
              bizTaxId={bizTaxId}
              setBizTaxId={setBizTaxId}
              bizEmail={bizEmail}
              setBizEmail={setBizEmail}
              bizPhone={bizPhone}
              setBizPhone={setBizPhone}
              currency={currency}
              setCurrency={setCurrency}
              isLocalIsraeliBusiness={isLocalIsraeliBusiness}
              bizAddress={bizAddress}
              setBizAddress={setBizAddress}
              bizLogoUrl={bizLogoUrl}
              setBizLogoUrl={setBizLogoUrl}
              bizPlan={bizPlan}
              effectivePlan={effectivePlan}
              isLifetime={isLifetime}
              displayIdentity={displayIdentity}
              isSuperAdmin={isSuperAdmin}
              defaultTerms={defaultTerms}
              defaultWarranty={defaultWarranty}
              setDefaultWarranty={setDefaultWarranty}
              setDefaultTerms={setDefaultTerms}
              professionalDomain={professionalDomain}
              setProfessionalDomain={setProfessionalDomain}
              canUseProfessionalQuotes={entitlement.professionalQuotes}
              isTrialExpired={isTrialExpired}
              trialDaysLeft={trialDaysLeft}
              setShowPricingModal={setShowPricingModal}
            />
          )}

          {activeTab === 'finances' && (
            <FinancesTab
              financeReportType={financeReportType}
              setFinanceReportType={setFinanceReportType}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              adminTotalQuotesCount={adminTotalQuotesCount}
              adminTotalRevenue={adminTotalRevenue}
              adminTotalExpenses={adminTotalExpenses}
              adminNetProfit={adminNetProfit}
              chartData={chartData}
              reportYear={reportYear}
              expenses={expenses}
              filteredExpensesForReport={filteredExpensesForReport}
              expenseDesc={expenseDesc}
              setExpenseDesc={setExpenseDesc}
              expenseAmount={expenseAmount}
              setExpenseAmount={setExpenseAmount}
              expenseCategory={expenseCategory}
              setExpenseCategory={setExpenseCategory}
              isRecurring={isRecurring}
              setIsRecurring={setIsRecurring}
              handleAddExpense={handleAddExpense}
              handleExportExpenses={handleExportExpenses}
              setEditingExpense={setEditingExpense}
              handleDeleteExpense={requestDeleteExpense}
              isHebrew={isHebrew}
              sym={sym}
              formatNum={formatNum}
              t={t}
            />
          )}

          {activeTab === 'catalog' && (
            <ServicesCatalog
              t={t}
              isHebrew={isHebrew}
              newServiceName={newServiceName}
              setNewServiceName={setNewServiceName}
              newServicePrice={newServicePrice}
              setNewServicePrice={setNewServicePrice}
              handleAddService={handleAddService}
              services={services}
              editingServiceId={editingServiceId}
              setEditingServiceId={setEditingServiceId}
              editServiceName={editServiceName}
              setEditServiceName={setEditServiceName}
              editServicePrice={editServicePrice}
              setEditServicePrice={setEditServicePrice}
              handleSaveEditedService={handleSaveEditedService}
              handleDeleteService={requestDeleteService}
              sym={sym}
              formatNum={formatNum}
            />
          )}

          {isSuperAdmin && activeTab === 'admin_clients' && (
            <ErrorBoundary isHebrew={isHebrew}>
              <AdminUsersTab
                t={t}
                isHebrew={isHebrew}
                allAccounts={allAccounts}
                filteredAdminAccounts={filteredAdminAccounts}
                adminSearchTerm={adminSearchTerm}
                setAdminSearchTerm={setAdminSearchTerm}
                handleSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
                liveTick={liveTick}
                handleExtendTrial14Days={handleExtendTrial14Days}
                setPendingLifetimeUser={setPendingLifetimeUser}
                handleToggleLifetime={handleToggleLifetime}
                setSelectedUserDetails={setSelectedUserDetails}
                handleOpenNewUsersModal={handleOpenNewUsersModal}
                lastSeenNewUsersTime={lastSeenNewUsersTime}
              />
            </ErrorBoundary>
          )}

          {/* Desktop Shell Height/Scroll Contract: the footer now renders
              here, as the last child of the scrolling content area, instead
              of as a separate flow sibling after the whole shell - with
              .dash-app-shell now height:100vh + overflow:hidden on desktop
              (see the media query above), anything left outside this
              scrolling chain would simply be clipped/invisible. Moving it
              here means it naturally appears when a user scrolls to the
              end of whichever tab's content, on both desktop and mobile
              (mobile is unaffected by the height/overflow change, so this
              is purely a DOM-location change there, not a behavior change -
              the page still scrolls normally as a whole on mobile). */}
          <footer className="no-print dash-footer" style={{ textAlign: 'center', padding: '16px', marginTop: '30px', borderTop: `1px solid ${NEON.border}`, color: NEON.textMuted, fontSize: '0.8rem' }}>
            <div style={{ marginBottom: '6px' }}>
              {isHebrew ? <>מערכת <BrandName /> - ניהול עסק והצעות מחיר</> : <><BrandName /> - Business & Quoting SaaS Platform</>}
            </div>
            <button onClick={() => setShowAccessibility(true)} style={{ background: 'none', border: 'none', color: NEON.violetLight, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AccessibilityIcon size={14} />
              {isHebrew ? 'הצהרת נגישות' : 'Assignment Statement'}
            </button>
          </footer>
        </div>
      </div>
        {/* closes dash-shell-main (topbar + dash-main-content) */}
        </div>
        {/* closes dash-shell-body (dash-sidebar + dash-shell-main) */}
      </div>
      </div>
      {/* closes the new ~980px-total-width centering wrapper (Round 2) */}

      {/* V2 Visual Transformation Pass, Round 2 (Owner-flagged remaining gap
          - the mobile nav had been untouched by every prior V2 round -
          reconciled here: active-item treatment now uses the same light-
          purple-tint pill language as the desktop sidebar's active nav
          item, instead of a bare color change. Every onClick/handler/tab-
          key/label/icon is byte-identical to before - visual-only. */}
      {/* V2 Mobile Nav Polish (Owner real-device screenshots) + Authenticated
          App Consolidation task §8 further compaction: compact per-item
          labels (Business Settings -> Settings, mobile-only - the full
          t.settingsNav label is unchanged everywhere else, e.g. the
          sidebar), whiteSpace:'nowrap' on every label to stop awkward
          multi-line wrapping, env(safe-area-inset-bottom) added on top of
          the existing base (not replacing it) so the bar clears a real
          device's home-indicator/gesture-bar area. §8 further reduced the
          bar's own vertical footprint (container padding 6px->5px, button
          padding 5px/8px->4px/6px, icon 17->16px, icon-label gap 2px->1px)
          - a real, additive height reduction (~6px total), not a re-layout:
          the icon-above-label stack itself was deliberately kept (not
          switched to icon-beside-label) because six buttons across a ~360-
          390px viewport have far less horizontal than vertical room to
          spare, and a side-by-side layout risks wrapping the longer HE/EN
          labels ("הגדרות"/"Finances") - verified against the longest labels
          in both languages before choosing this direction, per the task's
          own "check long HE and EN labels" requirement. Every handler/tab-
          key/destination/label-text is unchanged - presentation only. */}
      {/* חוק ברזל (Authenticated UI Coherence task, Mobile Navigation
          Redesign): popover קומפקטי ל-"עוד" (Settings+Catalog) - נפתח מעל
          שורת-הניווט (position:'fixed', bottom מחושב מגובה השורה עצמה +
          safe-area), נסגר אוטומטית בבחירת יעד. role="menu"/aria-orientation
          על המיכל, role="menuitem" על כל כפתור - תבנית-נגישות סטנדרטית
          לתפריט קופץ, לא רק div+onClick סתמי. */}
      {showMobileMoreMenu && (
        <div
          role="menu"
          aria-label={isHebrew ? 'עוד' : 'More'}
          style={{ position: 'fixed', insetInlineStart: '10px', insetInlineEnd: '10px', bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))', background: NEON.bgElevated, border: `1px solid ${NEON.border}`, borderRadius: RADIUS.lg, boxShadow: '0 -6px 20px -4px rgba(31,27,46,0.22)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 9998 }}
        >
          <button
            role="menuitem"
            onClick={() => { setActiveTab('settings'); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: activeTab === 'settings' ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '10px 12px', color: activeTab === 'settings' ? NEON.violet : NEON.textPrimary, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', textAlign: isHebrew ? 'right' : 'left' }}
          >
            <SettingsIcon size={17} strokeWidth={2.2} />
            {isHebrew ? 'הגדרות' : 'Settings'}
          </button>
          <button
            role="menuitem"
            onClick={() => { setActiveTab('catalog'); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: activeTab === 'catalog' ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '10px 12px', color: activeTab === 'catalog' ? NEON.violet : NEON.textPrimary, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', textAlign: isHebrew ? 'right' : 'left' }}
          >
            <Package size={17} strokeWidth={2.2} />
            {t.catalogNav}
          </button>
          {/* Task G (Owner-authorized, Mobile Sign Out): this menu had no
              account/session action at all before - Settings/Catalog above
              are byte-identical to before, untouched. Identity line reuses
              the exact same real field/derivation the desktop sidebar's own
              dash-sidebar-user block already uses (session.user.email,
              first-letter avatar) - no new/fabricated data. The Sign Out
              button below reuses the EXACT SAME mechanism the desktop
              sidebar's sign-out button already uses: setShowSignOutModal(
              true) opens the one real <SignOutModal/> already rendered once
              near dash-shell-outer, whose onConfirm calls the one real
              handleSignOut (supabase.auth.signOut()) - same confirmation
              UX, same session-clear (the existing SIGNED_OUT branch of
              onAuthStateChange further up this file), same post-logout
              destination as desktop. No second/parallel logout path was
              written. */}
          <div style={{ borderTop: `1px solid ${NEON.border}`, margin: '4px 2px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', padding: '8px 12px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: NEON.gradient, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '800', flexShrink: 0 }}>
              {(session.user.email || '?').trim().charAt(0).toUpperCase()}
            </div>
            <div
              style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.76rem', fontWeight: '700', color: NEON.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: isHebrew ? 'right' : 'left' }}
              title={session.user.email}
            >
              {session.user.email}
            </div>
          </div>
          <button
            role="menuitem"
            className="dash-mobile-signout-btn"
            onClick={() => { setShowMobileMoreMenu(false); setShowSignOutModal(true); }}
            aria-label={isHebrew ? 'התנתקות' : 'Sign out'}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', minHeight: '44px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: RADIUS.sm, padding: '10px 12px', color: NEON.red, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', textAlign: isHebrew ? 'right' : 'left' }}
          >
            <LogOut size={17} strokeWidth={2.2} />
            {isHebrew ? 'התנתקות' : 'Sign out'}
          </button>
        </div>
      )}
      {showMobileMoreMenu && (
        <div
          className="no-print"
          onClick={() => setShowMobileMoreMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'transparent' }}
          aria-hidden="true"
        />
      )}

      {/* חוק ברזל (Authenticated UI Coherence task, Mobile Navigation
          Redesign): 6 יעדים -> 5 (Owner-required max), per Owner's own
          explicit suggestion - Settings+Catalog (התדירות-הנמוכה יותר בין
          ששת היעדים המקוריים) אוחדו ל-"עוד" יחיד (popover למעלה). New
          Quote נשאר בדיוק כפי שהיה - הכפתור הבולט, לא הוזז. Quotes/Clients/
          Finances נשארו יעדים ישירים ללא שינוי - שום התנהגות/handler/
          activeTab-target לא השתנו, רק ה-IA (מבנה-הניווט) עצמו. */}
      <div className="no-print mobile-bottom-nav" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, width: '100%', background: NEON.bgElevated, color: NEON.textPrimary, justifyContent: 'space-around', padding: '5px 4px calc(5px + env(safe-area-inset-bottom, 0px))', zIndex: 9998, boxShadow: '0 -4px 16px -6px rgba(31,27,46,0.12)', borderTop: `1px solid ${NEON.border}`, boxSizing: 'border-box' }}>
        <button onClick={() => { setActiveTab('main'); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }} style={{ background: activeTab === 'main' && !showQuoteForm ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: activeTab === 'main' && !showQuoteForm ? NEON.violet : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
          <FileText size={16} style={{ marginBottom: '1px' }} />
          {t.quotesNav}
        </button>
        <button onClick={() => { setActiveTab('clients'); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }} style={{ background: activeTab === 'clients' ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: activeTab === 'clients' ? NEON.violet : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
          <Users2 size={16} style={{ marginBottom: '1px' }} />
          {t.clientsNav}
        </button>
        <button onClick={() => { setActiveTab('finances'); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }} style={{ background: activeTab === 'finances' ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: activeTab === 'finances' ? NEON.violet : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
          <BarChart3 size={16} style={{ marginBottom: '1px' }} />
          {t.financesNav}
        </button>
        <button
          onClick={() => setShowMobileMoreMenu(prev => !prev)}
          aria-haspopup="true"
          aria-expanded={showMobileMoreMenu}
          style={{ background: (showMobileMoreMenu || activeTab === 'settings' || activeTab === 'catalog') ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: (showMobileMoreMenu || activeTab === 'settings' || activeTab === 'catalog') ? NEON.violet : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', whiteSpace: 'nowrap' }}
        >
          <MoreHorizontal size={16} style={{ marginBottom: '1px' }} />
          {isHebrew ? 'עוד' : 'More'}
        </button>
        <button onClick={() => { setShowMobileMoreMenu(false); handleCreateNewQuoteClick(); }} style={{ background: NEON.gradient, border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', boxShadow: NEON.glowSoft, whiteSpace: 'nowrap' }}>
          <PlusCircle size={16} strokeWidth={2.5} style={{ marginBottom: '1px' }} />
          {isHebrew ? 'חדש' : 'New'}
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(248, 113, 113, 0.35)', color: NEON.red, margin: '20px 0' }}>
          <h3>{this.props.isHebrew ? 'שגיאה בטעינת הרכיב' : 'Component Loading Error'}</h3>
          <p style={{ fontSize: '0.85rem' }}>{this.props.isHebrew ? 'אירעה שגיאה זמנית בהצגת הנתונים. אנא רענן את העמוד.' : 'An error occurred while loading. Please refresh the page.'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}