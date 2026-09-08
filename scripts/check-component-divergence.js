// Same-named component divergence guard, adapted for the TEKANGO
// live-release worktree. Compares a fixed list of live-named UI components
// in THIS release candidate against the same paths in other known active
// worktrees, reporting any that differ. A divergent alternate existing
// elsewhere is not itself an error (other worktrees may be legitimate,
// separate, not-yet-reconciled work) - but it must never be silent. This
// script reports, it does not resolve, divergence.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const LIVE_COMPONENT_PATHS = [
  'src/pages/LandingLocal.jsx',
  'src/pages/LandingGlobal.jsx',
  'src/components/ProFlowLogo.jsx',
  'src/pages/Dashboard.jsx',
  'src/components/QuoteForm.jsx',
  'src/components/ClientsTab.jsx',
  'src/components/QuotesTab.jsx',
  'src/utils/pricingCatalog.js',
];

// Known active worktrees/checkouts relevant to this specific release task.
// The canonical dirty TEST tree is the approved authenticated-UI source of
// truth for this task (port 5186 serves it directly) - a reported
// divergence there for an included file is a real signal, not noise.
// Dashboard.jsx/index.css are EXPECTED to diverge from it (deliberate,
// documented, backend-safety surgical exclusions) - see
// check-release-source-identity.js's SURGICALLY_MODIFIED list.
function defaultComparisonRoots() {
  return [
    { name: 'main-worktree (dirty TEST, approved authenticated UI source)', path: 'C:/Users/sales/Documents/YoutubeChanel/WebSite/quotecode-saas' },
    { name: 'plan-identity-release', path: 'C:/Users/sales/Documents/YoutubeChanel/WebSite/quotecode-saas-plan-identity-release' },
  ];
}

function hashFile(path) {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function checkComponentDivergence(rcRoot = process.cwd(), comparisonRoots = defaultComparisonRoots()) {
  const findings = [];
  for (const componentPath of LIVE_COMPONENT_PATHS) {
    const rcFile = join(rcRoot, componentPath);
    const rcHash = hashFile(rcFile);
    if (rcHash === null) {
      findings.push({ level: 'info', component: componentPath, message: 'Not present in this release candidate.' });
      continue;
    }
    for (const root of comparisonRoots) {
      if (!existsSync(root.path)) continue;
      const otherFile = join(root.path, componentPath);
      const otherHash = hashFile(otherFile);
      if (otherHash === null) continue;
      if (otherHash !== rcHash) {
        findings.push({ level: 'warn', component: componentPath, comparedTo: root.name, message: `Diverges from the version in "${root.name}" (${root.path}) - a real, different, buildable version of this component exists there.` });
      }
    }
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = checkComponentDivergence();
  const divergences = findings.filter((f) => f.level === 'warn');
  for (const f of findings) {
    if (f.level === 'warn') console.log(`[DIVERGENT] ${f.component} vs ${f.comparedTo}: ${f.message}`);
    else console.log(`[INFO] ${f.component}: ${f.message}`);
  }
  console.log(`\nComponent-divergence gate: ${divergences.length} divergence(s) reported (informational - not a build failure by itself; must not become silently authoritative).`);
}
