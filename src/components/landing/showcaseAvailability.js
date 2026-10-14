// Task 16 cloud-fix4 (A14) - landing style availability (ledger L09, IRON-LANDING-001). Owner console 2026-10-14: every account
// resolves to the full 'visual' tier (supabase/functions/quote-presentation/lib.ts resolveTier -> 'visual'; the visual tier includes
// classic, modern and visual), so the landing labels all three styles as available. It must match the deployed quote-presentation.
export const DEFAULT_SHOWCASE_STYLE = 'classic';
export const AVAILABLE_SHOWCASE_STYLES = Object.freeze(['classic', 'modern', 'visual']);
export const isShowcaseStyleAvailable = (id) => AVAILABLE_SHOWCASE_STYLES.includes(id);
