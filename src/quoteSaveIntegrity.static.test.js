// IRON-QUOTE-001 / IRON-QUOTE-002 / IRON-QUOTE-005 - STATIC WIRING GATE for the save flow (2026-09-22 revision).
// The persistence stages live in src/utils/quoteSaveOrchestrator.js (failure-injection tested in quoteSaveOrchestrator.test.js and,
// for the SQL, in scripts/db-test). This file proves the SOURCE wiring cannot silently regress.
//
// CONTRACT:
//   ATOMIC path (migration 20260922000000 applied): uploads first, then ONE transaction (save_quote_atomic); failure => nothing written,
//   uploads removed; retry of a committed new quote is idempotent; removed-attachment objects are deleted after commit (GC queue).
//   PHASED path (current shared TEST schema): client -> quote row -> save_quote_structured -> attachments -> removals. NOT atomic:
//   compensates (new client + new quote shell removed on failure, orphan upload removed) and reports every incomplete stage.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('src/pages/Dashboard.jsx');
const orch = read('src/utils/quoteSaveOrchestrator.js');
const saveStart = dash.indexOf('async function handleSaveQuote(e) {');
const saveFn = dash.slice(saveStart, saveStart + 60000);

describe('IRON-QUOTE-001 save contract (static wiring)', () => {
  it('Dashboard delegates every persistence stage to the tested orchestrator (no inline client/quote/attachment writes)', () => {
    expect(saveStart).toBeGreaterThan(-1);
    expect(saveFn).toMatch(/const saveResult = await persistQuote\(supabase, \{/);
    expect(saveFn).not.toMatch(/supabase\.from\('clients'\)\.(update|insert)\(/);
    expect(saveFn).not.toMatch(/supabase\.from\('quotes'\)\.(update|insert)\(/);
    expect(saveFn).not.toMatch(/\.storage\.from\('quote-files'\)\.upload\(/);
  });

  it('the capability probe chooses ATOMIC vs PHASED (never a guess)', () => {
    expect(orch).toMatch(/supabase\.rpc\('save_quote_atomic_version'\)/);
    expect(orch).toMatch(/return atomic \? persistQuoteAtomic\(supabase, plan\) : persistQuotePhased\(supabase, plan\);/);
  });

  it('ATOMIC: uploads before the transaction; a transaction failure removes the uploads', () => {
    const a = orch.slice(orch.indexOf('export async function persistQuoteAtomic'), orch.indexOf('export async function persistQuotePhased'));
    expect(a.indexOf('uploadAll(supabase, plan)')).toBeLessThan(a.indexOf("supabase.rpc('save_quote_atomic'"));
    expect(a).toMatch(/if \(error\) \{\s*const \{ failed \} = await removeObjects\(supabase, uploaded\.map/);
  });

  it('PHASED: client failure aborts before any quote write; a NEW quote failure compensates the new client and the quote shell', () => {
    const p = orch.slice(orch.indexOf('export async function persistQuotePhased'), orch.indexOf('export async function persistQuote('));
    expect(p).toMatch(/if \(error\) return fail\('client', error\);/);
    expect(p.indexOf("fail('client'")).toBeLessThan(p.indexOf("supabase.from('quotes')"));
    expect(p).toMatch(/if \(plan\.isNew\) await compensateNewClient\(\);/);
    expect(p).toMatch(/const \{ error: delErr \} = await supabase\.from\('quotes'\)\.delete\(\)\.eq\('id', plan\.quoteId\);/);
    expect(p).toMatch(/compensationFailed: true/);
  });

  it('a failed save keeps the local draft (returns before the success discard); a partial save continues as an edit of the saved quote', () => {
    const failed = saveFn.indexOf("if (saveResult.outcome === 'failed') {");
    const failedReturn = saveFn.indexOf('return;', failed);
    const successDiscard = saveFn.indexOf('await quoteDraft.discard(); // the draft is removed only after ALL required save stages succeeded');
    expect(failed).toBeGreaterThan(-1);
    expect(failedReturn).toBeLessThan(successDiscard);
    expect(saveFn.slice(failed, failedReturn)).not.toMatch(/quoteDraft\.discard/);
    const partial = saveFn.indexOf("if (saveResult.outcome === 'partial') {");
    expect(saveFn.slice(partial, saveFn.indexOf('return;', partial))).toMatch(/setEditingQuoteId\(quoteId\);/);
    expect(saveFn).toMatch(/The quote was saved, but some attachment steps did not complete/);
    expect(saveFn).toMatch(/general details were saved, but its structure/);
  });

  it('SMART-QUOTE-03: a new quote is persisted as Draft regardless of the form state', () => {
    expect(saveFn).toMatch(/const persistedStatus = editingQuoteId \? quoteStatus\.toLowerCase\(\) : 'draft';/);
  });
});

describe('IRON-QUOTE-005 attachment lifecycle (static wiring)', () => {
  it('removed attachments: the DB row is deleted first, then its storage object (GAP CLOSED 2026-09-22)', () => {
    const p = orch.slice(orch.indexOf('// 6. removed attachments'), orch.indexOf('result.removalFailed = removalFailed;'));
    expect(p.indexOf(".from('quote_attachments').delete()")).toBeLessThan(p.indexOf('removeObjects(supabase, paths)'));
    expect(p).toMatch(/if \(error\) removalFailed = true;\s*else \{/); // a failed row delete never deletes the object
  });

  it('a metadata-insert failure after a successful upload removes the orphan object', () => {
    expect(orch).toMatch(/result\.attachmentFailures\.push\(u\.file\.name\);\s*const \{ failed \} = await removeObjects\(supabase, \[u\.path\]\);/);
  });

  it('quote deletion removes storage objects only after the quote row delete succeeded', () => {
    const d = orch.slice(orch.indexOf('export async function deleteQuoteWithAttachments'), orch.indexOf('export async function createAttachmentAccessUrl'));
    expect(d.indexOf(".from('quotes').delete()")).toBeLessThan(d.indexOf('removeObjects('));
    expect(d).toMatch(/if \(delErr\) return \{ ok: false, stage: 'delete', error: delErr \};/);
    expect(dash).toMatch(/const delResult = await deleteQuoteWithAttachments\(supabase, quoteId\);/);
  });

  it('OD-2: no permanent public URL is created anywhere; attachments open via short-lived signed URLs', () => {
    for (const f of ['src/pages/Dashboard.jsx', 'src/components/QuoteForm.jsx', 'src/utils/quoteSaveOrchestrator.js']) expect(read(f)).not.toMatch(/getPublicUrl\(/);
    expect(read('src/components/QuoteForm.jsx')).not.toMatch(/href=\{file\.file_url/);
    expect(orch).toMatch(/createSignedUrl\(attachment\.storage_path, expiresInSeconds\)/);
  });

  it('attachment paths always satisfy the public path check (safe extension; no silently hidden attachment)', () => {
    expect(orch).toMatch(/export function safeFileExtension\(name\)/);
    expect(orch).not.toMatch(/file\.name\.split\('\.'\)\.pop\(\)/);
  });
});

describe('IRON-QUOTE-002 project_name persistence (static wiring)', () => {
  it('project_name is part of every save (atomic header and phased row) via projectNameForPersist', () => {
    expect(saveFn).toMatch(/projectName: projectNameForPersist\(projectName\),/);
    expect(orch).toMatch(/p_quote: \{ \.\.\.plan\.header, \.\.\.plan\.attnFields, project_name: plan\.projectName \}/);
    expect(orch).toMatch(/let row = \{ \.\.\.plan\.header, client_id: clientId, user_id: plan\.userId, \.\.\.plan\.attnFields, project_name: plan\.projectName \};/);
  });

  it('a missing column never drops a TYPED project name silently (GAP CLOSED 2026-09-22)', () => {
    expect(orch).toMatch(/if \(plan\.projectName\) break; \/\/ a typed project name must never be dropped silently/);
    expect(saveFn).toMatch(/missingColumn === 'project_name'/);
  });
});
