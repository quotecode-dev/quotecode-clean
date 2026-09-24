import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import NotFound from '../pages/NotFound';
import { LIGHT as NEON, FONT_HE } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { matchAttachmentCompatPath, resolveAttachmentCompatOpen } from '../utils/attachmentCompatPath';

// MD-2 (First-LIVE cutover compatibility, 2026-09-25) - see src/utils/attachmentCompatPath.js for why this path shape reaches the app.
// The shells' wildcard route renders this: an attachment-shaped path opens the attachment; every other unknown path is the unchanged
// NotFound view. Authorization, in order (the first two before any network call):
//   1. the path matches exactly the storage-path shape the save flow writes (matchAttachmentCompatPath);
//   2. a signed-in session exists, and its user id IS the owner folder in the path (else refused - never a cross-tenant attempt);
//   3. a quote_attachments row with exactly this storage_path is visible to the user - RLS "Owners can manage quote attachments"
//      (quote owner only) is the server-side tenant boundary, with the bucket still public (before the migration) or private (after);
//   4. the object is signed under the user's own JWT (after the migration, storage RLS "Owners read own quote files" enforces it again);
//   5. the browser follows the signed URL only if it is this project's signed-object URL for this object (no open redirect).
// No public URL is ever built, and nothing is cached or logged. The decision logic is resolveAttachmentCompatOpen (attachmentCompatPath.js).

const TEXT = {
  working: { he: 'פותחים את הקובץ…', en: 'Opening the file…' },
  signin: { he: 'כדי לפתוח את הקובץ יש להתחבר לחשבון שהעלה אותו.', en: 'Sign in to the account that uploaded this file to open it.' },
  unavailable: { he: 'הקובץ אינו זמין. אפשר לפתוח אותו מתוך ההצעה בלוח הבקרה.', en: 'This file is not available. You can open it from the quote in your dashboard.' },
  error: { he: 'לא ניתן לפתוח את הקובץ כרגע. נסו שוב מתוך לוח הבקרה.', en: 'The file cannot be opened right now. Please try again from your dashboard.' },
  dashboard: { he: 'מעבר ללוח הבקרה', en: 'Go to the dashboard' },
};

// replace(): the compatibility URL is not kept in history, so Back returns to where the user came from.
const replaceLocation = (url) => window.location.replace(url);

export function AttachmentCompatOpen({ isHebrew, match, client = supabase, supabaseUrl = import.meta.env.VITE_SUPABASE_URL, navigate = replaceLocation }) {
  const [state, setState] = useState('working');
  const { ownerId, quoteId, storagePath } = match;
  useEffect(() => {
    setSeoMeta({ title: 'TEKANGO', noindex: true, lang: isHebrew ? 'he' : 'en' });
  }, [isHebrew]);
  useEffect(() => {
    let live = true;
    resolveAttachmentCompatOpen({ client, match: { ownerId, quoteId, storagePath }, supabaseUrl })
      .catch(() => ({ state: 'error' }))
      .then((r) => {
        if (!live) return;
        if (r.state === 'redirect') navigate(r.url);
        else setState(r.state);
      });
    return () => { live = false; };
  }, [client, ownerId, quoteId, storagePath, supabaseUrl, navigate]);

  const lang = isHebrew ? 'he' : 'en';
  return (
    <div
      data-testid="attachment-compat-open"
      data-state={state}
      dir={isHebrew ? 'rtl' : 'ltr'}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px', textAlign: 'center', background: NEON.bg || '#faf9fd', fontFamily: isHebrew ? FONT_HE : 'inherit' }}
    >
      <p role="status" style={{ fontSize: '1.1rem', color: NEON.textSecondary, margin: 0, maxWidth: '480px' }}>{TEXT[state][lang]}</p>
      {/* PRODUCT_TRUTH_DECORATIVE: returns from the attachment-compatibility status view (MD-2 stale-tab file link) to the dashboard - navigation chrome, not a registry capability */}
      {state !== 'working' && (
        <Link to="/dashboard" style={{ background: NEON.violet || '#7c3aed', color: '#fff', borderRadius: '10px', padding: '12px 20px', fontWeight: 700, textDecoration: 'none' }}>
          {TEXT.dashboard[lang]}
        </Link>
      )}
    </div>
  );
}

export default function AttachmentCompatRoute({ isHebrew }) {
  const { pathname } = useLocation();
  const match = matchAttachmentCompatPath(pathname);
  if (!match) return <NotFound isHebrew={isHebrew} />;
  return <AttachmentCompatOpen key={match.storagePath} isHebrew={isHebrew} match={match} />;
}
