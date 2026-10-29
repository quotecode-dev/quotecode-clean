// Codex release 4 (Owner 2026-10-29, typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"; migrations 20261030200000 + 20261030300000) - against a REAL Postgres (disposable
// container only), two sessions released at the same instant by an advisory-lock barrier, each holding its transaction open:
//   1. the AI budget: 5 dollars left, two 5-dollar reservations at once -> exactly one admitted (the month row is locked per admission);
//   2. the article topics: two article flows claim the same topic at once -> exactly one claim, the other refused as a duplicate.
import { spawn } from 'node:child_process';

function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql exit ${code}: ${err.trim().slice(0, 400)}`))));
    p.stdin.end(`${sql}\n`);
  });
}
function holdBarrier(container, lockKey) {
  const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A']);
  let out = '';
  const ready = new Promise((resolve) => { p.stdout.on('data', (d) => { out += d; if (out.includes('BARRIER_HELD')) resolve(); }); });
  p.stdin.write(`SELECT pg_advisory_lock(${lockKey});\n\\echo BARRIER_HELD\n`);
  return { ready, release: () => new Promise((resolve) => { p.on('close', resolve); p.stdin.end(`SELECT pg_advisory_unlock(${lockKey});\n\\q\n`); }) };
}
const jsonLine = (out) => { const l = String(out).split('\n').find((x) => x.trim().startsWith('{')); return l ? JSON.parse(l) : null; };

async function race(container, q, lock, statements) {
  const barrier = holdBarrier(container, lock);
  await barrier.ready;
  const one = (statement) => q(`SELECT pg_advisory_lock_shared(${lock});
BEGIN;
${statement}
SELECT pg_sleep(1.5);
COMMIT;`).then(jsonLine, (e) => ({ error: String(e.message).slice(0, 200) }));
  const workers = statements.map(one);
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < 2; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
    if (waiting < 2) await new Promise((r) => setTimeout(r, 250));
  }
  await barrier.release();
  return { waiting, results: await Promise.all(workers) };
}

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);

  // 1. the final budget slot
  const first = jsonLine(await q(`SELECT public.agents_ai_reserve('2041-01', 'manager_weekly', 'gpt-6-luna', 'v1', 100, 100, 15000000);`));
  ok(first?.ok === true, 'BUDGET setup: 15 of 20 dollars reserved, 5 left', first);
  const reserve = `SELECT public.agents_ai_reserve('2041-01', 'guide_article', 'gpt-6-luna', 'v1', 100, 6000, 5000000);`;
  const b = await race(container, q, 7_437_001, [reserve, reserve]);
  ok(b.waiting === 2, 'BUDGET: both sessions blocked on the barrier before release', b.waiting);
  ok(b.results.filter((r) => r?.ok === true).length === 1 && b.results.filter((r) => r?.code === 'budget_insufficient').length === 1,
    'BUDGET: two simultaneous 5-dollar reservations for the last 5 dollars -> exactly one admitted, the other refused', b.results);
  const state = jsonLine(await q(`SELECT public.agents_ai_budget_state('2041-01');`));
  ok(Number(state?.committed_micros) === 20000000, 'BUDGET: the month holds exactly its 20-dollar cap', state);

  // 2. the same topic claimed by two article flows at once
  await q(`INSERT INTO public.agent_actions (id, run_key, source, kind, action_type, title_he, title_en, payload) VALUES
  ('a4370000-0000-4000-8000-000000000001', 'db437', 'manager', 'system', 'article_draft', 'גינון', 'Landscaping', '{}'),
  ('a4370000-0000-4000-8000-000000000002', 'db437', 'manager', 'system', 'article_draft', 'גינון', 'Landscaping', '{}') ON CONFLICT DO NOTHING;`);
  const claim = (n) => `SELECT public.agents_article_claim('a4370000-0000-4000-8000-00000000000${n}', 'topic', 'הצעת מחיר לגינון', 'landscaping quotes', 'הצעת מחיר לגינון', 'Landscaping quotes', NULL);`;
  const t = await race(container, q, 7_437_002, [claim(1), claim(2)]);
  ok(t.waiting === 2, 'TOPIC: both sessions blocked on the barrier before release', t.waiting);
  ok(t.results.filter((r) => r?.ok === true).length === 1 && t.results.filter((r) => r?.code === 'duplicate_topic').length === 1,
    'TOPIC: two article flows claiming the same topic at once -> exactly one claim, the other refused as a duplicate', t.results);
  const refs = Number(await q(`SELECT count(DISTINCT ref_id) FROM public.article_topic_claims WHERE status = 'active' AND norm IN ('הצעת מחיר לגינון', 'landscaping quotes');`));
  const rows = Number(await q(`SELECT count(*) FROM public.article_topic_claims WHERE status = 'active' AND norm IN ('הצעת מחיר לגינון', 'landscaping quotes');`));
  ok(refs === 1 && rows === 2, 'TOPIC: one flow holds the topic, in both languages', { refs, rows });
  return { assertions };
}
