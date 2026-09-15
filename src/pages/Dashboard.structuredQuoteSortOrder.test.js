import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Structured Quote Production Migration Package Remediation (Codex NO-GO
// blocker 6, 2026-09-15): quote_items.sort_order existed in the schema but
// was never written end-to-end - the save_quote_structured RPC never
// persisted it and Dashboard.jsx's own itemsPayload never sent it. Fixed
// with a single additive field (`sort_order: idx`) inside the existing
// itemsPayload map in the save_quote_structured RPC-call block - the
// canonical source of order is the item's own position in itemsForPersist,
// matching every other client_key/id field already derived from the same
// `(item, idx) =>` callback on the very same array. No other field in this
// payload block was touched (see PROFLOW_STRUCTURED_QUOTE_PRODUCTION_
// MIGRATION_PACKAGE_REVIEW.md remediation report for the full diff).
//
// A full render+save integration test is deliberately not attempted here -
// Dashboard.jsx's save path requires a fully authenticated session, a real
// quote/client/items state tree, and a mocked Supabase client deep enough to
// satisfy dozens of unrelated calls this same handleSave makes before ever
// reaching the RPC call - exactly the kind of expensive, brittle setup this
// project's own sibling source-contract tests (Dashboard.navigation.test.js,
// Dashboard.recoverySessionOrdering.test.js) deliberately avoid in favor of
// asserting the actual save-path source text directly, which is what a
// payload-shape regression like this one actually lives in.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

function getItemsPayloadBlock() {
  const rpcCallIndex = dashboardSource.indexOf("await supabase.rpc('save_quote_structured'");
  expect(rpcCallIndex).toBeGreaterThan(-1);
  const blockStart = dashboardSource.lastIndexOf('const itemsPayload = itemsForPersist ? itemsForPersist.map((item, idx) => ({');
  expect(blockStart).toBeGreaterThan(-1);
  expect(blockStart).toBeLessThan(rpcCallIndex);
  const blockEnd = dashboardSource.indexOf('})) : [];', blockStart);
  expect(blockEnd).toBeGreaterThan(blockStart);
  return dashboardSource.slice(blockStart, blockEnd);
}

describe('save_quote_structured p_items payload - sort_order end-to-end (blocker 6)', () => {
  it('itemsPayload sends sort_order for every item, derived from the item\'s own array position (idx) - the single ordering authority, not a second one', () => {
    const block = getItemsPayloadBlock();
    expect(block).toMatch(/sort_order:\s*idx\s*,/);
  });

  it('sort_order is sent for both new items (id: null) and existing items (id present) - the field is unconditional, not gated on editingQuoteId/item.id', () => {
    const block = getItemsPayloadBlock();
    // The map callback body is one shared object literal for every item in
    // itemsForPersist, regardless of whether item.id is set - so a single
    // unconditional `sort_order: idx` line (asserted above) already covers
    // both new and existing items. This test guards against a future
    // refactor accidentally splitting the literal into id-gated branches
    // that could omit sort_order on one path.
    const sortOrderMatches = block.match(/sort_order:\s*idx/g) || [];
    expect(sortOrderMatches).toHaveLength(1);
  });

  it('the RPC call itself still forwards itemsPayload verbatim as p_items - the field is not stripped before the network call', () => {
    const rpcCallIndex = dashboardSource.indexOf("await supabase.rpc('save_quote_structured'");
    const rpcCallEnd = dashboardSource.indexOf('});', rpcCallIndex);
    const rpcCallBlock = dashboardSource.slice(rpcCallIndex, rpcCallEnd);
    expect(rpcCallBlock).toMatch(/p_items:\s*itemsPayload,/);
  });

  it('no unrelated payload field was touched alongside this change - the existing financial/section/removed-id fields remain present', () => {
    const rpcCallIndex = dashboardSource.indexOf("await supabase.rpc('save_quote_structured'");
    const rpcCallEnd = dashboardSource.indexOf('});', rpcCallIndex);
    const rpcCallBlock = dashboardSource.slice(rpcCallIndex, rpcCallEnd);
    expect(rpcCallBlock).toMatch(/p_quote_id:\s*quoteId,/);
    expect(rpcCallBlock).toMatch(/p_financial:\s*financialForRpc,/);
    expect(rpcCallBlock).toMatch(/p_sections:\s*sectionsPayload,/);
    expect(rpcCallBlock).toMatch(/p_removed_section_ids:\s*removedSectionIds,/);
    expect(rpcCallBlock).toMatch(/p_removed_item_ids:\s*removedItemIds,/);
  });
});
