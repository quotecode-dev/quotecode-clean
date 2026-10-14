// Task 23 (Phase 5): the PUBLIC digital business card page /card/:id (no sign-in). Reads the card through the anonymous
// get-business-card function (only the whitelisted public fields) and renders the shared BusinessCard component in the card's own
// language/direction (account market). Until the card loads, and for every failure, the page uses the app shell's language.
// The page asks search engines not to index it (it carries a business's contact details) - same intent as the public quote pages.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import BusinessCard from '../components/BusinessCard';
import { shareOrCopy, copyText } from '../utils/businessCardShare';
import ProFlowLogo from '../components/ProFlowLogo';
import { businessCardShareUrl, fetchPublicBusinessCard } from '../utils/businessCardClient';

const COPY = {
  he: {
    loading: 'טוענים את כרטיס הביקור…',
    not_found: 'כרטיס הביקור לא נמצא. ייתכן שהקישור שגוי או שהעסק עדיין לא השלים את פרטיו.',
    not_deployed: 'כרטיסי ביקור דיגיטליים עדיין לא זמינים בשרת הזה.',
    service_unreachable: 'כרטיסי ביקור דיגיטליים עדיין לא זמינים בשרת הזה.',
    offline: 'אין חיבור לאינטרנט. התחברו ונסו שוב.',
    other: 'לא הצלחנו לטעון את כרטיס הביקור כרגע. נסו שוב מאוחר יותר.',
  },
  en: {
    loading: 'Loading the business card…',
    not_found: 'This business card was not found. The link may be wrong, or the business has not completed its details yet.',
    not_deployed: 'Digital business cards are not available on this server yet.',
    service_unreachable: 'Digital business cards are not available on this server yet.',
    offline: 'You are offline. Reconnect and try again.',
    other: 'We could not load this business card right now. Try again later.',
  },
};

function useNoIndex(title) {
  useEffect(() => {
    // the app shell already carries a robots meta (index, follow): override THAT tag while this page is shown, restore it on leave
    let meta = document.head.querySelector('meta[name="robots"]');
    const created = !meta;
    const previous = meta ? meta.getAttribute('content') : null;
    if (created) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => { if (created) meta.remove(); else meta.setAttribute('content', previous); };
  }, []);
  useEffect(() => { if (title) document.title = title; }, [title]);
}

export default function PublicBusinessCard({ bundleIsHebrew = true }) {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', card: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPublicBusinessCard(supabase, id).then((r) => { if (alive) setState({ status: r.status, card: r.card ?? null }); });
    return () => { alive = false; };
  }, [id]);

  const card = state.status === 'ok' ? state.card : null;
  const he = card ? card.language === 'he' : bundleIsHebrew;
  const t = COPY[he ? 'he' : 'en'];
  useNoIndex(card ? `${card.businessName} | TEKANGO` : 'TEKANGO');
  const shareUrl = businessCardShareUrl(id);
  const flashCopied = (result) => { if (result === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2000); } };

  return (
    <main dir={he ? 'rtl' : 'ltr'} lang={he ? 'he' : 'en'} data-testid="public-business-card-page"
      style={{ minHeight: '100vh', background: '#F1F5F9', padding: '24px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      {card ? (
        <BusinessCard card={card} shareUrl={shareUrl} copied={copied}
          onShare={async () => flashCopied(await shareOrCopy(shareUrl, card.businessName))}
          onCopy={async () => flashCopied(await copyText(shareUrl))} />
      ) : (
        <div role="status" data-testid="public-business-card-status" data-status={state.status}
          style={{ maxWidth: 420, width: '100%', boxSizing: 'border-box', background: '#ffffff', borderRadius: 16, padding: '22px 18px', textAlign: 'center', color: '#334155', fontSize: '0.95rem', lineHeight: 1.5, boxShadow: '0 10px 30px -12px rgba(15,23,42,.25)' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ProFlowLogo size={28} darkText /></div>
          {t[state.status] || t.other}
        </div>
      )}
    </main>
  );
}
