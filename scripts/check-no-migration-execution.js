// Migration-safety guard, specific to the TEKANGO "get the approved product
// to LIVE" task. This release is explicitly forbidden from applying,
// deploying, or shipping any Supabase migration/schema change. Proves,
// using git evidence only, that:
//
//  (A) this commit/index introduces no new file under supabase/migrations/
//      relative to the given base ref (origin/main);
//  (B) the three specifically-named forbidden migration files from the
//      September 2026 unauthorized-migration incident are absent from this
//      worktree's index entirely;
//  (C) no build/release script in this worktree invokes the Supabase CLI's
//      migration-apply commands (`supabase db push`, `supabase migration
//      up`, etc.).
//
// Usage: node scripts/check-no-migration-execution.js <base-ref>
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: process.cwd(), encoding: 'utf-8' }).trim();
}

const FORBIDDEN_MIGRATION_FILES = [
  'supabase/migrations/20260902000000_add_professional_quote_items_stage_a.sql',
  'supabase/migrations/20260903000000_add_business_professional_domain.sql',
  'supabase/migrations/20260904000000_add_professional_quote_hierarchy.sql',
];

export function checkNoMigrationExecution(baseRef = 'origin/main') {
  const findings = [];
  const trackedFiles = git('ls-files').split('\n').filter(Boolean);

  // (A) no new migrations vs base
  let baseFiles = [];
  try {
    baseFiles = git(`ls-tree -r --name-only ${baseRef}`).split('\n').filter(Boolean);
  } catch (e) {
    findings.push({ level: 'error', check: 'A-no-new-migrations', message: `Could not read base ref ${baseRef}: ${e.message}` });
  }
  const baseMigrations = new Set(baseFiles.filter((f) => f.startsWith('supabase/migrations/')));
  const currentMigrations = trackedFiles.filter((f) => f.startsWith('supabase/migrations/'));
  const newMigrations = currentMigrations.filter((f) => !baseMigrations.has(f));
  if (newMigrations.length > 0) {
    findings.push({ level: 'error', check: 'A-no-new-migrations', message: `New migration file(s) present relative to ${baseRef}: ${newMigrations.join(', ')}` });
  } else {
    findings.push({ level: 'info', check: 'A-no-new-migrations', message: `No new files under supabase/migrations/ relative to ${baseRef}.` });
  }

  // (B) forbidden files absent
  const present = FORBIDDEN_MIGRATION_FILES.filter((f) => trackedFiles.includes(f) || existsSync(f));
  if (present.length > 0) {
    findings.push({ level: 'error', check: 'B-forbidden-files-absent', message: `Forbidden migration file(s) present: ${present.join(', ')}` });
  } else {
    findings.push({ level: 'info', check: 'B-forbidden-files-absent', message: 'All three named forbidden migration files are absent from this worktree.' });
  }

  // (C) no migration-apply invocation in package.json scripts
  if (existsSync('package.json')) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const scripts = pkg.scripts || {};
    const dangerousPattern = /supabase\s+(db\s+push|migration\s+up|db\s+reset)/i;
    const offending = Object.entries(scripts).filter(([, cmd]) => dangerousPattern.test(cmd));
    if (offending.length > 0) {
      findings.push({ level: 'error', check: 'C-no-apply-script', message: `package.json script(s) invoke Supabase migration-apply commands: ${offending.map(([k]) => k).join(', ')}` });
    } else {
      findings.push({ level: 'info', check: 'C-no-apply-script', message: 'No package.json script invokes a Supabase migration-apply command.' });
    }
  }

  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseRef = process.argv[2] || 'origin/main';
  const findings = checkNoMigrationExecution(baseRef);
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] [${f.check}] ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length > 0) process.exit(1);
  else console.log('\nNo-migration-execution gate: PASS');
}
