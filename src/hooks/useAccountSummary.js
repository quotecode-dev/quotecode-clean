// OD-20: one authoritative account summary per signed-in session. Loading is neutral, errors fail closed with retry.
// Nothing here derives a plan or a balance on the client; it only fetches the server summary for the current JWT.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAccountSummary, LOADING_SUMMARY } from '../domain/subscriptions/accountSummaryClient';

export default function useAccountSummary(supabase, userId) {
  const [summary, setSummary] = useState(LOADING_SUMMARY);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    if (!userId) {
      setSummary(LOADING_SUMMARY);
      return LOADING_SUMMARY;
    }
    setSummary(LOADING_SUMMARY);
    const next = await fetchAccountSummary(supabase);
    // a newer request (or a sign-out) wins; a stale answer never overwrites it
    if (mine === seq.current) setSummary(next);
    return next;
  }, [supabase, userId]);

  // Owner console 2026-10-21 (back from the payment page): the same server read WITHOUT the loading state in between, so the plan
  // badge never flashes "loading" while the plans window waits for a verified payment
  const refreshQuiet = useCallback(async () => {
    if (!userId) return null;
    const base = seq.current; // never supersedes a regular refresh: a refresh started meanwhile wins
    const next = await fetchAccountSummary(supabase);
    // a failed quiet read keeps the summary on screen (the next poll tries again)
    if (base === seq.current && next?.state === 'ready') setSummary(next);
    return next;
  }, [supabase, userId]);

  useEffect(() => {
    refresh();
    return () => { seq.current += 1; };
  }, [refresh]);

  // Codex PayPlus stage-2 audit M01 (night task 2026-10-23): the plan state is read again (quietly, never a "loading" flash) when the
  // user comes back to the tab / window or the network returns - a payment finished in another tab, the end of the free days or of the
  // grace period is shown without a reload. At most once a minute.
  const lastQuiet = useRef(0);
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return undefined;
    const back = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastQuiet.current < 60000) return;
      lastQuiet.current = now;
      refreshQuiet();
    };
    window.addEventListener('focus', back);
    window.addEventListener('online', back);
    window.addEventListener('pageshow', back);
    document.addEventListener('visibilitychange', back);
    return () => {
      window.removeEventListener('focus', back);
      window.removeEventListener('online', back);
      window.removeEventListener('pageshow', back);
      document.removeEventListener('visibilitychange', back);
    };
  }, [userId, refreshQuiet]);

  return { summary, refresh, refreshQuiet };
}
