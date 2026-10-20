// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: צמצום תפריט הניהול לשני כפתורים ומסך מרכזי ..." - the hub screen of "ניהול" /
// "מערכת": one card per tool of the hub that this account may open (the Owner sees all; a supervisor only what was granted). A card opens
// the tool inside the same Admin body. The inquiries card carries the waiting counter.
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { ADMIN_DESTINATIONS, ADMIN_HUBS, canOpenDestination } from './adminDestinations';
import './adminUsers.css';

function usePendingInquiries(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    try {
      Promise.resolve(supabase?.from?.('support_inbound_messages')?.select?.('id', { count: 'exact', head: true })?.in?.('status', ['waiting', 'draft']))
        .then((res) => { if (!cancelled && Number.isFinite(res?.count)) setCount(res.count); })
        .catch(() => {});
    } catch {
      // no counter
    }
    return () => { cancelled = true; };
  }, [enabled]);
  return count;
}

export default function AdminHub({ host, hubId }) {
  const isHebrew = host.isHebrew;
  const L = (x) => (isHebrew ? x.he : x.en);
  const tools = ADMIN_DESTINATIONS.filter((d) => d.hub === hubId && d.available && canOpenDestination(d, host.access));
  const pending = usePendingInquiries(tools.some((d) => d.id === 'inquiries'));
  const Arrow = isHebrew ? ArrowLeft : ArrowRight;
  return (
    <AdminScreenFrame title={L(ADMIN_HUBS[hubId])} subtitle={isHebrew ? 'בחרו כלי' : 'Choose a tool'} label={L(ADMIN_HUBS[hubId])} isHebrew={isHebrew}>
      <div className="admin-hub-grid" data-testid={`admin-hub-${hubId}`}>
        {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
        {tools.map((d) => {
          const Icon = d.icon;
          return (
            <button key={d.id} type="button" className="admin-hub-card" onClick={() => host.navigate(d.id)} data-testid={`admin-hub-card-${d.id}`}>
              <span className="admin-hub-icon" aria-hidden="true"><Icon size={22} strokeWidth={2} /></span>
              <span className="admin-hub-text">
                <strong>{L(d.label)}{d.id === 'inquiries' && pending > 0 && <span className="admin-count-pill" style={{ marginInlineStart: 8 }} data-testid="admin-hub-inquiries-count">{pending}</span>}</strong>
                <span>{L(d.description)}</span>
              </span>
              <Arrow size={18} aria-hidden="true" className="admin-hub-arrow" />
            </button>
          );
        })}
        {tools.length === 0 && <p className="admin-empty" role="status">{isHebrew ? 'אין כאן כלים שפתוחים לחשבון הזה.' : 'No tool here is open to this account.'}</p>}
      </div>
    </AdminScreenFrame>
  );
}
