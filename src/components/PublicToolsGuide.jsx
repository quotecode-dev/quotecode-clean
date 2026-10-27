// Owner console 2026-10-27, typed: "מאשר תוכנית א לדפי המחשבונים" - the tools hub shows the four calculators as cards (no calculator of
// its own, so it is no longer a copy of the currency page), and every calculator page carries its own guide. Texts:
// src/shared/publicToolsGuides.js (Hebrew for Israel, English for the international market - each written on its own).
import { ArrowLeftRight, Ruler, Gem, Bitcoin } from 'lucide-react';
import { TOOLS } from '../theme/toolsLightTheme';
import { HUB_CARDS, HUB_COPY, TOOL_GUIDES } from '../shared/publicToolsGuides';

const ICONS = { currency: ArrowLeftRight, units: Ruler, metals: Gem, crypto: Bitcoin };
const cardStyle = { background: TOOLS.bgCard, borderRadius: '12px', border: `1px solid ${TOOLS.border}`, boxShadow: TOOLS.cardShadow, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '8px' };

export function ToolHubCards({ lang, navigate }) {
  const t = HUB_COPY[lang];
  return (
    <section aria-labelledby="tools-hub-h2" data-testid="tools-hub-cards">
      <h2 id="tools-hub-h2" style={{ fontSize: '1.3rem', margin: '0 0 16px', color: TOOLS.textPrimary }}>{t.h2}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
        {HUB_CARDS[lang].map((c) => {
          const Icon = ICONS[c.key];
          const href = `/${lang}/tools/${c.key}`;
          return (
            <li key={c.key} style={cardStyle} data-testid={`tools-hub-card-${c.key}`}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: TOOLS.textPrimary }}>
                <Icon size={20} strokeWidth={2.2} aria-hidden="true" color={TOOLS.accent} />{c.title}
              </h3>
              <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: TOOLS.textSecondary, margin: 0, flex: 1 }}>{c.text}</p>
              {/* PRODUCT_TRUTH_DECORATIVE: link to one public calculator page of the same language */}
              <a href={href} data-testid={`tools-hub-open-${c.key}`} onClick={(e) => { e.preventDefault(); navigate(href); }}
                style={{ color: TOOLS.accent, fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>
                {t.open}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ToolGuide({ lang, tool }) {
  const g = TOOL_GUIDES[lang][tool];
  if (!g) return null;
  const p = { fontSize: '0.95rem', lineHeight: 1.7, color: TOOLS.textSecondary, margin: '0 0 12px' };
  const h3 = { fontSize: '1.05rem', margin: '18px 0 8px', color: TOOLS.textPrimary };
  return (
    <div data-testid={`tools-guide-${tool}`}>
      <h2 style={{ fontSize: '1.2rem', margin: '0 0 12px', color: TOOLS.textPrimary }}>{g.h2}</h2>
      <ol style={{ ...p, paddingInlineStart: '22px' }}>
        {g.steps.map((s) => <li key={s} style={{ marginBottom: '4px' }}>{s}</li>)}
      </ol>
      <h3 style={h3}>{g.example.h}</h3>
      <p style={p}>{g.example.p}</p>
      <p style={p}>{g.source}</p>
      {g.faq.map((f) => (
        <div key={f.q}>
          <h3 style={h3}>{f.q}</h3>
          <p style={p}>{f.a}</p>
        </div>
      ))}
    </div>
  );
}
