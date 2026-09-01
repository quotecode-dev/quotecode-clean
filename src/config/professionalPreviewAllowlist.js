// David Aluminum Professional Quote Preview - access gate.
//
// This is a deliberate, temporary, single-account allowlist for an
// Owner-authorized demonstration (not a general feature flag system).
// Scoped by real Supabase auth user id, not email, since a user id cannot be
// spoofed by re-registering with a similar address.
//
// To remove access entirely: delete the id from this array (or delete this
// file and its two call sites) - no DB change, no migration, no schema
// rollback required. This never affects any other account.

export const PROFESSIONAL_PREVIEW_USER_IDS = [
  '17388fe5-a780-4e93-bfec-6a538788ac83', // David Aluminum (דוד אלומיניום)
];

export function isProfessionalPreviewEnabled(userId) {
  return Boolean(userId) && PROFESSIONAL_PREVIEW_USER_IDS.includes(userId);
}
