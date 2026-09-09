// Production deployed-artifact verification (Gate E).
//
// Owner-authorized systemic remediation task (2026-09-09). After a
// Production deploy, this proves - rather than assumes - that the LIVE
// site is actually serving the commit that was just pushed, using the
// version.json mechanism (Gate F, src/shared/versionAwareness.js) that
// every build since a9838d4 now generates. Read-only HTTP GET against the
// live domain only - never mutates anything.
//
// Usage: node scripts/verify-production-artifact.js [--expected-sha <sha>] [--url https://www.tekango.com]
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function currentHeadSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
}

export async function verifyProductionArtifact({ expectedSha, url = 'https://www.tekango.com' } = {}) {
  const sha = expectedSha || currentHeadSha();
  const res = await fetch(`${url}/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) {
    return { match: false, reason: `version.json fetch failed: HTTP ${res.status}`, expectedSha: sha, deployedSha: null };
  }
  const data = await res.json();
  const deployedSha = data?.buildSha || null;
  return { match: deployedSha === sha, expectedSha: sha, deployedSha, buildTime: data?.buildTime || null };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const shaIdx = args.indexOf('--expected-sha');
  const urlIdx = args.indexOf('--url');
  const result = await verifyProductionArtifact({
    expectedSha: shaIdx !== -1 ? args[shaIdx + 1] : undefined,
    url: urlIdx !== -1 ? args[urlIdx + 1] : undefined,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.match) {
    console.log(`\nRESULT: PRODUCTION ARTIFACT MATCHES (${result.expectedSha})`);
  } else {
    console.log(`\nRESULT: MISMATCH — expected ${result.expectedSha}, Production is serving ${result.deployedSha ?? '(unreachable)'}`);
  }
  process.exit(result.match ? 0 : 1);
}
