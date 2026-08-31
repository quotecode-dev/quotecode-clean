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
      'ProFlow TEST mode fail-closed: running with --mode localtest but VITE_PROFLOW_ENV is not "TEST". ' +
      'This usually means .env.localtest.local is missing or was not loaded. Refusing to start.'
    )
  }

  const resolvedRef = extractSupabaseProjectRef(supabaseUrl)

  if (!resolvedRef) {
    throw new Error(
      `ProFlow TEST mode fail-closed: VITE_SUPABASE_URL is missing or malformed ("${supabaseUrl}"). Refusing to start.`
    )
  }

  if (resolvedRef === PRODUCTION_PROJECT_REF) {
    throw new Error(
      'ProFlow TEST mode fail-closed: VITE_SUPABASE_URL resolves to the PRODUCTION project ref. ' +
      'Refusing to start to prevent a TEST session from touching Production.'
    )
  }

  if (resolvedRef !== TEST_PROJECT_REF) {
    throw new Error(
      `ProFlow TEST mode fail-closed: VITE_SUPABASE_URL resolves to an unexpected project ref ("${resolvedRef}"), ` +
      `not the known TEST project ref ("${TEST_PROJECT_REF}"). Refusing to start.`
    )
  }
}

// יצירת הקליינט עם תמיכה מובנית ב-Realtime
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})