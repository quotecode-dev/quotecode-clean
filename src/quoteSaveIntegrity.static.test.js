// IRON-QUOTE-001 / IRON-QUOTE-002 / IRON-QUOTE-005 - STATIC WIRING GATE for the save flow.
// This proves the save-flow SOURCE keeps its truthful, narrowed contract. It is NOT failure-injection
// or browser proof (those cells stay NOT_TESTED in the iron-law registry until run).
//
// NARROWED CONTRACT (IRON-QUOTE-001): the save is NOT one atomic transaction. Phases, in order:
//   1 client insert/update (separate)  2 quote insert/update (separate)  3 save_quote_structured RPC (atomic on its own)
//   4 attachment upload + metadata insert per file  5 staged attachment removal.
// Failure handling: phase 1 failure aborts before any quote write; phase 3 failure on a NEW quote compensates
// (deletes the shell) and on an EDIT reports that the header/client WERE saved; phase 4/5 failures are surfaced,
// keep the editor on the saved quote with only the failed files pending, and never discard the draft.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const src = readFileSync(join(cwd(), 'src/pages/Dashboard.jsx'), 'utf8').replace(/\r\n/g, '\n');

describe('IRON-QUOTE-001 narrowed save contract (static wiring)', () => {
  it('phase 1: a failed client UPDATE is no longer ignored and aborts before any quote write', () => {
    expect(src).toMatch(/const \{ error: clientUpdateError \} = await supabase\.from\('clients'\)\.update\(clientPayload\)/);
    expect(src).toMatch(/if \(clientUpdateError\) throw clientUpdateError;/);
    expect(src).not.toMatch(/^\s*await supabase\.from\('clients'\)\.update\(clientPayload\)/m);
  });

  it('phase 3: structured RPC failure compensates a NEW quote shell and never claims "no partial change" on an EDIT', () => {
    expect(src).toMatch(/if \(!editingQuoteId\) \{\s*const \{ error: compensatingDeleteError \} = await supabase\.from\('quotes'\)\.delete\(\)\.eq\('id', quoteId\)/);
    expect(src).toMatch(/setAlertModalMsg\(editingQuoteId\s*\?/);
    expect(src).toMatch(/general details were saved, but its structure/);
    expect(src).not.toMatch(/The entire save was cancelled to protect data/);
  });

  it('phase 4/5: attachment failures are collected, surfaced, keep the editor on the saved quote, and never discard silently', () => {
    expect(src).toMatch(/attachmentFailures\.push\(file\.name\)/);
    expect(src).toMatch(/if \(attachmentFailures\.length > 0 \|\| removalFailed\)/);
    expect(src).toMatch(/setEditingQuoteId\(quoteId\);/);
    expect(src).toMatch(/The quote was saved, but some attachment steps did not complete/);
  });
});

describe('IRON-QUOTE-005 attachment lifecycle (static wiring)', () => {
  it('existing attachments are removed only from the staged list AFTER the quote save, not on click', () => {
    const removalDelete = src.indexOf(".from('quote_attachments').delete().in('id', pendingAttachmentRemovals)");
    const rpc = src.indexOf("supabase.rpc('save_quote_structured'");
    const upload = src.indexOf(".storage.from('quote-files').upload(");
    expect(removalDelete).toBeGreaterThan(rpc);
    expect(removalDelete).toBeGreaterThan(upload);
    // the only DELETE of quote_attachments by id-list is the staged one; the other is the whole-quote delete.
    expect((src.match(/from\('quote_attachments'\)\.delete\(\)/g) || []).length).toBe(2);
  });

  it('a metadata-insert failure after a successful upload compensates the orphan object', () => {
    expect(src).toMatch(/if \(attInsertErr\) \{[\s\S]{0,400}\.storage\.from\('quote-files'\)\.remove\(\[filePath\]\)/);
  });

  it('KNOWN GAP (documented, not hidden): no storage remove exists for REMOVED existing attachments (orphan objects remain)', () => {
    const removes = (src.match(/\.storage\.from\('quote-files'\)\.remove\(/g) || []).length;
    expect(removes).toBe(1); // only the upload-failure compensation; removal-orphan reconciliation is an open item
  });
});

describe('IRON-QUOTE-002 project_name persistence (static wiring)', () => {
  it('project_name is written on both insert and update via projectNameForPersist', () => {
    expect(src).toMatch(/const projectFields = \{ project_name: projectNameForPersist\(projectName\) \}/);
    expect(src).toMatch(/\.update\(\{ \.\.\.quotePayload, \.\.\.attnFields, \.\.\.projectFields \}\)/);
    expect(src).toMatch(/\.insert\(\[\{ \.\.\.quotePayload, \.\.\.attnFields, \.\.\.projectFields \}\]\)/);
  });

  it('KNOWN GAP (documented): a missing project_name COLUMN silently retries without it (value dropped, no user-visible warning)', () => {
    expect(src).toMatch(/isMissingProjectColumnError\(updateError\)/);
    expect(src).toMatch(/isMissingProjectColumnError\(quoteError\)/);
  });
});
