import { ADMIN_GROUPS, ADMIN_DESTINATIONS } from '../components/adminDestinations';

// Derived view of the ONE Admin destination registry
// (components/adminDestinations.js). Nothing is defined here: the nav groups,
// titles and valid section ids are all computed from the registry, so there
// is never a second Admin navigation definition to drift out of sync.
export const ADMIN_NAV_GROUPS = Object.keys(ADMIN_GROUPS)
  .map((groupId) => ({
    id: groupId,
    label: ADMIN_GROUPS[groupId],
    items: ADMIN_DESTINATIONS
      .filter((d) => d.group === groupId && d.available)
      .map(({ id, icon, label, mobile }) => ({ id, icon, label, mobile })),
  }))
  .filter((group) => group.items.length > 0);

export function getAdminDestinationTitle(sectionId, isHebrew) {
  const entry = ADMIN_DESTINATIONS.find((d) => d.id === sectionId);
  if (!entry) return isHebrew ? 'ממשק ניהול - סופר אדמין' : 'Admin Console - Super Admin';
  return isHebrew ? entry.title.he : entry.title.en;
}

// Valid ?section= ids and the one default destination. An unknown/invalid
// value in the URL falls back to DEFAULT_ADMIN_SECTION (fail safe).
export const ADMIN_SECTION_IDS = new Set(ADMIN_DESTINATIONS.filter((d) => d.available).map((d) => d.id));
export const DEFAULT_ADMIN_SECTION = 'overview';
