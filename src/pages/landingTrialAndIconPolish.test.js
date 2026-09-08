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
  it('Hebrew landing page mentions the 14-day trial duration in at most 3 rendered locations', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const matches = he.match(/14\s*(יום|ימי)/g) || [];
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(matches.length).toBeGreaterThan(0); // still stated somewhere - not silently dropped
  });

  it('English landing page mentions the 14-day trial duration in at most 3 rendered locations', () => {
    const en = readRenderedText('LandingGlobal.jsx');
    const matches = en.match(/14[\s-]day/gi) || [];
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('the final CTA band no longer repeats the trial duration in either locale', () => {
    const he = readRenderedText('LandingLocal.jsx');
    const en = readRenderedText('LandingGlobal.jsx');
    const heMatch = he.match(/מוכנים ליצור את ההצעה הראשונה שלכם\?[^<]*<\/h2>\s*<p[^>]*>([^<]*)<\/p>/);
    const enMatch = en.match(/Ready to create your first quote\?[^<]*<\/h2>\s*<p[^>]*>([^<]*)<\/p>/);
    expect(heMatch).toBeTruthy();
    expect(enMatch).toBeTruthy();
    expect(heMatch[1]).not.toMatch(/14/);
    expect(enMatch[1]).not.toMatch(/14/);
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
    expect(widget).toMatch(/MessageCircleMore/);
  });

  it('the AIChatWidget floating button retains an accessible label with the icon change', () => {
    const widget = readSource('../AIChatWidget.jsx');
    expect(widget).toMatch(/aria-label=\{isHebrew \? '.*?' : '.*?'\}/);
  });
});
