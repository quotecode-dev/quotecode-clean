import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import ProFlowLogo from '../components/ProFlowLogo';
import AccessibilityModal from '../components/AccessibilityModal';
import AIChatWidget from '../AIChatWidget';
import { isHebrewEnv, getCurrencySym, getRegionTaxRate } from '../utils/regionConfig';

// ייבוא כל הרכיבים המודולריים הנקיים:
import PricingModal from '../components/PricingModal';
import EditClientModal from '../components/EditClientModal';
import EditExpenseModal from '../components/EditExpenseModal';
import LifetimeConfirmModal from '../components/LifetimeConfirmModal';
import RegionConfirmModal from '../components/RegionConfirmModal';
import UserDetailsModal from '../components/UserDetailsModal';
import EmailConfirmModal from '../components/EmailConfirmModal';
import ClientsTab from '../components/ClientsTab';
import FinancesTab from '../components/FinancesTab';
import QuoteForm from '../components/QuoteForm';
import QuotesTab from '../components/QuotesTab';

const formatNum = (val) => Math.round(Number(val || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_TERMS_HEB = `תנאים כלליים:
1. תוקף ההצעה: ההצעה בתוקף ל-30 ימים מיום הצעת המחיר.
2. מחירים: המחירים כוללים מע"מ, אלא אם צוין אחרת.
3. תשלום: התשלום יתבצע במזומן או באמצעות העברה בנקאית, בתנאים שיוסכמו מראש.
4. אספקה: אספקת המוצרים תתבצע תוך 30 ימי עבודה ממועד אישור ההזמנה והתשלום, אלא אם כן צוין אחרת.`;

const DEFAULT_TERMS_ENG = `General Terms:
1. Validity: This quote is valid for 30 days from issuance.
2. Payment: Payment shall be made in cash or via bank transfer as agreed in advance.
3. Delivery: Product delivery within 30 business days from order confirmation and payment.`;

export default function Dashboard() {
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
  const [statusMsg, setStatusMsg] = useState({ text: 'System connected to Supabase.', type: 'success' });

  const [activeTab, setActiveTab] = useState('main');
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [financeReportType, setFinanceReportType] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [settingId, setSettingId] = useState(null);
  const [bizName, setBizName] = useState('ProFlow');
  const [bizTaxId, setBizTaxId] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizLogoUrl, setBizLogoUrl] = useState('');
  const [bizPlan, setBizPlan] = useState('free');
  const [bizRole, setBizRole] = useState('user');
  
  const [bizCountry, setBizCountry] = useState(() => {
    if (typeof window === 'undefined') return 'Local';
    const cached = localStorage.getItem('proflow_cached_country');
    if (cached) return cached;
    return 'Local';
  });

  const [defaultTerms, setDefaultTerms] = useState(DEFAULT_TERMS_HEB);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [activeTooltip, setActiveTooltip] = useState({ quoteId: null, action: null });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  const [hotQuoteIndex, setHotQuoteIndex] = useState(0);

  const [editingClient, setEditingClient] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');

  const [currency, setCurrency] = useState('ILS');

  const [adminActionModal, setAdminActionModal] = useState({ isOpen: false, type: null, account: null });
  const [liveTick, setLiveTick] = useState(0);

  // מעקב אחר זמן הצפייה האחרון במשתמשים החדשים לצורך איפוס ה-Counter
  const [lastSeenNewUsersTime, setLastSeenNewUsersTime] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem('proflow_last_seen_new_users') || 0);
  });

  const handleOpenNewUsersModal = (newUsersList) => {
    const nowTime = Date.now();
    localStorage.setItem('proflow_last_seen_new_users', nowTime.toString());
    setLastSeenNewUsersTime(nowTime);
    setSelectedUserDetails({ isNewUsersListModal: true, users: newUsersList });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTick(prev => prev + 1);
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function getCurrencySymbol(curr) {
    if (bizCountry === 'International') {
      if (curr === 'EUR') return '€';
      if (curr === 'GBP') return '£';
      if (curr === 'CAD' || curr === 'AUD') return '$';
      return '$';
    }
    return getCurrencySym(bizCountry, curr);
  }

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
        await loadData(session.user.id, session.user.email);
      }
      setIsInitializing(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession((prevSession) => {
          if (prevSession?.user?.id !== newSession?.user?.id) {
            if (newSession?.user?.id) {
              loadData(newSession.user.id, newSession.user.email);
            }
            return newSession;
          }
          return prevSession;
        });
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setQuotes([]);
        setClients([]);
        setServices([]);
        setExpenses([]);
        setSettingId(null);
        setBizCountry('Local');
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

  const isHebrew = isHebrewEnv(bizCountry, session);

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
  const [pendingRegionChange, setPendingRegionChange] = useState(null);
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
  const [terms, setTerms] = useState(DEFAULT_TERMS_HEB); 
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '' }]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Hosting / Cloud');
  const [isRecurring, setIsRecurring] = useState(false);

  const [pendingEmailQuote, setPendingEmailQuote] = useState(null);

  const isInternationalAccount = bizCountry === 'International';

  let trialDaysLeft = null;
  let isTrialExpired = false;
  if (trialEndsAt) {
    const end = new Date(trialEndsAt);
    const now = new Date();
    const diffTime = end - now;
    trialDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isTrialExpired = trialDaysLeft <= 0;
  }

  const effectivePlan = isTrialExpired ? 'free' : bizPlan.toLowerCase();

  const isSuperAdmin = bizRole === 'super_admin';
  const isPro = isSuperAdmin || effectivePlan === 'pro';
  const isBasicOrAbove = isPro || effectivePlan === 'basic';
  const isLocalIsraeliBusiness = !isInternationalAccount;

  const t = {
    appName: bizName || 'ProFlow',
    appSub: isHebrew ? 'מערכת ניהול עסק והצעות מחיר גלובלית' : 'Global SaaS Business & Quoting Platform',
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
    taxIdLabel: isHebrew ? 'ח.פ / עוסק מורשה / פטור' : 'Tax ID / Lic No',
    logoUrlLabel: isHebrew ? 'כתובת תמונת לוגו (URL)' : 'Logo Image URL',
    addService: isHebrew ? 'הוסף לקטלוג' : 'Add to Catalog',
    serviceName: isHebrew ? 'שם השירות / המוצר' : 'Service Name',
    defaultPrice: isHebrew ? 'מחיר קבוע' : 'Fixed Price',
    searchQuote: isHebrew ? 'חיפוש שם לקוח או מס׳ הצעה...' : 'Search client or quote #...',
    filterStatus: isHebrew ? 'כל הסטטוסים' : 'All Statuses',
    actions: isHebrew ? 'פעולות' : 'Actions',
    edit: isHebrew ? 'ערוך מסמך' : 'Edit Document',
    duplicate: isHebrew ? 'שכפל מסמך' : 'Duplicate Document',
    delete: isHebrew ? 'מחק' : 'Delete',
    clientsManagement: isHebrew ? 'ניהול לקוחות' : 'Clients Management',
    quotesNav: isHebrew ? 'הצעות מחיר' : 'Quotes',
    settingsNav: isHebrew ? 'הגדרות עסק' : (isHebrew ? 'הגדרות עסק' : 'Business Settings'),
    clientsNav: isHebrew ? 'לקוחות' : 'Clients',
    financesNav: isHebrew ? 'פיננסים' : 'Finances',
    usersAdminNav: isHebrew ? 'ניהול משתמשים' : 'Users Admin',
    hotQuoteAlert: (name) => isHebrew ? `הצעה חמה! הלקוח "${name}" צפה בהצעה מספר פעמים ללא חתימה.` : `Hot Quote! Client "${name}" viewed the quote multiple times without signing.`
  };

  async function loadData(userId, userEmail) {
    await fetchQuotes(userId);
    await fetchClients(userId);
    await fetchServices(userId);
    await fetchExpenses(userId);
    await fetchSettings(userId, userEmail);
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

  async function fetchSettings(userId, userEmail) {
    const nowIso = new Date().toISOString();

    let { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!data && userEmail) {
      const { data: emailData } = await supabase
        .from('business_settings')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (emailData) {
        const oldUserId = emailData.user_id;

        const { data: updatedData } = await supabase
          .from('business_settings')
          .update({ user_id: userId, last_sign_in: nowIso })
          .eq('id', emailData.id)
          .select()
          .maybeSingle();

        if (updatedData) {
          data = updatedData;

          if (oldUserId && oldUserId !== userId) {
            await supabase.from('services').update({ user_id: userId }).eq('user_id', oldUserId);
            await supabase.from('clients').update({ user_id: userId }).eq('user_id', oldUserId);
            await supabase.from('quotes').update({ user_id: userId }).eq('user_id', oldUserId);
            await supabase.from('expenses').update({ user_id: userId }).eq('user_id', oldUserId);
          }
        }
      } else if (data) {
        if (!data.email && userEmail) {
          await supabase.from('business_settings').update({ email: userEmail }).eq('id', data.id);
        }
      }
    }

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
      const countryVal = data.country || 'Local';
      setBizCountry(countryVal);
      localStorage.setItem('proflow_cached_country', countryVal);
      
      const defaultFallbackTerms = countryVal === 'International' ? DEFAULT_TERMS_ENG : DEFAULT_TERMS_HEB;
      let defTerms = data.default_terms && data.default_terms.trim() !== '' ? data.default_terms : defaultFallbackTerms;
      
      if (countryVal === 'International' && defTerms.trim() === DEFAULT_TERMS_HEB.trim()) {
        defTerms = DEFAULT_TERMS_ENG;
        supabase.from('business_settings').update({ default_terms: DEFAULT_TERMS_ENG }).eq('id', data.id).then();
      } else if (countryVal === 'Local' && defTerms.trim() === DEFAULT_TERMS_ENG.trim()) {
        defTerms = DEFAULT_TERMS_HEB;
        supabase.from('business_settings').update({ default_terms: DEFAULT_TERMS_HEB }).eq('id', data.id).then();
      }

      setDefaultTerms(defTerms);
      setTrialEndsAt(data.trial_ends_at !== undefined ? data.trial_ends_at : null);
      
      const userCurr = countryVal === 'Local' ? 'ILS' : (data.currency || 'USD');
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
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const isHebURL = window.location.pathname.startsWith('/he') || window.location.search.includes('lang=he') || localStorage.getItem('proflow_lang') === 'he';
      const detectedCountry = isHebURL ? 'Local' : 'International';
      const detectedTerms = isHebURL ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG;
      const detectedCurr = isHebURL ? 'ILS' : 'USD';

      const defaultPayload = {
        user_id: userId,
        email: userEmail,
        business_name: 'עסק חדש',
        country: detectedCountry,
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

      if (insertError) console.error("Auto-init error:", insertError);

      if (newData) {
        setSettingId(newData.id);
        setBizName(newData.business_name);
        setBizEmail(newData.email);
        setBizPhone(newData.phone || '');
        setBizAddress(newData.address || '');
        setBizPlan(newData.plan);
        setBizRole(newData.role);
        setBizCountry(newData.country || detectedCountry);
        localStorage.setItem('proflow_cached_country', newData.country || detectedCountry);
        setDefaultTerms(newData.default_terms || detectedTerms);
        setTrialEndsAt(newData.trial_ends_at);
        setCurrency(newData.currency || detectedCurr);
        setTerms(newData.default_terms || detectedTerms);
      } else {
        setSettingId(null);
        setBizPlan('pro');
        setBizRole('user');
        setBizCountry(detectedCountry);
        localStorage.setItem('proflow_cached_country', detectedCountry);
        setDefaultTerms(detectedTerms);
        setTrialEndsAt(trialEndDate.toISOString());
        setCurrency(detectedCurr);
        setTerms(detectedTerms);
      }
    }
  }

  async function fetchAllAccounts() {
    const { data, error } = await supabase.from('business_settings').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setAllAccounts(data);
    }
  }

  async function handleAdminPlanChange(accountId, newPlan) {
    if (!newPlan) return;
    const updatePayload = { plan: newPlan };
    
    if (newPlan !== 'free') {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      updatePayload.trial_ends_at = trialEndDate.toISOString();
    } else {
      updatePayload.trial_ends_at = null;
    }

    const { data, error } = await supabase
      .from('business_settings')
      .update(updatePayload)
      .eq('id', accountId)
      .select();
    
    if (error) {
      setStatusMsg({ text: 'Error updating user plan: ' + error.message, type: 'error' });
    } else if (!data || data.length === 0) {
      setStatusMsg({ text: 'Error: RLS policy blocked update on business_settings.', type: 'error' });
    } else {
      setStatusMsg({ text: 'User plan updated successfully!', type: 'success' });
      fetchAllAccounts();
    }
  }

  async function handleAdminCountryChange(accountId, newCountry) {
    if (!newCountry) return;
    
    const updatePayload = { country: newCountry };
    if (newCountry === 'International') {
      updatePayload.default_terms = DEFAULT_TERMS_ENG;
      updatePayload.currency = 'USD';
    } else {
      updatePayload.default_terms = DEFAULT_TERMS_HEB;
      updatePayload.currency = 'ILS';
    }

    const { data, error } = await supabase
      .from('business_settings')
      .update(updatePayload)
      .eq('id', accountId)
      .select();
    
    if (error) {
      setStatusMsg({ text: 'Error updating user country: ' + error.message, type: 'error' });
    } else {
      setStatusMsg({ text: isHebrew ? 'אזור העסק עודכן בהצלחה!' : 'Business region updated successfully!', type: 'success' });
      fetchAllAccounts();
    }
  }

  async function handleToggleLifetime(accountId, currentTrialEnds) {
    const newTrialEnds = currentTrialEnds === null ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;
    const { error } = await supabase.from('business_settings').update({ trial_ends_at: newTrialEnds }).eq('id', accountId);
    if (error) {
      setStatusMsg({ text: 'Error updating user access: ' + error.message, type: 'error' });
    } else {
      setStatusMsg({ text: isHebrew ? 'סטטוס הגישה עודכן בהצלחה!' : 'Access status updated successfully!', type: 'success' });
      fetchAllAccounts();
    }
  }

  async function executeAdminAction() {
    if (!adminActionModal.account) return;
    const acc = adminActionModal.account;

    if (adminActionModal.type === 'freeze') {
      const { error } = await supabase.from('business_settings').update({ plan: 'free', trial_ends_at: null }).eq('id', acc.id);
      if (error) setStatusMsg({ text: 'Error freezing user account: ' + error.message, type: 'error' });
      else {
        setStatusMsg({ text: isHebrew ? 'המנוי הוקפא בהצלחה!' : 'Account frozen successfully!', type: 'success' });
        fetchAllAccounts();
      }
    } else if (adminActionModal.type === 'delete_data') {
      const targetUserId = acc.user_id;
      if (targetUserId) {
        await supabase.from('quotes').delete().eq('user_id', targetUserId);
        await supabase.from('clients').delete().eq('user_id', targetUserId);
        await supabase.from('services').delete().eq('user_id', targetUserId);
        await supabase.from('expenses').delete().eq('user_id', targetUserId);
      }
      const { error } = await supabase.from('business_settings').delete().eq('id', acc.id);
      if (error) setStatusMsg({ text: 'Error deleting account data: ' + error.message, type: 'error' });
      else {
        setStatusMsg({ text: isHebrew ? 'החשבון והנתונים נמחקו לצמיתות!' : 'Account and data deleted successfully!', type: 'success' });
        fetchAllAccounts();
      }
    }
    setAdminActionModal({ isOpen: false, type: null, account: null });
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (!session?.user?.id) return;

    const payload = {
      business_name: bizName,
      tax_id: bizTaxId,
      email: bizEmail,
      phone: bizPhone,
      address: bizAddress,
      logo_url: bizLogoUrl,
      default_terms: defaultTerms,
      country: bizCountry,
      currency: isLocalIsraeliBusiness ? 'ILS' : currency,
      user_id: session.user.id
    };

    if (settingId) {
      const { error } = await supabase.from('business_settings').update(payload).eq('id', settingId);
      if (error) setStatusMsg({ text: 'Error updating settings: ' + error.message, type: 'error' });
      else {
        localStorage.setItem('proflow_cached_country', bizCountry);
        setStatusMsg({ text: isHebrew ? 'הגדרות העסק עודכנו בהצלחה!' : 'Business settings updated successfully!', type: 'success' });
      }
    } else {
      const { data, error } = await supabase.from('business_settings').insert([payload]).select();
      if (error) setStatusMsg({ text: 'Error saving settings: ' + error.message, type: 'error' });
      else if (data && data[0]) {
        setSettingId(data[0].id);
        localStorage.setItem('proflow_cached_country', bizCountry);
        setStatusMsg({ text: isHebrew ? 'הגדרות העסק נשמרו בהצלחה!' : 'Business settings saved successfully!', type: 'success' });
      }
    }
  }

  async function handleSaveUpdatedClient(updatedClient) {
    const { error } = await supabase
      .from('clients')
      .update({
        company_name: updatedClient.company_name,
        email: updatedClient.email,
        phone: updatedClient.phone,
        client_type: updatedClient.client_type,
        tax_id: updatedClient.tax_id,
        address: updatedClient.address,
        notes: updatedClient.notes
      })
      .eq('id', updatedClient.id);

    if (error) {
      setStatusMsg({ text: 'Error updating client: ' + error.message, type: 'error' });
    } else {
      setStatusMsg({ text: 'Client updated successfully!', type: 'success' });
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
      setStatusMsg({ text: 'Error updating expense: ' + error.message, type: 'error' });
    } else {
      setStatusMsg({ text: 'Expense updated successfully!', type: 'success' });
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
      setStatusMsg({ text: 'Error adding expense: ' + error.message, type: 'error' });
    } else {
      setExpenseDesc('');
      setExpenseAmount('');
      setIsRecurring(false);
      fetchExpenses(session.user.id);
      setStatusMsg({ text: 'Expense added successfully!', type: 'success' });
    }
  }

  async function handleDeleteExpense(expenseId) {
    if (!window.confirm('Delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) setStatusMsg({ text: 'Error deleting expense: ' + error.message, type: 'error' });
    else fetchExpenses(session.user.id);
  }

  async function handleDeleteQuote(quoteId) {
    if (!window.confirm('Delete this quote permanently?')) return;
    await supabase.from('quote_items').delete().eq('quote_id', quoteId);
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) {
      setStatusMsg({ text: 'Error deleting quote: ' + error.message, type: 'error' });
    } else {
      setStatusMsg({ text: 'Quote deleted successfully!', type: 'success' });
      if (session?.user?.id) fetchQuotes(session.user.id);
    }
  }

  async function handleDeleteClient(clientId) {
    if (!window.confirm(isHebrew ? 'האם למחוק לקוח זה לצמיתות?' : 'Delete this client permanently?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) {
      setStatusMsg({ text: 'Error deleting client: ' + error.message, type: 'error' });
    } else {
      setStatusMsg({ text: 'Client deleted successfully!', type: 'success' });
      if (session?.user?.id) fetchClients(session.user.id);
    }
  }

  const exportToCSV = (dataArray, filename) => {
    if (!dataArray || dataArray.length === 0) {
      alert('No data to export.');
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

  const handleExportQuotes = () => {
    const exportData = filteredQuotes.map(q => ({
      ID: q.id,
      Client: q.clients?.company_name || '',
      Email: q.clients?.email || '',
      Status: q.status,
      Total: q.total,
      ValidUntil: q.valid_until || '',
      CreatedAt: q.created_at
    }));
    exportToCSV(exportData, 'quotes_report.csv');
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

    if (isSignUp) {
      const { data: existingBiz, error: checkErr } = await supabase
        .from('business_settings')
        .select('email')
        .eq('email', emailInput)
        .maybeSingle();

      if (existingBiz) {
        setAuthError('Email already registered! Please sign in or use password reset.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email: emailInput, password: passwordInput });
      if (error) {
        setAuthError('Email already registered! Please sign in or use password reset.');
      } else {
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          setAuthError('Email already exists! Please sign in.');
        } else {
          setAuthSuccess('Sign up successful! Initializing user profile with free trial...');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
      if (error) {
        setAuthError('Login error: check your credentials or reset password.');
      } else {
        setStatusMsg({ text: 'Logged in successfully', type: 'success' });
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
      setResetMsg('Error: ' + error.message);
    } else {
      setResetMsg('Password recovery link sent successfully to your email!');
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
      setRecoveryUpdateMsg('Error updating password: ' + error.message);
    } else {
      setRecoveryUpdateMsg('Password updated successfully! Redirecting...');
      setTimeout(() => {
        setIsPasswordRecoveryMode(false);
        window.location.href = window.location.origin;
      }, 2000);
    }
  };

  const handleSignOut = async () => await supabase.auth.signOut();

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { description: '', quantity: '1', unit_price: '' }]);

  const handleAddFromCatalog = (e) => {
    const sId = e.target.value;
    if (!sId) return;
    const svc = services.find(s => s.id.toString() === sId);
    if (svc) {
      if (items.length === 1 && items[0].description === '' && items[0].unit_price === '') {
        setItems([{ description: svc.name, quantity: '1', unit_price: svc.price }]);
      } else {
        setItems([...items, { description: svc.name, quantity: '1', unit_price: svc.price }]);
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
    if (error) setStatusMsg({ text: 'Error adding service: ' + error.message, type: 'error' });
    else {
      setNewServiceName('');
      setNewServicePrice('');
      fetchServices(session.user.id);
      setStatusMsg({ text: 'Service added to catalog successfully', type: 'success' });
    }
  }

  async function handleSaveEditedService(serviceId) {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('services')
      .update({ name: editServiceName, price: Number(editServicePrice) })
      .eq('id', serviceId);

    if (error) {
      setStatusMsg({ text: 'Error updating service: ' + error.message, type: 'error' });
    } else {
      setEditingServiceId(null);
      setEditServiceName('');
      setEditServicePrice('');
      fetchServices(session.user.id);
      setStatusMsg({ text: 'Service updated successfully!', type: 'success' });
    }
  }

  async function handleDeleteService(id) {
    if (!window.confirm('Delete this service from catalog?')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) setStatusMsg({ text: 'Error deleting service: ' + error.message, type: 'error' });
    else fetchServices(session.user.id);
  }

  const sendWhatsApp = (proposal) => {
    const clientNameVal = proposal.clients?.company_name || 'Client';
    let clientPhoneVal = proposal.clients?.phone ? proposal.clients.phone.replace(/\D/g, '') : '';
    
    if (clientPhoneVal.startsWith('0')) {
      clientPhoneVal = '1' + clientPhoneVal.slice(1);
    }

    const text = `Hi ${clientNameVal}, here is your quote #${proposal.id.slice(0, 6)} totaling ${sym}${formatNum(proposal.total)}. Valid until ${proposal.valid_until || 'N/A'}.\n\nView quote:\n${window.location.origin}/public-quote/${proposal.id}`;
    
    const url = clientPhoneVal 
      ? `https://wa.me/${clientPhoneVal}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
      
    window.open(url, '_blank');
  };

  const executeEmailSend = async (quote) => {
    setStatusMsg({ text: 'Sending email via cloud...', type: 'success' });

    try {
      const quoteSym = getCurrencySymbol(quote.currency);
      const quoteLink = `${window.location.origin}/public-quote/${quote.id}`;
      
      const clientEmailVal = quote.clients?.email || quote.client_email || '';
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

      if (error) throw error;

      // בדיקה האם השרת החיצוני או ה-Edge Function החזירו שגיאה פנימית בתשובה
      if (data && data.error) {
        throw new Error(data.error);
      }

      setStatusMsg({ text: '📧 Email sent successfully!', type: 'success' });
    } catch (err) {
      console.error("Email send error:", err);
      setStatusMsg({ text: 'Error sending email: ' + (err.message || 'Unknown server error'), type: 'error' });
    }
  };

  const handleProtectedAction = (quoteId, actionType, callback) => {
    if (actionType === 'edit' || actionType === 'duplicate') {
      if (!isBasicOrAbove) {
        setActiveTooltip({ quoteId, action: actionType });
        setTimeout(() => setActiveTooltip({ quoteId: null, action: null }), 2500);
        return;
      }
    }
    if (actionType === 'whatsapp' || actionType === 'delete') {
      if (!isPro) {
        setActiveTooltip({ quoteId, action: actionType });
        setTimeout(() => setActiveTooltip({ quoteId: null, action: null }), 2500);
        return;
      }
    }
    callback();
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  const discountAmount = (subtotal * Number(discount || 0)) / 100;
  const baseAmount = subtotal - discountAmount;
  
  let taxRate = getRegionTaxRate(bizCountry);
  
  let taxAmount = 0;
  let totalAmount = 0;

  taxAmount = baseAmount * taxRate;
  totalAmount = baseAmount + taxAmount;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyQuotesCount = quotes.filter(q => {
    const qDate = new Date(q.created_at);
    return qDate.getMonth() === currentMonth && qDate.getFullYear() === currentYear;
  }).length;

  const planLimit = effectivePlan.toLowerCase() === 'free' ? 5 : effectivePlan.toLowerCase() === 'basic' ? 20 : '∞';

  const totalQuotesCount = quotes.length;
  const totalRevenue = quotes.filter(q => q.status?.toLowerCase() === 'approved' || q.status?.toLowerCase() === 'paid').reduce((sum, q) => sum + Number(q.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const now = new Date();
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

  const sym = getCurrencySymbol(currency);

  const showQuoteForm = isCreatingQuote || editingQuoteId !== null;

  const handleEditClick = (quote) => {
    if (quote.status?.toLowerCase() === 'approved' || quote.status?.toLowerCase() === 'paid' || quote.signature) {
      alert('Cannot edit an approved/signed quote.');
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
    
    const quoteCurr = currency || (isHebrew ? 'ILS' : 'USD');
    setCurrency(quoteCurr);

    setQuoteStatus(quote.status ? quote.status.charAt(0).toUpperCase() + quote.status.slice(1) : 'Draft');
    setValidUntil(quote.valid_until || '');
    setDiscount(quote.discount || ''); 

    let editTerms = quote.terms || (isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    let editNotes = quote.notes || '';

    setTerms(editTerms);
    setNotes(editNotes);
    
    if (quote.quote_items && quote.quote_items.length > 0) {
      setItems(quote.quote_items.map(item => ({ description: item.description, quantity: item.quantity || '1', unit_price: item.unit_price })));
    } else {
      setItems([{ description: '', quantity: '1', unit_price: '' }]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatusMsg({ text: `Editing Quote #${quote.id.slice(0, 6)}...`, type: 'success' });
  };

  const handleCreateNewQuoteClick = () => {
    setIsCreatingQuote(true);
    setEditingQuoteId(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientType('');
    setClientTaxId('');
    setClientAddress('');
    setValidUntil('');
    setDiscount('');
    setCurrency(currency || (isHebrew ? 'ILS' : 'USD'));
    setTerms(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    setNotes('');
    setItems([{ description: '', quantity: '1', unit_price: '' }]);
  };

  const handleDuplicateQuote = (quote) => {
    setEditingQuoteId(null); 
    setIsCreatingQuote(true);
    setClientName(quote.clients?.company_name || '');
    setClientEmail(quote.clients?.email || '');
    setClientPhone(quote.clients?.phone || '');
    setClientType(quote.client_type || quote.clients?.client_type || '');
    setClientTaxId(quote.clients?.tax_id || '');
    setClientAddress(quote.clients?.address || '');
    
    const quoteCurr = currency || (isHebrew ? 'ILS' : 'USD');
    setCurrency(quoteCurr);

    setQuoteStatus('Draft');
    setValidUntil(quote.valid_until || '');
    setDiscount(quote.discount || '');

    let dupTerms = quote.terms || (isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    let dupNotes = quote.notes || '';

    setTerms(dupTerms);
    setNotes(dupNotes);
    
    if (quote.quote_items && quote.quote_items.length > 0) {
      setItems(quote.quote_items.map(item => ({ description: item.description, quantity: item.quantity || '1', unit_price: item.unit_price })));
    } else {
      setItems([{ description: '', quantity: '1', unit_price: '' }]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatusMsg({ text: 'Quote loaded for duplication.', type: 'success' });
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
    setValidUntil('');
    setDiscount('');
    setTerms(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
    setNotes('');
    setCurrency(currency || (isHebrew ? 'ILS' : 'USD'));
    setItems([{ description: '', quantity: '1', unit_price: '' }]);
    setStatusMsg({ text: 'Action cancelled. Here are your quotes.', type: 'success' });
  };

  async function handleSaveQuote(e) {
    e.preventDefault();
    if (!session?.user?.id) return;

    try {
      if (editingQuoteId) {
        const originalQuote = quotes.find(q => q.id === editingQuoteId);
        if (originalQuote && (originalQuote.status?.toLowerCase() === 'approved' || originalQuote.status?.toLowerCase() === 'paid' || originalQuote.signature)) {
          setStatusMsg({ text: 'Cannot update approved/signed quote.', type: 'error' });
          return;
        }
      }

      if (!editingQuoteId && !isSuperAdmin) {
        const limit = effectivePlan.toLowerCase() === 'free' ? 5 : effectivePlan.toLowerCase() === 'basic' ? 20 : Infinity;
        if (monthlyQuotesCount >= limit) {
          setStatusMsg({ 
            text: `Monthly quote limit reached for your plan (${limit} quotes). Upgrade to create more!`, 
            type: 'error' 
          });
          return;
        }
      }

      let clientId;
      const existingClient = clients.find(c => c.company_name?.toLowerCase() === clientName.toLowerCase() && c.user_id === session.user.id);
      
      const clientPayload = {
        company_name: clientName,
        email: clientEmail,
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

      const quotePayload = {
        client_id: clientId,
        client_type: clientType,
        currency: currency,
        subtotal: subtotal,
        tax_rate: taxRate,
        total: totalAmount,
        status: quoteStatus.toLowerCase(),
        valid_until: validUntil || null,
        discount: Number(discount || 0),
        terms: terms,
        notes: notes,
        user_id: session.user.id
      };

      let quoteId;

      if (editingQuoteId) {
        const { error: updateError } = await supabase.from('quotes').update(quotePayload).eq('id', editingQuoteId);
        if (updateError) throw updateError;
        quoteId = editingQuoteId;
        await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      } else {
        const { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([quotePayload]).select();
        if (quoteError) throw quoteError;
        quoteId = quoteData[0].id;
      }

      const quoteItemsToInsert = items.map(item => ({
        quote_id: quoteId,
        description: item.description,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        total_price: Number(item.quantity || 1) * Number(item.unit_price || 0)
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsToInsert);
      if (itemsError) throw itemsError;

      setStatusMsg({ 
        text: editingQuoteId 
          ? `Quote #${editingQuoteId.slice(0, 6)} successfully updated!` 
          : `Quote successfully created and saved to cloud! Total: ${sym}${formatNum(totalAmount)}`, 
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
      setValidUntil('');
      setDiscount('');
      setTerms(isHebrew ? DEFAULT_TERMS_HEB : DEFAULT_TERMS_ENG);
      setNotes('');
      setCurrency(currency || (isHebrew ? 'ILS' : 'USD'));
      setItems([{ description: '', quantity: '1', unit_price: '' }]);
      loadData(session.user.id, session.user.email);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: `Error saving quote: ${err.message}`, type: 'error' });
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
      bVal = a.clients?.company_name || '';
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
      return sortDirection === 'asc' ? statusA.localeCompare(statusB) : statusB.localeCompare(aValStr);
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

  if (isInitializing) {
    return (
      <div style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', background: '#090d16', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <ProFlowLogo size={48} rtl={false} />
          <div style={{ marginTop: '20px', fontSize: '1rem', color: '#94a3b8', fontWeight: 'bold' }}>Loading ProFlow...</div>
        </div>
      </div>
    );
  }

  if (isPasswordRecoveryMode) {
    return (
      <div style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} dir="ltr">
        <div style={{ background: 'white', padding: '30px', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '12px', fontWeight: '800' }}>Set New Password</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '18px' }}>Enter your new account password</p>
          
          {recoveryUpdateMsg && (
            <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: recoveryUpdateMsg.includes('Error') ? '#fee2e2' : '#dcfce7', color: recoveryUpdateMsg.includes('Error') ? '#991b1b' : '#166534', fontWeight: 'bold' }}>
              {recoveryUpdateMsg}
            </div>
          )}

          <form onSubmit={handleUpdatePasswordFromRecovery}>
            <input 
              type="password" 
              value={newPasswordInput} 
              onChange={(e) => setNewPasswordInput(e.target.value)} 
              placeholder="New password" 
              required 
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', marginBottom: '12px', fontSize: '0.95rem', direction: 'ltr', textAlign: 'left' }} 
            />
            <button type="submit" disabled={recoveryUpdateLoading} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>
              {recoveryUpdateLoading ? 'Updating...' : 'Update Password & Save'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div dir="ltr" style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', maxWidth: '380px', textAlign: 'left' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', fontFamily: 'Inter, Segoe UI, sans-serif' }}>
                <span style={{ color: '#0f172a' }}>Pro</span>
                <span style={{ color: '#4f46e5', marginLeft: '2px' }}>Flow</span>
              </span>
            </div>
            
            {isSignUp ? (
              <div dir="ltr" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', border: '1px solid #c7d2fe', padding: '10px 14px', borderRadius: '8px', marginTop: '14px', marginBottom: '4px', color: '#4f46e5', fontSize: '0.82rem', fontWeight: '700', textAlign: 'left', width: '100%', boxSizing: 'border-box', boxShadow: '0 2px 4px -1px rgba(79, 70, 229, 0.1)', lineHeight: '1.4' }}>
                To register and claim your 14-day free PRO trial, please enter your email and password.
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '10px' }}>
                Sign in to your dashboard
              </p>
            )}
          </div>

          {authSuccess && <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: '#dcfce7', color: '#166534' }}>{authSuccess}</div>}
          {authError && <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b' }}>{authError}</div>}

          <form onSubmit={handleAuth} autoComplete="off" data-lpignore="true">
            <input type="text" name="fake_user_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />
            <input type="password" name="fake_pass_login" tabIndex="-1" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Email</label>
              <input type="email" name="user_email_field" autoComplete="off" data-lpignore="true" data-bwignore="true" data-1p-ignore data-dashlane-ignore="true" data-form-type="other" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required placeholder="user@example.com" style={{ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#eff6ff', fontSize: '0.9rem' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Password</label>
              <input type="password" name="user_password_field" autoComplete="off" data-lpignore="true" data-bwignore="true" data-1p-ignore data-dashlane-ignore="true" data-form-type="other" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required placeholder="••••••••" style={{ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#eff6ff', fontSize: '0.9rem' }} />
            </div>
            <button type="submit" style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: '600', padding: 0 }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up!"}
            </button>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>

        {forgotOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir="ltr">
            <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'center', position: 'relative' }}>
              <button onClick={() => setForgotOpen(false)} style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>
              <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '8px', fontWeight: '800' }}>Password Recovery</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>Enter your email address to recover your password</p>
              
              {resetMsg && (
                <div style={{ padding: '8px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.8rem', background: resetMsg.includes('Error') ? '#fee2e2' : '#dcfce7', color: resetMsg.includes('Error') ? '#991b1b' : '#166534', fontWeight: 'bold' }}>
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
                  style={{ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', marginBottom: '12px', direction: 'ltr', textAlign: 'left', fontSize: '0.9rem' }} 
                />
                <button type="submit" disabled={resetLoading} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>
                  {resetLoading ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const hotQuotesList = quotes.filter(q => (q.view_count || 0) >= 3 && q.status !== 'approved' && q.status !== 'paid');
  const currentHotClientName = hotQuotesList.length > 0 ? (hotQuotesList[hotQuoteIndex % hotQuotesList.length]?.clients?.company_name || 'Client') : '';

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
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
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
        }
      `}</style>

      <AccessibilityModal isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} isHebrew={isHebrew} />
      <PricingModal 
        isOpen={showPricingModal} 
        onClose={() => setShowPricingModal(false)} 
        isHebrew={isHebrew} 
        isLocalIsraeliBusiness={isLocalIsraeliBusiness} 
        currentPlan={bizPlan}
        userId={session?.user?.id}
        onPlanUpdated={() => loadData(session?.user?.id, session?.user?.email)}
      />
      
      {adminActionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left' }}>
            <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.1rem', marginBottom: '8px' }}>
              {adminActionModal.type === 'freeze' 
                ? (isHebrew ? 'האם אתה בטוח שברצונך להקפיא/לנעול את המנוי?' : 'Are you sure you want to freeze/lock this subscription?') 
                : (isHebrew ? 'האם אתה בטוח שברצונך למחוק את החשבון והנתונים?' : 'Are you sure you want to delete this account and all data?')}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              {adminActionModal.account?.email}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setAdminActionModal({ isOpen: false, type: null, account: null })}
                style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {isHebrew ? 'ביטול' : 'Cancel'}
              </button>
              <button 
                onClick={executeAdminAction}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {isHebrew ? 'אישור פעולה' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <RegionConfirmModal 
        isOpen={pendingRegionChange !== null}
        onClose={() => setPendingRegionChange(null)}
        onConfirm={async () => {
          if (!pendingRegionChange) return;
          const { accountId, newCountry } = pendingRegionChange;
          setPendingRegionChange(null);
          await handleAdminCountryChange(accountId, newCountry);
        }}
        userEmail={pendingRegionChange?.userEmail || ''}
        newCountry={pendingRegionChange?.newCountry || 'Local'}
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

      <div style={{ flex: '1 0 auto', padding: '10px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px 16px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #e2e8f0', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(bizLogoUrl && bizLogoUrl.trim() !== '' && bizPlan === 'pro') ? (
                <img src={bizLogoUrl} alt="" style={{ height: '28px', maxWidth: '120px', objectFit: 'contain' }} />
              ) : (
                <ProFlowLogo size={24} />
              )}
            </div>

            <div style={{ flex: '0 1 auto', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AIChatWidget isHebrew={isHebrew} isDashboard={true} />
              {!isPro && !isSuperAdmin && (
                <button
                  onClick={() => setShowPricingModal(true)}
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span>Upgrade Plan</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {isSuperAdmin && (
                <span style={{ background: '#fef08a', color: '#854d0e', fontSize: '0.65rem', fontWeight: 'bold', padding: '3px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"/></svg>
                  SUPER ADMIN
                </span>
              )}
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{session.user.email}</span>
              <button onClick={handleSignOut} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}>Sign Out</button>
            </div>
          </div>

          {statusMsg.text && statusMsg.text !== 'System connected to Supabase.' && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', background: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: statusMsg.type === 'success' ? '#166534' : '#991b1b', fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {statusMsg.type !== 'success' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {isExpiringSoon && (
            <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <span>Your trial period expires in {trialDaysLeft} days!</span>
            </div>
          )}

          {trialEndsAt && !isTrialExpired && !isSuperAdmin && !isExpiringSoon && (
            <div style={{ background: '#eff6ff', border: '1px solid #3b82f6', color: '#1d4ed8', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '500', flexDirection: 'row', flexWrap: 'wrap', gap: '8px', fontSize: '0.8rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0z"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3 z"/></svg>
                Active Trial Period (Full PRO Access)
              </span>
              <span>Your trial period expires in {trialDaysLeft} days</span>
            </div>
          )}

          {isTrialExpired && !isSuperAdmin && (
            <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontWeight: '500', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Your trial has expired and you have been moved to the FREE tier. Please upgrade.</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setActiveTab('main'); setIsCreatingQuote(false); setEditingQuoteId(null); }}
              style={{
                flex: '1 1 auto', minWidth: '100px', padding: '7px 10px', borderRadius: '6px', 
                border: activeTab === 'main' ? '1px solid #4f46e5' : '1px solid #cbd5e1', 
                fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', 
                background: activeTab === 'main' ? '#4f46e5' : 'white', 
                color: activeTab === 'main' ? 'white' : '#475569', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
              }}
            >
              {t.quotesNav}
            </button>
            <button
              onClick={() => { setActiveTab('settings'); setIsCreatingQuote(false); setEditingQuoteId(null); }}
              style={{
                flex: '1 1 auto', minWidth: '100px', padding: '7px 10px', borderRadius: '6px', 
                border: activeTab === 'settings' ? '1px solid #4f46e5' : '1px solid #cbd5e1', 
                fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', 
                background: activeTab === 'settings' ? '#4f46e5' : 'white', 
                color: activeTab === 'settings' ? 'white' : '#475569', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
              }}
            >
              {t.settingsNav}
            </button>
            <button
              onClick={() => { setActiveTab('clients'); setIsCreatingQuote(false); setEditingQuoteId(null); }}
              style={{
                flex: '1 1 auto', minWidth: '100px', padding: '7px 10px', borderRadius: '6px', 
                border: activeTab === 'clients' ? '1px solid #4f46e5' : '1px solid #cbd5e1', 
                fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', 
                background: activeTab === 'clients' ? '#4f46e5' : 'white', 
                color: activeTab === 'clients' ? 'white' : '#475569', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
              }}
            >
              {t.clientsNav}
            </button>
            <button
              onClick={() => { setActiveTab('finances'); setIsCreatingQuote(false); setEditingQuoteId(null); }}
              style={{
                flex: '1 1 auto', minWidth: '100px', padding: '7px 10px', borderRadius: '6px', 
                border: activeTab === 'finances' ? '1px solid #4f46e5' : '1px solid #cbd5e1', 
                fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', 
                background: activeTab === 'finances' ? '#4f46e5' : 'white', 
                color: activeTab === 'finances' ? 'white' : '#475569', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
              }}
            >
              {t.financesNav}
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => { setActiveTab('admin_clients'); setIsCreatingQuote(false); setEditingQuoteId(null); }}
                style={{
                  flex: '1 1 auto', minWidth: '100px', padding: '7px 10px', borderRadius: '6px', 
                  border: activeTab === 'admin_clients' ? '1px solid #4f46e5' : '1px solid #cbd5e1', 
                  fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', 
                  background: activeTab === 'admin_clients' ? '#4f46e5' : 'white', 
                  color: activeTab === 'admin_clients' ? 'white' : '#475569', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                }}
              >
                {t.usersAdminNav}
              </button>
            )}
          </div>

          {activeTab === 'main' && !showQuoteForm && (
            <>
              {!isSuperAdmin && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '3px solid #4f46e5', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{t.totalQuotes}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b' }}>{totalQuotesCount}</div>
                    {!isPro && (
                      <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 'bold' }}>
                        This month: {monthlyQuotesCount} / {planLimit}
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '3px solid #10b981', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{t.totalRevenue}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{sym}{formatNum(totalRevenue)}</div>
                  </div>
                </div>
              )}

              {hotQuotesList.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                    </span>
                    <span>
                      {t.hotQuoteAlert(currentHotClientName)}
                    </span>
                  </div>
                </div>
              )}

              <QuotesTab
                quotes={filteredQuotes}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                quoteSortField={quoteSortField}
                quoteSortDirection={quoteSortDirection}
                handleQuoteSort={handleQuoteSort}
                handleCreateNewQuoteClick={handleCreateNewQuoteClick}
                handleExportQuotes={handleExportQuotes}
                handleEditClick={handleEditClick}
                handleDuplicateQuote={handleDuplicateQuote}
                sendWhatsApp={sendWhatsApp}
                executeEmailSend={executeEmailSend}
                handleDeleteQuote={handleDeleteQuote}
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
              />

              <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '800', margin: 0, marginBottom: '12px' }}>{t.servicesCatalog}</h2>
                
                <form onSubmit={handleAddService} style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexDirection: 'row', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder={t.serviceName} 
                    value={newServiceName} 
                    onChange={(e) => setNewServiceName(e.target.value)} 
                    required 
                    style={{ flex: '2 1 140px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: '#f8fafc' }} 
                  />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder={t.defaultPrice} 
                    value={newServicePrice} 
                    onChange={(e) => setNewServicePrice(e.target.value)} 
                    required 
                    style={{ flex: '1 1 80px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.8rem', background: '#f8fafc' }} 
                  />
                  <button type="submit" style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
                    {t.addService}
                  </button>
                </form>

                <div style={{ overflowX: 'auto' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '320px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '6px' }}>{t.description}</th>
                        <th style={{ padding: '6px' }}>{t.defaultPrice}</th>
                        <th style={{ padding: '6px' }}>{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.length === 0 ? (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                            Your catalog is empty. Add services above.
                          </td>
                        </tr>
                      ) : (
                        services.map((svc) => {
                          const isEditingThisSvc = editingServiceId === svc.id;
                          return (
                            <tr key={svc.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                              <td style={{ padding: '8px 6px', fontWeight: '400', color: '#1e293b' }}>
                                {isEditingThisSvc ? (
                                  <input 
                                    type="text" 
                                    value={editServiceName} 
                                    onChange={(e) => setEditServiceName(e.target.value)} 
                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', fontSize: '0.8rem' }} 
                                  />
                                ) : (
                                  svc.name
                                )}
                              </td>
                              <td style={{ padding: '8px 6px', color: '#4f46e5', fontWeight: '400' }}>
                                {isEditingThisSvc ? (
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={editServicePrice} 
                                    onChange={(e) => setEditServicePrice(e.target.value)} 
                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100px', fontSize: '0.8rem' }} 
                                  />
                                ) : (
                                  `${sym}${formatNum(svc.price)}`
                                )}
                              </td>
                              <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {isEditingThisSvc ? (
                                  <>
                                    <button 
                                      onClick={() => handleSaveEditedService(svc.id)}
                                      style={{ background: '#10b981', color: 'white', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem' }}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingServiceId(null)}
                                      style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem' }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setEditingServiceId(svc.id);
                                        setEditServiceName(svc.name);
                                        setEditServicePrice(svc.price);
                                      }}
                                      style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem' }}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      title={t.delete}
                                      onClick={() => handleDeleteService(svc.id)}
                                      style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '400', fontSize: '0.65rem' }}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                   </table>
                </div>
              </div>
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
              handleDeleteClient={handleDeleteClient}
              isHebrew={isHebrew}
              t={t}
            />
          )}

          {activeTab === 'settings' && (
            <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '800', marginTop: 0, marginBottom: '16px' }}>
                {isHebrew ? 'הגדרות עסק' : 'Business Settings'}
              </h2>
              <form onSubmit={handleSaveSettings}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'שם העסק' : 'Business Name'}</label>
                    <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} required style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'ח.פ / עוסק מורשה / פטור' : 'Tax ID / Lic No'}</label>
                    <input type="text" value={bizTaxId} onChange={(e) => setBizTaxId(e.target.value)} placeholder="516000000" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'אימייל עסק' : 'Business Email'}</label>
                    <input type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="business@example.com" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'טלפון עסק' : 'Business Phone'}</label>
                    <input type="text" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="050-0000000" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>
                      {isHebrew ? 'מטבע העסק' : 'Business Currency'}
                    </label>
                    <select 
                      value={currency} 
                      onChange={(e) => setCurrency(e.target.value)}
                      disabled={isLocalIsraeliBusiness}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: isLocalIsraeliBusiness ? '#f1f5f9' : '#f8fafc', fontSize: '0.85rem', fontWeight: 'bold', color: '#4f46e5' }}
                    >
                      {isLocalIsraeliBusiness ? (
                        <option value="ILS">ILS (₪)</option>
                      ) : (
                        <>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="CAD">CAD ($)</option>
                          <option value="AUD">AUD ($)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'כתובת העסק' : 'Business Address'}</label>
                    <input type="text" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="e.g. Main St 10, City" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'כתובת תמונת לוגו (URL)' : 'Logo Image URL'} {bizPlan !== 'pro' && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>(Requires Pro plan)</span>}</label>
                  <input type="url" value={bizLogoUrl} onChange={(e) => setBizLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" disabled={bizPlan !== 'pro'} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: bizPlan !== 'pro' ? '#f1f5f9' : '#f8fafc', fontSize: '0.85rem' }} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'תנאים כלליים ברירת מחדל להצעות חדשות' : 'Default Terms & Conditions for New Quotes'}</label>
                  <textarea 
                    value={defaultTerms} 
                    onChange={(e) => setDefaultTerms(e.target.value)} 
                    rows="4"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: '1.4' }} 
                  />
                </div>

                <button type="submit" style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
                  {isHebrew ? 'שמור הגדרות עסק' : 'Save Business Settings'}
                </button>
              </form>

              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  {isHebrew ? 'ניהול מנוי וחבילת שירות' : 'Subscription Management'}
                </h3>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '8px' }}>
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                     </div>
                     <div>
                       <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' }}>{bizPlan} PLAN</div>
                       <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                         {isTrialExpired ? (isHebrew ? 'תקופת הניסיון הסתיימה' : 'Trial Expired') : (trialDaysLeft ? (isHebrew ? `נותרו ${trialDaysLeft} ימי ניסיון` : `Trial ends in ${trialDaysLeft} days`) : (isHebrew ? 'מנוי פעיל' : 'Active Subscription'))}
                       </div>
                     </div>
                   </div>
                   <div style={{ display: 'flex', gap: '8px' }}>
                     <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: '#4f46e5', color: 'white', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="m16 14-4-4-4 4"/><path d="M2 22h20"/></svg>
                       {isHebrew ? 'שדרוג / שינוי מסלול' : 'Upgrade / Change Plan'}
                     </button>
                     {effectivePlan !== 'free' && (
                       <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: '#fff', color: '#dc2626', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                         {isHebrew ? 'ביטול מנוי' : 'Cancel Subscription'}
                       </button>
                     )}
                   </div>
                </div>
              </div>
            </div>
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
              handleDeleteExpense={handleDeleteExpense}
              isHebrew={isHebrew}
              sym={sym}
              formatNum={formatNum}
              t={t}
            />
          )}

          {isSuperAdmin && activeTab === 'admin_clients' && (
            <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #e2e8f0' }}>
              
              {(() => {
                const totalU = allAccounts.length;
                const localU = allAccounts.filter(a => (a.country || 'Local') === 'Local').length;
                const intlU = allAccounts.filter(a => a.country === 'International').length;
                
                const activeRecent = allAccounts.filter(a => {
                  if (!a.last_sign_in) return false;
                  const diff = Date.now() - new Date(a.last_sign_in).getTime();
                  return diff < 10 * 60 * 1000;
                }).length;

                // רשימת כל המשתמשים החדשים ב-24 השעות האחרונות (לצורך הצגה במודל)
                const newUsersList = allAccounts.filter(a => {
                  if (!a.created_at) return false;
                  const diff = Date.now() - new Date(a.created_at).getTime();
                  return diff < 24 * 60 * 60 * 1000;
                });

                // ה-Counter יציג רק כמה משתמשים נוספו מאז הצפייה האחרונה (lastSeenNewUsersTime)
                const unreadNewUsersCount = newUsersList.filter(a => {
                  if (!a.created_at) return false;
                  return new Date(a.created_at).getTime() > lastSeenNewUsersTime;
                }).length;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    <div 
                      onClick={() => handleOpenNewUsersModal(newUsersList)}
                      style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      title="Click to view new users list"
                    >
                      <div style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '6px'}}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        NEW USERS (24H)
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#4f46e5' }}>{unreadNewUsersCount}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>ACTIVE (10M)</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#166534' }}>{activeRecent} <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#166534'}}/></div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>LOCAL (LCL)</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{localU}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#991b1b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>INTERNATIONAL</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#991b1b' }}>{intlU}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>TOTAL USERS</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{totalU}</div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z" /></svg>
                </h2>
              </div>
              <p style={{ color: '#64748b', marginBottom: '12px', fontSize: '0.8rem' }}>
                View all registered users and manage their subscription plans and regions.
              </p>

              <div style={{ marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Search user (email or business)..." 
                  value={adminSearchTerm}
                  onChange={(e) => setAdminSearchTerm(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '220px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: '#f8fafc' }}
                />
              </div>
              
              <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('email')}>
                        Email {sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('business_name')}>
                        Business Name {sortField === 'business_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('plan')}>
                        Plan {sortField === 'plan' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('country')}>
                        Region {sortField === 'country' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('role')}>
                        Role {sortField === 'role' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('trial_ends_at_status')}>
                        Trial / Lifetime Status {sortField === 'trial_ends_at_status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('last_sign_in')}>
                        Last Sign In {sortField === 'last_sign_in' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '0.8rem' }}>
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredAdminAccounts.map(acc => {
                        const isLifetime = acc.trial_ends_at === null || acc.trial_ends_at === undefined;
                        const currentCountry = acc.country || 'Local';
                        
                        const planValue = acc.plan ? acc.plan.toLowerCase() : 'free';
                        const pBg = planValue === 'pro' ? '#e0e7ff' : planValue === 'basic' ? '#e0f2fe' : '#f1f5f9';
                        const pColor = planValue === 'pro' ? '#4f46e5' : planValue === 'basic' ? '#0284c7' : '#64748b';
                        const pBorder = planValue === 'pro' ? '#c7d2fe' : planValue === 'basic' ? '#bae6fd' : '#e2e8f0';

                        const rBg = currentCountry === 'Local' ? '#dcfce7' : '#fee2e2';
                        const rColor = currentCountry === 'Local' ? '#166534' : '#991b1b';
                        const rBorder = currentCountry === 'Local' ? '#bbf7d0' : '#fecaca';

                        let isRecentActive = false;
                        if (acc.last_sign_in) {
                          const diffMs = Date.now() - new Date(acc.last_sign_in).getTime();
                          isRecentActive = diffMs < 10 * 60 * 1000;
                        }

                        return (
                          <tr key={acc.id + '_' + liveTick} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                            <td style={{ padding: '10px 6px', fontWeight: '500', color: '#1e293b' }}>{acc.email || 'N/A'}</td>
                            <td style={{ padding: '10px 6px', color: '#334155' }}>{acc.business_name || 'עסק חדש'}</td>
                            <td style={{ padding: '10px 6px' }}>
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <select 
                                  value={planValue} 
                                  onChange={(e) => handleAdminPlanChange(acc.id, e.target.value)}
                                  style={{ 
                                    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                                    padding: isHebrew ? '4px 10px 4px 24px' : '4px 24px 4px 10px', 
                                    borderRadius: '8px', 
                                    border: `1px solid ${pBorder}`, 
                                    background: pBg, 
                                    fontSize: '0.7rem', 
                                    fontWeight: '800', 
                                    color: pColor,
                                    cursor: 'pointer', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                >
                                  <option value="free">FREE</option>
                                  <option value="basic">BASIC</option>
                                  <option value="pro">PRO</option>
                                </select>
                                <div style={{ position: 'absolute', [isHebrew ? 'left' : 'right']: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: pColor }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 6px' }}>
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <select 
                                  value={currentCountry} 
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPendingRegionChange({ accountId: acc.id, newCountry: val, userEmail: acc.email });
                                  }}
                                  style={{ 
                                    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                                    padding: isHebrew ? '4px 10px 4px 24px' : '4px 24px 4px 10px', 
                                    borderRadius: '8px', 
                                    border: `1px solid ${rBorder}`, 
                                    background: rBg, 
                                    fontSize: '0.7rem', 
                                    fontWeight: '800', 
                                    color: rColor,
                                    cursor: 'pointer', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                >
                                  <option value="Local">LCL</option>
                                  <option value="International">Intl</option>
                                </select>
                                <div style={{ position: 'absolute', [isHebrew ? 'left' : 'right']: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: rColor }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 6px', color: acc.role === 'super_admin' ? '#ef4444' : '#64748b', fontWeight: '600' }}>
                              {acc.role || 'user'}
                            </td>
                            <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                                <button 
                                  onClick={() => {
                                    if (!isLifetime) {
                                      setPendingLifetimeUser(acc);
                                    } else {
                                      handleToggleLifetime(acc.id, acc.trial_ends_at);
                                    }
                                  }}
                                  style={{ 
                                    background: isLifetime ? '#f3e8ff' : '#f1f5f9', 
                                    color: isLifetime ? '#6d28d9' : '#475569', 
                                    border: '1px solid',
                                    borderColor: isLifetime ? '#e9d5ff' : '#cbd5e1',
                                    padding: '4px 10px', 
                                    borderRadius: '20px', 
                                    cursor: 'pointer', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                  title={isLifetime ? 'Click to revoke lifetime' : 'Click to grant lifetime'}
                                >
                                  {isLifetime ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  )}
                                  <span>{isLifetime ? 'Lifetime' : 'Trial'}</span>
                                </button>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                  {isLifetime ? '(No expiry)' : `Ends: ${new Date(acc.trial_ends_at).toLocaleDateString('en-GB')}`}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 6px', fontSize: '0.75rem', color: '#475569', direction: 'ltr', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span title={isRecentActive ? 'Active recently' : 'Inactive'} style={{ fontSize: '0.6rem' }}>
                                <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isRecentActive ? '#22c55e' : '#ef4444'}}></span>
                              </span>
                              <span>{acc.last_sign_in ? new Date(acc.last_sign_in).toLocaleString('en-GB') : 'N/A'}</span>
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                              <button
                                onClick={() => setSelectedUserDetails(acc)}
                                style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="View User Details"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                <span>Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="no-print mobile-bottom-nav" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, width: '100%', background: '#1e293b', color: 'white', justifyContent: 'space-around', padding: '10px 0', zIndex: 9998, boxShadow: '0 -4px 15px rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => { setActiveTab('main'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'main' && !showQuoteForm ? '#38bdf8' : '#94a3b8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '1px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </span>
          {t.quotesNav}
        </button>
        <button onClick={() => { setActiveTab('clients'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'clients' ? '#38bdf8' : '#94a3b8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '1px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          {t.clientsNav}
        </button>
        <button onClick={() => { setActiveTab('settings'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'settings' ? '#38bdf8' : '#94a3b8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '1px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </span>
          {t.settingsNav}
        </button>
        <button onClick={() => { setActiveTab('finances'); setIsCreatingQuote(false); setEditingQuoteId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'finances' ? '#38bdf8' : '#94a3b8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '1px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </span>
          {t.financesNav}
        </button>
        <button onClick={() => { handleCreateNewQuoteClick(); }} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '1px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '2px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          {isHebrew ? 'חדש' : 'New'}
        </button>
      </div>

      <footer className="no-print" style={{ textAlign: 'center', padding: '16px', marginTop: '30px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem' }}>
        <div style={{ marginBottom: '6px' }}>
          Powered by <strong>ProFlow</strong> - Business Management & Quoting System
        </div>
        <button onClick={() => setShowAccessibility(true)} style={{ background: 'none', border: 'none', color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px', verticalAlign: 'middle'}}><circle cx="12" cy="5" r="2"/><path d="m5 10 7-1 7 1"/><path d="m12 10v7"/><path d="m12 17-4 5"/><path d="m12 17 4 5"/></svg>
          Accessibility Statement
        </button>
      </footer>
    </div>
  );
}