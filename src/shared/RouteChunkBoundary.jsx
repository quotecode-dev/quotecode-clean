// Codex release 3 step 2 (Owner 2026-10-29, typed: "מאשר שחרור 3 של קודקס: נגישות המספרים, פיצול הקוד ותמונת הפתיחה, כולל שינוי ב-L-02,
// L-15, בלי שינוי באנימציה ובמראה"): the workspace and the other heavy screens load on demand (React.lazy in the two market shells), so a
// landing page no longer downloads the Dashboard, the admin, the AI logs or the public quote renderers. While a screen loads: one quiet
// localized line; when its file cannot be loaded (a new release replaced it, the network dropped): a clear message and a retry that
// reloads the page.
import { Component, Suspense } from 'react';
import { flushAllDrafts } from '../utils/quoteDraft';

// Owner 2026-11-02 (typed: "מאשר תיקון שירה, מע"מ של עוסק פטור כולל שינוי ב-L-22, רענון אוטומטי פעם אחת במסך הטעינה כולל שינוי ב-L-02 ו-L-15, ותיקון 30527 בפיי פלוס, שחרור עד הלייב"):
// a page left open across a release asks for a file that no longer exists. The screen has already failed, so the page reloads itself once
// (drafts saved first). Only for a file that did not load, only online; a second failure within a minute keeps the message and the retry.
const RELOAD_KEY = 'tekango-chunk-reload-at';
const RELOAD_WINDOW_MS = 60000;
const CHUNK_ERROR = /dynamically imported module|importing a module script failed|unable to preload css/i;
function reloadOnce(error) {
  if (!CHUNK_ERROR.test(String(error?.message ?? '')) || window.navigator.onLine === false) return;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return;
    // Owner console 2026-11-02 (typed: "מאשר את התוכנית ל-R09, R10, R18 ו-R19, כולל שינוי ב-L-22, L-02, L-15 ו-L-12, שחרור עד הלייב"), Codex R18: a draft that could not be kept stays on the page; the message and the retry remain
    if (!flushAllDrafts()) return;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { return; }
  window.location.reload();
}

const COPY = {
  he: { loading: 'העמוד נטען…', failed: 'לא הצלחנו לטעון את העמוד. אפשר לנסות שוב.', retry: 'ניסיון נוסף' },
  en: { loading: 'Loading page…', failed: 'We couldn’t load this page. Please try again.', retry: 'Try again' },
};
const box = { minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
  fontFamily: 'Rubik, system-ui, sans-serif', color: '#475569', padding: 24, textAlign: 'center' };

class ChunkErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('route chunk failed to load:', error); reloadOnce(error); }
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
