// Owner console 2026-10-20 (L-14, typed: "מאשר שינוי ב-L-14: הוראות "איך עושים" מאומתות לעובדות המוצר ולעוזר המיילים"): every quoted
// label of every how-to step still exists in the source file that renders it, so an instruction can never silently go stale.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRODUCT_HOW_TO, projectHowTo } from './productHowTo.js';
import { CANONICAL_38_IDS } from './productTruthRegistry.js';

const quoted = (step) => [...step.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

describe('product how-to facts (L-14, 2026-10-20)', () => {
  it('every entry is complete in Hebrew and English and names real capability ids', () => {
    const ids = new Set();
    for (const e of PRODUCT_HOW_TO) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      for (const lang of ['he', 'en']) {
        expect(e[lang].task.length).toBeGreaterThan(3);
        expect(e[lang].steps.length).toBeGreaterThan(0);
      }
      expect(e.capabilityIds.every((c) => CANONICAL_38_IDS.includes(c))).toBe(true);
      expect(e.evidence.length).toBeGreaterThan(0);
    }
  });

  it('every evidence label exists in its source file', () => {
    for (const e of PRODUCT_HOW_TO) {
      for (const ev of e.evidence) {
        const src = readFileSync(ev.file, 'utf8');
        for (const label of ev.labels) expect(src.includes(label), `${e.id}: "${label}" missing in ${ev.file}`).toBe(true);
      }
    }
  });

  it('every label a step quotes is backed by one of the entry\'s evidence files', () => {
    for (const e of PRODUCT_HOW_TO) {
      const sources = e.evidence.map((ev) => readFileSync(ev.file, 'utf8')).join('\n');
      for (const lang of ['he', 'en']) {
        for (const step of e[lang].steps) {
          for (const label of quoted(step)) expect(sources.includes(label), `${e.id} (${lang}): "${label}" not found in the evidence files`).toBe(true);
        }
      }
    }
  });

  it('the Hebrew text is Hebrew and the English text has no Hebrew', () => {
    for (const e of PRODUCT_HOW_TO) {
      expect(/[֐-׿]/.test(e.he.task + e.he.steps.join(' '))).toBe(true);
      expect(/[֐-׿]/.test(e.en.task + e.en.steps.join(' '))).toBe(false);
    }
  });

  it('the projection carries the task and the steps only', () => {
    const p = projectHowTo(PRODUCT_HOW_TO[0]);
    expect(Object.keys(p).sort()).toEqual(['capabilityIds', 'en', 'he', 'id']);
    expect(p.he.steps).toEqual(PRODUCT_HOW_TO[0].he.steps);
  });
});
