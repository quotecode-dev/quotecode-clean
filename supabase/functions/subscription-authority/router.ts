// subscription-authority - the request router (pure; index.ts is wiring only). CROSSCUT_CONTRACT §3.
//   POST {action:'output_notice', quoteId}                                                (user JWT; read-only)
//   POST {action:'authorize_output', quoteId, channel, idempotencyKey, expectedDigest}   (user JWT)
//   POST {action:'checkout_intent', planId, blocks?, idempotencyKey}                       (user JWT; billing code phase 'off')
//   POST {action:'checkout_status'}                  (user JWT; back from the payment page - the server pull; billing code phase 'off')
//   POST {action:'import_logo', dataBase64}                                                (user JWT)
//   POST .../subscription-authority/provider-event  (raw body; provider signature, NOT a user JWT; billing code phase 'off')
// `account_summary` is NOT a route: the client calls the RPC public.get_account_summary() directly (one parser: the shared
// contract's parseAccountSummary). The former GET /account-summary, /billing/*, /output/*, /assets/* paths are gone.
// The user id ALWAYS comes from the verified JWT; no body field ever names an account.
import { userFromRequest, importLogoRoute, type JwtVerifier, type Resp, type AssetSql, type AssetStorage, type LogoLimits } from './authority.ts';
import { authorizeOutputRoute, type OutputRouteDeps } from './outputRoute.ts';
import { outputNoticeRoute, type NoticeDeps } from './noticeRoute.ts';
import { checkoutIntentHandler, checkoutStatusHandler, providerWebhookHandler, type BillingPhase, type BillingProvider, type BillingSql } from './billing.ts';

export const MAX_BODY_BYTES = 6 * 1024 * 1024; // logo base64 upper bound (same operational bound as quote-presentation)
export const USER_ACTIONS = Object.freeze(['output_notice', 'authorize_output', 'checkout_intent', 'checkout_status', 'import_logo'] as const);

export type AuthorityDeps = {
  verifyJwt: JwtVerifier;
  output: OutputRouteDeps;
  notice: NoticeDeps;
  billing: { phase: BillingPhase; sql: BillingSql; provider: BillingProvider; now: () => number };
  logo: { readFreeIssuePhase(): Promise<string>; sql: AssetSql; storage: AssetStorage; decode(b64: unknown): { ok: true; bytes: Uint8Array } | { ok: false }; limits: LogoLimits };
};
type Headers = { get(name: string): string | null };
const err = (status: number, code: string): Resp => ({ status, body: { ok: false, code } });

export async function routeAuthorityRequest(deps: AuthorityDeps, req: { method: string; path: string; headers: Headers; rawBody: Uint8Array }): Promise<Resp> {
  if (req.method !== 'POST') return err(405, 'method_not_allowed');
  if (!(req.rawBody instanceof Uint8Array) || req.rawBody.length > MAX_BODY_BYTES) return err(413, 'payload_too_large');
  const route = req.path.replace(/^.*\/subscription-authority/, '') || '/';
  if (route === '/provider-event') {
    return providerWebhookHandler(deps.billing.phase, { sql: deps.billing.sql, provider: deps.billing.provider, now: deps.billing.now }, req.rawBody, req.headers);
  }
  if (route !== '/' && route !== '') return err(404, 'unknown_route');
  const userId = await userFromRequest(req.headers, deps.verifyJwt);
  if (!userId) return err(401, 'not_authenticated');
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(req.rawBody)); } catch { return err(400, 'invalid_request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return err(400, 'invalid_request');
  const action = (body as { action?: unknown }).action;
  switch (action) {
    case 'output_notice': return outputNoticeRoute(deps.notice, userId, body);
    case 'authorize_output': return authorizeOutputRoute(deps.output, userId, body);
    case 'checkout_intent': return checkoutIntentHandler(deps.billing.phase, { sql: deps.billing.sql, provider: deps.billing.provider }, userId, body);
    case 'checkout_status': return checkoutStatusHandler(deps.billing.phase, { sql: deps.billing.sql, provider: deps.billing.provider }, userId);
    case 'import_logo': return importLogoRoute(deps.logo, userId, body);
    default: return err(400, 'unknown_action'); // incl. 'account_summary' (RPC get_account_summary, not a route)
  }
}
