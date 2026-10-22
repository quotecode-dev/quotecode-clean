// TEKANGO subscription authority - Edge entry. WIRING ONLY: routing lives in router.ts, handlers in outputRoute.ts /
// billing.ts / authority.ts (all unit-tested), the output saga is the adopted prep orchestrator in authorizeOutput.ts
// (byte-identical to subscriptions-prep/server/authorizeQuoteOutput.ts, pinned by a parity test), the I/O adapters are in
// adapters.ts and the environment / supabase-js live only in wiring.ts.
// NOT deployed: deploying any Edge function needs a separate authorization.
// Routes (CROSSCUT §3): POST {action: output_notice | authorize_output | checkout_intent | import_logo} with a user JWT, and
// POST .../provider-event for verified provider webhooks. The former path routes GET /account-summary, /billing/*,
// /output/* and /assets/* no longer exist (account summary = the RPC get_account_summary, called by the client directly).
import { routeAuthorityRequest, MAX_BODY_BYTES } from './router.ts';
import { buildAuthorityDeps } from './wiring.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (r: { status: number; body: Record<string, unknown> }) =>
  new Response(JSON.stringify(r.body), { status: r.status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function readCapped(req: Request): Promise<Uint8Array | null> {
  if (Number(req.headers.get('content-length') || '0') > MAX_BODY_BYTES) return null;
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

const deps = buildAuthorityDeps();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!deps) return json({ status: 503, body: { ok: false, code: 'server_misconfigured' } });
  try {
    const rawBody = await readCapped(req);
    if (!rawBody) return json({ status: 413, body: { ok: false, code: 'payload_too_large' } });
    return json(await routeAuthorityRequest(deps, { method: req.method, path: new URL(req.url).pathname, headers: req.headers, rawBody }));
  } catch {
    return json({ status: 503, body: { ok: false, code: 'unavailable' } }); // no detail, no token, no body is ever logged
  }
});
