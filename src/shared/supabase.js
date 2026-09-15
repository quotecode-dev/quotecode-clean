import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// שומר-כשל (fail-closed) למצב TEST בלבד: כאשר ריצה היא תחת --mode localtest
// (npm run dev:localtest), חובה לוודא ש-VITE_SUPABASE_URL אכן פותר לפרויקט
// quotecode-test ולא בטעות לפרודקשן - לפני יצירת הקליינט בכלל, לא אחריה.
// במצב ברירת המחדל/פרודקשן ה-guard כולו לא רץ ואין שום שינוי התנהגות.
const PRODUCTION_PROJECT_REF = 'ixabnzhjeqevtbhdfswv'
const TEST_PROJECT_REF = 'ljfizgrdyzxddswcedwr'
const isLocalTestMode = import.meta.env.MODE === 'localtest'

function extractSupabaseProjectRef(url) {
  const match = typeof url === 'string' && url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)
  return match ? match[1] : null
}

if (isLocalTestMode) {
  if (import.meta.env.VITE_PROFLOW_ENV !== 'TEST') {
    throw new Error(
      'TEKANGO TEST mode fail-closed: running with --mode localtest but VITE_PROFLOW_ENV is not "TEST". ' +
      'This usually means .env.localtest.local is missing or was not loaded. Refusing to start.'
    )
  }

  const resolvedRef = extractSupabaseProjectRef(supabaseUrl)

  if (!resolvedRef) {
    throw new Error(
      `TEKANGO TEST mode fail-closed: VITE_SUPABASE_URL is missing or malformed ("${supabaseUrl}"). Refusing to start.`
    )
  }

  if (resolvedRef === PRODUCTION_PROJECT_REF) {
    throw new Error(
      'TEKANGO TEST mode fail-closed: VITE_SUPABASE_URL resolves to the PRODUCTION project ref. ' +
      'Refusing to start to prevent a TEST session from touching Production.'
    )
  }

  if (resolvedRef !== TEST_PROJECT_REF) {
    throw new Error(
      `TEKANGO TEST mode fail-closed: VITE_SUPABASE_URL resolves to an unexpected project ref ("${resolvedRef}"), ` +
      `not the known TEST project ref ("${TEST_PROJECT_REF}"). Refusing to start.`
    )
  }
}

// Password Recovery Fresh-Link Root-Landing Hardening (2026-09-15 task):
// a fresh recovery-email link can arrive with the recovery fragment/params
// on the bare root path (see AppLocal.jsx/AppGlobal.jsx's own "/" route
// comment for the full root-cause explanation) - if that happens,
// createClient() below's own internal detectSessionInUrl consumes and
// clears window.location.hash asynchronously, shortly after this module
// loads, so anything that only checks the URL from inside a mounted
// component (as Dashboard.jsx's pre-existing hash-check effect already
// does, correctly, for the direct /dashboard case) can be too late once
// the marketing landing page - not Dashboard - is what actually mounted on
// "/". This captures ONLY a non-sensitive boolean marker, synchronously,
// before createClient() ever runs, so AppLocal.jsx/AppGlobal.jsx's root
// route can decide to mount Dashboard instead of the landing page, and
// Dashboard.jsx's own existing recovery-detection effect can fall back to
// it when the URL itself no longer carries the evidence. Never captures or
// stores token material, never persists the raw URL, never logged.
// Pure function (no window/DOM access) so it can be unit-tested directly
// with arbitrary hash/search strings, independent of jsdom/location
// plumbing - same pattern already used elsewhere in this codebase
// (resolveIsEnglishEnv, getPostRecoveryLoginLang) for exactly this reason.
export function computeRootRecoveryIntent({ hash = '', search = '' } = {}) {
  return {
    isRecovery: hash.includes('type=recovery') || search.includes('type=recovery'),
    isError: hash.includes('error_code=') || search.includes('error_code=') || hash.includes('error=') || search.includes('error='),
  };
}

export const rootRecoveryIntent = typeof window === 'undefined'
  ? { isRecovery: false, isError: false }
  : computeRootRecoveryIntent({ hash: window.location.hash || '', search: window.location.search || '' });

// Called once, by whichever component actually consumes the marker
// (Dashboard.jsx's recovery-detection effect), so a later re-render within
// the same page load can never re-trigger recovery mode from stale
// boot-time state.
export function consumeRootRecoveryIntent() {
  rootRecoveryIntent.isRecovery = false;
  rootRecoveryIntent.isError = false;
}

// יצירת הקליינט עם תמיכה מובנית ב-Realtime
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})