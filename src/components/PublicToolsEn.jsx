import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from './ProFlowLogo';
import { ArrowLeftRight, ArrowRightLeft, Coins, Ruler, Gem, Bitcoin } from 'lucide-react';
import { NEON, FONT_EN } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import { formatShortDateTime } from '../../supabase/functions/_shared/shortDate.js';
import { usePublicToolsFeeds } from '../hooks/usePublicToolsFeeds';
import {
  parseToolNumber, INPUT_ERRORS, UNIT_FACTORS, convertLength, formatToolNumber, REFERENCE_METAL_USD_PER_GRAM, DEFAULT_PURITY,
  metalValueUsd, convertCurrency, CURRENCY_CODES,
} from '../utils/publicToolsCore';

// Task 36 (Codex landing review L3 / L4 / L5): the EN twin of PublicTools.jsx - no fixed number shown as current data (verified provider
// answers with the provider's own update time, or "not available"), invalid input refused with a message, metals = an estimate from a
// stated (editable) reference price, and the closing CTA opens account creation in English.
const ERR = INPUT_ERRORS.en;
const when = (ms) => `${formatShortDateTime(new Date(ms), 'International')} UTC`;
const num = (n, digits = 2) => formatToolNumber(n, 'en-US', digits);

function FeedLine({ feed, testId, label, asOf }) {
  let text;
  if (feed.status === 'loading') text = `Loading ${label}…`;
  else if (feed.status === 'unavailable') text = `${label[0].toUpperCase()}${label.slice(1)} are not available right now. Please try again later.`;
  else if (feed.status === 'stale') text = `Could not refresh right now. Showing ${label} from ${when(asOf)} (${feed.data.source}); they may be out of date.`;
  else text = `Source: ${feed.data.source} · ${label} updated ${when(asOf)}`;
  return <div data-testid={testId} role="status" style={{ fontSize: '0.8rem', color: feed.status === 'stale' || feed.status === 'unavailable' ? NEON.amber : NEON.textMuted || NEON.textSecondary, marginTop: '10px', textAlign: 'center' }}>{text}</div>;
}
const InputError = ({ code, testId }) => (code ? <div data-testid={testId} role="alert" style={{ color: NEON.red, fontSize: '0.8rem', marginTop: '6px' }}>{ERR[code]}</div> : null);

function PublicToolsEn() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('currency');

  useEffect(() => {
    // See matching note in Contact.jsx - bare /tools is a compatibility
    // alias only; PublicToolsEn is always the English component, so the
    // redirect target is fixed to /en/tools.
    if (window.location.pathname === '/tools') {
      navigate('/en/tools', { replace: true });
    }

    // One public SEO authority (src/shared/publicSeoRoutes.js), shared with the prerender build (2026-09-28).
    setSeoMeta(publicSeo('/en/tools'));
  }, [navigate]);

  // PRODUCT_TRUTH_CAPABILITY: public_currency_converter
  // PRODUCT_TRUTH_CAPABILITY: public_crypto_calculator
  const feeds = usePublicToolsFeeds({ base: 'USD', cacheKey: 'proflow_tools_cache_en_v2' });
  const rates = feeds.currency.data?.rates || null; // units of each currency per 1 USD

  // Currency
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const currencyLabels = {
    USD: 'US Dollar (USD)',
    EUR: 'Euro (EUR)',
    GBP: 'British Pound (GBP)',
    ILS: 'Israeli New Shekel (ILS)',
    CAD: 'Canadian Dollar (CAD)',
    AUD: 'Australian Dollar (AUD)',
    CHF: 'Swiss Franc (CHF)',
    JPY: 'Japanese Yen (JPY)'
  };
  const codes = ['USD', ...CURRENCY_CODES.filter((c) => c !== 'USD')];
  const amountIn = parseToolNumber(amount);
  const currencyResult = amountIn.ok && rates ? `${num(convertCurrency(amountIn.value, fromCurrency, toCurrency, rates))} ${toCurrency}` : '—';
  const handleSwapCurrencies = () => { setFromCurrency(toCurrency); setToCurrency(fromCurrency); };

  // Units (lengths)
  const [unitValue, setUnitValue] = useState('1');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const unitLabels = { m: 'Meters', ft: 'Feet', km: 'Kilometers', mi: 'Miles', cm: 'Centimeters', in: 'Inches' };
  // PRODUCT_TRUTH_CAPABILITY: public_unit_converter
  const unitIn = parseToolNumber(unitValue);
  const unitsResult = unitIn.ok ? `${formatToolNumber(convertLength(unitIn.value, fromUnit, toUnit), 'en-US')} ${unitLabels[toUnit]}` : '—';
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
  const metalUsdText = metalUsd == null ? '—' : `$${num(metalUsd)}`;
  const metalEurText = metalUsd == null ? '—' : rates ? `€${num(metalUsd * rates.EUR)}` : 'Not available (no exchange rate)';

  // Crypto
  const [cryptoCoin, setCryptoCoin] = useState('btc');
  const [cryptoAmount, setCryptoAmount] = useState('1');
  const cryptoLabels = {
    btc: 'Bitcoin (BTC)',
    eth: 'Ethereum (ETH)',
    sol: 'Solana (SOL)',
    xrp: 'XRP (XRP)',
    trx: 'TRON (TRX)'
  };
  const coinIn = parseToolNumber(cryptoAmount);
  const coinPrice = feeds.crypto.data?.prices?.[cryptoCoin] || null;
  const cryptoUsd = coinIn.ok && coinPrice ? coinIn.value * coinPrice.usd : null;
  const cryptoUsdText = cryptoUsd == null ? '—' : `$${num(cryptoUsd)}`;
  const cryptoEurText = cryptoUsd == null ? '—' : rates ? `€${num(cryptoUsd * rates.EUR)}` : 'Not available (no exchange rate)';

  const tabBtnStyle = (tabKey) => ({
    flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none',
    background: activeTab === tabKey ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
    color: activeTab === tabKey ? NEON.violetLight : NEON.textSecondary, fontWeight: 'bold', cursor: 'pointer',
    borderBottom: activeTab === tabKey ? `3px solid ${NEON.violet}` : '3px solid transparent', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
  });

  const selectStyle = { width: '100%', padding: '12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '1rem', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary };
  const resultBoxStyle = { background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${NEON.border}` };
  const swapBtnStyle = { background: 'rgba(139, 92, 246, 0.15)', border: `1px solid rgba(167, 139, 250, 0.4)`, borderRadius: '8px', width: '46px', height: '46px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEON.violetLight };
  const numberInput = (id, value, setValue) => (
    <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} style={selectStyle} />
  );

  return (
    <div style={{ minHeight: '100vh', background: NEON.bg, color: NEON.textPrimary, fontFamily: FONT_EN }} dir="ltr">
      {/* Header */}
      <header style={{ background: NEON.gradient, color: 'white', padding: '40px 20px', textAlign: 'center', position: 'relative' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: navigation link back to the landing page of the same language (Task 36, L3) */}
        <a href="/en" data-testid="tools-home" onClick={(e) => { e.preventDefault(); navigate('/en'); }} style={{ position: 'absolute', top: '12px', insetInlineStart: '16px', color: 'white', fontSize: '0.85rem', textDecoration: 'underline' }}>Back to home</a>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '10px', fontWeight: 'bold' }}>Business Tools & Calculators Hub</h1>
        <p style={{ fontSize: '1.05rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
          Calculators for businesses, importers and freelancers: currency and crypto conversions from a named data source with its update time, length conversions, and indicative precious-metals estimates.
        </p>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '800px', margin: '-30px auto 40px', padding: '0 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: NEON.bgCard, borderRadius: '16px', boxShadow: '0 20px 40px -10px rgba(139, 92, 246, 0.2)', overflow: 'hidden', border: `1px solid ${NEON.border}` }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${NEON.border}`, flexWrap: 'wrap' }}>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the currency converter */}
            <button onClick={() => setActiveTab('currency')} style={tabBtnStyle('currency')}>
              <ArrowLeftRight size={18} strokeWidth={2.2} />
              Currency Converter
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the unit converter */}
            <button onClick={() => setActiveTab('units')} style={tabBtnStyle('units')}>
              <Ruler size={18} strokeWidth={2.2} />
              Unit Conversions
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the precious metals calculator */}
            <button onClick={() => setActiveTab('metals')} style={tabBtnStyle('metals')}>
              <Gem size={18} strokeWidth={2.2} />
              Precious Metals
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: switches the active public tools tab to the crypto calculator */}
            <button onClick={() => setActiveTab('crypto')} style={tabBtnStyle('crypto')}>
              <Bitcoin size={18} strokeWidth={2.2} />
              Crypto Converter
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '30px' }}>
            {activeTab === 'currency' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary }}>Currency Converter</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-from-currency" style={labelStyle}>From currency</label>
                    <select id="tools-from-currency" value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={selectStyle}>
                      {codes.map((code) => <option key={code} value={code}>{currencyLabels[code]}</option>)}
                    </select>
                  </div>

                  {/* PRODUCT_TRUTH_DECORATIVE: swaps the from/to currency selections within the currency converter tool */}
                  <button onClick={handleSwapCurrencies} aria-label="Swap currencies" title="Swap currencies" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label htmlFor="tools-to-currency" style={labelStyle}>To currency</label>
                    <select id="tools-to-currency" value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={selectStyle}>
                      {codes.map((code) => <option key={code} value={code}>{currencyLabels[code]}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label htmlFor="tools-amount" style={labelStyle}>Amount ({fromCurrency})</label>
                  {numberInput('tools-amount', amount, setAmount)}
                  <InputError code={amountIn.ok ? null : amountIn.code} testId="tools-currency-error" />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated result</div>
                  <div data-testid="tools-currency-result" style={{ fontSize: '2rem', fontWeight: 'bold', color: NEON.violetLight }}>{currencyResult}</div>
                  <FeedLine feed={feeds.currency} testId="tools-feed-currency" label="exchange rates" asOf={feeds.currency.data?.asOf} />
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary }}>Length Conversions</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-from-unit" style={labelStyle}>From unit</label>
                    <select id="tools-from-unit" value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} style={selectStyle}>
                      {Object.keys(UNIT_FACTORS).map((key) => <option key={key} value={key}>{unitLabels[key]}</option>)}
                    </select>
                  </div>

                  {/* PRODUCT_TRUTH_DECORATIVE: swaps the from/to unit selections within the unit converter tool */}
                  <button onClick={handleSwapUnits} aria-label="Swap units" title="Swap units" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label htmlFor="tools-to-unit" style={labelStyle}>To unit</label>
                    <select id="tools-to-unit" value={toUnit} onChange={(e) => setToUnit(e.target.value)} style={selectStyle}>
                      {Object.keys(UNIT_FACTORS).map((key) => <option key={key} value={key}>{unitLabels[key]}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label htmlFor="tools-unit-value" style={labelStyle}>Value to convert ({unitLabels[fromUnit]})</label>
                  {numberInput('tools-unit-value', unitValue, setUnitValue)}
                  <InputError code={unitIn.ok ? null : unitIn.code} testId="tools-units-error" />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: NEON.textSecondary, marginBottom: '5px' }}>Result</div>
                  <div data-testid="tools-units-result" style={{ fontSize: '1.8rem', fontWeight: 'bold', color: NEON.violetLight }}>{unitsResult}</div>
                </div>
              </div>
            )}

            {activeTab === 'metals' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '12px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={20} color={NEON.amber} />
                  Precious Metals Value Estimator
                </h2>
                <p data-testid="tools-metal-note" style={{ fontSize: '0.85rem', color: NEON.textSecondary, margin: '0 0 20px', lineHeight: 1.6 }}>
                  <span>Estimate only - not based on current metal prices.</span> The calculation is weight × fineness × price per gram of fine metal. <span>The price shown is a fixed reference value, not a current market price</span>; you can enter your own current price instead.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-metal-type" style={labelStyle}>Metal type</label>
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
                      <option value="gold">🥇 Gold</option>
                      <option value="silver">🥈 Silver</option>
                      <option value="platinum">🪙 Platinum</option>
                      <option value="palladium">🪙 Palladium</option>
                      <option value="rhodium">🪙 Rhodium</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tools-metal-purity" style={labelStyle}>Purity / karat</label>
                    <select id="tools-metal-purity" value={purity} onChange={(e) => setPurity(e.target.value)} style={selectStyle}>
                      {metalType === 'gold' && (
                        <>
                          <option value="24k">Gold 24K (99.9%)</option>
                          <option value="22k">Gold 22K (91.6%)</option>
                          <option value="21k">Gold 21K (87.5%)</option>
                          <option value="18k">Gold 18K (75.0%)</option>
                          <option value="14k">Gold 14K (58.5%)</option>
                        </>
                      )}
                      {metalType === 'silver' && (
                        <>
                          <option value="999">Pure Silver 999 (99.9%)</option>
                          <option value="925">Sterling Silver 925 (92.5%)</option>
                          <option value="800">Silver 800 (80.0%)</option>
                        </>
                      )}
                      {metalType === 'platinum' && (
                        <>
                          <option value="999">Pure Platinum 999 (99.9%)</option>
                          <option value="950">Platinum 950 (95.0%)</option>
                        </>
                      )}
                      {metalType === 'palladium' && (
                        <option value="999">Pure Palladium 999 (99.9%)</option>
                      )}
                      {metalType === 'rhodium' && (
                        <option value="999">Pure Rhodium 999 (99.9%)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label htmlFor="tools-metal-grams" style={labelStyle}>Weight in grams</label>
                    {numberInput('tools-metal-grams', metalGrams, setMetalGrams)}
                  </div>
                  <div>
                    <label htmlFor="tools-metal-price" style={labelStyle}>Price per gram of fine metal (USD)</label>
                    {numberInput('tools-metal-price', usdPerGram, setUsdPerGram)}
                  </div>
                </div>
                <InputError code={metalError} testId="tools-metal-error" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '12px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated value (USD)</div>
                    <div data-testid="tools-metal-usd" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.amber }}>{metalUsdText}</div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated value (EUR)</div>
                    <div data-testid="tools-metal-eur" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.amber }}>{metalEurText}</div>
                  </div>
                </div>
                <FeedLine feed={feeds.currency} testId="tools-feed-metal-currency" label="exchange rates (for EUR)" asOf={feeds.currency.data?.asOf} />
              </div>
            )}

            {activeTab === 'crypto' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bitcoin size={20} color={NEON.violetLighter} />
                  Crypto Value Calculator
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="tools-crypto-coin" style={labelStyle}>Cryptocurrency</label>
                  <select id="tools-crypto-coin" value={cryptoCoin} onChange={(e) => setCryptoCoin(e.target.value)} style={selectStyle}>
                    {Object.entries(cryptoLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="tools-crypto-amount" style={labelStyle}>Number of coins</label>
                  {numberInput('tools-crypto-amount', cryptoAmount, setCryptoAmount)}
                  <InputError code={coinIn.ok ? null : coinIn.code} testId="tools-crypto-error" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated value (USD)</div>
                    <div data-testid="tools-crypto-usd" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.violetLighter }}>{cryptoUsdText}</div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated value (EUR)</div>
                    <div data-testid="tools-crypto-eur" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.violetLighter }}>{cryptoEurText}</div>
                  </div>
                </div>
                {feeds.crypto.status !== 'loading' && feeds.crypto.status !== 'unavailable' && !coinPrice
                  ? <div data-testid="tools-feed-crypto" role="status" style={{ fontSize: '0.8rem', color: NEON.amber, marginTop: '10px', textAlign: 'center' }}>The price of {cryptoLabels[cryptoCoin]} is not available right now from the data source ({feeds.crypto.data?.source}).</div>
                  : <FeedLine feed={feeds.crypto} testId="tools-feed-crypto" label="crypto prices" asOf={coinPrice?.asOf} />}
              </div>
            )}
          </div>
        </div>

        {/* SEO Content Section */}
        <section style={{ marginTop: '40px', background: NEON.bgCard, padding: '30px', borderRadius: '16px', border: `1px solid ${NEON.border}` }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: NEON.textPrimary }}>Tools for Businesses Working Across Borders</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: NEON.textSecondary, marginBottom: '15px' }}>
            Businesses, freelancers and importers need quick calculations every day: currency conversions, unit conversions when working with overseas suppliers, and value estimates. TEKANGO's tools hub keeps these calculations in one place, with the data source and its update time.
          </p>
        </section>

        {/* CTA Banner */}
        <div style={{ marginTop: '30px', background: NEON.gradient, color: 'white', padding: '35px 20px', borderRadius: '16px', textAlign: 'center', boxShadow: NEON.glow }}>
          <div style={{ display: 'inline-block', background: 'rgba(0, 0, 0, 0.25)', backdropFilter: 'blur(8px)', padding: '10px 22px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
            <ProFlowLogo />
          </div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', fontWeight: 'bold' }}>Ready to run your business in one place?</h3>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, marginBottom: '20px' }}>Create quotes, manage clients and collect your customers' digital signatures - all in TEKANGO.</p>
          {/* PRODUCT_TRUTH_DECORATIVE: marketing CTA opening the account-creation screen (the landing signup path) */}
          <button
            data-testid="tools-cta"
            onClick={() => navigate('/dashboard?signup=true&lang=en')}
            style={{ background: 'white', color: NEON.violet, padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'inline-block' }}
          >
            Create an account
          </button>
        </div>
      </main>
    </div>
  );
}

export default PublicToolsEn;
