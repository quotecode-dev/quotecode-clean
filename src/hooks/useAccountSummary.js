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

  useEffect(() => {
    refresh();
    return () => { seq.current += 1; };
  }, [refresh]);

  return { summary, refresh };
}
