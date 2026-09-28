# Codex review package — Google indexing: route-specific initial HTML + server-side root locale (2026-09-28)

**Audience:** the independent Codex reviewer. **Codex review: NOT RUN** (needs separate Owner authorization).
**Branch / worktree:** `tekango-seo-initial-html-2026-09-28` in `C:\tkseo-initial-html` (the one Owner-authorized worktree).
- **Base:** Wave 1 candidate `614d8a338f1cbb2720083327f7bb67d9f02f8a09` (unchanged; this branch sits on top of it).
- **Not pushed.** No Production, no Vercel Preview, no Search Console mutation.

## 1. Defect (reproduced on LIVE, `live-raw-html-before-fix.json`, `live-rendered-post-js.json`)
- **Search Console (Owner, 2026-09-28):** `/en` = "Duplicate, Google chose different canonical than user"; user canonical `/en`, Google canonical `/`.
- **Raw HTML (no JS):** all 11 sitemap routes served ONE identical `index.html` (sha `dcbc82f9…`): canonical `https://www.tekango.com/`, `lang="en" dir="ltr"` (also on `/he`), the homepage title, and an empty `#root`.
- **After JS:** `setSeoMeta()` fixed each page. But `/` rendered the landing in the geo locale under canonical `/`, i.e. English for a US crawler = a duplicate of `/en`.

## 2. Change set (see `git show` of the commit)
| File | Why |
|---|---|
| `src/shared/publicSeoRoutes.js` (new) | THE single public route / SEO authority (path, page, lang, title, description, hreflang, JSON-LD). The values were moved verbatim from the pages' former inline `setSeoMeta` objects. |
| `LandingLocal/LandingGlobal/PublicTools/PublicToolsEn/Contact/Privacy/Terms` | `setSeoMeta(publicSeo(...))` from the table. The landings always declare `/he` / `/en` (the former "bare `/` canonical to itself" rule is superseded by locked §55.11). |
| `src/entry-prerender.jsx` (new) | SSR entry importing ONLY the public page components; `renderToString` under `StaticRouter`. Not imported by `main.jsx`. |
| `scripts/publicRouteHtml.mjs` (new) | Pure compose / inspect / validate of one route's initial HTML (no JS execution). |
| `scripts/prerender-public-routes.mjs` (new) + `vite.config.js` | A Vite plugin (`closeBundle`) that runs after every client build, so it runs under `vite build` OR `npm run build`. It performs an SSR build → writes `dist/<route>/index.html` for every sitemap `<loc>` → validates → **fails the build** on any violation, on sitemap ↔ table drift, or on a private route in the sitemap. |
| `index.html` (SPA shell) | Drops the homepage canonical / hreflang / og:url (the shell is now served only to non-prerendered routes). |
| `public/sitemap.xml` | `/` removed from `<loc>` (it is a redirect now); x-default `/` kept; lastmod 2026-09-28. |
| `middleware.ts` | `/` → **302** to exactly `/he` or `/en`, with the query kept, `Cache-Control: private, no-store`, `Vary: Cookie, Accept-Language`.<br>Precedence (= `main.jsx`): `?lang` → `proflow_lang` cookie → geo (IL→he) → Accept-Language (he/iw) → en.<br>Legacy-host 308 first (unchanged). Geo cookie still written. |
| `src/main.jsx` | Mirrors the existing `localStorage.proflow_lang` into a `proflow_lang` cookie (public UI only). |
| `AppLocal.jsx` / `AppGlobal.jsx` | `/he` and `/en` apply the same Auth-callback fallback as `/` (recovery / error / signup fragment survives the 302). |
| Tests | `src/seoInitialHtml.test.jsx` (new, 33), `middleware.test.ts` (+17), `AppShellRoutes.test.jsx` (+4). `productTruthInteractiveBaseline.json` +2 zero-gap entries (generator). |

## 3. Verification (local)
- **Build** `vite build --mode production`: PASS. The prerender gate reports 10 / 10 routes ok.
- **Raw served matrix** (`after-fix-local-matrix.json`), through a local server that serves static files before the SPA rewrite and runs the real `middleware.ts` on `/`: **10 / 10 PASS**.
  - Canonical = self, `lang` / `dir`, title, description, hreflang, robots, `og:url`, ≤ 1 JSON-LD, no `<noscript>`.
  - `#root` text 476–4773 chars; HE pages predominantly Hebrew, EN pages 0 Hebrew letters in visible text.
  - Local landing ₪ only; International landing no ILS.
- **Root:** IL → `/he`; US → `/en`; IL + pref en → `/en`; US + pref he → `/he`; `?lang=he` beats all; no geo + Accept-Language he → `/he`; nothing → `/en`; the Auth error query is kept. Always 302, `private, no-store`.
- **Hydrated** (headless Chromium, `after-fix-hydrated/`): the first delivered document is already in the right locale (HE 3015 Hebrew letters in `#root` before JS); after JS, canonical / hreflang / title / `lang` / `dir` are unchanged and correct.
  - 0 page / console errors; 390 px without horizontal overflow; client navigation landing → privacy correct in both locales.
  - `/dashboard?lang=he|en` → login screen, `noindex, nofollow`, no canonical.
- **Tests / quality:** targeted 119 / 119; full suite (see the commit evidence); eslint 0 errors / 3 pre-existing warnings; `git diff --check` clean.
- **Disclosed, not a defect:** the EN landing / contact markup contains Hebrew only inside pre-existing inline `<style>` CSS comments (not visible content; identical in today's client DOM).

## 4. Please verify
1. **Vercel serving:** that Vercel serves `dist/en/index.html` for `/en` (no trailing slash) BEFORE the `/(.*)` → `/index.html` rewrite. **Not proven** — it needs a Vercel Preview (`VERCEL_PREVIEW_PROOF.md`).
2. The middleware 302 semantics and caching (`private, no-store`, `Vary`): nothing shared between visitors; no loop; legacy 308 first.
3. The `proflow_lang` cookie is public UI only — no path from it to `business_settings.country`, `signup_market`, currency or billing.
4. The Auth callback fragment across the 302 → the `/he` / `/en` fallback (the Supabase `SITE_URL` fallback lands on `/`).
5. Market separation of the generated HTML (HE Local / ILS, EN International / no ILS), and `x-default` → a redirecting `/` (the Google-supported pattern).
6. The gate strength: the negative controls in `seoInitialHtml.test.jsx` (the live-shape document fails; wrong-locale markup fails; USD in the Local landing fails).
7. **Residual:** a returning visitor whose preference exists only in `localStorage` from BEFORE this release gets geo / Accept-Language once, until `main.jsx` writes the cookie on their next page load.

## 4a. Favicon option A (Owner-approved; commit `06f4ff862877965c2862706e96a145f0501ba72d`)
- **What:** the existing 512 master symbol, cropped to its own bbox and scaled uniformly to width = size − 1 px (0.5 px margin each side), 8× supersampled and centered.
  - No clipping: the solid bbox stays inside the canvas; the edge columns are anti-alias only (max α 31 / 55 / 94 / 111).
  - No distortion (h / w 0.823 kept) and no colour / geometry / wordmark change.
- **Linear gain:** 32 px +6.7 %; 64 px +10.3 %; 192 px +12.9 %; 512 px +13.3 %. Area fill: 70 / 68 / 65 / 64 % → 81–83 %.
- **Why not +20–30 %:** the symbol is wide and was already 88–94 % of the width.
- **Evidence:** `favicon-option-a/` (the before files, `favicon-occupancy.json`, `favicon-before-after-sheet.png`).
- **Gates:** build (prerender 10 / 10), full suite 161 / 4499, eslint 0 errors, `git diff --check`, asset-completeness PASS.

## 4b. Vercel Preview proof — PENDING (blocked in the Claude session)
- The Preview deployment was blocked by the Claude Code session's safety policy ("create public surface"); it was not attempted another way.
- The exact Owner-run command + read-only verifiers are in `VERCEL_PREVIEW_PROOF.md`.
- **Until run, "Vercel serves `dist/<route>/index.html` before the `/(.*)` rewrite" and "the Edge 302 on Vercel" remain UNPROVEN.**

## 5. Requested verdict
`CODEX SEO INITIAL-HTML REVIEW: PASS / FAIL`, with blockers as file:line and "NEW BLOCKING FINDINGS: <n>".
