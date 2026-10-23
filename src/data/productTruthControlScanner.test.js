// PRODUCT TRUTH FINAL CLOSURE (2026-09-23) — Blocker 1 §3.7 required mutation tests for the
// control-level scanner (productTruthControlScanner.js). Each test is a synthetic source snippet,
// not real repo source, so the ambiguity/growth/replacement classes this gate must catch can be
// proven directly without waiting for a real regression to occur in the codebase.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  scanControlsInFile,
  scanControlsInFiles,
  controlScopeFiles,
  computeIdentityKey,
  checkControlIdentityBaseline,
} from './productTruthControlScanner.js';
import { listScannableFiles } from './productTruthCapabilityScanner.js';
import controlBaseline from './productTruthControlBaseline.json';

const FILE = 'src/components/SyntheticFixture.jsx';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('CONTROL-LEVEL SOURCE COVERAGE — real data (the actual Blocker 1 guarantee)', () => {
  it('every interactive control in every in-product file resolves to exactly one capability or one decorative exemption - no unresolved control is grandfathered', () => {
    const allFiles = listScannableFiles(ROOT, ['src', 'supabase/functions']);
    const inScope = controlScopeFiles(allFiles);
    expect(inScope.length).toBeGreaterThan(50);
    const { controls, parseErrors } = scanControlsInFiles(ROOT, inScope, (rel) => readFileSync(join(ROOT, rel), 'utf-8'));
    expect(parseErrors, `parse errors:\n${JSON.stringify(parseErrors, null, 2)}`).toEqual([]);
    expect(controls.length).toBeGreaterThan(100);
    const unresolved = controls.filter((c) => c.resolution.status === 'unresolved');
    const ambiguous = controls.filter((c) => c.resolution.status === 'ambiguous');
    expect(unresolved, `unresolved controls:\n${JSON.stringify(unresolved.map((c) => ({ file: c.file, line: c.line, kind: c.kind, tagName: c.tagName })), null, 2)}`).toEqual([]);
    expect(ambiguous, `ambiguous controls:\n${JSON.stringify(ambiguous.map((c) => ({ file: c.file, line: c.line, reason: c.resolution.reason })), null, 2)}`).toEqual([]);
  });
});

describe('REPLACEMENT CONTROL DEFENSE — real data (Codex final re-review Blocker 1: a changed control must not inherit a stale marker)', () => {
  it('every capability id\'s currently-resolved control(s) match an identity explicitly recorded in the committed baseline - no replaced/new control inherits a mapping it was never reviewed against', () => {
    const allFiles = listScannableFiles(ROOT, ['src', 'supabase/functions']);
    const inScope = controlScopeFiles(allFiles);
    const { controls } = scanControlsInFiles(ROOT, inScope, (rel) => readFileSync(join(ROOT, rel), 'utf-8'));
    const failures = checkControlIdentityBaseline(controls, controlBaseline);
    expect(failures, `replacement-control identity failures (run the generator to review/remap if these are legitimate):\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });

  it('the baseline generator is idempotent: regenerating from real source produces byte-identical identity keys to the committed file', () => {
    const allFiles = listScannableFiles(ROOT, ['src', 'supabase/functions']);
    const inScope = controlScopeFiles(allFiles);
    const { controls } = scanControlsInFiles(ROOT, inScope, (rel) => readFileSync(join(ROOT, rel), 'utf-8'));
    const byCapability = new Map();
    for (const c of controls) {
      if (c.resolution.status !== 'resolved' || c.resolution.type !== 'capability') continue;
      const id = c.resolution.id;
      if (!byCapability.has(id)) byCapability.set(id, new Set());
      byCapability.get(id).add(computeIdentityKey(c));
    }
    for (const [id, keys] of byCapability) {
      expect(controlBaseline[id], `capability "${id}" is missing from the committed control baseline`).toBeTruthy();
      expect(new Set(controlBaseline[id])).toEqual(keys);
    }
  });
});

function resolutionsOf(source) {
  return scanControlsInFile(FILE, source).controls.map((c) => c.resolution);
}

describe('CONTROL-LEVEL SOURCE COVERAGE — §3.7 required mutation tests', () => {
  it('existing unmarked control: a control with no marker anywhere in its search set is UNRESOLVED, never silently grandfathered', () => {
    const src = `
      function Foo() {
        return <button onClick={doThing}>Go</button>;
      }
    `;
    const [res] = resolutionsOf(src);
    expect(res.status).toBe('unresolved');
  });

  it('new unmarked control added alongside an already-marked one: the marked control still resolves, the new one is independently unresolved (not masked by its marked sibling)', () => {
    const src = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button onClick={openClients}>Clients</button>
            <button onClick={openNewThing}>New thing</button>
          </div>
        );
      }
    `;
    const results = resolutionsOf(src);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ status: 'resolved', type: 'capability', id: 'clients' });
    expect(results[1].status).toBe('unresolved');
  });

  it('swapped control, same total count: replacing a marked <button> with a different, unmarked <Link> at the same position changes the discovered signature and control kind - the gate cannot mistake the new control for the old one it happens to numerically replace', () => {
    const before = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button onClick={openClients}>Clients</button>
          </div>
        );
      }
    `;
    const after = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <Link to="/somewhere-else">Somewhere else</Link>
          </div>
        );
      }
    `;
    const beforeControls = scanControlsInFile(FILE, before).controls;
    const afterControls = scanControlsInFile(FILE, after).controls;
    expect(beforeControls).toHaveLength(1);
    expect(afterControls).toHaveLength(1);
    // Same count (1 -> 1), but a genuinely different control: different kind, different signature.
    expect(beforeControls[0].kind).toBe('button');
    expect(afterControls[0].kind).toBe('router_link');
    expect(afterControls[0].signature).not.toBe(beforeControls[0].signature);
    // The stale marker is STILL positionally attached (JSX-sibling attachment is mechanical, not
    // identity-aware) - `after`'s <Link> still resolves to `clients` by pure scanner resolution.
    expect(afterControls[0].resolution).toEqual({ status: 'resolved', type: 'capability', id: 'clients' });
    // The scanner's resolution alone is NOT the gate: checkControlIdentityBaseline is. A baseline
    // that only ever recorded the OLD (button) identity must FAIL CLOSED on the new (Link) one -
    // the stale marker's mechanical resolution does not, by itself, satisfy the real gate.
    const baseline = { clients: [computeIdentityKey(beforeControls[0])] };
    const failures = checkControlIdentityBaseline(afterControls, baseline);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ capabilityId: 'clients', reason: 'stale_marker_on_changed_control' });
    // Explicit remap (Owner/reviewer regenerates the baseline to accept the Link as clients' new
    // control) makes the identical scan pass - the gate is data-driven, not a permanent lockout.
    const remapped = { clients: [computeIdentityKey(afterControls[0])] };
    expect(checkControlIdentityBaseline(afterControls, remapped)).toEqual([]);
  });

  it('element kind change alone (button -> role="button" div), same handler, same marker: still a changed control, still fails until remapped', () => {
    const before = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
            <button onClick={openCatalog}>Catalog</button>
          </div>
        );
      }
    `).controls;
    const after = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
            <div role="button" onClick={openCatalog}>Catalog</div>
          </div>
        );
      }
    `).controls;
    expect(before[0].kind).toBe('button');
    expect(after[0].kind).toBe('role_button');
    const baseline = { catalog: [computeIdentityKey(before[0])] };
    const failures = checkControlIdentityBaseline(after, baseline);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('stale_marker_on_changed_control');
  });

  it('event-handler change alone (same tag/kind, different resolved handler name), same marker: fails until remapped', () => {
    const before = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: expenses */}
            <button onClick={openExpenses}>Expenses</button>
          </div>
        );
      }
    `).controls;
    const after = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: expenses */}
            <button onClick={openExpensesV2}>Expenses</button>
          </div>
        );
      }
    `).controls;
    expect(before[0].handlerName).toBe('openExpenses');
    expect(after[0].handlerName).toBe('openExpensesV2');
    const baseline = { expenses: [computeIdentityKey(before[0])] };
    const failures = checkControlIdentityBaseline(after, baseline);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('stale_marker_on_changed_control');
  });

  it('enclosing component / control-shape change (same tag, kind, handler name, but a different render boundary), same marker: fails until remapped', () => {
    const before = scanControlsInFile(FILE, `
      function QuotesTab() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: quote_edit */}
            <button onClick={editQuote}>Edit</button>
          </div>
        );
      }
    `).controls;
    const after = scanControlsInFile(FILE, `
      function QuotesTabRewrite() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: quote_edit */}
            <button onClick={editQuote}>Edit</button>
          </div>
        );
      }
    `).controls;
    expect(before[0].enclosingComponent).toBe('QuotesTab');
    expect(after[0].enclosingComponent).toBe('QuotesTabRewrite');
    const baseline = { quote_edit: [computeIdentityKey(before[0])] };
    const failures = checkControlIdentityBaseline(after, baseline);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('stale_marker_on_changed_control');
  });

  it('neighboring marker must not satisfy replacement: a control that newly resolves to an id via a DIFFERENT nearby marker still fails unless ITS OWN identity is baselined for that id', () => {
    const original = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: attachments */}
            <button onClick={uploadFile}>Upload</button>
          </div>
        );
      }
    `).controls;
    // A structurally different control (different handler => different identity) that a marker
    // now mechanically resolves onto - simulating a neighboring/relocated marker attaching to the
    // wrong, unbaselined control.
    const replaced = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: attachments */}
            <button onClick={pickFileV2}>Upload</button>
          </div>
        );
      }
    `).controls;
    const baseline = { attachments: [computeIdentityKey(original[0])] };
    const failures = checkControlIdentityBaseline(replaced, baseline);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('stale_marker_on_changed_control');
  });

  it('unbaselined capability control: a brand-new capability id with no baseline entry at all fails until explicitly added (never a silent free pass for "never reviewed")', () => {
    const controls = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: brand_new_capability */}
            <button onClick={doNewThing}>New</button>
          </div>
        );
      }
    `).controls;
    const failures = checkControlIdentityBaseline(controls, {});
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ capabilityId: 'brand_new_capability', reason: 'unbaselined_capability_control' });
  });

  it('unchanged control against its own baselined identity: passes with zero failures (a control that has not changed is never flagged)', () => {
    const controls = scanControlsInFile(FILE, `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button onClick={openClients}>Clients</button>
          </div>
        );
      }
    `).controls;
    const baseline = { clients: [computeIdentityKey(controls[0])] };
    expect(checkControlIdentityBaseline(controls, baseline)).toEqual([]);
  });

  it('free-floating decorative exemption: a decorative marker belonging to an EARLIER, unrelated sibling block does not leak forward to a later, real control in the same children array', () => {
    const src = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_DECORATIVE: unrelated_earlier_block */}
            <span>Just some unrelated decorative content</span>
            <button onClick={doRealThing}>Do a real capability</button>
          </div>
        );
      }
    `;
    const [res] = resolutionsOf(src);
    // nearestPrecedingMarker stops at the first real-content sibling (<span>...</span>) and never
    // scans further back to the decorative comment - the button must be unresolved, not exempted.
    expect(res.status).toBe('unresolved');
  });

  it('duplicate marker: the SAME capability id attached twice to one control (JSX-sibling comment duplicated by copy-paste) still resolves to that single id, not a false ambiguity', () => {
    const src = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button onClick={openClients}>Clients</button>
          </div>
        );
      }
    `;
    const [res] = resolutionsOf(src);
    // nearestPrecedingMarker only ever returns the ONE nearest marker per ancestor level, so a
    // duplicated comment pair collapses to a single found marker for this control - documented,
    // deterministic behavior, not a crash or a silent multi-id ambiguity.
    expect(res).toEqual({ status: 'resolved', type: 'capability', id: 'clients' });
  });

  it('ambiguous marker: two DIFFERENT capability ids both resolving into one control\'s search set is caught, never silently picking the first', () => {
    const src = `
      function Foo() {
        function handleClick() {
          // PRODUCT_TRUTH_CAPABILITY: clients
          doTheThing();
        }
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
            <button onClick={handleClick}>Ambiguous</button>
          </div>
        );
      }
    `;
    const [res] = resolutionsOf(src);
    expect(res.status).toBe('ambiguous');
    expect(res.reason).toBe('multiple_conflicting_capability_markers');
    expect(res.ids.sort()).toEqual(['catalog', 'clients']);
  });

  it('ambiguous marker: a capability marker AND a decorative exemption both attached to the same control is caught (cannot claim a control is both a tracked capability and an exempt decorative element)', () => {
    // Both a JSX-sibling decorative comment and a handler-declaration capability comment resolve
    // into the SAME control's search set (two independent attachment paths, not stacked JSX
    // comments - nearestPrecedingMarker only ever returns the nearest one per ancestor level, so
    // stacking would just test that behavior again rather than the "both present" case).
    const srcViaHandler = `
      function Foo() {
        function handleClick() {
          // PRODUCT_TRUTH_CAPABILITY: clients
          openClients();
        }
        return (
          <div>
            {/* PRODUCT_TRUTH_DECORATIVE: actually_decorative */}
            <button onClick={handleClick}>Clients</button>
          </div>
        );
      }
    `;
    const [res] = resolutionsOf(srcViaHandler);
    expect(res.status).toBe('ambiguous');
    expect(res.reason).toBe('capability_and_exemption_on_same_control');
  });

  it('removed marker: a previously-resolved control whose marker comment is deleted regresses to UNRESOLVED, never silently keeping the old resolution', () => {
    const marked = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button onClick={openClients}>Clients</button>
          </div>
        );
      }
    `;
    const unmarked = `
      function Foo() {
        return (
          <div>
            <button onClick={openClients}>Clients</button>
          </div>
        );
      }
    `;
    const [markedRes] = resolutionsOf(marked);
    const [unmarkedRes] = resolutionsOf(unmarked);
    expect(markedRes.status).toBe('resolved');
    expect(unmarkedRes.status).toBe('unresolved');
  });

  it('replaced control: swapping a control\'s tag/kind while keeping the SAME onClick handler name changes its structural signature - the gate can tell "same handler, different control" apart from "same control, unchanged"', () => {
    const asButton = `
      function Foo() {
        return <button onClick={openClients}>Clients</button>;
      }
    `;
    const asAnchorRoleButton = `
      function Foo() {
        return <div role="button" onClick={openClients}>Clients</div>;
      }
    `;
    const buttonControl = scanControlsInFile(FILE, asButton).controls[0];
    const roleButtonControl = scanControlsInFile(FILE, asAnchorRoleButton).controls[0];
    expect(buttonControl.kind).toBe('button');
    expect(roleButtonControl.kind).toBe('role_button');
    expect(buttonControl.signature).not.toBe(roleButtonControl.signature);
  });

  it('unrelated exemption mapped to the wrong control: a decorative exemption correctly attached to one control does not exempt a SEPARATE, later unmarked control in the same block', () => {
    const src = `
      function Foo() {
        return (
          <div>
            {/* PRODUCT_TRUTH_DECORATIVE: close_icon_button */}
            <button onClick={close}>X</button>
            <button onClick={doRealCapability}>Real capability, no marker</button>
          </div>
        );
      }
    `;
    const results = resolutionsOf(src);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ status: 'resolved', type: 'decorative', reason: 'close_icon_button' });
    expect(results[1].status).toBe('unresolved');
  });

  it('interaction type outside the scanner\'s original 4 regex patterns: an arbitrary custom component carrying onClick (not <button>/<a href>/role="button"/<Link>) is still discovered and requires resolution - proving the scanner cannot falsely report zero controls merely because the tag name is unfamiliar', () => {
    const src = `
      function Foo() {
        return <CustomActionCard onClick={doSomething}>Card</CustomActionCard>;
      }
    `;
    const [control] = scanControlsInFile(FILE, src).controls;
    expect(control).toBeTruthy();
    expect(control.kind).toBe('onclick_element');
    expect(control.tagName).toBe('CustomActionCard');
    expect(control.resolution.status).toBe('unresolved');
  });

  it('interaction type outside the original 4 patterns, touch-oriented onPress prop: also discovered and requires resolution', () => {
    const src = `
      function Foo() {
        return <TouchableCard onPress={doSomething}>Card</TouchableCard>;
      }
    `;
    const [control] = scanControlsInFile(FILE, src).controls;
    expect(control).toBeTruthy();
    expect(control.kind).toBe('onclick_element');
    expect(control.resolution.status).toBe('unresolved');
  });
});
