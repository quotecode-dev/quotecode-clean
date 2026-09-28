# Vercel Preview proof package — static-file vs rewrite precedence + root middleware (NOT EXECUTED — needs Owner authorization)

**Audience:** the Owner (authorization) and the executor.
**Why:** the only material assumption not provable locally is whether Vercel serves `dist/en/index.html` for `/en` before the `/(.*)` → `/index.html` rewrite in `vercel.json`, and whether the Edge middleware's 302 behaves as it does locally. A Vercel Preview deployment is a remote mutation → it is not performed without explicit authorization.

## Exact steps (Preview only, never Production)
1. Deploy the committed SEO branch head as a **Preview**, for example `vercel deploy` from `C:\tkseo-initial-html` (not `--prod`). Alternatively, push the branch only if the Owner prefers a Git-driven Preview; pushing is itself a separate authorization.
2. Raw, no JS, against the Preview URL `$P`:
   - `curl -s $P/en | grep -o '<link rel="canonical"[^>]*>'` → `https://www.tekango.com/en` (and the same for all 10 sitemap routes);
   - `curl -sI $P/en` → 200, `content-type: text/html`;
   - `curl -s $P/en/` (trailing slash) → the same document or a redirect to `/en`;
   - `curl -s $P/dashboard | grep -c 'rel="canonical"'` → 0 and `X-Robots-Tag: noindex, nofollow`.
3. Root:
   - `curl -sI $P/` → 302, `location: $P/en` or `/he` per the Preview request's geo;
   - `curl -sI -H 'cookie: proflow_lang=he' $P/` → `/he`;
   - `curl -sI "$P/?lang=en&x=1"` → `/en?lang=en&x=1`;
   - `cache-control: private, no-store`.
4. Run the same matrix scripts used locally (`after-fix-local-matrix.json` shape) with base = `$P`, and record the result next to this file.
5. **Pass criteria:** 10 / 10 PASS; root 302 per precedence; shell routes unchanged; no Production change.

## Note
Preview deployments may be protected by Vercel Authentication. Use the Owner's authenticated session or a protection-bypass token; never disable the protection.
