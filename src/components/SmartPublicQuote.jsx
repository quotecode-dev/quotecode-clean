import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';
import { fetchPublicPresentation } from '../utils/quotePresentationClient';
import { scheduleFirstViewRecord } from '../utils/firstView';
import { isUnfinishedSavedQuote } from '../utils/quoteCompleteness';

// Task 16 - Quote Experience V2: the presentation (style / frozen branding / media, CONTRACT §3 public_get) is
// requested IN PARALLEL with get-public-quote and is strictly optional: any failure, timeout or malformed payload
// renders the legacy Classic composition - the quote itself is never blocked or delayed beyond PRESENTATION_WAIT_MS.

function isUsablePresentation(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && typeof value.mode === 'string';
}

async function loadPresentation(quoteId, capabilityToken = null) {
  try {
    const res = await fetchPublicPresentation(quoteId, capabilityToken);
    return res && res.ok && isUsablePresentation(res.data) ? res.data : null;
  } catch {
    return null;
  }
}

// OD-02 capability URLs: /public-quote/c/:token and /en/public-quote/c/:token carry an unguessable, artifact-scoped,
// revocable token (only its hash is stored). The legacy /public-quote/:id route keeps working for existing links; when the
// server enforces output it serves an id only to the owner or to a quote issued before the cutover.
const CAPABILITY_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export default function SmartPublicQuote() {
  const { id: routeId, token } = useParams();
  const capabilityToken = token && CAPABILITY_TOKEN_RE.test(token) ? token : null;
  // the request key: the token on the capability route, the quote id on the legacy route; a malformed token is not found
  const id = token ? (capabilityToken ? `c:${capabilityToken}` : null) : routeId;
  const [state, setState] = useState({ status: 'loading', dto: null });
  const [retryKey, setRetryKey] = useState(0); // R-19: "Try again" re-runs the load
  const [presentation, setPresentation] = useState(null);
  // Task 27: the owner's thank-you arrives from the server only for a signed quote - re-read once right after a successful signature
  const [thanks, setThanks] = useState(null);
  const processedIdRef = useRef(null);

  // Task 20: the first view of THIS quote link (an indication, not a certain customer identification), recorded by the server only after
  // the page was really visible (see
  // utils/firstView.js). Never for the owner view; the server re-checks owner / bot and writes once. Failure is silent (no UI effect).
  const viewedQuoteId = state.status === 'ready' && !state.dto?.quote?.is_owner_viewing ? state.dto?.quote?.id : null;
  useEffect(() => {
    if (!viewedQuoteId) return undefined;
    return scheduleFirstViewRecord({ record: () => supabase.rpc('public_record_quote_first_view', { p_quote_id: viewedQuoteId }).then(() => {}, () => {}) });
  }, [viewedQuoteId]);

  useEffect(() => {
    if (!id) {
      setState({ status: 'notfound', dto: null });
      return;
    }

    // מונע קריאה כפולה כתוצאה מ-double-invoke של useEffect ב-React 18
    // StrictMode (dev בלבד) - ה-ref שורד בין ה-mount/cleanup/remount הכפול,
    // בניגוד ל-state, ולכן מבטיח בקשת רשת אחת בפועל לכל id נתון, אך עדיין
    // מאפשר fetch חדש אם המשתמש עובר בפועל להצעה אחרת (id שונה) באותה sesion.
    if (processedIdRef.current === id) return;
    processedIdRef.current = id;

    (async () => {
      setPresentation(null);
      const presentationPromise = loadPresentation(capabilityToken ? null : id, capabilityToken);
      // A late presentation still applies (it is the correct one); it just never holds the quote back.
      presentationPromise.then((p) => {
        if (processedIdRef.current === id && p) setPresentation(p);
      });

      const { data, error } = await supabase.functions.invoke('get-public-quote', {
        body: capabilityToken ? { capability_token: capabilityToken } : { quote_id: id },
      });

      // Stale-response guard: apply this result only if `id` is still the
      // most-recently-requested id. Unlike a per-effect `cancelled` closure,
      // this is never flipped by React 18 StrictMode's dev-only synthetic
      // cleanup (which never touches processedIdRef) - only a genuine
      // navigation to a different quote id changes it.
      if (processedIdRef.current !== id) return;

      if (error) {
        const status = error?.context?.status;
        // R-19 (night task 2026-10-16): only a 404 is "not found"; a server / network failure is temporary and says so
        setState({ status: status === 404 ? 'notfound' : 'unavailable', dto: null });
        return;
      }

      if (!data || !data.quote) {
        setState({ status: 'error', dto: null });
        return;
      }

      // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי") #23: the quote shows at once again (the style still applies the moment it arrives - setPresentation above)
      if (processedIdRef.current !== id) return;
      setState({ status: 'ready', dto: data });

      // Fire-and-forget: ה-RPC עצמו כבר לא סופר צפיות של הבעלים
      // (auth.uid() = quotes.user_id) - נבדק ואומת ב-Phase 2. אין צורך
      // לשכפל את אותה בדיקה כאן.
      supabase.rpc('public_increment_quote_view', { p_quote_id: data.quote.id }).then(
        () => {},
        () => {}
      );
    })();
  }, [id, capabilityToken, retryKey]);

  // Owner console 2026-11-08 ("כל עוד הלקוח לא חתם!!! כל שינוי ולא משנה איזה שהמשתמש עשה משתקף אצל הלקוח"; migration 20261108400000):
  // while the page is open and the quote is not signed, it asks the server for the current version only (every 15 seconds while visible,
  // and when the customer returns to the tab) - no content, no view counted. When the business saved a change, the updated quote replaces
  // the page at once and the customer is told to review it again (a signature drawn on the earlier version is cleared). A link that no
  // longer opens (another customer now / deleted) shows the not-found page.
  const [updatedTick, setUpdatedTick] = useState(0);
  const [signedHere, setSignedHere] = useState(false);
  const requestBody = useCallback((extra = {}) => (capabilityToken ? { capability_token: capabilityToken, ...extra } : { quote_id: id, ...extra }), [capabilityToken, id]);
  const reloadQuote = useCallback(async ({ notice }) => {
    const key = id;
    const { data, error } = await supabase.functions.invoke('get-public-quote', { body: requestBody() });
    if (processedIdRef.current !== key) return;
    if (error) { if (error?.context?.status === 404) setState({ status: 'notfound', dto: null }); return; }
    if (!data || !data.quote) return;
    setState({ status: 'ready', dto: data });
    if (data.thanks) setThanks(data.thanks);
    if (notice) setUpdatedTick((n) => n + 1);
    loadPresentation(capabilityToken ? null : key, capabilityToken).then((p) => { if (processedIdRef.current === key && p) setPresentation(p); });
  }, [id, capabilityToken, requestBody]);
  // not for a signed / expired quote (nothing can be signed there any more)
  const liveVersion = state.status === 'ready' && !signedHere && typeof state.dto?.version === 'string' && !state.dto?.output_channel
    && !state.dto?.quote?.signature && state.dto?.quote?.is_expired !== true ? state.dto.version : null;
  useEffect(() => {
    if (!liveVersion) return undefined;
    let stopped = false;
    let busy = false;
    let lastAt = 0;
    const check = async () => {
      if (stopped || busy || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
      if (Date.now() - lastAt < 4000) return; // returning to the tab several times in a row asks once
      lastAt = Date.now();
      busy = true;
      try {
        const { data, error } = await supabase.functions.invoke('get-public-quote', { body: requestBody({ version_only: true }) });
        if (stopped) return;
        if (error) { if (error?.context?.status === 404) setState({ status: 'notfound', dto: null }); return; }
        if (data && typeof data.version === 'string' && data.version !== liveVersion) await reloadQuote({ notice: true });
        else if (data && data.signed === true) await reloadQuote({ notice: false });
      } catch { /* a failed check changes nothing; the next one tries again */ } finally { busy = false; }
    };
    const timer = setInterval(check, 15000);
    const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [liveVersion, requestBody, reloadQuote]);

  // After a successful approval the server freezes the issued snapshot (the quote is now locked) - re-read it so the
  // page shows exactly what was frozen. A failure keeps whatever is already shown.
  const handleApproved = useCallback(() => {
    setSignedHere(true);
    const key = id;
    loadPresentation(capabilityToken ? null : key, capabilityToken).then((p) => {
      if (processedIdRef.current === key && p) setPresentation(p);
    });
    supabase.functions.invoke('get-public-quote', { body: capabilityToken ? { capability_token: capabilityToken } : { quote_id: key } }).then(
      ({ data }) => { if (processedIdRef.current === key && data?.thanks) setThanks(data.thanks); },
      () => {},
    );
  }, [id, capabilityToken]);

  if (state.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (state.status === 'unavailable') {
    const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
    return (
      <div data-testid="public-quote-unavailable" dir={en ? 'ltr' : 'rtl'} lang={en ? 'en' : 'he'} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', boxSizing: 'border-box', background: '#f7f8f6', color: '#10252b', fontFamily: 'Rubik, Segoe UI, Arial, Tahoma, sans-serif', textAlign: 'center', padding: '24px', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#10252b' }}>{en ? 'The quote could not be loaded right now' : 'לא הצלחנו לטעון את הצעת המחיר כרגע'}</h1>
        <p style={{ margin: 0, fontSize: '1rem', color: '#3c4a52', maxWidth: '34rem', lineHeight: 1.5 }}>{en ? 'This is a temporary problem on our side. Please try again in a moment.' : 'זו תקלה זמנית אצלנו. נסו שוב בעוד רגע.'}</p>
        {/* PRODUCT_TRUTH_DECORATIVE: retries loading the public quote (no data change, no page reload) - night task R-19 */}
        <button type="button" onClick={() => { processedIdRef.current = null; setState({ status: 'loading', dto: null }); setRetryKey((n) => n + 1); }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#0f6672', color: '#ffffff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
          {en ? 'Try again' : 'לנסות שוב'}
        </button>
      </div>
    );
  }

  if (state.status !== 'ready') {
    // Owner P0 (Task 38 finding): readable contrast on every page background (the text was black on a near-black page, 1.03:1)
    // and ONE language - the page's own (main.jsx sets <html lang> from the bundle), never both at once.
    const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
    return (
      <div data-testid="public-quote-not-found" dir={en ? 'ltr' : 'rtl'} lang={en ? 'en' : 'he'} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', boxSizing: 'border-box', background: '#f7f8f6', color: '#10252b', fontFamily: 'Rubik, Segoe UI, Arial, Tahoma, sans-serif', textAlign: 'center', padding: '24px', gap: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#10252b' }}>{/* Owner console 2026-11-02 (typed: "מאשר שינוי ב-L-04: הודעת קישור שלא נפתח בלי המילה תוקף, שחרור עד הלייב"): a link that did not open never blames a validity date */}
          {en ? 'We could not open this quote' : 'לא הצלחנו לפתוח את הצעת המחיר'}</h1>
        <p style={{ margin: 0, fontSize: '1rem', color: '#3c4a52', maxWidth: '34rem', lineHeight: 1.5 }}>{en ? 'Please ask the business that sent it for an up-to-date link.' : 'אפשר לבקש מהעסק ששלח אותה קישור עדכני.'}</p>
      </div>
    );
  }

  const { quote } = state.dto;
  const isLocalQuote = Number(quote.tax_rate) > 0 || (quote.currency || '').toUpperCase() === 'ILS';
  // בעל המערכת 2026-10-18 ("איזה משתמש ירצה שהלקוח שלו יראה הצעה לא גמורה?" -> "כן"): הצעה לא גמורה (אין בה פריט עם מחיר)
  // לעולם לא מוצגת ללקוח - גם לא ריקה עם הודעה. הלקוח רואה רק הודעה שהעסק מעדכן אותה, בשפת ההצעה. בעל העסק שפותח את ההצעה
  // שלו ממשיך לראות את המסמך עם האזהרה.
  if (!quote.is_owner_viewing && state.dto.viewerIsOwner !== true && isUnfinishedSavedQuote(quote, state.dto.items)) {
    const en = !isLocalQuote;
    return (
      <div data-testid="public-quote-updating" dir={en ? 'ltr' : 'rtl'} lang={en ? 'en' : 'he'} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', boxSizing: 'border-box', background: '#f7f8f6', color: '#10252b', fontFamily: 'Rubik, Segoe UI, Arial, Tahoma, sans-serif', textAlign: 'center', padding: '24px', gap: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#10252b' }}>{en ? 'The business is updating this quote' : 'העסק מעדכן את ההצעה הזו'}</h1>
        <p style={{ margin: 0, fontSize: '1rem', color: '#3c4a52', maxWidth: '34rem', lineHeight: 1.5 }}>{en ? 'You will receive an updated link from them.' : 'תקבלו ממנו קישור מעודכן.'}</p>
      </div>
    );
  }
  // the finalized snapshot (enforced phase, owner final PDF/Print) replaces the live view before capture/print
  const handleFinalSnapshot = (dto) => setState({ status: 'ready', dto });

  return isLocalQuote
    ? <PublicQuote quoteData={state.dto} presentation={presentation} onApproved={handleApproved} onFinalSnapshot={handleFinalSnapshot} capabilityToken={capabilityToken} thanks={thanks} onQuoteChanged={() => reloadQuote({ notice: true })} updatedTick={updatedTick} />
    : <PublicQuoteEn quoteData={state.dto} presentation={presentation} onApproved={handleApproved} onFinalSnapshot={handleFinalSnapshot} capabilityToken={capabilityToken} thanks={thanks} onQuoteChanged={() => reloadQuote({ notice: true })} updatedTick={updatedTick} />;
}
