// The ONE database read of the Auth Send Email Hook (Option C, 2026-09-28): public.business_settings.country of the verified
// Auth user. No Deno globals / URL imports (vitest: marketLookup.test.js); index.ts injects supabase-js createClient.
//
// Trust boundary:
// - called only by handler.ts AFTER Standard Webhooks verification and planning; `userId` is the verified payload's user.id;
// - service-role access uses the existing Edge-function pattern already live in send-quote-email / get-public-quote /
//   send-trial-expiration-email: JSON.parse(SUPABASE_SECRET_KEYS).default (platform-provided; no new secret);
// - the query is exactly: business_settings, column `country` only, `user_id = <verified id>`, at most 2 rows (2 = enough to
//   detect an impossible duplicate without reading more); no other table, column or tenant;
// - errors are thrown WITHOUT the key, the id or the database message (the caller logs only a classification).

// Deliberately loose: it must accept supabase-js createClient (generic, overloaded) and the vitest fake alike.
// deno-lint-ignore no-explicit-any
export type CreateClient = (url: string, key: string, options?: any) => any;

type QueryResult = { data: unknown; error: unknown };

class LookupError extends Error {
  code: 'not_configured' | 'query_failed';
  constructor(code: 'not_configured' | 'query_failed') {
    super(`market lookup ${code}`);
    this.code = code;
  }
}

export function secretKeyFromEnv(env: (name: string) => string | undefined): string {
  try {
    const parsed = JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}');
    const key = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).default : undefined;
    return typeof key === 'string' ? key : '';
  } catch {
    return '';
  }
}

export function makeBusinessMarketLookup({ env, createClient }: { env: (name: string) => string | undefined; createClient: CreateClient }) {
  return async (userId: string, signal: AbortSignal): Promise<ReadonlyArray<{ country?: unknown }>> => {
    const supabaseUrl = env('SUPABASE_URL') ?? '';
    const secretKey = secretKeyFromEnv(env);
    if (!supabaseUrl || !secretKey) throw new LookupError('not_configured');
    const client = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const query = client.from('business_settings').select('country').eq('user_id', userId).limit(2).abortSignal(signal);
    let result: QueryResult;
    try {
      result = await query;
    } catch {
      throw new LookupError('query_failed');
    }
    if (!result || result.error || !Array.isArray(result.data)) throw new LookupError('query_failed');
    return (result.data as Array<Record<string, unknown>>).map((row) => ({ country: row?.country }));
  };
}
