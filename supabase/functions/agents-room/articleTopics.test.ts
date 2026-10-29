// Codex release 4 (Owner 2026-10-29, typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"), decision 6: the topic identity of an article - deterministic, either language.
import { describe, it, expect } from 'vitest';
import { ARTICLES, ARTICLE_SLUGS } from '../../../src/shared/publicArticles.js';
import { STATIC_ARTICLES, normTopic, topicWords, similarity, checkTopic, checkFocus, topicContext, TOPIC_CONTEXT_MAX, type Inventory } from './articleTopics.ts';

const empty: Inventory = { articles: [], proposals: [], claims: [], slugs: [] };

describe('article topic identity (Codex release 4, decision 6)', () => {
  it('the static catalog is exactly the four public guides (their headings in both languages)', () => {
    expect(STATIC_ARTICLES.map((s) => s.slug)).toEqual([...ARTICLE_SLUGS]);
    for (const s of STATIC_ARTICLES) {
      const a = (ARTICLES as Record<string, { he: { h1: string }; en: { h1: string } }>)[s.slug];
      expect({ he: s.he, en: s.en }).toEqual({ he: a.he.h1, en: a.en.h1 });
    }
  });

  it('case, Unicode forms, niqqud, geresh / gershayim, quotes, punctuation and spacing are the same topic', () => {
    expect(normTopic('  How to Write a QUOTE!! ')).toBe('how to write a quote');
    expect(normTopic('הַצָּעַת מְחִיר')).toBe(normTopic('הצעת מחיר'));
    expect(normTopic('מע״מ בהצעה')).toBe(normTopic('מע"מ בהצעה'));
    expect(normTopic('מע״מ בהצעה')).toBe(normTopic('מעמ בהצעה'));
    expect(normTopic('בית־ספר')).toBe(normTopic('בית ספר'));
    expect(normTopic('⁦/he⁩ guide')).toBe('he guide');
    expect(normTopic('ﬁve')).toBe('five'); // a compatibility ligature
  });

  it('the generic words of every guide (quote, price, business, guide) never make two topics similar on their own', () => {
    expect(topicWords('How to Write a Quote Your Clients Approve')).toEqual(['client', 'approv']);
    expect(similarity('Landscaping quotes', 'Renovation Contractor Quotes: What to Include')).toBe(0);
    expect(similarity('הצעת מחיר לגינון', 'הצעת מחיר של קבלן שיפוצים: מה חייב להופיע בה')).toBe(0);
    expect(similarity('Renovation quotes', 'Renovation Contractor Quotes: What to Include')).toBe(1);
    expect(similarity('הצעות מחיר לשיפוצים', 'הצעת מחיר של קבלן שיפוצים: מה חייב להופיע בה')).toBe(1); // ל + שיפוצים
    expect(similarity('Hourly pricing', 'How to price hourly work')).toBe(1);
    expect(similarity('Import pricing basics', 'Hourly pricing')).toBeLessThan(0.8); // the pricing method distinguishes them
    // the review of release 4: the trade distinguishes; plurals, construct forms and final letters do not; a short word is not a prefix
    expect(similarity('Free price list template for painters', 'Free price list template for electricians')).toBe(0);
    expect(similarity('הצעת מחיר לקבלני שיפוצים', 'הצעת מחיר של קבלן שיפוצים: מה חייב להופיע בה')).toBe(1);
    expect(similarity('משקל', 'שקל')).toBe(0);
    expect(similarity('מטבע', 'טבע')).toBe(0);
    // two topics made only of generic words are compared on them
    expect(similarity('Writing quotes for small businesses', 'How to write a quote for a small business')).toBe(1);
    expect(similarity('כתיבת הצעות מחיר לעסקים קטנים', 'איך כותבים הצעת מחיר לעסק קטן')).toBeGreaterThanOrEqual(0.8);
  });

  it('the same distinct focus (normalized) as another flow is found; its own flow is not', () => {
    const inv: Inventory = { ...empty, claims: [{ ref_id: 'f1', kind: 'topic', lang: 'he', norm: 'x', display: 'נושא', focus: 'שיפוץ מטבח בלבד' }],
      proposals: [{ id: 'p1', he: 'נושא ב', en: 'Topic B', focus: 'Kitchen only' }] };
    expect(checkFocus(inv, ' שיפוץ  מטבח בלבד! ')).toMatchObject({ kind: 'claim', id: 'f1' });
    expect(checkFocus(inv, 'kitchen ONLY')).toMatchObject({ kind: 'proposal', id: 'p1' });
    expect(checkFocus(inv, 'שיפוץ מטבח בלבד', { actionId: 'f1' })).toBeNull();
    expect(checkFocus(inv, 'שיפוץ אמבטיה')).toBeNull();
  });

  it('a Hebrew OR an English exact match is a duplicate, over the static guides, articles, drafts, proposals and claims', () => {
    expect(checkTopic(empty, { he: 'תמחור יבוא עם המרת מטבעות', en: 'Something new' })).toMatchObject({ verdict: 'duplicate', match: { kind: 'static', lang: 'he', slug: 'import-pricing-currency-conversion' } });
    expect(checkTopic(empty, { he: 'משהו חדש', en: 'import pricing with currency conversion.' })).toMatchObject({ verdict: 'duplicate', match: { kind: 'static', lang: 'en' } });
    const inv: Inventory = {
      articles: [{ id: 'a1', slug: 'x', status: 'published', he: 'מדריך א', en: 'Guide A', action_id: 'f1' }, { id: 'a2', slug: 'y', status: 'draft', he: 'מדריך ב', en: 'Guide B', action_id: 'f2' }],
      proposals: [{ id: 'p1', he: 'נושא ג', en: 'Topic C' }],
      claims: [{ ref_id: 'f3', kind: 'topic', lang: 'en', norm: normTopic('Topic D'), display: 'Topic D' }],
      slugs: ['x', 'y'],
    };
    expect(checkTopic(inv, { he: 'מדריך א', en: 'n' }).match).toMatchObject({ kind: 'published', id: 'a1' });
    expect(checkTopic(inv, { he: 'n', en: 'guide b' }).match).toMatchObject({ kind: 'draft', id: 'a2' });
    expect(checkTopic(inv, { he: 'נושא ג', en: 'n' }).match).toMatchObject({ kind: 'proposal', id: 'p1' });
    expect(checkTopic(inv, { he: 'n', en: 'TOPIC D' }).match).toMatchObject({ kind: 'claim', id: 'f3' });
    // the item itself (its own proposal / article / claims) is never its duplicate
    expect(checkTopic(inv, { he: 'נושא ג', en: 'Topic C' }, { actionId: 'p1' }).verdict).toBe('distinct');
    expect(checkTopic(inv, { he: 'מדריך ב', en: 'Guide B' }, { articleId: 'a2', actionId: 'f2' }).verdict).toBe('distinct');
    expect(checkTopic(inv, { he: 'n', en: 'Topic D' }, { actionId: 'f3' }).verdict).toBe('distinct');
  });

  it('similar = review with a distinct focus; distinct = free; a duplicate wins over a similarity', () => {
    expect(checkTopic(empty, { he: 'הצעות מחיר לשיפוצים', en: 'Renovation quotes' })).toMatchObject({ verdict: 'similar', match: { kind: 'static', slug: 'renovation-contractor-quote' } });
    expect(checkTopic(empty, { he: 'הצעת מחיר לגינון', en: 'Landscaping quotes' }).verdict).toBe('distinct');
    expect(checkTopic(empty, { he: 'הצעות מחיר לשיפוצים', en: 'Quoting by measurements: square meters and linear meters' }).verdict).toBe('duplicate');
  });

  it('the manager gets every topic up to a bound and the coverage is reported', () => {
    const many: Inventory = { ...empty, proposals: Array.from({ length: 400 }, (_, i) => ({ id: `p${i}`, he: `נושא ${i}`, en: `Topic ${i}` })) };
    const c = topicContext(many);
    expect(c.total).toBe(404);
    expect(c.topics).toHaveLength(TOPIC_CONTEXT_MAX);
    expect(c.topics.at(-1)).toEqual({ he: 'נושא 399', en: 'Topic 399' });
    expect(c.topics.slice(0, 4).map((x) => x.en)).toEqual(STATIC_ARTICLES.map((s) => s.en)); // the static guides are always sent
  });
});
