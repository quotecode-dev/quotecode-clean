import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
function readSource(relativePath) {
  return readFileSync(join(__dirname, relativePath), 'utf-8');
}

// Same rationale as landingCopyTruthfulness.test.js: these files document
// their own fixes in {/* JSX comments */} that necessarily quote the exact
// phrase being removed/changed - strip block comments before asserting on
// user-facing rendered text, so the assertion checks the actual page output,
// not the comment describing the fix.
function readRenderedText(relativePath) {
  return readFileSync(join(__dirname, relativePath), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

// Final Landing Polish task, Part A: the 14-day free PRO trial was
// previously repeated 6+ times per landing page (banner, hero badge, hero
// CTA, hero helper, pricing, FAQ x2, final CTA), which this task reduced to
// exactly 3 intentional locations per locale (hero / pricing / FAQ). This is
// a structural regression guard so a future copy edit doesn't silently
// reintroduce the duplication.
describe('landing page trial-message de-duplication (Final Landing Polish task, Part A)', () => {
  // OD-01 (Owner 2026-10-07) supersedes the 3-location 14-day budget: the trial is replaced by Free-10, so the rendered copy
  // (comments stripped) mentions the 14-day trial nowhere, and the Free-10 policy is stated in the hero line, the plans
  // note and the FAQ (at most 3 places, never silently dropped).
  const code = (src) => src.replace(/^\s*\/\/.*$/gm, '');
  it('Hebrew landing page: no 14-day trial; Free-10 stated in 1-3 places', () => {
    const he = code(readRenderedText('LandingLocal.jsx'));
    expect(he.match(/14\s*(יום|ימי)/g) || []).toHaveLength(0);
    const free10 = he.match(/10 הצעות מחיר (חינם )?בסך הכול/g) || [];
    expect(free10.length).toBeGreaterThan(0);
    expect(free10.length).toBeLessThanOrEqual(3);
  });

  it('English landing page: no 14-day trial; Free-10 stated in 1-3 places', () => {
    const en = code(readRenderedText('LandingGlobal.jsx'));
    expect(en.match(/14[\s-]day/gi) || []).toHaveLength(0);
    const free10 = en.match(/10 (free )?quotes in total/gi) || [];
    expect(free10.length).toBeGreaterThan(0);
    expect(free10.length).toBeLessThanOrEqual(3);
  });

  // Task 16 correction A (2026-10-05): the approved refined landing replaced the legacy closing band ("Ready to create
  // your first quote?" h2 + p in the page JSX) with the refined closing ("Your next quote starts with a clear
  // process."), and the page files now hold their copy as data rendered by the shared LandingPage layout. Only the
  // LAYOUT pin changed (where the closing heading/text live); the truth constraint is unchanged: the closing band's
  // heading, text and CTA never repeat the trial duration.
  it('the final CTA band no longer repeats the trial duration in either locale', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    // IRON-LANDING-001 (2026-10-11): the closing band's CTA is the shared Free-10 button (copy.free10), so the band holds title + text.
    const closingRe = /closing:\s*\{\s*title:\s*'([^']*)',\s*text:\s*'([^']*)',?\s*\}/;
    // Owner 2026-10-25: the Free-10 button carries no status (null) - the label alone is checked
    const free10Re = /free10:\s*\{\s*cta:\s*'([^']*)',\s*status:\s*(?:'([^']*)'|null)\s*\}/;
    const heMatch = he.match(closingRe);
    const enMatch = en.match(closingRe);
    expect(heMatch).toBeTruthy();
    expect(enMatch).toBeTruthy();
    for (const m of [heMatch, enMatch, he.match(free10Re), en.match(free10Re)]) {
      expect(m).toBeTruthy();
      expect(m[1]).not.toMatch(/14/);
      expect(m[2] ?? '').not.toMatch(/14/);
    }
  });
});

// Final Landing Polish task, Part B: dated/inconsistent icons (filled Flame,
// Rocket, the AIChatWidget's Bot/robot pictogram, a generic Wrench for
// Business Tools) were replaced with a consistent modern outline set from
// the same already-installed lucide-react package.
describe('landing page + AI chat icon modernization (Final Landing Polish task, Part B)', () => {
  it('neither landing page imports or renders the retired Flame/Rocket icons', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    expect(he).not.toMatch(/\bFlame\b/);
    expect(he).not.toMatch(/\bRocket\b/);
    expect(en).not.toMatch(/\bFlame\b/);
    expect(en).not.toMatch(/\bRocket\b/);
  });

  it('neither landing page uses a generic Wrench icon for Business Tools', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    expect(he).not.toMatch(/\bWrench\b/);
    expect(en).not.toMatch(/\bWrench\b/);
    expect(he).toMatch(/BriefcaseBusiness/);
    expect(en).toMatch(/BriefcaseBusiness/);
  });

  it('AIChatWidget no longer imports or renders the Bot/robot icon', () => {
    // Uses the file's own comment-stripped text (not readRenderedText, which
    // is scoped to src/pages/) since AIChatWidget.jsx lives one level up and
    // its own fix comment quotes "Bot/robot" while explaining the change.
    const widget = readSource('../AIChatWidget.jsx').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(widget).not.toMatch(/\bBot\b/);
    // Owner console 2026-10-23 (law 45, "להחליף גם בדפי הנחיתה"): the public launcher is the TEKANGO AI tile, not a generic bubble
    expect(widget).toContain(': <TekangoAiIcon size={24} />');
    expect(widget).not.toMatch(/MessageCircleMore|Sparkles/);
  });

  it('the AIChatWidget floating button retains an accessible label with the icon change', () => {
    const widget = readSource('../AIChatWidget.jsx');
    expect(widget).toMatch(/aria-label=\{isHebrew \? '.*?' : '.*?'\}/);
  });
});
