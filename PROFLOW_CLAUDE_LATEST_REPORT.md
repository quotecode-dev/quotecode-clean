# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** CONTINUITY DOCUMENTS ≠ FRESH LOCAL WORKING TREE either. See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: TEST Login / Market Routing Audit (READ-ONLY)

**Effort level**: MEDIUM.

**Bootstrap**: performed, directly from `proflow-continuity`. `HEAD == origin/proflow-continuity == 278d52242f8dfe0dcd11a331aa13e3a992389436` (the exact state §18.DC left), clean, all six files read. Fresh Local State: `main` `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621` (unchanged); standing baseline `git status --short`; ports 5184/5186 both `LISTENING`, unchanged from prior task.

## 1-2. Question

Can a Local TEST user and an International TEST user both start from the same normal TEST entry point (plain root URL) and automatically land in the correct market UI, without needing to manually know or type `/en`/`/he`?

## 3. Traced Flow, Step by Step (READ-ONLY)

- **A. Anonymous app entry** — `src/main.jsx` lines 21-51: bundle choice runs synchronously, before React mounts, before any Auth check.
- **B. Login form** — `src/components/AuthScreen.jsx`, rendered by `Dashboard.jsx` (line 2411-2414) when no session exists; its displayed language is `bundleIsHebrew` (a fixed prop from `AppLocal`/`AppGlobal`), never account-aware (correctly — no account is known yet).
- **C. `auth.signInWithPassword`** — `Dashboard.jsx` line ~1334, no market logic involved.
- **D. Session creation** — `Dashboard.jsx`'s `onAuthStateChange` (lines 293-327) handles `SIGNED_IN`, awaiting `loadData`/`fetchSettings` behind `isInitializing` gating (set `true` at 309, `false` at 311, after `loadData` resolves) — deliberately prevents any flash of wrong content, per its own in-code comment.
- **E. Dashboard mount** — gated by `isInitializing || isPasswordRecoveryMode || !session` (line 2411); real content only renders once the account's true state is loaded.
- **F. `business_settings` fetch** — inside `loadData`/`fetchSettings`, populates `bizCountry` (state at line 117) from the real DB `country` column.
- **G. Market source of truth** — `bizCountry`, feeding `isHebrew = isHebrewEnv(bizCountry, session)` (line 132) and `isLocalIsraeliBusiness = bizCountry === 'Local' || 'LCL'` (line 218). `src/utils/regionConfig.js`'s `isHebrewEnv`/`getRegionTaxRate`/`getCurrencySym` (lines 17-64) make the real DB value win over any cache whenever known.
- **H. `AppLocal`/`AppGlobal` selection** — `main.jsx`, entirely pre-auth, independent of G.
- **I. Route changes after login** — none found. Grep across `Dashboard.jsx`/`AppLocal.jsx`/`AppGlobal.jsx` for `navigate(`/`window.location.href`/`.replace` found only two unrelated, non-market-conditional redirects (a logout-origin redirect, an `/ai-logs` nav button).
- **J. Behavior after refresh** — `main.jsx`'s cascade re-runs from scratch, but `localStorage.proflow_lang` (written on every load, line 44) outranks geo-cookie/browser-language, so a prior "wrong" bundle choice self-reinforces across refreshes.
- **K. Landing on the "wrong" market route before login** — `AuthScreen` simply renders in that bundle's fixed language; no detection/correction is possible pre-auth (correctly — the account isn't known yet).

## 4. Explicit Answers

1. **Is `business_settings.country` consulted early enough to choose `AppLocal`/`AppGlobal`?** No — it is fetched only *after* the bundle is already rendering, and is never used to choose or change the bundle.
2. **Is `AppLocal`/`AppGlobal` chosen before account identity is known, from URL/localStorage/geo/language only?** Yes, confirmed exactly — `main.jsx` lines 34-41.
3. **International account logs in while on the Hebrew bundle — what happens today?** Dashboard content correctly flips to English/USD-EUR-GBP/0% VAT (via `bizCountry`), but `document.dir` remains `'rtl'` (set once by `AppLocal`, never revisited) — English content trapped in a right-to-left-mirrored page.
4. **Local account logs in while on `/en` — what happens today?** Mirror image: correct Hebrew/ILS/18%-VAT content trapped inside `dir='ltr'`.
5. **Does login itself redirect/reload/re-resolve the bundle?** No — confirmed via grep, no such mechanism exists in the reachable code path.
6. **Does Dashboard redirect based on the account's stored market?** No.
7. **Does refresh correct, preserve, or depend on localStorage/path?** Re-runs the pre-auth cascade; `localStorage.proflow_lang` (cached on every load) preserves/reinforces whatever bundle was last chosen, ranking above geo-cookie and browser-language.
8. **Can an authenticated account remain in the wrong bundle indefinitely?** Yes, confirmed — no code-level correction exists anywhere in the reachable path.

## 5. Source-of-Truth Map

| Axis | Current source | Status |
|---|---|---|
| PRE-AUTH market source | URL (`?lang=`/path) → `localStorage.proflow_lang` → geo cookie → `navigator.language` (`main.jsx`) | Current, implemented |
| POST-AUTH account market source | `business_settings.country` via `bizCountry`/`isHebrew`/`isLocalIsraeliBusiness` | Current, implemented, robust |
| BUNDLE-selection source | Same as pre-auth; never re-evaluated post-auth | **Current gap** |
| CURRENCY/VAT source | `business_settings.country` via `regionConfig.js` | Current, implemented, robust, market-neutral |
| LOGIN redirect source | None exists | **Current gap** |
| REFRESH behavior | Re-runs pre-auth cascade; `localStorage` self-reinforces prior bundle choice | Current, implemented (gap-preserving) |
| `App.jsx`'s market-redirect `navigate()` logic | Would structurally address the gap | Approved-design-shaped, but dead/unwired code — not currently authoritative |

## 6. Testability Assessment

**B — TESTABLE BUT MANUAL /en-/he DEPENDENCY REMAINS.** Account isolation, content correctness, and currency/VAT are provably robust and safe to test today via the existing DB-driven mechanism (item 5/G above). Only the "automatic, no manual URL knowledge required" landing behavior is currently absent. **Minimal architectural gap**: no post-login mechanism re-syncs `document.dir`/`lang` (or redirects) to the account's real market once it is known — not fixed by this audit.

## 7. HE Agent

**HE LOGIN ROUTING: FAIL.** Independently traced `main.jsx`, `AppLocal.jsx`, `AppGlobal.jsx`, `Dashboard.jsx`, `regionConfig.js`; confirmed all 5 findings with direct citation; independently confirmed via its own grep that `App.jsx`'s market-redirect logic is dead code (never imported).

## 8. EN Agent

**EN LOGIN ROUTING: FAIL.** Independently traced the same files for the International case; additionally confirmed the zero-VAT/USD-EUR-GBP invariant is unconditionally robust regardless of bundle/RTL-LTR state — the gap is purely a layout/direction issue, never a currency/VAT leak.

## 9. Claude Lead Reconciliation

No disagreement, no asymmetry between markets. Both agents independently confirmed the identical shared mechanism (not two separate market-specific bugs) produces the same class of defect in either direction, with zero data/financial/security consequence either way — purely a page-direction/layout mismatch.

## 10. Required Verdict

**TEST ACCOUNT MARKET ROUTING: GAP FOUND**

## 11. Recommended Next Step

**Create TEST users and test immediately**, using explicit `/he`/`/en` entry points for each market. The routing gap does not need to block functional TEST validation — account isolation, content correctness, and currency/VAT are already proven robust — but should be tracked as its own separate, minimal fix (`PROFLOW_TODO.md` item 25) before claiming fully automatic market routing is complete.

**NOT AUTHORIZED by this audit.**

## Confirmations

No code changes. No Auth changes. No TEST user creation. No DB mutation. No Storage mutation. No Edge deploy. No Production mutation. No commit. No push. No deploy. No LIVE action. Pure source-reading throughout.

## Final Git State

`main` `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged.

## Six-File Continuity Ledger

| File | Status | Reason |
|---|---|---|
| `PROFLOW_PROJECT_CONTEXT.md` | **UPDATED** | New §24 item 12 recording the routing gap as a permanent Known Open Issue |
| `PROFLOW_ARCHITECTURE.md` | **UPDATED** | §3.2 extended with a "Known limitation" addendum documenting the post-login gap |
| `PROFLOW_HANDOFF.md` | **UPDATED** | New §18.DD entry appended; CURRENT RESUME STATE step-sequence extended with step (27) |
| `PROFLOW_TODO.md` | **UPDATED** | New backlog item 25 added; new dated status paragraph appended to "Current QA / Release Track" |
| `PROFLOW_CHAT_HANDOFF.md` | **UPDATED** | New §10.P summary added for ChatGPT |
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | **UPDATED** | Rewritten fresh for this task |

## Final Stop

STOP after the audit. Do not create users. Do not change routing. Do not change Auth. Do not touch TEST data. Do not touch Production. Do not commit/push/deploy. Wait for Owner + ChatGPT review.
