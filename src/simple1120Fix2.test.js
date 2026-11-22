// simple1120-fix2 (LIVE check of 47e61dac, 2026-11-22; Owner: broken = fix): the client phone row is the sketch's 40px like every other
// field, and the chat window mirrors in Hebrew (its root is dir="rtl", so the assistant side is flex-start in both languages - the old
// isHebrew swap mirrored it twice and put the assistant bubble on the left in Hebrew).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const treeCss = fs.readFileSync('src/components/quoteTree/quoteTree.css', 'utf8');
const chat = fs.readFileSync('src/AIChatWidget.jsx', 'utf8');

describe('simple1120-fix2', () => {
  it('the phone row (code + number) is 40px tall, its frame included', () => {
    expect(treeCss).toContain('.qe-ph { border: 1px solid var(--qt-line2); border-radius: 8px; overflow: hidden; background: #fff; height: 40px; box-sizing: border-box; }');
    expect(treeCss).toContain('.qe-ph .qe-in { border: 0; border-radius: 0; text-align: left; flex: 1 1 auto; height: 38px; }');
  });
  it('the chat never swaps flex sides by language inside its dir-aware root', () => {
    expect(chat).toContain("dir={isHebrew ? 'rtl' : 'ltr'}");
    expect(chat).not.toMatch(/isHebrew \? 'flex-end' : 'flex-start'/);
    expect(chat).not.toMatch(/isHebrew \? 'flex-start' : 'flex-end'/);
  });
});

describe('simple1120-fix2: the row menu edge', () => {
  it('the row menu sits 1px further out (its edge on the button edge, as the sketch)', () => {
    expect(treeCss).toContain('.qt-ir .qt-menu { inset-inline-end: -1px; }');
  });
});

describe('simple1120-fix2: the section-head menu', () => {
  it('the section-head menu sits 1px higher and 1px in (as the sketch, no sliver of the head row above it)', () => {
    expect(treeCss).toContain('.qt-hh .qt-menu { top: calc(100% + 3px); inset-inline-end: 1px; }');
  });
});

describe('simple1120-fix3: the Hebrew time field and the phone expense info line (LIVE check of a3a126b2)', () => {
  const sched = fs.readFileSync('src/components/ServiceScheduleFields.jsx', 'utf8');
  const indexCss = fs.readFileSync('src/index.css', 'utf8');
  it('in Hebrew the time field shows its value / "--:--" at the start side; the disabled field keeps no room for its hidden clock', () => {
    expect(sched).toContain("const timeAtom = isHebrew ? { ...atom, display: 'flex', justifyContent: 'flex-end' } : atom;");
    expect(sched).toContain('disabled={disabled || !v.date} style={timeAtom} />');
    expect(indexCss).toContain('#sq-service-time:disabled::-webkit-calendar-picker-indicator { display: none; }');
  });
  it('the phone expense card is a wrapping row: category, type and date flow as one line', () => {
    expect(indexCss).toContain('display: flex !important; flex-wrap: wrap; align-items: center; column-gap: 8px; row-gap: 4px;');
    expect(indexCss).not.toContain('grid-template-areas: "desc desc desc amt"');
  });
});
