// PRODUCT TRUTH — SOURCE-OWNED CAPABILITY DISCOVERY tests (Codex finding 1, 2026-09-24).
//
// Proves two separate things, deliberately kept apart: (1) the scanner MECHANISM actually reads
// arbitrary files from disk and finds markers (fixture-directory tests, independent of this repo's
// current content), and (2) TODAY's real repository state is clean when scanned for real and
// reconciled against the real registry. A checker that only ever looked clean against fixture (1)
// or only ever ran against real data (2) would each miss a different class of defect.
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { PRODUCT_TRUTH_REGISTRY } from './productTruthRegistry.js';
import { scanCapabilityMarkers, groupMarkersById, reconcileDiscoveryWithRegistry } from './productTruthCapabilityScanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const discovered = groupMarkersById(scanCapabilityMarkers(ROOT, ['src', 'supabase/functions']));

describe('SOURCE-OWNED CAPABILITY DISCOVERY — scanner mechanism (fixture directory, independent of real repo content)', () => {
  let scratchDir;

  afterEach(() => {
    if (scratchDir && existsSync(scratchDir)) rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  });

  it('discovers a plain `//` marker in a real file written to disk', () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'pt-scanner-'));
    mkdirSync(join(scratchDir, 'src', 'components'), { recursive: true });
    writeFileSync(
      join(scratchDir, 'src', 'components', 'Fixture.jsx'),
      "// PRODUCT_TRUTH_CAPABILITY: fixture_capability_one\nexport function Fixture() { return null; }\n",
      'utf-8',
    );
    const markers = scanCapabilityMarkers(scratchDir, ['src']);
    expect(markers).toEqual([{ id: 'fixture_capability_one', file: 'src/components/Fixture.jsx', line: 1 }]);
  });

  it('discovers a JSX `{/* */}` marker form and reports the correct line number', () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'pt-scanner-'));
    mkdirSync(join(scratchDir, 'src'), { recursive: true });
    writeFileSync(
      join(scratchDir, 'src', 'Fixture2.jsx'),
      "export function F() {\n  return (\n    <div>\n      {/* PRODUCT_TRUTH_CAPABILITY: fixture_capability_two */}\n      <button />\n    </div>\n  );\n}\n",
      'utf-8',
    );
    const markers = scanCapabilityMarkers(scratchDir, ['src']);
    expect(markers).toEqual([{ id: 'fixture_capability_two', file: 'src/Fixture2.jsx', line: 4 }]);
  });

  it('finds multiple distinct markers across multiple files and nested directories, without any file list being supplied', () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'pt-scanner-'));
    mkdirSync(join(scratchDir, 'src', 'a', 'b'), { recursive: true });
    mkdirSync(join(scratchDir, 'supabase', 'functions', 'x'), { recursive: true });
    writeFileSync(join(scratchDir, 'src', 'a', 'One.js'), '// PRODUCT_TRUTH_CAPABILITY: fixture_a\n', 'utf-8');
    writeFileSync(join(scratchDir, 'src', 'a', 'b', 'Two.ts'), '// PRODUCT_TRUTH_CAPABILITY: fixture_b\n', 'utf-8');
    writeFileSync(join(scratchDir, 'supabase', 'functions', 'x', 'index.ts'), '// PRODUCT_TRUTH_CAPABILITY: fixture_c\n', 'utf-8');
    const markers = scanCapabilityMarkers(scratchDir, ['src', 'supabase']);
    const ids = markers.map((m) => m.id).sort();
    expect(ids).toEqual(['fixture_a', 'fixture_b', 'fixture_c']);
  });

  it('never discovers a marker inside a *.test.js/.test.jsx file (test fixtures are not implementation sites)', () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'pt-scanner-'));
    mkdirSync(join(scratchDir, 'src'), { recursive: true });
    writeFileSync(join(scratchDir, 'src', 'Real.jsx'), '// PRODUCT_TRUTH_CAPABILITY: fixture_real\n', 'utf-8');
    writeFileSync(join(scratchDir, 'src', 'Real.test.jsx'), '// PRODUCT_TRUTH_CAPABILITY: fixture_should_not_appear\n', 'utf-8');
    const markers = scanCapabilityMarkers(scratchDir, ['src']);
    expect(markers.map((m) => m.id)).toEqual(['fixture_real']);
  });

  it('a file with no marker at all yields zero entries for it (no false positive from mere presence)', () => {
    scratchDir = mkdtempSync(join(tmpdir(), 'pt-scanner-'));
    mkdirSync(join(scratchDir, 'src'), { recursive: true });
    writeFileSync(join(scratchDir, 'src', 'Empty.jsx'), 'export function Empty() { return null; }\n', 'utf-8');
    const markers = scanCapabilityMarkers(scratchDir, ['src']);
    expect(markers).toEqual([]);
  });
});

describe('SOURCE-OWNED CAPABILITY DISCOVERY — real repository scan reconciled against the real registry', () => {
  it('the real scan does not accidentally discover a marker inside its own scanner module (self-scan guard)', () => {
    // Sanity: the scanner's own source text mentions the marker convention in prose/regex-building
    // code, and must not have matched itself into a bogus discovered id.
    const scannerText = readFileSync(join(ROOT, 'src', 'data', 'productTruthCapabilityScanner.js'), 'utf-8');
    expect(scannerText).toContain("['PRODUCT', 'TRUTH_CAPABILITY:']"); // sanity the split-string guard is really there
    const fromScannerFile = Object.values(discovered).flat().filter((m) => m.file === 'src/data/productTruthCapabilityScanner.js');
    expect(fromScannerFile).toEqual([]);
  });

  it('the real scan discovers exactly the 38 real, LIVE_CURRENT capability ids - no more, no fewer', () => {
    const ids = Object.keys(discovered).sort();
    const expectedLiveCurrentIds = PRODUCT_TRUTH_REGISTRY.filter((c) => c.state === 'LIVE_CURRENT').map((c) => c.id).sort();
    expect(ids).toEqual(expectedLiveCurrentIds);
  });

  it('reconciliation: every discovered marker maps to a real LIVE_CURRENT registry row, and every LIVE_CURRENT row has at least one discovered marker', () => {
    const { discoveredWithNoRegistryRow, liveCurrentWithNoDiscoveredMarker } = reconcileDiscoveryWithRegistry(discovered, PRODUCT_TRUTH_REGISTRY);
    expect(discoveredWithNoRegistryRow, `markers with no registry row: ${discoveredWithNoRegistryRow.join(', ')}`).toEqual([]);
    expect(liveCurrentWithNoDiscoveredMarker, `LIVE_CURRENT capabilities with no discoverable marker: ${liveCurrentWithNoDiscoveredMarker.join(', ')}`).toEqual([]);
  });
});

describe('SOURCE-OWNED CAPABILITY DISCOVERY — reconciliation negative fixtures (proves the checker has teeth)', () => {
  it('fixture: a discovered marker with an id the registry does not have at all is caught', () => {
    const discoveredById = { totally_unregistered_marker: [{ file: 'x.jsx', line: 1 }] };
    const { discoveredWithNoRegistryRow } = reconcileDiscoveryWithRegistry(discoveredById, PRODUCT_TRUTH_REGISTRY);
    expect(discoveredWithNoRegistryRow).toContain('totally_unregistered_marker');
  });

  it('fixture: a discovered marker whose registry row exists but is NOT LIVE_CURRENT (e.g. ROADMAP_POST_LIVE) is caught the same way', () => {
    const discoveredById = { ai_mutation: [{ file: 'x.jsx', line: 1 }] }; // ai_mutation is a real, but non-current, id
    const { discoveredWithNoRegistryRow } = reconcileDiscoveryWithRegistry(discoveredById, PRODUCT_TRUTH_REGISTRY);
    expect(discoveredWithNoRegistryRow).toContain('ai_mutation');
  });

  it('fixture: a LIVE_CURRENT registry row with zero discovered markers (marker removed from source) is caught', () => {
    const syntheticRegistry = [...PRODUCT_TRUTH_REGISTRY, { id: 'phantom_no_marker', state: 'LIVE_CURRENT' }];
    const { liveCurrentWithNoDiscoveredMarker } = reconcileDiscoveryWithRegistry(discovered, syntheticRegistry);
    expect(liveCurrentWithNoDiscoveredMarker).toContain('phantom_no_marker');
  });

  it('fixture: removing a real marker from the discovered set (simulating source deletion) is caught against the real registry', () => {
    const withoutOne = { ...discovered };
    delete withoutOne.editor_calculator;
    const { liveCurrentWithNoDiscoveredMarker } = reconcileDiscoveryWithRegistry(withoutOne, PRODUCT_TRUTH_REGISTRY);
    expect(liveCurrentWithNoDiscoveredMarker).toContain('editor_calculator');
  });

  it('fixture: a brand-new marker appearing in source with no registry coverage at all is caught (new capability added without registry update)', () => {
    const withExtra = { ...discovered, brand_new_unregistered_ui_action: [{ file: 'src/components/New.jsx', line: 10 }] };
    const { discoveredWithNoRegistryRow } = reconcileDiscoveryWithRegistry(withExtra, PRODUCT_TRUTH_REGISTRY);
    expect(discoveredWithNoRegistryRow).toContain('brand_new_unregistered_ui_action');
  });
});
