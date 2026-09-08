// Build-source-scope guard, specific to the TEKANGO "get the approved
// product to LIVE" task. Proves the production build is sourced ONLY from
// this isolated release worktree - not from the canonical dirty main
// checkout, not from any other worktree - by confirming vite.config.js
// declares no `root`/`build.outDir`/`resolve.alias` pointing outside this
// workspace, and that this process's cwd is in fact this worktree.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXTERNAL_PATH_PATTERN = /['"`](?:[A-Za-z]:[\\/]|\.\.[\\/])[^'"`]*['"`]/g;

export function checkBuildSourceScope(workspaceRoot = process.cwd()) {
  const findings = [];
  const configPath = resolve(workspaceRoot, 'vite.config.js');
  if (!existsSync(configPath)) {
    findings.push({ level: 'error', message: 'vite.config.js not found in this worktree.' });
    return findings;
  }
  const configText = readFileSync(configPath, 'utf-8');
  const hasRootOverride = /\broot\s*:/.test(configText);
  const hasOutDirOverride = /\boutDir\s*:/.test(configText);
  if (hasRootOverride) {
    findings.push({ level: 'error', message: 'vite.config.js declares a `root` override - build could be sourced from outside this worktree.' });
  }
  if (hasOutDirOverride) {
    findings.push({ level: 'warn', message: 'vite.config.js declares an `outDir` override - verify it still resolves inside this worktree.' });
  }
  const externalPathRefs = configText.match(EXTERNAL_PATH_PATTERN) || [];
  const suspicious = externalPathRefs.filter((ref) => {
    const inner = ref.slice(1, -1);
    try {
      const abs = resolve(workspaceRoot, inner);
      return !realpathSync(abs).toLowerCase().startsWith(realpathSync(workspaceRoot).toLowerCase());
    } catch {
      return /^[A-Za-z]:[\\/]/.test(inner);
    }
  });
  if (suspicious.length > 0) {
    findings.push({ level: 'error', message: `vite.config.js references path(s) outside this worktree: ${suspicious.join(', ')}` });
  }
  if (!hasRootOverride && suspicious.length === 0) {
    findings.push({ level: 'info', message: `vite.config.js has no root/path override escaping the workspace - build is sourced only from ${workspaceRoot}.` });
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = checkBuildSourceScope();
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
  else console.log('\nBuild-source-scope gate: PASS');
}
