// Owner console 2026-11-03 (typed night task: Codex F01, F02, F05-F16): the guards of what was fixed.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPlans from './components/landing/LandingPlans';

const src = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('F01 / F10: the document header', () => {
  const css = src('src/quoteDocument/quoteDocument.css');
  it('a quote number and a date never break inside the value', () => {
    expect(css).toMatch(/\.pq-meta-number \.pq-meta-value,\s*\.pq-letterhead \.pq-meta-date \.pq-meta-value \{\s*white-space: nowrap;\s*overflow-wrap: normal;/);
  });
  it('the signed pill has room for its ink in the PDF capture', () => {
    expect(css).toMatch(/\.pq-pdf-capturing \.pq-letterhead \.pq-state-chip \{[^}]*padding: 3px 10px 7px;/);
  });
});

describe('F02: the calculators on a phone', () => {
  it('the result boxes reflow and the shekel sign stays with its number; agorot stay (Owner 2026-11-03)', () => {
    const he = src('src/components/PublicTools.jsx');
    const en = src('src/components/PublicToolsEn.jsx');
    for (const s of [he, en]) expect(s).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '15px' }}");
    expect(he).toContain('money(cryptoUsd / rates.USD)}\\u00A0₪');
    expect(he).toContain('money(metalUsd / rates.USD)}\\u00A0₪');
    expect(he).toMatch(/const money = \(n, digits = 2\) => formatToolNumber\(n, 'he-IL', digits\);/);
  });
});

describe('F08: the annual saving with SMART PACK ticked', () => {
  const plan = {
    id: 'all_inclusive', name: 'x', tagline: 't', capacity: [], features: [],
    periodChoice: { legend: 'p', labels: { month: 'm', year: 'y' } },
    prices: [{ period: 'month', amount: 'M', per: '/m' }, { period: 'year', amount: 'Y', per: '/y', note: 'Save 15%' }],
    addOn: { label: 'add', perPeriod: { month: { add: '+', amount: 'M2', line: 'l' }, year: { noteQualifier: 'base package only', add: '+', amount: 'Y2', line: 'l' } } },
  };
  it('says what the saving is on only when the add-on is ticked', () => {
    const { container } = render(<LandingPlans copy={{ reviewNotice: 'r' }} plans={[plan]} />);
    fireEvent.click(screen.getByLabelText('y'));
    const note = () => container.querySelector('[data-period-note="year"]').textContent;
    expect(note()).toBe('Save 15%');
    fireEvent.click(container.querySelector('[data-addon-toggle]'));
    expect(note()).toBe('Save 15%. base package only');
  });
});

describe('copy and wording', () => {
  it('F12: the FAQ names the control the visitor sees', () => {
    expect(src('src/pages/LandingLocal.jsx')).toContain('לוחצים "10 הצעות חינם"');
    expect(src('src/pages/LandingGlobal.jsx')).toContain('Choose "10 free quotes"');
  });
  it('F11: plural address and one size', () => {
    expect(src('src/components/AuthScreen.jsx')).not.toContain('מסכים/ה');
    expect(src('src/components/AddItemWizard.jsx')).toContain("'מידה אחת' : '1 size'");
  });
  it('F13: the social screen says what approval does', () => {
    expect(src('src/components/AdminSocialPosts.jsx')).toContain('בערוץ מחובר האישור מפרסם מיד');
  });
  it('F14: Hebrew category words; the stored values stay', () => {
    const s = src('src/components/AISupportLogsContent.jsx');
    expect(s).toContain("GENERAL: 'כללי'");
    expect(s).toContain("categoryFilter === 'ALL'");
  });
});

describe('layout', () => {
  it('F05: the status track fits "Draft · ready to send"', () => {
    expect(src('src/pages/Dashboard.jsx')).toContain('minmax(136px, 104fr) minmax(68px, 64fr)');
  });
  it('F06: the header and the rows share one actions width', () => {
    expect(src('src/components/servicesCatalog.css')).toContain('min-width: var(--svc-actions-w, 0)');
  });
  it('F09: a section link lands below the fixed header', () => {
    expect(src('src/pages/Terms.jsx')).toContain("scrollMarginTop: '110px'");
  });
  it('F15: the panel is placed by the usable width', () => {
    expect(src('src/components/NotificationCenter.jsx')).toContain('document.documentElement.clientWidth');
  });
  it('F16: no calculation line while the quantity rounds to zero', () => {
    expect(src('src/components/AddItemWizard.jsx')).toContain('if (Number(calculatedValue.toFixed(2)) > 0) formulaText =');
  });
});
