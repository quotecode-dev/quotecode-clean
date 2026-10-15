// Owner 2026-10-15 ("users get signed out after some time"; Codex AUD-06/AUD-07): an Edge Function call of a signed-in user must carry
// the user's CURRENT session. supabase-js silently falls back to the anon key (or no Authorization header) when a token refresh fails
// for a moment (a laptop waking up, a dropped network), and a function then answers "Invalid or expired session" while the app still
// looks signed in. Here: a fresh session first (refresh when missing), never an anonymous call for a signed-in action, and one
// refresh + retry when the function answers 401. A session the server really revoked still ends in an honest sign-in prompt
// (supabase-js emits SIGNED_OUT when the refresh is rejected). Public calls (public quote, business card, public chat) do not use this.
import { supabase } from './supabase';

const status401 = (error) => Number(error?.context?.status) === 401;

export function signedOutError() {
  const e = new Error('Invalid or expired session');
  e.name = 'SignedOutError';
  e.code = 'signed_out';
  return e;
}

export function makeInvokeWithFreshSession(client) {
  const freshToken = async ({ force = false } = {}) => {
    if (!force) {
      try {
        const { data } = await client.auth.getSession();
        if (data?.session?.access_token) return data.session.access_token;
      } catch { /* fall through to a refresh */ }
    }
    try {
      const { data } = await client.auth.refreshSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  };
  return async function invokeWithFreshSession(name, options = {}) {
    const token = await freshToken();
    if (!token) return { data: null, error: signedOutError() };
    const call = (t) => client.functions.invoke(name, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${t}` } });
    const res = await call(token);
    if (!res?.error || !status401(res.error)) return res;
    const retryToken = await freshToken({ force: true });
    if (!retryToken) return res; // the original 401 answer (the caller shows "sign in again")
    return call(retryToken);
  };
}

export const invokeWithFreshSession = makeInvokeWithFreshSession(supabase);
