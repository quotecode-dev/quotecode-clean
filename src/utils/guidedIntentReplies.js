// Task 33 (Owner finding: choosing „הצעה לשיפור” in the chat showed only the chosen chip - no answer, no question).
// Root cause: every 'model_answer' guided leaf (guidedChatIntents.js TERMINAL_OUTCOMES) only set a soft hint for the NEXT typed message and
// showed the generic "you can also type directly" line, so a click looked like it did nothing.
// This pure module gives every guided leaf an IMMEDIATE, truthful reply: what the assistant can do for that topic HERE, built only from the
// bounded structured facts the chat already holds (helpSources: counts / booleans - never item text, client details or amounts), plus
// optional one-click follow-ups that send a real request to chat-ai (loading / answer / error + retry are the widget's normal states).
// Task 34: "suggestion" = system feedback only; reviewing the open quote is the separate, explicit 'quote_improvement' action (the widget
// sends the current form snapshot only when the user clicks it). Nothing here changes a quote, saves or counts anything.

const T = (isHebrew, he, en) => (isHebrew ? he : en);

function editorFacts(helpSources) {
  const editor = helpSources?.editor;
  if (!editor?.open) return null;
  const wf = helpSources.workflow || {};
  return {
    mode: editor.mode === 'edit' ? 'edit' : 'new',
    itemCount: Number(wf.itemCount) || 0,
    unpriced: Number(editor.unpricedItemCount) || 0,
    hasClient: !!wf.hasClient,
    dirty: !!helpSources.draft?.dirty,
  };
}

function editorSummary(f, isHebrew) {
  const parts = [];
  parts.push(f.itemCount === 1 ? T(isHebrew, 'פריט אחד', 'one item') : T(isHebrew, `${f.itemCount} פריטים`, `${f.itemCount} items`));
  if (f.unpriced > 0) parts.push(f.unpriced === 1 ? T(isHebrew, 'פריט אחד בלי מחיר', 'one item without a price') : T(isHebrew, `${f.unpriced} פריטים בלי מחיר`, `${f.unpriced} items without a price`));
  if (!f.hasClient) parts.push(T(isHebrew, 'עוד לא נבחר לקוח', 'no client chosen yet'));
  // the project name is optional („שם פרויקט (לא חובה)”) - never presented as a gap
  return parts.join(T(isHebrew, ', ', ', '));
}

const action = (id, label, message) => ({ id, label, message });

// Task 34: the fixed text of the explicit review request (also checked against chat-ai's deterministic classifiers in its tests).
export const QUOTE_REVIEW_MESSAGES = {
  he: 'בדקו את הפריטים בהצעה שפתוחה לפניי והציעו שיפורים',
  en: 'Review the items of the quote open in front of me and suggest improvements',
};

// Returns { text, actions } for a chosen guided leaf, or null when the leaf has its own flow ('quotes' second step) / no reply.
export function buildGuidedIntentReply(intentId, { isHebrew = true, isDashboard = false, helpSources = null } = {}) {
  const f = isDashboard ? editorFacts(helpSources) : null;
  switch (intentId) {
    // Task 34 (Codex review, finding 2): "suggestion" is SYSTEM FEEDBACK only (a product idea) - everywhere. Reviewing the open quote is
    // the separate 'quote_improvement' action below; a count of items is never presented as an analysis of the quote's content.
    case 'suggestion':
      return {
        text: T(isHebrew,
          'יש לכם רעיון לשיפור המערכת או תכונה שחסרה לכם? כתבו אותו כאן במשפט או שניים, ואענה מה קיים כבר במערכת ומה לא.',
          "Have an idea to improve the system, or a feature you're missing? Write it here in a sentence or two, and I'll tell you what already exists in the system and what doesn't."),
        actions: [],
      };
    // Task 34: "Improve this quote" - the review itself runs only when the user clicks the explicit action; the widget then sends the
    // current form snapshot (description / quantity / unit / price per item + subject; no client data) for that one request.
    case 'quote_improvement': {
      if (!f) {
        return { text: T(isHebrew, 'פתחו הצעת מחיר (חדשה או קיימת), ואז אפשר לבקש כאן בדיקה של הפריטים שלה.', 'Open a quote (new or existing), then you can ask here for a review of its items.'), actions: [] };
      }
      if (f.itemCount === 0) {
        return {
          text: T(isHebrew,
            'בהצעה הפתוחה עדיין אין פריטים לבדיקה. הוסיפו פריטים (ידנית או עם טיוטת AI), ואז בקשו בדיקה.',
            'The open quote has no items to review yet. Add items (manually or with an AI draft), then ask for a review.'),
          actions: [],
        };
      }
      return {
        text: T(isHebrew,
          'אבדוק את הפריטים של ההצעה שפתוחה לפניכם עכשיו, כולל שינויים שעוד לא נשמרו: ניסוח, פרטים חסרים, כמויות ויחידות ומחירים שלא הוזנו. לבדיקה יישלחו רק נושא ההצעה ולכל פריט תיאור, כמות, יחידה ומחיר — בלי פרטי הלקוח. הבדיקה לא שומרת, לא שולחת ולא משנה את ההצעה; את התיקונים תעשו בטופס.',
          "I'll review the items of the quote that is open in front of you now, including unsaved changes: wording, missing details, quantities and units, and prices not entered yet. Only the quote subject and, per item, the description, quantity, unit and price are sent for the review — no client details. The review does not save, send or change the quote; you make the changes in the form."),
        actions: [{ id: 'analyze_draft', kind: 'analyze_draft', label: T(isHebrew, 'בדקו את ההצעה שלפניי', 'Review the quote in front of me'), message: QUOTE_REVIEW_MESSAGES[isHebrew ? 'he' : 'en'] }],
      };
    }
    case 'current_process_help': {
      if (f) {
        return {
          text: T(isHebrew,
            `אתם ${f.mode === 'edit' ? 'עורכים הצעה קיימת' : 'יוצרים הצעה חדשה'}: ${editorSummary(f, isHebrew)}. באיזה שלב אתם צריכים עזרה?`,
            `You are ${f.mode === 'edit' ? 'editing an existing quote' : 'creating a new quote'}: ${editorSummary(f, isHebrew)}. Which step do you need help with?`),
          actions: [action('next_step', T(isHebrew, 'מה הצעד הבא?', 'What is the next step?'),
            T(isHebrew, 'מה הצעד הבא בהצעה שפתוחה כרגע?', "What is the next step in the quote I'm working on now?"))],
        };
      }
      return {
        text: T(isHebrew, 'ספרו לי על מה אתם עובדים עכשיו או איפה נתקעתם, ואסביר את הצעד הבא.', "Tell me what you're working on right now or where you got stuck, and I'll explain the next step."),
        actions: [],
      };
    }
    case 'clients':
      return {
        text: T(isHebrew,
          'במה אפשר לעזור עם לקוחות? אני מסביר איך בוחרים לקוח קיים להצעה, מוסיפים לקוח חדש או מוצאים לקוח במסך הלקוחות. את פרטי הלקוחות עצמם משנים אתם — אני לא משנה אותם.',
          'How can I help with clients? I can explain how to pick an existing client for a quote, add a new client or find a client on the Clients screen. You change client details yourself — I do not change them.'),
        actions: [
          action('client_pick', T(isHebrew, 'איך בוחרים לקוח להצעה?', 'How do I pick a client for a quote?'), T(isHebrew, 'איך בוחרים לקוח קיים להצעה?', 'How do I pick an existing client for a quote?')),
          action('client_add', T(isHebrew, 'איך מוסיפים לקוח חדש?', 'How do I add a new client?'), T(isHebrew, 'איך מוסיפים לקוח חדש?', 'How do I add a new client?')),
        ],
      };
    case 'technical_problem':
      return { text: T(isHebrew, 'מה קרה? תארו מה ניסיתם לעשות ומה הופיע על המסך (למשל הודעת שגיאה), ואעזור לבדוק.', 'What happened? Describe what you tried to do and what appeared on screen (for example an error message), and I will help you check it.'), actions: [] };
    case 'software_help':
      return { text: T(isHebrew, 'על איזו פעולה במערכת תרצו הסבר? למשל יצירת הצעה, שליחה ללקוח, קטלוג או הגדרות העסק.', 'Which part of the system would you like explained? For example creating a quote, sending it to a client, the catalog or business settings.'), actions: [] };
    case 'plans_subscription':
      return { text: T(isHebrew, 'מה תרצו לדעת על המסלולים או המנוי? אענה לפי המצב האמיתי של החשבון והמחירים המאושרים.', 'What would you like to know about plans or the subscription? I answer from the real account state and the approved prices.'), actions: [] };
    case 'billing_payment':
      return { text: T(isHebrew, 'מה השאלה לגבי תשלום או חיוב? אענה לפי מה שבאמת פעיל היום בחשבון.', 'What is your question about payment or billing? I answer from what is actually active in the account today.'), actions: [] };
    case 'business_settings':
      return { text: T(isHebrew, 'מה תרצו לעדכן בפרטי העסק — שם, לוגו, טלפון, מספר עוסק או העדפות? אסביר איפה עושים את זה.', 'What would you like to update in the business details — name, logo, phone, tax number or preferences? I will explain where to do it.'), actions: [] };
    case 'general_question':
      return { text: T(isHebrew, 'מה השאלה? כתבו אותה כאן ואענה.', 'What is your question? Write it here and I will answer.'), actions: [] };
    default:
      return null;
  }
}
