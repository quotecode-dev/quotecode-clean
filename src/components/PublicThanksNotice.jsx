// Task 27 (P2, spec §6): the owner's optional thank-you, shown on the public quote ONLY after the server confirmed the signature
// (get-public-quote returns `thanks` only for a signed quote). Plain text (never HTML) and, when the owner opted in, a normal https link
// the customer may choose to open - no redirect, no automatic navigation.
const WEBSITE_RE = /^https:\/\/[^\s<>"]+$/;

export default function PublicThanksNotice({ thanks, isHebrew }) {
  if (!thanks || typeof thanks !== 'object') return null;
  const text = typeof thanks.text === 'string' && thanks.text.trim() ? thanks.text.trim() : null;
  const url = typeof thanks.website_url === 'string' && WEBSITE_RE.test(thanks.website_url) ? thanks.website_url : null;
  if (!text && !url) return null;
  return (
    <div className="pq-app-notice pq-thanks no-print" data-html2canvas-ignore="true" role="note" data-testid="pq-thanks" dir={isHebrew ? 'rtl' : 'ltr'}
      style={{ textAlign: 'start', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#14532d' }}>
      {text && <div style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{text}</div>}
      {url && (
        <div style={{ marginTop: text ? '8px' : 0 }}>
          {/* PRODUCT_TRUTH_DECORATIVE: a plain outbound link to the owner's opt-in website; opens only on the customer's own click, no redirect */}
          <a href={url} target="_blank" rel="noopener noreferrer" data-testid="pq-thanks-website" style={{ color: '#166534', fontWeight: 700 }}>
            {isHebrew ? 'לאתר העסק' : 'Visit our website'}
          </a>
        </div>
      )}
    </div>
  );
}
