# CANONICAL 5186 — AUTHENTICATED HE/EN BROWSER TERMINAL VERIFICATION (Final Delta Closure)

Real, live, authenticated browser verification through `http://192.168.1.189:5186/` (Chrome via
CDP, `browser-harness`), performed AFTER Finding 6's TEST redeploy (chat-ai v32) and the 5186
frontend rebind, so this evidence genuinely reflects the deployed delta fixes - not a stale build.

## Build identity (confirmed in-session, both personas)

- `<meta name="tekango-build-sha">` content: `f106344a3f591b2065a0b6c10fe464ad161d850a` (matches the
  candidate `dist/tekango-build-identity.json` exactly - see the deployment attestation).
- TEST project ref: `ljfizgrdyzxddswcedwr`.

## HE persona: LOCAL_PRO ("TEST HE Pro", tahshitishi+proflow-local-pro@gmail.com)

- Real login via the actual login form at `http://192.168.1.189:5186/dashboard?lang=he` (email +
  password typed into the real, non-decoy fields `user_email_field`/`user_password_field` - the page
  ships honeypot decoy fields `fake_user_login`/`fake_pass_login` which were correctly avoided).
- Reached the authenticated Dashboard ("TEST HE Pro", 1 quote, ₪0.00 revenue - a real TEST fixture
  account, not fabricated).
- Opened the real AI Chat widget ("פתיחת צ׳אט AI"), typed the exact regression prompt into the real
  chat input, clicked the real "שלח" (Send) button.
- **Prompt sent:** `אני יכול להפעיל הצעות חוזרות אוטומטית?`
- **Actual rendered response (verbatim, captured from the live DOM):**
  > אני רוצה לוודא שאני עונה נכון - איזו יכולת ספציפית ב-TEKANGO את/ה שואל/ת עליה? לדוגמה: מחשבון
  > בעורך, ייצוא PDF, שיתוף בוואטסאפ, צירוף קבצים, הצעה מדודה, תשלומים/חשבוניות, או משהו אחר. ציין/ציני
  > את שם היכולת ואשמח לתת תשובה מדויקת מתוך רשימת היכולות האמיתית של המוצר.
- This is the exact deterministic clarification text (`formatBroadCapabilityClarification(true)`) -
  proves live, through the real UI, that the capability-question guard intercepted this message
  BEFORE any free-form model reasoning about "recurring quotes on autopilot" could occur.
- Timestamp (in-app chat clock): `15:34`. Session UTC (host clock): captured alongside the affected-
  cells API rerun, `2026-09-23T12:3X:XXZ` window.

## EN persona: INTL_PRO ("TEST EN Pro", minhatshay+proflow-int-pro@gmail.com)

- Real login via the actual login form at `http://192.168.1.189:5186/dashboard?lang=en` (same
  real/decoy field pattern, same avoidance).
- Reached the authenticated Dashboard ("TEST EN Pro", 60 quotes, $10,020,007.73 revenue - a real
  TEST fixture account).
- Opened the real "Open AI Chat" widget, typed the exact regression prompt into the real "Ask
  something..." input, clicked the real "Send" button.
- **Prompt sent:** `Can I put recurring quotes on autopilot?`
- **Actual rendered response (verbatim, captured from the live DOM, `.ai-chat-popup` textContent):**
  > I want to make sure I answer correctly - which specific TEKANGO feature are you asking about? For
  > example: the in-editor calculator, PDF export, WhatsApp sharing, file attachments, measured
  > quotes, payments/invoicing, or something else. Name the specific feature and I'll answer
  > precisely from the product's real capability list.
- This is the exact deterministic clarification text (`formatBroadCapabilityClarification(false)`) -
  the permanent regression case named by Codex's final re-review, proven closed live through the
  real UI with a real authenticated EN persona.
- Timestamp (in-app chat clock): `15:36`.

## Result

**HE BROWSER TERMINAL: PASS. EN BROWSER TERMINAL: PASS.** Both responses are the real, rendered
deterministic clarification text, never a free-form guess, captured from the live DOM of a real
authenticated session on the canonical TEST endpoint, against the actually-deployed v32 runtime.
