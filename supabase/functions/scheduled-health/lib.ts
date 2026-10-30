// Codex release 7 (Owner console 2026-10-30, decision 11; migration 20261030900000): the watcher of the scheduled runs, outside Vercel.
// Called every ten minutes by the database's own schedule (pg_cron + a Vault secret, set by the Owner) with x-schedule-secret. It asks the
// database which windows ended without a valid completion (scheduled_health_evaluate) and mails the Owner ONCE per incident and ONCE when
// the job works again; a failed delivery stays pending and is retried at the next call. Runtime-independent (deps injected).

export type Item = { id: number; job: string; label: string; window: string; kind: 'missed' | 'failed' | 'partial'; mail: 'alert' | 'recovery' };
export type HealthDeps = {
  secret: string;
  evaluate(): Promise<Item[]>;
  mailed(id: number, mail: 'alert' | 'recovery'): Promise<boolean>;
  send(mail: { subject: string; text: string; idempotencyKey: string }): Promise<boolean>;
};
export type Resp = { status: number; body: Record<string, unknown> };

export const sameText = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const ddmmyyyy = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);
const KIND_HE: Record<Item['kind'], string> = { missed: 'לא התקבל שום דיווח מההרצה', failed: 'ההרצה דיווחה על כשל', partial: 'ההרצה הושלמה רק בחלקה' };

/** The Owner's mail (Hebrew; the spec's sentences word for word, one language per line). */
export function mailFor(item: Item): { subject: string; text: string; idempotencyKey: string } {
  const key = `tekango-schedule/v1/${item.job}/${item.window}/${item.mail === 'alert' ? 'incident' : 'recovery'}`;
  if (item.mail === 'recovery') {
    return { subject: `ההרצה המתוזמנת חזרה לפעול: ${item.label}`, text: [`ההרצה המתוזמנת חזרה לפעול: ${item.label}.`, '', `החלון שהתקלה נפתחה בו: ${ddmmyyyy(item.window)}`].join('\n'), idempotencyKey: key };
  }
  return {
    subject: `הרצה מתוזמנת לא הושלמה: ${item.label}`,
    text: [
      `הרצה מתוזמנת לא הושלמה: ${item.label}. חלון ההרצה חלף ולא התקבלה השלמה תקינה. בדקו את הגדרות התזמון והחיבור.`,
      '',
      `החלון: ${ddmmyyyy(item.window)}`,
      `מה נמצא: ${KIND_HE[item.kind]}`,
      '',
      'לא תישלח תזכורת נוספת על אותה תקלה. כשההרצה תחזור לפעול יישלח מייל אחד.',
    ].join('\n'),
    idempotencyKey: key,
  };
}

export async function healthHandler(headerSecret: string | null, deps: HealthDeps): Promise<Resp> {
  if (!deps.secret) return { status: 500, body: { ok: false, code: 'not_configured' } };
  if (!headerSecret || !sameText(headerSecret, deps.secret)) return { status: 401, body: { ok: false, code: 'unauthorized' } };
  const items = await deps.evaluate();
  let mailed = 0;
  let pending = 0;
  for (const item of items) {
    const ok = await deps.send(mailFor(item)).catch(() => false);
    if (ok && await deps.mailed(item.id, item.mail).catch(() => false)) mailed += 1; else pending += 1;
  }
  return { status: 200, body: { ok: true, incidents: items.length, mailed, pending } };
}
