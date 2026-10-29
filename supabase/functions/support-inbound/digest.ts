// Smart support email, stage 2 - the Owner's evening summary (spec 6: "בכל ערב: מייל סיכום אחד"; Owner 2026-10-19: at 20:00 Israel
// time). Pure: the caller reads the rows; this only decides the hour and writes the text. Hebrew only (the Owner's language), every
// line in one language so no mail client reverses it.

export const DIGEST_HOUR = 20;

/** The Israel-time hour and date of `now` (summer / winter time handled by the time zone database). */
export function israelClock(now: Date): { hour: number; day: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { hour: Number(get('hour')), day: `${get('year')}-${get('month')}-${get('day')}` };
}

export type DigestRow = { from_address: string; subject: string | null; bin: string | null; status: string; bin_reason: string | null; summary: string | null; reply_sent_by: string | null; stored_at: string; conversation_id?: string | null };

const BIN_HE: Record<string, string> = { green: 'ירוק', yellow: 'צהוב', red: 'אדום', black: 'שחור', grey: 'אפור' };
// Codex release 5 (decision 8): a conversation's priority comes from its unresolved GENUINE messages - a grey follow-up never lowers
// a red request
const BIN_RANK: Record<string, number> = { red: 0, yellow: 1, green: 2, grey: 3 };

export function buildDigest(day: string, today: DigestRow[], waiting: DigestRow[]): { subject: string; text: string } {
  const count = (f: (r: DigestRow) => boolean) => today.filter(f).length;
  // unresolved conversations (an email without a conversation is its own), each with its pending messages, oldest first
  const groups = new Map<string, DigestRow[]>();
  waiting.forEach((r, i) => { const k = r.conversation_id || `message:${i}`; groups.set(k, [...(groups.get(k) ?? []), r]); });
  const convs = [...groups.values()].map((rows) => {
    const top = [...rows].sort((a, b) => (BIN_RANK[a.bin || ''] ?? 9) - (BIN_RANK[b.bin || ''] ?? 9))[0];
    return { rows, top, newest: rows[rows.length - 1] };
  });
  const lines = [
    `סיכום הפניות של היום (${day.split('-').reverse().join('/')})`,
    '',
    `התקבלו היום: ${today.length}`,
    `ירוק: ${count((r) => r.bin === 'green')}  ·  צהוב: ${count((r) => r.bin === 'yellow')}  ·  אדום: ${count((r) => r.bin === 'red')}  ·  אפור: ${count((r) => r.bin === 'grey')}  ·  שחור: ${count((r) => r.bin === 'black')}`,
    `פניות שהעוזר ענה עליהן אוטומטית: ${count((r) => r.reply_sent_by === 'assistant')}`,
    `פניות שעניתם עליהן: ${count((r) => r.reply_sent_by === 'owner')}`,
    '',
    convs.length ? `שיחות שממתינות לך: ${convs.length}` : 'אין פניות שממתינות לך.',
  ];
  if (convs.length) lines.push(`הודעות שממתינות לך: ${waiting.length}`);
  for (const c of convs.slice(0, 20)) {
    const kind = c.top.bin === 'grey' ? 'ייתכן שזו הודעה אוטומטית' : c.top.status === 'draft' ? 'טיוטה לאישור' : 'צריך אותך';
    // the address and the summary each on their own line (a plain-text client never mixes their directions)
    lines.push('', `${BIN_HE[c.top.bin || ''] || '-'} - ${kind}`);
    if (c.rows.length > 1) lines.push(`הודעות ממתינות בשיחה: ${c.rows.length}`);
    lines.push(c.top.from_address, String(c.newest.summary || c.newest.subject || c.top.summary || c.top.subject || '(ללא נושא)').slice(0, 160));
  }
  if (convs.length > 20) lines.push(`ועוד ${convs.length - 20}.`);
  lines.push('', 'לטיפול: ממשק הניהול, לשונית "פניות"', 'https://www.tekango.com/dashboard');
  return { subject: `סיכום הפניות של היום - שיחות שממתינות לך: ${convs.length}`, text: lines.join('\n') };
}
