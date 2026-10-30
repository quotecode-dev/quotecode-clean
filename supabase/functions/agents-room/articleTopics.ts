// agents-room - article topic identity (Codex release 4, topic 4; unit-tested in articleTopics.test.ts).
// Owner console 2026-10-29 (typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"); migration 20261030300000. Decision 6:
//   * the same topic (Hebrew OR English, after normalization) as an article, a draft, a waiting proposal, an active claim or one of the
//     static guides = a duplicate - blocked;
//   * a similar topic (most of its meaningful words are in an existing one) = "possible duplicate" - approved only with a distinct focus;
//   * no extra AI call: the comparison is deterministic, over the WHOLE inventory.
// Generic words (quote, price list, business, guide) never make two topics similar by themselves - the trade, the audience, the pricing
// method and the focus are what distinguish them.

// the four static guides (src/shared/publicArticles.js, ARTICLES[slug].he.h1 / .en.h1) - equality-tested in articleTopics.test.ts
export const STATIC_ARTICLES: readonly { slug: string; he: string; en: string }[] = Object.freeze([
  { slug: 'how-to-write-a-quote-clients-approve', he: 'איך כותבים הצעת מחיר שהלקוח מאשר', en: 'How to Write a Quote Your Clients Approve' },
  { slug: 'renovation-contractor-quote', he: 'הצעת מחיר של קבלן שיפוצים: מה חייב להופיע בה', en: 'Renovation Contractor Quotes: What to Include' },
  { slug: 'quote-by-measurements', he: 'הצעת מחיר לפי מידות: מטר רבוע ומטר אורך', en: 'Quoting by Measurements: Square Meters and Linear Meters' },
  { slug: 'import-pricing-currency-conversion', he: 'תמחור יבוא עם המרת מטבעות', en: 'Import Pricing with Currency Conversion' },
]);

export type Lang = 'he' | 'en';
export type Inventory = {
  articles: { id: string; slug: string; status: 'draft' | 'published'; market?: string; he: string | null; en: string | null; action_id: string | null }[];
  proposals: { id: string; he: string | null; en: string | null; focus?: string | null }[];
  claims: { ref_id: string; kind: 'topic' | 'title'; lang: Lang; norm: string; display: string; focus?: string | null; focus_norm?: string | null }[];
  slugs: string[];
};
export type TopicRef = { kind: 'static' | 'published' | 'draft' | 'proposal' | 'claim'; lang: Lang; title: string; slug?: string; id?: string };
export type TopicCheck = { verdict: 'distinct' | 'duplicate' | 'similar'; match?: TopicRef };

/** case, Unicode forms, niqqud / cantillation, geresh / gershayim / quotes, punctuation and spacing do not make a topic different */
export function normTopic(s: unknown): string {
  return String(s ?? '').normalize('NFKC').toLowerCase()
    .replace(/[‎‏⁦-⁩]/g, '')
    .replace(/־/g, ' ') // maqaf = a hyphen
    .replace(/[֑-ֽֿ-ׇ]/g, '') // niqqud and cantillation marks
    .replace(/['"`׳״‘’“”]/g, '') // מע״מ = מע"מ = מעמ
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const EN_STOP = new Set(['a', 'an', 'the', 'to', 'of', 'for', 'and', 'or', 'in', 'on', 'with', 'your', 'you', 'how', 'what', 'why', 'when', 'is', 'are', 'do', 'does', 'by', 'from', 'at', 'as', 'it', 'its', 'this', 'that', 'into', 'without', 'vs']);
const HE_STOP = new Set(['של', 'את', 'על', 'עם', 'איך', 'מה', 'למה', 'כדי', 'או', 'גם', 'זה', 'זו', 'לפי', 'כל', 'בה', 'בו', 'שלא', 'בלי']);
// generic for every TEKANGO guide - never a reason for similarity on their own
// generic for every TEKANGO guide (stems: price / pricing -> pric, template -> templat) - the trade, the audience and the focus decide
const GENERIC = new Set(['quot', 'quotation', 'business', 'small', 'guid', 'writ', 'tekango', 'pric', 'list', 'templat', 'fre',
  'הצעת', 'הצעות', 'הצעה', 'מחיר', 'מחירים', 'מחירון', 'תמחור', 'מדריך', 'עסקים', 'עסק', 'עסקי', 'כותבים', 'כתיבת', 'תבנית', 'חינם', 'קטן', 'קטנים']);
// a Hebrew word with one prefix letter (ו ה ב ל מ ש כ) is the same word when at least 4 letters remain: לשיפוצים = שיפוצים, בהצעת = הצעת
// (משקל is not שקל, מטבע is not טבע)
const PREFIX = 'והבלמשכ';
const stemEn = (w: string) => {
  let s = w;
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
};
// Hebrew: final letters as regular ones, and the plural / construct endings (ים, ות, י) - שיפוץ = שיפוצים, קבלן = קבלני, קטן = קטנים
const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const stemHe = (w: string) => {
  let s = w.replace(/[ךםןףץ]/g, (c) => FINALS[c]);
  if (s.length > 4 && /(ימ|ות)$/.test(s)) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('י')) s = s.slice(0, -1);
  return s;
};
const stem = (w: string) => (/^[a-z]+$/.test(w) ? stemEn(w) : /^[א-ת]+$/.test(w) ? stemHe(w) : w);
const unprefixed = (t: string) => (t.length > 4 && PREFIX.includes(t[0]) ? t.slice(1) : null);
export function topicWords(s: unknown, keepGeneric = false): string[] {
  const out = new Set<string>();
  for (const w of normTopic(s).split(' ')) {
    if (!w || EN_STOP.has(w) || HE_STOP.has(w)) continue;
    const t = stem(w);
    const bare = PREFIX.includes(w[0]) && w.length > 3 ? w.slice(1) : null; // לעסקים -> עסקים
    const generic = [w, t, bare, bare && stem(bare)].some((x) => !!x && GENERIC.has(x));
    if (keepGeneric || !generic) out.add(t);
  }
  return [...out];
}
const sameWord = (a: string, b: string) => a === b || unprefixed(a) === b || unprefixed(b) === a;
export const SIMILAR_AT = 0.8;
/** the share of the shorter topic's meaningful words found in the other (0..1); two topics made only of the generic words are compared
 *  on those words (a guide about "writing quotes for small businesses" repeats the guide about writing a quote) */
export function similarity(a: unknown, b: unknown): number {
  let A = topicWords(a); let B = topicWords(b);
  const genericOnly = !A.length && !B.length;
  if (genericOnly) { A = topicWords(a, true); B = topicWords(b, true); }
  if (!A.length || !B.length) return 0;
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  // generic-only topics are also matched on a shared beginning (הצע / הצעת) - their few words carry the whole subject
  const loose = (w: string, x: string) => genericOnly && Math.min(w.length, x.length) >= 3 && Math.abs(w.length - x.length) <= 2 && (w.startsWith(x) || x.startsWith(w));
  return small.filter((w) => big.some((x) => sameWord(w, x) || loose(w, x))).length / small.length;
}

type Entry = TopicRef & { text: string; norm: string };
export function inventoryEntries(inv: Inventory, exclude: { actionId?: string | null; articleId?: string | null } = {}): Entry[] {
  const out: Entry[] = [];
  const add = (e: TopicRef, text: string | null | undefined, norm?: string) => { const n = norm ?? normTopic(text); if (n) out.push({ ...e, text: String(text ?? ''), norm: n }); };
  for (const s of STATIC_ARTICLES) for (const lang of ['he', 'en'] as const) add({ kind: 'static', lang, title: s[lang], slug: s.slug }, s[lang]);
  for (const a of inv.articles) {
    if (a.id === exclude.articleId || (exclude.actionId && a.action_id === exclude.actionId)) continue;
    for (const lang of ['he', 'en'] as const) add({ kind: a.status === 'published' ? 'published' : 'draft', lang, title: String(a[lang] ?? ''), slug: a.slug, id: a.id }, a[lang]);
  }
  for (const p of inv.proposals) {
    if (p.id === exclude.actionId) continue;
    for (const lang of ['he', 'en'] as const) add({ kind: 'proposal', lang, title: String(p[lang] ?? ''), id: p.id }, p[lang]);
  }
  for (const c of inv.claims) {
    if (c.ref_id === exclude.actionId) continue;
    add({ kind: 'claim', lang: c.lang, title: c.display, id: c.ref_id }, c.display, c.norm);
  }
  return out;
}

/** a candidate topic or heading against the whole inventory: duplicate (either language, exact) > similar > distinct */
export function checkTopic(inv: Inventory, candidate: { he: string; en: string }, exclude: { actionId?: string | null; articleId?: string | null } = {}): TopicCheck {
  const entries = inventoryEntries(inv, exclude);
  const norms = { he: normTopic(candidate.he), en: normTopic(candidate.en) };
  const strip = ({ text: _t, norm: _n, ...ref }: Entry): TopicRef => ref;
  const exact = entries.find((e) => norms[e.lang] && e.norm === norms[e.lang]);
  if (exact) return { verdict: 'duplicate', match: strip(exact) };
  let best: { e: Entry; s: number } | null = null;
  for (const e of entries) {
    const s = similarity(candidate[e.lang], e.text);
    if (s >= SIMILAR_AT && (!best || s > best.s)) best = { e, s };
  }
  return best ? { verdict: 'similar', match: strip(best.e) } : { verdict: 'distinct' };
}

/** every existing topic / heading, for the manager's existing AI call (bounded; the deterministic check above still sees everything) */
export const TOPIC_CONTEXT_MAX = 300;
export function topicContext(inv: Inventory): { topics: { he: string; en: string }[]; total: number } {
  const fixed = STATIC_ARTICLES.map((s) => ({ he: s.he, en: s.en })); // the static guides are always sent
  // Codex release 4 (spec 4): + the topics / headings flows hold (claims), each Hebrew + English pair once
  const claimed = new Map<string, { he: string; en: string }>();
  for (const c of inv.claims) { const k = `${c.ref_id}|${c.kind}`; const e = claimed.get(k) ?? { he: '', en: '' }; e[c.lang] = c.display; claimed.set(k, e); }
  const seen = new Set<string>();
  const rest: { he: string; en: string }[] = [
    ...inv.articles.map((a) => ({ he: String(a.he ?? ''), en: String(a.en ?? '') })),
    ...inv.proposals.map((p) => ({ he: String(p.he ?? ''), en: String(p.en ?? '') })),
    ...claimed.values(),
  ].filter((t) => { const k = `${normTopic(t.he)}|${normTopic(t.en)}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { topics: [...fixed, ...rest.slice(-(TOPIC_CONTEXT_MAX - fixed.length))], total: fixed.length + rest.length };
}

/** decision 6: the same distinct focus (normalized) already given to another article flow is a duplicate too */
export function checkFocus(inv: Inventory, focus: string, exclude: { actionId?: string | null } = {}): TopicRef | null {
  const n = normTopic(focus);
  if (!n) return null;
  const c = inv.claims.find((x) => x.ref_id !== exclude.actionId && x.kind === 'topic' && (x.focus_norm ?? normTopic(x.focus)) === n);
  if (c) return { kind: 'claim', lang: c.lang, title: c.display, id: c.ref_id };
  const p = inv.proposals.find((x) => x.id !== exclude.actionId && normTopic(x.focus) === n);
  return p ? { kind: 'proposal', lang: 'he', title: String(p.he ?? ''), id: p.id } : null;
}
export const FOCUS_MIN = 10;
export const cleanFocus = (s: unknown) => String(s ?? '').replace(/[<>]/g, '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
