// Standard Webhooks verification for the Auth Send Email Hook (Codex Post-LIVE Wave 1 blocker 2, 2026-09-27).
//
// Contract (standard-webhooks spec + its reference JS verifier, read 2026-09-27):
// - headers webhook-id / webhook-timestamp / webhook-signature;
// - signed content `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 keyed with the base64-decoded secret;
// - webhook-signature is a space-delimited list of `<version>,<base64 signature>`; symmetric signatures are `v1`
//   (`v1a` is asymmetric and not used by Supabase) - only `v1` entries are considered;
// - the timestamp must be within a tolerance of now in BOTH directions (reference verifier: 5 minutes);
// - signatures are compared in constant time.
// Supabase stores the hook secret as `v1,whsec_<base64>`; a bare `whsec_<base64>` is accepted too. Anything else is a
// configuration error, never "best effort".
//
// Pure (Web Crypto only, no Deno / network), so it runs identically under Deno and vitest.

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WebhookVerifyResult = { ok: true } | { ok: false; reason: string };

const TIMESTAMP_RE = /^\d{1,12}$/;
// Printable ASCII without spaces; the id is also used to build the Resend Idempotency-Key.
const WEBHOOK_ID_RE = /^[\x21-\x7e]{1,200}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function base64ToBytes(value: string): Uint8Array | null {
  if (!value || value.length % 4 !== 0 || !BASE64_RE.test(value)) return null;
  try {
    const bin = atob(value);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function parseHookSecret(secret: string): Uint8Array | null {
  const match = /^(?:v1,)?whsec_([A-Za-z0-9+/]+={0,2})$/.exec(String(secret ?? '').trim());
  if (!match) return null;
  const bytes = base64ToBytes(match[1]);
  return bytes && bytes.length > 0 ? bytes : null;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyStandardWebhook(input: {
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  rawBody: string;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}): Promise<WebhookVerifyResult> {
  const tolerance = input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS;
  const { id, timestamp, signatureHeader, rawBody } = input;

  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: 'missing_headers' };
  if (!WEBHOOK_ID_RE.test(id)) return { ok: false, reason: 'invalid_webhook_id' };
  if (!TIMESTAMP_RE.test(timestamp)) return { ok: false, reason: 'invalid_timestamp' };

  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts)) return { ok: false, reason: 'invalid_timestamp' };
  if (input.nowSeconds - ts > tolerance) return { ok: false, reason: 'timestamp_too_old' };
  if (ts > input.nowSeconds + tolerance) return { ok: false, reason: 'timestamp_too_new' };

  const secretBytes = parseHookSecret(input.secret);
  if (!secretBytes) return { ok: false, reason: 'invalid_secret_format' };

  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)),
  );

  let matched = false;
  for (const part of signatureHeader.split(' ')) {
    if (!part) continue;
    const comma = part.indexOf(',');
    if (comma < 0) continue;
    if (part.slice(0, comma) !== 'v1') continue;
    const candidate = base64ToBytes(part.slice(comma + 1));
    // Evaluate every v1 entry (no early exit) so timing does not depend on which entry matched.
    if (candidate && timingSafeEqual(candidate, expected)) matched = true;
  }
  return matched ? { ok: true } : { ok: false, reason: 'no_matching_v1_signature' };
}
