import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { checkComponentDivergence, CANONICAL_TEST_SOURCE_ROOT } from './check-component-divergence.js';

// Mirroring Integrity task (2026-09-18): tests the three Codex-identified
// gaps this script's own hardening pass closed - stale/missing canonical
// root, shared-shell file coverage, and severity escalation for a real
// divergence against the canonical Owner TEST source specifically.

function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'divergence-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(root, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe('CANONICAL_TEST_SOURCE_ROOT', () => {
  it('points at C:/tkrtl1, the actual current canonical Owner TEST source', () => {
    expect(CANONICAL_TEST_SOURCE_ROOT.path).toBe('C:/tkrtl1');
  });
});

describe('checkComponentDivergence - severity escalation (§5 "informational-only divergence warnings" gap)', () => {
  let rcRoot;
  let canonicalRoot;
  let otherRoot;
  const componentPath = 'src/AIChatWidget.jsx';

  afterEach(() => {
    for (const dir of [rcRoot, canonicalRoot, otherRoot]) {
      if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a real divergence against the canonical TEST source root is an "error" finding, not "warn"', () => {
    rcRoot = makeTree({ [componentPath]: 'export default function A() {}' });
    canonicalRoot = makeTree({ [componentPath]: 'export default function B() {}' });
    const findings = checkComponentDivergence(rcRoot, [{ ...CANONICAL_TEST_SOURCE_ROOT, path: canonicalRoot }]);
    const finding = findings.find((f) => f.component === componentPath);
    expect(finding).toBeDefined();
    expect(finding.level).toBe('error');
  });

  it('a divergence against a non-canonical worktree stays "warn" (legitimate separate work is not itself an error)', () => {
    rcRoot = makeTree({ [componentPath]: 'export default function A() {}' });
    otherRoot = makeTree({ [componentPath]: 'export default function C() {}' });
    const findings = checkComponentDivergence(rcRoot, [{ name: 'some-other-worktree', path: otherRoot }]);
    const finding = findings.find((f) => f.component === componentPath);
    expect(finding).toBeDefined();
    expect(finding.level).toBe('warn');
  });

  it('no finding at all when the file is byte-identical', () => {
    rcRoot = makeTree({ [componentPath]: 'export default function Same() {}' });
    canonicalRoot = makeTree({ [componentPath]: 'export default function Same() {}' });
    const findings = checkComponentDivergence(rcRoot, [{ ...CANONICAL_TEST_SOURCE_ROOT, path: canonicalRoot }]);
    expect(findings.find((f) => f.component === componentPath)).toBeUndefined();
  });

  it('comparing the canonical root against itself is a correct no-op, never a false self-divergence', () => {
    canonicalRoot = makeTree({ [componentPath]: 'export default function Self() {}' });
    const findings = checkComponentDivergence(canonicalRoot, [{ ...CANONICAL_TEST_SOURCE_ROOT, path: canonicalRoot }]);
    expect(findings.find((f) => f.component === componentPath)).toBeUndefined();
  });

  it('a file missing from the comparison root is silently skipped (not a false divergence)', () => {
    rcRoot = makeTree({ [componentPath]: 'export default function A() {}' });
    canonicalRoot = makeTree({});
    const findings = checkComponentDivergence(rcRoot, [{ ...CANONICAL_TEST_SOURCE_ROOT, path: canonicalRoot }]);
    expect(findings.find((f) => f.component === componentPath)).toBeUndefined();
  });

  it('a component missing from the release candidate itself is reported as "info", not an error', () => {
    rcRoot = makeTree({});
    const findings = checkComponentDivergence(rcRoot, []);
    const finding = findings.find((f) => f.component === componentPath);
    expect(finding.level).toBe('info');
  });
});

describe('LIVE_COMPONENT_PATHS coverage (§5 "shared shell files excluded from some byte checks" gap)', async () => {
  it('includes the shared authenticated Header/Sidebar frame and the AI Chat widget', async () => {
    const mod = await import('./check-component-divergence.js');
    // LIVE_COMPONENT_PATHS itself is not exported (module-local by design,
    // only consumed internally) - exercised indirectly instead: a
    // divergence check against a tree missing both files must report both
    // as "info: not present", proving they are genuinely in the checked set.
    const rcRoot = mkdtempSync(join(tmpdir(), 'divergence-coverage-'));
    try {
      const findings = mod.checkComponentDivergence(rcRoot, []);
      const components = findings.map((f) => f.component);
      expect(components).toContain('src/components/AuthenticatedShellFrames.jsx');
      expect(components).toContain('src/AIChatWidget.jsx');
    } finally {
      rmSync(rcRoot, { recursive: true, force: true });
    }
  });
});
