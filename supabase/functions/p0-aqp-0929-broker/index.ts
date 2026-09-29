// p0-aqp-0929-broker / index.ts - WIRING ONLY. All logic, checks and fixed endpoints live in policy.ts (pure, unit-tested).
// Zero remote imports: only relative modules and web-standard / Deno runtime globals.
//   - fetch for the Management API is pinned to the ONE fixed endpoint (pinnedFetch refuses any other URL);
//   - the GitHub JWKS is fetched from the ONE fixed URL (makeGithubJwksLoader); no key material is hard-coded;
//   - env: only the two allowlisted names can ever be read (ALLOWED_ENV); policy.ts asks for the deploy pins first and for the
//     DB token only after every check passed. SUPABASE_DB_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are never read;
//   - log records are constant event / reason codes produced by policy.ts (never tokens, bodies, SQL or rows).
import { createHandler, makeGithubJwksLoader, pinnedFetch, ALLOWED_ENV, GITHUB_JWKS_URL, MANAGEMENT_API_QUERY_URL } from './policy.ts';
import { PRODUCTION_BUNDLE_SQL, PRODUCTION_BUNDLE_SHA256, PRODUCTION_BUNDLE_META } from './bundle.ts';

const handler = createHandler({
  fetch: pinnedFetch((url, init) => fetch(url, init), MANAGEMENT_API_QUERY_URL),
  env: (name) => (ALLOWED_ENV.includes(name) ? Deno.env.get(name) : undefined),
  now: () => Date.now(),
  jwks: makeGithubJwksLoader(pinnedFetch((url, init) => fetch(url, init), GITHUB_JWKS_URL)),
  bundle: { PRODUCTION_BUNDLE_SQL, PRODUCTION_BUNDLE_SHA256, PRODUCTION_BUNDLE_META },
  log: (rec) => console.log(JSON.stringify({ fn: 'p0-aqp-0929-broker', ...rec })),
});

Deno.serve(handler);
