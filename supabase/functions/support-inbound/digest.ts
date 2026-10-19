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

export type DigestRow = { from_address: string; subject: string | null; bin: string | null; status: string; bin_reason: string | null; summary: string | null; reply_sent_by: string | null; stored_at: string };

const BIN_HE: Record<string, string> = { green: 'ירוק', yellow: 'צהוב', red: 'אדום', black: 'שחור' };

export function buildDigest(day: string, today: DigestRow[], waiting: DigestRow[]): { subject: string; text: string } {
  const count = (f: (r: DigestRow) => boolean) => today.filter(f).length;
  const lines = [
    `סיכום הפניות של היום (${day.split('-').reverse().join('/')})`,
    '',
    `התקבלו היום: ${today.length}`,
    `ירוק: ${count((r) => r.bin === 'green')}  ·  צהוב: ${count((r) => r.bin === 'yellow')}  ·  אדום: ${count((r) => r.bin === 'red')}  ·  שחור: ${count((r) => r.bin === 'black')}`,
    `נענו לבד על ידי העוזר: ${count((r) => r.reply_sent_by === 'assistant')}`,
    `נענו על ידך: ${count((r) => r.reply_sent_by === 'owner')}`,
    '',
    waiting.length ? `ממתינות לך עכשיו: ${waiting.length}` : 'אין פניות שממתינות לך.',
  ];
  for (const r of waiting.slice(0, 20)) {
    const kind = r.status === 'draft' ? 'טיוטה לאישור' : 'צריך אותך';
    // the address and the summary each on their own line (a plain-text client never mixes their directions)
    lines.push('', `${BIN_HE[r.bin || ''] || '-'} - ${kind}`, r.from_address, String(r.summary || r.subject || '(ללא נושא)').slice(0, 160));
  }
  if (waiting.length > 20) lines.push(`ועוד ${waiting.length - 20}.`);
  lines.push('', 'לטיפול: ממשק הניהול, לשונית "פניות"', 'https://www.tekango.com/dashboard');
  return { subject: `סיכום הפניות של היום: ${waiting.length} ממתינות לך`, text: lines.join('\n') };
}
