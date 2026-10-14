// The ONE Israel address suggestion field (Codex spec A13-A16, Owner-approved 2026-10-14), shared by the business address (Settings),
// the client window and the quote form. kind="city" suggests localities after 2 characters (Hebrew or English names); kind="street"
// suggests the streets of the city in `cityText` once that city is known. Picking only fills text: the field stays free text, a typed
// value is always kept, and nothing is marked "verified". Outside an Israeli business (enabled=false) it is the plain input it replaces.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { loadCities, loadStreets, loadAliases, searchCities, searchStreets, findCity } from '../utils/israelAddress';
import './addressSuggest.css';

const TEXT = {
  cityStart: ['התחילו להקליד עיר', 'Start typing a city'],
  cityNone: ['לא מצאתם? אפשר להקליד ידנית', 'Not listed? You can type it manually'],
  chooseCity: ['בחרו עיר כדי לראות רחובות', 'Choose a city to see its streets'],
  noStreets: ['אין רשימת רחובות לעיר הזו. אפשר להקליד ידנית', 'There is no street list for this city. You can type it manually'],
  streetNone: ['לא מצאתם? אפשר להקליד ידנית', 'Not listed? You can type it manually'],
  addNumber: ['הוסיפו מספר בית אחרי שם הרחוב', 'Add the house number after the street name'],
  unavailable: ['הרשימה לא זמינה כרגע. אפשר להמשיך בהקלדה ידנית', 'The list is unavailable. You can continue by typing manually.'],
  hebrewStreets: [null, 'Street names in this Israeli dataset are in Hebrew. You can also enter the address manually.'],
  cityChanged: ['העיר השתנתה — בדקו שוב את הרחוב', 'City changed — please review the street.'],
  results: [(n) => `${n} הצעות זמינות`, (n) => `${n} suggestions available`],
  alias: ['גם', 'also'],
};
const t = (key, isHebrew) => TEXT[key][isHebrew ? 0 : 1];

export default function AddressSuggestInput({ kind, enabled, isHebrew, value, onChange, cityText = '', inputProps = {} }) {
  const id = useId();
  const listId = `${id}-list`; const hintId = `${id}-hint`;
  const [cities, setCities] = useState(null);
  const [streets, setStreets] = useState(null);
  const [aliases, setAliases] = useState(null);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState(false);
  const [cityChanged, setCityChanged] = useState(false);
  const composing = useRef(false);
  const inputRef = useRef(null);
  const lastCityCode = useRef(null);

  // The city index: only once a field is actually used.
  useEffect(() => {
    if (!enabled || !focused || cities || failed) return undefined;
    const ac = new AbortController();
    loadCities({ signal: ac.signal }).then(setCities, (e) => { if (e?.name !== 'AbortError') setFailed(true); });
    return () => ac.abort();
  }, [enabled, focused, cities, failed]);
  // A street field also needs the index to know its city (an existing address is resolved without any focus).
  useEffect(() => {
    if (!enabled || kind !== 'street' || cities || failed || !String(cityText || '').trim()) return undefined;
    const ac = new AbortController();
    loadCities({ signal: ac.signal }).then(setCities, (e) => { if (e?.name !== 'AbortError') setFailed(true); });
    return () => ac.abort();
  }, [enabled, kind, cityText, cities, failed]);

  const city = useMemo(() => (kind === 'street' && cities ? findCity(cities, cityText) : null), [kind, cities, cityText]);
  const cityCode = city?.code ?? null;

  // The streets of that ONE city, then its aliases; a replaced city aborts the old request and never shows its late answer.
  useEffect(() => {
    if (kind !== 'street') return undefined;
    if (lastCityCode.current !== null && cityCode !== lastCityCode.current && String(value || '').trim()) setCityChanged(true);
    lastCityCode.current = cityCode;
    setStreets(null); setAliases(null);
    if (!enabled || !cityCode || !city?.hasStreets) return undefined;
    const ac = new AbortController();
    loadStreets(cityCode, { signal: ac.signal })
      .then((s) => { setStreets(s); return loadAliases(cityCode, { signal: ac.signal }); })
      .then((a) => setAliases(a || {}), (e) => { if (e?.name !== 'AbortError') setFailed(true); });
    return () => ac.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, kind, cityCode]);

  const items = useMemo(() => {
    if (!enabled) return [];
    if (kind === 'city') return searchCities(cities, value, { isHebrew });
    return searchStreets(streets, aliases, value);
  }, [enabled, kind, cities, streets, aliases, value, isHebrew]);

  useEffect(() => { setActive(-1); }, [items]);

  // A field low in a scrolling screen (phones): bring the opened list into view once, as it opens.
  const listRef = useRef(null);
  const listShown = enabled && open && focused && items.length > 0;
  useEffect(() => {
    if (!listShown) return;
    const id = window.requestAnimationFrame?.(() => listRef.current?.scrollIntoView?.({ block: 'nearest' }));
    return () => { if (id) window.cancelAnimationFrame?.(id); };
  }, [listShown]);

  if (!enabled) {
    return <input {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />;
  }

  const q = String(value || '').trim();
  let hint = null;
  if (cityChanged && kind === 'street') hint = t('cityChanged', isHebrew);
  else if (focused) {
    if (failed) hint = t('unavailable', isHebrew);
    else if (kind === 'city') hint = q.length < 2 ? t('cityStart', isHebrew) : (cities && !items.length && !findCity(cities, value) ? t('cityNone', isHebrew) : null);
    else if (!cityCode) hint = t('chooseCity', isHebrew);
    else if (!city.hasStreets) hint = t('noStreets', isHebrew);
    else if (picked) hint = t('addNumber', isHebrew);
    else if (streets && q && !items.length && !streets.some(([, n]) => q.startsWith(n))) hint = t('streetNone', isHebrew);
    else if (!isHebrew) hint = t('hebrewStreets', isHebrew);
  }
  const showList = listShown;

  const pick = (item) => {
    if (kind === 'city') { onChange(item.label); setOpen(false); return; }
    onChange(`${item.label} `);
    setPicked(true); setCityChanged(false); setOpen(false);
    window.requestAnimationFrame?.(() => { const el = inputRef.current; if (el) { el.focus(); const n = el.value.length; el.setSelectionRange?.(n, n); } });
  };
  const onKeyDown = (e) => {
    inputProps.onKeyDown?.(e);
    if (composing.current || e.nativeEvent?.isComposing) return;
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setOpen(true); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && showList && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape' && showList) { e.preventDefault(); setOpen(false); }
  };
  const describedBy = [inputProps['aria-describedby'], hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="addr-suggest" data-kind={kind}>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setPicked(false); if (kind === 'street') setCityChanged(false); }}
        onFocus={(e) => { setFocused(true); setOpen(true); inputProps.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); setOpen(false); inputProps.onBlur?.(e); }}
        onKeyDown={onKeyDown}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
      />
      <ul ref={listRef} id={listId} role="listbox" className="addr-suggest-list" hidden={!showList} aria-label={kind === 'city' ? (isHebrew ? 'ערים' : 'Cities') : (isHebrew ? 'רחובות' : 'Streets')}>
        {showList && items.map((item, i) => (
          <li
            key={item.code}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={`addr-suggest-option${i === active ? ' is-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); pick(item); }}
            onMouseEnter={() => setActive(i)}
          >
            <bdi dir="auto">{item.label}</bdi>
            {kind === 'city' && !isHebrew && item.en && item.he ? <span className="addr-suggest-sub"><bdi dir="rtl">{item.he}</bdi></span> : null}
            {item.via ? <span className="addr-suggest-sub">{t('alias', isHebrew)} <bdi dir="auto">{item.via}</bdi></span> : null}
          </li>
        ))}
      </ul>
      {hint ? <div id={hintId} className={`addr-suggest-hint${cityChanged && kind === 'street' ? ' is-warn' : ''}`}>{hint}</div> : null}
      <span className="sr-only" aria-live="polite">{showList ? t('results', isHebrew)(items.length) : ''}</span>
    </div>
  );
}
