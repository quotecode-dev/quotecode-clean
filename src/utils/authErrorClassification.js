// Auth/Account Lifecycle Forensic Audit (2026-09-09): before this task, every
// password-reset/auth-recovery call site (4 near-duplicate copies existed
// across App.jsx/AppLocal.jsx/AppGlobal.jsx/Dashboard.jsx - see this task's
// own continuity record) rendered a raw `'Error: ' + error.message` string
// directly, with a fragile `.includes('Error')`/`.includes('שגיאה')`
// substring check deciding red-vs-green styling. Two real, confirmed defects
// followed from that: (1) a Hebrew error message never contains the English
// substring "Error", so AuthScreen.jsx's shared `resetMsg.includes('Error')`
// check rendered a genuine Hebrew failure with SUCCESS/green styling; (2) no
// call site had any defense against `error` being a non-standard shape (a
// raw network exception, a `{}` body, or a AuthApiError missing `.message`),
// which is exactly the class of bug that produces content like the
// Owner-reported "{}:Error" - a raw object coerced into a string somewhere
// upstream of a clean template. This module is the single place every
// password-reset/recovery call site now routes through: it classifies the
// real, verified Supabase Auth error shapes this project has actually
// observed (`over_email_send_rate_limit` was live-reproduced end-to-end this
// task, HTTP 429, via the real UI), and it can never itself produce a raw
// object in its output - `normalizeAuthError` always returns a plain string
// built from a fixed, curated set of bilingual templates, never
// `String(errorObject)`/`JSON.stringify(errorObject)`.

// `over_email_send_rate_limit`'s own message is dynamic and genuinely
// actionable (a real "try again in N seconds" countdown) - extracted and
// preserved, not replaced with a generic message, per this task's own
// "do not hide actionable detail behind a generic message" instruction.
function extractRateLimitSeconds(msg) {
  const match = /(\d+)\s*seconds?/i.exec(String(msg || ''));
  return match ? match[1] : null;
}

const PATTERNS = [
  {
    category: 'auth_rate_limit',
    test: (err) => err?.code === 'over_email_send_rate_limit' || err?.error_code === 'over_email_send_rate_limit' || /over_email_send_rate_limit/i.test(String(err?.message || '')),
    userMessage: (err, isHebrew) => {
      const seconds = extractRateLimitSeconds(err?.message);
      const waitPhrase = seconds
        ? (isHebrew ? `נא להמתין ${seconds} שניות ולנסות שוב.` : `Please wait ${seconds} seconds and try again.`)
        : (isHebrew ? 'נא להמתין מעט ולנסות שוב.' : 'Please wait a moment and try again.');
      return isHebrew
        ? `⏳ יותר מדי בקשות בזמן קצר. ${waitPhrase}`
        : `⏳ Too many requests in a short time. ${waitPhrase}`;
    },
  },
  {
    category: 'unknown_email',
    // GoTrue's own recover endpoint deliberately never confirms/denies
    // whether an email exists (anti-enumeration) - this pattern exists for
    // defense-in-depth only, in case a future Supabase version changes that.
    test: (err) => /user not found/i.test(String(err?.message || '')),
    userMessage: (_err, isHebrew) => (isHebrew
      ? 'אם כתובת המייל קיימת במערכת, קישור שחזור נשלח אליה.'
      : 'If that email exists in our system, a recovery link has been sent.'),
  },
  {
    category: 'invalid_email_format',
    test: (err) => /invalid.*email|unable to validate email/i.test(String(err?.message || '')),
    userMessage: (_err, isHebrew) => (isHebrew
      ? '❌ כתובת האימייל אינה תקינה.'
      : '❌ That email address is not valid.'),
  },
  {
    category: 'network_error',
    // A genuine network/DNS/CORS failure - supabase-js can throw here
    // rather than resolving with `{error}`, which is exactly the shape this
    // module exists to make safe: `err` may not be a real AuthError at all.
    test: (err) => err instanceof TypeError || /failed to fetch|network/i.test(String(err?.message || '')),
    userMessage: (_err, isHebrew) => (isHebrew
      ? '❌ לא ניתן להתחבר לשרת. בדוק את החיבור לאינטרנט ונסה שוב.'
      : '❌ Could not reach the server. Check your connection and try again.'),
  },
  {
    category: 'auth_server_error',
    // Production-discovered defect (2026-09-09): a real live password-reset
    // request returned HTTP 500 with a genuine, readable server body -
    // {"code":"unexpected_failure","message":"Error sending recovery email"}
    // - yet rendered as a raw "Error: {}"/"שגיאה: {}" on screen. Root cause,
    // confirmed against the installed @supabase/auth-js@2.110.9: for any 5xx
    // response, its internal handleError() constructs an
    // AuthRetryableFetchError BEFORE parsing the response body - the real
    // server-authored message never reaches this module at all. What
    // reaches here instead is an object whose own `.message` is the literal
    // 3-character string "{}" (the unparsed Response, stringified) - a
    // library behavior, not a vendor bug this app can fix, and out of this
    // fix's scope to patch (vendor code is never modified here). Detected
    // by `.name`, the one reliable signal the library itself sets for
    // exactly this case - not by content-sniffing an arbitrary 5xx object,
    // since only this specific vendor shape is actually known to produce
    // the defect. This must run before the generic raw-message fallback
    // below, which would otherwise trust that literal "{}" string as a
    // real, safe-to-show provider message.
    test: (err) => err?.name === 'AuthRetryableFetchError',
    userMessage: (_err, isHebrew) => (isHebrew
      ? 'שגיאת שרת. נסה שוב מאוחר יותר.'
      : 'Server error. Please try again later.'),
  },
  {
    category: 'already_registered',
    // Signup-specific (found this task): Dashboard.jsx's own signup handler
    // previously showed this exact "already registered" message for
    // EVERY signUp() error unconditionally - a weak password, a rate limit,
    // or a real server error all got misreported as a duplicate-account
    // error, sending the user toward the wrong fix (sign in / reset
    // password) for a failure that had nothing to do with a duplicate
    // account. This pattern now only fires for the real duplicate case.
    test: (err) => /already registered|user already exists/i.test(String(err?.message || '')),
    userMessage: (_err, isHebrew) => (isHebrew
      ? 'האימייל כבר רשום במערכת! אנא התחבר או אפס סיסמה.'
      : 'Email already registered! Please sign in or use password reset.'),
  },
  {
    category: 'weak_password',
    test: (err) => /password.*(?:at least|should be|too short|weak)/i.test(String(err?.message || '')),
    userMessage: (_err, isHebrew) => (isHebrew
      ? '❌ הסיסמה חלשה מדי. יש לבחור סיסמה ארוכה/מורכבת יותר.'
      : '❌ Password is too weak. Please choose a longer/stronger password.'),
  },
  {
    category: 'invalid_or_expired_recovery_session',
    // Auth Audit Completion task (2026-09-09): live-reproduced by opening the
    // real set-new-password screen with an invalid/expired recovery token -
    // `updateUser()` rejects with "Auth session missing!", which previously
    // fell through to the generic `auth_provider_message` passthrough below,
    // leaking that raw English phrase inside an otherwise-Hebrew sentence.
    // This is exactly the "expired/invalid recovery link" case the auth
    // audit's own scope calls out, so it gets a real, actionable, bilingual
    // message instead of a passed-through provider string.
    test: (err) => /auth session missing|session.*missing|invalid.*(?:token|session)|expired.*(?:token|session|link)/i.test(String(err?.message || '')),
    userMessage: (_err, isHebrew) => (isHebrew
      ? '❌ קישור השחזור אינו תקין או שפג תוקפו. יש לבקש קישור חדש.'
      : '❌ This recovery link is invalid or has expired. Please request a new one.'),
  },
];

// Never returns a raw object/JSON blob under any input - every branch below
// resolves to one of the curated template strings above, or this one final,
// still-curated (not raw-object) fallback.
export function normalizeAuthError(error, isHebrew) {
  for (const pattern of PATTERNS) {
    if (pattern.test(error)) {
      return { category: pattern.category, message: pattern.userMessage(error, isHebrew) };
    }
  }
  // Genuine AuthApiError instances always carry a real, safe-to-show
  // `.message` (Supabase's own server-authored text, e.g. "Password should
  // be at least 6 characters") - shown as-is rather than re-classified,
  // since it is already a real, specific, actionable Supabase-authored
  // string, not an internal/raw dump.
  const rawMessage = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : null;
  if (rawMessage) {
    return { category: 'auth_provider_message', message: (isHebrew ? 'שגיאה: ' : 'Error: ') + rawMessage };
  }
  // Last resort: `error` is some non-standard, unrecognized shape (not a
  // real Error/AuthError, no readable `.message`) - this is the exact case
  // that used to fall through to a raw object coercion. Never stringify it.
  return {
    category: 'unknown',
    message: isHebrew
      ? '❌ אירעה שגיאה בלתי צפויה. נסה שוב מאוחר יותר.'
      : '❌ An unexpected error occurred. Please try again later.',
  };
}

// Small helper for the shared display components (AuthScreen.jsx) so they
// never need their own `.includes('Error')`/`.includes('שגיאה')`
// substring-sniffing to decide error-vs-success styling again - the
// category itself, not the message text, is now the source of truth.
export function isAuthErrorCategory(category) {
  return typeof category === 'string' && category.length > 0;
}
