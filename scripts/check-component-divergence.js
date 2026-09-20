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

// Mirroring Integrity task (2026-09-18), closing a Codex-identified gap:
// "shared shell files excluded from some byte checks" - the shared
// authenticated Header/Sidebar frame (AuthenticatedShellFrames.jsx) and the
// always-available AI Chat widget (AIChatWidget.jsx) render on every
// authenticated screen, so a silent divergence there is exactly the kind of
// cross-cutting regression this guard exists to catch - it was simply never
// added to the list before now.
const LIVE_COMPONENT_PATHS = [
  'src/pages/LandingLocal.jsx',
  'src/pages/LandingGlobal.jsx',
  'src/components/ProFlowLogo.jsx',
  'src/pages/Dashboard.jsx',
  'src/components/QuoteForm.jsx',
  'src/components/ClientsTab.jsx',
  'src/components/QuotesTab.jsx',
  'src/utils/pricingCatalog.js',
  'src/components/AuthenticatedShellFrames.jsx',
  'src/AIChatWidget.jsx',
  // Pre-LIVE closure: Admin (unified shell + screens), scroll-layout owners,
  // Public Quote, plans/pricing, Header date/time and the shared stylesheet.
  'src/components/AdminScreenFrame.jsx',
  'src/components/AdminSidebarNav.jsx',
  'src/components/AdminOverview.jsx',
  'src/components/AdminUsersView.jsx',
  'src/components/AdminUsersTab.jsx',
  'src/components/AdminUserDetails.jsx',
  'src/components/AdminPlans.jsx',
  'src/components/AdminSystemActivity.jsx',
  'src/components/adminUsers.css',
  'src/components/FinancesTab.jsx',
  'src/components/SettingsTab.jsx',
  'src/components/ServicesCatalog.jsx',
  'src/components/PricingModal.jsx',
  'src/components/PlanIdentityBadge.jsx',
  'src/components/PublicQuoteHeader.jsx',
  'src/pages/PublicQuote.jsx',
  'src/pages/PublicQuoteEn.jsx',
  'src/utils/headerDateFormat.js',
  'src/index.css',
];

// Mirroring Integrity task, closing a second Codex-identified gap: "stale
// source-identity roots / divergence guard roots that omit current TEST
// source" - the canonical dirty TEST worktree that actually serves
// http://192.168.1.189:5186/ (see PROFLOW_CODEX_CHECKPOINT.md's own
// "CURRENT CANONICAL OWNER TEST STATE" section) was previously never a
// comparison root at all, only ever the thing being compared FROM when this
// script happened to be run with rcRoot=this path. Exported so a future
// release-candidate check run from elsewhere can also compare against it
// explicitly, and so this file itself can be asserted to still exist as a
// path (see the test file) rather than silently going stale if this
// worktree is ever retired/renamed.
// `canonical: true` (not object-reference identity) is the marker
// checkComponentDivergence uses to escalate a divergence to 'error' below -
// keeps the check robust to a caller passing an equivalent-but-reconstructed
// root object (e.g. spread into a new object with a substitute `path`, the
// exact shape this file's own test uses to exercise the escalation logic
// against a temp directory instead of the real C:/tkrtl1).
export const CANONICAL_TEST_SOURCE_ROOT = { name: 'canonical-owner-TEST (C:\\tkrtl1, serves 192.168.1.189:5186)', path: 'C:/tkrtl1', canonical: true };

// Known active worktrees/checkouts relevant to this specific release task.
//
// Mirroring Integrity task correction: "main-worktree" below was originally
// labeled "approved authenticated UI source" - that was accurate when this
// script was first written, but the canonical Owner TEST runtime
// (http://192.168.1.189:5186/) has since moved to a dedicated worktree
// (`C:\tkrtl1`, see PROFLOW_CODEX_CHECKPOINT.md's own "CURRENT CANONICAL
// OWNER TEST STATE" section, freshly re-verified via port/process/HEAD
// multiple times as of this task) - this file's own label had silently
// gone stale, a real instance of the "stale source-identity roots" gap
// Codex identified. `CANONICAL_TEST_SOURCE_ROOT` above is now the
// authoritative one; `main-worktree` is kept (it is still a real,
// continuously-active tree - the canonical dirty `main` branch, and the
// home of this checkpoint file itself) but relabeled to its actual current
// role rather than the live-serving one it no longer has.
function defaultComparisonRoots() {
  return [
    CANONICAL_TEST_SOURCE_ROOT,
    { name: 'main-worktree (canonical dirty main branch / continuity root - not the live-serving TEST source)', path: 'C:/Users/sales/Documents/YoutubeChanel/WebSite/quotecode-saas' },
    { name: 'plan-identity-release', path: 'C:/Users/sales/Documents/YoutubeChanel/WebSite/quotecode-saas-plan-identity-release' },
  ];
}

function hashFile(path) {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Mirroring Integrity task, closing a third Codex-identified gap:
// "informational-only divergence warnings" - a divergence against every
// OTHER worktree genuinely can be legitimate, not-yet-reconciled separate
// work (this script's own original, still-correct philosophy, unchanged),
// so those stay 'warn'/informational. A divergence specifically against
// CANONICAL_TEST_SOURCE_ROOT is different in kind: when `rcRoot` is NOT
// itself that same canonical path, it means a release-candidate worktree's
// shared-shell/Header/Chat file has drifted from what the Owner is actually
// looking at right now on 5186 - a real, actionable signal, promoted to
// 'error' (never silently informational). Comparing the canonical root
// against itself (rcRoot === canonical path) is correctly a no-op (skipped
// below), never a false self-divergence.
export function checkComponentDivergence(rcRoot = process.cwd(), comparisonRoots = defaultComparisonRoots()) {
  const findings = [];
  const normalizedRcRoot = rcRoot.replace(/\\/g, '/').replace(/\/$/, '');
  for (const componentPath of LIVE_COMPONENT_PATHS) {
    const rcFile = join(rcRoot, componentPath);
    const rcHash = hashFile(rcFile);
    if (rcHash === null) {
      findings.push({ level: 'info', component: componentPath, message: 'Not present in this release candidate.' });
      continue;
    }
    for (const root of comparisonRoots) {
      if (!existsSync(root.path)) continue;
      if (root.path.replace(/\\/g, '/').replace(/\/$/, '') === normalizedRcRoot) continue;
      const otherFile = join(root.path, componentPath);
      const otherHash = hashFile(otherFile);
      if (otherHash === null) continue;
      if (otherHash !== rcHash) {
        const isCanonical = root.canonical === true;
        findings.push({
          level: isCanonical ? 'error' : 'warn',
          component: componentPath,
          comparedTo: root.name,
          message: isCanonical
            ? `Diverges from the CANONICAL OWNER TEST SOURCE ("${root.name}", ${root.path}) - this release candidate does not match what is actually live at http://192.168.1.189:5186/ for this shared-shell file.`
            : `Diverges from the version in "${root.name}" (${root.path}) - a real, different, buildable version of this component exists there.`,
        });
      }
    }
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = checkComponentDivergence();
  const errors = findings.filter((f) => f.level === 'error');
  const warnings = findings.filter((f) => f.level === 'warn');
  for (const f of findings) {
    if (f.level === 'error') console.log(`[CANONICAL-DIVERGENT] ${f.component} vs ${f.comparedTo}: ${f.message}`);
    else if (f.level === 'warn') console.log(`[DIVERGENT] ${f.component} vs ${f.comparedTo}: ${f.message}`);
    else console.log(`[INFO] ${f.component}: ${f.message}`);
  }
  console.log(`\nComponent-divergence gate: ${errors.length} canonical-source divergence(s) (gates the exit code), ${warnings.length} other-worktree divergence(s) (informational only - a legitimate, not-yet-reconciled separate worktree is not itself an error).`);
  if (errors.length > 0) process.exit(1);
}
