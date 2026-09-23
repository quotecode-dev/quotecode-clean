// PRODUCT TRUTH — ENFORCEABLE SOURCE INVENTORY gate (Codex "enforceable source inventory" finding,
// 2026-09-2X). Closes the gap the marker-only scanner cannot close on its own: a scan for markers
// can only ever report what a human already marked - it cannot, by construction, detect a NEW
// interactive control introduced with no marker at all. This file proves, with real data AND
// synthetic negative fixtures, that:
//   (a) every real, scannable file's interactive-vs-marker gap matches its committed baseline
//       (no undetected regression today);
//   (b) a NEW unmarked interactive control - in a brand-new file, or added to an existing one -
//       is caught the moment it grows a file's gap beyond its recorded baseline;
//   (c) a duplicate or undeclared-location marker is caught;
//   (d) a capability's marker surviving after its registry row is removed ("orphan marker") is
//       caught (reusing productTruthCapabilityScanner.js's own reconciliation, which already
//       covers exactly this direction - re-asserted here under the "enforceable source inventory"
//       requirement rather than duplicated).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PRODUCT_TRUTH_REGISTRY } from './productTruthRegistry.js';
import { scanCapabilityMarkers, listScannableFiles, reconcileDiscoveryWithRegistry } from './productTruthCapabilityScanner.js';
import { checkMarkerAmbiguity } from './productTruthGateLib.js';
import { countInteractiveSurface, scanInteractiveSurface, checkInteractiveCompleteness } from './productTruthInteractiveScanner.js';
import baseline from './productTruthInteractiveBaseline.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const fileExists = (rel) => existsSync(join(ROOT, rel));
const readFile = (rel) => readFileSync(join(ROOT, rel), 'utf-8');

describe('ENFORCEABLE SOURCE INVENTORY — real data (no undetected regression today)', () => {
  it('sanity: the baseline file actually covers a real, non-trivial file universe', () => {
    const files = listScannableFiles(ROOT, ['src', 'supabase/functions']);
    expect(files.length).toBeGreaterThan(100);
    expect(Object.keys(baseline).length).toBe(files.length);
  });

  it('every real file\'s current interactive-vs-marker gap is no worse than its committed baseline', () => {
    const files = listScannableFiles(ROOT, ['src', 'supabase/functions']);
    const current = scanInteractiveSurface(ROOT, files, fileExists, readFile);
    const failures = checkInteractiveCompleteness(current, baseline);
    expect(failures, `interactive-completeness regressions:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });

  it('the baseline generator is idempotent: regenerating from real source produces byte-identical counts to the committed file', () => {
    const files = listScannableFiles(ROOT, ['src', 'supabase/functions']);
    const fresh = scanInteractiveSurface(ROOT, files, fileExists, readFile);
    for (const [file, stats] of Object.entries(fresh)) {
      expect(baseline[file], `file "${file}" is missing from the committed baseline`).toBeTruthy();
      expect(baseline[file].interactive).toBe(stats.interactive);
      expect(baseline[file].markers).toBe(stats.markers);
    }
  });

  it('no discovered marker is ambiguous: no duplicate-in-file, no undeclared marker location', () => {
    const markers = scanCapabilityMarkers(ROOT, ['src', 'supabase/functions']);
    const failures = checkMarkerAmbiguity(markers, PRODUCT_TRUTH_REGISTRY);
    expect(failures, `marker ambiguity failures:\n${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });
});

describe('ENFORCEABLE SOURCE INVENTORY — negative fixtures (proves a visible capability cannot evade discovery merely by omitting a marker)', () => {
  it('fixture: a brand-new file with an unmarked <button> (new interactive action) is caught even with zero baseline entry', () => {
    const current = { 'src/components/BrandNewFeature.jsx': countInteractiveSurface('<button onClick={doThing}>Do the new thing</button>') };
    const failures = checkInteractiveCompleteness(current, {});
    expect(failures.some((f) => f.file === 'src/components/BrandNewFeature.jsx' && f.reason === 'new_file_unmarked')).toBe(true);
  });

  it('fixture: a brand-new file with an unmarked <Link> (new navigation action) is caught the same way', () => {
    const current = { 'src/pages/BrandNewPage.jsx': countInteractiveSurface('<Link to="/new-feature">Go</Link>') };
    const failures = checkInteractiveCompleteness(current, {});
    expect(failures.some((f) => f.file === 'src/pages/BrandNewPage.jsx' && f.reason === 'new_file_unmarked')).toBe(true);
  });

  it('fixture: a new unmarked control added to an ALREADY-baselined file (its gap grows) is caught as a regression, not masked by the file already existing', () => {
    const baselineForFile = { 'src/components/QuotesTab.jsx': { interactive: 13, markers: 3 } }; // real recorded shape
    const grown = { 'src/components/QuotesTab.jsx': countInteractiveSurface('x'.repeat(0) + Array.from({ length: 14 }, () => '<button onClick={x} />').join('\n') + '\n// PRODUCT_TRUTH_CAPABILITY: quote_status\n// PRODUCT_TRUTH_CAPABILITY: quote_csv\n// PRODUCT_TRUTH_CAPABILITY: quote_history\n') };
    const failures = checkInteractiveCompleteness(grown, baselineForFile);
    expect(failures.some((f) => f.file === 'src/components/QuotesTab.jsx' && f.reason === 'regression')).toBe(true);
  });

  it('fixture: a decorative control with NO exemption marker is indistinguishable from an unmarked capability and is caught (never a silent free pass)', () => {
    const current = { 'src/components/Modal.jsx': countInteractiveSurface('<button onClick={close}>X</button>') };
    const failures = checkInteractiveCompleteness(current, {});
    expect(failures.some((f) => f.file === 'src/components/Modal.jsx')).toBe(true);
  });

  it('fixture: the SAME decorative control WITH an explicit PRODUCT_TRUTH_DECORATIVE exemption passes (reviewed non-capability, not silently ignored)', () => {
    const current = { 'src/components/Modal.jsx': countInteractiveSurface('// PRODUCT_TRUTH_DECORATIVE: modal_close_button\n<button onClick={close}>X</button>') };
    const failures = checkInteractiveCompleteness(current, {});
    expect(failures.some((f) => f.file === 'src/components/Modal.jsx')).toBe(false);
  });

  it('fixture: duplicate capability marker (same id, same file, twice - accidental copy-paste) is caught', () => {
    const markers = [
      { id: 'editor_calculator', file: 'src/components/DraggableCalculator.jsx', line: 10 },
      { id: 'editor_calculator', file: 'src/components/DraggableCalculator.jsx', line: 40 },
    ];
    const failures = checkMarkerAmbiguity(markers, PRODUCT_TRUTH_REGISTRY);
    expect(failures.some((f) => f.id === 'editor_calculator' && f.reason === 'duplicate_in_file')).toBe(true);
  });

  it('fixture: a marker discovered in a file the registry never declared as a canonicalSource for that id (undeclared/ambiguous placement) is caught', () => {
    const markers = [{ id: 'editor_calculator', file: 'src/components/SomeUnrelatedFile.jsx', line: 1 }];
    const failures = checkMarkerAmbiguity(markers, PRODUCT_TRUTH_REGISTRY);
    expect(failures.some((f) => f.id === 'editor_calculator' && f.file === 'src/components/SomeUnrelatedFile.jsx' && f.reason === 'undeclared_marker_location')).toBe(true);
  });

  it('fixture: a decorative exemption on a genuinely different, unrelated interactive control does not mask a SEPARATE unmarked one in the same file (per-file gap counting, not per-marker)', () => {
    const current = {
      'src/components/Mixed.jsx': countInteractiveSurface(
        '// PRODUCT_TRUTH_DECORATIVE: close_button\n<button onClick={close}>X</button>\n<button onClick={doNewThing}>New capability</button>',
      ),
    };
    const failures = checkInteractiveCompleteness(current, {});
    expect(failures.some((f) => f.file === 'src/components/Mixed.jsx')).toBe(true); // 2 interactive, 1 marker -> gap 1 > baseline gap 0
  });

  it('fixture: capability removed from the registry but its source marker remains ("orphan marker") is caught (reconciliation direction, reused not duplicated)', () => {
    const discoveredById = { orphan_capability_marker: [{ file: 'src/components/StaleFeature.jsx', line: 1 }] };
    const { discoveredWithNoRegistryRow } = reconcileDiscoveryWithRegistry(discoveredById, PRODUCT_TRUTH_REGISTRY);
    expect(discoveredWithNoRegistryRow).toContain('orphan_capability_marker');
  });
});
