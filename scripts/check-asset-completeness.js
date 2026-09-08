// Referenced-asset completeness guard, adapted for the TEKANGO live-release
// worktree. Fails if committed application source (HTML/CSS/JSX/JS)
// references a local product asset (logo, favicon, video, poster, caption,
// public image) that is not present as a tracked file in this exact
// worktree. This is the exact class of bug proven in an earlier forensic
// audit: index.html's favicon <link> tags were committed while the PNG
// files themselves were not, so a git-based deployment silently served its
// own SPA fallback page in their place with no error anywhere in the
// pipeline.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim();
}

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, exts, out);
    else if (exts.includes(extname(full))) out.push(full);
  }
  return out;
}

const ASSET_REF_PATTERN = /(?:src|href|poster)=["']?(\/[\w.\-/]+\.(?:png|jpg|jpeg|svg|ico|mp4|webm|vtt|woff2?|ttf))["']?|url\(["']?(\/[\w.\-/]+\.(?:png|jpg|jpeg|svg|ico|mp4|webm))["']?\)/g;

export function checkAssetCompleteness(root = process.cwd()) {
  const files = walk(join(root, 'src'), ['.js', '.jsx', '.ts', '.tsx', '.css']);
  files.push(join(root, 'index.html'));
  const trackedFiles = new Set(git('ls-files').split('\n'));
  const findings = [];
  const checked = new Set();

  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    let m;
    while ((m = ASSET_REF_PATTERN.exec(content))) {
      const assetPath = (m[1] || m[2]).replace(/^\//, '');
      if (checked.has(assetPath)) continue;
      checked.add(assetPath);
      const candidatePublicPath = `public/${assetPath}`;
      const isTracked = trackedFiles.has(candidatePublicPath) || trackedFiles.has(assetPath);
      if (!isTracked) {
        findings.push({ level: 'error', asset: assetPath, referencedIn: file.replace(root, '').replace(/\\/g, '/'), message: `Referenced local asset "/${assetPath}" is not a tracked file in this worktree (checked ${candidatePublicPath}).` });
      }
    }
  }

  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = checkAssetCompleteness();
  if (findings.length === 0) {
    console.log('Asset-completeness gate: PASS (every referenced local asset is tracked)');
  } else {
    for (const f of findings) console.error(`[ERROR] ${f.asset} (referenced in ${f.referencedIn}): ${f.message}`);
    console.error(`\nAsset-completeness gate: ${findings.length} missing/untracked asset reference(s).`);
    process.exit(1);
  }
}
