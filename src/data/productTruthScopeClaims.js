// PRODUCT TRUTH - STRUCTURAL SCOPE / POLARITY MODEL (Finding 3, structural closure).
//
// WHY THIS FILE EXISTS. The first two Finding 3 rounds attributed a SCOPE to individual cue TOKENS using windows over a
// clause list that was cut only at commas / semicolons / a few contrast words. Codex's break-tests then found the model,
// not the phrases, was wrong: (a) clause boundaries were incomplete (colon, em dash, en dash, parentheses were not
// boundaries, so scope BLED across independent clauses); (b) the exclusivity wording was a short list (`בכל מקום|בכולם`, and
// a `(?:ל|מ)-?` prefix that "מלבד TEKANGO" does not have), so "available on every platform except TEKANGO" escaped.
//
// THE MODEL (no per-sentence exceptions):
//   1. SEGMENTATION by boundary CATEGORIES - punctuation (, ; : - dashes, parentheses), sentence ends, CONTRAST words (but /
//      though / although / however / while / whereas / yet / unless / despite; HE אבל / אך / אולם / אלא / למרות / אף ש / בעוד /
//      ואילו / אמנם) and SOFT COORDINATORS (and / or / וגם) - the latter only when BOTH sides carry their own availability cue,
//      so "available in other products and in TEKANGO" stays one clause while "unavailable elsewhere and available in TEKANGO"
//      splits. Exception words (except / other than / מלבד / חוץ מ- / פרט ל- / למעט) are NOT boundaries: they are constructs.
//   2. Every clause becomes an explicit CLAIM object { polarity, scope, qualifiers, weak, span, text }:
//        polarity  positive | negative           (unknown-polarity clauses make no claim)
//        scope     tekango | external | both | implicit-tekango
//        qualifiers  exclusive | exception | universal | both-scopes | interjection
//      Scope comes from the scope phrases INSIDE THE CLAUSE ONLY (so it can never bleed): a TEKANGO mention => tekango; only
//      external phrases (elsewhere, outside TEKANGO, other products/platforms/systems/apps/tools/services, מוצרים אחרים, מחוץ
//      ל-TEKANGO ...) => external; both => both; none => implicit-tekango.
//   3. EXCLUSIVITY is a construct over the clause polarity p, independent of the noun:
//        "<p> everywhere / on every X EXCEPT TEKANGO"  =>  external p  +  TEKANGO not-p     (HE: בכל X מלבד / חוץ מ- / פרט ל- / למעט TEKANGO)
//        "<positive> ONLY outside TEKANGO / elsewhere / in other X"  =>  external positive + TEKANGO negative   (HE: רק / אך ורק / בלבד)
//      so "unavailable everywhere except TEKANGO" correctly means TEKANGO positive.
//   4. RESOLUTION - what does the response claim about availability IN TEKANGO? Only tekango / both / implicit-tekango claims
//      count; external claims never prove TEKANGO availability; an explicit TEKANGO claim outranks a generic one because
//      generic external claims are simply not TEKANGO claims. Resolution is a SET operation over claims - clause ORDER cannot
//      change it ("TEKANGO lacks it - elsewhere it is available" == "Elsewhere it is available - TEKANGO lacks it").
//      A weak interjection ("Yes", "כן") is dropped whenever the sentence carries any strong claim.
//
// Cue detection (what counts as an affirm / deny cue, account-directed negation, negation look-back) is injected by the caller
// (productTruthCapabilityPolarity.js) so this module owns only segmentation, scope, exclusivity and resolution.

const EN_NOUN = '(?:products?|tools?|apps?|applications?|software|systems?|platforms?|programs?|editors?|solutions?|services?|vendors?|competitors?|packages?|suites?|engines?|environments?|sites?|websites?|providers?|brands?)';
const EN_INTERNAL = '(?:than|plans?|tiers?|users?|accounts?|roles?|quotes?|clients?|customers?|words?|things?|ways?|cases?|features?|capabilit\\w*|options?|settings?)';
const HE_INTERNAL = '(?:תוכנית|תוכניות|משתמשים|חשבונות|חשבון|הצעות|לקוחות|מילים|דברים|אפשרויות|הגדרות|יכולות|תפקידים)';
const HE_NOUN = '(?:מוצר|כלי|כלים|אפליקציה|אפליקציות|תוכנה|תוכנות|מערכת|מערכות|פלטפורמה|פלטפורמות|עורך|עורכים|שירות|שירותים|פתרון|פתרונות|מקום|מקומות|ספק|ספקים|אתר|אתרים|מתחרה|מתחרים|סביבה|סביבות|חבילה|חבילות)';

export const SCOPE_MODEL = Object.freeze({
  en: {
    // boundary CATEGORIES: punctuation (comma, semicolon, colon, dashes, parentheses, slash, pipe, bullet, arrow, ellipsis)
    punctuation: /[,;:—–()|•·→…]|\.{2,}|=>|->|\s[-‐‑/]\s|\s\/|\/\s/g,
    contrast: /\b(?:but|however|though|although|whereas|whilst|while|yet|unless|despite|even\s+though|and\s+yet|nevertheless|nonetheless)\b/gi,
    coordinator: /\b(?:and|or|plus|as\s+well\s+as)\b/gi,
    // scope phrases
    external: [
      /\belsewhere\b/gi,
      /\b(?:outside|beyond)\s+(?:of\s+)?(?:TEKANGO|the\s+(?:app|product|system|platform))\b/gi,
      new RegExp(`\\b(?:other|another|different|competing|rival|third[- ]party|alternative|external)\\s+(?:\\w+\\s+)?${EN_NOUN}\\b`, 'gi'),
      // generic form: the marker word + ANY following noun, so unseen nouns (spreadsheets, browsers, CRMs ...) are external too;
      // "other than" is an exception word and TEKANGO-internal nouns (plans, users, accounts, roles ...) are excluded
      new RegExp(`\\b(?:other|another|different|competing|rival|third[- ]party|alternative|external)\\s+(?!(?:than|plans?|tiers?|users?|accounts?|roles?|quotes?|clients?|customers?|words?|things?|ways?|cases?|features?|capabilit\\w*|options?|settings?)\\b)[A-Za-z][\\w-]*`, 'gi'),
      // quantified external subjects: "most / many / some / several ... <ANY noun>" (unseen nouns too), never a TEKANGO-internal noun
      new RegExp(`\\b(?:most|many|some|several|numerous|various|plenty\\s+of|a\\s+few)\\s+(?:other\\s+)?(?!${EN_INTERNAL}\\b)[A-Za-z][\\w-]*`, 'gi'),
      /\b(?:competitors?|rivals?|the\s+competition)\b/gi,
      /\bother\s+places\b/gi,
    ],
    tekango: [/\bTEKANGO\b/g, /\bin\s+(?:this|our)\s+(?:app|product|system|platform|editor)\b/gi],
    // "<..> EXCEPT TEKANGO": an exception object, independent of what precedes it
    exception: [
      /\b(?:except|other\s+than|apart\s+from|aside\s+from|besides|excluding|save\s+for|barring)(?:\s+(?:for|in|within|on|inside))?\s+TEKANGO\b/gi,
      // "everywhere BUT TEKANGO" - here 'but' is an exception word, not a contrast boundary
      /\b(?:everywhere|anywhere|everyone|everything|all|every\s+\w+|any\s+\w+|all\s+other\s+\w+)\s+but\s+(?:(?:for|in)\s+)?TEKANGO\b/gi,
    ],
    // a scope phrase introduced by a comparative ("unlike other tools, ...") is a comparison, NOT the scope of the next clause
    comparative: /^\s*(?:unlike|compared\s+(?:to|with)|just\s+like|like|similar\s+to|as\s+with|versus|vs\.?|in\s+contrast\s+to|as\s+in|too\b|also\b)/i,
    // COMPOSITION operators over polarity: a prefix that negates the claim it introduces ("It is not true that ..."), a clause that
    // retracts the previous claim ("..., but that is wrong"), and a negated quantifier in an exception ("No other X has it except TEKANGO")
    negationOperator: /^\s*(?:(?:it\s+is|it['’]s|that\s+is|that['’]s|it\s+is\s+simply)\s+(?:not\s+true|untrue|false|incorrect|wrong|a\s+myth|not\s+the\s+case|not\s+correct|not\s+accurate)|(?:it|that)\s+isn['’]t\s+(?:true|correct|accurate|the\s+case))\s+that\s+/i,
    retraction: /^(?:(?:but|and|though)\s+)?(?:that|this|it|which)\s+(?:is|['’]s|was)\s+(?:simply\s+|actually\s+|just\s+)?(?:not\s+true|untrue|false|incorrect|wrong|mistaken|a\s+myth|not\s+the\s+case|not\s+so)$/i,
    negatedQuantifier: /\b(?:no|none|nobody|nothing|never|not\s+any)\b/i,
    // TIME and MODALITY: availability is a claim about NOW. A future / past / planned statement is "not available now", and an
    // epistemic hedge ("may have", "perhaps", "I am not sure") is not an assertion at all.
    nonPresent: /\b(?:will|won['’]t|would|going\s+to|gonna|soon|upcoming|planned|roadmap|next\s+(?:year|month|quarter|week|version|release)|in\s+the\s+(?:future|coming)|eventually|later\s+on|someday|used\s+to|formerly|previously|no\s+longer|yet\s+to)\b/i,
    hedge: /\b(?:might|possibly|perhaps|probably|maybe|supposedly|allegedly|reportedly|i\s+think|i\s+believe|i\s+guess|not\s+sure|unsure|may\s+(?:or\s+may\s+not\s+)?(?:have|be|exist|include|support|offer|provide))\b/i,
    onlyBefore: /\b(?:only|exclusively|solely)\b[^,;:—–()]{0,30}$/i,
    onlyAfter: /^[^,;:—–()]{0,14}\b(?:only|exclusively|solely)\b/i,
    universal: /\b(?:all|every|any|each|everywhere|anywhere|everything)\b/i,
  },
  he: {
    punctuation: /[,;:—–()|•·→…]|\.{2,}|=>|->|\s[-‐‑/]\s|\s\/|\/\s/g,
    // Hebrew has no \b (its letters are not \w); "אך" is a contrast word UNLESS it opens "אך ורק" (= only)
    contrast: /(?:^|\s)(?:(?:אף\s+על\s+פי\s+ש|אף\s+ש|בעוד\s+ש|למרות\s+ש)|(?:אבל|אך(?!\s+ו?רק)|אולם|אלא|למרות|בעוד|ואילו|אמנם|לעומת\s+זאת)(?=\s|$))/g,
    coordinator: /(?:^|\s)(?:וגם|או)(?=\s)/g,
    external: [
      new RegExp(`[בלמה]?${HE_NOUN}\\S*\\s+אחר(?:ים|ות|ת)?(?=[\\s.,;:!?—–()-]|$)`, 'g'),
      new RegExp(`(?:רוב|הרבה|כמה|חלק\\s+מ)-?ה?(?!${HE_INTERNAL}(?:\\s|$))[א-ת]{2,}`, 'g'),
      // generic form: any noun + אחרים/אחרות/אחר (unseen nouns), excluding TEKANGO-internal nouns
      /(?:^|(?<=\s))(?!(?:תוכנית|תוכניות|משתמשים|חשבונות|חשבון|הצעות|לקוחות|מילים|דברים|אפשרויות|הגדרות|יכולות|תפקידים|ב?תוכניות)\s)[בלמה]?[א-ת]{2,}\s+אחר(?:ים|ות|ת)?(?=[\s.,;:!?—–()-]|$)/g,
      /מחוץ\s+ל-?(?:TEKANGO|מערכת|מוצר|אפליקציה|פלטפורמה)/g,
      /בשום\s+מקום\s+אחר|מקומות\s+אחרים/g,
      /אצל\s+(?:מתחרים|אחרים|אחרות)/g,
    ],
    tekango: [/TEKANGO/g],
    exception: [/(?:מלבד|חוץ\s+מ-?|פרט\s+ל-?|למעט|להוציא)\s*(?:את\s+|ב-?\s*|ל-?\s*)?TEKANGO/g],
    comparative: /^\s*(?:בניגוד\s+ל|בדומה\s+ל|כמו\s|לעומת\s|בהשוואה\s+ל)/,
    negationOperator: /^\s*(?:זה\s+)?(?:לא\s+נכון|שגוי|אין\s+זה\s+נכון|אין\s+זה\s+אמת)\s+ש-?/,
    retraction: /^(?:(?:אבל|אך|ו)?\s*)?(?:זה|זו|זאת|הדבר|וזה)\s+(?:פשוט\s+)?(?:לא\s+נכון|שגוי|טעות|לא\s+מדויק|מיתוס|לא\s+כך)$/,
    negatedQuantifier: /(?:^|\s)(?:אף|שום)(?:\s|$)/,
    nonPresent: /(?:^|\s)(?:יהיה|תהיה|יהיו|תהיינה|בקרוב|בעתיד|מתוכנן|מתוכננת|מתוכננים|בתכנון|בעבר|פעם|היה|הייתה|היתה|היו|מתישהו|בהמשך)(?=\s|$|[.,])/,
    hedge: /(?:^|\s)(?:אולי|ייתכן|יתכן|כנראה|לכאורה|לא\s+בטוח|נדמה|נראה\s+ש|אני\s+חושב)(?=\s|$|[.,])/,
    onlyBefore: /(?:^|\s)(?:רק|אך\s+ורק|אך\s+רק|בלעדית)(?:\s+\S+){0,4}\s*$/,
    onlyAfter: /^(?:\s+\S+){0,2}\s+בלבד/,
    universal: /(?:^|\s)(?:בכל|כל|בכולם|לכולם)(?=\s|$)/,
  },
});

function allMatches(patterns, text) {
  const out = [];
  const list = Array.isArray(patterns) ? patterns : [patterns];
  for (const re of list) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      out.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) g.lastIndex += 1;
    }
  }
  return out;
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const inside = (a, b) => a.start >= b.start && a.end <= b.end;

/** Cut a sentence into clauses at punctuation and contrast boundaries (categories, not fixed strings). */
export function segmentClauses(sentence, lang) {
  const M = SCOPE_MODEL[lang];
  // exception constructs are protected: a boundary word INSIDE one ("everywhere BUT TEKANGO") is not a boundary
  const protectedSpans = allMatches(M.exception, sentence);
  const cuts = allMatches([M.punctuation, M.contrast], sentence)
    .filter((c) => !protectedSpans.some((p) => overlaps(c, p)))
    .sort((a, b) => a.start - b.start);
  const clauses = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.start > cursor) clauses.push({ start: cursor, end: c.start });
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < sentence.length) clauses.push({ start: cursor, end: sentence.length });
  return clauses
    .map((c) => ({ ...c, text: sentence.slice(c.start, c.end).replace(/[.!?]+\s*$/, '').trim() }))
    .filter((c) => c.text.length > 0);
}

/** Split a clause at a soft coordinator (and / or / וגם) ONLY when both resulting sides carry their own availability cue. */
function splitCoordinated(clause, lang, det, named) {
  const hasCue = (t) => det.deny(t, named) || !!det.affirm(t);
  const coords = allMatches([SCOPE_MODEL[lang].coordinator], clause.text).sort((a, b) => a.start - b.start);
  for (const c of coords) {
    const left = clause.text.slice(0, c.start).trim();
    const right = clause.text.slice(c.end).trim();
    if (left && right && hasCue(left) && hasCue(right)) {
      return [
        ...splitCoordinated({ ...clause, text: left, end: clause.start + c.start }, lang, det, named),
        ...splitCoordinated({ ...clause, text: right, start: clause.start + c.end }, lang, det, named),
      ];
    }
  }
  return [clause];
}

const blank = (text, spans) => {
  let out = text;
  for (const s of spans) out = out.slice(0, s.start) + ' '.repeat(s.end - s.start) + out.slice(s.end);
  return out;
};

/**
 * Explicit claims of one clause. `det` = { deny(text, named) -> boolean, affirm(text) -> 'strong' | 'weak' | null } (injected).
 * @returns {Array<{ clauseIndex: number, span: [number, number], text: string, polarity: 'positive'|'negative', scope: string, qualifiers: string[], weak: boolean }>}
 */
const flipPolarity = (p) => (p === 'positive' ? 'negative' : 'positive');

/** Claims of one clause, after the polarity-composition operators (negation prefix, retraction marker). */
function clauseClaims(clause, clauseIndex, lang, det, sentenceNamed) {
  const M = SCOPE_MODEL[lang];
  if (M.retraction.test(clause.text)) return [{ retractionMarker: true, clauseIndex, span: [clause.start, clause.end], text: clause.text }];
  if (M.negationOperator.test(clause.text)) {
    // "It is not true that <claim>": the introduced claim is evaluated WITHOUT the operator, then its polarity is inverted
    const stripped = { ...clause, text: clause.text.replace(M.negationOperator, '') };
    return coreClaims(stripped, clauseIndex, lang, det, sentenceNamed)
      .map((c) => (c.polarity ? { ...c, polarity: flipPolarity(c.polarity), qualifiers: [...c.qualifiers, 'negated-by-operator'] } : c));
  }
  return coreClaims(clause, clauseIndex, lang, det, sentenceNamed);
}

function coreClaims(clause, clauseIndex, lang, det, sentenceNamed) {
  const M = SCOPE_MODEL[lang];
  const t = clause.text;
  const exc = allMatches(M.exception, t);
  const extAll = allMatches(M.external, t);
  const ext = extAll.filter((e) => !exc.some((x) => overlaps(e, x)));
  const tek = allMatches(M.tekango, t).filter((k) => !extAll.some((e) => inside(k, e)) && !exc.some((x) => inside(k, x)));
  const named = sentenceNamed || tek.length > 0 || exc.length > 0;
  // scope phrases are blanked so "outside TEKANGO" / "except TEKANGO" can never be mistaken for a cue or a TEKANGO mention
  const cueText = blank(t, [...exc, ...ext]);
  const neg = det.deny(cueText, named);
  const aff = neg ? null : det.affirm(cueText);
  if (!neg && !aff && M.hedge.test(t) && ext.length === 0 && tek.length === 0 && exc.length === 0) return [{ hedgeMarker: true, clauseIndex, span: [clause.start, clause.end], text: t }];
  if (!neg && !aff && exc.length > 0 && M.negatedQuantifier.test(t) && det.affirmAny && det.affirmAny(cueText)) {
    const q = M.universal.test(t) ? ['universal'] : [];
    const b = { clauseIndex, span: [clause.start, clause.end], text: t, weak: false };
    return [
      { ...b, polarity: 'negative', scope: 'external', qualifiers: [...q, 'exception', 'negated-quantifier'] },
      { ...b, polarity: 'positive', scope: 'tekango', qualifiers: [...q, 'exception', 'exclusive', 'negated-quantifier'] },
    ];
  }
  // an exception FRAGMENT with no cue of its own ("..., except TEKANGO") modifies a neighbouring clause - resolved in extractClaims
  if (!neg && !aff && exc.length > 0) return [{ exceptionFragment: true, clauseIndex, span: [clause.start, clause.end], text: t }];
  // a clause that is ONLY a scope phrase ("Elsewhere," / "In TEKANGO," / HE "במוצרים אחרים,") is a fronted (or trailing) adverbial:
  // it carries its scope to the adjacent clause - unless it is a comparative ("unlike other tools, ...")
  if (!neg && !aff && (ext.length > 0 || tek.length > 0)) {
    return [{ scopeCarrier: true, carrierScope: tek.length > 0 ? (ext.length > 0 ? 'both' : 'tekango') : 'external', comparative: M.comparative.test(t), clauseIndex, span: [clause.start, clause.end], text: t }];
  }
  if (!neg && !aff) return [];
  if (M.hedge.test(t)) return []; // a hedged statement asserts nothing
  const nonPresentPositive = !neg && M.nonPresent.test(t); // "will have / used to have / coming soon" is NOT availability now
  const polarity = neg || nonPresentPositive ? 'negative' : 'positive';
  const weak = !neg && aff === 'weak';
  const opposite = polarity === 'positive' ? 'negative' : 'positive';
  const qualifiers = [];
  if (nonPresentPositive) qualifiers.push('non-present');
  if (M.universal.test(t)) qualifiers.push('universal');
  const base = { clauseIndex, span: [clause.start, clause.end], text: t, weak };

  // EXCLUSIVITY (a): "<p> ... EXCEPT TEKANGO"  =>  external p, TEKANGO not-p
  if (exc.length > 0) {
    return [
      { ...base, polarity, scope: 'external', qualifiers: [...qualifiers, 'exception'] },
      { ...base, polarity: opposite, scope: 'tekango', qualifiers: [...qualifiers, 'exception', 'exclusive'] },
    ];
  }
  // EXCLUSIVITY (b): "<positive> ONLY outside TEKANGO / elsewhere / in other X"  =>  external positive, TEKANGO negative
  if (ext.length > 0 && tek.length === 0 && polarity === 'positive') {
    const only = ext.some((e) => M.onlyBefore.test(t.slice(0, e.start)) || M.onlyAfter.test(t.slice(e.end)));
    if (only) {
      return [
        { ...base, polarity: 'positive', scope: 'external', qualifiers: [...qualifiers, 'exclusive'] },
        { ...base, polarity: 'negative', scope: 'tekango', qualifiers: [...qualifiers, 'exclusive'] },
      ];
    }
  }
  if (tek.length > 0 && ext.length > 0) return [{ ...base, polarity, scope: 'both', qualifiers: [...qualifiers, 'both-scopes'] }];
  if (tek.length > 0) return [{ ...base, polarity, scope: 'tekango', qualifiers }];
  if (ext.length > 0) return [{ ...base, polarity, scope: 'external', qualifiers }];
  return [{ ...base, polarity, scope: 'implicit-tekango', qualifiers: weak ? [...qualifiers, 'interjection'] : qualifiers }];
}

/** All claims of a sentence (clause order is preserved in the objects but never used by resolution). */
export function extractClaims(sentence, lang, det, opts = {}) {
  const named = !!opts.named;
  const clauses = segmentClauses(sentence, lang).flatMap((c) => splitCoordinated(c, lang, det, named));
  const perClause = clauses.map((c, i) => clauseClaims(c, i, lang, det, named));
  // Hedge markers ("Supposedly, <clause>" / "<clause>, I am not sure"): the hedged neighbour (next first, else previous) asserts nothing.
  perClause.forEach((list, i) => {
    if (!list.some((c) => c.hedgeMarker)) return;
    perClause[i] = [];
    for (const j of [i + 1, i - 1]) {
      if (perClause[j] && perClause[j].some((c) => c.polarity)) { perClause[j] = []; break; }
    }
  });
  // Retraction ("..., but that is wrong"): the marker inverts the polarity of the nearest previous clause that made a claim.
  perClause.forEach((list, i) => {
    if (!list.some((c) => c.retractionMarker)) return;
    perClause[i] = [];
    for (let j = i - 1; j >= 0; j -= 1) {
      if (perClause[j].some((c) => c.polarity)) {
        perClause[j] = perClause[j].map((c) => (c.polarity ? { ...c, polarity: flipPolarity(c.polarity), qualifiers: [...c.qualifiers, 'retracted'] } : c));
        break;
      }
    }
  });
  // Scope carriers ("Elsewhere, <clause>" / "<clause>, in other products"): an EXTERNAL locative scope moves to the adjacent clause
  // that has no scope phrase of its own (next first = fronted, else previous = trailing); a TEKANGO scope is already the default.
  perClause.forEach((list, i) => {
    const carrier = list.find((c) => c.scopeCarrier);
    if (!carrier) return;
    perClause[i] = [];
    if (carrier.comparative || carrier.carrierScope !== 'external') return;
    for (const j of [i + 1, i - 1]) {
      const target = perClause[j];
      if (!target || target.length === 0 || target.some((c) => c.scopeCarrier || c.exceptionFragment)) continue;
      if (!target.every((c) => c.scope === 'implicit-tekango')) continue;
      perClause[j] = target.map((c) => ({ ...c, scope: 'external', qualifiers: [...c.qualifiers, 'fronted-scope'] }));
      return;
    }
  });
  // Exception fragments attach to the nearest clause that carries a polarity (previous first, else next): the neighbour's
  // claim stops being about TEKANGO (it is the "everywhere else" claim) and TEKANGO gets the OPPOSITE polarity.
  perClause.forEach((list, i) => {
    if (!list.some((c) => c.exceptionFragment)) return;
    const order = [];
    for (let d = 1; d < perClause.length; d += 1) { if (i - d >= 0) order.push(i - d); }
    for (let d = 1; d < perClause.length; d += 1) { if (i + d < perClause.length) order.push(i + d); }
    const nb = order.find((j) => perClause[j].some((c) => !c.exceptionFragment && !c.qualifiers.includes('exception')));
    const frag = list.find((c) => c.exceptionFragment);
    if (nb === undefined) { perClause[i] = []; return; }
    const source = perClause[nb].find((c) => !c.exceptionFragment);
    const opposite = source.polarity === 'positive' ? 'negative' : 'positive';
    perClause[nb] = perClause[nb].map((c) => (c.scope === 'implicit-tekango' ? { ...c, scope: 'external', qualifiers: [...c.qualifiers, 'exception'] } : c));
    perClause[i] = [{ clauseIndex: frag.clauseIndex, span: frag.span, text: frag.text, polarity: opposite, scope: 'tekango', qualifiers: ['exception', 'exclusive', 'fragment'], weak: false }];
  });
  return perClause.flat();
}

const COUNTS_FOR_TEKANGO = new Set(['tekango', 'both', 'implicit-tekango']);

/**
 * What does the response claim about availability IN TEKANGO? (order-independent set resolution)
 *  - external claims never count; a weak interjection is dropped when any strong claim exists in the sentence;
 *  - positive / negative are reported independently, so a self-contradicting sentence is visible to the caller.
 */
export function resolveTekangoClaims(claims) {
  const anyStrong = claims.some((c) => !c.weak);
  const tekango = claims.filter((c) => COUNTS_FOR_TEKANGO.has(c.scope) && (!c.weak || !anyStrong));
  return {
    positive: tekango.some((c) => c.polarity === 'positive'),
    negative: tekango.some((c) => c.polarity === 'negative'),
    tekangoClaims: tekango,
    externalClaims: claims.filter((c) => c.scope === 'external'),
  };
}

/** Scope of the clause that contains `index` in `text` (for callers that scan raw text): 'external' | 'tekango' | 'both' | 'implicit'. */
export function clauseScopeAt(text, index, lang) {
  const M = SCOPE_MODEL[lang];
  const clause = segmentClauses(text, lang).find((c) => index >= c.start && index < c.end) ?? { start: 0, end: text.length, text };
  const t = text.slice(clause.start, clause.end);
  const exc = allMatches(M.exception, t);
  const extAll = allMatches(M.external, t);
  const tek = allMatches(M.tekango, t).filter((k) => !extAll.some((e) => inside(k, e)) && !exc.some((x) => inside(k, x)));
  const ext = extAll.length + exc.length > 0;
  if (tek.length && ext) return 'both';
  if (tek.length) return 'tekango';
  if (ext) return 'external';
  return 'implicit';
}

/** True when the WHOLE sentence only retracts the previous one ("That is wrong." / HE "זה לא נכון."). */
export function isRetractionSentence(sentence, lang) {
  return SCOPE_MODEL[lang].retraction.test(String(sentence ?? '').trim().replace(/[.!?]+$/, '').trim());
}

/** Invert the polarity of a claim list (used when a later sentence retracts it). */
export function flipClaims(claims) {
  return claims.map((c) => (c.polarity ? { ...c, polarity: flipPolarity(c.polarity), qualifiers: [...(c.qualifiers ?? []), 'retracted'] } : c));
}
