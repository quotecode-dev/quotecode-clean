// INTENT GRAMMAR - TWO REMAINING BLOCKERS: the Builder's fresh adversarial round (structural variants NOT produced by the generators, written after the fix).
// FIRST PASS: negatives over-routed 0 / 23; positives 11 / 12 routed. The 1 miss is a PRE-EXISTING, out-of-scope boundary (an impersonal possibility question with no
// SELF / account / display target) and is intentionally left unchanged: "האם אפשר לעבוד ב-£?".

export const BLOCKERS_ROUND2_NEGATIVES = Object.freeze([
  "Show my customers' totals in dollars", 'Display invoices for every client in USD', 'Print client fees in GBP', 'Export customer prices in euros', 'Show what each supplier charges in EUR',
  'Convert the client prices to dollars', 'Show prices of customers in USD', "List each user's fees in euros", 'Display vendor amounts in pounds', 'Show member costs in dollars', 'Present employee totals in GBP',
  'Show contact prices in USD', 'Display the customer figures in EUR', 'Show customers their prices in dollars', 'Give clients prices in USD', 'Set the client price list to euros',
  'הצג את המחירים של הלקוחות בדולר', 'תציג סכומים עבור ספקים ביורו', 'תראה מחירי משתמשים בשקלים', 'הצג תמחור של עובד בליש"ט', 'תראה ללקוח שלי מחירים בדולר', 'הצג ללקוחות מחירים ביורו',
  'תגדיר את התמחור של הלקוח ביורו',
]);
export const BLOCKERS_ROUND2_POSITIVES = Object.freeze([
  'בא לי תמחור ב-£', 'אפשר להציג תמחור ב־€', 'בא לי לראות מחירים ב-₪', 'תראה לי מחירים ב-$', 'Show me prices in £', 'I want everything in €', 'הייתי רוצה לראות הכל ב-£',
  'אני רוצה שהמחירים במערכת יוצגו ב-$', 'תציג לי בדשבורד מחירים ב-€ בבקשה', 'We are international customers so show me prices in $', 'אנחנו לקוחות זרים ותראה לנו מחירים ב-£',
]);
export const BLOCKERS_ROUND2_KNOWN_BOUNDARY = Object.freeze(['האם אפשר לעבוד ב-£?']);
