// ==============================================================================
// 🚨 חוק ברזל קשוח (Dashboard.jsx): הודעות צפות מודרניות במרכז המסך ושמירה על יציבות.
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../shared/supabase';
import ProFlowLogo from '../components/ProFlowLogo';
import AccessibilityModal from '../components/AccessibilityModal';
import AIChatWidget from '../AIChatWidget';
import { isHebrewEnv, formatDateLocal, calculateQuoteFinancials } from '../utils/regionConfig';
import { isQuoteImmutable } from '../utils/quoteLock';
import { formatQuoteFallback } from '../utils/quoteNumber';
import { formatMoney } from '../utils/money';
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
import { LIGHT as NEON, FONT_HE, FONT_EN, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import {
  AlertTriangle, Crown, Shield, LogOut, Clock, FileText, Wallet,
  Users2, PlusCircle, Settings as SettingsIcon, BarChart3, Flame,
  MessagesSquare, Accessibility as AccessibilityIcon, Package
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
  const [bizName, setBizName] = useState('ProFlow');
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
  const [bizPlan, setBizPlan] = useState('free');
  const [bizRole, setBizRole] = useState('user');

  const [defaultTerms, setDefaultTerms] = useState(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [activeTooltip] = useState({ quoteId: null, action: null });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  const [hotQuoteIndex, setHotQuoteIndex] = useState(0);

  const [editingClient, setEditingClient] = useState(null);
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
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '' }]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(isHebrew ? 'ענן / תשתית' : 'Cloud / Infrastructure');
  const [isRecurring, setIsRecurring] = useState(false);

  const [pendingEmailQuote, setPendingEmailQuote] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  let trialDaysLeft = null;
  let isTrialExpired = false;
  if (trialEndsAt) {
    const end = new Date(trialEndsAt);
    const diffTime = end - now;
    trialDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isTrialExpired = trialDaysLeft <= 0;
  }

  // תוכנית בתשלום אמיתית (basic/pro) שנקבעה בפועל ב-business_settings.plan
  // תמיד תקפה, בלי תלות במצב trial_ends_at - אחרת לקוח משלם שדרוגו קרה אחרי
  // שתאריך ניסיון ישן כבר פג היה מאבד גישה בטעות. בלי תוכנית בתשלום, ניסיון
  // פעיל ולא פג (trial_ends_at) מעניק PRO מלא - בדיוק כפי שהבאנר "תקופת ניסיון
  // פעילה (גישת PRO מלאה)" כבר מבטיח למשתמש, ללא תלות בערך הגולמי של plan
  // (handleToggleLifetime של האדמין למשל מגדיר רק trial_ends_at ולא נוגע ב-plan).
  const rawPlan = bizPlan.toLowerCase();
  const effectivePlan = (rawPlan === 'pro' || rawPlan === 'basic')
    ? rawPlan
    : (trialEndsAt && !isTrialExpired ? 'pro' : 'free');

  const isSuperAdmin = bizRole === 'super_admin';
  const isPro = isSuperAdmin || effectivePlan === 'pro';
  const isBasicOrAbove = isPro || effectivePlan === 'basic';

  const t = {
    appName: bizName || 'ProFlow',
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
      setBizName(data.business_name || 'ProFlow');
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
      
      setDefaultTerms(defTerms);
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

    const reportBizName = bizName || 'ProFlow';
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
      // שהאימות תמיד יחזור ל-www.quotecodepro.com גם אם ההרשמה בוצעה
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
          emailRedirectTo: 'https://www.quotecodepro.com/dashboard',
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

  const addItem = () => setItems([...items, { description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);

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

    const senderName = bizName || 'ProFlow';
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

  const handleProtectedAction = (quoteId, actionType, callback) => {
    if (actionType === 'edit' || actionType === 'duplicate') {
      if (!isBasicOrAbove) {
        setShowPricingModal(true);
        return;
      }
    }
    if (actionType === 'whatsapp' || actionType === 'delete') {
      if (!isPro) {
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

  const previewFinancials = calculateQuoteFinancials({
    country: previewRegionCountry,
    clientType,
    items,
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

  const planLimit = effectivePlan.toLowerCase() === 'free' ? 5 : effectivePlan.toLowerCase() === 'basic' ? 20 : '∞';

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

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
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
    
    const quoteCurr = quote.currency || (isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
    setCurrency(quoteCurr);

    setQuoteStatus(quote.status ? quote.status.charAt(0).toUpperCase() + quote.status.slice(1) : 'Draft');
    setValidUntil(quote.valid_until || '');
    setDiscount(quote.discount || ''); 

    let editTerms = quote.terms || (isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    let editNotes = quote.notes || '';

    setTerms(editTerms);
    setNotes(editNotes);

    if (quote.quote_items && quote.quote_items.length > 0) {
      // שומרים את ה-id האמיתי של כל quote_item בזמן טעינת עריכה - זהו המזהה
      // היחיד שמאפשר בהמשך (handleSaveQuote) לבצע UPDATE ממוקד ובטוח של
      // description בלבד על עריכה לא-פיננסית, בלי DELETE+INSERT ובלי להסתמך
      // על סדר המערך. פריטים חדשים שנוספים אחר-כך (addItem/מקטלוג) נשארים
      // בלי id בכוונה - הוספת/הסרת פריט היא ממילא שינוי פיננסי.
      setItems(quote.quote_items.map(item => ({ id: item.id, description: item.description, quantity: item.quantity || '1', unit_price: item.unit_price, isFromCatalog: false })));
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
    setTerms(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    setNotes('');
    setQuoteFiles([]);
    setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
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

    setTerms(dupTerms);
    setNotes(dupNotes);
    setQuoteFiles([]);
    
    if (quote.quote_items && quote.quote_items.length > 0) {
      setItems(quote.quote_items.map(item => ({ description: item.description, quantity: item.quantity || '1', unit_price: item.unit_price, isFromCatalog: false })));
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
    setTerms(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    setNotes('');
    setQuoteFiles([]);
    setCurrency(isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
    setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
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
        const limit = effectivePlan.toLowerCase() === 'free' ? 5 : effectivePlan.toLowerCase() === 'basic' ? 20 : Infinity;
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
            items,
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
          items,
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
      const attnFields = { attn_name: attnName || null, attn_role: attnRole || null };
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
        const quoteItemsToInsert = itemsForPersist.map(item => ({
          quote_id: quoteId,
          description: item.description,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          total_price: Number(item.quantity || 1) * Number(item.unit_price || 0)
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
              file_size: file.size
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
      setTerms(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
      setNotes('');
      setQuoteFiles([]);
      setCurrency(isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'));
      setItems([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
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
      aVal = a.id;
      bVal = b.id;
    } else if (quoteSortField === 'client') {
      aVal = a.clients?.company_name || '';
      bVal = b.clients?.company_name || '';
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
  }).sort((a, b) => {
    let aVal = a[clientSortField];
    let bVal = b[clientSortField];

    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return clientSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return clientSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

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

  const isExpiringSoon = trialDaysLeft !== null && trialDaysLeft <= 5 && trialDaysLeft > 0 && !isSuperAdmin;

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

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: isHebrew ? FONT_HE : FONT_EN, background: NEON.bg, color: NEON.textPrimary, minHeight: '100vh', display: 'flex', flexDirection: 'column', letterSpacing: '-0.01em', overflowX: 'hidden' }}>

      <style>{`
        @keyframes popupBounce {
          0% { transform: scale(0.6) translateY(8px); opacity: 0; }
          70% { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
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
        .dash-neon-btn {
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .dash-neon-btn:hover {
          filter: brightness(1.08);
        }
        .dash-tab-btn {
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        @media (max-width: 640px) {
          .dash-header-bar {
            flex-wrap: nowrap;
            padding: 8px 10px;
            gap: 6px;
          }
          .dash-header-logo-wrap,
          .dash-header-actions,
          .dash-header-profile {
            flex-shrink: 0;
          }
          .dash-header-profile {
            gap: 6px;
          }
          .dash-email-text,
          .dash-admin-badge-text,
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
        isOpen={editingClient !== null}
        onClose={() => setEditingClient(null)}
        client={editingClient}
        onSave={handleSaveUpdatedClient}
        isHebrew={isHebrew}
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

      <div className="dash-main-content" style={{ flex: '1 0 auto', padding: '10px' }}>
        {/* Owner correction (Baseline Closure Part 12 - Desktop content too wide,
            same feedback as Public Quote Part 11): single shared content-width
            wrapper for the whole authenticated app (Dashboard/Quotes/Clients/
            Catalog/Finances/Settings all render inside this one div). No
            media query here by design - on Mobile the viewport itself is
            already narrower than the value below so this maxWidth never
            engages there; Mobile width (dash-main-content padding etc.) is
            untouched.
            Third correction (Global Surface Audit + Implementation Pass,
            Owner decision): this wrapper previously used its own
            independently-chosen 1040px while Public Quote used 980px - the
            Owner rejected that inconsistency and set one canonical shared
            value, 980px, for both surfaces. Now references the single
            shared token (--pf-desktop-content-width, src/index.css) instead
            of a locally-duplicated literal - changing that one variable
            updates both this wrapper and Public Quote HE/EN together,
            structurally preventing the two from drifting apart again. */}
        <div style={{ maxWidth: 'var(--pf-desktop-content-width)', margin: '0 auto' }}>

          <div className="dash-header-bar" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: NEON.gradient, padding: '14px 20px', borderRadius: '16px', marginBottom: '14px', flexWrap: 'wrap', gap: '10px', maxWidth: '100%', boxSizing: 'border-box', boxShadow: NEON.glow }}>
            {/* חוק ברזל (דרישת בעלים מפורשת): זהות בעל העסק - לא מותג ProFlow -
                היא מה שמופיע כאן. אם קיים לוגו מועלה, הוא מוצג בתוך מיכל
                לבן/ניטרלי (לעולם לא ישירות על הרקע הסגול, כדי שלא "ייבלע"
                בצבעי הלוגו עצמו) עם object-fit:contain ששומר על יחס-הממדים
                ולעולם לא חותך אותו. בהיעדר לוגו - שם העסק בטקסט נקי, לעולם
                לא לוגו ProFlow כברירת מחדל - זהו דשבורד בעל העסק, לא מסך
                מיתוג ProFlow. */}
            <div className="dash-header-logo-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, minWidth: 0 }}>
              {bizLogoUrl ? (
                <div style={{ background: '#ffffff', borderRadius: '10px', padding: '6px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '46px', maxWidth: '180px', boxSizing: 'border-box', flexShrink: 0 }}>
                  <img src={bizLogoUrl} alt={bizName} style={{ maxHeight: '34px', maxWidth: '160px', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
                </div>
              ) : (
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '260px' }}>
                  {bizName}
                </div>
              )}
            </div>

            <div className="dash-header-actions" style={{ flex: '0 1 auto', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <AIChatWidget isHebrew={isHebrew} isDashboard={true} />
              {!isPro && !isSuperAdmin && (
                <button
                  className="dash-neon-btn"
                  onClick={() => setShowPricingModal(true)}
                  style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.35)', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                >
                  <Crown size={14} fill="currentColor" strokeWidth={1.5} />
                  <span>{isHebrew ? 'שדרג חבילה' : 'Upgrade Plan'}</span>
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => { window.location.href = '/ai-logs'; }}
                  style={{
                    padding: '6px 14px', borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.16)',
                    color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <MessagesSquare size={14} />
                  <span className="dash-admin-logs-text">AI Support Logs</span>
                </button>
              )}
            </div>

            <div className="dash-header-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
              {isSuperAdmin && (
                <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', padding: '3px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                  <Shield size={12} strokeWidth={2.5} />
                  <span className="dash-admin-badge-text">SUPER ADMIN</span>
                </span>
              )}
              <span className="dash-email-text" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)' }}>{session.user.email}</span>
              <button onClick={() => setShowSignOutModal(true)} style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}><LogOut size={12} strokeWidth={2.5} />{isHebrew ? 'התנתק' : 'Sign Out'}</button>
            </div>

            {/* חוק ברזל (תיקון בעלים - הודעת "התחברת בהצלחה"): הודעת הסטטוס
                עברה משורה קבועה בפריסה (שדחפה תוכן למטה עד שנדרסה) לשכבת-על
                צפה (position:absolute, לא בזרימת המסמך כלל) שתלויה מהקצה
                התחתון של הכותרת הסגולה - לא מכסה לוגו/שם עסק (משמאל/מימין,
                תלוי כיוון) ולא מכסה Sign Out (גם הם בשורה העליונה, מעל
                השכבה הזו). נעלמת אוטומטית אחרי 2.7 שניות (ר' ה-useEffect
                למעלה), ולא רק כשנדרסת ע"י ההודעה הבאה. */}
            {statusMsg.text && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  position: 'absolute',
                  bottom: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 30,
                  padding: '7px 16px',
                  borderRadius: '999px',
                  background: statusMsg.type === 'success' ? '#ffffff' : '#dc2626',
                  color: statusMsg.type === 'success' ? NEON.violet : '#ffffff',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 8px 20px -6px rgba(0,0,0,0.35)',
                  maxWidth: 'calc(100% - 24px)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  animation: 'popupBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                }}
              >
                {statusMsg.type !== 'success' && <AlertTriangle size={14} strokeWidth={2.5} />}
                <span>{statusMsg.text}</span>
              </div>
            )}
          </div>

          {isExpiringSoon && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(248, 113, 113, 0.35)', color: NEON.red, padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontWeight: '500', textAlign: 'center', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} strokeWidth={2.5} />
              <span>{isHebrew ? `תקופת הניסיון שלך מסתיימת בעוד ${trialDaysLeft} ימים!` : `Your trial period expires in ${trialDaysLeft} days!`}</span>
            </div>
          )}

          {trialEndsAt && !isTrialExpired && !isSuperAdmin && !isExpiringSoon && (
            // חוק ברזל (תיקון בעלים מאושר - צפיפות מובייל): הבאנר נשבר
            // לשתי שורות במובייל כי הטקסט המלא ("תקופת ניסיון פעילה (גישת
            // PRO מלאה)" + "תקופת הניסיון מסתיימת בעוד X ימים") ארוך מדי
            // מכדי להיכנס לשורה אחת ב-370px, גם עם flex-wrap:wrap. נוסף
            // טקסט מקוצר ייעודי למובייל (dash-trial-compact, מוסתר
            // בדסקטופ) לצד הטקסט המלא הקיים (dash-trial-full, מוסתר
            // במובייל) - שניהם מוחלפים ב-CSS בלבד, בלי state/hook חדש.
            // אין אובדן מידע - שני הטקסטים מכילים בדיוק את אותו מידע
            // (סטטוס + ימים שנותרו), רק מנוסחים בתמציתיות שונה.
            <div className="dash-trial-alert" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: NEON.sky, padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'normal', flexDirection: 'row', flexWrap: 'wrap', gap: '8px', fontSize: '0.85rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={14} strokeWidth={2.5} />
                <span className="dash-trial-full">{isHebrew ? 'תקופת ניסיון פעילה (גישת PRO מלאה)' : 'Active Trial Period (Full PRO Access)'}</span>
                <span className="dash-trial-compact">{isHebrew ? 'תקופת ניסיון פעילה' : 'Trial active'}</span>
              </span>
              <span className="dash-trial-full">{isHebrew ? `תקופת הניסיון מסתיימת בעוד ${trialDaysLeft} ימים` : `Your trial period expires in ${trialDaysLeft} days`}</span>
              <span className="dash-trial-compact">{isHebrew ? `נותרו ${trialDaysLeft} ימים` : `${trialDaysLeft} days left`}</span>
            </div>
          )}

          {isTrialExpired && !isSuperAdmin && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: NEON.red, padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontWeight: 'normal', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} strokeWidth={2.5} />
              <span>{isHebrew ? 'תקופת הניסיון פגה והועברת למסלול החינמי. אנא שדרג.' : 'Your trial has expired and you have been moved to the FREE tier. Please upgrade.'}</span>
            </div>
          )}

          {/* חוק ברזל (תיקון בעלים מאושר - שילוב "הצעת מחיר חדשה" לתוך קבוצת
              הניווט): הוסר ה-spacer (flex:'1 1 auto') שהפריד בעבר בין
              כפתורי הטאבים לכפתור ה-CTA הסגול, וגרם לו "לצוף" לבד בקצה
              הנגדי של השורה - זה בדיוק מה שהבעלים דחה. עכשיו כל הכפתורים
              (כולל ה-CTA) יושבים באותה שורת flex רציפה, אותו gap אחיד, בלי
              מפריד. ה-CTA הוא ראשון ב-DOM בכוונה: במיכל RTL (עברית), הילד
              הראשון ב-DOM ממוקם בפועל בקצה הימני (ה-"התחלה" ב-RTL) - כך
              שהוא מוביל את הקבוצה מימין, תואם בדיוק לסדר שאושר: "הצעת מחיר
              חדשה, הגדרות עסק, לקוחות, פיננסים, קטלוג" (ימין לשמאל). באנגלית
              (LTR), אותו סדר DOM ממוקם את ה-CTA בקצה השמאלי (ה-"התחלה"
              ב-LTR) - מוביל את הקבוצה משמאל, שיקוף מכוון של אותה קומפוזיציה
              ולא רק תרגום. "הצעות מחיר" עצמו לא מוצג כפריט ניווט כשכבר
              נמצאים בו - עדיין נגיש בחזרה מכל טאב אחר. "קטלוג" הוא טאב
              קיים - מציג את אותו רכיב ServicesCatalog הקיים במלואו (ר'
              activeTab === 'catalog' למטה), לא מימוש כפול. עדיין רק כפתור
              "הצעת מחיר חדשה" יחיד באפליקציה - לא שוחזר הכפתור הכפול
              שהוסר מתוך QuotesTab.jsx. handleCreateNewQuoteClick עצמה
              עודכנה (למטה) כך שתעבוד גם מטאבים אחרים - ר' הערה שם. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {!isSuperAdmin && (
              <button
                onClick={handleCreateNewQuoteClick}
                style={{ flexShrink: 0, background: NEON.gradient, color: 'white', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', boxShadow: NEON.glow, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <PlusCircle size={16} strokeWidth={2.4} />
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
            ].filter(({ key }) => key !== activeTab).map(({ key, icon: TabIcon, label }) => (
              <button
                key={key}
                className="dash-tab-btn"
                onClick={() => { setActiveTab(key); setIsCreatingQuote(false); setEditingQuoteId(null); }}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: `1px solid ${NEON.border}`,
                  fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                  background: NEON.bgCard,
                  color: NEON.textSecondary,
                  display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                }}
              >
                <TabIcon size={15} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'main' && !showQuoteForm && (
            <>
              {!isSuperAdmin && (
                // חוק ברזל (התאמה ל-mockup המאושר): סדר ה-DOM כאן [חמה,
                // הצעות, הכנסות] מכוון בכוונה - ברשת CSS Grid בתוך מיכל
                // RTL, הפריט הראשון תמיד ממוקם בעמודה הימנית ביותר. הסדר
                // הזה מייצר בפועל את סדר התצוגה משמאל-לימין שב-mockup:
                // הכנסות (שמאל) → הצעות (אמצע) → חמה (ימין). אין כאן שינוי
                // בשום חישוב/ערך - רק סדר הופעה חזותי.
                <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {hotQuotesList.length > 0 && (
                    <div className="dash-kpi-card dash-kpi-hot" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="dash-kpi-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ffffff', border: `1.5px solid ${NEON.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Flame size={19} color={NEON.red} fill={NEON.red} strokeWidth={1} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <div className="dash-kpi-label" style={{ fontSize: '0.75rem', color: NEON.red, fontWeight: '800' }}>{isHebrew ? 'הצעה חמה!' : 'Hot Quote!'}</div>
                        <div className="dash-kpi-sub" style={{ fontSize: '0.8rem', color: NEON.textPrimary, fontWeight: '600', lineHeight: 1.3 }}>{t.hotQuoteAlert(currentHotClientName, currentHotViewCount)}</div>
                      </div>
                    </div>
                  )}
                  <div className="dash-kpi-card" style={{ background: NEON.bgCard, padding: '16px', borderRadius: '14px', border: `1px solid ${NEON.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="dash-kpi-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ffffff', border: `1.5px solid ${NEON.violet}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={19} color={NEON.violet} strokeWidth={2.2} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <div className="dash-kpi-label" style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>{t.totalQuotes}</div>
                      <div className="dash-kpi-value" style={{ fontSize: '1.5rem', fontWeight: '800', color: NEON.textPrimary, lineHeight: 1.1 }}>{totalQuotesCount}</div>
                      {!isPro && (
                        <div style={{ fontSize: '0.65rem', color: NEON.amber, fontWeight: 'bold' }}>
                          {isHebrew ? `החודש: ${monthlyQuotesCount} / ${planLimit}` : `This month: ${monthlyQuotesCount} / ${planLimit}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="dash-kpi-card" style={{ background: NEON.bgCard, padding: '16px', borderRadius: '14px', border: `1px solid ${NEON.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="dash-kpi-icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ffffff', border: `1.5px solid ${NEON.violet}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Wallet size={19} color={NEON.violet} strokeWidth={2.2} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <div className="dash-kpi-label" style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>{t.totalRevenue}</div>
                      <div className="dash-kpi-value pf-money" style={{ fontSize: '1.5rem', fontWeight: '800', color: NEON.textPrimary, lineHeight: 1.1 }}>{sym}{formatNum(totalRevenue)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* חוק ברזל (החלטת בעלים מאושרת): הקטלוג הוצא מהתצוגה הראשית
                  של הדשבורד ועבר לטאב עצמאי משלו ("קטלוג" - ר' activeTab
                  === 'catalog' למטה). היסטוריית הצעות תופסת כעת את מלוא
                  רוחב אזור התוכן הראשי - אין עוד עמודה שנייה/דו-טורי כאן. */}
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
            </>
          )}

          {activeTab === 'main' && showQuoteForm && (
            <QuoteForm
              editingQuoteId={editingQuoteId}
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
              notes={notes} setNotes={setNotes}
              items={items} setItems={setItems}
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
              isTrialExpired={isTrialExpired}
              isSuperAdmin={isSuperAdmin}
              addItem={addItem}
              removeItem={removeItem}
              handleItemChange={handleItemChange}
              handleAddFromCatalog={handleAddFromCatalog}
              userPlan={bizPlan}
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
              quotes={quotes}
              isHebrew={isHebrew}
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
              defaultTerms={defaultTerms}
              setDefaultTerms={setDefaultTerms}
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

        </div>
      </div>

      <div className="no-print mobile-bottom-nav" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, width: '100%', background: NEON.bgElevated, color: NEON.textPrimary, justifyContent: 'space-around', padding: '10px 0', zIndex: 9998, boxShadow: '0 -4px 16px -6px rgba(31,27,46,0.12)', borderTop: `1px solid ${NEON.border}` }}>
        <button onClick={() => { setActiveTab('main'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'main' && !showQuoteForm ? NEON.violetLight : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <FileText size={18} style={{ marginBottom: '2px' }} />
          {t.quotesNav}
        </button>
        <button onClick={() => { setActiveTab('clients'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'clients' ? NEON.violetLight : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <Users2 size={18} style={{ marginBottom: '2px' }} />
          {t.clientsNav}
        </button>
        <button onClick={() => { setActiveTab('settings'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'settings' ? NEON.violetLight : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <SettingsIcon size={18} style={{ marginBottom: '2px' }} />
          {t.settingsNav}
        </button>
        <button onClick={() => { setActiveTab('finances'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'finances' ? NEON.violetLight : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <BarChart3 size={18} style={{ marginBottom: '2px' }} />
          {t.financesNav}
        </button>
        {/* חוק ברזל (תיקון בעלים מאושר - רגרסיית מובייל): לפני שהקטלוג הפך
            לטאב עצמאי, הוא היה נגיש במובייל דרך הרשת הדו-טורית שקרסה לטור
            יחיד. אחרי המעבר לטאב, נשכח להוסיף אותו לניווט התחתון של
            המובייל - הפך ללא נגיש לגמרי בנייד. תוקן כאן: כפתור נוסף, אותו
            תבנית מדויקת כמו כל כפתור אחר בשורה, בלי שינוי עיצובי נוסף. */}
        <button onClick={() => { setActiveTab('catalog'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'catalog' ? NEON.violetLight : NEON.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <Package size={18} style={{ marginBottom: '2px' }} />
          {t.catalogNav}
        </button>
        <button onClick={() => { handleCreateNewQuoteClick(); }} style={{ background: 'none', border: 'none', color: NEON.violetLight, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <PlusCircle size={18} strokeWidth={2.5} style={{ marginBottom: '2px' }} />
          {isHebrew ? 'חדש' : 'New'}
        </button>
      </div>

      <footer className="no-print dash-footer" style={{ textAlign: 'center', padding: '16px', marginTop: '30px', borderTop: `1px solid ${NEON.border}`, color: NEON.textMuted, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: '6px' }}>
          {isHebrew ? <>מערכת <strong>ProFlow</strong> - ניהול עסק והצעות מחיר</> : <><strong>ProFlow</strong> - Business & Quoting SaaS Platform</>}
        </div>
        <button onClick={() => setShowAccessibility(true)} style={{ background: 'none', border: 'none', color: NEON.violetLight, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AccessibilityIcon size={14} />
          {isHebrew ? 'הצהרת נגישות' : 'Assignment Statement'}
        </button>
      </footer>
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