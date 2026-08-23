import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from './ProFlowLogo';
import { ArrowLeftRight, ArrowRightLeft, Coins, Ruler, Gem, Bitcoin } from 'lucide-react';
import { NEON, FONT_EN, loadNeonFonts } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';

function PublicToolsEn() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('currency');

  useEffect(() => {
    setSeoMeta({
      title: 'ProFlow - Business Tools & Calculators Hub',
      description: 'Free currency converter, unit converter, metals and crypto calculators - accurate business tools from ProFlow.',
      canonicalPath: '/en/tools'
    });
    loadNeonFonts();
  }, []);

  // Currency state with Swap support
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');

  const [rates, setRates] = useState({
    USD: 1,
    EUR: 0.92,
    GBP: 0.78,
    ILS: 3.65,
    CAD: 1.35,
    AUD: 1.52,
    CHF: 0.88,
    JPY: 150.0
  });

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

  // Precious Metals state
  const [metalType, setMetalType] = useState('gold');
  const [purity, setPurity] = useState('24k');
  const [metalGrams, setMetalGrams] = useState('10');

  const [metalPricesUSD, setMetalPricesUSD] = useState({
    gold: 75.6,
    silver: 0.88,
    platinum: 33.0,
    palladium: 30.0,
    rhodium: 1040.0
  });

  // Crypto state
  const [cryptoCoin, setCryptoCoin] = useState('btc');
  const [cryptoAmount, setCryptoAmount] = useState('1');

  const [cryptoPricesUSD, setCryptoPricesUSD] = useState({
    btc: 65000,
    eth: 3500,
    sol: 150,
    xrp: 0.60,
    trx: 0.12
  });

  // Live API Fetch with 10 minutes Cache
  useEffect(() => {
    const fetchLiveData = async () => {
      const CACHE_KEY = 'proflow_tools_cache_en';
      const CACHE_TIME_KEY = 'proflow_tools_cache_time_en';
      const TEN_MINUTES = 10 * 60 * 1000;
      const now = Date.now();

      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      const cachedData = localStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData && (now - parseInt(cachedTime, 10) < TEN_MINUTES)) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed.rates) setRates(parsed.rates);
          if (parsed.metals) setMetalPricesUSD(parsed.metals);
          if (parsed.crypto) setCryptoPricesUSD(parsed.crypto);
          return;
        } catch (e) {
          console.error("Cache read error", e);
        }
      }

      try {
        // 1. Fetch Currencies relative to USD
        const currRes = await fetch('https://open.er-api.com/v6/latest/USD');
        const currData = await currRes.json();
        if (currData && currData.rates) {
          const baseRates = currData.rates;
          const newRates = {
            USD: 1,
            EUR: baseRates.EUR || 0.92,
            GBP: baseRates.GBP || 0.78,
            ILS: baseRates.ILS || 3.65,
            CAD: baseRates.CAD || 1.35,
            AUD: baseRates.AUD || 1.52,
            CHF: baseRates.CHF || 0.88,
            JPY: baseRates.JPY || 150.0
          };
          setRates(newRates);
        }

        // 2. Fetch Crypto via CoinGecko
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,tron&vs_currencies=usd');
        const cryptoData = await cryptoRes.json();
        const newCrypto = {
          btc: cryptoData?.bitcoin?.usd || 65000,
          eth: cryptoData?.ethereum?.usd || 3500,
          sol: cryptoData?.solana?.usd || 150,
          xrp: cryptoData?.ripple?.usd || 0.60,
          trx: cryptoData?.tron?.usd || 0.12
        };
        setCryptoPricesUSD(newCrypto);

        // Save to Cache
        const cachePayload = {
          rates: currData?.rates ? {
            USD: 1,
            EUR: currData.rates.EUR,
            GBP: currData.rates.GBP,
            ILS: currData.rates.ILS,
            CAD: currData.rates.CAD,
            AUD: currData.rates.AUD,
            CHF: currData.rates.CHF,
            JPY: currData.rates.JPY
          } : rates,
          metals: metalPricesUSD,
          crypto: newCrypto
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
        localStorage.setItem(CACHE_TIME_KEY, now.toString());

      } catch (err) {
        console.error("Live API fetch failed, using fallback values", err);
      }
    };

    fetchLiveData();
  }, []);

  const convertCurrency = () => {
    const val = parseFloat(amount) || 0;
    const inUSD = val / (rates[fromCurrency] || 1);
    const result = inUSD * (rates[toCurrency] || 1);
    return result.toFixed(2);
  };

  const handleSwapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  // Units state with Swap support and full unit list
  const [unitValue, setUnitValue] = useState('1');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');

  const unitFactors = {
    m: 1,
    ft: 0.3048,
    km: 1000,
    mi: 1609.344,
    cm: 0.01,
    in: 0.0254
  };

  const unitLabels = {
    m: 'Meters',
    ft: 'Feet',
    km: 'Kilometers',
    mi: 'Miles',
    cm: 'Centimeters',
    in: 'Inches'
  };

  const convertUnits = () => {
    const val = parseFloat(unitValue) || 0;
    const inMeters = val * unitFactors[fromUnit];
    const result = inMeters / unitFactors[toUnit];
    return result.toFixed(2);
  };

  const handleSwapUnits = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  const calculateMetalValue = () => {
    const g = parseFloat(metalGrams) || 0;
    let factor = 1;
    let basePriceUSD = metalPricesUSD[metalType] || 75.6;

    if (metalType === 'gold') {
      if (purity === '24k') factor = 1.0;
      else if (purity === '22k') factor = 22 / 24;
      else if (purity === '21k') factor = 21 / 24;
      else if (purity === '18k') factor = 18 / 24;
      else if (purity === '14k') factor = 14 / 24;
    } else if (metalType === 'silver') {
      if (purity === '999') factor = 1.0;
      else if (purity === '925') factor = 0.925;
      else if (purity === '800') factor = 0.800;
    } else if (metalType === 'platinum') {
      if (purity === '999') factor = 1.0;
      else if (purity === '950') factor = 0.950;
    } else {
      factor = 1.0;
    }

    const totalUSD = g * basePriceUSD * factor;
    const totalEUR = totalUSD * (rates['EUR'] || 0.92);
    return {
      usd: totalUSD.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      eur: totalEUR.toLocaleString('de-DE', { maximumFractionDigits: 2 })
    };
  };

  const metalResult = calculateMetalValue();

  const cryptoLabels = {
    btc: 'Bitcoin (BTC)',
    eth: 'Ethereum (ETH)',
    sol: 'Solana (SOL)',
    xrp: 'Ripple (XRP)',
    trx: 'Tron (TRX)'
  };

  const calculateCryptoValue = () => {
    const amt = parseFloat(cryptoAmount) || 0;
    const priceUSD = cryptoPricesUSD[cryptoCoin] || 0;
    const totalUSD = amt * priceUSD;
    const totalEUR = totalUSD * (rates['EUR'] || 0.92);
    return {
      usd: totalUSD.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      eur: totalEUR.toLocaleString('de-DE', { maximumFractionDigits: 2 })
    };
  };

  const cryptoResult = calculateCryptoValue();

  const tabBtnStyle = (tabKey) => ({
    flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none',
    background: activeTab === tabKey ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
    color: activeTab === tabKey ? NEON.violetLight : NEON.textSecondary, fontWeight: 'bold', cursor: 'pointer',
    borderBottom: activeTab === tabKey ? `3px solid ${NEON.violet}` : '3px solid transparent', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
  });

  const selectStyle = { width: '100%', padding: '12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', fontSize: '1rem', outline: 'none', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box' };
  const resultBoxStyle = { background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${NEON.border}` };
  const swapBtnStyle = { background: 'rgba(139, 92, 246, 0.15)', border: `1px solid rgba(167, 139, 250, 0.4)`, borderRadius: '8px', width: '46px', height: '46px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEON.violetLight };

  return (
    <div style={{ minHeight: '100vh', background: NEON.bg, color: NEON.textPrimary, fontFamily: FONT_EN }} dir="ltr">
      {/* Header */}
      <header style={{ background: NEON.gradient, color: 'white', padding: '40px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '10px', fontWeight: 'bold' }}>Business Tools & Calculators Hub</h1>
        <p style={{ fontSize: '1.05rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
          Smart, fast, and accurate tools for businesses, importers, and freelancers – live currency, unit, precious metals, and crypto conversions.
        </p>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '800px', margin: '-30px auto 40px', padding: '0 20px' }}>
        <div style={{ background: NEON.bgCard, borderRadius: '16px', boxShadow: '0 20px 40px -10px rgba(139, 92, 246, 0.2)', overflow: 'hidden', border: `1px solid ${NEON.border}` }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${NEON.border}`, flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('currency')} style={tabBtnStyle('currency')}>
              <ArrowLeftRight size={18} strokeWidth={2.2} />
              Currency Converter
            </button>
            <button onClick={() => setActiveTab('units')} style={tabBtnStyle('units')}>
              <Ruler size={18} strokeWidth={2.2} />
              Unit Conversions
            </button>
            <button onClick={() => setActiveTab('metals')} style={tabBtnStyle('metals')}>
              <Gem size={18} strokeWidth={2.2} />
              Precious Metals
            </button>
            <button onClick={() => setActiveTab('crypto')} style={tabBtnStyle('crypto')}>
              <Bitcoin size={18} strokeWidth={2.2} />
              Crypto Converter
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '30px' }}>
            {activeTab === 'currency' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary }}>Convert Foreign Currencies (Live)</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>From Currency:</label>
                    <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={selectStyle}>
                      {Object.entries(currencyLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={handleSwapCurrencies} title="Swap Currencies" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>To Currency:</label>
                    <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={selectStyle}>
                      {Object.entries(currencyLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Amount ({fromCurrency}):</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={selectStyle} />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated Conversion Result (Live):</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: NEON.violetLight }}>
                    {convertCurrency()} {toCurrency}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary }}>Unit & Distance Conversions</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>From Unit:</label>
                    <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} style={selectStyle}>
                      {Object.entries(unitLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={handleSwapUnits} title="Swap Units" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>To Unit:</label>
                    <select value={toUnit} onChange={(e) => setToUnit(e.target.value)} style={selectStyle}>
                      {Object.entries(unitLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Value to Convert ({unitLabels[fromUnit]}):</label>
                  <input type="number" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} style={selectStyle} />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: NEON.textSecondary, marginBottom: '5px' }}>Result:</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: NEON.violetLight }}>
                    {convertUnits()} {unitLabels[toUnit]}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'metals' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={20} color={NEON.amber} />
                  Precious Metals Value Calculator (Live Rates)
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Metal Type:</label>
                    <select
                      value={metalType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMetalType(val);
                        if (val === 'gold') setPurity('24k');
                        else if (val === 'silver') setPurity('999');
                        else setPurity('999');
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
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Purity / Karat:</label>
                    <select value={purity} onChange={(e) => setPurity(e.target.value)} style={selectStyle}>
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

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Weight in Grams:</label>
                  <input type="number" value={metalGrams} onChange={(e) => setMetalGrams(e.target.value)} style={selectStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated Value (USD):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.amber }}>
                      ${metalResult.usd}
                    </div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated Value (EUR):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.amber }}>
                      €{metalResult.eur}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'crypto' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bitcoin size={20} color={NEON.violetLighter} />
                  Crypto Converter Calculator (Live Rates)
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Select Cryptocurrency:</label>
                  <select value={cryptoCoin} onChange={(e) => setCryptoCoin(e.target.value)} style={selectStyle}>
                    {Object.entries(cryptoLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>Amount of Coins:</label>
                  <input type="number" value={cryptoAmount} onChange={(e) => setCryptoAmount(e.target.value)} style={selectStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated Value (USD):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.violetLighter }}>
                      ${cryptoResult.usd}
                    </div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>Estimated Value (EUR):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.violetLighter }}>
                      €{cryptoResult.eur}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SEO Content Section */}
        <section style={{ marginTop: '40px', background: NEON.bgCard, padding: '30px', borderRadius: '16px', border: `1px solid ${NEON.border}` }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: NEON.textPrimary }}>Advanced Tools for Business & International Trade</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: NEON.textSecondary, marginBottom: '15px' }}>
            Businesses, freelancers, and importers daily need quick currency conversions, metric measurements when working with overseas suppliers, and financial tracking. ProFlow's tools hub centralizes all these actions in one place, accurately and instantly.
          </p>
        </section>

        {/* CTA Banner */}
        <div style={{ marginTop: '30px', background: NEON.gradient, color: 'white', padding: '35px 20px', borderRadius: '16px', textAlign: 'center', boxShadow: NEON.glow }}>
          <div style={{ display: 'inline-block', background: 'rgba(0, 0, 0, 0.25)', backdropFilter: 'blur(8px)', padding: '10px 22px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
            <ProFlowLogo />
          </div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', fontWeight: 'bold' }}>Ready to take your business to the next level?</h3>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, marginBottom: '20px' }}>Create smart quotes, manage clients, and expand globally with ProFlow.</p>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'white', color: NEON.violet, padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'inline-block' }}
          >
            Get Started Free
          </button>
        </div>
      </main>
    </div>
  );
}

export default PublicToolsEn;
