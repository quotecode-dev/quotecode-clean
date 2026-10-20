import { ADMIN_DESTINATIONS, canOpenDestination } from './adminDestinations';
import { DEFAULT_ADMIN_SECTION } from '../utils/adminNavGroups';

// The ONE Admin content host. Every registered destination renders here,
// inside the unified shell's content column - the Header, Sidebar and shell
// never change when a destination changes; only this body does. The host
// itself is only a flex column so the destination's AdminScreenFrame
// (.pf-screen) fills the space under the Header.
// The way back from a tool to its hub is the shell's one "חזרה" button (it names the previous screen) - no second back link here.
export default function AdminDestinationHost({ sectionId, host }) {
  const byId = (id) => ADMIN_DESTINATIONS.find((d) => d.id === id && d.available);
  const destination = byId(sectionId) || byId(DEFAULT_ADMIN_SECTION);
  if (!destination) return null;
  // UI hygiene only - real authorization is server-side (RLS / Edge role checks / has_admin_permission()).
  // Owner console 2026-10-20 (L-22): the Owner opens everything; a supervisor only the destinations granted.
  if (!canOpenDestination(destination, host.access)) return null;
  return (
    <div className="admin-destination-host" data-admin-destination={destination.id}>
      {destination.render(host)}
    </div>
  );
}
