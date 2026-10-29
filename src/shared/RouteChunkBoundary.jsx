// Codex release 3 step 2 (Owner 2026-10-29, typed: "מאשר שחרור 3 של קודקס: נגישות המספרים, פיצול הקוד ותמונת הפתיחה, כולל שינוי ב-L-02,
// L-15, בלי שינוי באנימציה ובמראה"): the workspace and the other heavy screens load on demand (React.lazy in the two market shells), so a
// landing page no longer downloads the Dashboard, the admin, the AI logs or the public quote renderers. While a screen loads: one quiet
// localized line; when its file cannot be loaded (a new release replaced it, the network dropped): a clear message and a retry that
// reloads the page.
import { Component, Suspense } from 'react';

const COPY = {
  he: { loading: 'העמוד נטען…', failed: 'לא הצלחנו לטעון את העמוד. אפשר לנסות שוב.', retry: 'ניסיון נוסף' },
  en: { loading: 'Loading page…', failed: 'We couldn’t load this page. Please try again.', retry: 'Try again' },
};
const box = { minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
  fontFamily: 'Rubik, system-ui, sans-serif', color: '#475569', padding: 24, textAlign: 'center' };

class ChunkErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('route chunk failed to load:', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    const t = this.props.copy;
    return (
      <div role="alert" style={box} data-testid="route-chunk-failed">
        <p style={{ margin: 0, fontSize: '1rem' }}>{t.failed}</p>
        {/* PRODUCT_TRUTH_DECORATIVE: reloads the page so the screen's file is fetched again */}
        <button type="button" onClick={() => window.location.reload()}
          style={{ font: 'inherit', fontWeight: 600, padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
          {t.retry}
        </button>
      </div>
    );
  }
}

export default function RouteChunkBoundary({ isHebrew, children }) {
  const copy = isHebrew ? COPY.he : COPY.en;
  return (
    <ChunkErrorBoundary copy={copy}>
      <Suspense fallback={<div role="status" style={box} data-testid="route-chunk-loading">{copy.loading}</div>}>
        {children}
      </Suspense>
    </ChunkErrorBoundary>
  );
}
