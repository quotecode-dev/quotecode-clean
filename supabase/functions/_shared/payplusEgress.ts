// Owner console 2026-10-23 ("תבדוק, אני לא רוצה להשאיר דברים פתוחים" -> "כן"): PayPlus accepts the API keys only from approved IP
// addresses (the account's IP check stays ON), and Supabase Edge Functions have no fixed outbound address (Supabase docs: "Supabase Edge
// Functions lack static or stable egress IP addresses"; the recommended fix is an outbound proxy with a static IP). Every PayPlus call
// therefore goes through the fixed-IP relay named by the Function secret PAYPLUS_PROXY_URL (http(s)://user:password@host:port, Fixie).
// HTTPS stays encrypted end to end (a CONNECT tunnel): the relay never sees the keys or the data.
//   * no secret                -> the call goes direct, exactly as before ('direct');
//   * a secret that is not a valid http(s) URL -> every PayPlus call fails with 'relay_misconfigured' (never a silent direct call that
//     PayPlus would refuse anyway, or that would bypass the relay unnoticed).
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type ProxyOptions = { url: string; basicAuth?: { username: string; password: string } };
type HttpClient = { close(): void };
type CreateClient = (o: { proxy: ProxyOptions }) => HttpClient;

/** the relay URL -> Deno's proxy options (credentials separated), or null when it is not a usable http(s) URL */
export function proxyOptions(raw: string | undefined): ProxyOptions | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  let u: URL;
  try { u = new URL(v); } catch { return null; }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return null;
  // Codex R-05: a malformed percent escape in the credentials is a misconfiguration (null -> relay_misconfigured), never a throw
  let username: string; let password: string;
  try { username = decodeURIComponent(u.username); password = decodeURIComponent(u.password); } catch { return null; }
  const port = u.port || (u.protocol === 'http:' ? '80' : '443'); // the default port is written out (the URL parser drops it)
  return { url: `${u.protocol}//${u.hostname}:${port}`, ...(username ? { basicAuth: { username, password } } : {}) };
}

export type PayPlusEgress = { fetch: FetchLike; via: 'relay' | 'direct' | 'relay_misconfigured'; close: () => void };

const denoCreate: CreateClient = (o) => (Deno as unknown as { createHttpClient: CreateClient }).createHttpClient(o);

/** the fetch every PayPlus call uses in this invocation; close() when the request is done */
export function payplusEgress(secret: string | undefined, create: CreateClient = denoCreate, base: FetchLike = (u, i) => fetch(u, i)): PayPlusEgress {
  if (!(secret ?? '').trim()) return { fetch: base, via: 'direct', close: () => {} };
  const opts = proxyOptions(secret);
  if (!opts) return { fetch: () => Promise.reject(new Error('relay_misconfigured')), via: 'relay_misconfigured', close: () => {} };
  let client: HttpClient | null = null;
  return {
    via: 'relay',
    fetch: (u, i) => {
      client ??= create({ proxy: opts });
      return base(u, { ...(i ?? {}), client } as RequestInit);
    },
    close: () => { try { client?.close(); } catch { /* already closed */ } client = null; },
  };
}
