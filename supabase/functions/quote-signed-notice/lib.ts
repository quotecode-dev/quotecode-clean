// quote-signed-notice (Owner 2026-11-11, finding 18, option א + "מיד אחרי החתימה"): when a customer signs, ONE email goes to the business
// owner only - "<customer> signed quote <number>", with a link to the signed quote. The customer gets no email ("הלקוח יודע שהוא חתם").
// The customer page calls this right after its signature succeeded; the server itself checks that the quote IS signed, recently, and
// records the quote in quote_signed_owner_notices first, so a quote is announced once whatever calls it. Nothing about the quote is
// returned to the caller (the answer is the same for every id).
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// only a signature of the last two hours is announced (an old signed quote id never sends a late email)
export const FRESH_SIGNATURE_MS = 2 * 60 * 60 * 1000;
const SITE = 'https://www.tekango.com';

export type Market = 'IL' | 'INTERNATIONAL';
export type SignedFacts = {
  quoteId: string;
  quoteNumber: number | null;
  signedAt: string | null;
  clientName: string;
  market: Market;
};

export function parseRequest(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const id = (body as Record<string, unknown>).quote_id;
  return typeof id === 'string' && UUID_RE.test(id) ? id.toLowerCase() : null;
}

export function isFreshSignature(signedAt: string | null, now: number): boolean {
  const t = Date.parse(String(signedAt ?? ''));
  return Number.isFinite(t) && t <= now + 60_000 && now - t <= FRESH_SIGNATURE_MS;
}

// the market of the business (business_settings.country): Local / IL = Israel; everything else is the International market
export function marketOf(country: unknown): Market {
  const c = String(country ?? '').trim();
  return c === 'Local' || c === 'LCL' || c.toUpperCase() === 'IL' ? 'IL' : 'INTERNATIONAL';
}

// the same display as every other surface (send-quote-email: A<number>, else the first 8 characters of the id)
export function quoteNumberDisplay(n: number | null, id: string): string {
  return typeof n === 'number' && Number.isFinite(n) ? `A${n}` : `#${id.slice(0, 8)}`;
}

export const SENDER = {
  IL: { from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com' },
  INTERNATIONAL: { from: 'TEKANGO <info@tekango.com>', replyTo: 'info@tekango.com' },
} as const;

export function signedQuoteLink(f: Pick<SignedFacts, 'quoteId' | 'market'>): string {
  return f.market === 'IL' ? `${SITE}/public-quote/${f.quoteId}` : `${SITE}/en/public-quote/${f.quoteId}`;
}

const clean = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 120);

export function signedNoticeContent(f: SignedFacts): { subject: string; text: string } {
  const num = quoteNumberDisplay(f.quoteNumber, f.quoteId);
  const he = f.market === 'IL';
  const client = clean(f.clientName) || (he ? 'הלקוח' : 'Your customer');
  const link = signedQuoteLink(f);
  return he
    ? { subject: `${client} חתם על הצעה ${num}`,
        text: ['שלום,', '', `${client} חתם על הצעה ${num}.`, '', 'לצפייה בהצעה החתומה:', link, '', 'צוות TEKANGO'].join('\n') }
    : { subject: `${client} signed quote ${num}`,
        text: ['Hello,', '', `${client} signed quote ${num}.`, '', 'View the signed quote:', link, '', 'The TEKANGO team'].join('\n') };
}
