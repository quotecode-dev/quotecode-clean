// Task 16 cloud-fix4 (A14) - landing style availability (ledger L09, IRON-LANDING-001). Outside TEST every account
// resolves to the Classic presentation (supabase/functions/quote-presentation/lib.ts resolveTier -> 'classic';
// quoteStyles.js PRESENTATION_TIERS: the classic tier includes only 'classic'). Presentation tiers are NOT mapped to
// plans (COMMERCIAL_MAPPING_STATUS 'pending_owner_decision'), so the landing labels only Classic as available.
export const DEFAULT_SHOWCASE_STYLE = 'classic';
export const AVAILABLE_SHOWCASE_STYLES = Object.freeze(['classic']);
export const isShowcaseStyleAvailable = (id) => AVAILABLE_SHOWCASE_STYLES.includes(id);
