import { describe, it, expect } from 'vitest';
import { compareClients } from './clientSort';

// חוק ברזל (Clients Table Completion task, §4/§7): בדיקות-יחידה על
// compareClients הטהורה - הפונקציה היחידה שגם Dashboard.jsx (חי) וגם
// הבדיקות כאן קוראים לה, כדי שהתנהגות-המיון לא תתממש פעמיים בנפרד.

const client = (overrides) => ({ id: 'x', company_name: '', client_type: null, ...overrides });

describe('compareClients - Company/Client Name sorting', () => {
  it('sorts English names ascending, locale-aware', () => {
    const a = client({ id: 'a', company_name: 'Zebra Corp' });
    const b = client({ id: 'b', company_name: 'Acme Inc' });
    const sorted = [a, b].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'asc', isHebrew: false }));
    expect(sorted.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('sorts English names descending', () => {
    const a = client({ id: 'a', company_name: 'Zebra Corp' });
    const b = client({ id: 'b', company_name: 'Acme Inc' });
    const sorted = [a, b].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'desc', isHebrew: false }));
    expect(sorted.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('sorts Hebrew names ascending using Hebrew collation', () => {
    const a = client({ id: 'a', company_name: 'תפוח בע"מ' });
    const b = client({ id: 'b', company_name: 'אגוז בע"מ' });
    const sorted = [a, b].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'asc', isHebrew: true }));
    // א (alef) sorts before ת (tav) in the Hebrew alphabet
    expect(sorted.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('sorts Hebrew names descending', () => {
    const a = client({ id: 'a', company_name: 'תפוח בע"מ' });
    const b = client({ id: 'b', company_name: 'אגוז בע"מ' });
    const sorted = [a, b].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'desc', isHebrew: true }));
    expect(sorted.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('is stable when names are equal', () => {
    const a = client({ id: 'a', company_name: 'Same Name' });
    const b = client({ id: 'b', company_name: 'Same Name' });
    const c = client({ id: 'c', company_name: 'Same Name' });
    const sorted = [a, b, c].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'asc', isHebrew: false }));
    expect(sorted.map(cl => cl.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats missing/null names as empty string, never crashes', () => {
    const a = client({ id: 'a', company_name: 'Beta' });
    const b = client({ id: 'b', company_name: null });
    const c = client({ id: 'c', company_name: undefined });
    expect(() => [a, b, c].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'asc', isHebrew: false }))).not.toThrow();
  });
});

describe('compareClients - Client Type sorting', () => {
  it('sorts business before private, ascending', () => {
    const biz = client({ id: 'biz', client_type: 'business' });
    const priv = client({ id: 'priv', client_type: 'private' });
    const sorted = [priv, biz].sort((a, b) => compareClients(a, b, { field: 'client_type', direction: 'asc', isHebrew: false }));
    expect(sorted.map(c => c.id)).toEqual(['biz', 'priv']);
  });

  it('reverses to private before business on repeated activation (desc)', () => {
    const biz = client({ id: 'biz', client_type: 'business' });
    const priv = client({ id: 'priv', client_type: 'private' });
    const sorted = [biz, priv].sort((a, b) => compareClients(a, b, { field: 'client_type', direction: 'desc', isHebrew: false }));
    expect(sorted.map(c => c.id)).toEqual(['priv', 'biz']);
  });

  it('places null/missing/unknown client types last, ascending direction', () => {
    const biz = client({ id: 'biz', client_type: 'business' });
    const priv = client({ id: 'priv', client_type: 'private' });
    const missing = client({ id: 'missing', client_type: null });
    const unknown = client({ id: 'unknown', client_type: 'something-else' });
    const sorted = [missing, priv, unknown, biz].sort((a, b) => compareClients(a, b, { field: 'client_type', direction: 'asc', isHebrew: false }));
    expect(sorted[0].id).toBe('biz');
    expect(sorted[1].id).toBe('priv');
    expect(sorted.slice(2).map(c => c.id).sort()).toEqual(['missing', 'unknown']);
  });

  it('places null/missing/unknown client types last, descending direction too (never first)', () => {
    const biz = client({ id: 'biz', client_type: 'business' });
    const priv = client({ id: 'priv', client_type: 'private' });
    const missing = client({ id: 'missing', client_type: null });
    const sorted = [missing, biz, priv].sort((a, b) => compareClients(a, b, { field: 'client_type', direction: 'desc', isHebrew: false }));
    expect(sorted[0].id).toBe('priv');
    expect(sorted[1].id).toBe('biz');
    expect(sorted[2].id).toBe('missing');
  });

  it('does not crash and does not destabilize the list when all types are missing', () => {
    const a = client({ id: 'a', client_type: null });
    const b = client({ id: 'b', client_type: undefined });
    const c = client({ id: 'c', client_type: '' });
    expect(() => [a, b, c].sort((x, y) => compareClients(x, y, { field: 'client_type', direction: 'asc', isHebrew: false }))).not.toThrow();
    const sorted = [a, b, c].sort((x, y) => compareClients(x, y, { field: 'client_type', direction: 'asc', isHebrew: false }));
    expect(sorted.map(cl => cl.id)).toEqual(['a', 'b', 'c']); // stable, original order preserved
  });

  it('is stable within the same client type', () => {
    const a = client({ id: 'a', client_type: 'business' });
    const b = client({ id: 'b', client_type: 'business' });
    const c = client({ id: 'c', client_type: 'business' });
    const sorted = [a, b, c].sort((x, y) => compareClients(x, y, { field: 'client_type', direction: 'asc', isHebrew: false }));
    expect(sorted.map(cl => cl.id)).toEqual(['a', 'b', 'c']);
  });

  it('Name and Type sorting are fully independent fields', () => {
    const a = client({ id: 'a', company_name: 'Zebra', client_type: 'business' });
    const b = client({ id: 'b', company_name: 'Acme', client_type: 'private' });
    const byType = [a, b].sort((x, y) => compareClients(x, y, { field: 'client_type', direction: 'asc', isHebrew: false }));
    const byName = [a, b].sort((x, y) => compareClients(x, y, { field: 'company_name', direction: 'asc', isHebrew: false }));
    expect(byType.map(c => c.id)).toEqual(['a', 'b']); // business (a) first
    expect(byName.map(c => c.id)).toEqual(['b', 'a']); // Acme (b) first alphabetically
  });
});
