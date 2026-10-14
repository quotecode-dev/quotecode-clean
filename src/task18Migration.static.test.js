// Task 18 migration static contract (the behaviour is proven in the disposable DB harness: scripts/db-test/tests/130_*.sql and
// 131_*.mjs). Pins the shape the product relies on and the exclusions the Owner set: forward-only, owner-only forced RLS, no anon,
// database-enforced same-tenant links, trigger-owned timestamps, and NO notification / cron / reminder / network / Production path.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const FILE = '20261009180000_task18_durable_manual_tasks.sql';
const sql = readFileSync(join(cwd(), 'supabase', 'migrations', FILE), 'utf8').split(String.fromCharCode(13)).join('');
const code = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const contract = JSON.parse(readFileSync(join(cwd(), 'scripts', 'db-test', 'migration-contract.json'), 'utf8'));

describe('Task 18 migration contract', () => {
  it('declares the transaction / replay execution contract and is pinned in the DB-harness contract', () => {
    expect(sql.split('\n')[2]).toBe('-- tekango-migration-contract: mode=transaction replay=required');
    expect(contract.migrations[FILE]).toMatchObject({ mode: 'transaction', replay: 'required' });
    expect(contract.migrations[FILE].sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('creates public.tasks with the owner FK (cascade), quote / client FKs (set null) and every named check', () => {
    expect(code).toMatch(/user_id\s+uuid NOT NULL DEFAULT auth\.uid\(\) REFERENCES auth\.users \(id\) ON DELETE CASCADE/);
    expect(code).toMatch(/quote_id\s+uuid REFERENCES public\.quotes \(id\) ON DELETE SET NULL/);
    expect(code).toMatch(/client_id\s+uuid REFERENCES public\.clients \(id\) ON DELETE SET NULL/);
    expect(code).toMatch(/due_date\s+date,/);
    expect(code).toMatch(/due_time\s+time without time zone,/);
    for (const c of ['tasks_title_check', 'tasks_notes_check', 'tasks_status_check', 'tasks_priority_check', 'tasks_due_time_requires_date', 'tasks_completed_consistency']) expect(code).toContain(`CONSTRAINT ${c} CHECK`);
    expect(code).toMatch(/BETWEEN 1 AND 200/);
    expect(code).toMatch(/BETWEEN 1 AND 2000/);
    expect(code).toMatch(/status IN \('open', 'completed'\)/);
    expect(code).toMatch(/priority IN \('low', 'normal', 'high'\)/);
  });
  it('RLS is enabled AND forced; four owner-only policies for authenticated; anon / public revoked', () => {
    expect(code).toMatch(/ALTER TABLE public\.tasks ENABLE ROW LEVEL SECURITY;/);
    expect(code).toMatch(/ALTER TABLE public\.tasks FORCE ROW LEVEL SECURITY;/);
    const policies = [...code.matchAll(/CREATE POLICY (\w+) ON public\.tasks FOR (\w+) TO (\w+)/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`);
    expect(policies).toEqual(['tasks_select_own:SELECT:authenticated', 'tasks_insert_own:INSERT:authenticated', 'tasks_update_own:UPDATE:authenticated', 'tasks_delete_own:DELETE:authenticated']);
    // every policy predicate is exactly the owner match (USING / WITH CHECK)
    expect([...code.matchAll(/CREATE POLICY [^;]*;/g)].every((m) => [...m[0].matchAll(/(?:USING|WITH CHECK) \(([^;]*?)\)(?= WITH| *;)/g)].every((x) => x[1] === '(SELECT auth.uid()) = user_id'))).toBe(true);
    expect(code).toMatch(/REVOKE ALL ON public\.tasks FROM anon;/);
    expect(code).toMatch(/REVOKE ALL ON public\.tasks FROM PUBLIC;/);
    expect(code).not.toMatch(/GRANT [^;]* TO anon/);
  });
  it('the row guard is SECURITY INVOKER with a pinned search_path, owns the timestamps and enforces same-tenant links before the FKs', () => {
    const fn = code.slice(code.indexOf('CREATE OR REPLACE FUNCTION public.tasks_guard_row()'), code.indexOf('$function$;'));
    expect(fn).toMatch(/SECURITY INVOKER/);
    expect(fn).toMatch(/SET search_path = pg_catalog, pg_temp/);
    expect(fn).toMatch(/q\.user_id = NEW\.user_id/);
    expect(fn).toMatch(/c\.user_id = NEW\.user_id/);
    expect((fn.match(/TK_TASK_LINK_NOT_ALLOWED: the linked quote or client is not available/g) || []).length).toBe(2); // one constant error
    expect(fn).toMatch(/TK_TASK_OWNER_IMMUTABLE/);
    expect(code).toMatch(/CREATE TRIGGER tasks_guard_row\s+BEFORE INSERT OR UPDATE ON public\.tasks/);
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.tasks_guard_row\(\) FROM PUBLIC, anon, authenticated;/);
  });
  it('fails closed on an incompatible pre-existing object and never drops / alters / deletes anything else', () => {
    expect(code).toMatch(/TK_TASK18_INCOMPATIBLE: public\.tasks exists with another column shape/);
    expect(code).toMatch(/TK_TASK18_INCOMPATIBLE: public\.tasks lacks the checks/);
    expect(code).not.toMatch(/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b|\bUPDATE public\./i);
    expect([...code.matchAll(/ALTER TABLE (\S+)/g)].every((m) => m[1] === 'public.tasks')).toBe(true);
  });
  it('has no notification / cron / reminder / network / messaging / Production path', () => {
    // the table's own COMMENT text ("no reminders or automation") is documentation, not code
    const executable = code.split('\n').filter((l) => !/^COMMENT ON TABLE public\.tasks IS '[^']*';$/.test(l)).join('\n');
    expect(executable).not.toMatch(/\bcron\b|pg_net|http_|net\.http|\bNOTIFY\b|pg_notify|realtime|supabase_functions|webhook|reminder|ixabnzhjeqevtbhdfswv/i);
  });
});
