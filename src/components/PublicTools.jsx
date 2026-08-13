import React, { useState, useEffect } from 'react';
import ProFlowLogo from './ProFlowLogo';

function PublicTools() {
  const [activeTab, setActiveTab] = useState('currency');

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
          // currData.rates gives how much foreign currency per 1 ILS, or we invert for ILS base
          // er-api gives base ILS if requested with /latest/ILS
          const baseRates = currData.rates;
          // We need rates relative to ILS (ILS = 1)
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
        // Gold approx ~75.6 USD per gram pure, Silver ~0.88, etc.
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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: 'system-ui, sans-serif' }} dir="rtl">
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', padding: '40px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '10px', fontWeight: 'bold' }}>מרכז הכלים והמחשבונים העסקיים</h1>
        <p style={{ fontSize: '1.05rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
          כלים חכמים, מהירים ומדויקים לעסקים, יבואנים ופרילנסרים – המרות מטבעות, מידות, מתכות יקרות וקריפטו בזמן אמת.
        </p>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '800px', margin: '-30px auto 40px', padding: '0 20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('currency')}
              style={{
                flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none', background: activeTab === 'currency' ? 'white' : 'transparent',
                color: activeTab === 'currency' ? '#4f46e5' : '#64748b', fontWeight: 'bold', cursor: 'pointer',
                borderBottom: activeTab === 'currency' ? '3px solid #4f46e5' : 'none', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              המרת מטבעות
            </button>
            <button
              onClick={() => setActiveTab('units')}
              style={{
                flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none', background: activeTab === 'units' ? 'white' : 'transparent',
                color: activeTab === 'units' ? '#4f46e5' : '#64748b', fontWeight: 'bold', cursor: 'pointer',
                borderBottom: activeTab === 'units' ? '3px solid #4f46e5' : 'none', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"></path><path d="M6 8v8"></path><path d="M10 10v4"></path><path d="M14 8v8"></path><path d="M18 10v4"></path></svg>
              מידות ומרחקים
            </button>
            <button
              onClick={() => setActiveTab('metals')}
              style={{
                flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none', background: activeTab === 'metals' ? 'white' : 'transparent',
                color: activeTab === 'metals' ? '#4f46e5' : '#64748b', fontWeight: 'bold', cursor: 'pointer',
                borderBottom: activeTab === 'metals' ? '3px solid #4f46e5' : 'none', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 18 3 22 8 12 22 2 8 6 3"></polygon></svg>
              מתכות יקרות
            </button>
            <button
              onClick={() => setActiveTab('crypto')}
              style={{
                flex: 1, minWidth: '130px', padding: '16px 10px', border: 'none', background: activeTab === 'crypto' ? 'white' : 'transparent',
                color: activeTab === 'crypto' ? '#4f46e5' : '#64748b', fontWeight: 'bold', cursor: 'pointer',
                borderBottom: activeTab === 'crypto' ? '3px solid #4f46e5' : 'none', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9 8h6a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9v-4z"></path><path d="M9 12h6a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9v-4z"></path><line x1="10" y1="6" x2="10" y2="8"></line><line x1="14" y1="6" x2="14" y2="8"></line><line x1="10" y1="16" x2="10" y2="18"></line><line x1="14" y1="16" x2="14" y2="18"></line></svg>
              ממיר קריפטו
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '30px' }}>
            {activeTab === 'currency' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: '#1e293b' }}>המר מטבעות זרים ושקלים</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>ממטבע:</label>
                    <select
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                    >
                      {Object.entries(currencyLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Swap Button */}
                  <button
                    onClick={handleSwapCurrencies}
                    title="החלף מטבעות (SWAP)"
                    style={{
                      background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', width: '46px', height: '46px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'all 0.2s'
                    }}
                  >
                    ⇄
                  </button>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>למטבע יעד:</label>
                    <select
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                    >
                      {Object.entries(currencyLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>סכום להמרה ({fromCurrency}):</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>תוצאת ההמרה המשוערת (און-ליין):</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4f46e5' }}>
                    {convertCurrency()} {toCurrency}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: '#1e293b' }}>המרת יחידות מידה ומרחקים</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>מידת מקור:</label>
                    <select
                      value={fromUnit}
                      onChange={(e) => setFromUnit(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                    >
                      {Object.entries(unitLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Swap Button for Units */}
                  <button
                    onClick={handleSwapUnits}
                    title="החלף יחידות (SWAP)"
                    style={{
                      background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', width: '46px', height: '46px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'all 0.2s'
                    }}
                  >
                    ⇄
                  </button>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>מידת יעד:</label>
                    <select
                      value={toUnit}
                      onChange={(e) => setToUnit(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                    >
                      {Object.entries(unitLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>ערך להמרה ({unitLabels[fromUnit]}):</label>
                  <input
                    type="number"
                    value={unitValue}
                    onChange={(e) => setUnitValue(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>תוצאה:</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4f46e5' }}>
                    {convertUnits()} {unitLabels[toUnit]}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'metals' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: '#1e293b' }}>מחשבון שווי מתכות יקרות לפי שערים חיים</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>סוג מתכת:</label>
                    <select
                      value={metalType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMetalType(val);
                        if (val === 'gold') setPurity('24k');
                        else if (val === 'silver') setPurity('999');
                        else setPurity('999');
                      }}
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                    >
                      <option value="gold">🥇 זהב</option>
                      <option value="silver">🥈 כסף</option>
                      <option value="platinum">🪙 פלטינה</option>
                      <option value="palladium">🪙 פלדיום</option>
                      <option value="rhodium">🪙 רודיום</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>דרגת טוהר / קראט:</label>
                    <select
                      value={purity}
                      onChange={(e) => setPurity(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                    >
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
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>משקל בגרמים:</label>
                  <input
                    type="number"
                    value={metalGrams}
                    onChange={(e) => setMetalGrams(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>שווי משוער בשקלים (ILS):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d97706' }}>
                      {metalResult.ils} ₪
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>שווי משוער בדולרים (USD):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d97706' }}>
                      ${metalResult.usd}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'crypto' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: '#1e293b' }}>מחשבון המרת מטבעות קריפטו (שערים חיים)</h2>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>בחר מטבע קריפטו:</label>
                  <select
                    value={cryptoCoin}
                    onChange={(e) => setCryptoCoin(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', background: 'white' }}
                  >
                    {Object.entries(cryptoLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>כמות מטבעות:</label>
                  <input
                    type="number"
                    value={cryptoAmount}
                    onChange={(e) => setCryptoAmount(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>שווי משוער בשקלים (ILS):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                      {cryptoResult.ils} ₪
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>שווי משוער בדולרים (USD):</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                      ${cryptoResult.usd}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SEO Content Section */}
        <section style={{ marginTop: '40px', background: 'white', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#1e293b' }}>כלים מתקדמים לניהול עסק וקשרי מסחר בינלאומיים</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#475569', marginBottom: '15px' }}>
            עסקים, עצמאיים ויבואנים נדרשים יום-יום לבצע חישובים מהירים של שערי מטבע, המרות מידות בעבודה מול ספקים בחו"ל ומעקב אחרי מדדים פיננסיים. מרכז הכלים של ProFlow נועד לרכז עבורכם את כל הפעולות הללו במקום אחד, בצורה מדויקת ומהירה.
          </p>
        </section>

        {/* CTA Banner with ProFlow Logo on Dark Glassmorphic Card */}
        <div style={{ marginTop: '30px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', padding: '35px 20px', borderRadius: '16px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', padding: '10px 22px', borderRadius: '12px', marginBottom: '15px', border: '1px solid rgba(255, 255, 255, 0.25)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <ProFlowLogo />
          </div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', fontWeight: 'bold' }}>רוצה לנהל את העסק שלך ברמה הבאה?</h3>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, marginBottom: '20px' }}>הפק הצעות מחיר חכמות, נהל לקוחות ופתח את העסק לעולם עם ProFlow.</p>
          <a
            href="/"
            style={{ background: 'white', color: '#4f46e5', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
          >
            התחל עכשיו בחינם
          </a>
        </div>
      </main>
    </div>
  );
}

export default PublicTools;