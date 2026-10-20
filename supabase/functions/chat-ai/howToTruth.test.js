// Owner console 2026-10-20 (L-14): the verified how-to steps reach the chat's and the email assistant's system prompt, per language.
import { describe, it, expect } from 'vitest';
import { buildHowToBlock } from './howToTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { buildSystemPrompt } from './validation.ts';

describe('how-to facts in the prompt (L-14, 2026-10-20)', () => {
  it('renders every task with numbered steps in the requested language only', () => {
    const he = buildHowToBlock(true, AI_FACTS.howTo);
    const en = buildHowToBlock(false, AI_FACTS.howTo);
    expect(he).toContain('הוספת לוגו ועדכון פרטי העסק');
    expect(he).toContain('1. בתפריט הצד לוחצים על "הגדרות העסק".');
    expect(he).not.toContain('Adding a logo');
    expect(en).toContain('Adding a logo and updating the business details');
    expect(en).toContain('"Upload File"');
    expect(AI_FACTS.howTo.length).toBeGreaterThanOrEqual(13);
    expect(buildHowToBlock(true, [])).toBe('');
  });
  it('the system prompt (chat and email assistant) carries the block', () => {
    expect(buildSystemPrompt({ isHebrew: true })).toContain('HOW-TO FACTS');
    expect(buildSystemPrompt({ isHebrew: false })).toContain('"Save Business Settings"');
  });
});
