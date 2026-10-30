// Night task 29-30/10 (migrations 20261030500000 + 20261030600000, Codex release 5) - against a REAL Postgres (disposable container only):
//   1. HISTORY: emails stored before the release are reclassified from retained evidence only, in one rolled-back transaction that
//      replays both migration files over them (nothing is sent; colour, state and answers kept; a reply ban is never lifted; a second
//      replay changes nothing); every stored email gets a conversation, a reply of the same sender + mailbox joins its parent, past
//      acknowledgements / replies become outbound records (an acknowledgement's lost text is recorded as unknown, never invented).
//   2. RACE: two emails of one conversation claim its acknowledgement at the same instant -> exactly one claim.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql exit ${code}: ${err.trim().slice(-600)}`))));
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
const M = (n) => `a4410000-0000-4000-8000-00000000000${n}`;

export default async function run({ container, root }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  const mig = (f) => fs.readFileSync(path.join(root, 'supabase', 'migrations', f), 'utf8');

  // ---- 1. history (one transaction, rolled back) ----
  const out = await q(`SET client_min_messages = warning;
BEGIN;
INSERT INTO public.support_inbound_messages (id, provider_event_id, provider_email_id, message_id, in_reply_to, from_address, to_addresses, subject, text_body, received_at, mailbox, is_automated, bin, status, ack_sent_at, reply_text, reply_sent_at, reply_sent_by, automation_class, reply_allowed) VALUES
 ('${M(1)}', 'e441-1', 'm441-1', '<n1@a>', NULL, 'noreply@shop.test', ARRAY['support@in.test'], 'Order', 'x', now() - interval '5 days', 'support', true, 'black', 'ignored', NULL, NULL, NULL, NULL, NULL, true),
 ('${M(2)}', 'e441-2', 'm441-2', '<ms@a>', NULL, 'microsoft-noreply@microsoft.com', ARRAY['support@in.test'], 'Code', 'privacy', now() - interval '4 days', 'support', false, 'red', 'answered', now() - interval '4 days', 'Hello', now() - interval '4 days', 'owner', NULL, true),
 ('${M(3)}', 'e441-3', 'm441-3', '<d1@c>', NULL, 'dana@c.test', ARRAY['support@in.test'], 'Refund', 'refund', now() - interval '3 days', 'support', false, 'red', 'waiting', now() - interval '3 days', NULL, NULL, NULL, NULL, true),
 ('${M(4)}', 'e441-4', 'm441-4', '<d2@c>', '<d1@c>', 'dana@c.test', ARRAY['support@in.test'], 'Re: Refund', 'still', now() - interval '2 days', 'support', false, 'red', 'waiting', NULL, NULL, NULL, NULL, NULL, true),
 ('${M(5)}', 'e441-5', 'm441-5', '<e1@c>', '<d1@c>', 'eve@c.test', ARRAY['support@in.test'], 'Re: Refund', 'me too', now() - interval '1 day', 'support', false, 'green', 'draft', NULL, NULL, NULL, NULL, NULL, true);
${mig('20261030500000_support_automation_policy.sql')}
${mig('20261030600000_support_conversations.sql')}
UPDATE public.support_inbound_messages SET reply_text = 'Live answer', reply_sent_at = now(), reply_sent_by = 'owner', status = 'answered' WHERE id = '${M(3)}';
INSERT INTO public.support_outbound_messages (conversation_id, inbound_id, kind, actor, to_address, body_text, state, send_key)
SELECT conversation_id, id, 'owner', 'owner', from_address, 'Live answer', 'sent', 'tekango-support/v1/${M(3)}/owner-live' FROM public.support_inbound_messages WHERE id = '${M(3)}';
${mig('20261030500000_support_automation_policy.sql')}
${mig('20261030600000_support_conversations.sql')}
SELECT json_build_object(
  'cls', (SELECT json_object_agg(id, json_build_object('c', automation_class, 'r', reply_allowed, 'bin', bin, 'st', status, 'rs', reply_sent_by)) FROM public.support_inbound_messages WHERE id::text LIKE 'a4410000%'),
  'conv', (SELECT json_object_agg(id, json_build_object('conv', conversation_id, 'a', association)) FROM public.support_inbound_messages WHERE id::text LIKE 'a4410000%'),
  'acked', (SELECT c.ack_sent_at IS NOT NULL FROM public.support_conversations c JOIN public.support_inbound_messages m ON m.conversation_id = c.id WHERE m.id = '${M(3)}'),
  'out', (SELECT json_agg(json_build_object('in', inbound_id, 'k', kind, 'known', body_known, 'st', state) ORDER BY inbound_id, kind) FROM public.support_outbound_messages WHERE inbound_id::text LIKE 'a4410000%'));
ROLLBACK;`);
  const line = out.split('\n').find((l) => l.trim().startsWith('{'));
  const h = line ? JSON.parse(line) : null;
  ok(!!h, 'HISTORY: both migrations replayed twice over stored emails without an error', out.slice(0, 300));
  if (h) {
    ok(h.cls[M(1)].c === 'confirmed_automatic' && h.cls[M(1)].r === false && h.cls[M(1)].bin === 'black', 'HISTORY: an automated email becomes confirmed automatic, reply banned, still black', h.cls[M(1)]);
    ok(h.cls[M(2)].c === 'possible_automatic' && h.cls[M(2)].r === false && h.cls[M(2)].bin === 'red' && h.cls[M(2)].st === 'answered' && h.cls[M(2)].rs === 'owner',
      'HISTORY: a prefixed no-reply the old rule missed is possibly automatic and banned; its colour, state and answer are kept', h.cls[M(2)]);
    ok(h.cls[M(3)].c === 'human' && h.cls[M(3)].r === true, 'HISTORY: a human email stays human and replyable', h.cls[M(3)]);
    ok(h.conv[M(4)].conv === h.conv[M(3)].conv && h.conv[M(4)].a === 'legacy', 'HISTORY: a reply of the same sender + mailbox joins its parent\'s conversation', h.conv);
    ok(h.conv[M(5)].conv !== h.conv[M(3)].conv, 'HISTORY: another sender\'s reply to it gets its own conversation', h.conv);
    ok(Object.values(h.conv).every((c) => c.conv), 'HISTORY: every stored email has a conversation', h.conv);
    ok(h.acked === true, 'HISTORY: the conversation remembers its past acknowledgement (no second one later)', h.acked);
    const outs = h.out || [];
    ok(outs.filter((o) => o.in === M(3) && o.k === 'owner').length === 1, 'HISTORY: a reply recorded live is never recorded again by a replay', outs);
    ok(outs.length === 4 && outs.some((o) => o.in === M(3) && o.k === 'ack' && o.known === false) && outs.some((o) => o.in === M(2) && o.k === 'owner' && o.known === true)
      && outs.some((o) => o.in === M(2) && o.k === 'ack') && outs.every((o) => o.st === 'sent'),
    'HISTORY: past acknowledgements (text not kept) and replies become outbound records, once each', outs);
  }

  // ---- 2. race: two emails of one conversation acknowledge at once ----
  const conv = await q(`INSERT INTO public.support_conversations (participant, mailbox) VALUES ('race@c.test', 'support') RETURNING id;`);
  const lock = 7_441_001;
  const barrier = holdBarrier(container, lock);
  await barrier.ready;
  const one = (claim) => q(`SELECT pg_advisory_lock_shared(${lock});
BEGIN;
SELECT public.support_conversation_claim_ack('${conv}', '${claim}');
SELECT pg_sleep(1.5);
COMMIT;`).then((o) => o.split('\n').map((l) => l.trim()).filter((l) => l === 't' || l === 'f').at(-1), (e) => `error ${String(e.message).slice(0, 120)}`);
  const workers = [one('ack:1'), one('ack:2')];
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < 2; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
    if (waiting < 2) await new Promise((r) => setTimeout(r, 250));
  }
  await barrier.release();
  const results = await Promise.all(workers);
  ok(waiting === 2, 'RACE: both sessions blocked on the barrier before release', waiting);
  ok(results.filter((r) => r === 't').length === 1 && results.filter((r) => r === 'f').length === 1, 'RACE: two emails of one conversation at once -> exactly one acknowledgement claim', results);
  return { assertions };
}
