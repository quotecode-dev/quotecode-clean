// External-path/worktree-escape guard, adapted for the TEKANGO live-release
// worktree. Fails if build/runtime application source (specifically
// node_modules) resolves to a real path outside this workspace's own root
// through a symlink/junction/reparse point, UNLESS that escape is both
// intentional and explicitly covered by a matching Vite server.fs.allow
// entry (a mitigated, documented exception - not a silent one). This
// release candidate is expected to have NO such escape at all, since it was
// built with a real, independent `npm install` specifically to avoid this
// class of risk end-to-end.
import { lstatSync, realpathSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkExternalSourceEscape(workspaceRoot = process.cwd()) {
  const nodeModulesPath = join(workspaceRoot, 'node_modules');
  const findings = [];

  if (!existsSync(nodeModulesPath)) {
    findings.push({ level: 'error', message: 'node_modules does not exist - run npm install before serving/building.' });
    return findings;
  }

  const isLink = lstatSync(nodeModulesPath).isSymbolicLink();
  if (!isLink) {
    findings.push({ level: 'info', message: 'node_modules is a real directory, not a symlink/junction - no external-path escape possible for package resolution.' });
    return findings;
  }

  const realPath = resolve(realpathSync(nodeModulesPath));
  const workspaceReal = resolve(realpathSync(workspaceRoot));
  const escapes = !realPath.toLowerCase().startsWith(workspaceReal.toLowerCase());
  if (!escapes) {
    findings.push({ level: 'info', message: 'node_modules is a symlink but resolves inside the workspace root - no escape.' });
    return findings;
  }

  let covered = false;
  try {
    const viteConfigPath = join(workspaceRoot, 'vite.config.js');
    if (existsSync(viteConfigPath)) {
      const configText = readFileSync(viteConfigPath, 'utf-8');
      covered = configText.includes(realPath.split('\\').join('/')) || configText.includes(realPath);
    }
  } catch { /* best effort */ }

  if (covered) {
    findings.push({ level: 'warn', message: `node_modules escapes the workspace root to ${realPath}, but is explicitly allow-listed in vite.config.js - a documented, mitigated exception, not a silent one.` });
  } else {
    findings.push({ level: 'error', message: `node_modules escapes the workspace root to ${realPath} with no matching server.fs.allow entry - application source/assets can silently 403 and fall back through this path.` });
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = checkExternalSourceEscape();
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
  else console.log('\nExternal-source-escape gate: PASS');
}
