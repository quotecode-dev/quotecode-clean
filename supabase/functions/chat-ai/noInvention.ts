// Owner console 2026-10-19 ("איך אתה אומר שהוא לא ממציא והוא אמר לצרף צילום מסך"): the model offered to receive a screenshot the chat
// could not receive. Two layers, for every model answer:
//  1. the prompt rule: never offer an action, button, upload or channel the product facts do not describe; when unsure how something
//     is done, say so and point to support - never guess steps;
//  2. the answer check: a sentence that offers to receive a FILE / DOCUMENT (never supported) - or a screenshot where the chat cannot
//     take one (the public chat) - is removed before the answer is shown.
// Pure (no Deno / network): runs identically under Deno and vitest.

// 20261029000000 (Codex F16): the mailbox follows the account market (marketIL), not the reply language
export function buildNoInventionBlock(isHebrew: boolean, screenshotsAvailable: boolean, marketIL: boolean = isHebrew): string {
  return [
    '',
    'NO INVENTED ACTIONS (hard rule):',
    '- Never offer, describe or suggest a button, menu, setting, upload, attachment, integration or channel that the product facts above do not describe. Never guess UI steps.',
    screenshotsAvailable
      ? '- The user CAN paste one screenshot into a question (or attach it with the paperclip on a phone). The user can NOT attach files or documents (PDF, Word, Excel, etc.) - never ask for them.'
      : '- The user can NOT attach screenshots, files or documents in this chat - never ask for them.',
    `- If you do not know how something is done in the product, say so plainly and suggest ${marketIL ? 'support@tekango.com' : 'info@tekango.com'} - do not invent steps.`,
  ].join('\n');
}

const FILE_WORDS_HE = /(קובץ|קבצים|מסמך|מסמכים|PDF|פי.?די.?אף|אקסל|וורד|גיליון)/i;
const SHOT_WORDS_HE = /(צילום מסך|צילומי מסך|תמונה|תמונת מסך|סקרינשוט)/;
const OFFER_HE = /(לצרף|תצרף|תצרפו|צרף|צרפו|לשלוח לי|תשלח לי|שלחו לי|להעלות|תעלה|העלו|להדביק|תדביק)/;
const FILE_WORDS_EN = /\b(file|files|document|documents|pdf|excel|spreadsheet|word doc)\b/i;
const SHOT_WORDS_EN = /\b(screenshot|screenshots|screen shot|image|photo|picture)\b/i;
const OFFER_EN = /\b(attach|upload|send me|share with me|paste)\b/i;
// the offer is addressed at the assistant itself (me / here / this chat / I will look at it)
const TO_ASSISTANT_HE = /(לי\b|לי[\s.,!?]|אליי|כאן|פה|בצ.?אט|בשיחה|ואבדוק|ואעבור|ואסתכל|ואקרא|אבדוק|אעבור על|אסתכל|אקרא|אוכל לבדוק|אוכל לעבור)/;
const TO_ASSISTANT_EN = /\b(me|here|this chat|the chat|in chat|i('ll| will| can)\s+(check|review|look|read|go over|analy[sz]e))\b/i;

/** Removes the sentences that offer something the chat cannot receive; the rest of the answer is kept as is. */
export function removeInventedOffers(answer: string, { screenshots }: { screenshots: boolean }): string {
  const text = String(answer ?? '');
  const parts = text.split(/(?<=[.!?。])\s+|\n/);
  const bad = (sentence: string) => {
    const offer = OFFER_HE.test(sentence) || OFFER_EN.test(sentence);
    if (!offer) return false;
    // Owner 2026-10-25 (typed L-17, QA report): a file is removed only when it is offered TO THE ASSISTANT ("send me the file", "attach it
    // here in the chat") - the product's own steps ("click Attach File and choose the file") are kept
    if ((FILE_WORDS_HE.test(sentence) || FILE_WORDS_EN.test(sentence)) && (TO_ASSISTANT_HE.test(sentence) || TO_ASSISTANT_EN.test(sentence))) return true;
    if (!screenshots && (SHOT_WORDS_HE.test(sentence) || SHOT_WORDS_EN.test(sentence))) return true;
    return false;
  };
  if (!parts.some(bad)) return text;
  // rebuild line by line so the original line breaks are kept
  return text.split('\n').map((line) => line.split(/(?<=[.!?])\s+/).filter((s) => !bad(s)).join(' ')).filter((line, i, all) => line.trim() || (i > 0 && all[i - 1].trim())).join('\n').trim();
}
