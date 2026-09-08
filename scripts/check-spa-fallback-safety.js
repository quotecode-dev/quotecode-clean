// SPA-fallback-safety guard, specific to the TEKANGO "get the approved
// product to LIVE" task. This is the exact failure class proven in the
// earlier forensic audit: a referenced asset can be "tracked" in source yet
// still be missing from the actual BUILD OUTPUT (wrong path casing, wrong
// public/ subpath, build-time exclusion), in which case a static host
// serves its SPA-fallback index.html in place of the asset with HTTP 200
// and no visible error anywhere in the pipeline. This guard runs AFTER
// `vite build` and checks the real dist/ output, not just source tracking.
//
// Usage: node scripts/check-spa-fallback-safety.js [dist-dir]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

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

function readIndexHtmlHead(distDir) {
  const p = join(distDir, 'index.html');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8').slice(0, 30);
}

export function checkSpaFallbackSafety(root = process.cwd(), distDir = join(root, 'dist')) {
  const findings = [];
  if (!existsSync(distDir)) {
    findings.push({ level: 'error', message: `dist/ does not exist at ${distDir} - run \`vite build\` first.` });
    return findings;
  }
  const indexHead = readIndexHtmlHead(distDir);
  if (indexHead === null) {
    findings.push({ level: 'error', message: 'dist/index.html is missing.' });
    return findings;
  }

  const files = walk(join(root, 'src'), ['.js', '.jsx', '.ts', '.tsx', '.css']);
  files.push(join(root, 'index.html'));
  const checked = new Set();

  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    let m;
    while ((m = ASSET_REF_PATTERN.exec(content))) {
      const assetPath = (m[1] || m[2]).replace(/^\//, '');
      if (checked.has(assetPath)) continue;
      checked.add(assetPath);
      const distFile = join(distDir, assetPath);
      if (!existsSync(distFile)) {
        findings.push({ level: 'error', asset: assetPath, message: `Referenced asset "/${assetPath}" does not exist in the build output (${distFile}) - a static host would serve the SPA fallback (index.html) here instead.` });
        continue;
      }
      // Confirm it is the real binary/asset, not accidentally the SPA
      // fallback HTML page (would happen if a rewrite rule mis-routed it,
      // or if the file is a zero-byte placeholder).
      const stat = statSync(distFile);
      if (stat.size === 0) {
        findings.push({ level: 'error', asset: assetPath, message: `Asset "/${assetPath}" exists in dist/ but is zero bytes.` });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({ level: 'info', message: `All referenced assets are present as real files in ${distDir} - no SPA-fallback-through-missing-asset risk detected.` });
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2];
  const findings = checkSpaFallbackSafety(process.cwd(), distDir ? join(process.cwd(), distDir) : undefined);
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
  else console.log('\nSPA-fallback-safety gate: PASS');
}
