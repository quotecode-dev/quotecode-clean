// Owner 2026-10-29 (typed: "מאשר הוספת מועדים ביומן בישראל: חנוכה, פורים, ט"ו בשבט, ל"ג בעומר, יום השואה, יום הזיכרון, יום ירושלים, תשעה באב,
// ערבי חג וחול המועד - שם בתא בלי רקע של יום מנוחה, ימי המנוחה והיומן הבינלאומי בלי שינוי, שחרור עד הלייב").
// The observances are a separate list of the bundled dataset: shown by name in a Local/Israel calendar, never a rest-day background;
// the nine rest days and the International calendar are unchanged. Reference: the Israel-schedule dates published by Hebcal
// (hebcal.com, CC BY 4.0 - verification reference only, retrieved 2026-10-29; Hebcal names Hanukkah by the candle of the evening before,
// so its "2 Candles" ... "8th Day" are our days 1-8).
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor, within, screen } from '@testing-library/react';
import data from './data/israelHolidays.json';
import { dayClassOf, holidaysFor, observancesFor } from './utils/calendarModel';
import CalendarTab from './components/CalendarTab';

const byKey = (y) => {
  const out = {};
  for (const o of data.observances.filter((x) => x.date.startsWith(String(y)))) (out[o.key] ||= []).push(o.date.slice(5));
  return out;
};

describe('the observances dataset', () => {
  it('matches the published Israel-schedule reference for 2026, 2027 and 2028', () => {
    expect(byKey(2026)).toEqual({
      tu_bishvat: ['02-02'], purim: ['03-03'], erev_pesach: ['04-01'], chol_hamoed_pesach: ['04-03', '04-04', '04-05', '04-06', '04-07'],
      yom_hashoah: ['04-14'], yom_hazikaron: ['04-21'], lag_baomer: ['05-05'], yom_yerushalayim: ['05-15'], erev_shavuot: ['05-21'],
      tisha_bav: ['07-23'], erev_rosh_hashanah: ['09-11'], erev_yom_kippur: ['09-20'], erev_sukkot: ['09-25'],
      chol_hamoed_sukkot: ['09-27', '09-28', '09-29', '09-30', '10-01'], hoshana_rabbah: ['10-02'],
      chanukah: ['12-05', '12-06', '12-07', '12-08', '12-09', '12-10', '12-11', '12-12'],
    });
    expect(byKey(2027)).toEqual({
      tu_bishvat: ['01-23'], purim: ['03-23'], erev_pesach: ['04-21'], chol_hamoed_pesach: ['04-23', '04-24', '04-25', '04-26', '04-27'],
      yom_hashoah: ['05-04'], yom_hazikaron: ['05-11'], lag_baomer: ['05-25'], yom_yerushalayim: ['06-04'], erev_shavuot: ['06-10'],
      tisha_bav: ['08-12'], erev_rosh_hashanah: ['10-01'], erev_yom_kippur: ['10-10'], erev_sukkot: ['10-15'],
      chol_hamoed_sukkot: ['10-17', '10-18', '10-19', '10-20', '10-21'], hoshana_rabbah: ['10-22'],
      chanukah: ['12-25', '12-26', '12-27', '12-28', '12-29', '12-30', '12-31'],
    });
    // Hanukkah 5788 runs into 2028; the moved Tisha B'Av, Yom HaShoah and Yom HaZikaron of 2028
    expect(byKey(2028).chanukah[0]).toBe('01-01');
    expect(byKey(2028)).toMatchObject({ purim: ['03-12'], yom_hashoah: ['04-24'], yom_hazikaron: ['05-01'], tisha_bav: ['08-01'], yom_yerushalayim: ['05-24'] });
  });
  it('the nine rest days are unchanged and no observance falls on a rest day', () => {
    expect(data.days).toHaveLength(21 * 9);
    const rest = new Set(data.days.map((d) => d.date));
    expect(data.observances.filter((o) => rest.has(o.date))).toEqual([]);
    expect(data.observances.every((o) => o.date >= '2020-01-01' && o.date <= '2040-12-31')).toBe(true);
    // Yom HaShoah, Yom HaZikaron and Tisha B'Av never fall on a Saturday (the moves); Hanukkah has eight days every year
    for (const o of data.observances.filter((x) => ['yom_hashoah', 'yom_hazikaron', 'tisha_bav'].includes(x.key))) expect(new Date(`${o.date}T00:00:00Z`).getUTCDay(), o.date).not.toBe(6);
    expect(data.observances.filter((o) => o.key === 'chanukah' && o.date.startsWith('2026')).map((o) => o.he)).toEqual(
      ['חנוכה (יום א׳)', 'חנוכה (יום ב׳)', 'חנוכה (יום ג׳)', 'חנוכה (יום ד׳)', 'חנוכה (יום ה׳)', 'חנוכה (יום ו׳)', 'חנוכה (יום ז׳)', 'חנוכה (יום ח׳)']);
  });
  it('Local only, and an observance never makes a holiday day class', () => {
    expect(observancesFor(false).size).toBe(0);
    expect(observancesFor(true).get('2026-12-07')).toEqual([{ key: 'chanukah', he: 'חנוכה (יום ג׳)', en: 'Hanukkah (day 3)' }]);
    const holidays = holidaysFor(true);
    expect(dayClassOf('2026-12-07', { isLocalIsraeliBusiness: true, holidays })).toBe('ordinary');
    expect(dayClassOf('2026-12-05', { isLocalIsraeliBusiness: true, holidays })).toBe('saturday');
  });
});

const NOW = new Date('2026-12-01T09:00:00.000Z');
function fakeClient() {
  const b = { select: () => b, eq: () => b, order: () => b, then: (res) => Promise.resolve({ data: [], error: null }).then(res) };
  return { from: vi.fn(() => b) };
}
const setup = ({ isHebrew = true, local = true, view = 'month' } = {}) => {
  const utils = render(<div dir={isHebrew ? 'rtl' : 'ltr'}><CalendarTab client={fakeClient()} userId="u" isHebrew={isHebrew} isLocalIsraeliBusiness={local} quotes={[]} onOpenTask={vi.fn()} now={NOW} /></div>);
  fireEvent.click(utils.container.querySelector(`[data-view="${view}"]`));
  return utils;
};
const cell = (c, iso) => c.querySelector(`.pf-cal-cell[data-date="${iso}"]`);

describe('the calendar shows the observances by name, without a rest-day background', () => {
  it('HE / Local, December 2026: the eight days of Hanukkah, day classes unchanged', async () => {
    const { container } = setup();
    await waitFor(() => expect(cell(container, '2026-12-07')).not.toBeNull());
    const label = within(cell(container, '2026-12-07')).getByTestId('calendar-holiday');
    expect(label.textContent).toBe('חנוכה (יום ג׳)');
    expect(label).toHaveAttribute('data-rest', 'false');
    expect(cell(container, '2026-12-07')).toHaveAttribute('data-day-class', 'ordinary');
    expect(cell(container, '2026-12-05')).toHaveAttribute('data-day-class', 'saturday');
    expect([...container.querySelectorAll('.pf-cal-cell [data-testid="calendar-holiday"]')].filter((e) => e.textContent.startsWith('חנוכה'))).toHaveLength(8);
    expect(container.querySelector('.pf-cal-cell[data-day-class="holiday"]')).toBeNull();
  });
  it('the day view shows the observance in the neutral banner', async () => {
    const { container } = setup({ view: 'day' });
    fireEvent.click(container.querySelector('.pf-cal-mini button[data-date="2026-12-10"]'));
    const banner = within(screen.getByTestId('calendar-day')).getByTestId('calendar-holiday');
    expect(banner.textContent).toBe('חנוכה (יום ו׳)');
    expect(banner).toHaveAttribute('data-rest', 'false');
  });
  it('hiding the holiday layer hides the observances too', () => {
    const { container } = setup();
    fireEvent.click(container.querySelector('[data-layer="holidays"]'));
    expect(container.querySelector('[data-testid="calendar-holiday"]')).toBeNull();
  });
  it('EN UI on a Local account shows the English names', () => {
    const { container } = setup({ isHebrew: false, local: true });
    expect(within(cell(container, '2026-12-07')).getByTestId('calendar-holiday').textContent).toBe('Hanukkah (day 3)');
  });
  it('International (EN or HE UI): no observances at all', () => {
    for (const isHebrew of [false, true]) {
      const { container, unmount } = setup({ isHebrew, local: false });
      expect(container.querySelector('[data-testid="calendar-holiday"]')).toBeNull();
      expect(cell(container, '2026-12-07')).toHaveAttribute('data-day-class', 'ordinary');
      unmount();
    }
  });
});
