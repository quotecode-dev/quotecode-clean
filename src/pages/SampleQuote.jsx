import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';
import { buildSampleQuote, parseSampleQuery } from '../quoteDocument/sampleQuotes';

// Task 16 - Quote Experience V2: /he/sample-quote and /en/sample-quote (no auth, noindex). Renders the REAL
// PublicQuote / PublicQuoteEn in previewMode (no approve, no signature pad, no network) with the synthetic fixtures of
// src/quoteDocument/sampleQuotes.js, whose totals are computed from their rows by the app's own save rules.
// Query: ?style=classic|modern|visual&length=short|long&detail=compact|expanded&images=0|1
// `standalonePrint`: this route is the whole page, so the browser's native Print uses the public quote's A4 print contract
// (the sample toolbar is .no-print) - the same printed document as /quote/:id, not the screen layout on paper.
const COPY = {
  he: {
    title: 'TEKANGO - דוגמת הצעת מחיר',
    label: 'הצעת מחיר לדוגמה · נתונים לדוגמה',
    style: 'סגנון',
    length: 'אורך',
    short: 'קצרה',
    long: 'ארוכה',
    detail: 'פירוט',
    compact: 'מקוצר',
    expanded: 'מורחב',
    images: 'תמונות',
    withImages: 'עם',
    withoutImages: 'בלי',
  },
  en: {
    title: 'TEKANGO - Sample quote',
    label: 'Sample quote · synthetic data',
    style: 'Style',
    length: 'Length',
    short: 'Short',
    long: 'Long',
    detail: 'Detail',
    compact: 'Compact',
    expanded: 'Expanded',
    images: 'Images',
    withImages: 'On',
    withoutImages: 'Off',
  },
};

function queryString(opts) {
  const q = new URLSearchParams({ style: opts.style, length: opts.length, detail: opts.detail, images: opts.images ? '1' : '0' });
  return `?${q.toString()}`;
}

export default function SampleQuote({ locale = 'he' }) {
  const isHebrew = locale !== 'en';
  const t = isHebrew ? COPY.he : COPY.en;
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const opts = useMemo(() => parseSampleQuery(search), [search]);
  const sample = useMemo(() => buildSampleQuote({ locale: isHebrew ? 'he' : 'en', ...opts }), [isHebrew, opts]);

  useEffect(() => {
    document.title = t.title;
    // A synthetic sample is never indexable.
    let robotsTag = document.querySelector('meta[name="robots"]');
    if (!robotsTag) {
      robotsTag = document.createElement('meta');
      robotsTag.name = 'robots';
      document.head.appendChild(robotsTag);
    }
    robotsTag.setAttribute('content', 'noindex, nofollow');
    document.documentElement.lang = isHebrew ? 'he' : 'en';
    document.documentElement.dir = isHebrew ? 'rtl' : 'ltr';
  }, [isHebrew, t.title]);

  const groups = [
    { key: 'style', label: t.style, options: [['classic', 'Classic'], ['modern', 'Modern'], ['visual', 'Visual']] },
    { key: 'length', label: t.length, options: [['short', t.short], ['long', t.long]] },
    { key: 'detail', label: t.detail, options: [['compact', t.compact], ['expanded', t.expanded]] },
    { key: 'images', label: t.images, options: [[true, t.withImages], [false, t.withoutImages]] },
  ];

  const Page = isHebrew ? PublicQuote : PublicQuoteEn;

  return (
    <div className="pq-sample" dir={isHebrew ? 'rtl' : 'ltr'} style={{ background: '#eef1f2', minHeight: '100vh', color: '#18212B' }}>
      <nav className="no-print" aria-label={t.label} data-testid="pq-sample-controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 18px', padding: '12px 16px', background: '#FFFFFF', borderBottom: '1px solid #DFE4E8', fontSize: '14px' }}>
        <strong style={{ fontWeight: 600 }}>{t.label}</strong>
        {groups.map((g) => (
          <span key={g.key} style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#5F6B76' }}>{g.label}:</span>
            {g.options.map(([value, label]) => {
              const active = opts[g.key] === value;
              return (
                // PRODUCT_TRUTH_DECORATIVE: switches the synthetic sample quote's presentation option (style / length / detail / images)
                <Link
                  key={String(value)}
                  to={queryString({ ...opts, [g.key]: value })}
                  aria-current={active ? 'true' : undefined}
                  style={{ padding: '4px 10px', borderRadius: '999px', border: `1px solid ${active ? '#315F6F' : '#CBD5E1'}`, background: active ? '#315F6F' : '#FFFFFF', color: active ? '#FFFFFF' : '#2B3640', textDecoration: 'none', fontSize: '13px', lineHeight: 1.4 }}
                >
                  {label}
                </Link>
              );
            })}
          </span>
        ))}
      </nav>
      <Page
        key={`${sample.style}-${sample.length}`}
        quoteData={sample.quoteData}
        presentation={sample.presentation}
        previewMode
        standalonePrint
        detail={sample.detail}
      />
    </div>
  );
}
