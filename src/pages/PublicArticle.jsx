// Owner console 2026-10-26 (SEO week 2, the night task): the public guides - /he|en/articles (the index) and /he|en/articles/<slug>
// (one article). Content: src/shared/publicArticles.js; title / description / canonical / hreflang: src/shared/publicSeoRoutes.js.
// The same light look as the public tools page (TOOLS tokens); Hebrew pages RTL, English pages LTR.
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProFlowLogo from '../components/ProFlowLogo';
import { FONT_HE, FONT_EN } from '../theme/neonTheme';
import { TOOLS } from '../theme/toolsLightTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import { ARTICLES, ARTICLE_SLUGS, ARTICLES_INDEX } from '../shared/publicArticles';
import NotFound from './NotFound';

const COPY = {
  he: { home: 'חזרה לדף הבית', guides: 'כל המדריכים', related: 'עוד בנושא', ctaTitle: 'מוכנים לשלוח את ההצעה הבאה?', ctaText: 'הפקת הצעות מחיר, ניהול לקוחות וחתימה דיגיטלית של הלקוח — הכול ב־TEKANGO.', cta: 'פתיחת חשבון', read: 'לקריאת המדריך' },
  en: { home: 'Back to home', guides: 'All guides', related: 'Related', ctaTitle: 'Ready to send your next quote?', ctaText: 'Quotes, client management and the client\'s digital signature - all in TEKANGO.', cta: 'Create an account', read: 'Read the guide' },
};

const linkStyle = { color: TOOLS.accent, fontSize: '0.95rem', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: '44px' };

function Shell({ lang, children }) {
  const navigate = useNavigate();
  const t = COPY[lang];
  const go = (href) => (e) => { e.preventDefault(); navigate(href); };
  return (
    <div style={{ minHeight: '100vh', display: 'flow-root', background: TOOLS.bg, color: TOOLS.textPrimary, fontFamily: lang === 'he' ? FONT_HE : FONT_EN }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <header style={{ padding: '12px 16px 0', display: 'flex', flexWrap: 'wrap', gap: '4px 20px', alignItems: 'center' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: navigation link back to the landing page of the same language */}
        <a href={`/${lang}`} data-testid="article-home" onClick={go(`/${lang}`)} style={linkStyle}>{t.home}</a>
        {/* PRODUCT_TRUTH_DECORATIVE: navigation link to the guides index of the same language */}
        <a href={`/${lang}/articles`} data-testid="article-guides" onClick={go(`/${lang}/articles`)} style={linkStyle}>{t.guides}</a>
      </header>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 8px' }}><ProFlowLogo size={30} darkText /></div>
      {children}
      <div style={{ maxWidth: '760px', margin: '0 auto 48px', padding: '0 16px', boxSizing: 'border-box' }}>
        <div style={{ background: TOOLS.accentSoft, padding: '32px 20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${TOOLS.border}` }}>
          <h2 style={{ fontSize: '1.35rem', margin: '0 0 10px', fontWeight: 700, color: TOOLS.textPrimary }}>{t.ctaTitle}</h2>
          <p style={{ fontSize: '0.95rem', color: '#3f4d54', margin: '0 0 20px' }}>{t.ctaText}</p>
          {/* PRODUCT_TRUTH_DECORATIVE: marketing CTA opening the account-creation screen (the landing signup path); not itself a distinct product capability */}
          <button
            type="button"
            data-testid="article-cta"
            onClick={() => navigate(`/dashboard?signup=true&lang=${lang}`)}
            style={{ background: TOOLS.accent, color: '#ffffff', padding: '11px 22px', minHeight: '46px', borderRadius: '7px', fontWeight: 600, fontSize: '16px', border: `1px solid ${TOOLS.accent}`, cursor: 'pointer' }}
          >
            {t.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

const h1Style = { fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', lineHeight: 1.3, margin: '0 0 12px', fontWeight: 700, color: TOOLS.textPrimary };
const introStyle = { fontSize: '1.08rem', lineHeight: 1.75, color: TOOLS.textSecondary, margin: 0 };
const bodyStyle = { fontSize: '1.02rem', lineHeight: 1.8, color: TOOLS.textPrimary, margin: '0 0 12px' };

export function PublicArticle({ lang, slug: slugProp }) {
  const navigate = useNavigate();
  const params = useParams();
  const slug = slugProp || params.slug;
  const article = ARTICLES[slug]?.[lang] || null;
  const t = COPY[lang];

  useEffect(() => {
    if (article) setSeoMeta(publicSeo(`/${lang}/articles/${slug}`));
  }, [article, lang, slug]);

  if (!article) return <NotFound isHebrew={lang === 'he'} />;
  return (
    <Shell lang={lang}>
      <main style={{ maxWidth: '760px', margin: '0 auto 32px', padding: '0 16px', boxSizing: 'border-box' }}>
        <article>
          <h1 style={h1Style}>{article.h1}</h1>
          <p style={introStyle}>{article.intro}</p>
          {article.sections.map((sec) => (
            <section key={sec.h} style={{ marginTop: '28px' }}>
              <h2 style={{ fontSize: '1.3rem', margin: '0 0 10px', fontWeight: 700, color: TOOLS.textPrimary }}>{sec.h}</h2>
              {(sec.p || []).map((para) => <p key={para} style={bodyStyle}>{para}</p>)}
              {sec.list && (
                <ul style={{ margin: '0 0 12px', paddingInlineStart: '22px' }}>
                  {sec.list.map((li) => <li key={li} style={{ ...bodyStyle, margin: '0 0 6px' }}>{li}</li>)}
                </ul>
              )}
            </section>
          ))}
        </article>
        <aside style={{ marginTop: '32px', background: TOOLS.bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${TOOLS.border}` }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 8px', color: TOOLS.textPrimary }}>{t.related}</h2>
          <ul style={{ margin: 0, paddingInlineStart: '22px' }}>
            {article.related.map((r) => (
              <li key={r.href}>
                {/* PRODUCT_TRUTH_DECORATIVE: link to a related public guide or public tool page */}
                <a href={r.href} onClick={(e) => { e.preventDefault(); navigate(r.href); }} style={linkStyle}>{r.label}</a>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </Shell>
  );
}

export function PublicArticlesIndex({ lang }) {
  const navigate = useNavigate();
  const index = ARTICLES_INDEX[lang];
  const t = COPY[lang];

  useEffect(() => {
    setSeoMeta(publicSeo(`/${lang}/articles`));
  }, [lang]);

  return (
    <Shell lang={lang}>
      <main style={{ maxWidth: '760px', margin: '0 auto 32px', padding: '0 16px', boxSizing: 'border-box' }}>
        <h1 style={h1Style}>{index.h1}</h1>
        <p style={introStyle}>{index.intro}</p>
        <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, display: 'grid', gap: '14px' }}>
          {ARTICLE_SLUGS.map((slug) => {
            const a = ARTICLES[slug][lang];
            const href = `/${lang}/articles/${slug}`;
            return (
              <li key={slug} style={{ background: TOOLS.bgCard, padding: '18px 20px', borderRadius: '12px', border: `1px solid ${TOOLS.border}` }}>
                <h2 style={{ fontSize: '1.2rem', margin: '0 0 6px', fontWeight: 700 }}>
                  {/* PRODUCT_TRUTH_DECORATIVE: link to one public guide */}
                  <a href={href} data-testid={`article-link-${slug}`} onClick={(e) => { e.preventDefault(); navigate(href); }} style={{ color: TOOLS.textPrimary, textDecoration: 'none' }}>{a.h1}</a>
                </h2>
                <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: TOOLS.textSecondary, margin: '0 0 4px' }}>{a.description}</p>
                {/* PRODUCT_TRUTH_DECORATIVE: link to one public guide */}
                <a href={href} aria-hidden="true" tabIndex={-1} onClick={(e) => { e.preventDefault(); navigate(href); }} style={linkStyle}>{t.read}</a>
              </li>
            );
          })}
        </ul>
      </main>
    </Shell>
  );
}
