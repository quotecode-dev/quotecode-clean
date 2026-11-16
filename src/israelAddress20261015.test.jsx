// Israel address suggestions (Codex spec A13-A16, Owner-approved 2026-10-14): search rules, the shared field and its three consumers.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAddressText, searchCities, findCity, searchStreets, resetIsraelAddressCache, IL_ADDRESS_VERSION } from './utils/israelAddress';
import AddressSuggestInput from './components/AddressSuggestInput';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');
const CITIES = [[5000, 'תל אביב - יפו', 'Tel Aviv - Yafo', 1], [4000, 'חיפה', 'Haifa', 1], [3000, 'ירושלים', 'Jerusalem', 1], [1347, 'קצר א-סר', '', 0], [6600, 'חולון', 'Holon', 1]];
const STREETS = { 5000: [[100, 'הרצל'], [101, 'הרב קוק'], [102, 'אבן גבירול'], [103, 'דיזנגוף']], 4000: [[200, 'הרצל'], [201, 'הנביאים']] };
const ALIASES = { 5000: { 102: ['אבן גבירול שלמה'], 103: ['דיזינגוף'] } };

let calls = [];
const fixtureFetch = (fail = false) => vi.fn(async (url) => {
  calls.push(url);
  if (fail) return { ok: false, status: 503, json: async () => ({}) };
  const m = /\/(cities|streets|aliases)(?:\/(\d+))?\.json$/.exec(url);
  const body = m[1] === 'cities' ? CITIES : m[1] === 'streets' ? STREETS[m[2]] : ALIASES[m[2]];
  if (!body) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => body };
});

beforeEach(() => { resetIsraelAddressCache(); calls = []; vi.stubGlobal('fetch', fixtureFetch()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('search rules', () => {
  it('normalizes quotes, geresh and hyphens', () => {
    expect(normalizeAddressText('  תל-אביב  ')).toBe('תל אביב');
    expect(normalizeAddressText('קצר א-סר')).toBe('קצר א סר');
    expect(normalizeAddressText('Be\'er Sheva')).toBe('beer sheva');
  });
  it('cities: nothing below 2 characters; Hebrew and English names; prefix first', () => {
    expect(searchCities(CITIES, 'ח', { isHebrew: true })).toEqual([]);
    expect(searchCities(CITIES, 'חי', { isHebrew: true }).map((c) => c.label)).toEqual(['חיפה']);
    expect(searchCities(CITIES, 'תל אביב', { isHebrew: true })[0].label).toBe('תל אביב - יפו');
    expect(searchCities(CITIES, 'hai', { isHebrew: false })[0]).toMatchObject({ code: 4000, label: 'Haifa', he: 'חיפה' });
    // a locality without an English name keeps its Hebrew name in English
    expect(searchCities(CITIES, 'קצר', { isHebrew: false })[0].label).toBe('קצר א-סר');
  });
  it('findCity: exact Hebrew or English name only', () => {
    expect(findCity(CITIES, 'tel aviv - yafo').code).toBe(5000);
    expect(findCity(CITIES, 'תל-אביב - יפו').code).toBe(5000);
    expect(findCity(CITIES, 'תל אביב')).toBeNull();
  });
  it('streets: an alias finds its official street once; a full name followed by more text stops suggesting', () => {
    expect(searchStreets(STREETS[5000], ALIASES[5000], 'הר').map((s) => s.label)).toEqual(['הרצל', 'הרב קוק']);
    expect(searchStreets(STREETS[5000], ALIASES[5000], 'שלמה')).toEqual([{ code: 102, label: 'אבן גבירול', via: 'אבן גבירול שלמה' }]);
    expect(searchStreets(STREETS[5000], ALIASES[5000], 'דיזינג')).toEqual([{ code: 103, label: 'דיזנגוף', via: 'דיזינגוף' }]);
    expect(searchStreets(STREETS[5000], ALIASES[5000], 'הרצל 12')).toEqual([]);
  });
});

function Harness({ isHebrew = true, enabled = true, initialCity = '', initialStreet = '' }) {
  const [city, setCity] = useState(initialCity);
  const [street, setStreet] = useState(initialStreet);
  return (
    <div>
      <AddressSuggestInput kind="city" enabled={enabled} isHebrew={isHebrew} value={city} onChange={setCity} inputProps={{ 'aria-label': 'city' }} />
      <AddressSuggestInput kind="street" enabled={enabled} isHebrew={isHebrew} cityText={city} value={street} onChange={setStreet} inputProps={{ 'aria-label': 'street' }} />
      <output data-testid="stored">{`${street}|${city}`}</output>
    </div>
  );
}

describe('the shared field', () => {
  it('outside an Israeli business it is the plain input: no list, no data request', () => {
    render(<Harness enabled={false} />);
    const city = screen.getByLabelText('city');
    expect(city.getAttribute('role')).toBeNull();
    fireEvent.focus(city); fireEvent.change(city, { target: { value: 'חי' } });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('city: the index loads only on use; pick fills the text; then the streets of that city only, then its aliases', async () => {
    render(<Harness />);
    expect(calls).toEqual([]);
    const city = screen.getByLabelText('city');
    fireEvent.focus(city);
    expect(await screen.findByText('התחילו להקליד עיר')).toBeTruthy();
    fireEvent.change(city, { target: { value: 'תל' } });
    const option = await screen.findByRole('option', { name: /תל אביב - יפו/ });
    expect(screen.getByText('מקור: רשות האוכלוסין וההגירה, data.gov.il')).toBeTruthy();
    fireEvent.mouseDown(option);
    expect(screen.getByTestId('stored').textContent).toBe('|תל אביב - יפו');
    await waitFor(() => expect(calls.some((u) => u.endsWith('/streets/5000.json'))).toBe(true));
    await waitFor(() => expect(calls.some((u) => u.endsWith('/aliases/5000.json'))).toBe(true));
    expect(calls.every((u) => u.startsWith(`/data/il-address/${IL_ADDRESS_VERSION}/`))).toBe(true);
    expect(calls.some((u) => u.endsWith('/streets/4000.json'))).toBe(false);
  });

  it('street: keyboard pick inserts the name and a space for the house number; the stored format is unchanged', async () => {
    render(<Harness initialCity="תל אביב - יפו" />);
    const street = screen.getByLabelText('street');
    fireEvent.focus(street);
    await waitFor(() => expect(calls.some((u) => u.endsWith('/streets/5000.json'))).toBe(true));
    fireEvent.change(street, { target: { value: 'דיזינ' } });
    const opt = await screen.findByRole('option', { name: /דיזנגוף/ });
    expect(opt.textContent).toContain('גם');
    fireEvent.keyDown(street, { key: 'ArrowDown' });
    fireEvent.keyDown(street, { key: 'Enter' });
    expect(screen.getByTestId('stored').textContent).toBe('דיזנגוף |תל אביב - יפו');
    expect(screen.getByText('הוסיפו מספר בית אחרי שם הרחוב')).toBeTruthy();
    fireEvent.change(street, { target: { value: 'דיזנגוף 12א' } });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByTestId('stored').textContent).toBe('דיזנגוף 12א|תל אביב - יפו');
  });

  it('street before a city: asks for the city; a city without a street list says so; typed text is always kept', async () => {
    render(<Harness />);
    const street = screen.getByLabelText('street');
    fireEvent.focus(street);
    expect(await screen.findByText('בחרו עיר כדי לראות רחובות')).toBeTruthy();
    fireEvent.change(street, { target: { value: 'כלשהו 5' } });
    expect(screen.getByTestId('stored').textContent).toBe('כלשהו 5|');
    cleanup();
    render(<Harness initialCity="קצר א-סר" />);
    fireEvent.focus(screen.getByLabelText('street'));
    expect(await screen.findByText('אין רשימת רחובות לעיר הזו. אפשר להקליד ידנית')).toBeTruthy();
  });

  it('a city change after a street keeps the street text and asks to review it', async () => {
    render(<Harness initialCity="תל אביב - יפו" initialStreet="הרצל 3" />);
    await waitFor(() => expect(calls.some((u) => u.endsWith('/streets/5000.json'))).toBe(true));
    const city = screen.getByLabelText('city');
    fireEvent.focus(city); fireEvent.change(city, { target: { value: 'חיפה' } });
    expect(await screen.findByText('העיר השתנתה — בדקו שוב את הרחוב')).toBeTruthy();
    expect(screen.getByTestId('stored').textContent).toBe('הרצל 3|חיפה');
  });

  it('English: city by its English name, Hebrew street names with the explanation', async () => {
    render(<Harness isHebrew={false} />);
    const city = screen.getByLabelText('city');
    fireEvent.focus(city); fireEvent.change(city, { target: { value: 'hai' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Haifa/ }));
    expect(screen.getByTestId('stored').textContent).toBe('|Haifa');
    const street = screen.getByLabelText('street');
    fireEvent.focus(street);
    expect(await screen.findByText('Street names in this Israeli dataset are in Hebrew. You can also enter the address manually.')).toBeTruthy();
    fireEvent.change(street, { target: { value: 'הנב' } });
    expect(await screen.findByRole('option', { name: /הנביאים/ })).toBeTruthy();
  });

  it('the list unavailable: says so and manual typing continues', async () => {
    vi.stubGlobal('fetch', fixtureFetch(true));
    render(<Harness />);
    const city = screen.getByLabelText('city');
    fireEvent.focus(city);
    expect(await screen.findByText('הרשימה לא זמינה כרגע. אפשר להמשיך בהקלדה ידנית')).toBeTruthy();
    fireEvent.change(city, { target: { value: 'עיר שלי' } });
    expect(screen.getByTestId('stored').textContent).toBe('|עיר שלי');
  });

  it('combobox semantics: expanded list, active option, Escape closes', async () => {
    render(<Harness />);
    const city = screen.getByLabelText('city');
    fireEvent.focus(city); fireEvent.change(city, { target: { value: 'חו' } });
    await screen.findByRole('option', { name: /חולון/ });
    expect(city.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(city, { key: 'ArrowDown' });
    expect(city.getAttribute('aria-activedescendant')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(city, { key: 'Escape' }); });
    expect(city.getAttribute('aria-expanded')).toBe('false');
  });

  it('a list opening under a resting pointer does not highlight an option; a real pointer move does', async () => {
    render(<Harness />);
    const city = screen.getByLabelText('city');
    fireEvent.mouseDown(city, { screenX: 200, screenY: 300 });
    fireEvent.focus(city); fireEvent.change(city, { target: { value: 'חו' } });
    const opt = await screen.findByRole('option', { name: /חולון/ });
    fireEvent.mouseMove(opt, { screenX: 200, screenY: 300 });
    expect(city.getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(city, { key: 'ArrowDown' });
    expect(city.getAttribute('aria-activedescendant')).toBe(opt.id);
    fireEvent.mouseMove(opt, { screenX: 210, screenY: 320 });
    expect(city.getAttribute('aria-activedescendant')).toBe(opt.id);
  });
});

describe('the new-client window keeps what was typed when the Dashboard re-renders', () => {
  it('root cause: a fresh {} per render resets the form; the Dashboard now passes ONE stable empty client', async () => {
    const { default: EditClientModal } = await import('./components/EditClientModal');
    const props = { isOpen: true, onClose: () => {}, onSave: () => {}, isHebrew: true, isNew: true };
    const stable = Object.freeze({});
    const { rerender } = render(<EditClientModal {...props} client={stable} />);
    fireEvent.change(screen.getByTestId('client-address-city'), { target: { value: 'חיפה' } });
    rerender(<EditClientModal {...props} client={stable} />);
    expect(screen.getByTestId('client-address-city').value).toBe('חיפה');
    rerender(<EditClientModal {...props} client={{}} />);
    expect(screen.getByTestId('client-address-city').value).toBe('');
    const dash = read('pages/Dashboard.jsx');
    expect(dash).toContain('const NEW_CLIENT = Object.freeze({});');
    expect(dash).toContain('client={isCreatingClient ? NEW_CLIENT : editingClient}');
  });
});

describe('consumers and snapshot', () => {
  it('business settings, the client window and the quote form use the ONE field, only for an Israeli business, city first', () => {
    const settings = read('components/SettingsTab.jsx');
    const quote = read('components/QuoteForm.jsx');
    const client = read('components/EditClientModal.jsx');
    for (const [src, flag] of [[settings, 'isLocalIsraeliBusiness'], [quote, 'isLocalIsraeliBusiness'], [client, 'isIsraeliBusiness']]) {
      expect(src).toContain("import AddressSuggestInput from './AddressSuggestInput';");
      expect(src).toContain(`kind="city" enabled={${flag} === true}`);
      expect(src).toContain(`kind="street" enabled={${flag} === true}`);
      expect(src).toMatch(new RegExp(`${flag} === true \\? \\[city(Block|Field), street(Block|Field)\\]`));
    }
    expect(read('pages/Dashboard.jsx')).toContain('isIsraeliBusiness={isLocalIsraeliBusiness}');
  });
  it('the snapshot: manifest with source, counts and the Owner-confirmed licence (A17); no locality-self street (code 9000)', () => {
    const dir = path.join(HERE, '..', 'public', 'data', 'il-address', IL_ADDRESS_VERSION);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.schema).toBe('il-address/v1');
    expect(manifest.license.status).toBe('OWNER-CONFIRMED');
    expect(manifest.license.attribution).toBe('Population and Immigration Authority, data.gov.il');
    expect(manifest.counts.cities).toBeGreaterThan(1000);
    const cities = JSON.parse(fs.readFileSync(path.join(dir, 'cities.json'), 'utf8'));
    expect(cities.length).toBe(manifest.counts.cities);
    for (const code of [3000, 4000, 5000]) {
      const streets = JSON.parse(fs.readFileSync(path.join(dir, 'streets', `${code}.json`), 'utf8'));
      expect(streets.length).toBeGreaterThan(100);
      expect(streets.some(([c]) => c === 9000)).toBe(false);
    }
  });
});
