// ==============================================================================
// 🚨 חוק ברזל קשוח (Dashboard.jsx): הודעות צפות מודרניות במרכז המסך ושמירה על יציבות.
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, rootRecoveryIntent, consumeRootRecoveryIntent, consumeRootSignupIntent, isLocalTestMode } from '../shared/supabase';
import ProFlowLogo from '../components/ProFlowLogo';
import BrandName from '../components/BrandName';
import AccessibilityModal from '../components/AccessibilityModal';
import AIChatWidget from '../AIChatWidget';
import { AI_NAVIGATE_EVENT } from '../utils/safeNavigation';
import { computeQuoteWorkflowContext } from '../utils/quoteWorkflowContext';
import { formatHeaderDate } from '../utils/headerDateFormat';
import { diagLog, diagBoot, idPrefix, installLifecycleDiag } from '../utils/returnDiag';
import useQuoteDraftPersistence from '../hooks/useQuoteDraftPersistence';
import { allowDraftWrites, decideRestore, suppressDraftWrites, flushAllDrafts, formHash, newDraftId, serverFingerprintFromQuote } from '../utils/quoteDraft';
import { getBlobStore } from '../utils/draftAttachments';
import { getPristineQuoteFormState, projectNameForPersist } from '../utils/quoteFormState';
import { DraftConflictModal, DraftRecoveredBanner, DraftStorageWarning, DraftAttachmentsWarning } from '../components/QuoteDraftNotices';
import PlanIdentityBadge from '../components/PlanIdentityBadge';
import { isHebrewEnv, formatDateLocal, calculateQuoteFinancials, getMarketRoutingCorrection, getPostRecoveryLoginLang } from '../utils/regionConfig';
import { isProfessionalPreviewEnabled } from '../config/professionalPreviewAllowlist';
import { isQuoteImmutable } from '../utils/quoteLock';
import { computeEffectivePlan } from '../utils/planEntitlements';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import { shouldShowUpgradeCta } from '../utils/planCatalog';
import { normalizeAuthError } from '../utils/authErrorClassification';
import { classifyDashboardActionError } from '../utils/dashboardActionErrorClassification';
import { formatQuoteFallback, getQuoteOrderSortKey } from '../utils/quoteNumber';
import { quoteMatchesSearch } from '../utils/quoteSearch';
import { formatMoney, formatMoneyForCurrency } from '../utils/money';
import { compareClients } from '../utils/clientSort';
import { withActiveQuantities, getActiveQuantity, sumMeasurementAreas, getRecommendedPricingMethod, isMeasurableUnit, resolveCalculationMethod, computeMeasurementValue, normalizeSpecificationRows } from '../utils/professionalQuoteItem';
import { excludeUntouchedPlaceholderItems } from '../utils/structuredQuoteItemPersistence';
import { getBusinessProfileGateMessage } from '../utils/businessProfileCompleteness';
import { computeTransparentTrimBounds } from '../utils/logoTrim';
import { getDashboardNavCapabilities } from '../utils/dashboardNavCapabilities';
import { getFunctionErrorMessage } from '../utils/functionError';
import { classifyQuoteEmailError } from '../utils/quoteEmailErrorClassification';
import ExcelJS from 'exceljs';

import PricingModal from '../components/PricingModal';
import EditClientModal from '../components/EditClientModal';
import EditExpenseModal from '../components/EditExpenseModal';
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
import { AuthenticatedSidebarFrame } from '../components/AuthenticatedShellFrames';
import AdminDestinationHost from '../components/AdminDestinationHost';
import AdminSidebarNav from '../components/AdminSidebarNav';
import { ADMIN_NAV_GROUPS, ADMIN_SECTION_IDS, DEFAULT_ADMIN_SECTION } from '../utils/adminNavGroups';
// חוק ברזל: ה-Dashboard (ה"קליפה" של בעל העסק - ניווט/KPI/היסטוריית הצעות/
// טאבים) עבר לערכת הנושא הבהירה שאושרה ע"י הבעלים (LIGHT), דרך אותה טכניקת
// alias-at-import שכבר משמשת ב-QuotesTab.jsx/ServicesCatalog.jsx - שינוי
// שורת ה-import היחיד הזה משנה את *כל* השימושים הקיימים ב-NEON.xxx בקובץ,
// בלי לגעת בכל אחד מהם בנפרד. AdminUsersTab.jsx (Super Admin) מייבא NEON
// האמיתי (הכהה) בעצמו ונשאר כך בכוונה - עיצובו מחדש אושר בעיקרון בנפרד
// ואינו בתחום המשימה הזו.
import { LIGHT as NEON, NEON as DARK_ACCENT, FONT_HE, FONT_EN, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW, SHELL } from '../theme/neonTheme';
import {
  AlertTriangle, Shield, LogOut,
  PlusCircle, Flame,
  Accessibility as AccessibilityIcon, Sparkles, Eye,
  MessageCircle, MoreHorizontal
} from 'lucide-react';

// IRON-ILS-001: formatNum is now NON-MONEY only (quantities/measurements). Every displayed money
// amount goes through formatMoneyDisplay (defined in the component, currency-keyed) ->
// utils/money.js formatMoneyForCurrency: ILS => whole shekel half-up ".00"; others full precision.
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
// Stacked, centered Header date/time (DATE over HH:mm:ss). Mounts only when
// the date/time slot replaces the greeting, and ticks every second itself.
function HeaderClock({ country, isHebrew }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <span className="dash-header-date">{formatHeaderDate(now, country)}</span>
      <span className="dash-header-time">{now.toLocaleTimeString(isHebrew ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
    </>
  );
}

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
  // Auth Lifecycle Forensic Audit (2026-09-09): styling used to be decided
  // by `resetMsg.includes('Error')`, which never matches a Hebrew message
  // (the English substring "Error" is never present) - a real, confirmed
  // bug that rendered genuine Hebrew failures with success/green styling.
  // This explicit flag, set alongside the message from the same
  // normalizeAuthError() result, replaces that substring-sniffing.
  const [resetMsgIsError, setResetMsgIsError] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  // Password Recovery End-to-End Fix, Wave 1, §227/§228: the recovery form
  // previously had only a single password field with no confirmation - a
  // typo would save silently with no way for the user to notice before
  // submitting. Added per this task's own explicit required behavior
  // ("new password, confirm password... validate: non-empty, match").
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [recoveryUpdateMsg, setRecoveryUpdateMsg] = useState('');
  // Same substring-sniffing bug as resetMsgIsError above, same fix.
  const [recoveryUpdateMsgIsError, setRecoveryUpdateMsgIsError] = useState(false);
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
  // Auth Final Blockers task (2026-09-09): live-reproduced a real, serious
  // login defect - after a genuine interactive sign-in (not a page reload),
  // loadData() sometimes never fired at all (zero business_settings/quotes/
  // etc. network calls for 30+ seconds), leaving the user stuck on the
  // generic pre-load dashboard shell indefinitely; a manual reload always
  // recovered correctly. Root cause: the previous onAuthStateChange handler
  // decided "is this a new user" via a side effect (`isNewUser = true`)
  // mutated *inside* the setSession(prevSession => ...) updater function -
  // an anti-pattern that is fragile under React 18/StrictMode, which may
  // invoke a state-updater function more than once per dispatch to check
  // for purity. A ref-based check is immune to that: refs are never
  // double-invoked the way updater functions are, so this reliably loads
  // data exactly once per distinct real user id, on every fresh login.
  const lastAccessTokenRef = useRef(null);
  const lastLoadedUserIdRef = useRef(null);
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
  // חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08, Owner
  // mandate: "No more inference-based Lifetime model."): קריאה ישירה של
  // business_settings.is_lifetime (migration 20260908000000) - Lifetime
  // כבר לא נגזר מ-trial_ends_at===null. ר' src/utils/accountEntitlement.js
  // לפירוט המלא.
  const [bizIsLifetime, setBizIsLifetime] = useState(false);

  const [defaultTerms, setDefaultTerms] = useState(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
  const [defaultWarranty, setDefaultWarranty] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [adminAccountsStatus, setAdminAccountsStatus] = useState('loading');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [activeTooltip] = useState({ quoteId: null, action: null });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  // חוק ברזל (UI Stability + Hot Quote Forensic Check task, 2026-09-08,
  // "Quote History — Stable Scroll Contract"): מודדים את הגובה האמיתי
  // המרונדר של dash-upper-section (ברכה/סטטיסטיקות/הצעה-חמה) כדי ש-
  // QuotesTab.jsx יוכל למקם את שורת-הכותרת/חיפוש/סינון שלו כ-position:
  // sticky בדיוק מתחתיו, ולא מעליו/חופף לו - ResizeObserver, לא מספר-קסם
  // קבוע, כי הגובה משתנה (הצעה חמה מורחבת/מכווצת, אורך-שם-עסק, HE מול EN,
  // Trial Notice). דסקטופ בלבד בפועל (ר' ה-CSS media query ב-QuotesTab.jsx
  // ו-.dash-upper-section למטה) - במובייל הערך הזה פשוט לא נצרך.
  const upperSectionRef = useRef(null);
  const upperSectionObserverRef = useRef(null);
  const [upperSectionHeight, setUpperSectionHeight] = useState(0);
  // TEKANGO — Sticky Filter Row Overlap Root-Cause Fix (2026-09-19): the
  // prior `useEffect(..., [activeTab])`-keyed measurement (both the
  // getBoundingClientRect pass and the ResizeObserver attach) assumed
  // .dash-upper-section is present in the DOM by the time those effects
  // first run. Live testing on the canonical TEST server proved that's
  // false: two EARLIER conditional early-returns in this same component
  // (`isInitializing || isPasswordRecoveryMode || !session`, and
  // `needsRegionChoice` - the region-selection screen) can render a
  // completely different tree on the first commit(s), during which
  // upperSectionRef.current is null. Once those clear and the real
  // dashboard JSX renders .dash-upper-section for the first time,
  // `activeTab` has not changed value, so the `[activeTab]`-keyed effects
  // never re-run and the ref is never (re)measured - confirmed live via a
  // temporary debug global showing `hasEl: false` at the moment the old
  // effect fired. A callback ref sidesteps this whole class of ordering
  // bug entirely: it fires the instant React actually attaches the node,
  // regardless of which gate delayed that first real mount, and (since
  // .dash-upper-section itself never unmounts again after that - it is
  // unconditional on `!isSuperAdmin`) the ResizeObserver it attaches stays
  // live for the rest of the session, correctly catching later height
  // changes (Hot Quote banner, Trial Notice) that the old per-activeTab
  // recreate-on-every-change pattern could otherwise miss between
  // attachments.
  // A second, independently-confirmed defect on top of the mount-timing one
  // above: even once correctly attached, this ResizeObserver instance does
  // NOT reliably deliver follow-up callbacks when the section's height
  // settles shortly after attach (Hot Quote banner/Trial Notice finishing
  // their own async render) - live-reproduced by switching tabs away and
  // back (captured 94px, real height already 124px, stayed wrong 3+
  // seconds with zero self-correction) and again right here on a cold
  // mount. Root cause of the missed callbacks themselves not conclusively
  // identified (candidates: Chromium/CDP-automation-specific coalescing,
  // or an interaction with this element's own `transition: height` inline
  // style - not established either way) - rather than depend on a
  // mechanism proven unreliable twice, a bounded set of direct
  // getBoundingClientRect re-checks across the window late content
  // typically settles in closes the gap without waiting on the observer.
  const measureUpperSection = useCallback((el) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) setUpperSectionHeight((prev) => (prev === Math.round(h) ? prev : Math.round(h)));
  }, []);
  const setUpperSectionNode = useCallback((el) => {
    upperSectionRef.current = el;
    if (upperSectionObserverRef.current) {
      upperSectionObserverRef.current.disconnect();
      upperSectionObserverRef.current = null;
    }
    if (!el) return;
    measureUpperSection(el);
    [100, 300, 600, 1200, 2500].forEach((ms) => setTimeout(() => measureUpperSection(upperSectionRef.current), ms));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const oh = entries[0]?.contentRect?.height;
      if (typeof oh === 'number' && oh > 0) setUpperSectionHeight((prev) => (prev === Math.round(oh) ? prev : Math.round(oh)));
    });
    observer.observe(el);
    upperSectionObserverRef.current = observer;
  }, [measureUpperSection]);

  const [hotQuoteIndex, setHotQuoteIndex] = useState(0);
  // חוק ברזל (Authenticated UI Coherence task, Dashboard Header Compression):
  // מצב תצוגה טהור (לא לוגיקה עסקית) - האם ההתראה הדקה של Hot Quote
  // מורחבת (חושפת טקסט מלא, לא חתוך). מתאפס אוטומטית בכל רוטציה (ר'
  // ה-useEffect הקיים שמקדם hotQuoteIndex) כדי שמצב-הרחבה לא "ידבק"
  // להצעה-חמה הבאה שברוטציה, שהיא לרוב הצעה שונה לגמרי.
  // חוק ברזל (Authenticated UI Coherence task, Mobile Navigation Redesign):
  // ניווט-מובייל-תחתון צומצם מ-6 יעדים ל-5 (Owner-required limit) - Settings
  // ו-Catalog (שני היעדים בתדירות-הנמוכה יותר, לפי המבנה הקיים כבר - שניהם
  // כבר טאבים "שקטים" יותר מ-Quotes/Clients/Finances) אוחדו ליעד "עוד"/
  // "More" יחיד, שנפתח כ-popover קומפקטי מעל שורת-הניווט - לא הוסתרו, רק
  // אורגנו מחדש. New Quote נשאר בדיוק כפי שהיה - בולט, לא הוזז לתוך "עוד".
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [shellDrawerOpen, setShellDrawerOpen] = useState(false);
  const closeShellDrawer = useCallback(() => setShellDrawerOpen(false), []);

  // TEKANGO — Owner Header Reference Correction task (2026-09-18): the ONE
  // AI Chat entry point, rendered inside the canonical business Header
  // (dash-upper-section's own rich card, now on every business screen - see
  // its own call site further below). Defined once here so there is never a
  // second, drifting implementation - every render site shares this exact
  // function/handler/icon/label. Same open-proflow-ai-chat CustomEvent
  // AIChatWidget.jsx has always listened for - no new chat mechanism,
  // purely a placement change.
  // Header Package/Chat Order Correction task (2026-09-18): gained a
  // visible label - "Do not use icon-only Chat in this Header" - the exact
  // same HE/EN copy ("צ׳אט AI"/"AI Chat") this project's own product copy
  // already used for this identical action in every prior location
  // (the now-retired sidebar/topbar buttons), not new wording.
  const renderHeaderAIChatButton = () => (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('open-proflow-ai-chat'))}
      className="dash-header-ai-btn"
      title={isHebrew ? 'פתיחת צ׳אט AI' : 'Open AI Chat'}
      aria-label={isHebrew ? 'פתיחת צ׳אט AI' : 'Open AI Chat'}
    >
      <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        <MessageCircle size={16} strokeWidth={2.2} />
        <Sparkles size={8} strokeWidth={2.5} style={{ position: 'absolute', top: '-3px', [isHebrew ? 'left' : 'right']: '-4px', color: '#f0abfc' }} />
      </span>
      <span>{isHebrew ? 'צ׳אט AI' : 'AI Chat'}</span>
    </button>
  );

  // TEKANGO — Dynamic Greeting + Inner Table Scrollbar Top-Anchor task
  // (2026-09-18), Part 1, CORRECTED (Owner fresh evidence: the first
  // attempt below - opacity/transform driven by React state, triggered via
  // a single requestAnimationFrame after mount - was not visibly
  // perceptible live). Root cause: React's initial commit (opacity:0/
  // translateY) and the RAF callback flipping it to opacity:1 both land
  // within the same ~16ms window in practice, so the browser often never
  // actually PAINTS the "before" frame at all before the transition target
  // changes - a well-known React/CSS-transition race, not a CSS bug.
  // Fixed by switching to a real CSS @keyframes animation (see
  // .dash-header-greeting-text below), which the browser runs from its own
  // 0% frame unconditionally the moment the element is inserted into the
  // DOM - no React-render-timing race is possible. Combined with `key`-
  // forced remounts (see the JSX below) so the SAME animation genuinely
  // re-triggers, cleanly, exactly twice per page load (greeting enters,
  // then date/time enters when it takes over) - never a third time, never
  // looping.
  // Deliberately still does NOT introduce any new first-login/returning-
  // user inference (no localStorage read, no new heuristic) - the existing
  // greeting text/logic (a plain, always-shown "ברוך שובך"/"Welcome back"
  // string) is used completely unchanged - "GREETING SEMANTICS: PRESERVED"
  // by construction.
  const [showGreeting, setShowGreeting] = useState(true);
  // The 10s Welcome-back window starts when the greeting is actually
  // RENDERED (h1 ref callback), not at Dashboard mount - the header can
  // appear seconds after mount while auth/data load, which would shorten
  // the visible time.
  const greetingTimerRef = useRef(null);
  const greetingRef = useCallback((node) => {
    if (node && greetingTimerRef.current === null) {
      greetingTimerRef.current = setTimeout(() => setShowGreeting(false), 10000);
    }
  }, []);
  useEffect(() => () => clearTimeout(greetingTimerRef.current), []);
  // The seconds clock lives in its own component (HeaderClock) so its 1s tick
  // re-renders only the date/time block, not the whole Dashboard.
  const headerDateTimeText = <HeaderClock country={bizCountry} isHebrew={isHebrew} />;
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
  // IRON-ILS-001: single money presentation path (account market authority: Local => ILS whole-shekel .00).
  const formatMoneyDisplay = (val, cur) => formatMoneyForCurrency(val, cur || (isLocalIsraeliBusiness ? 'ILS' : currency));

  // Keyed on session PRESENCE, not object identity: a token refresh (new object, same signed-in
  // state) must not push another history entry. Behavior at sign-in/sign-out is unchanged.
  const hasSession = !!session;
  useEffect(() => {
    if (hasSession) {
      window.history.pushState({ dashboard: true }, '', window.location.href);

      const handlePopState = () => {
        window.history.pushState({ dashboard: true }, '', window.location.href);
        setShowSignOutModal(true);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [hasSession]);

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
    diagLog('market-routing-effect-run', { willRedirect: !!correctLang });
    if (correctLang) {
      diagLog('market-routing-redirect', { to: correctLang });
      window.location.href = '/dashboard?lang=' + correctLang;
    }
  }, [session, isInitializing, isPasswordRecoveryMode, needsRegionChoice, settingId, bundleIsHebrew, isHebrew]);

  // TEKANGO Admin V1 (Task 2): the 10-minute "liveTick" re-render interval
  // that used to live here existed only to keep the old Admin table's
  // last-sign-in-recency "online" dot ticking over live - that signal is
  // removed outright (Owner-binding rule against "active now" inference),
  // so the interval that forced re-renders for it is genuinely dead work
  // now, not just an unused variable, and is removed rather than kept.

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

  // Password Recovery End-to-End Fix, Wave 1, §227/§228: a recovery link
  // that Supabase itself already rejects (already used, expired, malformed)
  // never carries type=recovery at all - it comes back as {redirectTo}
  // ?error=access_denied&error_code=otp_expired&... with NO session ever
  // established. Before this fix, that case fell straight through to a
  // blank, unexplained ordinary login screen - technically "safe" (no
  // crash, no raw provider error) but not the curated bilingual messaging
  // this task explicitly requires. Reuses the exact same curated text
  // already proven for the sibling case (a stale recovery session that
  // reaches updateUser() and fails there) so the user sees one consistent
  // message regardless of which of the two ways an invalid/expired link
  // can fail. Kept as its own small effect (rather than folded into the
  // big mount-only auth-init effect below) so it can correctly declare its
  // one real dependency, bundleIsHebrew, instead of suppressing lint.
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    // Password Recovery Fresh-Link Root-Landing Hardening (2026-09-15 task):
    // rootRecoveryIntent (src/shared/supabase.js) is the fallback source for
    // exactly one case - this exact Dashboard instance was mounted via the
    // "/" route (AppLocal.jsx/AppGlobal.jsx) because a fresh recovery link's
    // callback landed there instead of /dashboard, and by the time this
    // component's effect runs, Supabase's own client may already have
    // consumed/cleared window.location.hash. The direct /dashboard?lang=he|en
    // case (hash/search still present) is completely unchanged - this only
    // adds an OR-fallback, never removes the existing URL-based check.
    const isRecoveryLink = hash.includes('type=recovery') || search.includes('type=recovery') || rootRecoveryIntent.isRecovery;
    const isErrorRedirect = hash.includes('error_code=') || search.includes('error_code=') || hash.includes('error=') || search.includes('error=') || rootRecoveryIntent.isError;
    if (isRecoveryLink) {
      setIsPasswordRecoveryMode(true);
    } else if (isErrorRedirect) {
      setAuthError(bundleIsHebrew
        ? '❌ קישור השחזור אינו תקין או שפג תוקפו. יש לבקש קישור חדש.'
        : '❌ This recovery link is invalid or has expired. Please request a new one.');
    }
    // Cleared unconditionally (whether it was used or not) so a later
    // remount/navigation within the same page load can never re-trigger
    // recovery mode from stale boot-time state.
    consumeRootRecoveryIntent();
    // Signup Callback Fix (2026-09-16): same one-shot-clear rationale as
    // consumeRootRecoveryIntent() immediately above, for the independent
    // signup-intent marker (src/shared/supabase.js's rootSignupIntent) - a
    // later "/" navigation within the same page load must not re-trigger
    // mounting Dashboard from stale boot-time state. Does not read or touch
    // any recovery-related variable.
    consumeRootSignupIntent();
  }, [bundleIsHebrew]);

  useEffect(() => {
    const search = window.location.search;

    const params = new URLSearchParams(search);
    if (params.get('signup') === 'true') {
      setIsSignUp(true);
    }

    const initAuth = async () => {
      diagBoot();
      installLifecycleDiag();
      setIsInitializing(true);
      const { data: { session } } = await supabase.auth.getSession();
      lastAccessTokenRef.current = session?.access_token;
      diagLog('init-auth', { hasSession: !!session });
      setSession(session);
      if (session?.user?.id) {
        lastLoadedUserIdRef.current = session.user.id;
        await loadData(session.user.id, session.user.email, session.user.user_metadata);
      }
      setIsInitializing(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        diagLog('auth-event', {
          event,
          prevUser: idPrefix(lastLoadedUserIdRef.current),
          nextUser: idPrefix(newSession?.user?.id),
          tokenChanged: newSession?.access_token !== lastAccessTokenRef.current,
          setSessionCalled: true,
          loadDataTriggered: !!(newSession?.user?.id && newSession.user.id !== lastLoadedUserIdRef.current),
        });
        lastAccessTokenRef.current = newSession?.access_token;
        if (newSession?.user?.id) allowDraftWrites(newSession.user.id);
        // Returning to the app makes supabase-js re-emit SIGNED_IN for the SAME session.
        // Replacing the session object then re-ran every [session] effect (incl. a
        // history.pushState per return). Keep the existing object when user id AND access
        // token are unchanged; a real token refresh, user switch or sign-out still updates.
        setSession(prev => (
          prev?.user?.id && prev.user.id === newSession?.user?.id && prev.access_token === newSession?.access_token
            ? prev
            : newSession
        ));
        // Ref-based check (see lastLoadedUserIdRef's own declaration comment
        // above for why this replaced a fragile setSession-updater side
        // effect): synchronous and immune to React double-invoking anything,
        // so this reliably fires exactly once per distinct real user id.
        if (newSession?.user?.id && newSession.user.id !== lastLoadedUserIdRef.current) {
          lastLoadedUserIdRef.current = newSession.user.id;
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
        // Unexpected expiry keeps the durable draft on disk (only an EXPLICIT logout purges it, see handleSignOut).
        // Flush now: the state update above only takes effect on the NEXT render, so the persistence hook still holds the
        // live editor state and the last debounced edits are written before the editor is disabled.
        flushAllDrafts();
        diagLog('auth-event', { event, explicit: explicitLogoutRef.current });
        lastLoadedUserIdRef.current = null;
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

  // TEMP diagnostics: how often does the session OBJECT change identity, and was it
  // the same user + same token (a redundant re-render) or a real change?
  const prevSessionDiagRef = useRef(null);
  useEffect(() => {
    const prev = prevSessionDiagRef.current;
    if (prev !== null || session) {
      diagLog('session-object-changed', {
        sameUser: prev?.user?.id === session?.user?.id,
        sameToken: prev?.access_token === session?.access_token,
      });
    }
    prevSessionDiagRef.current = session;
  }, [session]);

  useEffect(() => {
    const hotQuotes = quotes.filter(q => (q.view_count || 0) >= 3 && q.status !== 'approved' && q.status !== 'paid');
    if (hotQuotes.length > 1) {
      const interval = setInterval(() => {
        setHotQuoteIndex(prev => (prev + 1) % hotQuotes.length);
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
  
  // Default: newest registration first (created_at desc) - see the
  // filteredAdminAccounts comment above for why this replaced the prior
  // 'default_online' (last-sign-in-recency) default.
  const [sortField, setSortField] = useState('created_at');
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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  // AI Chat workflow-awareness wiring (AI Chat Hardening overnight
  // continuation, Track B/C): the item-wizard's own open/add-vs-edit/
  // professional-vs-simple/measurements-present state, bubbled up from
  // QuoteForm.jsx's own private state via the new onWizardStateChange
  // callback below. Everything else the workflow snapshot needs
  // (editingQuoteId/clientName/projectName/sections/quoteStructureMode/
  // items) is already Dashboard-owned lifted state - see quoteWorkflowContext
  // just below showQuoteForm's own declaration.
  const [itemWizardState, setItemWizardState] = useState(null);

  // AI Chat safe-navigation wiring (AI Chat Hardening overnight task,
  // Track H - "action guidance, never silent action"): the AI can only ever
  // suggest one of a fixed, allowlisted set of destination ids (see
  // src/utils/safeNavigation.js / supabase/functions/chat-ai/navigation.ts);
  // this effect is the ONE place that maps a user-clicked suggestion to this
  // component's own existing tab-switch/modal-open state - it never mutates
  // any quote/client/business data itself.
  useEffect(() => {
    function handleAiNavigate(e) {
      const action = e?.detail?.action;
      switch (action) {
        case 'open_quote_history':
          setEditingQuoteId(null);
          setIsCreatingQuote(false);
          setActiveTab('main');
          break;
        case 'open_clients':
          setActiveTab('clients');
          break;
        case 'open_business_settings':
          setActiveTab('settings');
          break;
        case 'open_catalog':
          setActiveTab('catalog');
          break;
        case 'open_finances':
          setActiveTab('finances');
          break;
        case 'open_plan_information':
          setShowPricingModal(true);
          break;
        case 'open_selected_quote': {
          const quoteId = e?.detail?.meta?.quoteId;
          const quote = quotes.find((q) => q.id === quoteId);
          if (quote) {
            setActiveTab('main');
            handleEditClick(quote);
          } else {
            setAlertModalMsg(isHebrew ? 'ההצעה שנבחרה כבר אינה זמינה.' : 'The selected quote is no longer available.');
          }
          break;
        }
        default:
          break;
      }
    }
    window.addEventListener(AI_NAVIGATE_EVENT, handleAiNavigate);
    return () => window.removeEventListener(AI_NAVIGATE_EVENT, handleAiNavigate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, isHebrew]);

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
  // חוק ברזל (Smart Quote Structure-First UX Correction task, Locked
  // Decision 1/9): מבחין בין "עדיין לא הוחלט" (null - חובה להציג את בורר-
  // המבנה לפני פריט ראשון) לבין "נבחר Regular במפורש" (sections.length===0
  // לבד לא מספיק להבחנה הזו - שתי המצבים חולקים sections ריקות). הצעה
  // חדשה-ריקה-לגמרי מתחילה ב-null; הצעה קיימת (עריכה/שכפול) לעולם לא
  // מציגה את הבורר - נגזרת-אוטומטית מ-inferStructureMode למטה לפי הנתונים
  // שכבר נשמרו (יש sections אמיתיות => divided; אין => regular).
  const [quoteStructureMode, setQuoteStructureMode] = useState(null);
  const [projectName, setProjectName] = useState('');
  // ---- Durable drafts (2026-09-21) ----
  const [newDraftUuid, setNewDraftUuid] = useState(null);            // draft UUID of the current NEW-quote editor
  const [pendingAttachmentRemovals, setPendingAttachmentRemovals] = useState([]); // existing attachments staged for removal (deleted only on successful Save)
  const [wizardDraft, setWizardDraft] = useState(null);               // live snapshot of an unfinished item wizard
  const [wizardResume, setWizardResume] = useState(null);             // unfinished wizard to re-open after a restore
  const [recoveredDraftInfo, setRecoveredDraftInfo] = useState(null); // { updatedAt, mode, missingAttachments, conflictCopy }
  const [draftConflict, setDraftConflict] = useState(null);           // { envelope, quote, label, reason }
  const [editBaselineFingerprint, setEditBaselineFingerprint] = useState(null);
  const [editCleanHash, setEditCleanHash] = useState(null);
  const [draftStorageProbe, setDraftStorageProbe] = useState(null);
  const captureCleanRef = useRef(false);
  const restoreAttemptedForRef = useRef(null);
  const explicitLogoutRef = useRef(false);
  const editorOwnerRef = useRef(null);
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
  const { effectivePlan, isTrialExpired: rawIsTrialExpired, trialDaysLeft: rawTrialDaysLeft } = computeEffectivePlan({ plan: bizPlan, trialEndsAt, now });

  const isSuperAdmin = bizRole === 'super_admin';

  const [searchParams, setSearchParams] = useSearchParams();

  // TEKANGO Admin V1 (Task 1, shared shell + URL-backed Admin routing):
  // activeTab stays the single source of truth for which content renders
  // (unchanged existing pattern, admin_clients is still one of its values) -
  // adminSection is a second, admin-only piece of state for which Admin
  // destination (Overview/Users/Plans/Activity) is showing. The URL
  // (?view=admin&section=<id>) is kept in sync as a reflection of this
  // state, not a competing source of truth, so an Admin link is
  // bookmarkable/shareable without changing how activeTab itself works.
  const isAdminMode = isSuperAdmin && activeTab === 'admin_clients';
  const [adminSection, setAdminSectionState] = useState(DEFAULT_ADMIN_SECTION);
  // Selected account for the shell-preserving User Details view (Task 2,
  // §2.3) - session-scoped component state, not a URL param, so the URL
  // stays clean while filters/sort/page/scroll are naturally preserved
  // underneath (the Users list unmounts nothing when Details is shown).
  const [adminSelectedUserId, setAdminSelectedUserId] = useState(null);
  const navigateToAdminSection = (sectionId = DEFAULT_ADMIN_SECTION, selectedUserId = null) => {
    setAdminSelectedUserId(selectedUserId);
    setShellDrawerOpen(false);
    setAdminSectionState(ADMIN_SECTION_IDS.has(sectionId) ? sectionId : DEFAULT_ADMIN_SECTION);
    setActiveTab('admin_clients');
  };
  const openAdminUserDetails = account => navigateToAdminSection('users', account?.id ?? null);
  // Reads a bookmarked/shared Admin deep link exactly once on mount.
  const adminUrlSyncedRef = useRef(false);
  useEffect(() => {
    if (adminUrlSyncedRef.current) return;
    adminUrlSyncedRef.current = true;
    if (searchParams.get('view') === 'admin') {
      const requested = searchParams.get('section');
      setAdminSectionState(ADMIN_SECTION_IDS.has(requested) ? requested : DEFAULT_ADMIN_SECTION);
      setActiveTab('admin_clients');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Reflects Admin mode/section into the URL whenever it changes.
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (isAdminMode) {
        next.set('view', 'admin');
        next.set('section', adminSection);
      } else {
        next.delete('view');
        next.delete('section');
      }
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminMode, adminSection]);
  // Non-admin URL-tamper guard (URL hygiene only, never the real
  // authorization boundary - see is_super_admin()/is_admin() RLS + every
  // privileged Edge Function's own independent server-side role check):
  // a non-admin session can never gain Admin reachability by hand-crafting
  // the URL, so a stray view=admin is silently stripped, never trusted.
  useEffect(() => {
    if (session && !isSuperAdmin && searchParams.get('view') === 'admin') {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('view');
        next.delete('section');
        return next;
      }, { replace: true });
    }
  }, [session, isSuperAdmin, searchParams, setSearchParams]);

  // חוק ברזל (Stage 1 - Plan Identity / Trial / Lifetime Centralization,
  // PROFLOW_PROJECT_CONTEXT.md §148): קריאה נוספת לנקודת-האמת הקנונית
  // (resolveAccountEntitlement, כבר בשימוש ב-AdminUsersTab.jsx/
  // UserDetailsModal.jsx) עבור שני השדות היחידים ש-Dashboard.jsx לא חישב
  // בעצמו קודם - isLifetime ו-displayIdentity (אחת מחמש הזהויות הקנוניות:
  // FREE/FREE_TRIAL/BASIC/PRO/LIFETIME). שני הקריאות מחשבות את אותה עובדה
  // בפועל (plan/trialEndsAt/role זהים) - לא סתירה, לא שתי נוסחאות עצמאיות,
  // רק שהשנייה חושפת מידע נוסף שכבר קיים בפונקציה המשותפת.
  const resolvedIdentity = resolveAccountEntitlement({ plan: bizPlan, trialEndsAt, role: bizRole, isLifetime: bizIsLifetime, now });
  const { isLifetime, displayIdentity, entitlement } = resolvedIdentity;

  // חוק ברזל (Entitlement Audit task, 2026-09-08, ממצא אמיתי): isPro (למטה)
  // ו-isTrialExpired/trialDaysLeft (rawIsTrialExpired/rawTrialDaysLeft,
  // למעלה) הגיעו במקור מ-computeEffectivePlan() בלבד - פונקציה שמצהירה
  // במפורש שהיא "אינה יודעת כלום על Lifetime" (planEntitlements.js). לפני
  // המודל המפורש, זה לא הזיק בפועל: Lifetime-בהסקה-ישנה תמיד קיבל raw
  // plan!=='free' עם trial_ends_at=null, כך ש-effectivePlan כבר יצא 'pro'
  // ממילא. תחת המודל המפורש, is_lifetime אורתוגונלי לגמרי ל-plan/
  // trial_ends_at - חשבון Lifetime על plan='free'/'basic' (מוכח קיים, ר'
  // §206/§207) היה מקבל isPro===false בטעות (מציג "החודש: X/∞" חסר-היגיון
  // באזור הסטטיסטיקות), וחשבון Lifetime עם trial_ends_at שיורי לא-null
  // (לא מטופל ע"י Grant/Revoke בכוונה - ר' §206) היה עלול להציג "הניסיון
  // הסתיים"/"מסתיימת בעוד X ימים" מתחת ל-badge "LIFETIME" עצמו. שני
  // התיקונים כאן מתקנים במקור אחד, לא בכל אתר-צריכה בנפרד - כל צרכן
  // downstream (SettingsTab.jsx כולל) מקבל את הערך הנכון אוטומטית.
  const isPro = isSuperAdmin || isLifetime || effectivePlan === 'pro';
  const isTrialExpired = !isLifetime && rawIsTrialExpired;
  const trialDaysLeft = isLifetime ? null : rawTrialDaysLeft;

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
  // (Trial-warning banner and its show/hide state machine were removed by Owner request; trial days/expiry/entitlement are computed above and shown by the compact plan badge.)
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

  // חוק ברזל (Functional Parity Across Viewports task, 2026-09-08): מחושב
  // פעם אחת לכל render, נצרך ע"י Desktop sidebar ו-Mobile bottom-nav/More
  // כאחד - ר' src/utils/dashboardNavCapabilities.js לפירוט המלא.
  const navCapabilities = getDashboardNavCapabilities({ isSuperAdmin, t, isHebrew });

  async function loadData(userId, userEmail, userMetadata) {
    await fetchQuotes(userId);
    await fetchClients(userId);
    await fetchServices(userId);
    await fetchExpenses(userId);
    await fetchAllUserAttachments(userId);
    await fetchSettings(userId, userEmail, userMetadata);
  }

  // חוק ברזל (Smart Quote Root-Fix task, Phase 0 - Persistence Contract):
  // הבחירה העשירה (quote_item_measurements/quote_sections) נדרשת כדי
  // ש-mapQuoteItemToFormItem/handleEditClick/handleDuplicateQuote (הקוד
  // הקיים כבר, ר' §158) יקבלו בפועל את הנתונים המקצועיים שהם כבר בנויים
  // לצרוך - לפני התיקון הזה הם תמיד קיבלו undefined כי fetchQuotes מעולם
  // לא ביקש את הטבלאות האלה, למרות שהערה קודמת (למעלה, ליד §158) טענה
  // בטעות שכבר נוסף. Fallback לבחירה השטוחה המקורית אם הטבלאות עדיין לא
  // קיימות בסביבה (למשל Production, שה-migrations המקצועיים עדיין
  // TEST-only שם) - זיהוי מדויק של שגיאת יחס-חסר בלבד, לא בליעת שגיאות
  // אחרות, אותו עיקרון בדיוק כמו isMissingAttnColumnError למטה.
  const isMissingProfessionalRelationError = (err) => {
    const msg = String(err?.message || '');
    return msg.includes('quote_item_measurements') || msg.includes('quote_sections');
  };

  async function fetchQuotes(userId) {
    const richSelect = `*, clients ( company_name, email, phone, client_type, tax_id, address, terms, notes ), quote_items ( *, quote_item_measurements ( * ) ), quote_sections ( * )`;
    const flatSelect = `*, clients ( company_name, email, phone, client_type, tax_id, address, terms, notes ), quote_items ( * )`;

    let { data, error } = await supabase
      .from('quotes')
      .select(richSelect)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error && isMissingProfessionalRelationError(error)) {
      ({ data, error } = await supabase
        .from('quotes')
        .select(flatSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }));
    }

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

    let { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Auth Final Blockers task (2026-09-09): live-reproduced by corrupting
      // the stored session token and reloading - `error` was previously
      // discarded entirely, so a genuine auth/network failure on this query
      // (data: null, error: set) was indistinguishable from "no row exists
      // yet" (data: null, error: null for .maybeSingle()), incorrectly
      // sending an EXISTING user with a merely-invalid/expired session into
      // the new-account region-choice bootstrap screen below - including a
      // real INSERT attempt via createNewBusinessSettings for an account
      // that already has one. A genuine query error here means the session
      // itself cannot be trusted, not that this is a new user - sign out
      // and let the normal unauthenticated login screen take over, rather
      // than showing a confusing "choose your region" prompt or attempting
      // any account-bootstrap mutation against an unverified session.
      console.error('fetchSettings: business_settings query failed - treating as an invalid/expired session, not a new user:', error.message);
      await supabase.auth.signOut();
      return;
    }

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
      setBizIsLifetime(data.is_lifetime === true);
      // חוק ברזל (Smart Quote Final UX Simplification task, Part B - "the
      // business type/industry already known from Business Settings MUST
      // influence pricing-method recommendations"): נמצא-חי, נמצא באג אמיתי -
      // SettingsTab.jsx כבר מציג/עורך professionalDomain (setProfessionalDomain
      // כבר מועבר אליו כ-prop), אך fetchSettings מעולם לא קרא את
      // business_settings.professional_domain בפועל - הבחירה של הבעלים
      // הייתה נעלמת בכל טעינה מחדש, למרות שהעמודה עצמה כבר קיימת
      // (migration 20260903000000). data.professional_domain פשוט undefined
      // בסביבה שעדיין לא קיבלה את אותו migration (למשל Production) - נופל
      // בבטחה ל-'' (זהה-בייט ל"לא נבחר"), לא שגיאה.
      setProfessionalDomain(data.professional_domain || '');

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
    setAdminAccountsStatus('loading');
    try {
      const { data, error } = await supabase.from('business_settings').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        setAllAccounts(data);
        setAdminAccountsStatus('ready');
      } else {
        setAdminAccountsStatus('unavailable');
      }
    } catch {
      setAdminAccountsStatus('unavailable');
    }
  }

  // חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08): הפונקציה
  // handleToggleLifetime הישנה שהייתה כאן הוסרה - היא כתבה רק trial_ends_at
  // לפי ניחוש-ternary, אף פעם לא plan, מה שהיה השורש המוכח של הבאג "Lifetime
  // גרגה מוענק בפועל אך מוצג כ-FREE" (ר' PROFLOW_PROJECT_CONTEXT.md §204).
  // הענקה/ביטול Lifetime עכשיו פעולה מוגנת עצמאית בתוך AdminUsersTab.jsx
  // עצמו (אישור-סיסמה + כתיבת is_lifetime מפורש בלבד + קריאה-חוזרת לאימות),
  // לא עוד callback דרך Dashboard.jsx.

  // TEKANGO Admin V1 (Task 3.4): this direct, un-authenticated
  // business_settings.trial_ends_at write is removed - it had no re-auth
  // at all (a real gap versus Reset/Delete/Lifetime, which already required
  // a password). Trial extension now goes through AdminUsersTab's own
  // handleExecuteTrialExtension, which calls the admin-reauth-verify +
  // admin-extend-trial Edge Functions (server-side password check, proof
  // binding, server-enforced 14-day/expired-only policy, authoritative
  // read-back, audit log) - see AdminUsersTab.jsx.

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
      // חוק ברזל (Smart Quote Final UX Simplification task, Part B):
      // professional_domain נכתב כעת בפועל (לא רק נקרא ל-state מקומי) -
      // אותו עיקרון-fallback-מדויק בדיוק כמו isMissingAttnColumnError
      // (Dashboard.jsx, handleSaveQuote) - עמודה שעדיין לא קיימת בסביבה
      // מסוימת (למשל Production) לא תפיל את כל שמירת ההגדרות, רק תיפול
      // חזרה לניסיון-בלי-השדה הזה.
      let { error } = await supabase.from('business_settings').update({ ...payload, professional_domain: professionalDomain || null }).eq('id', settingId);
      if (error && String(error.message || '').includes('professional_domain')) {
        ({ error } = await supabase.from('business_settings').update(payload).eq('id', settingId));
      }
      if (error) {
        console.error('Error updating settings:', error);
        setAlertModalMsg(classifyDashboardActionError(error.message, isHebrew, 'update_settings'));
      }
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
        amountText = `₪${formatMoneyForCurrency(quote.total, 'ILS')}`;
        validUntilText = quote.valid_until ? formatDateLocal(quote.valid_until, true) : '';
        createdAtText = quote.created_at ? formatDateLocal(quote.created_at, true) : '';
      } else {
        statusLabel = intlStatusLabels[statusKey] || statusKey;
        const quoteCurrency = (quote.currency || '').toUpperCase();
        const accountCurrency = (currency || '').toUpperCase();
        const safeCurrency = INTL_CURRENCY_SYMBOLS[quoteCurrency]
          ? quoteCurrency
          : (INTL_CURRENCY_SYMBOLS[accountCurrency] ? accountCurrency : 'USD');
        amountText = `${INTL_CURRENCY_SYMBOLS[safeCurrency]}${formatMoneyForCurrency(quote.total, safeCurrency)}`;
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
    // Rapid double-submit fix (Auth Audit Completion, 2026-09-09): unlike
    // its sibling handlers (handleResetSubmit/handleUpdatePasswordFromRecovery,
    // both already loading-guarded), this handler had no loading flag at
    // all - live-reproduced a real triple-click sending 3 separate
    // /auth/v1/token requests. authLoading also gates re-entrancy here
    // since the function itself is not otherwise reentrancy-safe.
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    // Auth Lifecycle Forensic Audit (2026-09-09): every message in this
    // function now consistently uses `bundleIsHebrew`, not the local
    // `isHebrew` - this function only ever runs pre-authentication or
    // during the sign-up/sign-in transition itself, when `isHebrew`
    // (derived from bizCountry/session, see its own definition above) is
    // meaningless: bizCountry is still its unauthenticated default and
    // session is null. This exact split already existed correctly in one
    // place below (the pre-existing "typeof bundleIsHebrew !== 'boolean'"
    // comment explains why) but was never applied to the sibling branches
    // in this same function - found via a real reproduced defect this
    // task: requesting a password reset on the real `/dashboard?lang=he`
    // route rendered the English success text, not Hebrew.
    if (!emailEmailValidation(emailInput)) {
      setAuthError(bundleIsHebrew ? 'כתובת האימייל אינה תקינה או פיקטיבית.' : 'Invalid email address.');
      setAuthLoading(false);
      return;
    }

    try {
    if (isSignUp) {
      const { data: existingBiz } = await supabase
        .from('business_settings')
        .select('email')
        .eq('email', emailInput)
        .maybeSingle();

      if (existingBiz) {
        setAuthError(bundleIsHebrew ? 'האימייל כבר רשום במערכת! אנא התחבר או אפס סיסמה.' : 'Email already registered! Please sign in or use password reset.');
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
      // דרך quotecode.vercel.app - **בפרודקשן בלבד, ר' isLocalTestMode למטה**.
      if (typeof bundleIsHebrew !== 'boolean') {
        // Genuinely can't know the language here (the one signal this
        // whole function trusts is itself missing) - a hardcoded English
        // fallback is honest about that, not a guess dressed up as
        // `isHebrew`.
        setAuthError('Configuration error: unable to determine account region. Please refresh the page and try again.');
        return;
      }

      // Signup Callback Fix (2026-09-16, TEST-only task): the Production-pinned
      // emailRedirectTo above previously ran unchanged in TEST too, where
      // https://www.tekango.com/dashboard is not on the TEST project's own
      // redirect allow-list - Supabase silently fell back to the TEST
      // site_url's bare root, landing a successfully-confirmed signup on the
      // public marketing page instead of the authenticated app (root cause
      // confirmed via a fresh, read-only `supabase config diff`, see
      // PROFLOW_CODEX_CHECKPOINT.md). isLocalTestMode (src/shared/supabase.js)
      // is the same live/TEST discriminator that module's own fail-closed
      // guard already uses. In TEST this mirrors handleResetSubmit's own
      // dynamic-origin + explicit ?lang= pattern below (same reasoning:
      // preserves market/language across the redirect, not just the origin).
      // Production behavior is completely unchanged.
      const emailRedirectTo = isLocalTestMode
        ? window.location.origin + '/dashboard?lang=' + (bundleIsHebrew ? 'he' : 'en')
        : 'https://www.tekango.com/dashboard';

      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: {
          emailRedirectTo,
          data: { signup_market: bundleIsHebrew ? 'Local' : 'International' }
        }
      });
      if (error) {
        // Auth Lifecycle Forensic Audit (2026-09-09): this branch previously
        // reported "email already registered" for EVERY signUp() error
        // unconditionally - a weak password, a rate limit, or a genuine
        // server error were all misreported as a duplicate-account
        // problem, sending the user toward the wrong fix. normalizeAuthError
        // classifies the real cause instead (see authErrorClassification.js).
        setAuthError(normalizeAuthError(error, bundleIsHebrew).message);
      } else {
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          setAuthError(bundleIsHebrew ? 'האימייל כבר קיים! אנא התחבר.' : 'Email already exists! Please sign in.');
        } else {
          setAuthSuccess(bundleIsHebrew ? 'ההרשמה הצליחה! מאתחל פרופיל עם תקופת ניסיון...' : 'Sign up successful! Initializing user profile with free trial...');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
      if (error) {
        setAuthError(bundleIsHebrew ? 'שגיאת התחברות: בדוק את הפרטים או אפס סיסמה.' : 'Login error: check your credentials or reset password.');
      } else {
        setStatusMsg({ text: bundleIsHebrew ? 'התחברת בהצלחה' : 'Logged in successfully', type: 'success' });
      }
    }
    } catch (thrown) {
      // A genuine network/DNS/CORS failure can make signUp()/signInWithPassword()
      // throw instead of resolving with {error} - without this catch (mirroring
      // the identical fix already applied to handleResetSubmit this same task),
      // the exception propagated uncaught and authLoading was never cleared,
      // leaving the submit button stuck disabled forever with no visible error.
      setAuthError(normalizeAuthError(thrown, bundleIsHebrew).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg('');
    setResetMsgIsError(false);
    let error;
    try {
      // חוק ברזל (Password Recovery End-to-End Fix, Wave 1, §227/§228): היה
      // redirectTo: window.location.origin (שורש חשוף, בלי /dashboard ובלי
      // ?lang=) - מפנה את הקישור לדף הנחיתה השיווקי, לא ל-Dashboard.jsx, כי
      // אף אחד מ-AppLocal.jsx/AppGlobal.jsx (הראוטרים החיים בפועל - App.jsx
      // עצמו הוא קוד מת, לא מיובא ע"י main.jsx) אינו מיירט type=recovery
      // בנתיב השורש. לכן אירוע PASSWORD_RECOVERY נורה לריק (לאף מאזין לא היה
      // סיכוי להירשם, כי Dashboard.jsx - המקום היחיד עם isPasswordRecoveryMode
      // - מעולם לא היה מורכב) וההצעה-בפועל להצגת "קבע סיסמה חדשה" מעולם לא
      // הופעלה בזמן. שורש-הבעיה האמיתי: לא חוסר-לוגיקה (isPasswordRecoveryMode
      // קיים ותקין, ר' למטה) אלא ניתוב שגוי של הקישור עצמו. התיקון: להפנות
      // ישירות ל-/dashboard עם ?lang= מפורש (תיקון-שורש כפול - גם מיירט נכון
      // ל-Dashboard.jsx שכבר יודע לזהות type=recovery בעצמו [synchronous hash
      // check + PASSWORD_RECOVERY listener, שניהם קיימים כבר], וגם פותר את
      // ה-SIDE_TASK הנפרד של אובדן שפה/שוק ב-redirectTo - בלי ?lang= מפורש,
      // main.jsx היה בוחר AppLocal/AppGlobal לפי storedLang/geo/browserLang,
      // לא לפי השוק האמיתי של החשבון ששלח את הבקשה).
      ({ error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/dashboard?lang=' + (bundleIsHebrew ? 'he' : 'en'),
      }));
    } catch (thrown) {
      // A genuine network/DNS/CORS failure can make this call throw instead
      // of resolving with `{error}` - without this catch, that exception
      // propagated uncaught, resetLoading was never cleared, and the button
      // stayed stuck on "sending" forever with no visible error at all
      // (found this task, not previously handled by any of the 4 duplicate
      // implementations this flow used to have).
      error = thrown;
    }
    setResetLoading(false);
    if (error) {
      // bundleIsHebrew, not the account-derived isHebrew (which is
      // meaningless before login - see handleAuth's own comment above for
      // the full reasoning). This is the exact fix for a live-reproduced
      // defect this task: requesting a reset on the real
      // `/dashboard?lang=he` route rendered the English text.
      const { message } = normalizeAuthError(error, bundleIsHebrew);
      setResetMsg(message);
      setResetMsgIsError(true);
    } else {
      setResetMsg(bundleIsHebrew ? 'קישור לאיפוס סיסמה נשלח בהצלחה לאימייל שלך!' : 'Password recovery link sent successfully to your email!');
      setResetMsgIsError(false);
      setTimeout(() => {
        setForgotOpen(false);
        setResetMsg('');
        setResetEmail('');
      }, 3000);
    }
  };

  const handleUpdatePasswordFromRecovery = async (e) => {
    e.preventDefault();
    setRecoveryUpdateMsg('');
    setRecoveryUpdateMsgIsError(false);

    // Password Recovery End-to-End Fix, Wave 1, §227/§228: client-side
    // non-empty/match validation, checked before ever calling Supabase -
    // matches this task's own explicit required behavior. Minimum password
    // strength itself is intentionally NOT duplicated here as a separate
    // client-side rule - Supabase's own server-side check is already
    // correctly classified into a curated bilingual message by
    // normalizeAuthError()'s existing weak_password branch, so re-declaring
    // a second, possibly-inconsistent client-side rule here would risk the
    // two disagreeing later.
    if (!newPasswordInput || !confirmPasswordInput) {
      setRecoveryUpdateMsg(bundleIsHebrew ? 'יש למלא את שני שדות הסיסמה.' : 'Please fill in both password fields.');
      setRecoveryUpdateMsgIsError(true);
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setRecoveryUpdateMsg(bundleIsHebrew ? 'הסיסמאות אינן תואמות.' : 'Passwords do not match.');
      setRecoveryUpdateMsgIsError(true);
      return;
    }

    setRecoveryUpdateLoading(true);
    let error;
    try {
      ({ error } = await supabase.auth.updateUser({ password: newPasswordInput }));
    } catch (thrown) {
      error = thrown;
    }
    setRecoveryUpdateLoading(false);
    if (error) {
      // bundleIsHebrew: this handler runs from the recovery-link screen,
      // which (like the rest of AuthScreen) displays in the language the
      // real link/route requested, not the not-yet-fully-loaded account's
      // own business region.
      const { message } = normalizeAuthError(error, bundleIsHebrew);
      setRecoveryUpdateMsg(message);
      setRecoveryUpdateMsgIsError(true);
    } else {
      setRecoveryUpdateMsg(bundleIsHebrew ? 'הסיסמה עודכנה בהצלחה! מעביר אותך למסך ההתחברות...' : 'Password updated successfully! Redirecting you to sign in...');
      setRecoveryUpdateMsgIsError(false);
      // חוק ברזל (Password Recovery End-to-End Fix, Wave 1, §227/§228): לפני
      // התיקון, ההפניה הייתה ל-window.location.origin (שורש חשוף) תוך השארת
      // ה-session-שנוצר-מהשחזור פעיל - כלומר "המשך שקט כמחובר" בלי אימות
      // אמיתי שהסיסמה החדשה בפועל עובדת. זה הפר את הדרישה המפורשת של §227:
      // "new password successfully logs in" חייב להיות שלב נפרד ומוכח, לא
      // תוצאה משתמעת מהמשך session ישן. התיקון: signOut מפורש (מנקה את
      // ה-session-שחזור בבטחה, בלי דו-משמעות אם מותר להתייחס אליו כ-session
      // רגיל) ואז הפניה למסך ההתחברות עם ?lang= הנכון (לא לשורש) - "asked to
      // log in again", האפשרות הבטוחה יותר מבין השתיים שהמשימה עצמה מתירה,
      // ומספקת את ההוכחה הנפרדת שהמשימה דורשת: התחברות מפורשת עם הסיסמה
      // החדשה, לא session שרד מלפני העדכון.
      //
      // Root-cause correction (EN Matrix Closure follow-up task): the ORDER
      // above - setIsPasswordRecoveryMode(false) BEFORE awaiting signOut() -
      // created a genuine race, confirmed by source tracing and a real
      // reproduction, not guessed. The pre-existing, unrelated
      // getMarketRoutingCorrection effect (Item 25, src/utils/regionConfig.js)
      // also depends on isPasswordRecoveryMode and is deliberately designed to
      // stay inert (return null) WHILE it is true - but the instant it flips
      // to false, that effect re-evaluates using the session/account data
      // that has already been loaded in the background throughout the whole
      // recovery flow. Whenever the recovering account's real registered
      // market (business_settings.country, reflected in `isHebrew`) does NOT
      // match the recovery link's own bundle (`bundleIsHebrew` - e.g. a
      // Local-market account completing recovery via an ?lang=en link), that
      // effect fires ITS OWN competing `window.location.href` navigation -
      // which, firing synchronously off a state update, wins the race against
      // the still in-flight `await supabase.auth.signOut()` below and aborts
      // it before the session is actually cleared from storage. This is not
      // an EN-only defect - it is a market-mismatch race, and the single-line
      // fix is ordering: signOut() must fully resolve (clearing storage and
      // dispatching its own SIGNED_OUT event) BEFORE isPasswordRecoveryMode
      // is ever flipped, so the correction effect never finds a mismatched,
      // still-authenticated state to react to. No new mechanism, no broad
      // auth-state change - only the order of two pre-existing steps.
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          // best-effort - even if signOut itself throws, the redirect below
          // still takes the user to the login screen, which is the safe
          // outcome either way.
        }
        setIsPasswordRecoveryMode(false);
        // Post-Recovery Login Routing Fix: bundleIsHebrew here only reflects
        // whichever anonymous bundle happened to handle the *original*
        // reset request (itself decided by main.jsx's geo/browser-language
        // fallback for a not-yet-authenticated visitor) - it has no
        // reliable connection to the account's real registered market, and
        // was the actual root cause of recovery landing on the wrong-
        // language login. getPostRecoveryLoginLang applies the same known-
        // market precedence getMarketRoutingCorrection above already uses
        // (isHebrew wins once settingId confirms business_settings loaded;
        // bundleIsHebrew only as a fallback) - never a geo/browser-language
        // guess.
        window.location.href = window.location.origin + '/dashboard?lang=' + getPostRecoveryLoginLang({ settingId, isHebrew, bundleIsHebrew });
      }, 2000);
    }
  };

  const handleSignOut = async () => {
    const uid = session?.user?.id;
    explicitLogoutRef.current = true;
    if (uid) {
      suppressDraftWrites(uid); // the unmounting editor must not re-write what we are about to purge
      const { draftIds } = quoteDraft.store.purgeUser(uid);
      await getBlobStore().purgeUser(uid);
      diagLog('draft-purge', { outcome: 'explicit-logout', count: draftIds.length });
    }
    setEditingQuoteId(null);
    setIsCreatingQuote(false);
    resetQuoteFormFields();
    setRecoveredDraftInfo(null);
    setDraftConflict(null);
    setNewDraftUuid(null);
    restoreAttemptedForRef.current = null;
    editorOwnerRef.current = null;
    await supabase.auth.signOut();
    explicitLogoutRef.current = false;
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
      ? `הצעת מחיר מאת: ${senderName}\n\nהי ${clientNameVal}, הנה הצעת המחיר שלך מספר ${proposalNumberDisplay} בסך ${proposalSym}${formatMoneyForCurrency(proposal.total, proposalCurr)}. בתוקף עד ${proposal.valid_until || 'ללא הגבלה'}.\n\nצפה בהצעה:\n${quoteViewLink}`
      : `Quote from: ${senderName}\n\nHi ${clientNameVal}, here is your quote ${proposalNumberDisplay} totaling ${proposalSym}${formatMoneyForCurrency(proposal.total, proposalCurr)}. Valid until ${proposal.valid_until || 'N/A'}.\n\nView quote:\n${quoteViewLink}`;
    
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
        total: formatMoneyForCurrency(quote.total, quoteCurr),
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
      // חוק ברזל (LIVE Admin Email Failure root-cause task, 2026-09-08):
      // לפני התיקון, כל כשל (session פגה/בעלות שגויה/כשל-תצורת-שולח/דחיית-
      // Resend/כשל-רשת) הוצג באותה הודעה גנרית אחת בדיוק - בלתי-ניתן-
      // לאבחון מצד המשתמש/מהדוח שהוא מדווח. getFunctionErrorMessage (אותו
      // מנגנון בדיוק כמו AdminUsersTab.jsx, ר' functionError.js) מחלץ את
      // ה-message האמיתי שהפונקציה כתבה ל-response body; classifyQuoteEmailError
      // (quoteEmailErrorClassification.js) ממפה אותו לקטגוריה בטוחה-להצגה.
      // ה-console.error עדיין מקבל את האובייקט הגולמי + ה-message שנפתר,
      // לאבחון מפתחים - אף פעם לא נחשף כפי-שהוא למשתמש.
      const hadReadableServerResponse = !!(err?.context && typeof err.context.json === 'function');
      const rawMessage = await getFunctionErrorMessage(err, isHebrew ? 'שליחת האימייל נכשלה' : 'Email sending failed');
      console.error("Email send error:", err, "| resolved server message:", rawMessage);
      setEmailStatuses(prev => ({ ...prev, [quote.id]: 'failed' }));
      const { userMessage } = classifyQuoteEmailError(rawMessage, isHebrew, { hadReadableServerResponse });
      setAlertModalMsg(userMessage);
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

  // ---- Durable local quote drafts (see src/utils/quoteDraft.js for the contract and laws) ----
  const draftUserId = session?.user?.id || null;
  const draftPayload = {
    clientName, clientEmail, clientPhone, clientType, clientTaxId, clientAddress, quoteSubject, attnName, attnRole, currency,
    quoteStatus, validUntil, discount, terms, warranty, notes, items, sections, quoteStructureMode, projectName,
  };
  const quoteDraft = useQuoteDraftPersistence({
    // never persist an editor that belongs to a DIFFERENT user than the current session (account-switch isolation)
    enabled: showQuoteForm && !!draftUserId && (!editorOwnerRef.current || editorOwnerRef.current === draftUserId) && (editingQuoteId !== null || !!newDraftUuid),
    userId: draftUserId,
    businessId: settingId || null,
    locale: isHebrew ? 'he' : 'en',
    market: bizCountry,
    mode: editingQuoteId ? 'edit' : 'new',
    quoteId: editingQuoteId,
    draftId: newDraftUuid,
    payload: draftPayload,
    wizard: wizardDraft,
    files: quoteFiles,
    pendingRemovals: pendingAttachmentRemovals,
    baseServerFingerprint: editBaselineFingerprint,
    cleanFormHash: editCleanHash,
    defaults: { defaultTerms, defaultWarranty },
  });

  // AI Chat workflow-awareness snapshot (Track B/C) - a small, pure,
  // derived-only-when-on-the-quote-editor-screen object; never sent for any
  // other tab, never containing client name/email/financial totals/item
  // descriptions, see src/utils/quoteWorkflowContext.js for the full
  // contract and its own dedicated tests.
  const quoteWorkflowContext = computeQuoteWorkflowContext({
    showQuoteForm, editingQuoteId, clientName, projectName, sections, quoteStructureMode, items, itemWizardState,
  });

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

  // חוק ברזל (Smart Quote Structure-First UX Correction task, Locked
  // Decision 9 - "legacy quotes / default state"): הצעה קיימת (עריכה או
  // שכפול) לעולם לא מציגה מחדש את בורר-המבנה ("איך תרצו לבנות את
  // ההצעה?") - המצב נגזר-אוטומטית מהנתונים שכבר נשמרו, פעם אחת, כאן.
  // יש quote_sections אמיתיות (שם לא-ריק) => divided; אין אף אחת => regular.
  // רק הצעה חדשה-ריקה-לגמרי (handleCreateNewQuoteClick) מתחילה ב-null.
  const inferStructureModeFromQuote = (quote) => {
    const realSections = (quote?.quote_sections || []).filter(s => (s?.name || '').trim() !== '');
    return realSections.length > 0 ? 'divided' : 'regular';
  };

  const handleEditClick = async (quote) => {
    if (isQuoteImmutable(quote)) {
      setAlertModalMsg(isHebrew ? 'לא ניתן לערוך הצעה מאושרת/חתומה.' : 'Cannot edit an approved/signed quote.');
      return;
    }

    captureCleanRef.current = true; // the clean baseline hash is captured on the render right after this state batch
    setEditBaselineFingerprint(serverFingerprintFromQuote(quote));
    setEditCleanHash(null);
    setPendingAttachmentRemovals([]);
    setWizardDraft(null);
    setWizardResume(null);
    setRecoveredDraftInfo(null);
    setNewDraftUuid(null);
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
    setQuoteStructureMode(inferStructureModeFromQuote(quote));

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
      // Overnight Test Hardening + Priority-1 Completion Pack, Night Task B
      // (2026-09-16): quote.quote_items comes straight from the fetch with
      // no guaranteed row order (Postgres/PostgREST never promises one
      // without an explicit ORDER BY) - sections (above) and each item's
      // own measurements (mapQuoteItemToFormItem) were already correctly
      // sorted by sort_order before this task; the items array itself was
      // the one remaining unsorted spot, the exact root cause of a real,
      // reproduced item-order flip after edit/resave/refetch. Same
      // established sort pattern as sections/measurements - no new sort
      // semantics invented.
      setItems(quote.quote_items
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(item => mapQuoteItemToFormItem(item, { keepId: true })));
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
  // ONE reset for every "start clean" path (new quote / cancel / after save / logout / account switch). Previously each path
  // re-listed the fields by hand and two of them forgot quoteStatus and quoteStructureMode (state leaked between quotes).
  const resetQuoteFormFields = () => {
    const pr = getPristineQuoteFormState({ defaultTerms, defaultWarranty, isLocalIsraeliBusiness, currency });
    setClientName(pr.clientName); setClientEmail(pr.clientEmail); setClientPhone(pr.clientPhone); setClientType(pr.clientType);
    setClientTaxId(pr.clientTaxId); setClientAddress(pr.clientAddress); setQuoteSubject(pr.quoteSubject); setAttnName(pr.attnName);
    setAttnRole(pr.attnRole); setValidUntil(pr.validUntil); setDiscount(pr.discount); setCurrency(pr.currency);
    setTerms(pr.terms); setWarranty(pr.warranty); setNotes(pr.notes); setQuoteFiles([]); setItems(pr.items); setSections(pr.sections);
    setProjectName(pr.projectName); setQuoteStatus(pr.quoteStatus); setQuoteStructureMode(pr.quoteStructureMode);
    setPendingAttachmentRemovals([]); setWizardDraft(null); setWizardResume(null); setEditBaselineFingerprint(null); setEditCleanHash(null);
    setItemWizardState(null);
  };

  const handleCreateNewQuoteClick = () => {
    setActiveTab('main');
    setIsCreatingQuote(true);
    setEditingQuoteId(null);
    resetQuoteFormFields();
    setNewDraftUuid(newDraftId());
    setRecoveredDraftInfo(null);
  };

  const handleDuplicateQuote = async (quote) => {
    setNewDraftUuid(newDraftId());
    setPendingAttachmentRemovals([]);
    setWizardDraft(null);
    setWizardResume(null);
    setRecoveredDraftInfo(null);
    setEditBaselineFingerprint(null);
    setEditCleanHash(null);
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
    setQuoteStructureMode(inferStructureModeFromQuote(quote));

    if (quote.quote_items && quote.quote_items.length > 0) {
      // Same missing-sort root cause and same fix as handleEditClick above -
      // quote.quote_items has no guaranteed fetch order.
      setItems(quote.quote_items
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(item => {
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
    resetQuoteFormFields();
    setRecoveredDraftInfo(null);
    setNewDraftUuid(null);
    setStatusMsg({ text: isHebrew ? 'הפעולה בוטלה.' : 'Action cancelled.', type: 'success' });
  };

  // Cancel with unsaved work asks first; the durable draft is deleted ONLY after this explicit discard.
  const requestCancelEdit = async () => {
    if (quoteDraft.isDirty()) {
      const msg = isHebrew ? 'יש שינויים שלא נשמרו. לבטל ולמחוק את הטיוטה?' : 'You have unsaved changes. Discard them and delete the draft?';
      if (!window.confirm(msg)) return;
    }
    await quoteDraft.discard();
    handleCancelEdit();
  };

  // ---- Durable drafts: restore / conflict handling (2026-09-21) ----
  const draftLabelFor = (q, env) => (q ? formatQuoteFallback(q) : (env?.quoteId ? String(env.quoteId).slice(0, 8) : ''));

  const applyDraftPayload = (payload) => {
    const pr = getPristineQuoteFormState({ defaultTerms, defaultWarranty, isLocalIsraeliBusiness, currency });
    const g = (k) => (payload && payload[k] !== undefined && payload[k] !== null ? payload[k] : pr[k]);
    setClientName(g('clientName')); setClientEmail(g('clientEmail')); setClientPhone(g('clientPhone')); setClientType(g('clientType'));
    setClientTaxId(g('clientTaxId')); setClientAddress(g('clientAddress')); setQuoteSubject(g('quoteSubject')); setAttnName(g('attnName'));
    setAttnRole(g('attnRole')); setCurrency(g('currency')); setQuoteStatus(g('quoteStatus')); setValidUntil(g('validUntil')); setDiscount(g('discount'));
    setTerms(g('terms')); setWarranty(g('warranty')); setNotes(g('notes')); setProjectName(g('projectName'));
    setItems(Array.isArray(payload?.items) && payload.items.length ? payload.items : pr.items);
    setSections(Array.isArray(payload?.sections) ? payload.sections : []);
    setQuoteStructureMode(payload?.quoteStructureMode ?? null);
  };

  const openDraftEditor = async (uid, env, { quote = null, asCopy = false, copyLabel = '' } = {}) => {
    setActiveTab('main');
    applyDraftPayload(env.payload);
    const blobKey = env.mode === 'edit' ? `edit-${env.quoteId}` : env.draftId;
    let existing = [];
    if (env.mode === 'edit' && quote && !asCopy) {
      const { data: attData } = await supabase.from('quote_attachments').select('*').eq('quote_id', quote.id);
      existing = (attData || []).filter((f) => !(env.pendingAttachmentRemovals || []).includes(f.id)).map((f) => ({ ...f, size: f.file_size }));
    }
    const { files, missing } = await getBlobStore().restoreFiles(uid, blobKey, env.pendingAttachments);
    if (!asCopy) quoteDraft.adopt(files); // the restored files already live in IndexedDB under this draft
    setQuoteFiles([...existing, ...files.map((x) => x.file)]);
    setPendingAttachmentRemovals(asCopy ? [] : (env.pendingAttachmentRemovals || []));
    if (asCopy) {
      // never overwrite the changed saved quote: the recovered edit opens as a NEW quote (copy); the old edit-draft is retired
      quoteDraft.store.removeFor(uid, 'edit', env.quoteId);
      await getBlobStore().deleteDraft(uid, blobKey);
      setEditingQuoteId(null); setIsCreatingQuote(true); setNewDraftUuid(newDraftId());
      setEditBaselineFingerprint(null); setEditCleanHash(null);
    } else if (env.mode === 'edit') {
      captureCleanRef.current = false;
      setNewDraftUuid(null); setEditingQuoteId(quote.id); setIsCreatingQuote(false);
      setEditBaselineFingerprint(env.baseServerFingerprint); setEditCleanHash(env.cleanFormHash);
    } else {
      setEditingQuoteId(null); setIsCreatingQuote(true); setNewDraftUuid(env.draftId);
      setEditBaselineFingerprint(null); setEditCleanHash(null);
    }
    setWizardDraft(null);
    setWizardResume(env.wizard && env.wizard.open ? { ...env.wizard } : null);
    setRecoveredDraftInfo({
      updatedAt: env.updatedAt, mode: env.mode,
      missingAttachments: [...missing.map((m) => m.name), ...(env.attachmentsPersistFailed || [])],
      conflictCopy: asCopy ? { label: copyLabel } : null,
    });
  };

  const runDraftRestore = async (uid) => {
    let list;
    try { list = quoteDraft.store.listForUser(uid); } catch { diagLog('draft-restore', { outcome: 'storage-error' }); return; }
    const top = list[0];
    if (!top) { diagLog('draft-restore', { outcome: 'none' }); return; }
    const env = top.envelope;
    const q = env.mode === 'edit' ? quotes.find((x) => x.id === env.quoteId) : null;
    const decision = decideRestore(env, q, { immutable: !!q && isQuoteImmutable(q) });
    diagLog('draft-restore', { outcome: decision });
    if (decision === 'restore-new') { await openDraftEditor(uid, env); return; }
    if (decision === 'restore-edit') { await openDraftEditor(uid, env, { quote: q }); return; }
    setDraftConflict({ envelope: env, quote: q || null, label: draftLabelFor(q, env), reason: decision === 'conflict-changed' ? 'changed' : (q ? 'immutable' : 'missing') });
  };

  const resolveDraftConflict = async (choice) => {
    const c = draftConflict; const uid = session?.user?.id;
    if (!c || !uid) return;
    setDraftConflict(null);
    if (choice === 'review') { await openDraftEditor(uid, c.envelope, { asCopy: true, copyLabel: c.label }); diagLog('draft-restore', { outcome: 'conflict-review-copy' }); return; }
    quoteDraft.store.removeFor(uid, 'edit', c.envelope.quoteId);
    await getBlobStore().deleteDraft(uid, `edit-${c.envelope.quoteId}`);
    diagLog('draft-restore', { outcome: choice === 'saved' ? 'conflict-use-saved' : 'conflict-discard' });
    if (choice === 'saved' && c.quote && !isQuoteImmutable(c.quote)) handleEditClick(c.quote);
  };

  // Explicit discard of a restored/current draft from the banner.
  const discardRecoveredDraft = async () => {
    if (!window.confirm(isHebrew ? 'למחוק את הטיוטה המשוחזרת ולבטל את העריכה?' : 'Delete the recovered draft and close the editor?')) return;
    await quoteDraft.discard();
    handleCancelEdit();
  };

  // Restore ONLY after the authenticated identity is known and the quotes are loaded (isInitializing false), once per user.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || isInitializing) return;
    if (restoreAttemptedForRef.current === uid) return;
    restoreAttemptedForRef.current = uid;
    allowDraftWrites(uid);
    if (showQuoteForm) return; // an editor is already open in memory (e.g. re-login after expiry): nothing to restore over it
    runDraftRestore(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, isInitializing]);

  // Account switch on a still-mounted dashboard: never render or persist the previous user's editor for the new user.
  useEffect(() => {
    const uid = session?.user?.id || null;
    if (uid && editorOwnerRef.current && editorOwnerRef.current !== uid) {
      setEditingQuoteId(null); setIsCreatingQuote(false); resetQuoteFormFields();
      setRecoveredDraftInfo(null); setDraftConflict(null); setNewDraftUuid(null);
      editorOwnerRef.current = null; restoreAttemptedForRef.current = null;
    } else if (uid && showQuoteForm) {
      editorOwnerRef.current = uid;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, showQuoteForm]);

  // TTL (30 days) + corruption sweep; also purges the IndexedDB blobs of every draft it removes.
  useEffect(() => {
    if (!session?.user?.id) return;
    try {
      const { entries } = quoteDraft.store.cleanupExpired();
      entries.forEach((e) => getBlobStore().deleteDraft(e.userId, e.draftId));
    } catch { /* never break the dashboard for housekeeping */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (!showQuoteForm) return;
    const r = quoteDraft.store.probe();
    setDraftStorageProbe(r.ok ? null : r.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuoteForm]);

  // Edit mode: capture the "clean" form hash once, on the first render after the server values were loaded into the editor.
  useEffect(() => {
    if (captureCleanRef.current && editingQuoteId) {
      captureCleanRef.current = false;
      setEditCleanHash(formHash(draftPayload));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingQuoteId, editBaselineFingerprint, editCleanHash]);
  // ...and the baseline server fingerprint when the editor started from a just-saved quote (attachment-failure path).
  useEffect(() => {
    if (editingQuoteId && editBaselineFingerprint === null) {
      const q = quotes.find((x) => x.id === editingQuoteId);
      if (q) setEditBaselineFingerprint(serverFingerprintFromQuote(q));
    }
  }, [editingQuoteId, editBaselineFingerprint, quotes]);

  async function handleSaveQuote(e) {
    e.preventDefault();
    if (!session?.user?.id) return;

    if (clientEmail && clientEmail.trim() !== '' && !emailEmailValidation(clientEmail)) {
      setAlertModalMsg(isHebrew ? '❌ שגיאה: כתובת האימייל של הלקוח אינה חוקית!' : '❌ Invalid email address!');
      return;
    }

    // Post-LIVE Priority 1, Fix B (business profile completeness gate):
    // narrowest safe point - only the FIRST real NEW quote (never an edit of
    // an already-existing quote, and never account signup itself) is gated.
    // See businessProfileCompleteness.js for the exact market-aware rule.
    if (!editingQuoteId) {
      const gateMessage = getBusinessProfileGateMessage({
        phone: bizPhone,
        taxId: bizTaxId,
        isLocalIsraeliBusiness,
        isHebrew,
      });
      if (gateMessage) {
        setAlertModalMsg(gateMessage);
        setActiveTab('settings');
        return;
      }
    }

    try {
      // מקור אמת פיננסי אמין לעריכת הצעה קיימת: שולפים מחדש את ההצעה ואת
      // פריטיה ישירות מהשרת - לא מסתמכים על quotes.find (state מקומי שעלול
      // להיות מיושן). זה בדיוק מנגנון הכשל שגרם לתקרית ה-VAT ההיסטורית
      // (עריכה שהתבססה על מצב לקוח לא-רענן ודרסה tax_rate/currency תקינים).
      let authoritativeQuote = null;
      let authoritativeItems = null;
      let authoritativeSections = null;

      if (editingQuoteId) {
        // חוק ברזל (SQ-F05, Codex Smart Quote P0/P1 review - "section/unit
        // changes are not independently classified"): baseline אמין של
        // quote_sections הקיימות בשרת - עד כה מעולם לא נשלף כאן בכלל, כך
        // שלא הייתה שום דרך לדעת אילו יחידות הוסרו-בפועל מול sections
        // הנוכחי ב-state (נדרש כדי למחוק בדיוק את מה שהוסר, לא הכל).
        const { data: fetchedSections, error: fetchSectionsErr } = await supabase
          .from('quote_sections')
          .select('id, name, sort_order')
          .eq('quote_id', editingQuoteId);
        if (fetchSectionsErr) {
          setAlertModalMsg(isHebrew
            ? 'לא ניתן היה לאמת את מבנה היחידות הקיים מול השרת. השמירה בוטלה כדי למנוע פגיעה בנתונים.'
            : 'Could not verify the existing unit structure against the server. Save cancelled to protect data.');
          return;
        }
        authoritativeSections = fetchedSections || [];

        const { data: fetchedQuote, error: fetchQuoteErr } = await supabase
          .from('quotes')
          .select('id, currency, client_type, tax_rate, subtotal, discount, total, status')
          .eq('id', editingQuoteId)
          .single();

        // חוק ברזל (Final Smart Quote Correction task - Codex P0-1
        // "STRUCTURED EDIT PERSISTENCE"): נשלף כעת גם כל שדה-Professional
        // עשיר + quote_item_measurements - לא רק ה-4 שדות השטוחים המקוריים.
        // בלעדי זה, אין שום דרך לזהות שהמשתמש שינה מידה/מפרט/שיוך-יחידה,
        // כי ה-authoritative snapshot עצמו לא היה מכיל את השדות האלה כלל.
        // Fallback בטוח (isMissingProfessionalColumnError, אותו עיקרון
        // בדיוק כמו למטה) לסביבה שעדיין לא עברה migration.
        let { data: fetchedItems, error: fetchItemsErr } = await supabase
          .from('quote_items')
          .select('id, description, quantity, unit_price, total_price, pricing_unit, calculated_quantity, quantity_source, specification, section_id, calculation_method, quote_item_measurements ( width, height, unit, label, is_pricing_driving )')
          .eq('quote_id', editingQuoteId);
        if (fetchItemsErr) {
          const msg = String(fetchItemsErr.message || '');
          const isMissingCol = ['pricing_unit', 'calculated_quantity', 'quantity_source', 'specification', 'section_id', 'calculation_method', 'quote_item_measurements']
            .some((col) => msg.includes(col));
          if (isMissingCol) {
            ({ data: fetchedItems, error: fetchItemsErr } = await supabase
              .from('quote_items')
              .select('id, description, quantity, unit_price, total_price')
              .eq('quote_id', editingQuoteId));
          }
        }

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
      let itemsStructurallyChanged = false;
      let effectiveClientType = clientType;
      let financialQuotePatch = null;
      let descriptionUpdates = null;
      let newQuoteFinancials = null;

      if (editingQuoteId) {
        const numKey = (v) => Number(v || 0).toFixed(6);
        const normType = (v) => v || '';

        // חוק ברזל (SQ-F01, Codex Smart Quote P0/P1 review - "stale quote
        // financial totals after measurement-only edits"): משתמשים כאן ב-
        // getActiveQuantity (אותה סמכות קנונית שכבר משמשת בהמשך הפונקציה
        // הזו עצמה, ר' total_price למטה) ולא ב-it.quantity הגולמי - פריט
        // מדוד יכול לשמור quantity שטוח קבוע (למשל 1) בעוד calculated_quantity
        // בפועל משתנה כתוצאה משינוי מידות בלבד. השוואה לפי quantity גולמי
        // הייתה "עיוורת" לשינוי כזה, ומשאירה isFinancialEdit=false כך
        // שסכומי-ההצעה הישנים (subtotal/discount/total) נשמרים כפי שהם -
        // גם כשסכום הפריט עצמו עומד להשתנות. getActiveQuantity הוא superset
        // מדויק: לפריטים לא-מדודים הוא נופל בחזרה בדיוק לאותו quantity
        // שטוח, אז אין כאן שום שינוי-התנהגות לפריטים רגילים/קבועים.
        const currentItemPairs = items.map(it => `${numKey(getActiveQuantity(it))}|${numKey(it.unit_price)}`).sort();
        const authoritativeItemPairs = authoritativeItems.map(it => `${numKey(getActiveQuantity(it))}|${numKey(it.unit_price)}`).sort();
        const itemsChanged = currentItemPairs.length !== authoritativeItemPairs.length
          || currentItemPairs.some((v, i) => v !== authoritativeItemPairs[i]);

        const discountChanged = numKey(discount) !== numKey(authoritativeQuote.discount);
        const clientTypeChanged = normType(clientType) !== normType(authoritativeQuote.client_type);

        isFinancialEdit = itemsChanged || discountChanged || clientTypeChanged;
        effectiveClientType = clientTypeChanged ? normType(clientType) : normType(authoritativeQuote.client_type);

        // מיפוי בטוח id-to-id בין הטופס לבין ה-authoritative snapshot -
        // נדרש הן לעדכון-description הממוקד הקיים, הן (חדש) לבדיקת שינוי-
        // מבנה למטה. לעולם לא לפי index.
        const formIds = items.map(it => it.id);
        const authoritativeIds = authoritativeItems.map(it => it.id);
        const formIdsMappingSafe =
          formIds.length === authoritativeIds.length &&
          formIds.every(id => id !== undefined && id !== null) &&
          new Set(formIds).size === formIds.length &&
          formIds.every(id => authoritativeIds.includes(id));

        // חוק ברזל (Final Smart Quote Correction task - Codex P0-1
        // "STRUCTURED EDIT PERSISTENCE", Owner law: "If the user changes
        // any persisted Smart Quote item field, Save must persist it or
        // fail visibly"): isFinancialEdit לעיל בודק רק quantity/unit_price -
        // זה נכון ומספיק כדי להחליט על *recalculation פיננסי* (Owner P0-2:
        // "editing a field must not change unrelated saved pricing
        // semantics"), אבל *לא* מספיק כדי להחליט אם מותר לדלג על כתיבת
        // הפריטים העשירים - שינוי מידה/מפרט/שיוך-יחידה/שיטת-תמחור לעיתים
        // קרובות אינו משנה את quantity/unit_price כלל (לדוגמה: פריט מדוד
        // שבו quantity השטוח קבוע על 1 ורק calculated_quantity/measurements
        // משתנים) - וזה בדיוק מה שגרם לאובדן-נתונים השקט שה-audit מצא.
        // בדיקה זו משווה per-id (לא multiset) את כל השדות המקצועיים+מידות,
        // ומופעלת רק כשה-mapping בטוח (אחרת ממילא ניפול-בבטחה למטה).
        const measurementFingerprint = (m) => `${Number(m?.width || 0).toFixed(4)}x${Number(m?.height || 0).toFixed(4)}|${m?.label || ''}|${m?.is_pricing_driving !== false}`;
        const itemStructuralFingerprint = (it) => JSON.stringify({
          pricing_unit: it.pricing_unit || null,
          calculated_quantity: (it.calculated_quantity !== undefined && it.calculated_quantity !== '' && it.calculated_quantity !== null) ? Number(it.calculated_quantity) : null,
          quantity_source: it.quantity_source || null,
          specification: normalizeSpecificationRows(it.specification),
          section: it.section_key ?? it.section_id ?? null,
          calculation_method: it.calculation_method || null,
          measurements: (Array.isArray(it.measurements) ? it.measurements : (Array.isArray(it.quote_item_measurements) ? it.quote_item_measurements : []))
            .map(measurementFingerprint).sort(),
        });
        itemsStructurallyChanged = formIdsMappingSafe && items.some((formItem) => {
          const authItem = authoritativeItems.find(a => a.id === formItem.id);
          return !authItem || itemStructuralFingerprint(formItem) !== itemStructuralFingerprint(authItem);
        });

        if (isFinancialEdit) {
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
        } else {
          // עריכה לא-פיננסית (מבחינת quantity/unit_price/discount/client_type):
          // משמרים במדויק (verbatim) את כל השדות הפיננסיים כפי שנשלפו
          // מהשרת - בלי לגזור currency/client_type/tax_rate מחדש מהגדרות
          // העסק/אזור הנוכחיים. תקף גם כששינוי-מבנה קיים למטה - Owner P0-2:
          // שינוי מידה/שיוך/מפרט לא אמור לשנות סמנטיקת-תמחור.
          financialQuotePatch = {
            currency: authoritativeQuote.currency,
            client_type: authoritativeQuote.client_type,
            tax_rate: authoritativeQuote.tax_rate,
            subtotal: authoritativeQuote.subtotal,
            discount: authoritativeQuote.discount,
            total: authoritativeQuote.total,
          };

          if (itemsStructurallyChanged) {
            // חוק ברזל (Codex P0-1 fix): שינוי-מבנה עשיר בלי שינוי quantity/
            // unit_price - itemsForPersist נשאר על ברירת-המחדל שלו (items
            // המלא, כבר מאותחל למעלה) כדי שה-delete+insert העשיר ירוץ
            // ויכתוב את המידות/מפרט/שיוך-היחידה האמיתיים - לעולם לא נשמט
            // בשקט רק כי quantity/unit_price לא השתנו. אין descriptionUpdates
            // כאן - ה-delete+insert המלא כבר כותב description עדכני לכל פריט.
          } else {
            // מיפוי בטוח של עריכת description בלבד: לעולם לא לפי index (סדר
            // עלול להשתנות) - רק לפי quote_items.id האמיתי שנשמר על כל
            // פריט בזמן טעינת העריכה (ר' handleEditClick). אם המיפוי אינו
            // בדיוק חד-חד-ערכי - נכשלים בבטחה ולא כותבים כלום.
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
          }
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
      // חוק ברזל (SQ-F02 final closure task - single atomic server-side
      // transactional save boundary): לעריכה קיימת, השדות הפיננסיים (client_
      // type/currency/subtotal/tax_rate/total/discount) הוסרו מה-payload
      // הזה בכוונה - הם עכשיו נכתבים אך ורק בתוך save_quote_structured
      // (יחד עם sections/items/measurements, כטרנזקציה אחת), לא יותר כאן
      // כעדכון-quotes נפרד ולא-תלוי. להצעה חדשה (branch ה-else) הם נשארים
      // בדיוק כמו קודם - ה-INSERT הבודד עצמו כבר אטומי, אין צורך לנתב
      // דרך ה-RPC כלל (p_financial מועבר null בהמשך לפריט זה).
      const quotePayload = editingQuoteId
        ? {
            client_id: clientId,
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
      // עריכה פיננסית, הצעה חדשה, או עריכה עם שינוי-מבנה עשיר
      // (itemsStructurallyChanged - Codex P0-1 fix): delete+insert מלא
      // מה-state הנוכחי של items. עריכה לא-פיננסית וללא שינוי-מבנה: **אין**
      // delete+insert בכלל (איפס כתיבה אם אין שינוי description; אחרת
      // UPDATE ממוקד per-id בלבד, ר' descriptionUpdates למעלה) - כך שאין
      // שינוי quantity/unit_price/total_price ואין regeneration של
      // quote_item id-ים על עריכה שאינה משנה דבר פיננסי/מבני אמיתי.
      // Post-LIVE Priority 1, Fix A (empty placeholder item persistence):
      // strip only a genuinely untouched default placeholder row before it
      // is ever written - see structuredQuoteItemPersistence.js for the
      // exact conservative criteria. Forward-only: this only affects what
      // THIS save call writes, never an already-persisted row (the filter
      // itself never matches an item that already has an id).
      let itemsForPersist = excludeUntouchedPlaceholderItems(items);

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
      // quotes.project_name (professional project identity) was READ into the editor but never WRITTEN - the value typed by
      // the user was silently lost on every save. Same "retry without the optional column" pattern as attn_* for
      // environments that have not applied the column yet.
      const projectFields = { project_name: projectNameForPersist(projectName) };
      const isMissingProjectColumnError = (err) => String(err?.message || '').includes('project_name');

      if (editingQuoteId) {
        let { error: updateError } = await supabase.from('quotes').update({ ...quotePayload, ...attnFields, ...projectFields }).eq('id', editingQuoteId);
        if (updateError && isMissingProjectColumnError(updateError)) {
          ({ error: updateError } = await supabase.from('quotes').update({ ...quotePayload, ...attnFields }).eq('id', editingQuoteId));
        }
        if (updateError && isMissingAttnColumnError(updateError)) {
          ({ error: updateError } = await supabase.from('quotes').update(quotePayload).eq('id', editingQuoteId));
        }
        if (updateError) throw updateError;
        quoteId = editingQuoteId;

        // חוק ברזל (Codex P0-1 fix, ר' גם SQ-F02 למטה): שינוי-מבנה עשיר בלי
        // שינוי quantity/unit_price עדיין חייב לגרום לכתיבת הפריטים - לעולם
        // לא רק isFinancialEdit לבדו. בעבר כאן היה DELETE-הכל מוקדם על כל
        // ה-quote_items לפני הכתיבה-מחדש; הוא הוסר (SQ-F02, "canonical-ID
        // replacement risk") כי בלוק ה-UPSERT-לפי-id למטה (בתוך
        // `if (itemsForPersist)`) כבר מטפל בעצמו, ובאופן בטוח יותר, בכל
        // שלושת המקרים: עדכון-במקום לפריט קיים, הוספה לפריט חדש, ומחיקה
        // ממוקדת (removedItemIds) רק לפריט שהוסר-בפועל - DELETE-הכל מוקדם
        // כאן היה הורס בשקט את השורות שה-UPSERT מתכוון לעדכן, ומייצר בדיוק
        // את שגיאת ה-foreign-key שגילה ה-e2e (quote_item_measurements
        // מצביע ל-quote_item_id שכבר נמחק).
        if (!(isFinancialEdit || itemsStructurallyChanged)) {
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

        let { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{ ...quotePayload, ...attnFields, ...projectFields }]).select();
        if (quoteError && isMissingProjectColumnError(quoteError)) {
          ({ data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{ ...quotePayload, ...attnFields }]).select());
        }
        if (quoteError && isMissingAttnColumnError(quoteError)) {
          ({ data: quoteData, error: quoteError } = await supabase.from('quotes').insert([quotePayload]).select());
        }
        if (quoteError) throw quoteError;
        quoteId = quoteData[0].id;
      }

      // חוק ברזל (SQ-F02 FINAL CLOSURE task, 2026-09-14 - "single server-side
      // transactional save boundary"): sections/items/measurements now
      // persist through exactly ONE atomic RPC call (`save_quote_structured`,
      // TEST-only, applied via the isolated `supabase db query --linked`
      // mechanism - see PROFLOW_PROJECT_CONTEXT.md §174 for the full
      // isolation proof - never `supabase db push`, which would also apply
      // an unrelated, out-of-scope pending migration). A single top-level
      // Postgres function call is one implicit transaction - any exception
      // anywhere inside it rolls back every statement the function has run
      // so far, automatically. This REPLACES (not supplements) the prior
      // pass's sequential upsert-by-id calls: that pass closed SQ-F02's
      // canonical-ID-churn half but left a failure partway through able to
      // leave partial persisted state (an UPDATE that succeeds followed by
      // a later INSERT that fails was never rolled back) - the exact
      // multi-statement client-side sequence this task's own instructions
      // forbid ("the client must not perform a destructive pre-delete that
      // can leave partial state outside the transaction"). No fallback to
      // that old sequential path exists on purpose: falling back would
      // silently reintroduce the exact non-atomic risk this closes - every
      // error path here fails closed instead (a real RPC error rolls back
      // server-side already; a "function not found" scenario means this
      // environment truly cannot save safely, and must say so, not degrade
      // silently). SQ-F01's financial-authority function
      // (`calculateQuoteFinancials`) and SQ-F04's grouping engine are
      // untouched - this only changes the WRITE mechanism, never the
      // numbers/eligibility computed before it.
      if (quoteId) {
        const currentNamedSections = (sections || []).filter(s => (s.name || '').trim() !== '');
        const authoritativeSectionIds = new Set((authoritativeSections || []).map(s => s.id));
        const currentSectionIds = new Set(currentNamedSections.filter(s => s.id).map(s => s.id));
        const removedSectionIds = [...authoritativeSectionIds].filter(id => !currentSectionIds.has(id));

        const sectionsPayload = currentNamedSections.map((s, idx) => ({
          client_key: s.key,
          id: s.id || null,
          name: s.name,
          sort_order: s.sort_order != null ? s.sort_order : idx,
        }));

        const authoritativeItemIds = new Set((authoritativeItems || []).map((a) => a.id));
        const itemsPayload = itemsForPersist ? itemsForPersist.map((item, idx) => ({
          client_key: item.id || `new_${idx}`,
          id: item.id || null,
          section_client_key: item.section_key || null,
          description: item.description,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          total_price: getActiveQuantity(item) * Number(item.unit_price || 0),
          pricing_unit: item.pricing_unit || null,
          calculated_quantity: (item.calculated_quantity !== undefined && item.calculated_quantity !== '' && item.calculated_quantity !== null) ? Number(item.calculated_quantity) : null,
          quantity_source: item.quantity_source || null,
          specification: normalizeSpecificationRows(item.specification),
          calculation_method: item.calculation_method || null,
          sort_order: idx,
          measurements: (Array.isArray(item.measurements) ? item.measurements : [])
            .filter((m) => !(m.width === '' && m.height === ''))
            .map((m, mIdx) => ({
              width: m.width !== '' && m.width != null ? Number(m.width) : null,
              height: m.height !== '' && m.height != null ? Number(m.height) : null,
              unit: m.unit || 'm',
              calculated_area: m.calculated_area != null && m.calculated_area !== '' ? Number(m.calculated_area) : null,
              label: m.label || '',
              sort_order: mIdx,
              is_pricing_driving: m.is_pricing_driving !== false,
            })),
        })) : [];
        const currentItemIds = new Set((itemsForPersist || []).filter((it) => it.id).map((it) => it.id));
        const removedItemIds = itemsForPersist ? [...authoritativeItemIds].filter((id) => !currentItemIds.has(id)) : [];

        // הצעה חדשה: השדות הפיננסיים כבר נכתבו ב-INSERT הבודד (אטומי מטבעו)
        // למעלה - p_financial=null כאן מדלג במפורש על כתיבה כפולה. עריכה
        // לא-פיננסית: שום דבר פיננסי לא באמת השתנה (financialQuotePatch הוא
        // עותק מדויק של authoritativeQuote) - null גם כאן מדלג על כתיבה
        // מיותרת, בלי לשנות שום ערך בפועל.
        const financialForRpc = (editingQuoteId && isFinancialEdit) ? {
          currency: financialQuotePatch.currency,
          client_type: financialQuotePatch.client_type,
          tax_rate: financialQuotePatch.tax_rate,
          subtotal: financialQuotePatch.subtotal,
          discount: financialQuotePatch.discount,
          total: financialQuotePatch.total,
        } : null;

        const { error: rpcError } = await supabase.rpc('save_quote_structured', {
          p_quote_id: quoteId,
          p_financial: financialForRpc,
          p_sections: sectionsPayload,
          p_items: itemsPayload,
          p_removed_section_ids: removedSectionIds,
          p_removed_item_ids: removedItemIds,
        });

        if (rpcError) {
          // כל ענף-שגיאה כאן נכשל-בבטחה בתוך ה-RPC עצמו: הטרנזקציה בצד-השרת
          // כבר ביטלה (rollback) כל מה שהפונקציה הספיקה לכתוב בקריאה הזו -
          // לעולם אין כאן מצב-ביניים חלקי בתוך sections/items/measurements
          // עצמם, גם כשהשגיאה היא "הפונקציה לא קיימת" בסביבה שעדיין לא
          // הופעלה בה ה-migration.
          //
          // חוק ברזל (SQ-F02-B, "ONE-PASS SMART QUOTE FINAL REMEDIATION"
          // task): זה עצמו לא מספיק להצעה **חדשה** - ה-quote row עצמו (עם
          // quote_number/financial/status אמיתיים) כבר נוצר למעלה (INSERT
          // נפרד, אטומי בפני עצמו) *לפני* קריאת ה-RPC הזו. אם ה-RPC נכשל,
          // אותו שלד-הצעה כבר-קיים היה נשאר יתום לצמיתות: הצעה אמיתית,
          // גלויה למשתמש (למשל ברשימת ההצעות), עם 0 sections/items - בדיוק
          // מצב-הביניים החלקי שהמשימה אוסרת. פתרון: פעולת-פיצוי מפורשת
          // (compensating delete) שמוחקת את שלד ההצעה החדש שזה עתה נוצר,
          // אך ורק בענף ההצעה-החדשה (editingQuoteId היה null) - לעולם לא
          // בעריכת הצעה קיימת (שם quoteId === editingQuoteId, הצעה אמיתית
          // שהתקיימה כבר לפני הקריאה הזו, ואסור למחוק אותה). אם גם מחיקת-
          // הפיצוי עצמה נכשלת (תרחיש קצה נדיר), זה מדווח בנפרד ובכנות - לא
          // נבלע בשקט - כדי שלא תיווצר אשליית "בוטל במלואה" שגויה.
          if (!editingQuoteId) {
            const { error: compensatingDeleteError } = await supabase.from('quotes').delete().eq('id', quoteId);
            if (compensatingDeleteError) {
              setAlertModalMsg(isHebrew
                ? 'לא ניתן היה לשמור את מבנה ההצעה החדשה, וגם ניקוי שלד ההצעה שנוצר בטעות נכשל. אנא פנה לתמיכה - ייתכן שנותרה הצעה ריקה/שגויה.'
                : 'Could not save the new quote\'s structure, and cleaning up the accidentally-created quote shell also failed. Please contact support - an empty/invalid quote may remain.');
              return;
            }
          }
          setAlertModalMsg(isHebrew
            ? 'לא ניתן היה לשמור את מבנה ההצעה (יחידות/פריטים/מידות) בסביבה הנוכחית. השמירה בוטלה במלואה כדי למנוע פגיעה בנתונים - שום שינוי חלקי לא נשמר.'
            : 'Could not save this quote\'s structure (units/items/measurements) in the current environment. The entire save was cancelled to protect data - no partial change was persisted.');
          return;
        }
      }

      const attachmentFailures = [];
      for (let file of quoteFiles) {
        if (!file.id) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${quoteId}_${Date.now()}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;
          const { error: uploadErr } = await supabase.storage.from('quote-files').upload(filePath, file);
          if (uploadErr) { attachmentFailures.push(file.name); continue; }
          const { data: { publicUrl } } = supabase.storage.from('quote-files').getPublicUrl(filePath);
          const { error: attInsertErr } = await supabase.from('quote_attachments').insert([{
            quote_id: quoteId,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            storage_path: filePath
          }]);
          if (attInsertErr) attachmentFailures.push(file.name);
        }
      }
      // EXISTING attachments the user removed were only STAGED in the editor; they are deleted now, after the quote itself saved.
      let removalFailed = false;
      if (pendingAttachmentRemovals.length > 0) {
        const { error: removeErr } = await supabase.from('quote_attachments').delete().in('id', pendingAttachmentRemovals).eq('quote_id', quoteId);
        if (removeErr) removalFailed = true; else setPendingAttachmentRemovals([]);
      }

      if (attachmentFailures.length > 0 || removalFailed) {
        // The quote IS saved, but a required stage failed: keep the draft. The editor continues on the SAVED quote (so pressing
        // Save again cannot create a duplicate) with only the failed files still pending.
        await quoteDraft.discard();
        captureCleanRef.current = true;
        setEditBaselineFingerprint(null);
        setEditCleanHash(null);
        setNewDraftUuid(null);
        setIsCreatingQuote(false);
        setEditingQuoteId(quoteId);
        const { data: attNow } = await supabase.from('quote_attachments').select('*').eq('quote_id', quoteId);
        setQuoteFiles([...(attNow || []).map((f) => ({ ...f, size: f.file_size })), ...quoteFiles.filter((f) => !f.id && attachmentFailures.includes(f.name))]);
        setAlertModalMsg(isHebrew
          ? `ההצעה נשמרה, אך חלק מהצירופים לא הושלמו${attachmentFailures.length ? ` (העלאה נכשלה: ${attachmentFailures.join(', ')})` : ''}${removalFailed ? ' (מחיקת צירוף קיים נכשלה)' : ''}. הטיוטה נשמרה - אפשר לנסות שוב לשמור.`
          : `The quote was saved, but some attachment steps did not complete${attachmentFailures.length ? ` (upload failed: ${attachmentFailures.join(', ')})` : ''}${removalFailed ? ' (removing an existing attachment failed)' : ''}. Your draft is kept - you can try saving again.`);
        loadData(session.user.id, session.user.email);
        return;
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
          : (isHebrew ? `הצעת המחיר הופקה ונשמרה בענן בהצלחה! סה"כ: ${sym}${formatMoneyDisplay(newQuoteFinancials.total)}` : `Quote successfully created and saved to cloud! Total: ${sym}${formatMoneyDisplay(newQuoteFinancials.total)}`),
        type: 'success'
      });
      
      await quoteDraft.discard(); // the draft is removed only after ALL required save stages succeeded
      setEditingQuoteId(null);
      setIsCreatingQuote(false);
      resetQuoteFormFields();
      setRecoveredDraftInfo(null);
      setNewDraftUuid(null);
      loadData(session.user.id, session.user.email);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setAlertModalMsg((isHebrew ? 'שגיאה בשמירת ההצעה: ' : 'Error saving quote: ') + err.message);
    }
  }

  // חוק ברזל (Quote History Search root-cause task, 2026-09-08 - שורש-
  // הבעיה שהבעלים דיווח עליו): "מס' הצעה" בחיפוש היה quote.id הגולמי
  // (UUID פנימי, ללא שום קשר למספר-ההזמנה המוצג בפועל, "A57") - אותו
  // class-of-bug שכבר תוקן פעם אחת עבור המיון למטה (getQuoteOrderSortKey)
  // אבל מעולם לא הוחל כאן. quoteMatchesSearch (quoteSearch.js) הוא עכשיו
  // מקור-האמת היחיד לחוזה-החיפוש - נבדק ישירות (בדיקות טהורות משלו), לא
  // רק דרך המסך.
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quoteMatchesSearch(quote, searchTerm);
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

  // Admin Users Table - Truthful Data Only (Owner-binding V1 rule): the
  // prior default sort ('default_online') ranked accounts by last-sign-in
  // recency, an "active now" inference the Owner's Admin V1 spec explicitly
  // forbids ("no active-now from weak timestamps", "no untrustworthy
  // last-login/online indicators"). Default sort is now created_at desc
  // (newest registration first, per spec §2.2) - plain string comparison
  // below already sorts ISO 8601 timestamps correctly with no special case.
  const filteredAdminAccounts = allAccounts.filter(acc => {
    const term = adminSearchTerm.toLowerCase();
    return (acc.email && acc.email.toLowerCase().includes(term)) ||
           (acc.business_name && acc.business_name.toLowerCase().includes(term));
  }).sort((a, b) => {
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
        confirmPasswordInput={confirmPasswordInput}
        setConfirmPasswordInput={setConfirmPasswordInput}
        handleUpdatePasswordFromRecovery={handleUpdatePasswordFromRecovery}
        recoveryUpdateLoading={recoveryUpdateLoading}
        recoveryUpdateMsg={recoveryUpdateMsg}
        recoveryUpdateMsgIsError={recoveryUpdateMsgIsError}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        authSuccess={authSuccess}
        authError={authError}
        handleAuth={handleAuth}
        authLoading={authLoading}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        forgotOpen={forgotOpen}
        setForgotOpen={setForgotOpen}
        resetMsg={resetMsg}
        resetMsgIsError={resetMsgIsError}
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
    <div className="dash-app-shell" dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: isHebrew ? FONT_HE : FONT_EN, background: NEON.bg, color: NEON.textPrimary, minHeight: '100vh', display: 'flex', flexDirection: 'column', letterSpacing: '-0.01em', overflowX: 'clip' }}>

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
        /* TEKANGO — Dynamic Greeting + Inner Table Scrollbar Top-Anchor
           task (2026-09-18), Part 1 (Owner-corrected round): a real CSS
           keyframes entrance, not a React-state-driven opacity transition
           (the earlier attempt's own transition-based version compressed
           into a single frame in practice and was never visibly
           perceptible - a genuine timing race between React's commit and
           requestAnimationFrame, not a CSS defect). This class is applied
           unconditionally to whichever phase's span is currently mounted
           (see the key-based remount in the JSX below) - a real
           DOM-insertion event every time, which the browser's own
           animation engine always starts from 0%, independent of React's
           own render/commit timing. display:inline-block is required for
           transform to actually apply to inline text content. 520ms,
           ease-out-quint-shaped cubic-bezier (soft settle, zero bounce/
           overshoot) - within the Owner's own 350-650ms recommended
           range. The "both" fill-mode holds the 100% (settled) state after
           the animation completes, rather than snapping back to the
           un-animated default. */
        @keyframes dashHeaderGreetingEnter {
          from { opacity: 0; transform: translateY(-14px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dash-header-greeting-text {
          display: inline-block;
          animation: dashHeaderGreetingEnter 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        /* Stacked date/time: DATE (DD.MM.YYYY or MM.DD.YYYY, full year) on the
           top line, TIME below it, both smaller than the greeting. The block
           stays inside the same header title slot - no extra header row. */
        .dash-header-datetime {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          line-height: 1.1;
          font-variant-numeric: tabular-nums;
        }
        .dash-header-datetime .dash-header-date {
          font-size: 0.86rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .dash-header-datetime .dash-header-time {
          font-size: 0.72rem;
          font-weight: 700;
          opacity: 0.8;
          white-space: nowrap;
        }
        /* Narrow desktop/tablet (769-1000px): the 3-column header grid cannot
           fit badge + KPI block + full-year date side by side (the columns
           overflow into each other), so this band uses the same wrapped
           composition as mobile: date + Chat + badge on row 1, KPI block
           on row 2. Wide desktop (>1000px) keeps the original grid. */
        @media (min-width: 769px) and (max-width: 1000px) {
          .dash-header-row {
            display: flex;
            flex-wrap: wrap;
            column-gap: 10px;
            row-gap: 8px;
          }
          /* Zero geometry jump: the title slot always reserves the stacked
             date/time block's height, so greeting -> date/time never resizes the row. */
          .dash-header-title { order: 1; flex: 0 0 auto; min-height: 34px; display: flex; align-items: center; }
          .dash-header-badge-desktop { order: 2; margin-inline-start: auto; }
          .dash-header-stats { order: 3; flex-basis: 100%; justify-content: flex-start; }
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
          /* Mobile ONE-ROW contract: date/time (title) + AI Chat + plan
             badge share ONE row; stats stay on their own row below (the
             old separate badge row is gone). Sizes tighten, nothing wraps
             or truncates. */
          .dash-header-row {
            flex-wrap: wrap;
            column-gap: 6px !important;
            row-gap: 8px;
            align-items: center;
          }
          .dash-header-title {
            order: 1;
            flex: 0 0 auto;
            overflow: visible !important;
            /* Zero geometry jump: reserve the stacked date/time height from the start. */
            min-height: 34px;
            display: flex;
            align-items: center;
          }
          .dash-header-title .dash-header-datetime .dash-header-date { font-size: 0.76rem; }
          .dash-header-title .dash-header-datetime .dash-header-time { font-size: 0.66rem; }
          .dash-header-badge-mobile {
            margin-inline-start: auto;
            gap: 4px !important;
            min-width: 0;
          }
          .dash-header-badge-mobile .dash-header-ai-btn {
            height: 30px;
            padding: 0 6px;
            gap: 3px;
            font-size: 0.68rem;
          }
          .dash-header-badge-mobile .dash-header-ai-btn > span:first-child {
            width: 18px;
          }
          .dash-header-badge-mobile > span,
          .dash-header-badge-mobile > button > span {
            padding: 4px 5px !important;
            gap: 3px !important;
            min-height: 26px !important;
          }
          .dash-header-badge-mobile > span span,
          .dash-header-badge-mobile > button > span span {
            font-size: 0.62rem !important;
            gap: 3px !important;
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
          /* MOBILE WORKSPACE PRIORITY LAW (TEKANGO_AI_ARCHITECTURE.md §44): measured 178px (21% of an 844px
             viewport) for ~38px of text - 30px top padding + a marketing tagline + 100px bottom reserve. On mobile the
             authenticated workspace keeps ONLY the accessibility link (the tagline is redundant inside the signed-in
             app and stays on desktop), with small top/bottom padding: clearance of the fixed bottom nav is already provided ONCE by
             .dash-main-content's padding-bottom (the single mobile bottom inset), so the old 100px footer reserve
             was a duplicate. */
          .dash-footer {
            padding: 4px 12px 12px !important;
            border-top: none !important;
          }
          .dash-footer-brand {
            display: none !important;
          }
          .dash-footer button {
            min-height: 32px;
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
          /* Sidebar/Header Top Alignment Polish (Owner-approved, this round):
             top corners only, matching .dash-upper-section's own RADIUS.lg -
             physical top-left/top-right (not inline-start/end), since "top"
             is a vertical concept unaffected by RTL/LTR mirroring. Bottom
             corners stay square (0, unchanged) - the sidebar still meets the
             shell's own bottom edge flush, only its new top edge (see the
             margin-top/height pair below, desktop-only) floats and needs
             rounding to read as one composition with the header. */
          border-top-left-radius: ${RADIUS.lg};
          border-top-right-radius: ${RADIUS.lg};
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
        /* ONE responsive static-block / inner-body scroll contract (all
           viewports: desktop, tablet landscape/portrait, mobile). The app
           shell is a fixed-height column; the canonical Header and each
           screen's static block (title/controls/column header) never scroll;
           ONLY the screen's inner body scrolls, and only when it overflows.
           Responsive differences change layout (cards/columns/spacing) - never
           what is sticky or what owns scroll. The former desktop-only media
           query made compact viewports fall back to natural page scroll, which
           let screen controls scroll away under a still-sticky Header.
             .pf-screen       the screen card: flex column under the Header.
             .pf-screen-body  the ONLY vertical scroll owner (begins exactly
                              where the static block ends).
             .pf-head-gutter  static column-header row aligned with the body.
           min-height:0 on every flex link is required (default min-height:auto
           would grow the parent instead of scrolling the child). */
        .dash-app-shell {
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
        }
        .dash-shell-outer {
          min-height: 0;
          height: 100%;
        }
        .dash-shell-body {
          min-height: 0;
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
        .pf-screen {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
        }
        .pf-screen > * {
          flex: 0 0 auto;
        }
        .pf-screen > .pf-screen-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          scrollbar-gutter: stable;
          padding-top: 12px;
        }
        /* Children of the scroll body never shrink to fit - they scroll. (A flex
           column body would otherwise squash overflow:hidden cards/rows to ~0px
           when the body is height-constrained, making them untappable.) */
        .pf-screen > .pf-screen-body > * {
          flex-shrink: 0;
        }
        /* Content-dependent scrollbar: track always drawn only where a screen
           explicitly opts in (e.g. a short Catalog). */
        .pf-screen > .pf-screen-body.pf-screen-body--track {
          overflow-y: scroll;
        }
        /* The gap between the static block and the body is the body's own
           padding-top (scrolls with content), never a margin on the static
           block - so body top == static block bottom exactly. */
        .pf-screen > :has(+ .pf-screen-body),
        .pf-screen > .pf-head-gutter {
          margin-bottom: 0 !important;
        }
        .pf-screen > .pf-head-gutter + .pf-screen-body {
          padding-top: 0;
        }
        .pf-screen > .pf-head-gutter {
          overflow: hidden;
          scrollbar-gutter: stable;
        }
        @media (min-width: 769px) {
          /* Desktop-only: sidebar top alignment with the Header card (16px
             = .dash-main-content's own inline padding). */
          .dash-sidebar {
            height: calc(100% - 16px);
            margin-top: 16px;
          }
        }
        @media (max-width: 768px) {
          /* The fixed bottom nav overlays the viewport bottom: keep the
             scroll body's last rows clear of it (the ONLY mobile bottom inset). */
          .dash-main-content {
            padding-bottom: calc(66px + env(safe-area-inset-bottom, 0px)) !important;
          }
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
        /* TEKANGO — Critical Header Correction task (2026-09-18): the Owner
           identified this element as reading like a "thin legacy top
           strip" rather than a real business Header, now that it carries
           real content (identity, plan/trial badge, AI Chat, dynamic info -
           see the entitlement/dynamic props wired in the JSX below). The
           gradient-wash/border-bottom "seam" treatment above (Cross-Surface
           Visual Consolidation §9) is left untouched (it is cross-
           referenced by the RTL/LTR sidebar-position logic and by real
           visual-review history this task does not have the Owner's own
           updated reference image to safely re-litigate) - padding is
           increased and a real shadow added instead, the smallest safe
           change that gives this element genuine header-level visual
           weight without touching its established geometry/seam contract.
           Final pixel-level visual acceptance is Owner-pending regardless
           (see this task's own final report), same standing discipline as
           every other UI change in this project. */
        .dash-topbar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 16px 20px;
          background: ${SHELL.sidebarBg};
          border-bottom: 1px solid ${SHELL.sidebarBorder};
          box-shadow: ${SHADOW.sm};
          flex-wrap: wrap;
          row-gap: 10px;
        }
        .dash-topbar-identity {
          font-weight: 800;
          font-size: 1rem;
          color: ${SHELL.sidebarTextActive};
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
        .dash-topbar-identity { order:0; }
        .dash-topbar-actions { order:1; margin-inline-start:auto; }
        /* Unified Header + Always-Available AI Chat task, §9 "Header
           Contract": the new optional Dynamic/Entitlement regions, both
           rendered inside the pre-existing .dash-topbar-trailing wrapper
           (see AuthenticatedShellFrames.jsx's own comment on why it exists
           - preserving the 2-region space-between layout regardless of how
           many optional slots are filled). flex-shrink:0 on both matches
           .dash-topbar-actions' own established convention (never let a
           fixed-size chrome element get crushed before the flexible
           identity text does). */
        .dash-topbar-trailing { display:flex; align-items:center; gap:12px; flex-shrink:0; }
        .dash-topbar-dynamic { flex-shrink:0; }
        .dash-topbar-dynamic-text {
          font-size: 0.76rem;
          font-weight: 600;
          color: ${SHELL.sidebarTextMuted || SHELL.sidebarTextActive};
          opacity: 0.75;
          white-space: nowrap;
        }
        .dash-topbar-entitlement { flex-shrink:0; }
        /* §11 "no Header height growth", real-estate discipline: the
           Dynamic (clock/date) slot is the least essential of the new
           regions when width is genuinely tight - hidden below this
           breakpoint so the already-populated Mobile topbar (identity + AI
           entry + entitlement badge) never risks horizontal overflow: the
           Entitlement badge (real product information: plan/trial status)
           and the AI Chat entry both stay visible at every width, only the
           supplementary clock text is width-gated. */
        @media (max-width: 640px) {
          .dash-topbar-dynamic { display: none; }
        }
        .dash-topbar-ghost-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: ${RADIUS.pill};
          border: 1px solid ${SHELL.sidebarBorder};
          background: rgba(255,255,255,0.06);
          color: ${SHELL.sidebarText};
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
        }
        /* Already reachable, desktop-only, from the sidebar's own utility
           zone (isSuperAdmin-gated) - hidden here on desktop so it is never
           a second, duplicate "AI Support Logs" control once the topbar
           itself becomes visible at every viewport (see below). */
        @media (min-width: 769px) {
          .dash-topbar-ghost-btn {
            display: none;
          }
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
        /* TEKANGO — Header + Sidebar Correction task (2026-09-18): the ONE
           AI Chat entry point's own button styling, rendered inside
           dash-upper-section's rich card - the ONE canonical Header, now
           rendered on every business screen (see its own gate below), not
           a second reduced variant.
           Header Package/Chat Order Correction task (2026-09-18): widened
           from a round icon-only 36x36 button into a labeled pill (height
           UNCHANGED at 36px, so the Header's own overall height is
           unaffected - only width grows to fit the now-required visible
           "צ׳אט AI"/"AI Chat" label - "Do not use icon-only Chat in this
           Header"). border-radius switched from a fixed 50% circle to the
           project's own existing pill token (RADIUS.pill, already used by
           this exact same button in its prior, now-retired topbar/sidebar
           locations) since a 36px-tall non-square button cannot be a true
           circle. */
        .dash-header-ai-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px;
          background: rgba(124,58,237,0.22);
          border: 1px solid rgba(167,139,250,0.40);
          border-radius: ${RADIUS.pill};
          color: #f0abfc;
          font-weight: 700;
          font-size: 0.78rem;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
        }
        .dash-header-ai-btn:hover {
          background: rgba(124,58,237,0.32);
        }
        .dash-header-ai-btn:focus-visible {
          outline: 2px solid #a78bfa;
          outline-offset: 1px;
        }
        /* TEKANGO Admin V1 (Task 1, shared dark shell - Owner-corrected):
           the prior "Desktop Header Removal" task hid this topbar entirely
           above 768px, so My Business had no persistent Header on desktop
           at all - only the sidebar. The Owner has since explicitly
           corrected this: Admin and My Business must share ONE dark navy
           Header, visible on desktop too ("Desktop: Header remains
           visible. Sidebar remains visible."), not just on mobile. The
           topbar is therefore no longer desktop-hidden - it is recolored
           to the same SHELL navy as the sidebar (above) and stays mounted
           at every viewport. The AIChatWidget mount and the status toast
           remain the separate, position:fixed overlays they already were
           (unaffected by this - they never depended on the topbar's own
           visibility either way). */

        @media (max-width: 768px) {
          .dash-sidebar {
            display: none;
          }
          .dash-topbar-bizname {
            max-width: 140px;
            font-size: 0.9rem;
          }
          /* ONE mobile/tablet-portrait shell top-anchor (root-cause closure):
             the retired fixed .dash-topbar left a 72px spacer here that kept
             reserving space above the canonical Header (a blank band). The
             only external top inset is the real platform safe-area, owned in
             this single place - no screen reserves space above the Header.
             The Header itself is static above the inner scroll body on EVERY
             viewport (see the one responsive scroll contract above). */
          .dash-main-content {
            padding-top: calc(env(safe-area-inset-top, 0px) + 6px) !important;
          }
        }


        .dash-topbar-global { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; min-width:0; min-height:31px; }
        .dash-topbar-identity { display:flex; align-items:center; gap:12px; flex:1; overflow:hidden; }
        .dash-topbar-summary { width:100%; min-width:0; display:flex; flex-direction:column; gap:12px; }
        .dash-drawer-toggle,.dash-drawer-close { display:none; }
        @media (min-width:769px) { .dash-topbar-actions .dash-topbar-ghost-btn { display:none; } }
        @media (max-width:768px) {
          .dash-drawer-toggle,.dash-drawer-close { display:flex; min-height:44px; min-width:44px; align-items:center; justify-content:center; }
          .dash-operator-sidebar { display:none; position:fixed; inset-block:0; inset-inline-start:0; width:min(280px,calc(100vw - 44px)); height:100dvh; z-index:10001; overflow-y:auto; border-radius:0; }
          .dash-operator-sidebar.dash-sidebar-open { display:flex; }
          .dash-operator-sidebar .dash-sidebar-btn { min-height:44px; }
          .dash-topbar-global { gap:6px; }
          .dash-topbar-identity { gap:6px; }
          .dash-topbar-identity .dash-topbar-bizname { max-width:100%; }
          .dash-topbar-actions { gap:6px; flex-shrink:0; }
          /* Mobile/Tablet AI Entry Discoverability task (Owner correction,
             2026-09-18): the prior rule below forced icon-only by hiding
             the label span - the Owner found this unclear ("not obvious
             it opens AI Chat") and asked for a visible label on Mobile/
             Tablet, matching the Desktop sidebar's own "צ׳אט AI"/"AI Chat"
             text exactly (same JSX span, same text, no new copy). Height
             stays min-height:44px (touch target unchanged); padding grows
             horizontally only, to fit the label - width is intentionally
             no longer pinned to min-width:44px alone since the button now
             needs to be wider than it is tall. .dash-topbar-actions'
             existing flex-shrink:0 (unchanged) already lets .dash-topbar-
             identity's bizname ellipsis absorb the extra width, exactly
             as it already does for the ghost button beside it. */
          .dash-topbar-ai-btn { min-height:44px; padding:6px 12px; }
          .dash-topbar-ghost-btn { min-width:44px; min-height:44px; padding:6px; }
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
        <AIChatWidget isHebrew={isHebrew} isDashboard={true} currentArea={showPricingModal ? 'plans' : activeTab} businessDisplayName={(bizName && bizName !== 'TEKANGO' && bizName !== 'עסק חדש' && bizName !== 'New Business') ? bizName : null} workflowContext={quoteWorkflowContext} activeEditingQuoteId={showQuoteForm ? (editingQuoteId || null) : null} />
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
        isLifetime={isLifetime}
        userId={session?.user?.id}
        onPlanUpdated={() => loadData(session?.user?.id, session?.user?.email)}
        currency={currency}
      />

      <DraftConflictModal conflict={draftConflict} isHebrew={isHebrew} onReview={() => resolveDraftConflict('review')} onUseSaved={() => resolveDraftConflict('saved')} onDiscard={() => resolveDraftConflict('discard')} />

      <SignOutModal 
        isOpen={showSignOutModal} 
        hasUnsavedDraft={showQuoteForm && quoteDraft.isDirty()}
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
      {shellDrawerOpen && <div className="dash-drawer-backdrop no-print" onClick={() => setShellDrawerOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:10000 }} />}
      <div className="dash-shell-body">
        <AuthenticatedSidebarFrame drawerEnabled={false} open={shellDrawerOpen} onClose={closeShellDrawer} isHebrew={isHebrew}>
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
              <>
            {(
              <button onClick={handleCreateNewQuoteClick} className="dash-sidebar-cta">
                <PlusCircle size={17} strokeWidth={2.4} />
                {isHebrew ? 'הצעת מחיר חדשה' : 'New Quote'}
              </button>
            )}

            {/* חוק ברזל (Functional Parity Across Viewports task, 2026-09-08):
                מקור-האמת עבר ל-getDashboardNavCapabilities (src/utils/
                dashboardNavCapabilities.js) - בדיוק אותה רשימה, מסוננת לפי
                אותו isSuperAdmin, נצרכת גם ע"י Mobile bottom-nav/More למטה.
                סדר/תוכן/onClick זהים-בייט למערך הקודם שהיה מקומי כאן. */}
            {navCapabilities.filter(({ id }) => id !== 'admin_clients').map(({ id, icon: TabIcon, label }) => (
              <button
                key={id}
                className={activeTab === id ? 'dash-sidebar-btn dash-sidebar-btn-active' : 'dash-sidebar-btn'}
                onClick={() => { setActiveTab(id); setIsCreatingQuote(false); setEditingQuoteId(null); }}
              >
                <TabIcon size={17} strokeWidth={2.2} />
                <span>{label}</span>
              </button>
            ))}

            {/* TEKANGO — Critical Header Correction task (2026-09-18), §3.A
                "SIDEBAR AI CHAT BUTTON REMOVAL": this sidebar AI Chat action
                (added by the earlier Final Dashboard/Sidebar Polish/
                Authenticated UI Coherence tasks) is retired - the Owner's
                explicit correction is that the canonical business Header
                (not the sidebar) is now the one global Chat entry point
                across every authenticated viewport, including Desktop/
                Tablet Landscape where this was previously the ONLY entry.
                Removed entirely, not hidden/disabled - "no hidden, disabled,
                duplicate, or secondary Sidebar Chat launcher". The
                open-proflow-ai-chat CustomEvent itself, AIChatWidget's own
                mount, and this button's identical admin-mode
                counterpart (see below, also removed by this same task) are
                the only other things this touches - no second chat
                implementation ever existed here to begin with. */}

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
            {isSuperAdmin && (
              <AdminSidebarNav
                section={isAdminMode ? adminSection : null}
                onSelect={navigateToAdminSection}
                isHebrew={isHebrew}
              />
            )}
              </>
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
            {/* Header Correction task, §3.A: the admin-mode sidebar AI Chat
                launcher is retired too - same reasoning as the business-nav
                one removed above, no exception for Admin. */}
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
            {/* AI Support Logs is a registry destination (Admin group above), not a utility breakout. */}
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
        </AuthenticatedSidebarFrame>

        <div className="dash-shell-main">
          {/* TEKANGO — Owner Header Reference Correction task (2026-09-18),
              §2 "LEGACY TOP STRIP: RETIRE" / "LEGACY TOP STRIP DEPENDENCY:
              ZERO": fully retired for the BUSINESS context - AI Chat, the
              plan badge, and identity all live in the canonical business
              Header now (dash-upper-section's rich card / dash-persistent-
              header's compact one, see below), so this element has nothing
              left to contribute there. Kept mounted for ADMIN ONLY, where
              it still hosts real, not-yet-migrated functionality this
              narrowly-scoped correction did not attempt to move (the Admin
              title/KPI summary and the mobile Admin sidebar-drawer toggle -
              Admin's own shell is a separate, actively-evolving lineage;
              see this task's own final report for this disclosed, deliberate
              scope boundary, not a silent gap). Admin itself is explicitly
              still required to "keep the same outer Header architecture" -
              this remains the same single AuthenticatedHeaderFrame
              component either way, never a second one. */}
          {/* Unified Admin: no Admin-specific Header. The canonical business Header
              (dash-upper-section, below) renders for every authenticated screen,
              Admin destinations included. */}

      <div className="dash-main-content" style={{ flex: '1 1 auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
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
        {/* חוק ברזל (UI Stability + Hot Quote Forensic Check task,
            2026-09-08, "FOOTER — ALWAYS AT THE BOTTOM"): זהו ההורה הישיר
            האמיתי של dash-upper-section/כרטיס QuotesTab/ה-footer (לא
            dash-main-content עצמו, למרות השם - ר' ההערה שם) - טריק ה-
            marginTop:'auto' של ה-footer דורש ש*ההורה הישיר* שלו יהיה
            flex-column עם שטח-פנוי אמיתי לספוג, לא הורה רחוק יותר. flex:
            '1 1 auto'+minHeight:0 ממלאים בדיוק את השטח שנותר בתוך
            dash-main-content (שכבר flex-column+overflow-y:auto, קבוע-
            גובה אמיתי מהשרשרת הקיימת) - עכשיו ה-footer באמת נדחף לתחתית
            כשהתוכן קצר, ומופיע אחרי סוף התוכן כשהוא ארוך, בלי מספר-קסם. */}
        <div className="dash-content-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>

          {/* TEKANGO — Header + Sidebar Correction task (2026-09-18): the
              earlier "compact fallback header for every screen but
              Overview" attempt (dash-persistent-header) is retired - the
              Owner's explicit correction is that the SAME canonical
              Header (not a reduced variant) must render on every business
              screen. The rich card immediately below (dash-upper-section)
              is now that one header everywhere - see its own gate,
              widened from Overview-only to every non-Admin business
              screen, immediately below this comment. */}

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
          {/* חוק ברזל (Header UI Dark-Panel Correction, systemic remediation
              task, 2026-09-09, Owner-requested): the top workspace panel now
              uses the exact same background/border as the sidebar
              (SHELL.sidebarBg/sidebarBorder) instead of white - "the same
              visual language as the sidebar." borderRadius is left
              unchanged (RADIUS.lg, already the app's established radius
              scale) per "preserve rounded corners consistent with the
              sidebar" - not reduced to the sidebar's own edge-to-edge zero-
              radius, which would look wrong on a floating card. Every text/
              icon color inside this section (greeting, stats, Hot Quote,
              plan badge) is updated below to the same SHELL.sidebarText*
              tokens the sidebar itself already uses for its own text -
              readability is proven, not assumed: see the live HE/EN,
              Desktop/Mobile verification in this task's own report. No
              business logic changed anywhere in this block. */}
          {/* TEKANGO — Header + Sidebar Correction task (2026-09-18): gate
              widened from Overview-only (activeTab==='main' && !showQuoteForm)
              to every non-Admin business screen - the Owner's own explicit
              correction that the SAME canonical Header (this exact block,
              not a reduced variant) must appear on every business screen,
              New Quote/Edit Quote/Clients/Settings/Finances/Catalog/Plans
              included. isSuperAdmin is still excluded (Admin's own Header
              treatment is a separate, out-of-scope lineage, unchanged by
              this task). */}
          {(
          <div ref={setUpperSectionNode} className="dash-upper-section" style={{ position: 'relative', background: SHELL.sidebarBg, border: `1px solid ${SHELL.sidebarBorder}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.sm, padding: '14px', marginBottom: '16px', transition: 'height 0.2s ease' }}>

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
          {(() => {
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
                    onDark
                  />
                </button>
              ) : (
                <PlanIdentityBadge
                  displayIdentity={displayIdentity}
                  isHebrew={isHebrew}
                  variant="compact"
                  singleLine={singleLine}
                  daysLeft={displayIdentity === 'FREE_TRIAL' ? trialDaysLeft : null}
                  onDark
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
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: SHELL.sidebarText }}>
                      {isHebrew ? 'סה״כ הצעות:' : 'Total Quotes:'}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: SHELL.sidebarTextActive }}>
                      {totalQuotesCount}
                    </span>
                  </span>
                  {!isPro && (
                    <span style={{ fontSize: '0.62rem', color: DARK_ACCENT.amber, fontWeight: '700', whiteSpace: 'nowrap' }}>
                      {isHebrew ? `החודש: ${monthlyQuotesCount}/${planLimit}` : `This month: ${monthlyQuotesCount}/${planLimit}`}
                    </span>
                  )}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '5px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: SHELL.sidebarText }}>
                    {isHebrew ? 'סך הכנסות:' : 'Total Revenue:'}
                  </span>
                  <span className="pf-money" style={{ fontSize: '1.05rem', fontWeight: '800', color: SHELL.sidebarTextActive }}>
                    {sym}{formatMoneyDisplay(totalRevenue)}
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
                  {/* Dynamic Greeting task (2026-09-18, corrected round):
                      same element/position/reserved grid column as before -
                      the OUTER <h1> never animates and never changes size
                      ("GREETING SLOT: SAME X/Y/WIDTH/HEIGHT"); only the
                      INNER <span>, keyed per phase, actually animates. Each
                      time `key` changes (mount → 'greeting'; swap →
                      'datetime'), React inserts a genuinely NEW DOM node,
                      which the .dash-header-greeting-text CSS class's own
                      @keyframes animation (see the <style> block above)
                      always runs from its real 0% frame - no JS timing
                      race, no dependency on when React happens to commit. */}
                  <h1
                    ref={greetingRef}
                    className="dash-header-title"
                    style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      lineHeight: 1.2,
                      color: SHELL.sidebarTextActive,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span key={showGreeting ? 'greeting' : 'datetime'} className={showGreeting ? 'dash-header-greeting-text' : 'dash-header-greeting-text dash-header-datetime'}>
                      {showGreeting ? (isHebrew ? `ברוך שובך` : `Welcome back`) : headerDateTimeText}
                    </span>
                  </h1>

                  {statsRow}

                  {/* TEKANGO — Owner Header Reference Correction task
                      (2026-09-18): the Owner's own screenshot confirms THIS
                      dark rounded card (Frame A / dash-upper-section) is the
                      one canonical business Header - AI Chat now renders
                      here, next to the plan badge, inside the SAME grid
                      column (never as a 4th top-level grid child, which
                      would break the "real 3-column grid, centered
                      relative to the entire workspace" contract documented
                      immediately above). Reuses renderHeaderAIChatButton,
                      defined once at the top of this component and shared
                      with every render site - no second implementation.
                      TEKANGO — Header Package/Chat Order Correction task
                      (2026-09-18): DOM order is chat-then-badge, not badge-
                      then-chat - under this row's own inherited RTL
                      direction, the FIRST DOM child lands at the
                      container's own inline-start (physically the RIGHT
                      edge of this small sub-group), so putting the badge
                      SECOND in the DOM places it at the sub-group's
                      inline-end (physically LEFT) - the header's own
                      absolute outermost-left position, exactly the Owner's
                      "PACKAGE BADGE LEFTMOST" requirement, with Chat
                      immediately to its right (physically, between the
                      badge and the rest of the header). Same single DOM
                      order, mirrored by dir, convention used everywhere
                      else in this file - no isHebrew-conditional branch:
                      under EN/LTR the identical order places the badge at
                      this sub-group's own inline-end (physically RIGHT,
                      since LTR flips which physical side "end" is), the
                      logically-equivalent "outermost, farthest from the
                      greeting" position for that language, per the Owner's
                      own explicit "logical/flex ordering, not a hardcoded
                      direction-specific DOM order" instruction. */}
                  <div className="dash-header-badge-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {renderHeaderAIChatButton()}
                    {renderPlanBadge(false)}
                  </div>
                  <div className="dash-header-badge-mobile" style={{ display: 'none', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {renderHeaderAIChatButton()}
                    {renderPlanBadge(true)}
                  </div>
                </div>

              {/* חוק ברזל (Dashboard Header Compression, Hot Quote): כרטיס-
                  KPI ענק (רדיוס 14px, ריפוד 16px, אייקון עגול 40px) הפך
                  להתראה דקה חד-שורתית (~44px), בתוך Frame A עדיין (ר'
                  ההערה למעלה על עוגן ה-Trial Notice). יציבות-הגיאומטריה
                  הקיימת (רוטציית-4-שניות בין שמות-לקוח משתנים) נשמרת
                  באמצעות overflow/whiteSpace/textOverflow על שורה אחת,
                  לא עוד line-clamp דו-שורתי, כי כל ה"כרטיס" עצמו עכשיו
                  שורה אחת בלבד. אפקט-הרחבה: לחיצה עוד/מקלדת חושפת את
                  הטקסט המלא (ללא קיצוץ) בשורה שנייה - state מקומי טהור,
                  לא לוגיקה עסקית חדשה - ו"תצפה בהצעה" אמיתית (getQuoteViewLink
                  המקביל, אותה נוסחת קישור-ציבורי-לפי-מטבע שכבר קיימת ב-
                  QuotesTab.jsx, לא בדויה).

                  חוק ברזל (UI Stability + Hot Quote Forensic Check task,
                  2026-09-08, Owner-authorized): התיבה עצמה מוצגת תמיד עכשיו
                  (לא עוד `hotQuotesList.length > 0 &&` שמדלג על כל הבלוק) -
                  שורש התקלה שהבעלים דיווח עליה (ההצעה החמה "נעלמה" מהדשבורד
                  של David Aluminum) נחקר ואומת: אין שום שינוי קוד בכלל
                  בנוסחת-הזכאות של Hot Quote (view_count>=3 && status!==
                  'approved' && status!=='paid', בדיוק כמו קודם, לא נגעתי בה)
                  ולא בטעינת/נירמול הסטטוס בשום commit רלוונטי היסטורי - הביטוי
                  התנייתי `hotQuotesList.length > 0 &&` היה קיים כך מאז ומתמיד
                  (גם ב-5f658f3 "stabilize hot quote geometry" המקורי, גם
                  בהערה של הסבב הזה עצמו לפני התיקון - "מוצגת רק כש-
                  hotQuotesList.length>0"). המסקנה: הסיבה האמיתית להיעלמות
                  היא מעבר-סטטוס אמיתי (ההצעה שהייתה זכאית עברה ל-approved/
                  paid - בדיוק ההתנהגות העסקית הנכונה שהבעלים אישר), אך
                  התבנית-חזותית הקודמת (תיבה שנעלמת כליל) הפכה מעבר-סטטוס
                  תקין למראה של "באג". התיקון כאן הוא אך ורק ויזואלי/מבני:
                  מוסיף מצב-ריק קבוע-גיאומטריה כשאין הצעה חמה זכאית - אפס
                  שינוי בנוסחת-הזכאות עצמה. */}
              {hotQuotesList.length > 0 && currentHotQuote ? (
                <div
                  title={t.hotQuoteAlert(currentHotClientName, currentHotViewCount)}
                  style={{ marginTop: '8px', background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: RADIUS.sm, padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px', height: '42px', boxSizing: 'border-box', overflow: 'hidden' }}
                >
                  <Flame size={15} color={DARK_ACCENT.red} fill={DARK_ACCENT.red} strokeWidth={1} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: DARK_ACCENT.red, fontWeight: '800', flexShrink: 0 }}>{isHebrew ? 'הצעה חמה!' : 'Hot Quote!'}</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.78rem', color: SHELL.sidebarTextActive, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.hotQuoteAlert(currentHotClientName, currentHotViewCount)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(getHotQuoteViewLink(currentHotQuote), '_blank'); }}
                    title={isHebrew ? 'צפה בהצעה' : 'View quote'}
                    aria-label={isHebrew ? 'צפה בהצעה' : 'View quote'}
                    style={{ flexShrink: 0, background: 'rgba(248,113,113,0.18)', border: 'none', borderRadius: RADIUS.sm, width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: DARK_ACCENT.red }}
                  >
                    <Eye size={13} strokeWidth={2.2} />
                  </button>
                </div>
              ) : (
                <div
                  title={isHebrew ? 'אין כרגע הצעה חמה. כשהצעה תיצפה 3 פעמים או יותר ועדיין לא תאושר, היא תופיע כאן.' : 'No hot quote right now. A quote will appear here after 3 or more views while it is still awaiting approval.'}
                  style={{ marginTop: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${SHELL.sidebarBorder}`, borderRadius: RADIUS.sm, padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px', height: '42px', boxSizing: 'border-box', overflow: 'hidden' }}
                >
                  <Flame size={15} color={SHELL.sidebarTextMuted} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.78rem', color: SHELL.sidebarText, fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isHebrew ? 'אין כרגע הצעה חמה' : 'No hot quote right now'}
                    <span style={{ fontSize: '0.66rem', color: SHELL.sidebarTextMuted, fontWeight: '500', marginInlineStart: '8px' }}>
                      {isHebrew ? 'כשהצעה תיצפה 3 פעמים או יותר ועדיין לא תאושר, היא תופיע כאן.' : 'A quote will appear here after 3 or more views while it is still awaiting approval.'}
                    </span>
                  </span>
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
          {/* Trial-warning banner removed (Owner): remaining trial days live in the compact plan badge; no separate row/overlay. */}

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
                stickyTopBase={upperSectionHeight}
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
                formatMoneyDisplay={formatMoneyDisplay}
                t={t}
                setPendingEmailQuote={setPendingEmailQuote}
                emailStatuses={emailStatuses}
                currency={currency}
              />
          )}

          {activeTab === 'main' && showQuoteForm && (
            <>
            <DraftStorageWarning show={!!draftStorageProbe || quoteDraft.status === 'error'} reason={quoteDraft.error || draftStorageProbe} isHebrew={isHebrew} />
            <DraftAttachmentsWarning names={quoteDraft.attachmentsWarning} isHebrew={isHebrew} />
            <DraftRecoveredBanner info={recoveredDraftInfo} isHebrew={isHebrew} onDiscard={discardRecoveredDraft} onDismiss={() => setRecoveredDraftInfo(null)} />
            <QuoteForm
              editingQuoteId={editingQuoteId}
              editingQuoteNumber={editingOriginalQuote?.quote_number ?? null}
              onSave={handleSaveQuote}
              onCancel={requestCancelEdit}
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
              sections={sections} setSections={setSections} addSection={addSection} renameSection={renameSection} removeSection={removeSection}
              quoteStructureMode={quoteStructureMode} setQuoteStructureMode={setQuoteStructureMode}
              projectName={projectName} setProjectName={setProjectName}
              services={services}
              clients={clients}
              isHebrew={isHebrew}
              isLocalIsraeliBusiness={isLocalIsraeliBusiness}
              t={t}
              sym={sym}
              formatNum={formatNum}
              formatMoneyDisplay={formatMoneyDisplay}
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
              recommendedPricingMethod={getRecommendedPricingMethod(professionalDomain)}
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
              onWizardStateChange={setItemWizardState}
              onStageAttachmentRemoval={(id) => setPendingAttachmentRemovals((prev) => (prev.includes(id) ? prev : [...prev, id]))}
              wizardResume={wizardResume}
              onWizardDraftChange={setWizardDraft}
            />
            </>
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
              canUseAttachments={entitlement.attachments}
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
              formatMoneyDisplay={formatMoneyDisplay}
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
              formatMoneyDisplay={formatMoneyDisplay}
            />
          )}

          {/* TEKANGO Admin V1 (Task 2): Admin content router - one section
              renders at a time inside this same light content outlet,
              switched by adminSection (Overview/Users/Plans/Activity), with
              a selected account short-circuiting Users into the
              shell-preserving User Details view instead of a modal. Admin
              destinations never mix in ordinary business tabs (those are
              reachable only via the sidebar's own "My Workspace" exit). */}
          {isAdminMode && adminAccountsStatus !== 'ready' && <p role="status">{adminAccountsStatus === 'loading' ? (isHebrew ? 'טוען נתוני ניהול…' : 'Loading Admin data…') : (isHebrew ? 'נתוני הניהול אינם זמינים כרגע' : 'Admin data currently unavailable')}</p>}
          {isAdminMode && adminAccountsStatus === 'ready' && (
            <ErrorBoundary isHebrew={isHebrew}>
              <AdminDestinationHost
                sectionId={adminSection}
                host={{
                  isHebrew,
                  isSuperAdmin,
                  accounts: allAccounts,
                  navigate: navigateToAdminSection,
                  openUser: openAdminUserDetails,
                  selectedUserId: adminSelectedUserId,
                  clearSelectedUser: () => setAdminSelectedUserId(null),
                  usersTabProps: {
                    t,
                    isHebrew,
                    allAccounts,
                    filteredAdminAccounts,
                    adminSearchTerm,
                    setAdminSearchTerm,
                    handleSort,
                    sortField,
                    sortDirection,
                  },
                }}
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
              the page still scrolls normally as a whole on mobile).

              חוק ברזל (UI Stability + Hot Quote Forensic Check task,
              2026-09-08, "FOOTER — ALWAYS AT THE BOTTOM"): marginTop קבוע
              (30px) לא היה מספיק - ב-.dash-main-content שהוא flex:1 1 auto
              בתוך שרשרת flex-column כבר-קיימת (dash-app-shell→dash-shell-
              outer→dash-shell-body→dash-shell-main, כולן flex-column
              קבועות, לא תלויות-מדיה-query), ה-footer פשוט נדבק מיד אחרי
              תוכן קצר, בלי להידחף לתחתית האזור הזמין - הטופס-הקצר-נראה-
              "צף-באמצע" שהבעלים דיווח עליו. תוקן ללא position:absolute
              (נמנע בכוונה, per Owner's explicit "no brittle absolute
              positioning") - marginTop:'auto' על ה-footer עצמו, בתוך
              .dash-main-content שקיבל display:flex+flexDirection:column
              משלו (למעלה) - טריק flexbox סטנדרטי: שוליים-עליונים אוטומטיים
              סופגים את כל השטח הפנוי הנותר בציר הראשי, ודוחפים לתחתית
              בדיוק כשהתוכן קצר יותר מהגובה הזמין; כשהתוכן ארוך יותר,
              ה-footer פשוט מופיע אחרי סוף התוכן (בזרימה רגילה, לעולם לא
              overlay/clip) - אותו מנגנון עובד גם בדסקטופ (עם overflow-y:
              auto על dash-main-content) וגם במובייל (עם גלילת-עמוד טבעית,
              כי כל השרשרת ההורה כבר flex-column עם minHeight:100vh
              מ-dash-app-shell). */}
          <footer className="no-print dash-footer" style={{ textAlign: 'center', padding: '16px', marginTop: 'auto', paddingTop: '30px', borderTop: `1px solid ${NEON.border}`, color: NEON.textMuted, fontSize: '0.8rem' }}>
            <div className="dash-footer-brand" style={{ marginBottom: '6px' }}>
              {isHebrew ? <>מערכת <BrandName /> - ניהול עסק והצעות מחיר</> : <><BrandName /> - Business & Quoting SaaS Platform</>}
            </div>
            <button onClick={() => setShowAccessibility(true)} style={{ background: 'none', border: 'none', color: NEON.violetLight, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AccessibilityIcon size={14} />
              {isHebrew ? 'הצהרת נגישות' : 'Accessibility Statement'}
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
          style={{ position: 'fixed', insetInlineStart: '10px', insetInlineEnd: '10px', bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))', background: NEON.bgElevated, border: `1px solid ${NEON.border}`, borderRadius: RADIUS.lg, boxShadow: '0 -6px 20px -4px rgba(31,27,46,0.22)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 9998, maxHeight: '70vh', overflowY: 'auto' }}
        >
          {/* TEKANGO Admin V1 (Task 1, mobile nav parity): when in Admin
              mode, this same, already-proven "More" popover mechanism
              (compact, opens above the bottom nav, closes on selection)
              carries the Admin section list + "My Workspace" instead of the
              ordinary business overflow items - reusing one already-tested
              mobile nav primitive rather than introducing a second,
              parallel drawer implementation. Dark SHELL styling only
              applies while isAdminMode, so the ordinary business "More"
              menu (Settings/Catalog) is completely unchanged. */}
          {
          navCapabilities
            .filter((cap) => cap.mobileGroup === 'more' && cap.id !== 'admin_clients')
            .map(({ id, icon: TabIcon, label, mobileLabel }) => (
              <button
                key={id}
                role="menuitem"
                onClick={() => { setActiveTab(id); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: activeTab === id ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '10px 12px', color: activeTab === id ? NEON.violet : NEON.textPrimary, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', textAlign: isHebrew ? 'right' : 'left' }}
              >
                <TabIcon size={17} strokeWidth={2.2} />
                {mobileLabel || label}
              </button>
            ))}
          {isSuperAdmin && ADMIN_NAV_GROUPS.flatMap((group) => group.items).map(({ id, icon: AdminIcon, label }) => (
            <button
              key={`admin-${id}`}
              role="menuitem"
              onClick={() => { navigateToAdminSection(id); setShowMobileMoreMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: isAdminMode && adminSection === id ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '10px 12px', color: isAdminMode && adminSection === id ? NEON.violet : NEON.textSecondary, fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <AdminIcon size={17} strokeWidth={2.2} />
              {isHebrew ? label.he : label.en}
            </button>
          ))}
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
      {(
      <div className="no-print mobile-bottom-nav" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, width: '100%', background: NEON.bgElevated, color: NEON.textPrimary, justifyContent: 'space-around', padding: '5px 4px calc(5px + env(safe-area-inset-bottom, 0px))', zIndex: 9998, boxShadow: '0 -4px 16px -6px rgba(31,27,46,0.12)', borderTop: `1px solid ${NEON.border}`, boxSizing: 'border-box' }}>
        {navCapabilities
            .filter((cap) => cap.mobileGroup === 'bottom')
            .map(({ id, icon: TabIcon, label }) => {
              const isActive = id === 'main' ? (activeTab === 'main' && !showQuoteForm) : activeTab === id;
              return (
                <button key={id} onClick={() => { setActiveTab(id); setIsCreatingQuote(false); setEditingQuoteId(null); setShowMobileMoreMenu(false); }} style={{ background: isActive ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: isActive ? NEON.violet : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  <TabIcon size={16} style={{ marginBottom: '1px' }} />
                  {label}
                </button>
              );
            })}
        {/* "עוד"/"More" מדגיש את עצמו גם כש-activeTab הוא כל יעד מתוך קבוצת
            ה-more (Settings/Catalog/Admin) - נגזר מאותה רשימה, לא רשימת-
            מחרוזות שנייה ונפרדת שהייתה עלולה לצאת מסונכרנת שוב. */}
        <button
          onClick={() => setShowMobileMoreMenu(prev => !prev)}
          aria-haspopup="true"
          aria-expanded={showMobileMoreMenu}
          style={{ background: (showMobileMoreMenu || (isAdminMode || navCapabilities.some((cap) => cap.mobileGroup === 'more' && cap.id === activeTab))) ? NEON.violetLighter : 'none', border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: (showMobileMoreMenu || (isAdminMode || navCapabilities.some((cap) => cap.mobileGroup === 'more' && cap.id === activeTab))) ? NEON.violet : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', whiteSpace: 'nowrap' }}
        >
          <MoreHorizontal size={16} style={{ marginBottom: '1px' }} />
          {isHebrew ? 'עוד' : 'More'}
        </button>
        {/* חוק ברזל (Functional Parity Across Viewports task, 2026-09-08,
            תיקון פער-פריטי §211): Desktop כבר הסתיר את כפתור "הצעת מחיר
            חדשה" מ-Super Admin ({'{'}!isSuperAdmin &&{'}'} סביב dash-sidebar-cta
            למעלה) - כפתור "חדש" כאן לא נשא תנאי מקביל בכלל, כך שחשבון Super
            Admin ראה יכולת-יצירת-הצעה ב-Mobile שה-Desktop שלו עצמו במפורש
            שולל. אותו isSuperAdmin המשותף בדיוק - לא תנאי-role שני/עצמאי. */}
        {(
          <button onClick={() => { setShowMobileMoreMenu(false); handleCreateNewQuoteClick(); }} style={{ background: NEON.gradient, border: 'none', borderRadius: RADIUS.sm, padding: '4px 6px', color: '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.64rem', fontWeight: '700', boxShadow: NEON.glowSoft, whiteSpace: 'nowrap' }}>
            <PlusCircle size={16} strokeWidth={2.5} style={{ marginBottom: '1px' }} />
            {isHebrew ? 'חדש' : 'New'}
          </button>
        )}
      </div>
      )}
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