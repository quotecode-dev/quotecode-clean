import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Consolidated Gate 1, §6.1/§10: the committed aiFacts.generated.ts must
// never be allowed to drift from the canonical sources it was generated
// from. This test regenerates the facts in-process (via the generator's
// --check mode) and fails the build if the committed file differs from what
// canonical sources currently produce - "fail build/test, do not silently
// fall back to stale handwritten values" (§10).
describe('aiFacts.generated.ts staleness guard', () => {
  it('is not stale relative to canonical sources (run `node scripts/generate-ai-chat-facts.js` to fix)', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const scriptPath = join(__dirname, '..', '..', '..', 'scripts', 'generate-ai-chat-facts.js');

    expect(() => {
      execFileSync('node', [scriptPath, '--check'], { stdio: 'pipe' });
    }).not.toThrow();
  });
});
