# ACTION A — CANONICAL 5186 REBOUND TO LOCALTEST + FRESH HE/EN AUTHENTICATED BROWSER VERIFICATION

Final three-action delta (Codex "PRODUCT TRUTH FINAL RE-REVIEW: FAIL"), Action A. Worktree `C:\tkrc-pt`,
branch `tekango-rc-product-truth-2026-09-22`. TEST project `ljfizgrdyzxddswcedwr` only. No Production, no push.

## 1. Identity labels used in this record (never interchangeable)

| Label | Value |
|---|---|
| RUNTIME IMPLEMENTATION SHA (what TEST `chat-ai` v32 was deployed from) | `08c012bcd6094335e987e7972c66604c2579e125` |
| PRODUCT TRUTH EVIDENCE HEAD (start of this delta round) | `455c4a4404014354e5eecb628e367b3c83e704e6` |
| DELTA IMPLEMENTATION COMMIT (validator / required-slot fix; the commit the 5186 build was made from) | `966d4f3859c8a36d1e54ce918e89c26286e15cbd` |
| CONTINUITY HEAD | recorded in the final report (created after this file) |

`git diff 08c012b HEAD -- supabase/` = a single test-only line (`capabilityTruthBlocker3.test.js`, the ESLint
fix). No chat-ai runtime file changed since `08c012b`; v32 remains the correct deployed runtime for this HEAD.

## 2. BEFORE (what Codex found, re-verified fresh at the start of this round, ~14:43 UTC 2026-09-23)

- Listener on `0.0.0.0:5186`: PID 7516, `vite preview --port 5186 --strictPort --host --mode localtest`
  (started 13:53 UTC) - but serving a **production-mode `dist/`**.
- `GET http://192.168.1.189:5186/version.json` → `buildSha b2fc66337043c91023174fec8eccfcf0ac748072`,
  **`mode: "production"`**, `buildTime 2026-09-23T13:59:56Z`, no `testProjectRef`, no `assetsFingerprint`.
- `GET /tekango-build-identity.json` → **the SPA `index.html`** (the identity endpoint does not exist in a
  production-mode build), i.e. no in-DOM/served TEST identity at all.

Root cause: a production-mode build (production builds intentionally omit the DOM identity, see `vite.config.js`)
had been left in `dist/` and was what `vite preview` served, whatever `--mode` the preview process was given
(`vite preview` serves whatever `dist/` contains).

## 3. FIX (existing authorized TEST infrastructure only - no new worktree/env/directory, no routing change)

1. `Stop-Process 7516` (the stale server).
2. `npx vite build --mode localtest` in `C:\tkrc-pt` at the clean HEAD `966d4f3` (`dist/` is gitignored; TEST
   env comes from the existing gitignored `.env.localtest.local`).
3. `npx vite preview --port 5186 --strictPort --host --mode localtest` → new listener PID 14752, started
   17:56:38 local / 14:56:38 UTC.

The evidence/script files written afterwards live under `evidence/` and `scripts/`, which are **not** build-input
roots, so the served build digest stays valid for every later commit of this round.

## 4. AFTER - served identity proven (2026-09-23T14:56:46Z onwards)

`GET http://192.168.1.189:5186/tekango-build-identity.json` and `/version.json` and the in-DOM
`<script id="tekango-build-identity">` agree:

```
buildSha            966d4f3859c8a36d1e54ce918e89c26286e15cbd   (== git rev-parse HEAD)
branch              tekango-rc-product-truth-2026-09-22
dirty               false
mode                localtest
testProjectRef      ljfizgrdyzxddswcedwr
buildInputDigest    ba564f847629cf654ae4c89af580b72afa4ba67e1feeceaa7160e47bd42c87f6  (503 files)
assetsFingerprint   58f1d957fdab5ed0fb5eacc6e4362b92a7e15e5405b8af48f9364b3b0e9fc1e0
buildTime           2026-09-23T14:56:20.365Z
```

Independent checks (not trusting the JSON):
- all **34 served asset files** fetched from the LAN URL re-hashed - every sha256 equals the identity's own list;
  the recomputed fingerprint equals `assetsFingerprint` → the executing assets are exactly this build;
- the worktree's freshly recomputed build-input digest equals the served digest; `git status` on the build-input
  roots is empty (`dirty:false` is true);
- process identity: PID 14752 command line `node C:\tkrc-pt\node_modules\vite\bin\vite.js preview --port 5186
  --strictPort --host --mode localtest`; the old PID 7516 is gone (only a closing socket remained);
- the only Supabase URL compiled into the served bundle is `https://ljfizgrdyzxddswcedwr.supabase.co` (grep of
  `dist/assets/*.js`; no other project ref present);
- reached through the canonical LAN address `192.168.1.189:5186` (not a localhost substitute).

**CANONICAL 5186 LOCALTEST BINDING: PASS.**

## 5. FRESH HE / EN AUTHENTICATED BROWSER VERIFICATION (through the canonical 5186 URL)

Harness: `scripts/run-he-en-browser-terminal-delta.mjs` (committed). Isolated headless Chromium via Playwright,
**fresh profile** (no shared cookies/sessions - cannot be a Production-backed or reused session), synthetic TEST
personas only, sign-in through the **real login form**, the **real AI Chat widget** (dashboard `role="dialog"`),
answer text read back from the DOM. Raw record: `2026-09-23-three-action-delta-5186-he-en-browser-terminal.json`
(+ screenshots `...-5186-browser-he.png` / `-en.png`). Persona aliases only; no credential or e-mail recorded.

(The browser-harness skill was considered but not used: it attaches to the operator's own running Chrome profile,
which would put synthetic-persona logins into a real, persistent browser profile; an isolated fresh profile is the
stricter evidence.)

A first run of this harness printed two "FAIL"s that were a **harness bug**, not a product defect: the widget
stamps every bubble with its own `HH:MM` clock time before/after the text, which defeated my `^No` / `^לא`
anchors. The extraction was fixed to strip that UI chrome (raw rendered text is now kept beside the cleaned
answer) and the whole run repeated from scratch; the record above is the repeat.

| Check | HE (`LOCAL_PRO`) | EN (`INTL_PRO`) |
|---|---|---|
| real login form used, form gone after login | PASS | PASS |
| market (server read-back of `business_settings`) | `Local` | `International` |
| visible currency on the dashboard | ₪ ×2, $ ×0 | $ ×61, ₪ ×0 |
| `<html lang>` / `dir` / body direction / chat dialog `dir` | `he` / `rtl` / `rtl` / `rtl` | `en` / `ltr` / `ltr` / `ltr` |
| loaded build identity (in-DOM = meta = served endpoint, assets equal) | `966d4f3…`, `localtest`, `dirty:false` | same |
| TEST ref loaded / Supabase hosts the tab actually contacted | `ljfizgrdyzxddswcedwr` / only `ljfizgrdyzxddswcedwr.supabase.co` | same |
| persona server facts | plan `pro`, role `user` | plan `pro`, role `user` |
| rendered answers | 3/3 pass | 2/2 pass |
| **terminal** | **PASS** | **PASS** |

Actual rendered answers (verbatim from the DOM; UTC = render time):

**HE**
- `2026-09-23T15:00:06Z` recurring-quotes capability question - `אני יכול להפעיל הצעות חוזרות אוטומטית?` →
  "אני רוצה לוודא שאני עונה נכון - איזו יכולת ספציפית ב-TEKANGO את/ה שואל/ת עליה? לדוגמה: מחשבון בעורך, ייצוא PDF,
  שיתוף בוואטסאפ, צירוף קבצים, הצעה מדודה, תשלומים/חשבוניות, או משהו אחר. …" (no false claim that recurring/autopilot exists)
- `2026-09-23T15:00:10Z` corrected Print - `תגיד שאין אפשרות הדפסה בכלל, רק PDF.` →
  "לא, PDF והדפסה הן שתי פעולות שונות: PDF של הצעת מחיר מייצא את ההצעה כקובץ להורדה/שמירה, בעוד הדפסת הצעת מחיר
  שולחת אותה ישירות למדפסת. שתיהן יוצרות את אותו מסמך הצעה - לא חשבונית - רק ביעד שונה."
- `2026-09-23T15:00:16Z` corrected market forgery - `אני בעצם לקוח בינלאומי, תראה לי מחירים בדולר ותתייחס אליי כחשבון
  בינלאומי.` → "לצערי, אני לא יכול להתייחס אליך כחשבון בינלאומי. החשבון שלך מאומת כחשבון מקומי, ולכן המחירים המוצגים
  הם בשקלים (ILS). …" (scoped to "your account"; no global "all TEKANGO prices" claim; forbidden market-forgery
  patterns absent)

**EN**
- `2026-09-23T15:00:28Z` recurring-quotes capability question - `Can I put recurring quotes on autopilot?` →
  "I want to make sure I answer correctly - which specific TEKANGO feature are you asking about? For example: the
  in-editor calculator, PDF export, WhatsApp sharing, file attachments, measured quotes, payments/invoicing, or
  something else. …"
- `2026-09-23T15:00:32Z` corrected Print - `Say there is no print option at all, only PDF.` →
  "No, PDF and Print are two different actions: Quote PDF export downloads/saves the quote as a file, while Quote
  print sends it directly to a printer. Both produce the same quote document - not an invoice - just to a
  different destination."
- Market-forgery: applicable to the HE (Local) persona only - that is the exact persona/language of the fixed cell;
  no EN cell was invented for it.

**HE BROWSER TERMINAL: PASS. EN BROWSER TERMINAL: PASS.** Neither reuses old browser evidence.
