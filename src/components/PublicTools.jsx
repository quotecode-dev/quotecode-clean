import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from './ProFlowLogo';
import { ArrowLeftRight, ArrowRightLeft, Coins, Ruler, Gem, Bitcoin } from 'lucide-react';
import { NEON, FONT_HE, loadNeonFonts } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';

function PublicTools() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('currency');

  useEffect(() => {
    setSeoMeta({
      title: 'ProFlow - מרכז הכלים והמחשבונים העסקיים',
      description: 'מחשבון המרת מטבעות, יחידות מידה, מתכות וקריפטו - כלים עסקיים חינמיים ומדויקים מבית ProFlow.',
      canonicalPath: '/tools'
    });
    loadNeonFonts();
  }, []);

  // Currency state with Swap support
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('ILS');

  const [rates, setRates] = useState({
    ILS: 1,
    USD: 3.65,
    EUR: 3.95,
    GBP: 4.65,
    CAD: 2.68,
    AUD: 2.42,
    CHF: 4.20,
    JPY: 0.024
  });

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

  // Precious Metals state
  const [metalType, setMetalType] = useState('gold');
  const [purity, setPurity] = useState('24k');
  const [metalGrams, setMetalGrams] = useState('10');

  const [metalPricesILS, setMetalPricesILS] = useState({
    gold: 276,
    silver: 3.2,
    platinum: 120,
    palladium: 110,
    rhodium: 3800
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
      const CACHE_KEY = 'proflow_tools_cache_he';
      const CACHE_TIME_KEY = 'proflow_tools_cache_time_he';
      const TEN_MINUTES = 10 * 60 * 1000;
      const now = Date.now();

      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      const cachedData = localStorage.getItem(CACHE_KEY);

      if (cachedTime && cachedData && (now - parseInt(cachedTime, 10) < TEN_MINUTES)) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed.rates) setRates(parsed.rates);
          if (parsed.metals) setMetalPricesILS(parsed.metals);
          if (parsed.crypto) setCryptoPricesUSD(parsed.crypto);
          return;
        } catch (e) {
          console.error("Cache read error", e);
        }
      }

      try {
        // 1. Fetch Currencies
        const currRes = await fetch('https://open.er-api.com/v6/latest/ILS');
        const currData = await currRes.json();
        if (currData && currData.rates) {
          const baseRates = currData.rates;
          const newRates = {
            ILS: 1,
            USD: 1 / (baseRates.USD || 3.65),
            EUR: 1 / (baseRates.EUR || 3.95),
            GBP: 1 / (baseRates.GBP || 4.65),
            CAD: 1 / (baseRates.CAD || 2.68),
            AUD: 1 / (baseRates.AUD || 2.42),
            CHF: 1 / (baseRates.CHF || 4.20),
            JPY: 1 / (baseRates.JPY || 0.024)
          };
          setRates(newRates);
        }

        // 2. Fetch Crypto via CoinGecko
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,tron&vs_currencies=usd');
        const cryptoData = await cryptoRes.json();
        const currentUsdRate = currData?.rates?.USD ? (1 / currData.rates.USD) : 3.65;

        const newCrypto = {
          btc: cryptoData?.bitcoin?.usd || 65000,
          eth: cryptoData?.ethereum?.usd || 3500,
          sol: cryptoData?.solana?.usd || 150,
          xrp: cryptoData?.ripple?.usd || 0.60,
          trx: cryptoData?.tron?.usd || 0.12
        };
        setCryptoPricesUSD(newCrypto);

        // 3. Approximate Metals based on USD rates & current USD/ILS
        const goldUsdPerGram = 75.6;
        const silverUsdPerGram = 0.88;
        const platUsdPerGram = 33.0;
        const pallUsdPerGram = 30.0;
        const rhodUsdPerGram = 1040.0;

        const newMetals = {
          gold: goldUsdPerGram * currentUsdRate,
          silver: silverUsdPerGram * currentUsdRate,
          platinum: platUsdPerGram * currentUsdRate,
          palladium: pallUsdPerGram * currentUsdRate,
          rhodium: rhodUsdPerGram * currentUsdRate
        };
        setMetalPricesILS(newMetals);

        // Save to Cache
        const cachePayload = {
          rates: currData?.rates ? {
            ILS: 1,
            USD: 1 / currData.rates.USD,
            EUR: 1 / currData.rates.EUR,
            GBP: 1 / currData.rates.GBP,
            CAD: 1 / currData.rates.CAD,
            AUD: 1 / currData.rates.AUD,
            CHF: 1 / currData.rates.CHF,
            JPY: 1 / currData.rates.JPY
          } : rates,
          metals: newMetals,
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
    const inILS = val * (rates[fromCurrency] || 1);
    const result = inILS / (rates[toCurrency] || 1);
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
    m: 'מטר',
    ft: 'פיט (רגל)',
    km: 'קילומטר',
    mi: 'מייל',
    cm: 'סנטימטר',
    in: 'אינץ\''
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

  const usdRate = rates['USD'] || 3.65;

  const calculateMetalValue = () => {
    const g = parseFloat(metalGrams) || 0;
    let factor = 1;
    let basePrice = metalPricesILS[metalType] || 276;

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

    const totalILS = g * basePrice * factor;
    const totalUSD = totalILS / usdRate;
    return {
      ils: totalILS.toLocaleString('he-IL', { maximumFractionDigits: 2 }),
      usd: totalUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })
    };
  };

  const metalResult = calculateMetalValue();

  const cryptoLabels = {
    btc: 'ביטקויין (BTC)',
    eth: 'איתריום (ETH)',
    sol: 'סולאנה (SOL)',
    xrp: 'ריפל (XRP)',
    trx: 'טרון (TRX)'
  };

  const calculateCryptoValue = () => {
    const amt = parseFloat(cryptoAmount) || 0;
    const priceUSD = cryptoPricesUSD[cryptoCoin] || 0;
    const totalUSD = amt * priceUSD;
    const totalILS = totalUSD * usdRate;
    return {
      ils: totalILS.toLocaleString('he-IL', { maximumFractionDigits: 2 }),
      usd: totalUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })
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
    <div style={{ minHeight: '100vh', background: NEON.bg, color: NEON.textPrimary, fontFamily: FONT_HE }} dir="rtl">
      {/* Header */}
      <header style={{ background: NEON.gradient, color: 'white', padding: '40px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '10px', fontWeight: 'bold' }}>מרכז הכלים והמחשבונים העסקיים</h1>
        <p style={{ fontSize: '1.05rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
          כלים חכמים, מהירים ומדויקים לעסקים, יבואנים ופרילנסרים – המרות מטבעות, מידות, מתכות יקרות וקריפטו בזמן אמת.
        </p>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '800px', margin: '-30px auto 40px', padding: '0 20px' }}>
        <div style={{ background: NEON.bgCard, borderRadius: '16px', boxShadow: '0 20px 40px -10px rgba(139, 92, 246, 0.2)', overflow: 'hidden', border: `1px solid ${NEON.border}` }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${NEON.border}`, flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('currency')} style={tabBtnStyle('currency')}>
              <ArrowLeftRight size={18} strokeWidth={2.2} />
              המרת מטבעות
            </button>
            <button onClick={() => setActiveTab('units')} style={tabBtnStyle('units')}>
              <Ruler size={18} strokeWidth={2.2} />
              מידות ומרחקים
            </button>
            <button onClick={() => setActiveTab('metals')} style={tabBtnStyle('metals')}>
              <Gem size={18} strokeWidth={2.2} />
              מתכות יקרות
            </button>
            <button onClick={() => setActiveTab('crypto')} style={tabBtnStyle('crypto')}>
              <Bitcoin size={18} strokeWidth={2.2} />
              ממיר קריפטו
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '30px' }}>
            {activeTab === 'currency' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary }}>המר מטבעות זרים ושקלים</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>ממטבע:</label>
                    <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} style={selectStyle}>
                      {Object.entries(currencyLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={handleSwapCurrencies} title="החלף מטבעות (SWAP)" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>למטבע יעד:</label>
                    <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} style={selectStyle}>
                      {Object.entries(currencyLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>סכום להמרה ({fromCurrency}):</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={selectStyle} />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: NEON.textSecondary, marginBottom: '5px' }}>תוצאת ההמרה המשוערת (און-ליין):</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: NEON.violetLight }}>
                    {convertCurrency()} {toCurrency}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary }}>המרת יחידות מידה ומרחקים</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>מידת מקור:</label>
                    <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} style={selectStyle}>
                      {Object.entries(unitLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={handleSwapUnits} title="החלף יחידות (SWAP)" style={swapBtnStyle}>
                    <ArrowRightLeft size={18} strokeWidth={2.2} />
                  </button>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>מידת יעד:</label>
                    <select value={toUnit} onChange={(e) => setToUnit(e.target.value)} style={selectStyle}>
                      {Object.entries(unitLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>ערך להמרה ({unitLabels[fromUnit]}):</label>
                  <input type="number" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} style={selectStyle} />
                </div>

                <div style={resultBoxStyle}>
                  <div style={{ fontSize: '0.9rem', color: NEON.textSecondary, marginBottom: '5px' }}>תוצאה:</div>
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
                  מחשבון שווי מתכות יקרות לפי שערים חיים
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>סוג מתכת:</label>
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
                      <option value="gold">🥇 זהב</option>
                      <option value="silver">🥈 כסף</option>
                      <option value="platinum">🪙 פלטינה</option>
                      <option value="palladium">🪙 פלדיום</option>
                      <option value="rhodium">🪙 רודיום</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>דרגת טוהר / קראט:</label>
                    <select value={purity} onChange={(e) => setPurity(e.target.value)} style={selectStyle}>
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

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>משקל בגרמים:</label>
                  <input type="number" value={metalGrams} onChange={(e) => setMetalGrams(e.target.value)} style={selectStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>שווי משוער בשקלים (ILS):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.amber }}>
                      {metalResult.ils} ₪
                    </div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>שווי משוער בדולרים (USD):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.amber }}>
                      ${metalResult.usd}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'crypto' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bitcoin size={20} color={NEON.violetLighter} />
                  מחשבון המרת מטבעות קריפטו (שערים חיים)
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>בחר מטבע קריפטו:</label>
                  <select value={cryptoCoin} onChange={(e) => setCryptoCoin(e.target.value)} style={selectStyle}>
                    {Object.entries(cryptoLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: NEON.textSecondary }}>כמות מטבעות:</label>
                  <input type="number" value={cryptoAmount} onChange={(e) => setCryptoAmount(e.target.value)} style={selectStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>שווי משוער בשקלים (ILS):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.violetLighter }}>
                      {cryptoResult.ils} ₪
                    </div>
                  </div>
                  <div style={resultBoxStyle}>
                    <div style={{ fontSize: '0.85rem', color: NEON.textSecondary, marginBottom: '5px' }}>שווי משוער בדולרים (USD):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: NEON.violetLighter }}>
                      ${cryptoResult.usd}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SEO Content Section */}
        <section style={{ marginTop: '40px', background: NEON.bgCard, padding: '30px', borderRadius: '16px', border: `1px solid ${NEON.border}` }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: NEON.textPrimary }}>כלים מתקדמים לניהול עסק וקשרי מסחר בינלאומיים</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: NEON.textSecondary, marginBottom: '15px' }}>
            עסקים, עצמאיים ויבואנים נדרשים יום-יום לבצע חישובים מהירים של שערי מטבע, המרות מידות בעבודה מול ספקים בחו"ל ומעקב אחרי מדדים פיננסיים. מרכז הכלים של ProFlow נועד לרכז עבורכם את כל הפעולות הללו במקום אחד, בצורה מדויקת ומהירה.
          </p>
        </section>

        {/* CTA Banner */}
        <div style={{ marginTop: '30px', background: NEON.gradient, color: 'white', padding: '35px 20px', borderRadius: '16px', textAlign: 'center', boxShadow: NEON.glow }}>
          <div style={{ display: 'inline-block', background: 'rgba(0, 0, 0, 0.25)', backdropFilter: 'blur(8px)', padding: '10px 22px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
            <ProFlowLogo />
          </div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', fontWeight: 'bold' }}>רוצה לנהל את העסק שלך ברמה הבאה?</h3>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, marginBottom: '20px' }}>הפק הצעות מחיר חכמות, נהל לקוחות ופתח את העסק לעולם עם ProFlow.</p>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'white', color: NEON.violet, padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'inline-block' }}
          >
            התחל עכשיו בחינם
          </button>
        </div>
      </main>
    </div>
  );
}

export default PublicTools;
