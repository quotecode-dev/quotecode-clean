// Smart support email, stage 2 - the FIXED texts (spec section 4: "נוסחים קבועים, לא משתנים על ידי המודל"). Plain text: every line is in
// ONE language, so no mail client can reverse the word order (Owner 2026-10-20: "זה לא הוצג נכון באנגלית בגלל ה RTL") - the brand
// TEKANGO always stands on its own line in a Hebrew text.

export type Lang = 'he' | 'en';
export type FixedKind = 'red_ack' | 'bug_received' | 'request_noted';

const SIGN = { he: 'בברכה,\nצוות התמיכה\nTEKANGO', en: 'Best regards,\nThe TEKANGO Support Team' };

const TEXTS: Record<FixedKind, Record<Lang, string>> = {
  red_ack: {
    he: 'שלום,\n\nקיבלנו את פנייתך והעברנו אותה לגורם המטפל.\nנחזור אליך בהקדם האפשרי.',
    en: 'Hello,\n\nWe received your message and forwarded it to the relevant team.\nWe will get back to you as soon as possible.',
  },
  bug_received: {
    he: 'שלום,\n\nתודה על הדיווח. קיבלנו אותו ואנחנו בודקים.\nנעדכן אותך כשהבעיה תטופל.',
    en: 'Hello,\n\nThank you for the report. We received it and we are looking into it.\nWe will let you know once it is fixed.',
  },
  request_noted: {
    he: 'שלום,\n\nתודה על ההצעה. רשמנו אותה.\nנעדכן אותך אם היכולת תתווסף למערכת.',
    en: 'Hello,\n\nThank you for the suggestion. We have noted it.\nWe will let you know if the capability is added.',
  },
};

export function fixedText(kind: FixedKind, lang: Lang): string {
  return `${TEXTS[kind][lang]}\n\n${SIGN[lang]}`;
}

/** The signature the model's drafts end with (the model is told to write the body only). */
export function signature(lang: Lang): string {
  return SIGN[lang];
}

/** "Re: <subject>" once, never "Re: Re:". */
export function replySubject(subject: string | null, lang: Lang): string {
  const s = String(subject || '').trim();
  if (!s) return lang === 'he' ? 'תשובה מצוות TEKANGO' : 'Reply from the TEKANGO team';
  return /^re:/i.test(s) ? s.slice(0, 900) : `Re: ${s}`.slice(0, 900);
}

/** The mailbox the customer wrote to (support / info) - the forwarded copy arrives at <box>@<receiving domain>. */
export function mailboxOf(toAddresses: string[] | null | undefined): 'support' | 'info' | null {
  for (const a of toAddresses || []) {
    const local = String(a).toLowerCase().split('@')[0];
    if (local === 'support' || local === 'info') return local;
  }
  return null;
}

export function senderFor(mailbox: 'support' | 'info' | null): { from: string; replyTo: string } {
  return mailbox === 'info'
    ? { from: 'TEKANGO <info@tekango.com>', replyTo: 'info@tekango.com' }
    : { from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com' };
}
