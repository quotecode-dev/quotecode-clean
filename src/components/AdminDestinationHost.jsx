import { ADMIN_DESTINATIONS } from './adminDestinations';
import { DEFAULT_ADMIN_SECTION } from '../utils/adminNavGroups';

// The ONE Admin content host. Every registered destination renders here,
// inside the unified shell's content column - the Header, Sidebar and shell
// never change when a destination changes; only this body does. The host
// itself is only a flex column so the destination's AdminScreenFrame
// (.pf-screen) fills the space under the Header.
export default function AdminDestinationHost({ sectionId, host }) {
  const byId = (id) => ADMIN_DESTINATIONS.find((d) => d.id === id && d.available);
  const destination = byId(sectionId) || byId(DEFAULT_ADMIN_SECTION);
  if (!destination) return null;
  // UI hygiene only - real authorization is server-side (RLS / Edge role checks).
  if (destination.permission === 'super_admin' && !host.isSuperAdmin) return null;
  return (
    <div className="admin-destination-host" data-admin-destination={destination.id}>
      {destination.render(host)}
    </div>
  );
}
