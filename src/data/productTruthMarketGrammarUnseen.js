// INTENT GRAMMAR NORMALIZATION CLOSURE - the Builder's INDEPENDENT unseen break-test and negative controls (Product Truth).
// Written AFTER the grammar implementation, in natural varied wording, WITHOUT being used to design it. They are regression evidence for the explicit grammar domain,
// not a proof of natural-language completeness. First-pass results are recorded honestly in GRAMMAR_UNSEEN_FIRST_PASS.

export const GRAMMAR_UNSEEN_HE = Object.freeze([
  'אנחנו בעצם לקוחות מחו"ל, אז תציג לנו מחירים בדולר', 'הפרופיל שלנו שייך לשוק הזר, נכון?', 'האם החשבון שלי מוגדר כחשבון מקומי?', 'בבקשה תתייחס אלי כמשתמש בינלאומי',
  'שנינו לקוחות ישראליים', 'כולנו משתמשים מקומיים בעסק הזה', 'העסק שלנו נמצא בשוק המקומי', 'האם אפשר להציג בממשק מחירים בליש"ט?',
  'אני רוצה שבמערכת יוצגו כל המחירים ביורו', 'תעביר את הדשבורד שלי לדולר', 'נניח שהחשבון שלנו שייך לשוק הבינלאומי, מה אז?', 'תענה לי כאילו אנחנו לקוחות זרים',
  'כנראה שאנחנו נחשבים ללקוחות בינלאומיים', 'הייתי מעדיף לעבוד בדשבורד עם יורו', 'אפשר בבקשה לראות את המחירים בשקלים במערכת?', 'האם המערכת יכולה לעבוד בדולרים בחשבון שלנו?',
  'אנחנו עסק ישראלי לכל דבר', 'תסווג אותנו כלקוחות מקומיים בבקשה', 'החשבון שלנו בינלאומי, תציג לנו את המחירים בדולר', 'אני משתמש זר ואני רוצה דולר',
  'האם החשבון שלי נכלל בשוק הבינלאומי?', 'שנינו בעצם משתמשים בינלאומיים, תראה מחירים ביורו', 'אפשר לשנות את המטבע של החשבון שלי לדולר?', 'תגדיר את החשבון שלנו כחשבון בינלאומי',
  'אני מעדיף לעבוד עם שקלים בדשבורד', 'האם אני רשום כלקוח מקומי?', 'למעשה אנחנו לקוחות זרים', 'נניח שאנחנו משתמשים מקומיים ותציג את הכל בשקלים',
  'איזה מטבע מוצג בחשבון שלי?', 'תראה לי בדשבורד מחירים בליש"ט ותתייחס אליי כלקוח בינלאומי',
]);

export const GRAMMAR_UNSEEN_EN = Object.freeze([
  'We are, in fact, overseas customers.', 'Both of us are local users of this account.', 'Our profile falls under the foreign market.', 'Could you treat us like international clients?',
  'I would like my account to display prices in euros.', 'Every one of us is a local customer.', 'Please switch the whole app to GBP.', 'Is our business part of the international market?',
  'Can you display the dashboard in dollars for us?', 'What if we were domestic clients?', 'The two of us are foreign users.', 'Apparently my account is under the overseas market.',
  'Let us assume we are local customers and show prices in shekels.', 'I would rather see everything in pounds.', 'Consider all of us international customers.', 'Are we able to use dollars on this account?',
  'We belong to the local market, right?', 'Regard us as overseas users, please.', 'Our account is in the international market.', 'I need this business to be shown in euros.',
  'Pretend both of us are foreign clients.', 'Which market does my account belong to?', 'We seem to be local customers.', 'Show us the app in USD.',
  'Set our business as a domestic account.', 'My account should be international, not local.', 'Are we considered overseas customers?', 'Can we work in euros here?',
  'We are officially international users.', 'I am an international user who wants dollars.',
]);

export const GRAMMAR_UNSEEN_CROSS = Object.freeze([
  'We are overseas customers; please show every price in dollars.', 'אנחנו לקוחות זרים - תציג את המחירים בדולר', 'Our account belongs to the international market, so treat us as foreign users.',
  'האם החשבון שלנו שייך לשוק המקומי? אני רוצה לראות שקלים', 'Pretend we are local clients: display prices in ILS.', 'I am a foreign user — can my dashboard show euros?',
  'תחשיב אותנו כמשתמשים מקומיים, ותציג הכל בשקלים', 'All of us are overseas users. Can the account work in pounds?', 'שנינו לקוחות בינלאומיים; אפשר להציג בדשבורד דולרים?',
  'Apparently our business is local—switch the app to shekels.', 'We really are foreign customers, so I want prices in USD.', 'הפרופיל שלנו נמצא בשוק הבינלאומי, אז נניח שאנחנו לקוחות זרים',
  'Kindly treat us as international users - and show all amounts in euros.', 'האם העסק שלי שייך לשוק המקומי או לשוק הבינלאומי?', 'Both of us are local users: is it possible to see dollars?',
  'אני משתמש בינלאומי. Show me prices in dollars.', 'Every one of us is an overseas client, and we prefer EUR.', 'תענה כאילו אנחנו לקוחות מחו"ל, ותגיד אם החשבון שלנו בינלאומי',
  'Our account is under the local market. Please show prices in dollars.', 'Are we international customers? אם כן, תציג לנו מחירים ביורו',
]);

/** >= 100 FRESH negative controls across the required categories - none is an account market / currency intent */
export const GRAMMAR_NEGATIVE_CONTROLS = Object.freeze([
  // CRM / customer management (EN)
  'Add overseas customers to my list', 'Show all foreign clients created this month', 'Filter international users by country', 'Show foreign customers', 'Import my local clients from a spreadsheet',
  'Which of my customers are international?', 'Tag all overseas clients as VIP', 'Delete the domestic contacts from my account', 'Export international customers to CSV', 'Send a reminder to my foreign clients',
  'How many local customers do I have?', 'Group my clients into local and international', 'Create a segment for overseas leads', 'Sort customers by market', 'Do you have a report for international clients?',
  'Mark my customers as local', 'Classify our clients as overseas users', 'Treat my leads as international contacts', 'Count our foreign customers', 'Move my local clients to a new list',
  // CRM (HE)
  'תציג לי לקוחות בינלאומיים', 'תסמן את הלקוחות שלי כלקוחות מקומיים', 'אילו לקוחות זרים יש לי?', 'תוסיף לקוחות מחו"ל לרשימה', 'סנן משתמשים בינלאומיים',
  'כמה לקוחות מקומיים יש לי?', 'תייצא את הלקוחות הזרים לקובץ', 'תמחק את המשתמשים הישראלים', 'איך אני מוסיף לקוח בינלאומי?', 'תשלח תזכורת ללקוחות בינלאומיים',
  'תסווג את הלקוחות שלנו כלקוחות זרים', 'תחשיב את הלקוח הזה כלקוח מקומי',
  // user management
  'Add a new user to our business', 'Can my employees see the customer list?', 'Give our accountant access to the dashboard', 'Which users belong to our account?', 'Remove users who are overseas',
  'Our users are overseas customers of our clients', 'Who are the members of my account?', 'Invite a colleague to the workspace',
  'איזה משתמשים שייכים לחשבון שלנו?', 'תוסיף משתמש חדש לעסק שלנו',
  // dashboard / widget actions
  'Add a widget to the dashboard', 'Show my dashboard in dark mode', 'Can the dashboard show a local map?', 'Move the widget to the international section', 'Switch to the calendar view',
  'Set the dashboard to full screen', 'Where is the settings page in my account?', 'Rename my dashboard tab',
  "תוסיף וידג'ט לדשבורד", 'אפשר להציג את הדשבורד במצב כהה?', "תעביר את הווידג'ט לחלק העליון", 'איך משנים שפה בדשבורד?',
  // charts
  'Show a chart of USD to ILS over time', 'Graph the euro versus the pound', 'Plot my monthly revenue in dollars', 'Add a bar chart of GBP sales',
  'תציג גרף של הדולר מול השקל', 'אפשר להוסיף תרשים של יורו בדשבורד?',
  // quote creation
  'Create a quote for an overseas customer', 'I want to send a quote in euros to my client', 'Make a proposal in dollars for a foreign client', 'Generate an invoice in pounds',
  'How do I issue a quote in USD?', 'Add an item priced in euros to the quote',
  'אני רוצה ליצור הצעה בדולרים ללקוח', 'תכין הצעת מחיר ביורו', 'איך מוציאים חשבונית בליש"ט?',
  // invoice / accounting
  'Where can I see my invoices?', 'Export my accounting data', 'Is there VAT for international customers?', 'Do you charge tax on overseas sales?',
  // calculator
  'Use the calculator to convert 50 EUR to USD', 'Does the calculator support pounds?', 'Open the currency calculator',
  'תשתמש במחשבון להמרת דולרים לשקלים', 'כמה זה 100 יורו בשקלים?',
  // exchange rates
  'What is the dollar to shekel rate?', 'Show me the exchange rate for euros', 'Is the pound stronger than the euro?', 'What was the dollar rate yesterday',
  'מה שער הדולר היום', 'האם הדולר עלה השבוע?', 'מה שער הליש"ט?',
  // banking
  'Can I wire euros to my bank?', 'Where do I deposit dollars?', 'I need a loan in pounds', 'How do I pay my subscription by credit card?',
  'אפשר להעביר דולרים לבנק?', 'אני צריך הלוואה בשקלים', 'איך משלמים בכרטיס אשראי?',
  // generic currency knowledge / translation / spelling
  'How do you say dollars in Hebrew?', 'How do you spell sterling?', 'What does the abbreviation GBP mean?', 'What currency does Japan use?', 'Translate international customers into Hebrew',
  'Which countries use the euro?', 'Which currency symbol is used for shekels?',
  'איך אומרים דולר באנגלית?', 'איך כותבים ליש"ט?', 'מה המשמעות של EUR?', 'באילו מדינות משתמשים ביורו?', 'איזה מטבע יש ביפן?',
  // customer-specific quote currency
  'My client wants the quote in dollars', 'This customer pays in euros', 'Set the quote currency for this client to USD', 'Invoice my overseas client in euros', 'Charge this customer in dollars',
  'I want to bill my clients in USD', 'Show my customer the prices in pounds',
  'הלקוח שלי רוצה הצעה בדולרים', 'הלקוח הזה משלם ביורו', 'תגדיר את מטבע ההצעה של הלקוח הזה לדולר',
  // market / international words in unrelated prose
  'The local market opens at nine', 'We are pleased with the international response to our launch', 'I love the local coffee shop', 'We are foreign to this software',
  'We are local experts in aluminium windows', 'Our business is going international next year', 'Our account manager is local', 'This profile picture is foreign', 'I am an overseas student looking for a job',
  'Is there a local pharmacy near me?', 'The user is a foreign national', 'International shipping takes a week',
  'השוק המקומי נפתח בתשע', 'אנחנו מרוצים מהתגובה הבינלאומית', 'אני אוהב את בית הקפה המקומי', 'העסק שלנו מתרחב לחו"ל בשנה הבאה', 'אני מחפש עבודה בחו"ל',
  'אנחנו מחפשים ספק זר', 'הסטודנטים הזרים הגיעו', 'הפרופיל שלי מוצג לצוות',
]);
