# TEKANGO Post-LIVE Wave 1 — Codex-ready review package (2026-09-27)

Audience: the independent Codex reviewer, plus the Owner for the decision block. Codex was NOT invoked in this Wave.

## 1. Baseline (fresh, read-only, 2026-09-27 ~08:20Z)
| Check | Result |
|---|---|
| `origin/main` | `e2090a407cf450b92335ad21791ca5fca6c78974` |
| `www.tekango.com/version.json`, `tekango.com/version.json` | `e2090a4…`, `dirty:false`, digest `f065a6f6…` (= accepted) |
| Vercel `www.tekango.com` | `dpl_ebjcu8wPvv1cTYfAdcp2YuANTWGx` READY; no newer Production deployment |
| Edge (Production `ixabnzhjeqevtbhdfswv`) | `get-public-quote` v15, `send-quote-email` v30, `chat-ai` v17; no function updated after 2026-09-26 |
| Migration ledger | NOT re-read (Management API token not locally readable; see §4) — no migration tool was run by anyone in this Wave |
| **Drift** | **NONE observed** |

Work branch: `tekango-post-live-wave1-2026-09-27` (worktree `C:\tkpl-wave1`), based on LIVE `e2090a4`. Not pushed.

## 2. Files changed (why each exists)
| File | Track | Why |
|---|---|---|
| `src/components/QuoteForm.jsx` | C1/C2/C6 | HE client-name placeholder was English (`e.g. Acme Corp`) → Hebrew example in HE; EN attention/project placeholders were Israeli (`Simon Levy`, `Holon Project`) → `John Smith`, `Downtown Office Renovation`; icon-only attachment remove button gets `aria-label` (`הסרת הקובץ <name>` / `Remove attachment <name>`). No visual change. |
| `src/components/AddItemWizard.jsx` | C3 | Review step showed raw `cm`/`m²`/`m` in Hebrew. Now reuses the wizard's existing `t.calcPreviewArea/Linear` and one display-only `measureUnitWord`. EN output byte-identical; stored item (meters, `pricing_unit`, quantities) unchanged; quote math unchanged. |
| `src/utils/draftAttachments.js` | C5 | `isBlobReadable` probe at restore: a restored blob that cannot be read is reported as missing (existing "please select again" notice) instead of surfacing later as a failed save. Defense-in-depth — see §5. |
| `src/pages/Dashboard.jsx` | C5 | Upload-stage save failure message now also says: if it keeps failing, remove the file and attach it again. Fail-closed save unchanged. |
| `supabase/functions/auth-send-email-hook/emailContent.ts` (new) | A | Pure content module extracted from the hook (subject/HTML/text/sender, HE/EN by `signup_market === 'Local'`, fail-closed EN). Only behavior delta: the recipient address and CTA URL are HTML-escaped. |
| `supabase/functions/auth-send-email-hook/index.ts` | A | Imports the module; handler logic unchanged. NOT deployed anywhere. |
| `src/data/productTruthInteractiveBaseline.json` | A | The hook's pre-existing unmarked email CTA (`<a href>`, gap 1) moved from `index.ts` to `emailContent.ts`; the gap is carried over unchanged, not widened. |
| Tests: `QuoteForm.test.jsx`, `AddItemWizard.test.jsx`, `draftAttachments.test.js`, `auth-send-email-hook/emailContent.test.js` (new) | F | See §3. |

## 3. Tests
- Focused: QuoteForm (+3), AddItemWizard (+2 HE review units: area + length, stored item asserted), draftAttachments (+2), auth hook content (12: every action type × HE/EN, TEKANGO present, no ProFlow / quotecode / TEST ref / localhost / 127.0.0.1 / LAN / :5186, HE = rtl/he, EN has zero Hebrew, sender per market, verify URL on the Auth API base, email escaping, no duplicated template in `index.ts`).
- Full suite: **153 files / 4122 tests passing** (first run surfaced 3 Product Truth interactive-baseline failures from the moved CTA → baseline entry carried over, re-run 25/25, then full green). ESLint: **0 errors**, 3 pre-existing warnings (PublicTools, PublicToolsEn, Dashboard:734). `vite build --mode production` (scratch outDir): OK.

## 4. Focused browser matrix (local dev server `--mode localtest` on 127.0.0.1:5195 → TEST backend; synthetic TEST personas LOCAL_PRO / INTL_PRO; no save, no TEST DB write; drafts discarded and session cleared after)
| Cell | HE / RTL / ILS | EN / LTR / USD |
|---|---|---|
| Quote form placeholders — desktop | PASS (`לדוגמה: כהן בנייה בע"מ`, `שמעון לוי`, `פרויקט חולון`; no `e.g.`) | PASS (`Acme Corp`, `John Smith`, `Downtown Office Renovation`; no Hebrew, no Holon/Simon) |
| Quote form placeholders — 390px | PASS (scrollWidth 390) | PASS (scrollWidth 390) |
| Attachment remove accessible name (AX tree) | PASS `הסרת הקובץ wave1-qa-plan.pdf` | PASS `Remove attachment wave1-qa-plan-en.pdf`; click removes the file |
| Attachment remove visual | PASS (390px screenshot, unchanged) | NOT CAPTURED (desktop DOM only) |
| Item wizard Review units — 390px | PASS `80 × 100 ס"מ = 0.80 מ"ר`, total `2.00 מ"ר`, preview `2 מידות · 2.00 מ"ר`, ₪, no raw cm/m² | PASS unchanged `cm`/`m²`, `$`, no Hebrew/₪ |
| Item wizard Review units — desktop | PASS | PASS |
| Draft restore after the source file was deleted on disk | file restored readable (Chrome copies the blob into IndexedDB) — the First-LIVE failure was NOT reproduced; client field restored; no false "missing" | NOT RUN |
| Trial identity display | NOT CHANGED (Owner decision OD-4); unit tests unchanged | NOT CHANGED |
| Auth email content | static/unit only (hook not deployed) | static/unit only |
| Quote email status | NOT CHANGED (canonical, §6) | NOT CHANGED |

Screenshots (session scratchpad, non-durable; sha256): `qa-he-390-attachment.png` 5d8e14be…, `qa-he-390-client.png` d2add59b…, `qa-he-390-wizard-review.png` 1753943e…, `qa-he-desktop-wizard-review.png` c979f45e…, `qa-en-390-wizard-review.png` b7cc18eb…. Read-only probe script `wave1-readonly-probe.mjs` 7195f083… (GET-only; found no locally readable Management API token, so it made no request).

## 5. Track conclusions
- **A (Auth/Resend).** Production still uses the built-in mailer (hosted templates, observed ProFlow-branded in First-LIVE). The repo already carries a TEST-proven Send Email Hook (`auth-send-email-hook`, enabled on TEST since 2026-09-16; absent on Production; `SEND_EMAIL_HOOK_SECRET` absent on Production). It is the only mechanism that gives HE/EN + per-market sender without duplicating Auth's token logic. Proposed content is proven TEKANGO-only / market-separated by `emailContent.test.js`. Hosted Auth config (templates, SMTP sender, redirect list) was NOT freshly readable (token in OS keyring); last evidence: Site URL `https://www.tekango.com`, redirects honored (Preflight 2026-09-25). **Resend warning:** inherent to the current design — every Auth link (built-in or hook) points at `https://ixabnzhjeqevtbhdfswv.supabase.co/auth/v1/verify` while mail is sent from `tekango.com`. Only a custom Auth domain or `token_hash` links to `www.tekango.com` + a frontend `verifyOtp` route change the link host (OD-2). Additional finding: Production signup `emailRedirectTo` is `https://www.tekango.com/dashboard` without `?lang=` (recovery carries it) — deferred, needs redirect allow-list verification first.
- **B (Cron).** Runtime proof: Vercel cron called `/api/cron` at 2026-09-27T08:02Z → **401** (fail-closed; this happens daily). Vercel Production env still has only `GOOGLE_INDEXING_CREDENTIALS`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Supabase Edge `CRON_SECRET` present (digest `1f14d18a…`, set 2026-08-23; value not recoverable). No local approved source holds `CRON_SECRET` or the service-role key. `SUPABASE_URL` is optional (`api/cron.js` falls back to `VITE_SUPABASE_URL`). Residual: `api/cron.js` ignores errors of the quote-flag update and the rates upsert (would log success falsely) — fix before or with enabling.
- **C (UX).** C1, C2, C3, C6 closed and browser-verified. C4 → OD-4. C5 PARTIAL: UX guidance improved + restore probe; the original First-LIVE failure was not reproduced (root cause unknown).
- **D (quote email status).** Canonical: Product Truth `quote_status` (LIVE_CURRENT) = "a manual label"; `send-quote-email` and `executeEmailSend` never write `status`; public signing accepts `draft` and `sent`. Current behavior is the product truth; the First-LIVE matrix expectation was a spec mismatch. No change.
- **E (housekeeping).** See the checkpoint block (KEEP / SAFE / OWNER). No deletion performed. `quotecode-quote-code.vercel.app` is already back on LIVE (resolved by the promotion).

## 6. Production mutations NOT performed
No deploy (frontend or Edge), no Vercel env/alias/deployment change, no Supabase secret/Auth config/hook change, no migration, no DB access, no push, no Resend change, no compensation. Real customer data used: NO.

## 7. Deferred Post-LIVE residuals
Quote-row first-item preview order; EN phone placeholder `502345678` (Israeli format in EN form, not a recorded finding); signup `emailRedirectTo` without `?lang=`; `api/cron.js` unchecked write errors; executor TLS `verify-full`; Supabase logs endpoint "Backend error"; tooling evidence not committed in `C:\tkrtool-iron`; C5 root cause.
