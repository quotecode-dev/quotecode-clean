// INTENT GRAMMAR NORMALIZATION CLOSURE - the Builder's SECOND adversarial round (written after the first unseen round, aimed at the grammar's edges: contractions, other
// quantifiers, other account nouns, participial / modal copulas, inverted questions, third-party (CRM) look-alikes). Regression evidence, not a completeness proof.
// FIRST PASS (before the general lexicon additions): positives 29 / 32, negatives over-routed 0 / 26.

export const GRAMMAR_ROUND2_POSITIVES = Object.freeze([
  "We're all overseas customers.", 'We are all foreign users.', 'We both belong to the local market.', 'Everyone of us is an international client.', 'The three of us are local users.',
  'We two are overseas clients.', 'My company belongs to the international market.', 'Our workspace is in the foreign market.', 'Our firm is a local business.', 'It seems that we are overseas customers.',
  "I guess we're international users", 'Honestly, we are local customers', 'We are not international customers.', 'Are all of us overseas clients?', 'Do we belong to the local market?',
  'Does our business belong to the international market?', 'Turn us into international customers.', 'Please make both of us local users.', 'Set us up as overseas clients.', 'Put our account under the foreign market.',
  'כולנו לקוחות זרים', 'אנחנו כולנו משתמשים בינלאומיים', 'העסק שלנו שייך לשוק המקומי', 'הפרופיל שלי נמצא בשוק הזר', 'האם אנחנו נחשבים לקוחות בינלאומיים?', 'תגדיר אותנו כמשתמשים מקומיים',
  'נניח שהעסק שלי שייך לשוק הזר', 'תתייחס לשנינו כלקוחות זרים', 'אנחנו לא לקוחות מקומיים', 'החשבון שלנו הוא חשבון בינלאומי', 'האם החשבון שלנו מוגדר בשוק המקומי?', 'תעביר אותנו לשוק הבינלאומי',
]);
export const GRAMMAR_ROUND2_FIRST_PASS = Object.freeze({
  positivesRouted: 29, positivesTotal: 32, negativesOverRouted: 0, negativesTotal: 26,
  missed: ['Everyone of us is an international client.', 'We two are overseas clients.', 'Set us up as overseas clients.'],
  fixedByGeneralRules: ['"everyone / everybody" as a quantifier head', 'numerals after a subject ("we two")', 'the phrasal particle "up"'],
});
export const GRAMMAR_ROUND2_NEGATIVES = Object.freeze([
  'Our customers are all overseas.', 'My clients are international users.', 'We support local and international customers.', 'Show customers who belong to the foreign market', 'The account belongs to John',
  'We are all here.', 'Our account is ready.', 'This profile is local to Tel Aviv', 'Our business hours are local time', 'We belong together', 'Everyone is foreign here', 'The international market grew',
  'Add both of us as users', 'We are looking at the local market', 'We are part of the team', 'The clients are overseas users', 'Do our clients belong to the foreign market?', 'We are reviewing overseas customers',
  'הלקוחות שלנו כולם בינלאומיים', 'אנחנו תומכים בלקוחות מקומיים וזרים', 'החשבון שייך לדני', 'כולנו כאן', 'העסק שלנו פתוח', 'הלקוחות שייכים לשוק הזר', 'אנחנו בוחנים שוק בינלאומי', 'אנחנו חלק מהצוות',
]);
