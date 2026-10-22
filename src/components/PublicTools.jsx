import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from './ProFlowLogo';
import { ArrowLeftRight, ArrowRightLeft, Coins, Ruler, Gem, Bitcoin } from 'lucide-react';
import { FONT_HE } from '../theme/neonTheme';
// Owner 2026-10-21: the tools page in the light landing system (colors / style only)
import { TOOLS } from '../theme/toolsLightTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import { formatShortDateTime } from '../../supabase/functions/_shared/shortDate.js';
import { usePublicToolsFeeds } from '../hooks/usePublicToolsFeeds';
import {
  parseToolNumber, INPUT_ERRORS, UNIT_FACTORS, convertLength, formatToolNumber, REFERENCE_METAL_USD_PER_GRAM, DEFAULT_PURITY,
  metalValueUsd, convertCurrency, CURRENCY_CODES,
} from '../utils/publicToolsCore';

// Task 36 (Codex landing review L3 / L4 / L5): no fixed number is ever shown as current data - every value comes from a verified
// provider answer (with the provider's own update time) or says it is unavailable; invalid input is refused with a message; metals are
// an estimate from a stated (editable) reference price per gram; the closing CTA opens account creation in Hebrew.
const ERR = INPUT_ERRORS.he;
const when = (ms) => formatShortDateTime(new Date(ms), 'Local');
const money = (n, digits = 2) => formatToolNumber(n, 'he-IL', digits);

function FeedLine({ feed, testId, label, asOf }) {
  let text;
  if (feed.status === 'loading') text = `טוען ${label}…`;
  else if (feed.status === 'unavailable') text = `${label} אינם זמינים כרגע. נסו שוב מאוחר יותר.`;
  else if (feed.status === 'stale') text = `לא הצלחנו לעדכן כעת. מוצגים ${label} מ־${when(asOf)} (${feed.data.source}), וייתכן שאינם עדכניים.`;
  else text = `מקור: ${feed.data.source} · ${label} מעודכנים ל־${when(asOf)}`;
  return <div data-testid={testId} role="status" style={{ fontSize: '0.8rem', color: feed.status === 'stale' || feed.status === 'unavailable' ? TOOLS.amber : TOOLS.textMuted || TOOLS.textSecondary, marginTop: '10px', textAlign: 'center' }}>{text}</div>;
}
const InputError = ({ code, testId }) => (code ? <div data-testid={testId} role="alert" style={{ color: TOOLS.red, fontSize: '0.8rem', marginTop: '6px' }}>{ERR[code]}</div> : null);

function PublicTools() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('currency');

  useEffect(() => {
    // ר' הערה מלאה ב-Contact.jsx - /tools הלא-מקודד הוא alias לתאימות
    // בלבד; PublicTools הוא תמיד הרכיב העברי, כך שהיעד קבוע ל-/he/tools.
    if (window.location.pathname === '/tools') {
      navigate('/he/tools', { replace: true });
    }

    // One public SEO authority (src/shared/publicSeoRoutes.js), shared with the prerender build (2026-09-28).
    setSeoMeta(publicSeo('/he/tools'));
  }, [navigate]);

  // PRODUCT_TRUTH_CAPABILITY: public_currency_converter
  // PRODUCT_TRUTH_CAPABILITY: public_crypto_calculator
  const feeds = usePublicToolsFeeds({ base: 'ILS', cacheKey: 'proflow_tools_cache_he_v2' });
  const rates = feeds.currency.data?.rates || null; // units of each currency per 1 ILS

  // Currency
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('ILS');
  const currencyLabels = {
    ILS: 'שקל חדש (ILS)',
    USD: 'דולר ארה"ב (USD)',
    EUR: 'אירו (EUR)',
    GBP: 'ליש"ט (GBP)',
    CAD: 'דולר קנדי (CAD)',
    AUD: 'דולר אוסטרלי (AUD)',
    CHF: 'פרנק שוויצרי (CHF)',
    JPY: 'ין יפני (JPY)'
  };
  const amountIn = parseToolNumber(amount);
  const currencyResult = amountIn.ok && rates ? `${money(convertCurrency(amountIn.value, fromCurrency, toCurrency, rates))} ${toCurrency}` : '—';
  const handleSwapCurrencies = () => { setFromCurrency(toCurrency); setToCurrency(fromCurrency); };

  // Units (lengths)
  const [unitValue, setUnitValue] = useState('1');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const unitLabels = { m: 'מטר', ft: 'פיט (רגל)', km: 'קילומטר', mi: 'מייל', cm: 'סנטימטר', in: 'אינץ\'' };
  // PRODUCT_TRUTH_CAPABILITY: public_unit_converter
  const unitIn = parseToolNumber(unitValue);
  const unitsResult = unitIn.ok ? `${formatToolNumber(convertLength(unitIn.value, fromUnit, toUnit), 'he-IL')} ${unitLabels[toUnit]}` : '—';
  const handleSwapUnits = () => { setFromUnit(toUnit); setToUnit(fromUnit); };

  // Precious metals - an ESTIMATE: weight x exact fineness x a reference price per gram of fine metal (no metals feed exists)
  const [metalType, setMetalType] = useState('gold');
  const [purity, setPurity] = useState('24k');
  const [metalGrams, setMetalGrams] = useState('10');
  const [usdPerGram, setUsdPerGram] = useState(String(REFERENCE_METAL_USD_PER_GRAM.gold));
  // PRODUCT_TRUTH_CAPABILITY: public_metals_calculator
  const gramsIn = parseToolNumber(metalGrams);
  const priceIn = parseToolNumber(usdPerGram);
  const metalError = !gramsIn.ok ? gramsIn.code : !priceIn.ok ? priceIn.code : null;
  const metalUsd = metalError ? null : metalValueUsd(gramsIn.value, metalType, purity, priceIn.value);
  const metalUsdText = metalUsd == null ? '—' : `$${formatToolNumber(metalUsd, 'en-US', 2)}`;
  const metalIlsText = metalUsd == null ? '—' : rates ? `${money(metalUsd / rates.USD)} ₪` : 'לא זמין (אין שער דולר)';

  // Crypto
  const [cryptoCoin, setCryptoCoin] = useState('btc');
  const [cryptoAmount, setCryptoAmount] = useState('1');
  const cryptoLabels = {
    btc: 'ביטקוין (BTC)',
    eth: 'אתריום (ETH)',
    sol: 'סולנה (SOL)',
    xrp: 'ריפל (XRP)',
    trx: 'טרון (TRX)'
  };
  const coinIn = parseToolNumber(cryptoAmount);
  const coinPrice = feeds.crypto.data?.prices?.[cryptoCoin] || null;
  const cryptoUsd = coinIn.ok && coinPrice ? coinIn.value * coinPrice.usd : null;
  const cryptoUsdText = cryptoUsd == null ? '—' : `$${formatToolNumber(cryptoUsd, 'en-US', 2)}`;
  const cryptoIlsText = cryptoUsd == null ? '—' : rates ? `${money(cryptoUsd / rates.USD)} ₪` : 'לא זמין (אין שער דולר)';

  const tabBtnStyle = (tabKey) => ({
    flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none',
    background: activeTab === tabKey ? TOOLS.accentSoft : 'transparent',
    color: activeTab === tabKey ? TOOLS.violetLight : TOOLS.textSecondary, fontWeight: 'bold', cursor: 'pointer',
    borderBottom: activeTab === tabKey ? `3px solid ${TOOLS.violet}` : '3px solid transparent', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
  });

  const selectStyle = { width: '100%', padding: '12px', border: `1px solid ${TOOLS.borderStrong}`, borderRadius: '7px', minHeight: '44px', fontSize: '1rem', outline: 'none', background: TOOLS.bgInput, color: TOOLS.textPrimary, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: TOOLS.textSecondary };
  const resultBoxStyle = { background: TOOLS.alt, padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${TOOLS.border}` };
  const swapBtnStyle = { background: '#ffffff', border: `1px solid ${TOOLS.borderStrong}`, borderRadius: '7px', width: '46px', height: '46px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TOOLS.violetLight };
  const numberInput = (id, value, setValue) => (
    <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} style={{ ...selectStyle, direction: 'ltr', textAlign: 'right' }} />
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flow-root', background: TOOLS.bg, color: TOOLS.textPrimary, fontFamily: FONT_HE }} dir="rtl">
      {/* Header */}
      <header style={{ background: TOOLS.bg, color: TOOLS.textPrimary, padding: '56px 20px 40px', textAlign: 'center', position: 'relative', borderBottom: `1px solid ${TOOLS.border}` }}>
        {/* PRODUCT_TRUTH_DECORATIVE: navigation link back to the landing page of the same language (Task 36, L3) */}
        <a href="/he" data-testid="tools-home" onClick={(e) => { e.preventDefault(); navigate('/he'); }} style={{ position: 'absolute', top: '12px', insetInlineStart: '16px', color: TOOLS.accent, fontSize: '0.95rem', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>חזרה לדף הבית</a>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><ProFlowLogo size={30} darkText /></div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '10px', fontWeight: 700, color: TOOLS.textPrimary }}>מרכז הכלים והמחשבונים העסקיים</h1>
        <p style={{ fontSize: '1.05rem', color: TOOLS.textSecondary, maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          מחשבונים לעסקים, ליבואנים ולעצמאים: המרת מטבעות וקריפטו לפי שערים מעודכנים מהמקור, המרת יחידות אורך והערכת שווי למתכות יקרות.
        </p>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '800px', margin: '32px auto 40px', padding: '0 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: TOOLS.bgCard, borderRadius: '12px', boxShadow: TOOLS.cardShadow, overflow: 'hidden', border: `1px solid ${TOOLS.border}` }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: TOOLS.alt, borderBottom: `1px solid ${TOOLS.border}`, flexWrap: 'wrap' }}>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the currency converter (already-marked public_currency_converter) */}
            <button onClick={() => setActiveTab('currency')} style={tabBtnStyle('currency')}>
              <ArrowLeftRight size={18} strokeWidth={2.2} />
              המרת מטבעות
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the unit converter */}
            <button onClick={() => setActiveTab('units')} style={tabBtnStyle('units')}>
              <Ruler size={18} strokeWidth={2.2} />
              מידות ומרחקים
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the precious metals calculator */}
            <button onClick={() => setActiveTab('metals')} style={tabBtnStyle('metals')}>
              <Gem size={18} strokeWidth={2.2} />
              מתכות יקרות
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the crypto calculator */}
            <button onClick={() => setActiveTab('crypto')} style={tabBtnStyle('crypto')}>
              <Bitcoin size={18} strokeWidth={2.2} />
              ממיר קריפטו
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '30px' }}>
            {activeTab === 'currency' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: TOOLS.textPrimary }}>המרת מטבעות</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-from-currency" style={labelStyle}>ממטבע</label>
                    <select id="tools-from-currency" value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={selectStyle}>
                      {CURRENCY_CODES.map((code) => <option key={code} value={code}>{currencyLabels[code]}</option>)}
                    </select>
                  </div>

                  {/* PRODUCT_TRUTH_DECORATIVE: swaps the from/to currency selections within the currency converter tool */}
                  <button onClick={handleSwapCurrencies} aria-label="החלפת מטבעות" title="החלפת מטבעות" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label htmlFor="tools-to-currency" style={labelStyle}>למטבע</label>
                    <select id="tools-to-currency" value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={selectStyle}>
                      {CURRENCY_CODES.map((code) => <option key={code} value={code}>{currencyLabels[code]}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label htmlFor="tools-amount" style={labelStyle}>סכום להמרה ({fromCurrency})</label>
                  {numberInput('tools-amount', amount, setAmount)}
                  <InputError code={amountIn.ok ? null : amountIn.code} testId="tools-currency-error" />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: TOOLS.textSecondary, marginBottom: '5px' }}>תוצאה משוערת</div>
                  <div data-testid="tools-currency-result" dir="ltr" style={{ fontSize: '2rem', fontWeight: 'bold', color: TOOLS.violetLight }}>{currencyResult}</div>
                  <FeedLine feed={feeds.currency} testId="tools-feed-currency" label="שערי המטבע" asOf={feeds.currency.data?.asOf} />
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: TOOLS.textPrimary }}>המרת יחידות אורך</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-from-unit" style={labelStyle}>יחידת מקור</label>
                    <select id="tools-from-unit" value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} style={selectStyle}>
                      {Object.keys(UNIT_FACTORS).map((key) => <option key={key} value={key}>{unitLabels[key]}</option>)}
                    </select>
                  </div>

                  {/* PRODUCT_TRUTH_DECORATIVE: swaps the from/to unit selections within the unit converter tool */}
                  <button onClick={handleSwapUnits} aria-label="החלפת יחידות" title="החלפת יחידות" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label htmlFor="tools-to-unit" style={labelStyle}>יחידת יעד</label>
                    <select id="tools-to-unit" value={toUnit} onChange={(e) => setToUnit(e.target.value)} style={selectStyle}>
                      {Object.keys(UNIT_FACTORS).map((key) => <option key={key} value={key}>{unitLabels[key]}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label htmlFor="tools-unit-value" style={labelStyle}>ערך להמרה ({unitLabels[fromUnit]})</label>
                  {numberInput('tools-unit-value', unitValue, setUnitValue)}
                  <InputError code={unitIn.ok ? null : unitIn.code} testId="tools-units-error" />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: TOOLS.textSecondary, marginBottom: '5px' }}>תוצאה</div>
                  <div data-testid="tools-units-result" style={{ fontSize: '1.8rem', fontWeight: 'bold', color: TOOLS.violetLight }}>{unitsResult}</div>
                </div>
              </div>
            )}

            {activeTab === 'metals' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '12px', color: TOOLS.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={20} color={TOOLS.amber} />
                  הערכת שווי משוערת למתכות יקרות
                </h2>
                <p data-testid="tools-metal-note" style={{ fontSize: '0.85rem', color: TOOLS.textSecondary, margin: '0 0 20px', lineHeight: 1.6 }}>
                  הערכה בלבד — אינה מבוססת על מחירי מתכות עדכניים. החישוב: משקל × דרגת הטוהר × מחיר לגרם מתכת טהורה. המחיר שמופיע כאן הוא ערך ייחוס קבוע ולא מחיר שוק; אפשר להזין במקומו מחיר עדכני משלכם.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-metal-type" style={labelStyle}>סוג מתכת</label>
                    <select
                      id="tools-metal-type"
                      value={metalType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMetalType(val);
                        setPurity(DEFAULT_PURITY[val]);
                        setUsdPerGram(String(REFERENCE_METAL_USD_PER_GRAM[val]));
                      }}
                      style={selectStyle}
                    >
                      <option value="gold">🥇 זהב</option>
                      <option value="silver">🥈 כסף</option>
                      <option value="platinum">🪙 פלטינה</option>
                      <option value="palladium">🪙 פלדיום</option>
                      <option value="rhodium">🪙 רודיום</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tools-metal-purity" style={labelStyle}>דרגת טוהר / קראט</label>
                    <select id="tools-metal-purity" value={purity} onChange={(e) => setPurity(e.target.value)} style={selectStyle}>
                      {metalType === 'gold' && (
                        <>
                          <option value="24k">זהב 24 קראט (99.9%)</option>
                          <option value="22k">זהב 22 קראט (91.6%)</option>
                          <option value="21k">זהב 21 קראט (87.5%)</option>
                          <option value="18k">זהב 18 קראט (75.0%)</option>
                          <option value="14k">זהב 14 קראט (58.5%)</option>
                        </>
                      )}
                      {metalType === 'silver' && (
                        <>
                          <option value="999">כסף טהור 999 (99.9%)</option>
                          <option value="925">כסף סטרלינג 925 (92.5%)</option>
                          <option value="800">כסף 800 (80.0%)</option>
                        </>
                      )}
                      {metalType === 'platinum' && (
                        <>
                          <option value="999">פלטינה טהורה 999 (99.9%)</option>
                          <option value="950">פלטינה 950 (95.0%)</option>
                        </>
                      )}
                      {metalType === 'palladium' && (
                        <option value="999">פלדיום טהור 999 (99.9%)</option>
                      )}
                      {metalType === 'rhodium' && (
                        <option value="999">רודיום טהור 999 (99.9%)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-metal-grams" style={labelStyle}>משקל בגרמים</label>
                    {numberInput('tools-metal-grams', metalGrams, setMetalGrams)}
                  </div>
                  <div>
                    <label htmlFor="tools-metal-price" style={labelStyle}>מחיר לגרם מתכת טהורה (USD)</label>
                    {numberInput('tools-metal-price', usdPerGram, setUsdPerGram)}
                  </div>
                </div>
                <InputError code={metalError} testId="tools-metal-error" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '12px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: TOOLS.textSecondary, marginBottom: '5px' }}>שווי משוער בשקלים (ILS)</div>
                    <div data-testid="tools-metal-ils" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: TOOLS.amber }}>{metalIlsText}</div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: TOOLS.textSecondary, marginBottom: '5px' }}>שווי משוער בדולרים (USD)</div>
                    <div data-testid="tools-metal-usd" dir="ltr" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: TOOLS.amber }}>{metalUsdText}</div>
                  </div>
                </div>
                <FeedLine feed={feeds.currency} testId="tools-feed-metal-currency" label="שערי המטבע (להמרה לשקלים)" asOf={feeds.currency.data?.asOf} />
              </div>
            )}

            {activeTab === 'crypto' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: TOOLS.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bitcoin size={20} color={TOOLS.violetLighter} />
                  שווי מטבעות קריפטו
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="tools-crypto-coin" style={labelStyle}>מטבע קריפטו</label>
                  <select id="tools-crypto-coin" value={cryptoCoin} onChange={(e) => setCryptoCoin(e.target.value)} style={selectStyle}>
                    {Object.entries(cryptoLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="tools-crypto-amount" style={labelStyle}>כמות מטבעות</label>
                  {numberInput('tools-crypto-amount', cryptoAmount, setCryptoAmount)}
                  <InputError code={coinIn.ok ? null : coinIn.code} testId="tools-crypto-error" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: TOOLS.textSecondary, marginBottom: '5px' }}>שווי משוער בשקלים (ILS)</div>
                    <div data-testid="tools-crypto-ils" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: TOOLS.violetLighter }}>{cryptoIlsText}</div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: TOOLS.textSecondary, marginBottom: '5px' }}>שווי משוער בדולרים (USD)</div>
                    <div data-testid="tools-crypto-usd" dir="ltr" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: TOOLS.violetLighter }}>{cryptoUsdText}</div>
                  </div>
                </div>
                {feeds.crypto.status !== 'loading' && feeds.crypto.status !== 'unavailable' && !coinPrice
                  ? <div data-testid="tools-feed-crypto" role="status" style={{ fontSize: '0.8rem', color: TOOLS.amber, marginTop: '10px', textAlign: 'center' }}>המחיר של {cryptoLabels[cryptoCoin]} אינו זמין כרגע ממקור הנתונים ({feeds.crypto.data?.source}).</div>
                  : <FeedLine feed={feeds.crypto} testId="tools-feed-crypto" label="מחירי הקריפטו" asOf={coinPrice?.asOf} />}
              </div>
            )}
          </div>
        </div>

        {/* SEO Content Section */}
        <section style={{ marginTop: '40px', background: TOOLS.bgCard, padding: '30px', borderRadius: '12px', border: `1px solid ${TOOLS.border}` }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: TOOLS.textPrimary }}>כלים לעסקים שעובדים מול ספקים ולקוחות בחו"ל</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: TOOLS.textSecondary, marginBottom: '15px' }}>
            עסקים, עצמאים ויבואנים נדרשים מדי יום לחישובים מהירים: המרת מטבעות, המרת יחידות בעבודה מול ספקים בחו"ל והערכת שווי. מרכז הכלים של TEKANGO מרכז את החישובים האלה במקום אחד, עם מקור הנתונים ומועד העדכון שלהם.
          </p>
        </section>

        {/* CTA Banner */}
        <div style={{ marginTop: '30px', background: TOOLS.accentSoft, color: TOOLS.textPrimary, padding: '40px 20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${TOOLS.border}` }}>
          <div style={{ display: 'inline-block', background: '#ffffff', padding: '10px 22px', borderRadius: '12px', marginBottom: '15px', border: `1px solid ${TOOLS.border}` }}>
            <ProFlowLogo darkText />
          </div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', fontWeight: 700, color: TOOLS.textPrimary }}>מוכנים לנהל את העסק במקום אחד?</h3>
          <p style={{ fontSize: '0.95rem', color: '#3f4d54', marginBottom: '20px' }}>הפקת הצעות מחיר, ניהול לקוחות וחתימה דיגיטלית של הלקוח — הכול ב־TEKANGO.</p>
          {/* PRODUCT_TRUTH_DECORATIVE: marketing CTA opening the account-creation screen (the landing signup path); not itself a distinct product capability */}
          <button
            data-testid="tools-cta"
            onClick={() => navigate('/dashboard?signup=true&lang=he')}
            style={{ background: TOOLS.accent, color: '#ffffff', padding: '11px 22px', minHeight: '46px', borderRadius: '7px', fontWeight: 600, fontSize: '16px', border: `1px solid ${TOOLS.accent}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          >
            פתיחת חשבון
          </button>
        </div>
      </main>
    </div>
  );
}

export default PublicTools;
