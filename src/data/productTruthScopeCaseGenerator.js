// PRODUCT TRUTH - COMBINATORIAL / PROPERTY CASE GENERATOR for the scope/polarity model (structural closure).
//
// Hand-picked sentences prove nothing about a model, so this generates the SEMANTIC SPACE from templates. Every generated
// case carries, by construction, what it CLAIMS ABOUT AVAILABILITY IN TEKANGO: `tekangoClaim` = 'positive' | 'negative' |
// 'none' (external-only statements make no TEKANGO claim). The ground truth is therefore known independently of the validator:
//   under an AVAILABLE truth      accept  iff tekangoClaim === 'positive'   (negative => reject; none => insufficient => reject)
//   under a NOT_AVAILABLE truth   accept  iff tekangoClaim === 'negative'   (positive => reject; none => insufficient => reject)
//
// Dimensions (EN and HE):
//   boundary        comma | semicolon | colon | em dash | en dash | spaced hyphen | period (two sentences) | ", but" | ", though" | "while" (HE: אבל / אף ש / בעוד ש)
//   clause order    TEKANGO clause first | external clause first
//   external noun   EN products / platforms / systems / apps / tools / services   HE מוצרים / פלטפורמות / מערכות / אפליקציות / כלים / שירותים (+ agreement)
//   TEKANGO polarity  available | unavailable  (several natural verb forms each)
//   external polarity available | unavailable  (several natural verb forms each, plus "elsewhere")
//   exclusivity     except / other than / apart from / besides / excluding TEKANGO  (HE מלבד / חוץ מ- / פרט ל- / למעט)  over every noun class,
//                   only outside TEKANGO / only elsewhere / only in other X / X only  (HE רק / אך ורק / בלבד),  only-in-TEKANGO,
//                   and the exception fragment after a comma ("..., except TEKANGO")
//   morphology (HE) קיים/קיימת, זמין/זמינה, נתמך/נתמכת with masculine/feminine subjects and pronouns
//   prefix          none | "Yes, " | "In short: " (assigned cyclically)
// External-only statements and TEKANGO-only statements are generated as their own families.

const EN_NOUNS = [['products', 'product'], ['platforms', 'platform'], ['systems', 'system'], ['apps', 'app'], ['tools', 'tool'], ['services', 'service']];
const EN_BOUNDARIES = [
  { id: 'comma', join: ', ' }, { id: 'semicolon', join: '; ' }, { id: 'colon', join: ': ' }, { id: 'em-dash', join: ' — ' },
  { id: 'en-dash', join: ' – ' }, { id: 'spaced-hyphen', join: ' - ' }, { id: 'period', join: '. ' },
  { id: 'but', join: ', but ' }, { id: 'though', join: ', though ' }, { id: 'while', join: ' while ' },
  { id: 'slash', join: ' / ' }, { id: 'pipe', join: ' | ' }, { id: 'ellipsis', join: ' … ' }, { id: 'arrow', join: ' -> ' }, { id: 'bullet', join: ' • ' },
  { id: 'parentheses', build: (a, c) => `${a} (${c})` },
];
const EN_EXC = ['except TEKANGO', 'other than TEKANGO', 'apart from TEKANGO', 'besides TEKANGO', 'excluding TEKANGO'];
const PREFIX_EN = ['', 'Yes, ', 'In short: '];

const HE_NOUNS = [['מוצרים', 'מוצר', 'אחרים'], ['פלטפורמות', 'פלטפורמה', 'אחרות'], ['מערכות', 'מערכת', 'אחרות'], ['אפליקציות', 'אפליקציה', 'אחרות'], ['כלים', 'כלי', 'אחרים'], ['שירותים', 'שירות', 'אחרים']];
const HE_BOUNDARIES = [
  { id: 'comma', join: ', ' }, { id: 'semicolon', join: '; ' }, { id: 'colon', join: ': ' }, { id: 'em-dash', join: ' — ' },
  { id: 'en-dash', join: ' – ' }, { id: 'spaced-hyphen', join: ' - ' }, { id: 'period', join: '. ' },
  { id: 'aval', join: ', אבל ' }, { id: 'af-she', join: ', אף ש' }, { id: 'beod', join: ' בעוד ש' },
  { id: 'slash', join: ' / ' }, { id: 'pipe', join: ' | ' }, { id: 'ellipsis', join: ' … ' }, { id: 'arrow', join: ' -> ' }, { id: 'bullet', join: ' • ' },
  { id: 'parentheses', build: (a, c) => `${a} (${c})` },
];
const HE_EXC = ['מלבד TEKANGO', 'חוץ מ-TEKANGO', 'פרט ל-TEKANGO', 'למעט TEKANGO'];
const HE_GENDER = {
  m: { pron: 'הוא', avail: ['זמין', 'קיים', 'נתמך'], neg: 'אינו', missing: 'חסר', fut: 'יהיה', past: 'היה' },
  f: { pron: 'היא', avail: ['זמינה', 'קיימת', 'נתמכת'], neg: 'אינה', missing: 'חסרה', fut: 'תהיה', past: 'הייתה' },
};
const PREFIX_HE = ['', 'כן, ', 'בקיצור: '];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const compose = (b, a, c, cased) => (b.id === 'period' ? (cased ? `${cap(a)}. ${cap(c)}.` : `${a}. ${c}.`) : b.build ? `${b.build(a, c)}.` : `${a}${b.join}${c}.`);
const finish = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

// ---------------------------------------------------------------------------------------------------------------------
// EN phrase banks. S = subject noun phrase (the capability), it = pronoun.
const enTek = (S) => ({
  positive: [`TEKANGO has ${S}`, `TEKANGO includes ${S}`, `TEKANGO supports ${S}`, `${S} is available in TEKANGO`, `${S} exists in TEKANGO`, `${S} is supported in TEKANGO`, `TEKANGO ships ${S}`, `you get ${S} in TEKANGO`, `${S} can be found in TEKANGO`],
  negative: [`TEKANGO lacks ${S}`, `TEKANGO does not have ${S}`, `${S} is not available in TEKANGO`, `${S} does not exist in TEKANGO`, `there is no ${S} in TEKANGO`, `${S} is unavailable in TEKANGO`, `${S} is missing from TEKANGO`, `${S} is absent from TEKANGO`, `TEKANGO omits ${S}`, `you will not find ${S} in TEKANGO`],
});
const enExt = (N) => ({
  positive: [`it is available in other ${N}`, `it exists in other ${N}`, `other ${N} have it`, `other ${N} support it`, `it is offered in competing ${N}`, 'elsewhere it is available'],
  negative: [`it is unavailable in other ${N}`, `it does not exist in other ${N}`, `other ${N} lack it`, `it is not available in other ${N}`, `it is not offered in competing ${N}`, 'elsewhere it is unavailable'],
});

// HE phrase banks. g = gender record, S = subject (already gendered by the caller), N/adj = external noun + agreeing adjective.
const heTek = (S, g) => ({
  positive: [`${S} ${g.avail[0]} ב-TEKANGO`, `${S} ${g.avail[1]} ב-TEKANGO`, `${S} ${g.avail[2]} ב-TEKANGO`, `ב-TEKANGO ${S} ${g.avail[0]}`, `TEKANGO כוללת את ${S}`, `ב-TEKANGO יש ${S}`, `ב-TEKANGO תמצא ${S}`],
  negative: [`${S} ${g.neg} ${g.avail[0]} ב-TEKANGO`, `${S} ${g.neg} ${g.avail[2]} ב-TEKANGO`, `${S} לא ${g.avail[1]} ב-TEKANGO`, `ב-TEKANGO חסר ${S}`, `ב-TEKANGO אין ${S}`, `TEKANGO לא כוללת את ${S}`, `לא תמצא ${S} ב-TEKANGO`],
});
const heExt = (Np, adj, g) => ({
  positive: [`ב${Np} ${adj} ${g.pron} ${g.avail[0]}`, `${g.pron} ${g.avail[1]} ב${Np} ${adj}`, `${g.pron} ${g.avail[2]} ב${Np} ${adj}`, `במקום אחר ${g.pron} ${g.avail[0]}`],
  negative: [`ב${Np} ${adj} ${g.pron} ${g.neg} ${g.avail[0]}`, `${g.pron} לא ${g.avail[1]} ב${Np} ${adj}`, `${g.pron} ${g.neg} ${g.avail[2]} ב${Np} ${adj}`, `בשום מקום אחר ${g.pron} לא ${g.avail[0]}`],
});

// ---------------------------------------------------------------------------------------------------------------------
/**
 * @param {'en'|'he'} lang
 * @param {{ en?: string, he?: { S: string, gender: 'm'|'f' }[] }} subject  EN subject NP; HE list of gendered subject noun phrases
 * @returns {Array<{ id: string, lang: string, family: string, text: string, tekangoClaim: 'positive'|'negative'|'none', dims: object }>}
 */
export function generateScopeCases(lang, subject, opts = {}) {
  const EN_N = opts.enNouns ?? EN_NOUNS;
  const HE_N = opts.heNouns ?? HE_NOUNS;
  const out = [];
  let n = 0;
  const push = (family, text, tekangoClaim, dims) => { n += 1; out.push({ id: `${lang}-${family}-${n}`, lang, family, text, tekangoClaim, dims }); };
  const prefixes = lang === 'en' ? PREFIX_EN : PREFIX_HE;
  const pfx = () => prefixes[n % prefixes.length];

  if (lang === 'en') {
    const S = subject.en;
    const tek = enTek(S);
    // family 1: TEKANGO clause x external clause x boundary x order (the full product)
    for (const tp of ['positive', 'negative']) for (const tPhrase of tek[tp]) {
      for (const [Np] of EN_N) {
        const ext = enExt(Np);
        for (const ep of ['positive', 'negative']) for (const ePhrase of ext[ep]) {
          for (const b of EN_BOUNDARIES) for (const order of ['tek-first', 'ext-first']) {
            const [a, c] = order === 'tek-first' ? [tPhrase, ePhrase] : [ePhrase, tPhrase];
            const text = `${pfx()}${compose(b, a, c, true)}`;
            push('pair', text, tp, { boundary: b.id, order, noun: Np, tekPolarity: tp, extPolarity: ep, pair: `${tPhrase}||${ePhrase}||${b.id}` });
          }
        }
      }
    }
    // family 2: TEKANGO-only
    for (const tp of ['positive', 'negative']) for (const tPhrase of tek[tp]) push('tek-only', finish(`${pfx()}${cap(tPhrase)}`), tp, { tekPolarity: tp });
    // family 3: external-only (no TEKANGO claim => insufficient)
    for (const [Np] of EN_N) { const ext = enExt(Np); for (const ep of ['positive', 'negative']) for (const ePhrase of ext[ep]) push('ext-only', finish(`${pfx()}${cap(ePhrase)}`), 'none', { noun: Np, extPolarity: ep }); }
    // family 4: exclusivity - exception (every noun class, every exception word, inline and fragment forms)
    for (const [Np, sing] of EN_N) for (const X of EN_EXC) {
      const posFrames = [`${S} is available everywhere ${X}`, `${S} is available on every ${sing} ${X}`, `every ${sing} ${X} has ${S}`, `${S} exists in all other ${Np} ${X}`, `all other ${Np} have ${S}, ${X}`, `${S} is supported on every ${sing}, ${X}`];
      const negFrames = [`${S} is unavailable everywhere ${X}`, `${S} is not available on any ${sing} ${X}`, `${S} does not exist in any other ${sing} ${X}`];
      for (const f of posFrames) push('except-positive', finish(cap(f)), 'negative', { noun: Np, exclusivity: X });
      for (const f of negFrames) push('except-negative', finish(cap(f)), 'positive', { noun: Np, exclusivity: X });
    }
    // family 5: exclusivity - only outside / only elsewhere / only in other X / X only
    for (const [Np] of EN_N) for (const f of [
      `${S} is available only outside TEKANGO`, `${S} is only available elsewhere`, `${S} exists only in other ${Np}`, `${S} is available in other ${Np} only`,
      `only other ${Np} have ${S}`, `${S} is offered exclusively by other ${Np}`, `${S} is available solely elsewhere`, `${S} is available outside of TEKANGO only`,
    ]) push('only-outside', finish(cap(f)), 'negative', { noun: Np });
    for (const f of [`${S} is available only in TEKANGO`, `only TEKANGO has ${S}`, `${S} is available in TEKANGO only`]) push('only-tekango', finish(cap(f)), 'positive', {});
    // family 7: polarity COMPOSITION (negation operators, retraction clause / sentence, negated-quantifier exception)
    for (const [Np, sing] of EN_N) {
      for (const f of [`It is not true that TEKANGO lacks ${S}`, `It isn't true that ${S} is missing from TEKANGO`, `Some say TEKANGO lacks ${S}, but that is wrong`, `Some say ${S} is missing from TEKANGO. That is not true`,
        `No other ${sing} has ${S} except TEKANGO`, `No ${sing} apart from TEKANGO has ${S}`, `Some say ${S} is unavailable in TEKANGO - that is false`]) push('composition', finish(f), 'positive', { noun: Np });
      for (const f of [`It is not true that ${S} exists in TEKANGO`, `It is false that TEKANGO has ${S}`, `Some say ${S} exists in TEKANGO, but that is wrong`, `Some say TEKANGO includes ${S}. That is false`,
        `Some say ${S} is available in TEKANGO; this is a myth`, `Other ${Np} say TEKANGO supports ${S}, but that is incorrect`]) push('composition', finish(f), 'negative', { noun: Np });
    }
    // family 8: TIME and MODALITY - availability is a claim about NOW: future / past = not available now; hedges assert nothing
    for (const f of [`TEKANGO will have ${S} next year`, `TEKANGO used to have ${S}`, `${S} will be available in TEKANGO soon`, `TEKANGO is going to include ${S} in the future`, `${S} was in TEKANGO but is no longer there`]) push('temporal', finish(f), 'negative', {});
    for (const f of [`TEKANGO may have ${S}`, `TEKANGO might include ${S}, I am not sure`, `Perhaps ${S} exists in TEKANGO`, `TEKANGO probably supports ${S}`, `${S} is coming soon to TEKANGO`, `${S} is planned for TEKANGO`, `Supposedly, TEKANGO has ${S}`]) push('temporal', finish(f), 'none', {});
    // family 6: SPECIAL constructions - fronted scope, exception-first / parenthetical / 'but' exception, neither-nor, terminal negation, comparatives
    for (const [Np, sing] of EN_N) {
      for (const f of [`Elsewhere, ${S} is available; in TEKANGO, it is not`, `In other ${Np}, it exists; in TEKANGO, ${S} does not exist`, `Outside TEKANGO, ${S} is available. In TEKANGO, it is not`, `In competing ${Np}, ${S} is available - in TEKANGO, it is unavailable`,
        `${S} is available everywhere but TEKANGO`, `Every ${sing} but TEKANGO has ${S}`, `${S} is available everywhere (except TEKANGO)`, `Except in TEKANGO, ${S} is available everywhere`, `Other than in TEKANGO, every ${sing} has ${S}`,
        `Neither TEKANGO nor other ${Np} have ${S}`, `Other ${Np} have ${S}; TEKANGO does not`, `Although other ${Np} include ${S}, TEKANGO does not`, `Other ${Np} offer it. TEKANGO doesn't`, `Most ${Np} have ${S}, TEKANGO doesn’t`,
      ]) push('special', finish(f), 'negative', { noun: Np });
      for (const f of [`Elsewhere, ${S} is unavailable; in TEKANGO, it is available`, `In other ${Np}, it does not exist; in TEKANGO, ${S} exists`, `Outside TEKANGO, ${S} is unavailable. In TEKANGO, it is available`,
        `${S} is unavailable everywhere but TEKANGO`, `${S} is unavailable everywhere (except TEKANGO)`, `Unlike other ${Np}, TEKANGO has ${S}`, `${S}, unlike in other ${Np}, is available in TEKANGO`, `TEKANGO ships ${S}; other ${Np} do not`, `Other ${Np} lack it / TEKANGO has ${S}`,
      ]) push('special', finish(f), 'positive', { noun: Np });
    }
  } else {
    for (const { S, gender } of subject.he) {
      const g = HE_GENDER[gender];
      const tek = heTek(S, g);
      for (const tp of ['positive', 'negative']) for (const tPhrase of tek[tp]) {
        for (const [Np, , adj] of HE_N) {
          const ext = heExt(Np, adj, g);
          for (const ep of ['positive', 'negative']) for (const ePhrase of ext[ep]) {
            for (const b of HE_BOUNDARIES) for (const order of ['tek-first', 'ext-first']) {
              const [a, c] = order === 'tek-first' ? [tPhrase, ePhrase] : [ePhrase, tPhrase];
              const text = `${pfx()}${compose(b, a, c, false)}`;
              push('pair', text, tp, { boundary: b.id, order, noun: Np, tekPolarity: tp, extPolarity: ep, gender, pair: `${tPhrase}||${ePhrase}||${b.id}` });
            }
          }
        }
      }
      for (const tp of ['positive', 'negative']) for (const tPhrase of tek[tp]) push('tek-only', finish(`${pfx()}${tPhrase}`), tp, { tekPolarity: tp, gender });
      for (const [Np, , adj] of HE_N) { const ext = heExt(Np, adj, g); for (const ep of ['positive', 'negative']) for (const ePhrase of ext[ep]) push('ext-only', finish(`${pfx()}${ePhrase}`), 'none', { noun: Np, extPolarity: ep, gender }); }
      for (const [, sing] of HE_N) for (const X of HE_EXC) {
        const av = g.avail;
        const posFrames = [`${S} ${av[0]} בכל ${sing} ${X}`, `${S} ${av[1]} בכל ${sing} ${X}`, `${S} ${av[2]} בכל ${sing} ${X}`, `${S} ${av[0]} בכל מקום ${X}`, `בכל ${sing} ${X} ${g.pron} ${av[0]}`, `${S} ${av[0]} בכל ${sing}, ${X}`];
        const negFrames = [`${S} ${g.neg} ${av[0]} בשום ${sing} ${X}`, `${S} לא ${av[1]} באף ${sing} ${X}`];
        for (const f of posFrames) push('except-positive', finish(f), 'negative', { noun: sing, exclusivity: X, gender });
        for (const f of negFrames) push('except-negative', finish(f), 'positive', { noun: sing, exclusivity: X, gender });
      }
      for (const [Np, , adj] of HE_N) for (const f of [
        `${S} ${g.avail[0]} רק מחוץ ל-TEKANGO`, `${S} ${g.avail[0]} אך ורק מחוץ ל-TEKANGO`, `${S} ${g.avail[0]} מחוץ ל-TEKANGO בלבד`, `${S} ${g.avail[0]} רק ב${Np} ${adj}`,
        `${S} ${g.avail[1]} רק במקום אחר`, `${S} ${g.avail[0]} ב${Np} ${adj} בלבד`, `${S} ${g.avail[2]} רק מחוץ ל-TEKANGO`,
      ]) push('only-outside', finish(f), 'negative', { noun: Np, gender });
      for (const f of [`${S} ${g.avail[0]} רק ב-TEKANGO`, `${S} ${g.avail[0]} ב-TEKANGO בלבד`]) push('only-tekango', finish(f), 'positive', { gender });
      for (const f of [`לא נכון ש${S} ${g.missing} ב-TEKANGO`, `יש אומרים ש${S} ${g.missing} ב-TEKANGO, אבל זה לא נכון`, `יש אומרים ש${S} ${g.missing} ב-TEKANGO. זה שגוי`]) push('composition', finish(f), 'positive', { gender });
      for (const f of [`לא נכון ש${S} ${g.avail[0]} ב-TEKANGO`, `יש אומרים ש${S} ${g.avail[0]} ב-TEKANGO, אבל זה לא נכון`, `יש אומרים ש${S} ${g.avail[1]} ב-TEKANGO. זה שגוי`, `שגוי ש${S} ${g.avail[2]} ב-TEKANGO`]) push('composition', finish(f), 'negative', { gender });
      for (const f of [`${S} ${g.fut} ${g.avail[0]} ב-TEKANGO בקרוב`, `ב-TEKANGO ${g.past} פעם ${S}`, `${S} ${g.fut} ${g.avail[1]} ב-TEKANGO בעתיד`]) push('temporal', finish(f), 'negative', { gender });
      for (const f of [`אולי ${S} ${g.avail[0]} ב-TEKANGO`, `ייתכן ש${S} ${g.avail[1]} ב-TEKANGO`, `כנראה ש${S} ${g.avail[2]} ב-TEKANGO`, `לכאורה ${S} ${g.avail[0]} ב-TEKANGO`]) push('temporal', finish(f), 'none', { gender });
      for (const [Np, sing, adj] of HE_N) {
        const av = g.avail;
        for (const f of [`ב${Np} ${adj}, ${S} ${av[0]}; ב-TEKANGO, ${g.pron} ${g.neg} ${av[0]}`, `${S} ${av[0]} בכל ${sing} (למעט TEKANGO)`, `למעט ב-TEKANGO, ${S} ${av[0]} בכל מקום`, `${S} ${av[0]} בכל ${sing} חוץ מ-TEKANGO`, `אף ש${S} ${av[1]} ב${Np} ${adj}, ב-TEKANGO ${g.pron} לא ${av[1]}`]) push('special', finish(f), 'negative', { noun: sing, gender });
        for (const f of [`ב${Np} ${adj}, ${S} ${g.neg} ${av[0]}; ב-TEKANGO, ${g.pron} ${av[0]}`, `בניגוד ל${Np} ${adj}, ${S} ${av[0]} ב-TEKANGO`, `${S}, בניגוד ל${Np} ${adj}, ${av[0]} ב-TEKANGO`, `${S} ${g.neg} ${av[0]} באף ${sing} מלבד TEKANGO`]) push('special', finish(f), 'positive', { noun: sing, gender });
      }
    }
  }
  // de-duplicate identical texts (the noun-free "elsewhere" phrases repeat across nouns) keeping the first occurrence
  const seen = new Set();
  return out.filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)));
}

/** Expected verdict of a generated case under a truth kind ('AVAILABLE' | 'NOT_AVAILABLE'). */
export const expectedAccept = (tekangoClaim, truthKind) => (truthKind === 'AVAILABLE' ? tekangoClaim === 'positive' : tekangoClaim === 'negative');

export const SCOPE_SUBJECTS = Object.freeze({
  AVAILABLE: { en: 'the in-editor calculator', he: [{ S: 'המחשבון המובנה בעורך', gender: 'm' }, { S: 'היכולת', gender: 'f' }] },
  NOT_AVAILABLE: { en: 'AI-executed data mutation', he: [{ S: 'שינוי נתונים על ידי AI', gender: 'f' }] },
});
