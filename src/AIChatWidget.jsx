import { useState, useRef, useEffect } from 'react';
import { supabase } from './shared/supabase';
import { MessageCircleMore, Sparkles, X, Send, MessageSquarePlus, ChevronLeft, ChevronRight, FileText, LifeBuoy, CreditCard, Building2, MessageSquare, History } from 'lucide-react';
import { NEON } from './theme/neonTheme';
import {
  buildPublicChatStorageKey,
  readStoredPublicTranscript,
  writeStoredPublicTranscript,
  createChatContextGuard,
} from './utils/aiChatSession';
import { GUIDED_SECOND_STEPS, getGuidedIntentLabel, getGuidedIntentDescription, getGuidedGroupForIntent, getTopicGroupsForSurface, getContextualTopicGroups } from './utils/guidedChatIntents';
import { getNavigationLabel, dispatchSafeNavigation } from './utils/safeNavigation';
import { buildAiHelpContext } from './utils/aiHelpContext';
import { getActiveBlockers, publishBlocker, resolveBlockers } from './utils/aiHelpBlockers';
import { boundTranscript } from './utils/aiHelpContract';
import { formatMessageTime, formatDaySeparatorLabel, computeDaySeparatorFlags } from './utils/aiChatHistoryFormat';
import { resolveAIChatContext, allowsExistingQuoteReference } from './utils/aiChatContext';
import { CHAT_CONTRACT_VERSION } from './utils/aiChatContract';
import { formatQuoteFallback } from './utils/quoteNumber';
import AiChatIcon from './components/AiChatIcon';

// Dynamic Compact Guided Buttons task: one small, purely-decorative icon
// per top-level group (Section 7's own "small relevant icon" requirement).
// Lives here, not in guidedChatIntents.js, since that module is deliberately
// plain data (id/label/description strings only, reused by the Edge
// Function's own parity test) - icon choice is a presentation-only concern
// local to this widget. Keyed by GUIDED_TOPIC_GROUPS' own `id` field.
const GUIDED_GROUP_ICONS = {
  quotes: FileText,
  help_support: LifeBuoy,
  plans_billing: CreditCard,
  my_business: Building2,
  feedback_questions: MessageSquare,
};

function computeDefaultWelcome(isHebrew, isDashboard) {
  return isHebrew
    ? (isDashboard ? 'שלום! אני עוזר ה-AI של TEKANGO. איך אעזור לך בממשק המערכת היום?' : 'שלום! אני עוזר ה-AI של TEKANGO. יש לך שאלות על המחירים, המסלולים או הפיצ\'רים שלנו?')
    : (isDashboard ? 'Hello! I am TEKANGO AI assistant. How can I help you with the interface today?' : 'Hello! I am TEKANGO AI assistant. Have questions about our pricing, plans, or features?');
}

// Context-Driven AI Chat closure task (2026-09-18), §5 "Dynamic Greeting By
// Context": the opening line must say what it can already see (current
// screen/workflow), not a one-size-fits-all sentence. Deliberately mirrors
// only currentArea/workflowContext - the same non-authoritative UX-hint
// signals already sent to the Edge Function (validation.ts CURRENT_AREA_IDS/
// WORKFLOW_MODE_IDS) - never invents a context this widget doesn't actually
// have. Falls back to `null` (caller uses the existing generic welcome) for
// any area/state this task did not explicitly spec an opener for, rather
// than guessing a sentence for it.
function computeContextualDashboardGreeting(isHebrew, currentArea, workflowContext) {
  if (workflowContext?.itemWizard?.open) {
    return isHebrew
      ? 'אני רואה שאתה מוסיף עכשיו פריט להצעה. במה תרצה עזרה?'
      : 'I see you’re adding an item to the quote right now. How can I help?';
  }
  if (workflowContext?.screen === 'quote_editor') {
    if (workflowContext.mode === 'edit') {
      return isHebrew
        ? 'אני רואה שאתה עורך עכשיו הצעה קיימת. במה תרצה עזרה?'
        : 'I see you’re editing an existing quote right now. How can I help?';
    }
    return isHebrew
      ? 'אני רואה שאתה יוצר עכשיו הצעת מחיר חדשה. במה תרצה עזרה?'
      : 'I see you’re creating a new quote right now. How can I help?';
  }
  switch (currentArea) {
    case 'clients':
      return isHebrew
        ? 'אני רואה שאתה עובד עכשיו עם לקוחות. במה תרצה עזרה?'
        : 'I see you’re working with clients right now. How can I help?';
    case 'settings':
      return isHebrew
        ? 'אני רואה שאתה נמצא בהגדרות העסק שלך. במה תרצה עזרה?'
        : 'I see you’re in your business settings. How can I help?';
    case 'finances':
      return isHebrew
        ? 'אני רואה שאתה נמצא בעמוד הפיננסים. במה תרצה עזרה?'
        : 'I see you’re in the finances screen. How can I help?';
    case 'catalog':
      return isHebrew
        ? 'אני רואה שאתה נמצא בקטלוג הפריטים שלך. במה תרצה עזרה?'
        : 'I see you’re in your items catalog. How can I help?';
    case 'plans':
      return isHebrew
        ? 'אני רואה שאתה צופה במסלולים ובתמחור. במה תרצה עזרה?'
        : 'I see you’re looking at plans and pricing. How can I help?';
    default:
      return null;
  }
}

function computeDashboardWelcome(isHebrew, currentArea, workflowContext) {
  return computeContextualDashboardGreeting(isHebrew, currentArea, workflowContext)
    || computeDefaultWelcome(isHebrew, true);
}

// Guided Interactive Entry opening line (AI Chat Hardening overnight task,
// Track E - "first login is not the only place a name matters", here: "don't
// start with a blank box, greet by name when trustworthy"). `displayName` is
// the account's own real, already-approved `business_name` (see Dashboard.jsx's
// AIChatWidget mount) - never derived from email, never invented. Falls back
// to a neutral greeting (no name) when no trustworthy display name exists yet
// (e.g. a placeholder "New Business" name, or the public/unauthenticated
// surface, which never receives a name at all).
function computeGuidedGreeting(isHebrew, displayName) {
  if (displayName) {
    return isHebrew ? `שלום ${displayName}, במה תרצה עזרה?` : `Hello ${displayName}, how can I help you today?`;
  }
  return isHebrew ? 'שלום! במה תרצה עזרה?' : 'Hello! How can I help you today?';
}

// AI Chat History UX task: every NEWLY created message gets a real creation
// timestamp (never a render-time guess, never fabricated for something that
// already existed before this feature). Messages loaded from pre-existing
// storage that predate this field simply keep `createdAt: undefined` -
// aiChatHistoryFormat.js's own helpers already render/separate those
// gracefully with no time badge and no separator, never a fake time.
function withCreatedAt(message) {
  return { ...message, createdAt: new Date().toISOString() };
}

function swapSupportEmail(text, isHebrew) {
  if (!isHebrew) return text.replace(/support@tekango\.com/gi, 'info@tekango.com');
  return text.replace(/info@tekango\.com/gi, 'support@tekango.com');
}

// Public (anonymous) surface only - loads this locale's own bounded,
// schema-versioned transcript from sessionStorage, or falls back to a
// fresh default welcome on first visit / corrupt / oversized / wrong-
// version storage. Never used for the authenticated Dashboard surface,
// which is in-memory only (see the isDashboard branch at the call site).
function loadPublicMessages(isHebrew) {
  const storageKey = buildPublicChatStorageKey({ isHebrew });
  const stored = readStoredPublicTranscript(storageKey);
  if (stored) {
    return stored.map(msg => (
      msg.role === 'assistant' ? { ...msg, content: swapSupportEmail(msg.content, isHebrew) } : msg
    ));
  }
  return [withCreatedAt({ role: 'assistant', content: computeDefaultWelcome(isHebrew, false) })];
}

export default function AIChatWidget({ isHebrew = true, isDashboard = false, currentArea = null, businessDisplayName = null, workflowContext = null, activeEditingQuoteId = null, helpSources = null }) {
  const [isOpen, setIsOpen] = useState(false);

  // Context-Driven AI Chat V3, §5: the ONE canonical context resolver - a
  // pure derivation from this render's own props, never a second store.
  // Feeds the contextual per-screen guided menu (§16) below.
  const chatContext = resolveAIChatContext({ isDashboard, currentArea, workflowContext });

  // Context-Driven AI Chat V3, §18: a caller-generated monotonic counter,
  // bumped at every existing reset boundary (see the 3 sites below that
  // already call guardRef.current.reset() - this piggybacks on those exact
  // same boundaries, never a new one) and round-tripped on every request/
  // response so a stale reply is identifiable on the wire, not only via the
  // pre-existing purely-client-local guardRef mechanism.
  const contextRevisionRef = useRef(0);

  // §15 "focus returns to the exact prior workflow control where possible":
  // captured at each OPEN trigger itself (the launcher button's onClick,
  // the external open-proflow-ai-chat listener), synchronously, BEFORE the
  // setIsOpen(true) that causes it - never inside the popup's own open
  // effect. The launcher button is conditionally unmounted the instant
  // isOpen becomes true (`{!isOpen && (<button .../>) }` below), so by the
  // time any effect could observe document.activeElement afterward, that
  // element (and the fact it was ever focused) is already gone - capturing
  // it here, before the state update, is the only point it's still real.
  const popupRef = useRef(null);
  const returnFocusRef = useRef(null);
  const captureReturnFocus = () => { returnFocusRef.current = document.activeElement; };

  // Authenticated-surface-only identity tracking, used exclusively to
  // detect reset boundaries (login/logout/user switch) below - the id
  // itself is never displayed and never sent to the Edge Function.
  // Verified log attribution is derived server-side from the request's own
  // Authorization header (AI Chat Phase 1, §8) - the frontend does not (and
  // must not) claim an identity on the caller's behalf.
  const [dashboardUserId, setDashboardUserId] = useState(null);

  useEffect(() => {
    if (!isDashboard) return undefined;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setDashboardUserId(session?.user?.id || null);
    }).catch(() => { /* ignore - treated as no authenticated identity */ });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setDashboardUserId(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setDashboardUserId(session?.user?.id || null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isDashboard]);

  const [messages, setMessages] = useState(() => (
    isDashboard
      ? [withCreatedAt({ role: 'assistant', content: computeDashboardWelcome(isHebrew, currentArea, workflowContext) })]
      : loadPublicMessages(isHebrew)
  ));

  // Context-generation guard (AI Chat Phase 1, §6): every outgoing request
  // captures the current generation; a reset boundary bumps it so any
  // reply that resolves afterward is recognized as stale and discarded
  // instead of being appended into the new context.
  const guardRef = useRef(null);
  if (guardRef.current === null) guardRef.current = createChatContextGuard();

  // Explicit quote context (Gate 2 §6) - never automatic. selectedQuoteId
  // is only ever set by the user's own click in the quote selector below.
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [selectedQuoteSummary, setSelectedQuoteSummary] = useState(null);
  const [availableQuotes, setAvailableQuotes] = useState(null);
  const [quoteSearchTerm, setQuoteSearchTerm] = useState('');

  // Identifies the active chat IDENTITY context: surface + locale/market +
  // (authenticated) user identity - deliberately NOT including
  // selectedQuoteId (that boundary is handled by its own effect below, so
  // picking a new quote doesn't get its own selection immediately reset by
  // this effect on the very next tick). Mandatory reset boundaries (§5
  // Gate 1): logout, login as a different user, authenticated user change,
  // market/locale change, and public<->authenticated switch all change
  // this key - and, since a stale selected quote from a previous identity
  // must never survive into a new one, this effect also clears quote
  // selection state.
  const contextKey = isDashboard
    ? `dashboard:${isHebrew ? 'he' : 'en'}:${dashboardUserId || 'unauthenticated'}`
    : `public:${isHebrew ? 'he' : 'en'}`;
  const previousContextKeyRef = useRef(null);

  useEffect(() => {
    if (previousContextKeyRef.current === null) {
      previousContextKeyRef.current = contextKey;
      return;
    }
    if (previousContextKeyRef.current === contextKey) return;
    previousContextKeyRef.current = contextKey;

    // Reset boundary crossed: invalidate any in-flight request for the old
    // context and start a clean transcript for the new one. Public reloads
    // that locale's own stored transcript (still isolated per-locale);
    // authenticated always starts clean (in-memory only, never persisted).
    guardRef.current.reset();
    contextRevisionRef.current += 1;
    setLoading(false);
    setMessages(
      isDashboard
        ? [withCreatedAt({ role: 'assistant', content: computeDashboardWelcome(isHebrew, currentArea, workflowContext) })]
        : loadPublicMessages(isHebrew)
    );
    setGuidedIntent(null);
    setGuidedSubtopic(null);
    setSelectedQuoteId(null);
    setSelectedQuoteSummary(null);
    setAvailableQuotes(null);
    setQuoteSearchTerm('');
    // §26 "Logout/user change: clear all chat private state" - archived
    // Previous Chats threads are conversation content too, never carried
    // across an identity/market/surface boundary.
    setThreads([]);
    setShowPreviousChats(false);
    setExpandedThreadId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  // Explicit quote context reset boundary (§6.1: "switching quote starts a
  // fresh quote-context conversation in v1, to prevent mixed private
  // context"). Deliberately does NOT touch selectedQuoteId/
  // selectedQuoteSummary themselves - those are already correct (set by
  // the selector's onClick, or cleared by the chip's own clear button)
  // before this effect ever runs; it only resets the conversation around
  // the new/cleared selection.
  const previousSelectedQuoteIdRef = useRef(undefined);
  useEffect(() => {
    if (previousSelectedQuoteIdRef.current === undefined) {
      previousSelectedQuoteIdRef.current = selectedQuoteId;
      return;
    }
    if (previousSelectedQuoteIdRef.current === selectedQuoteId) return;
    previousSelectedQuoteIdRef.current = selectedQuoteId;

    guardRef.current.reset();
    contextRevisionRef.current += 1;
    setLoading(false);
    setMessages(
      isDashboard
        ? [withCreatedAt({ role: 'assistant', content: computeDashboardWelcome(isHebrew, currentArea, workflowContext) })]
        : loadPublicMessages(isHebrew)
    );
    // §9 "EDIT QUOTE CURRENT OBJECT": when this selection change is the
    // activeEditingQuoteId auto-bind (see the effect below), the quote is
    // already fully in context - forcing the manual 'quotes'
    // picker/second-step here would be a redundant extra step (that leaf is
    // deliberately excluded from quote_editor_edit's own contextual menu,
    // see guidedChatIntents.js's CONTEXTUAL_MENUS). Any OTHER selection
    // change (the user's own manual picker click, or clearing it) keeps the
    // original guided-quotes-context behavior unchanged.
    setGuidedIntent(selectedQuoteId && selectedQuoteId === activeEditingQuoteId ? null : 'quotes');
    setGuidedSubtopic(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuoteId]);

  // Context-Driven AI Chat V3, §9 "EDIT QUOTE CURRENT OBJECT": the quote
  // Dashboard.jsx/QuoteForm.jsx are ACTUALLY editing right now always wins
  // as the chat's current quote object - a stale chat-side selection from
  // before the user opened this editor (or from editing a different quote
  // earlier in the same session) may never override it. Deliberately only
  // ever SETS selectedQuoteId while a real activeEditingQuoteId is present;
  // it never clears it on its own when the editor closes (that already
  // happens naturally via this widget's own other reset boundaries - New
  // Chat, screen/identity change), so a manual pick made outside of editing
  // is never touched by this effect.
  useEffect(() => {
    if (!isDashboard || !activeEditingQuoteId) return;
    if (activeEditingQuoteId === selectedQuoteId) return;
    setSelectedQuoteId(activeEditingQuoteId);
    setSelectedQuoteSummary((prev) => (prev?.id === activeEditingQuoteId ? prev : null));
  }, [isDashboard, activeEditingQuoteId, selectedQuoteId]);

  // Context-Driven AI Chat closure task, §5: the welcome bubble seeded above
  // is only as fresh as whatever screen/workflow was current at mount/reset
  // time - by the time the user actually opens the panel they may well be on
  // a different screen (or mid-quote-editor) than they were then. Re-derives
  // it the moment the panel opens, but only while the conversation is still
  // untouched (exactly the original single assistant bubble, no user reply
  // yet) - never rewrites a greeting the user has already started replying
  // to. Returning `prev` unchanged when the text already matches keeps this
  // a no-op re-render, so it's safe to depend on workflowContext even though
  // Dashboard.jsx passes a new object reference on every render.
  useEffect(() => {
    if (!isDashboard || !isOpen) return;
    setMessages(prev => {
      if (prev.length !== 1 || prev[0].role !== 'assistant') return prev;
      const greeting = computeDashboardWelcome(isHebrew, currentArea, workflowContext);
      if (greeting === prev[0].content) return prev;
      return [{ ...prev[0], content: greeting }];
    });
  }, [isOpen, isDashboard, isHebrew, currentArea, workflowContext]);

  // Guided Interactive Entry (Consolidated Gate 1, §4). Metadata only - it
  // is sent with the next request as a soft hint (see handleSend) and is
  // NEVER written into the existing `messages` transcript and NEVER treated
  // as the support classification (§5: guidedIntent !== category). Cleared
  // on every reset boundary alongside `messages` (see the effect above);
  // otherwise persists across close/reopen so reopening never re-forces
  // onboarding once the user has engaged with it.
  const [guidedIntent, setGuidedIntent] = useState(null);
  const [guidedSubtopic, setGuidedSubtopic] = useState(null);
  // Hierarchical Guided AI Chat Flow (Owner correction, 2026-09-18):
  // guidedGroup tracks which TOP-LEVEL group (see GUIDED_TOPIC_GROUPS) is
  // currently expanded - null means "show the top-level group list".
  // Purely a new UI-navigation layer; guidedIntent/guidedSubtopic below are
  // unchanged in meaning and are still exactly what's sent on the next
  // request (see handleSend) - a `directIntent` group (only `quotes`) sets
  // guidedIntent immediately without ever touching guidedGroup at all.
  const [guidedGroup, setGuidedGroup] = useState(null);
  const hasSentUserMessage = messages.some((m) => m.role === 'user');

  // Context-Aware AI Chat task (root architectural defect fix): the
  // public landing surface and the authenticated Dashboard surface must
  // never share the same guided menu - a visitor with no account must
  // never be offered "My Business", billing, or workflow-dependent
  // options. Single source of truth (guidedChatIntents.js) picks the
  // right list for this render's own isDashboard prop; nothing below this
  // point may read GUIDED_TOPIC_GROUPS directly.
  //
  // Context-Driven AI Chat V3, §16 "STATIC UNIVERSAL AUTHENTICATED MENU:
  // RETIRED": on the authenticated surface, a screen with its own
  // contextual menu (chatContext.screenId, from the one canonical resolver
  // above) now shows THAT instead - the universal 5-group menu remains only
  // the fallback for a screen with no specific workflow (Dashboard
  // overview/Quote History, or any future screen not yet mapped). The
  // public surface is unaffected (it has no screens to be contextual
  // about - PUBLIC_TOPIC_GROUPS is unchanged).
  const contextualTopicGroups = isDashboard ? getContextualTopicGroups(chatContext.screenId) : null;
  const topicGroups = contextualTopicGroups || getTopicGroupsForSurface(isDashboard);

  const inputRef = useRef(null);
  // "Other" escape law: selecting Other (public or authenticated) must
  // drop straight into free-text mode - focus the input and swap the
  // generic "you can also type directly" hint for a direct, one-line
  // invitation, so the guided menu can never trap anyone.
  useEffect(() => {
    if (isOpen && guidedIntent === 'other' && !hasSentUserMessage) {
      inputRef.current?.focus();
    }
  }, [isOpen, guidedIntent, hasSentUserMessage]);

  // AI Chat History UX task: "New Chat" archives the current visible thread
  // (if it has real conversation in it) into `threads` rather than deleting
  // it, then starts a fresh visible thread with guided topics restored -
  // the smallest safe "new active thread" mechanism given this widget's own
  // existing one-thread-per-context architecture (no thread IDs, no DB
  // persistence for either surface). `threads` is in-memory only, exactly
  // matching this widget's own existing persistence tier for each surface
  // (authenticated Dashboard chat has never been DB/session-persisted at
  // all; the public surface's own sessionStorage write effect below already
  // covers the new active thread automatically, since it only ever mirrors
  // the current `messages` state). Resuming/continuing an archived thread
  // as the ACTIVE conversation remains intentionally not built (still
  // "Continue Chat: DEFERRED") - browsing it read-only now is (§27 below).
  // Context-Driven AI Chat V3, §27 "PREVIOUS CHATS": now actually rendered
  // (see the small read-only panel below) instead of only ever being
  // written and never read. Bounded to the last AI_CHAT_MAX_STORED_THREADS
  // (§20 "bounded") - the oldest archived thread is simply dropped, never
  // an unbounded in-memory list.
  const AI_CHAT_MAX_STORED_THREADS = 10;
  const [threads, setThreads] = useState([]);
  const [showPreviousChats, setShowPreviousChats] = useState(false);
  const [expandedThreadId, setExpandedThreadId] = useState(null);

  const handleNewChat = () => {
    if (hasSentUserMessage) {
      setThreads((prev) => [...prev, { id: `${Date.now()}`, messages, endedAt: new Date().toISOString() }].slice(-AI_CHAT_MAX_STORED_THREADS));
    }
    guardRef.current.reset();
    contextRevisionRef.current += 1;
    setLoading(false);
    resolveBlockers(['AI_TRANSCRIPT_LIMIT']); // a new chat is the confirmed resolution of a too-long transcript
    // Deliberately always a fresh welcome, for both surfaces - never
    // `loadPublicMessages` here, which re-reads sessionStorage and would
    // just hand back the very conversation this action is meant to start
    // fresh from (the archive above already ran before this point, but the
    // existing write-effect below still mirrors the OLD messages into
    // storage until this setMessages call itself triggers a fresh write).
    setMessages([withCreatedAt({ role: 'assistant', content: isDashboard ? computeDashboardWelcome(isHebrew, currentArea, workflowContext) : computeDefaultWelcome(isHebrew, false) })]);
    setGuidedGroup(null);
    setGuidedIntent(null);
    setGuidedSubtopic(null);
    setSelectedQuoteId(null);
    setSelectedQuoteSummary(null);
    setAvailableQuotes(null);
    setQuoteSearchTerm('');
    setShowPreviousChats(false);
    setExpandedThreadId(null);
  };

  const handleTogglePreviousChats = () => {
    setShowPreviousChats((prev) => !prev);
    setExpandedThreadId(null);
  };

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleOpenExternalChat = () => { captureReturnFocus(); setIsOpen(true); };
    // PRODUCT_TRUTH_CAPABILITY: ai_chat
    window.addEventListener('open-proflow-ai-chat', handleOpenExternalChat);
    return () => window.removeEventListener('open-proflow-ai-chat', handleOpenExternalChat);
  }, []);

  // Unified Header + Always-Available AI Chat task, §15 "OVERLAY / FOCUS
  // ARCHITECTURE": Chat is now reachable (§13) while a foreground workflow
  // with its OWN modal focus trap is open (AddItemWizard's own dialog,
  // which has its own bubble-phase onKeyDown Escape handler and its own
  // Tab trap) - replaces the prior plain Escape-only listener (AI Chat
  // Hardening overnight continuation, Track J), which used a bubble-phase
  // document listener that would fire AFTER a nested dialog's own React
  // synthetic Escape handler already ran, closing BOTH surfaces from one
  // keystroke. This single effect now owns the full open-overlay lifecycle:
  //  - Escape: registered in the CAPTURE phase (the `true` third argument)
  //    so it runs before the native keydown event ever reaches a nested
  //    workflow dialog's own bubble-phase handler; stopPropagation there
  //    means that underlying handler never sees the keystroke at all while
  //    Chat is the top surface ("Escape closes only the top surface").
  //  - Tab: cycled within the popup only (a real focus trap, matching the
  //    established pattern already used by AuthenticatedSidebarFrame.jsx/
  //    AddItemWizard.jsx elsewhere in this codebase) - Tab can never
  //    escape into the foreground workflow rendered behind Chat.
  //  - On close (any path - Escape, the visible X button, clicking a
  //    navigation suggestion): focus returns to whatever element had it
  //    before Chat opened (the button that opened it, wherever it lives -
  //    header, sidebar, or this widget's own default trigger) - "fallback
  //    focus goes to workflow title" is not needed here since the trigger
  //    element itself never disappears merely because Chat closed.
  //  - Body scroll lock: ONLY at the Mobile/Tablet-Portrait breakpoint
  //    where the popup becomes a full-screen sheet (see the <=768px
  //    .ai-chat-popup CSS below) - matching AuthenticatedSidebarFrame's own
  //    established "only lock scroll for the viewport where this overlay
  //    actually covers the page" convention exactly, so Desktop's small
  //    anchored popup never causes an unrelated page-scroll jump.
  useEffect(() => {
    if (!isOpen) return undefined;

    const isMobileWidth = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const priorOverflow = document.body.style.overflow;
    if (isMobileWidth) document.body.style.overflow = 'hidden';

    const focusableItems = () => (popupRef.current
      ? [...popupRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.getClientRects().length)
      : []);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableItems();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (isMobileWidth) document.body.style.overflow = priorOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Quote-selection UX (§6.1): fetches the authenticated user's OWN quote
  // list (existing RLS on `quotes` already scopes this to the caller - the
  // same client-side query pattern already used elsewhere in the app, e.g.
  // Dashboard.jsx's own quote loading) once 'quotes' is chosen. Only
  // safe display fields are requested - no client contact info. This list
  // is used purely to render the selector; it is NEVER sent to the Edge
  // Function (only the one selectedQuoteId the user clicks is ever sent -
  // §6.2's server-side ownership re-check is what actually authorizes it).
  useEffect(() => {
    if (!isDashboard || guidedIntent !== 'quotes' || selectedQuoteId || availableQuotes !== null) return;
    let cancelled = false;
    supabase
      .from('quotes')
      .select('id, quote_number, status, created_at, project_name')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return;
        setAvailableQuotes(error ? [] : (data || []));
      });
    return () => { cancelled = true; };
  }, [isDashboard, guidedIntent, selectedQuoteId, availableQuotes]);

  // AI Chat History UX task: recomputed each render - `messages` is bounded
  // (40 for the public surface; the authenticated surface has no hard cap
  // but is a single user's own in-memory session) so this is cheap, and it
  // must stay in sync with whatever `messages` currently is, including
  // right after handleNewChat resets it.
  const daySeparatorFlags = computeDaySeparatorFlags(messages);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Hierarchical Guided AI Chat Flow, "GUIDED BUTTON DENSITY: COMPACT"
  // requirement: label-only button style, now used only by the pre-
  // existing quotes second-step options (general/specific quote) below,
  // which keep a real in-place toggle (aria-pressed) since that screen
  // doesn't navigate away when one is picked. minHeight stays 44px - an
  // accessibility touch-target floor, never shrunk.
  const guidedButtonStyle = (selected) => ({
    minHeight: '44px',
    padding: '6px 11px',
    borderRadius: '10px',
    border: selected ? 'none' : `1px solid ${NEON.borderStrong}`,
    background: selected ? NEON.gradient : NEON.bgCard,
    color: selected ? 'white' : NEON.textPrimary,
    fontSize: '0.78rem',
    cursor: 'pointer',
    textAlign: isHebrew ? 'right' : 'left',
    lineHeight: '1.3',
  });

  // Dynamic Compact Guided Buttons task (Owner correction, 2026-09-18,
  // supersedes the immediately-prior Descriptive Guided AI Cards task's own
  // full-width title+paragraph card look - explicitly rejected as reading
  // like a settings/form list, not a conversational assistant). Back to
  // real buttons: icon + short title only, sized to content (not
  // width:100%) inside a responsive grid (see guidedGridStyle below) so
  // 2 columns happen naturally wherever the popup is wide enough, instead
  // of every option stacking as its own full-width row. minHeight stays
  // the 44px accessibility floor. className "ai-guided-card" reuses the
  // exact same :hover/:focus-visible rules already defined in the <style>
  // block above - unchanged, still needed, not redefined here.
  const guidedGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' };
  const guidedCompactButtonStyle = () => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '44px',
    padding: '8px 12px',
    borderRadius: '10px',
    border: `1px solid ${NEON.borderStrong}`,
    background: NEON.bgCard,
    color: NEON.textPrimary,
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    textAlign: isHebrew ? 'right' : 'left',
    lineHeight: '1.2',
  });

  // "SELECTED CONTEXT: SMALL CHIP" requirement: a compact pill (rounded-
  // full, subtle tinted background) replaces the old plain-text breadcrumb/
  // header row - reused identically for both Level 2 (group chosen) and
  // Level 3 (leaf chosen), so the same chip visual language carries through
  // the whole guided flow, not just one level of it.
  const guidedChipStyle = { display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', background: `${NEON.violet}26`, border: `1px solid ${NEON.violetLight}55`, color: NEON.textPrimary, fontSize: '0.76rem', fontWeight: 600 };
  const guidedBackButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px', background: 'none', border: 'none', color: NEON.textSecondary, cursor: 'pointer', padding: 0, flexShrink: 0 };

  // "EXPLANATION DENSITY: LIGHTWEIGHT" requirement: no permanent
  // description text inside any button - a native `title` attribute gives
  // Desktop a real hover tooltip for free (zero extra markup/JS, ignored
  // harmlessly on touch devices), and the pre-existing single-line greeting
  // above the top-level group (computeGuidedGreeting, unchanged) already
  // serves as Mobile/Tablet's own "small contextual helper line above the
  // button group" - not repeated per-button.
  const groupIconFor = (groupId) => GUIDED_GROUP_ICONS[groupId] || null;

  // Resets only the leaf-selection layer, keeping guidedGroup intact so a
  // multi-child group's own subtopic list re-appears (quotes has no
  // guidedGroup to begin with, so this correctly falls all the way back to
  // the top-level list for it). Also clears every quotes-specific piece of
  // sub-state so re-picking a different topic never leaves stale quote-
  // selector state behind.
  const handleChangeGuidedTopic = () => {
    setGuidedIntent(null);
    setGuidedSubtopic(null);
    setSelectedQuoteId(null);
    setSelectedQuoteSummary(null);
    setAvailableQuotes(null);
    setQuoteSearchTerm('');
  };

  // Public surface only: authenticated Dashboard chat is intentionally
  // in-memory only and never written to sessionStorage (AI Chat Phase 1,
  // §5) - persisting it would require a full per-user/tenant partitioning
  // scheme that is explicitly out of scope for this phase.
  useEffect(() => {
    if (isDashboard) return;
    const storageKey = buildPublicChatStorageKey({ isHebrew });
    writeStoredPublicTranscript(storageKey, messages);
  }, [messages, isDashboard, isHebrew]);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // Hierarchical Guided AI Chat Flow, "next step must immediately enter
  // viewport" requirement: reuses the exact same scrollToBottom/
  // scrollContainerRef pair as the messages effect immediately above - it
  // only ever scrolls this widget's own internal popup content area, never
  // the Dashboard behind it (scrollContainerRef is not attached to
  // anything outside this component's own JSX below). Fires whenever the
  // guided navigation level changes (group chosen, subtopic/leaf chosen,
  // or a Back step), so a newly-revealed set of options is always visible
  // without the user needing to manually scroll to find it.
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [isOpen, guidedGroup, guidedIntent]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');

    const newMessages = [...messages, withCreatedAt({ role: 'user', content: userMsg })];
    setMessages(newMessages);
    setLoading(true);

    // Captured before the request goes out - see applyIfCurrent below.
    const requestToken = guardRef.current.current();
    const applyIfCurrent = (updater) => {
      if (guardRef.current.isStale(requestToken)) return;
      updater();
    };
    // Context-Driven AI Chat V3, §25 "OLD MESSAGE ACTION REBIND BUG
    // CLOSED": the quote id an `open_selected_quote` suggestion in THIS
    // reply may ever open is the one that was actually selected when THIS
    // request was sent - captured now, bound onto the resulting message
    // itself below, and never re-read from live state again (see
    // handleNavigationClick, which now only ever reads a message's own
    // bound value, never the current selectedQuoteId).
    const requestSelectedQuoteId = selectedQuoteId;

    try {
      // Only role/content ever leave this widget for the transcript itself
      // - any local-only note messages (e.g. "selected quote unavailable")
      // are never sent back as fake conversation history.
      const fullTranscript = newMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));
      // AI HELP V4 (AI-HELP-AVAILABILITY-001): a long chat never makes help unavailable - the oldest turns stop being sent
      // (same shared limits the server enforces) and the user is told once.
      const bounded = boundTranscript(fullTranscript);
      const apiMessages = bounded.messages;
      if (bounded.trimmed && isDashboard) {
        publishBlocker('AI_TRANSCRIPT_LIMIT', { scope: 'session' });
      }
      // AI HELP V4 context: bounded structured UI facts + typed blocker codes only (never DOM text, never PII, never raw errors).
      // The server re-derives identity/tenant/market/entitlement and reconciles every blocker against its own facts.
      const activeHelpBlockers = isDashboard ? getActiveBlockers() : [];
      // the assistant itself is the screen when its OWN problem is the most recent blocker (an older blocker elsewhere is still sent)
      const newestBlocker = activeHelpBlockers.reduce((a, b) => (!a || (b.occurredAt || 0) >= (a.occurredAt || 0) ? b : a), null);
      const aiOwnBlocker = newestBlocker?.code === 'AI_PROVIDER_FAILED' || newestBlocker?.code === 'AI_TRANSCRIPT_LIMIT';
      const helpContext = isDashboard && helpSources
        ? buildAiHelpContext({ ...helpSources, chat: { transcriptLength: fullTranscript.reduce((n, m) => n + m.content.length, 0), transcriptMessages: fullTranscript.length } },
          { blockers: activeHelpBlockers, revision: contextRevisionRef.current, forceScreen: aiOwnBlocker ? 'ai_chat' : null })
        : null;

      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: {
          contractVersion: CHAT_CONTRACT_VERSION,
          messages: apiMessages,
          isHebrew: Boolean(isHebrew),
          isDashboard: Boolean(isDashboard),
          // Soft UX hint only (§5 Gate 1) - the Edge Function never treats
          // this as the support classification, and never persists it.
          guidedIntent: guidedIntent || null,
          guidedSubtopic: guidedSubtopic || null,
          // §10 Gate 2: only an allowlisted hint and a reference id - never
          // a trusted fact. The server independently re-derives/authorizes
          // both (account context from the verified user, quote content
          // only after re-checking ownership server-side).
          currentArea: isDashboard ? currentArea : null,
          selectedQuoteId: isDashboard ? selectedQuoteId : null,
          // AI Chat Hardening overnight task, Track B/C - Current-Workflow/
          // Current-Step Awareness: a small, UX-hint-only snapshot of where
          // the user is inside the quote editor (see
          // src/utils/quoteWorkflowContext.js). Same trust level as
          // currentArea/guidedIntent above - the server strictly validates
          // its shape and treats it as a soft hint, never an authoritative
          // fact (it carries no financial data, no client identity, no
          // item text - only structural/workflow-position booleans/enums).
          workflowContext: isDashboard ? (workflowContext || null) : null,
          // §18: round-tripped, not authoritative server-side - see this
          // ref's own header comment for exactly which boundaries bump it.
          contextRevision: contextRevisionRef.current,
          helpContext,
        }
      });

      if (error) throw error;
      if (!data || data.error) {
        throw new Error(data?.error?.message || 'Invalid response format from AI');
      }
      if (typeof data.answer !== 'string') {
        throw new Error('Invalid response format from AI');
      }
      // §18 "Enforce version compatibility": a mismatch is logged, not a
      // hard failure - every other cross-boundary field in this contract is
      // deliberately fail-open/additive (see validation.ts's own extensive
      // "never reject the request" precedent for every other soft hint),
      // and a v2/v3 answer shape is still fully usable either way. A future
      // genuinely BREAKING contract change would need its own explicit,
      // separate handling - this is intentionally not that.
      if (data.contractVersion !== CHAT_CONTRACT_VERSION) {
        console.warn(`AI Chat: response contractVersion ${data.contractVersion} does not match this client's ${CHAT_CONTRACT_VERSION}`);
      }

      const cleanAnswer = swapSupportEmail(data.answer, isHebrew);
      const navigationAction = data.navigation?.action || null;
      const navigationFocus = data.navigation?.focus || null;
      resolveBlockers(['AI_PROVIDER_FAILED']); // confirmed resolution: the assistant answered

      applyIfCurrent(() => {
        setMessages(prev => {
          const next = [...prev];
          // §6.1: if a quote was requested this turn but the server could
          // not authorize it (deleted, or - indistinguishably - belongs to
          // another tenant), surface a truthful, generic local note. Never
          // sent back to the model as conversation history (filtered above).
          if (data.selectedQuoteContext?.requested && !data.selectedQuoteContext?.available) {
            next.push(withCreatedAt({
              role: 'system-note',
              content: isHebrew
                ? 'ההצעה שנבחרה אינה זמינה יותר. הקשר ההצעה נוקה.'
                : 'The selected quote is no longer available. Quote context was cleared.',
            }));
          }
          if (bounded.trimmed) {
            next.push(withCreatedAt({
              role: 'system-note',
              content: isHebrew
                ? 'השיחה ארוכה - ההודעות הישנות ביותר כבר לא נשלחות לעוזר. אפשר להתחיל שיחה חדשה בכל רגע.'
                : 'This chat is long - the oldest messages are no longer sent to the assistant. You can start a new chat at any time.',
            }));
          }
          next.push(withCreatedAt({
            role: 'assistant',
            content: cleanAnswer,
            navigationAction,
            navigationFocus,
            navigationQuoteId: navigationAction === 'open_selected_quote' ? requestSelectedQuoteId : null,
          }));
          return next;
        });
        // A quote the server just said is unavailable can never still be
        // "selected" client-side - clear it so the chip/selector reflect
        // reality (this itself is a quote-context boundary, see the
        // selectedQuoteId effect above, but it will no-op here since the
        // conversation was already reset when the value changes).
        if (data.selectedQuoteContext?.requested && !data.selectedQuoteContext?.available) {
          setSelectedQuoteId(null);
          setSelectedQuoteSummary(null);
        }
      });

    } catch (err) {
      console.error("AI Chat Error:", err);
      if (isDashboard) publishBlocker('AI_PROVIDER_FAILED', { scope: 'session' });
      applyIfCurrent(() => setMessages(prev => [...prev, withCreatedAt({
        role: 'assistant',
        content: isHebrew
          ? 'מצטער, חלה שגיאה זמנית בחיבור לשרת ה-AI. אנא נסה שוב בעוד מספר שניות.'
          : 'Sorry, there was a temporary error connecting to the AI server. Please try again in a few seconds.'
      })]));
    } finally {
      applyIfCurrent(() => setLoading(false));
    }
  };

  const handleNavigationClick = (action, boundQuoteId = null, boundFocus = null) => {
    // §25: reads ONLY the quote id bound onto this exact message at the
    // moment it was created (see handleSend's requestSelectedQuoteId) -
    // never the current live selectedQuoteId, which may have since changed
    // to a different quote (or been cleared) without this older message
    // disappearing. The model never supplied this id either way (it can
    // only choose the action).
    const meta = action === 'open_selected_quote' ? { quoteId: boundQuoteId } : boundFocus ? { focus: boundFocus } : null;
    const dispatched = dispatchSafeNavigation(action, meta);
    if (!dispatched) return;
    // §8.3: "Mobile: chat may close after the user clicks navigation" /
    // "Desktop: use existing app navigation behavior" - mirrors the same
    // max-width: 768px breakpoint the rest of this component already uses
    // for mobile-only behavior (see the .ai-chat-popup media query below).
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsOpen(false);
    }
  };

  return (
    <div className={`no-print ai-chat-container${isDashboard ? ' ai-chat-dashboard' : ''}`} style={{
      position: 'fixed',
      bottom: '24px',
      left: 0,
      right: 0,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 999999
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1050px',
        padding: '0 20px',
        display: 'flex',
        justifyContent: isHebrew ? 'flex-start' : 'flex-start',
      }}>
        <div style={{
          position: 'relative',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isHebrew ? 'flex-start' : 'flex-start'
        }}>

          <style>{`
            @media (max-width: 768px) {
              /* V2 Mobile Overlap Correction (Owner real-device
                 observation, not a simulator/devtools finding): the fixed
                 85px clearance was measured against the mobile bottom nav's
                 own content height but did not account for a real phone's
                 own OS-level bottom safe-area (the iOS home-indicator
                 gesture bar, and its Android equivalent) - env(safe-area-
                 inset-bottom) is 0 in most desktop-browser device emulators
                 (which is why this could look fine in devtools testing
                 while still overlapping on the Owner's actual physical
                 device) but a real, non-zero value on real notched/gesture-
                 bar hardware. Adding it on top of the existing 85px base
                 (not replacing it) restores real clearance without
                 changing anything for devices that report 0. */
              .ai-chat-container {
                bottom: calc(85px + env(safe-area-inset-bottom, 0px)) !important;
              }
              /* Authenticated App Consolidation task, §7 (audited first, not
                 moved blindly): the closed-button footprint itself - not
                 just its offset - was the Owner's complaint ("remains
                 visually large and can obscure content"). Geometry audited
                 from source before touching anything: the button carried
                 12px/20px padding + a visible text label ("AI Chat"/"צאט
                 AI") alongside its icon, ~140-180px wide x ~44px tall,
                 positioned at the wrapper's own inline-start edge (~20px
                 from the physical screen edge on a narrow viewport, since
                 the 1050px maxWidth wrapper collapses to the viewport width
                 there) - not overlapping the bottom nav (85px clearance,
                 the bottom nav's own height is well under that), but still
                 a real, wide pill competing for space above it. Hides the
                 text label on mobile only (desktop keeps the full pill -
                 no complaint there, no reason to touch it) and shrinks to a
                 fixed 48x48 circular tap target - still clearly a chat
                 button (chat-bubble icon, brand gradient, shadow), no
                 functionality removed, same onClick/aria.
                 Release Candidate Blocker Fixes task (Blocker 3): scoped to
                 .ai-chat-dashboard only (set via the existing isDashboard
                 prop) - this fix was authorized specifically for the
                 authenticated Dashboard's mobile bottom-nav overlap
                 complaint, not for the public landing pages, whose
                 already-approved mobile pill-with-text appearance must not
                 change as an unreviewed side effect of an unrelated
                 authenticated-app fix. */
              .ai-chat-dashboard .ai-support-btn {
                padding: 0 !important;
                width: 48px !important;
                height: 48px !important;
                border-radius: 50% !important;
                justify-content: center !important;
              }
              .ai-chat-dashboard .ai-btn-text {
                display: none !important;
              }
              .ai-chat-popup {
                position: fixed !important;
                top: 0 !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100% !important;
                height: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                margin: 0 !important;
                border-radius: 0 !important;
                box-sizing: border-box !important;
                z-index: 999999 !important;
                transform: none !important;
              }
            }

            /* Descriptive Guided AI Cards task: real :hover/:focus-visible
               support for the guided topic/subtopic cards below - this
               file otherwise styles everything inline (no pseudo-class
               support there), so these two rules live here instead,
               exactly like the pre-existing @media rules above them in
               this same <style> block. Scoped to .ai-guided-card only,
               a class unique to this task's own cards. */
            .ai-guided-card:hover {
              background: ${NEON.bgCardAlt} !important;
              border-color: ${NEON.violetLight} !important;
            }
            .ai-guided-card:focus-visible {
              outline: 2px solid ${NEON.violet};
              outline-offset: 2px;
            }
          `}</style>

          {!isOpen && (
            <button
              onClick={() => { captureReturnFocus(); setIsOpen(true); }}
              className="ai-support-btn"
              aria-label={isHebrew ? 'צאט AI' : 'AI Chat'}
              style={{
                position: 'relative',
                background: NEON.gradient,
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                boxShadow: NEON.glow,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {/* authenticated app (dashboard, region choice): the ONE canonical AI Chat icon (§51.15); public pages keep their approved landing mark */}
              {isDashboard ? <AiChatIcon size={20} rtl={isHebrew} /> : <MessageCircleMore size={20} strokeWidth={2.2} />}
              <span className="ai-btn-text" style={{ whiteSpace: 'nowrap' }}>{isHebrew ? 'צאט AI' : 'AI Chat'}</span>
              {/* Final Landing Polish task, Part B - "MessageCircleMore or
                  MessagesSquare with a small Sparkles accent - not
                  Bot/robot": restrained AI accent badge, decorative only.
                  Root-cause fix: an earlier negative-offset placement (-3px)
                  intentionally bled past the button's own edge as a
                  notification-badge convention, but that made the button's
                  own scrollWidth exceed its clientWidth (found via the
                  required overflow sweep) - kept fully inside the border
                  box instead, since nothing here required it to overhang. */}
              {!isDashboard && <Sparkles
                aria-hidden="true"
                size={11}
                strokeWidth={2.5}
                style={{ position: 'absolute', top: '2px', [isHebrew ? 'left' : 'right']: '2px', color: '#fde68a', background: NEON.bgElevated, borderRadius: '50%', padding: '2px', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.15)' }}
              />}
            </button>
          )}

          {isOpen && (
            <div
              className="ai-chat-popup"
              ref={popupRef}
              role="dialog"
              aria-modal="true"
              aria-label={isHebrew ? 'צ’אט AI' : 'AI Chat'}
              style={{
              position: 'absolute',
              bottom: 'calc(100% + 15px)',
              [isHebrew ? 'right' : 'left']: '0',
              width: '360px',
              height: '520px',
              background: NEON.bgElevated,
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              border: `1px solid ${NEON.border}`,
              overflow: 'hidden',
              textAlign: isHebrew ? 'right' : 'left'
            }} dir={isHebrew ? 'rtl' : 'ltr'}>
              <div style={{
                background: NEON.gradient,
                color: 'white',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircleMore size={17} strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {isHebrew
                        ? <>שירות לקוחות <bdi dir="ltr" style={{ color: NEON.violetLighter, fontWeight: 700 }}>TEKANGO</bdi></>
                        : <><bdi dir="ltr" style={{ color: NEON.violetLighter, fontWeight: 700 }}>TEKANGO</bdi> Support</>}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                      {isHebrew ? 'זמין 24/7' : 'Available 24/7'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {/* AI Chat History UX task: starts a fresh visible thread
                      (guided topics restored) without deleting the one just
                      left - archived in-memory into `threads`, see
                      handleNewChat's own comment for why nothing is
                      deleted/persisted beyond this widget's existing
                      per-surface persistence tier. */}
                  {/* §27 "PREVIOUS CHATS: ACCESSIBLE" - toggles the small
                      read-only panel above; `aria-pressed` reflects the
                      panel's own open/closed state (a real in-place toggle,
                      not a navigate-away action). */}
                  <button
                    type="button"
                    onClick={handleTogglePreviousChats}
                    aria-label={isHebrew ? 'שיחות קודמות' : 'Previous chats'}
                    title={isHebrew ? 'שיחות קודמות' : 'Previous chats'}
                    aria-pressed={showPreviousChats}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <History size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    aria-label={isHebrew ? 'שיחה חדשה' : 'New Chat'}
                    title={isHebrew ? 'שיחה חדשה' : 'New Chat'}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <MessageSquarePlus size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label={isHebrew ? 'סגור' : 'Close'}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: NEON.bg }}
              >
                {/* Context-Driven AI Chat V3, §27 "PREVIOUS CHATS": a small,
                    bounded, READ-ONLY panel - replaces the live conversation
                    view entirely while open (never overlaid/mixed with it),
                    never restores an archived thread as the current live
                    conversation/context (§26/§27 - "no restoring old screen
                    snapshot as current truth"). */}
                {showPreviousChats ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: NEON.textPrimary }}>
                      {isHebrew ? 'שיחות קודמות' : 'Previous chats'}
                    </div>
                    {threads.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: NEON.textSecondary }}>
                        {isHebrew ? 'אין עדיין שיחות קודמות בפגישה זו.' : 'No previous chats yet in this session.'}
                      </div>
                    ) : (
                      [...threads].reverse().map((thread) => {
                        const firstUserMsg = thread.messages.find((m) => m.role === 'user');
                        const isExpanded = expandedThreadId === thread.id;
                        return (
                          <div key={thread.id} style={{ border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedThreadId(isExpanded ? null : thread.id)}
                              aria-expanded={isExpanded}
                              style={{ width: '100%', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgCard, border: 'none', padding: '8px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px' }}
                            >
                              <span style={{ fontSize: '0.72rem', color: NEON.textSecondary }}>
                                {formatDaySeparatorLabel(thread.endedAt, isHebrew) || thread.endedAt}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: NEON.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {firstUserMsg?.content || (isHebrew ? '(שיחה ללא הודעות)' : '(empty conversation)')}
                              </span>
                            </button>
                            {isExpanded && (
                              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px', background: NEON.bg }}>
                                {thread.messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m, i) => (
                                  <div key={i} style={{ fontSize: '0.76rem', color: NEON.textPrimary, textAlign: isHebrew ? 'right' : 'left' }}>
                                    <strong>{m.role === 'user' ? (isHebrew ? 'אתה: ' : 'You: ') : (isHebrew ? 'עוזר: ' : 'Assistant: ')}</strong>
                                    {m.content}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                <>
                {messages.map((msg, idx) => {
                  const showDaySeparator = daySeparatorFlags[idx];
                  const dayLabel = showDaySeparator ? formatDaySeparatorLabel(msg.createdAt, isHebrew) : null;
                  const messageTime = formatMessageTime(msg.createdAt, isHebrew);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Day separator (AI Chat History UX task): only ever
                          rendered for a message with a real, valid
                          createdAt - a legacy message with none simply never
                          triggers or receives one (see
                          computeDaySeparatorFlags's own doc comment). */}
                      {dayLabel && (
                        <div style={{ alignSelf: 'center', fontSize: '0.68rem', color: NEON.textSecondary, opacity: 0.8, padding: '2px 10px', borderRadius: '10px', background: NEON.bgCard }}>
                          {dayLabel}
                        </div>
                      )}
                      {msg.role === 'system-note' ? (
                        // §6.1: a truthful, local-only note (e.g. "selected
                        // quote no longer available") - visually distinct from
                        // a real assistant reply, never sent to the model (see
                        // handleSend's apiMessages filter).
                        <div style={{ alignSelf: 'center', fontSize: '0.72rem', color: NEON.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: '2px 8px' }}>
                          {msg.content}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: msg.role === 'user' ? (isHebrew ? 'flex-start' : 'flex-end') : (isHebrew ? 'flex-end' : 'flex-start'), maxWidth: '85%' }}>
                          <div style={{
                            background: msg.role === 'user' ? NEON.gradient : NEON.bgCard,
                            color: msg.role === 'user' ? 'white' : NEON.textPrimary,
                            padding: '10px 14px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            border: msg.role === 'assistant' ? `1px solid ${NEON.border}` : 'none',
                            lineHeight: '1.4',
                            textAlign: isHebrew ? 'right' : 'left'
                          }}>
                            {msg.content}
                          </div>
                          {/* Per-message time (AI Chat History UX task): a
                              small, quiet timestamp - never rendered for a
                              message with no real createdAt (never a
                              fabricated time for legacy history). */}
                          {messageTime && (
                            <div style={{
                              fontSize: '0.65rem',
                              color: NEON.textSecondary,
                              opacity: 0.75,
                              alignSelf: msg.role === 'user' ? (isHebrew ? 'flex-start' : 'flex-end') : (isHebrew ? 'flex-end' : 'flex-start'),
                              padding: '0 2px',
                            }}>
                              {messageTime}
                            </div>
                          )}
                          {/* Safe navigation (§8): a real, product-labeled
                              button the user must click themselves - the model
                              only ever chose WHICH of the 7 allowlisted
                              destinations to suggest (validated server-side in
                              navigation.ts), never the label or a URL. */}
                          {msg.role === 'assistant' && msg.navigationAction && (
                            <button
                              type="button"
                              onClick={() => handleNavigationClick(msg.navigationAction, msg.navigationQuoteId ?? null, msg.navigationFocus ?? null)}
                              style={{
                                minHeight: '38px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${NEON.borderStrong}`,
                                background: 'transparent',
                                color: NEON.violetLighter,
                                fontSize: '0.78rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                alignSelf: isHebrew ? 'flex-end' : 'flex-start',
                              }}
                            >
                              {getNavigationLabel(msg.navigationAction, isHebrew)}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Dynamic Compact Guided Buttons task (Owner correction,
                    2026-09-18, supersedes the immediately-prior Descriptive
                    Guided AI Cards task's own full-width title+paragraph
                    look - explicitly rejected as reading like a settings/
                    form list rather than a conversational assistant). The
                    underlying TOPIC -> SUBTOPIC -> next-relevant-step state
                    machine (guidedGroup/guidedIntent/guidedSubtopic) is
                    completely unchanged from the Hierarchical Guided AI
                    Chat Flow task - only the visual presentation of each
                    level changed: compact icon+title buttons in a
                    responsive 2-column-where-it-fits grid (guidedGridStyle)
                    instead of full-width description cards, and a small
                    pill-shaped "chip" (guidedChipStyle) instead of a plain
                    text header/breadcrumb for the selected-context row.
                    Exactly one level renders at a time - unselected options
                    are HIDDEN, not stacked. Free-text hint always shown.
                    No aria-pressed on group/subtopic buttons (same
                    navigate-away reasoning as before - not an in-place
                    toggle); the pre-existing quotes second-step buttons
                    below keep their own aria-pressed unchanged. */}
                {!hasSentUserMessage && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
                    {/* Level 1: top-level groups (5 total, GUIDED_TOPIC_GROUPS)
                        as compact icon+title buttons. The pre-existing
                        greeting line above them doubles as this level's own
                        lightweight "explanation" (§11) - no per-button
                        description text. Shown only when neither a group
                        nor a leaf intent has been picked yet. */}
                    {!guidedGroup && !guidedIntent && (
                      <>
                        <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, textAlign: isHebrew ? 'right' : 'left' }}>
                          {computeGuidedGreeting(isHebrew, isDashboard ? businessDisplayName : null)}
                        </div>
                        <div style={guidedGridStyle}>
                          {topicGroups.map((group) => {
                            const Icon = groupIconFor(group.id);
                            return (
                              <button
                                key={group.id}
                                type="button"
                                className="ai-guided-card"
                                onClick={() => {
                                  if (group.directIntent) {
                                    setGuidedIntent(group.directIntent);
                                    setGuidedSubtopic(null);
                                  } else {
                                    setGuidedGroup(group.id);
                                  }
                                }}
                                style={guidedCompactButtonStyle()}
                                title={isHebrew ? group.heDesc : group.enDesc}
                              >
                                {Icon && <Icon size={16} strokeWidth={2.2} style={{ flexShrink: 0, color: NEON.violetLight }} />}
                                <span>{isHebrew ? group.he : group.en}</span>
                              </button>
                            );
                          })}
                          {/* Other-option coverage law: authenticated Level 1
                              always gets its own explicit escape tile - the
                              public list already has "Something else" as one
                              of its flat top-level entries (this level IS its
                              only level), so no duplicate tile is added there. */}
                          {isDashboard && (
                            <button
                              type="button"
                              className="ai-guided-card"
                              onClick={() => { setGuidedIntent('other'); setGuidedSubtopic(null); }}
                              style={guidedCompactButtonStyle()}
                              title={getGuidedIntentDescription('other', isHebrew)}
                            >
                              <span>{getGuidedIntentLabel('other', isHebrew)}</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* Level 2: the expanded group's own subtopics only -
                        every other group is hidden, not just visually
                        de-emphasized. Only reachable for multi-child groups
                        (quotes' directIntent skips straight to Level 3).
                        "SELECTED CONTEXT: SMALL CHIP" (§9): Back + a pill
                        chip carrying the parent's own title (icon included)
                        replaces the plain text header this task's own prior
                        version used. Never re-renders the full top-level
                        button grid. */}
                    {guidedGroup && !guidedIntent && (() => {
                      const group = topicGroups.find((g) => g.id === guidedGroup);
                      if (!group) return null;
                      const Icon = groupIconFor(group.id);
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                            <button
                              type="button"
                              onClick={() => setGuidedGroup(null)}
                              aria-label={isHebrew ? 'חזרה' : 'Back'}
                              style={guidedBackButtonStyle}
                            >
                              {isHebrew ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                            </button>
                            <span style={guidedChipStyle}>
                              {Icon && <Icon size={13} strokeWidth={2.2} />}
                              {isHebrew ? group.he : group.en}
                            </span>
                          </div>
                          <div style={guidedGridStyle}>
                            {group.children.map((intentId) => (
                              <button
                                key={intentId}
                                type="button"
                                className="ai-guided-card"
                                onClick={() => { setGuidedIntent(intentId); setGuidedSubtopic(null); }}
                                style={guidedCompactButtonStyle()}
                                title={getGuidedIntentDescription(intentId, isHebrew)}
                              >
                                <span>{getGuidedIntentLabel(intentId, isHebrew)}</span>
                              </button>
                            ))}
                            {/* Other-option coverage law: every guided level,
                                not only the top one, gets its own escape
                                tile - drilling into a group must never be a
                                one-way street with no way out but Back.
                                Skipped only when this group's own children
                                already include 'other' (feedback_questions),
                                so the same escape never renders twice. */}
                            {!group.children.includes('other') && (
                              <button
                                type="button"
                                className="ai-guided-card"
                                onClick={() => { setGuidedIntent('other'); setGuidedSubtopic(null); }}
                                style={guidedCompactButtonStyle()}
                                title={getGuidedIntentDescription('other', isHebrew)}
                              >
                                <span>{getGuidedIntentLabel('other', isHebrew)}</span>
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Level 3: a leaf intent is chosen - a small chip
                        (same visual language as Level 2's own, §9) replaces
                        the plain-text breadcrumb this task's own prior
                        version used. Quotes' own pre-existing second step/
                        quote-selector (below) renders alongside this
                        unchanged. */}
                    {guidedIntent && (() => {
                      const parentGroup = getGuidedGroupForIntent(guidedIntent, topicGroups);
                      const leafLabel = getGuidedIntentLabel(guidedIntent, isHebrew);
                      const chipText = parentGroup && !parentGroup.directIntent
                        ? `${isHebrew ? parentGroup.he : parentGroup.en} → ${leafLabel}`
                        : leafLabel;
                      const Icon = parentGroup ? groupIconFor(parentGroup.id) : null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                          <button
                            type="button"
                            onClick={handleChangeGuidedTopic}
                            aria-label={isHebrew ? 'חזרה' : 'Back'}
                            style={guidedBackButtonStyle}
                          >
                            {isHebrew ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                          </button>
                          <span style={guidedChipStyle}>
                            {Icon && <Icon size={13} strokeWidth={2.2} />}
                            {chipText}
                          </span>
                        </div>
                      );
                    })()}

                    <div style={{ fontSize: '0.72rem', color: NEON.textSecondary, opacity: 0.85, textAlign: isHebrew ? 'right' : 'left' }}>
                      {guidedIntent === 'other'
                        ? (isHebrew ? 'בשמחה, כתוב לי מה תרצה לשאול.' : "Sure — tell me what you'd like to ask.")
                        : (isHebrew ? 'אפשר גם לכתוב כאן ישירות' : 'You can also type directly')}
                    </div>
                  </div>
                )}

                {/* Guided Interactive Entry, optional step 2 (§4.3): at most
                    one follow-up, skippable by typing directly. Only
                    `quotes` currently has one (see guidedChatIntents.js) -
                    it drives the explicit quote-selector step below, not
                    mere sub-categorization. */}
                {/* Second step (currently only quotes' general/specific
                    choice) is authenticated-only: "a specific quote"
                    presupposes an account with real quotes to pick from,
                    which a public visitor never has (see the isDashboard
                    guard on the quote-selector block right below this one
                    too). Public 'quotes' selection goes straight to free-
                    text product Q&A about the Smart Quotes feature. */}
                {isDashboard && !hasSentUserMessage && guidedIntent && GUIDED_SECOND_STEPS[guidedIntent] && !guidedSubtopic && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
                    <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, textAlign: isHebrew ? 'right' : 'left' }}>
                      {isHebrew ? GUIDED_SECOND_STEPS[guidedIntent].question.he : GUIDED_SECOND_STEPS[guidedIntent].question.en}
                    </div>
                    {GUIDED_SECOND_STEPS[guidedIntent].options.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {GUIDED_SECOND_STEPS[guidedIntent].options.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setGuidedSubtopic(opt.id)}
                            aria-pressed={guidedSubtopic === opt.id}
                            style={guidedButtonStyle(guidedSubtopic === opt.id)}
                          >
                            {isHebrew ? opt.he : opt.en}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Explicit quote selection (§6.1) - authenticated
                    'quotes' only, offered before any message is sent
                    (typing directly skips it, same pattern as guided step
                    2). Shows only safe display fields (quote number,
                    status, date, project name if present) - never client
                    contact info. The full list is a client-side RLS-scoped
                    read for UI purposes only; it is never sent to the Edge
                    Function - only the one clicked id is (§6.2 re-verifies
                    ownership server-side before using it for anything). */}
                {isDashboard && guidedIntent === 'quotes' && !selectedQuoteId && !hasSentUserMessage && allowsExistingQuoteReference(chatContext.screenId) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
                    <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, textAlign: isHebrew ? 'right' : 'left' }}>
                      {isHebrew ? 'בחר הצעת מחיר לשיחה זו (אופציונלי):' : 'Select a quote for this conversation (optional):'}
                    </div>
                    {availableQuotes === null ? (
                      <div style={{ fontSize: '0.75rem', color: NEON.textSecondary }}>{isHebrew ? 'טוען...' : 'Loading...'}</div>
                    ) : availableQuotes.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: NEON.textSecondary }}>{isHebrew ? 'לא נמצאו הצעות מחיר.' : 'No quotes found.'}</div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={quoteSearchTerm}
                          onChange={(e) => setQuoteSearchTerm(e.target.value)}
                          placeholder={isHebrew ? 'חיפוש לפי מספר או פרויקט...' : 'Search by number or project...'}
                          style={{ padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.8rem', outline: 'none', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                          {availableQuotes
                            .filter((q) => {
                              const term = quoteSearchTerm.trim().toLowerCase();
                              if (!term) return true;
                              return String(q.quote_number ?? '').toLowerCase().includes(term) || (q.project_name || '').toLowerCase().includes(term);
                            })
                            .slice(0, 30)
                            .map((q) => (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => {
                                  setSelectedQuoteId(q.id);
                                  setSelectedQuoteSummary(q);
                                }}
                                style={{
                                  minHeight: '38px',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: `1px solid ${NEON.borderStrong}`,
                                  background: NEON.bgCard,
                                  color: NEON.textPrimary,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  textAlign: isHebrew ? 'right' : 'left',
                                }}
                              >
                                {`#${q.quote_number ?? '?'} · ${q.status || ''}${q.project_name ? ' · ' + q.project_name : ''}`}
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {loading && (
                  <div style={{ alignSelf: isHebrew ? 'flex-end' : 'flex-start', background: NEON.bgCard, padding: '8px 12px', borderRadius: '12px', fontSize: '0.8rem', color: NEON.textSecondary, border: `1px solid ${NEON.border}` }}>
                    {isHebrew ? 'מקליד תשובה...' : 'Typing...'}
                  </div>
                )}
                </>
                )}
              </div>

              {/* Selected-quote context chip (§6.1): removable, obvious
                  which quote is active. Clearing it (or the selector above
                  picking a different one) is its own reset boundary - see
                  the selectedQuoteId effect - so context never mixes. */}
              {isDashboard && selectedQuoteId && (
                <div style={{ padding: '0 10px', display: 'flex', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: NEON.bgCard, border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', padding: '4px 8px', fontSize: '0.75rem', color: NEON.textPrimary, marginBottom: '8px' }}>
                    <span>{(() => { const n = selectedQuoteSummary?.quote_number != null ? `#${selectedQuoteSummary.quote_number}` : formatQuoteFallback({ id: selectedQuoteId }); return isHebrew ? `הצעה: ${n}` : `Quote: ${n}`; })()}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedQuoteId(null); setSelectedQuoteSummary(null); }}
                      aria-label={isHebrew ? 'הסר הצעה נבחרת' : 'Remove selected quote'}
                      style={{ background: 'none', border: 'none', color: NEON.textSecondary, cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSend} style={{ padding: '10px', background: NEON.bgElevated, borderTop: `1px solid ${NEON.border}`, display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isHebrew ? 'שאל משהו...' : 'Ask something...'}
                  style={{ flex: 1, padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '0.85rem', outline: 'none', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary }}
                />
                <button
                  type="submit"
                  aria-label={isHebrew ? 'שלח' : 'Send'}
                  style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: NEON.glowSoft }}
                >
                  <Send size={15} strokeWidth={2.5} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
