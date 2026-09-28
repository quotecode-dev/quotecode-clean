# Vercel Preview proof package — static-file vs rewrite precedence + root middleware

**Audience:** the Owner (the runner) and the reviewer.
**Status:** EXECUTED 2026-09-28 — Preview `dpl_GYxMSNu5M7P89nFq97R5SqjnJHfX` (https://quotecode-fk2uq4s3e-quote-code.vercel.app), verified through the Owner's signed-in Vercel SSO session (protection kept ON, no bypass secret created). Results: `CODEX_SEO_INITIAL_HTML_REVIEW_PACKAGE.md` §4b and `preview-*.json`. The first in-session deploy attempt had been blocked by the session safety policy; the Owner then explicitly authorized it.
**Why it matters:** the only material assumption not provable locally is whether Vercel serves `dist/en/index.html` for `/en` before the `/(.*)` → `/index.html` rewrite in `vercel.json`, and whether the Edge middleware's 302 behaves as it does locally.

## 1. Deploy (Owner, host PC, PowerShell) — Preview ONLY, never `--prod`
```powershell
Set-Location C:\tkseo-initial-html
git status --porcelain            # must print nothing
$envf = 'C:\Users\sales\Documents\YoutubeChanel\WebSite\quotecode-saas\.env.localtest.local'
$url = ((Get-Content $envf | Select-String '^\s*VITE_SUPABASE_URL\s*=').Line -split '=',2)[1].Trim().Trim('"')
$key = ((Get-Content $envf | Select-String '^\s*VITE_SUPABASE_ANON_KEY\s*=').Line -split '=',2)[1].Trim().Trim('"')
if ($url -notmatch 'ljfizgrdyzxddswcedwr') { throw 'not the TEST project' }
$env:VERCEL_ORG_ID = 'team_TN3slHGuDLbo1lN8v6Opyvrq'; $env:VERCEL_PROJECT_ID = 'prj_HvehU5zecZmk8JoYPYmyepkj59AI'   # the existing project link (C:\tkrc-rb\.vercel)
& "$env:LOCALAPPDATA\npm-cache\_npx\69f9afb961c37556\node_modules\.bin\vercel.cmd" deploy --target preview --yes --build-env "VITE_SUPABASE_URL=$url" --build-env "VITE_SUPABASE_ANON_KEY=$key"
```
- The build env points the Preview at Supabase **TEST** (public URL / anon key), never at the Production DB.
- Crons do not run on Preview deployments.
- The printed `https://…vercel.app` URL is the Preview.
- If the Preview is protected (Vercel Authentication), create a protection-bypass token for automation in the project settings. Do NOT disable protection.

## 2. Verify (Claude or Owner; read-only)
```powershell
$env:PREVIEW_BYPASS = '<bypass token, if protected>'
node <scratchpad>\preview-verify.mjs https://<preview>.vercel.app <evidence>\preview-matrix.json
$env:PROOF_BASE = 'https://<preview>.vercel.app'; node <scratchpad>\seo-hydrated-proof.mjs <evidence>\preview-hydrated
```
- **`preview-verify.mjs`:** every sitemap route (re-derived from the Preview's own `/sitemap.xml`) is validated WITHOUT JS by the build's own validator (canonical = self, `lang` / `dir`, title, description, hreflang, robots, content, market separation).
  - **root `/`:** 302 to exactly `/he` / `/en`; preference cookie; `?lang`; query kept; empty body; `private, no-store`.
  - **private / app routes:** `/dashboard`, `/ai-logs`, public quotes, aliases → the shell (no prerender), `X-Robots-Tag` kept.
- **`seo-hydrated-proof.mjs`:** real Chromium, HE / EN desktop + 390 px, canonical / hreflang after JS, first HTML already in the right locale, navigation to a legal page, console errors.
- **Geo:** Vercel sets the country from the caller's IP (this host = IL → expect `/he` without cookie / `?lang`). A US-geo cell cannot be forced from this host → report it as PARTIAL, not fabricated.

## 3. Pass criteria
- all sitemap routes PASS;
- root 302 per precedence;
- the shell routes unchanged;
- no Production change.

## 4. Cleanup
The Preview can stay (it is not aliased to any domain) or be removed with `vercel remove <url>` after the Codex review — an Owner decision.
