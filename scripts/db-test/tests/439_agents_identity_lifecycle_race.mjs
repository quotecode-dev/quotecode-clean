// Night task 29-30/10 (migration 20261030400000, Codex R4-01 / R4-03) - against a REAL Postgres (disposable container only), two sessions
// released at the same instant by an advisory-lock barrier, each holding its transaction open:
//   1. flow A claims text X as its HEADING while flow B claims the same X as its TOPIC -> exactly one owns X (one namespace across kinds);
//   2. two flows claim different topics with the same distinct FOCUS -> exactly one;
//   3. saving a written draft and a stale rejection of the same flow -> the save wins, the rejection changes nothing (no resurrection).
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
  for (let i = 0; i < 120 && waiting < statements.length; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
    if (waiting < statements.length) await new Promise((r) => setTimeout(r, 250));
  }
  await barrier.release();
  return { waiting, results: await Promise.all(workers) };
}
const A = (n) => `a4390000-0000-4000-8000-00000000000${n}`;

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  await q(`INSERT INTO public.agent_actions (id, run_key, source, kind, action_type, title_he, title_en, payload) VALUES
  ('${A(1)}', 'db439', 'manager', 'system', 'article_draft', 'א', 'A', '{}'), ('${A(2)}', 'db439', 'manager', 'system', 'article_draft', 'ב', 'B', '{}'),
  ('${A(3)}', 'db439', 'manager', 'system', 'article_draft', 'ג', 'C', '{}'), ('${A(4)}', 'db439', 'manager', 'system', 'article_draft', 'ד', 'D', '{}'),
  ('${A(5)}', 'db439', 'manager', 'system', 'article_draft', 'ה', 'E', '{}') ON CONFLICT DO NOTHING;`);

  // 1. heading of A vs topic of B, the same text
  const k = await race(container, q, 7_439_001, [
    `SELECT public.agents_article_claim('${A(1)}', 'title', 'הצעת מחיר לניקיון', 'cleaning quotes', 'הצעת מחיר לניקיון', 'Cleaning quotes', NULL);`,
    `SELECT public.agents_article_claim('${A(2)}', 'topic', 'הצעת מחיר לניקיון', 'cleaning quotes', 'הצעת מחיר לניקיון', 'Cleaning quotes', NULL);`]);
  ok(k.waiting === 2, 'KIND: both sessions blocked on the barrier before release', k.waiting);
  ok(k.results.filter((r) => r?.ok === true).length === 1 && k.results.filter((r) => r?.code === 'duplicate_topic').length === 1,
    'KIND: a heading and a topic of two flows with the same text at once -> exactly one owns it', k.results);

  // 2. the same focus, different topics
  const f = await race(container, q, 7_439_002, [
    `SELECT public.agents_article_admit('${A(3)}', 'drafting:${A(3)}', 900, 'שיפוצי מטבח', 'kitchen renovation', 'שיפוצי מטבח', 'Kitchen renovation', 'רק חדרי רחצה קטנים', 'רק חדרי רחצה קטנים');`,
    `SELECT public.agents_article_admit('${A(4)}', 'drafting:${A(4)}', 900, 'שיפוצי אמבטיה', 'bathroom renovation', 'שיפוצי אמבטיה', 'Bathroom renovation', 'רק חדרי רחצה קטנים!', 'רק חדרי רחצה קטנים');`]);
  ok(f.waiting === 2, 'FOCUS: both sessions blocked on the barrier before release', f.waiting);
  ok(f.results.filter((r) => r?.ok === true).length === 1 && f.results.filter((r) => r?.code === 'duplicate_topic' && r?.lang === 'focus').length === 1,
    'FOCUS: two flows with the same distinct focus at once -> exactly one admitted', f.results);

  // 3. a save and a stale rejection of the same flow
  const adm = jsonLine(await q(`SELECT public.agents_article_admit('${A(5)}', 'drafting:${A(5)}', 900, 'הצעת מחיר לגינון ב-db439', 'db439 landscaping quotes', 'הצעת מחיר לגינון ב-db439', 'db439 Landscaping quotes', NULL, NULL);`));
  ok(adm?.ok === true, 'SAVE: flow E is admitted and writing', adm);
  const s = await race(container, q, 7_439_003, [
    `SELECT public.agents_article_save_draft('${A(5)}', 'drafting:${A(5)}', 'db439-landscaping', 'intl', '{"h1":"גינון"}', '{"h1":"Landscaping"}', 'גינון ב-db439', 'db439 landscaping', 'ל', 'R', 'x', 'x');`,
    `SELECT public.agents_article_reject('${A(5)}', 900);`]);
  ok(s.waiting === 2, 'SAVE: both sessions blocked on the barrier before release', s.waiting);
  const status = await q(`SELECT status FROM public.agent_actions WHERE id = '${A(5)}';`);
  const stored = Number(await q(`SELECT count(*) FROM public.site_articles WHERE action_id = '${A(5)}';`));
  ok((s.results[0]?.ok === true && status === 'done' && stored === 1 && ['drafting', 'not_pending'].includes(s.results[1]?.code)),
    'SAVE: the save and a stale rejection at once -> the draft is stored once, the rejection changes nothing', { results: s.results, status, stored });
  return { assertions };
}
