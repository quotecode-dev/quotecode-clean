// AI HELP CONTEXT V4 - server side (AI-HELP-AVAILABILITY-001). The browser's help context is a bounded HINT; this module re-derives
// what the server can know authoritatively for the verified user and reconciles every blocker the browser reported:
//   confirmed          the server independently verified the blocker condition (profile fields, monthly limit, entitlement, admin role, trial)
//   client_reported    a local UI state the server cannot observe (validation, local draft, network, save stage) - usable, labelled as such
//   contradicted       the server's own data says the condition is FALSE - the blocker is dropped (a forged/stale client claim never wins)
// Nothing here mutates data. Identity/tenant come only from the verified JWT user; every read is scoped to that user id.
import { sanitizeHelpContext, explainBlocker, explainProvenance, allowedNavigation, BLOCKER_CATALOG } from "../_shared/aiHelpContract.js";
import type { VerifiedAccountContext } from "./accountContext.ts";

export type HelpContext = ReturnType<typeof sanitizeHelpContext>;

export type ServerAccountRow = { phone?: string | null; tax_id?: string | null; country?: string | null; role?: string | null };

export type TrustedServerFacts = {
  market: 'Local' | 'International' | 'Unknown';
  tier: 'free' | 'basic' | 'pro';
  trialStatus: string;
  isAdmin: boolean;
  profile: { phoneComplete: boolean; taxIdComplete: boolean; taxIdRequired: boolean; missingFields: string[] };
  monthlyQuotes: { used: number | null; limit: number | 'unlimited' };
  attachmentsEntitled: boolean;
};

const LIMITS: Record<string, number | 'unlimited'> = { free: 5, basic: 20, pro: 'unlimited' };

export function hasMeaningfulPhone(phone: unknown): boolean {
  const t = String(phone ?? '').trim();
  if (!t) return false;
  return t.replace(/^\+\d+\s*/, '').trim() !== '';
}

export function deriveTrustedFacts(account: VerifiedAccountContext, row: ServerAccountRow | null, monthlyUsed: number | null): TrustedServerFacts {
  const isLocal = account.market === 'Local';
  const phoneComplete = hasMeaningfulPhone(row?.phone);
  const taxIdComplete = String(row?.tax_id ?? '').trim() !== '';
  const missing: string[] = [];
  if (!phoneComplete) missing.push('business_phone');
  if (isLocal && !taxIdComplete) missing.push('business_tax_id');
  if (account.market === 'Unknown') missing.push('business_region');
  const isAdmin = row?.role === 'super_admin';
  return {
    market: account.market,
    tier: account.tier,
    trialStatus: account.trialStatus,
    isAdmin,
    profile: { phoneComplete, taxIdComplete, taxIdRequired: isLocal, missingFields: missing },
    monthlyQuotes: { used: monthlyUsed, limit: account.isLifetime || isAdmin ? 'unlimited' : LIMITS[account.tier] ?? 5 },
    attachmentsEntitled: account.tier === 'pro' || account.isLifetime || isAdmin,
  };
}

// Start of the current month in the market's product zone (Local Asia/Jerusalem, else UTC) as an ISO instant.
export function monthStartIso(market: string, now = new Date()): string {
  const tz = market === 'Local' ? 'Asia/Jerusalem' : 'UTC';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(now).map((x) => [x.type, x.value]));
  // midnight of day 1 in that zone. The zone offset is read from formatToParts (never from the runtime's own local zone), and
  // re-read at the result so a DST change between the guess and the answer cannot shift it.
  const offsetAt = (ms: number) => {
    const q = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(q.year), Number(q.month) - 1, Number(q.day), Number(q.hour), Number(q.minute), Number(q.second)) - ms;
  };
  const guess = Date.UTC(Number(p.year), Number(p.month) - 1, 1);
  let start = guess - offsetAt(guess);
  start = guess - offsetAt(start);
  return new Date(start).toISOString();
}

export type ReconciledBlocker = NonNullable<HelpContext>['blockers'][number] & { confirmation: 'confirmed' | 'client_reported' | 'contradicted' };

export function reconcileBlockers(ctx: HelpContext, facts: TrustedServerFacts | null): { active: ReconciledBlocker[]; dropped: ReconciledBlocker[] } {
  const active: ReconciledBlocker[] = []; const dropped: ReconciledBlocker[] = [];
  for (const b of ctx?.blockers || []) {
    let confirmation: ReconciledBlocker['confirmation'] = 'client_reported';
    if (facts) {
      switch (b.code) {
        case 'PROFILE_MISSING_PHONE': confirmation = facts.profile.phoneComplete ? 'contradicted' : 'confirmed'; break;
        case 'PROFILE_MISSING_TAX_ID': confirmation = !facts.profile.taxIdRequired || facts.profile.taxIdComplete ? 'contradicted' : 'confirmed'; break;
        case 'REGION_NOT_SELECTED': confirmation = facts.market === 'Unknown' ? 'confirmed' : 'contradicted'; break;
        case 'MONTHLY_QUOTE_LIMIT_REACHED':
          confirmation = facts.monthlyQuotes.limit === 'unlimited' ? 'contradicted'
            : facts.monthlyQuotes.used === null ? 'client_reported'
              : facts.monthlyQuotes.used >= facts.monthlyQuotes.limit ? 'confirmed' : 'client_reported';
          break;
        case 'ATTACHMENTS_REQUIRE_PRO': case 'WHATSAPP_REQUIRES_PRO': confirmation = facts.attachmentsEntitled ? 'contradicted' : 'confirmed'; break;
        case 'TRIAL_EXPIRED': confirmation = facts.trialStatus === 'expired' ? 'confirmed' : 'contradicted'; break;
        case 'ADMIN_PROTECTED_ACTION': confirmation = facts.isAdmin ? 'client_reported' : 'contradicted'; break;
        case 'ADMIN_NOT_AUTHORIZED': confirmation = facts.isAdmin ? 'contradicted' : 'confirmed'; break;
        case 'CHECKOUT_UNAVAILABLE': case 'INVOICING_UNAVAILABLE': confirmation = 'confirmed'; break;
        default: confirmation = 'client_reported';
      }
    }
    const r = { ...b, confirmation } as ReconciledBlocker;
    if (confirmation === 'contradicted' || b.stale) dropped.push(r); else active.push(r);
  }
  return { active, dropped };
}

// Server-derived prerequisites that apply to the current screen even before the user hits the block (e.g. New Quote + missing phone).
export function serverPrerequisites(ctx: HelpContext, facts: TrustedServerFacts | null): string[] {
  if (!ctx || !facts) return [];
  const creating = ctx.screen === 'quote_editor_new' || ctx.screen === 'item_wizard' || ctx.screen === 'settings' || ctx.screen === 'dashboard' || ctx.screen === 'quote_history';
  return creating ? facts.profile.missingFields : [];
}

// ---------------------------------------------------------------------------------------------- deterministic help intents
const WHY_EN = /(\bwhy\b|what('?s| is) (missing|wrong|blocking)|what do i need|how (do|can) i (fix|solve|continue|proceed)|(can'?t|cannot|won'?t|unable to|not able to|isn'?t working|doesn'?t work|failed|blocked|disabled|greyed|grayed))/i;
const WHY_HE = /(למה|מדוע|מה חסר|מה הבעיה|לא מצליח|לא מצליחה|לא נשמר|לא נשמרת|לא עובד|נחסם|חסום|שגיאה|נכשל|נכשלה|איך (אני )?מתקנ|איך ממשיכ|מה לעשות)/;
const SAVED_EN = /(\bis (it|this|my (quote|draft|work)) saved\b|\bdid (it|this) save\b|\bwas (it|this|my (quote|draft)) saved\b|saved (in|to) the (cloud|server)|will i lose|is (my|this) draft (saved|safe)|where is (my|this) draft)/i;
const SAVED_HE = /(זה נשמר|האם נשמר|נשמרה?\b|שמור בענן|שמור בשרת|אאבד|יאבד|הטיוטה שמורה|איפה הטיוטה)/;

export type HelpIntent = 'why_blocked' | 'save_status' | null;
export function classifyHelpIntent(message: unknown): HelpIntent {
  const t = String(message ?? '').trim();
  if (!t) return null;
  if (SAVED_EN.test(t) || SAVED_HE.test(t)) return 'save_status';
  if (WHY_EN.test(t) || WHY_HE.test(t)) return 'why_blocked';
  return null;
}

export type DeterministicHelp = { answer: string; navigation: { action: string; focus: string | null } | null; blockerCodes: string[] };

const FOCUS: Record<string, string> = { open_business_phone: 'business_phone', open_business_tax_id: 'business_tax_id', open_business_details: 'business_details' };

export function deterministicHelpAnswer(intent: HelpIntent, ctx: HelpContext, active: ReconciledBlocker[], facts: TrustedServerFacts | null, isHebrew: boolean, hasSelectedQuote: boolean): DeterministicHelp | null {
  if (!ctx || !intent) return null;
  const lang = isHebrew ? 'he' : 'en';
  if (intent === 'save_status') {
    const prov = ctx.object?.provenance ?? 'NONE';
    if (prov === 'NONE' && !ctx.draft) return null;
    return { answer: explainProvenance(prov, lang, ctx.draft), navigation: null, blockerCodes: [] };
  }
  // why_blocked: only when there is a real, non-stale blocker (or a server prerequisite on a creation screen)
  const blockers = active.slice(0, 3);
  const prereq = serverPrerequisites(ctx, facts).filter((f) => f !== 'business_region');
  if (!blockers.length && !prereq.length) return null;
  const parts = blockers.map((b) => explainBlocker(b, lang));
  if (!blockers.length && prereq.length) {
    const code = prereq.includes('business_phone') ? 'PROFILE_MISSING_PHONE' : 'PROFILE_MISSING_TAX_ID';
    parts.push(explainBlocker({ ...BLOCKER_CATALOG[code], code, fieldCodes: prereq, persistence: 'not_attempted', resolution: [...BLOCKER_CATALOG[code].resolution] }, lang));
  }
  const allowed = allowedNavigation({ ctx: { ...ctx, blockers: blockers.length ? blockers : [{ resolution: prereq.includes('business_phone') ? ['open_business_phone'] : ['open_business_tax_id'] }] }, isAdmin: !!facts?.isAdmin, hasSelectedQuote });
  const first = [...blockers.flatMap((b) => b.resolution), prereq.includes('business_phone') ? 'open_business_phone' : prereq.length ? 'open_business_tax_id' : null].find((a) => a && allowed.includes(a)) || null;
  return { answer: parts.join('\n\n'), navigation: first ? { action: first, focus: FOCUS[first] ?? null } : null, blockerCodes: blockers.map((b) => b.code) };
}

// ---------------------------------------------------------------------------------------------- prompt blocks (layered knowledge)
export function buildHelpContextBlocks(ctx: HelpContext, active: ReconciledBlocker[], dropped: ReconciledBlocker[], facts: TrustedServerFacts | null, isHebrew: boolean): string {
  if (!ctx) return '';
  const lang = isHebrew ? 'he' : 'en';
  const trusted = facts ? [
    'LAYER 3 - TRUSTED SERVER FACTS (derived by the server for the verified user this turn - authoritative):',
    `- Market: ${facts.market}; plan tier: ${facts.tier}; trial: ${facts.trialStatus}; admin: ${facts.isAdmin ? 'yes' : 'no'}.`,
    `- Business profile: phone ${facts.profile.phoneComplete ? 'complete' : 'MISSING'}${facts.profile.taxIdRequired ? `; tax ID ${facts.profile.taxIdComplete ? 'complete' : 'MISSING'}` : ''}${facts.market === 'Unknown' ? '; region NOT selected yet' : ''}.`,
    `- Monthly quotes: ${facts.monthlyQuotes.used ?? 'unknown'} used of ${facts.monthlyQuotes.limit}. File attachments entitled: ${facts.attachmentsEntitled ? 'yes' : 'no (PRO only)'}.`,
  ].join('\n') : '';
  const f = ctx.facts || {};
  const dyn = [
    `LAYER 2 - DYNAMIC WORKFLOW CONTEXT (reported by the user's browser this turn - a bounded hint about the screen; never overrides Layer 3; captured ${ctx.stale ? 'MORE THAN 10 MINUTES AGO (stale - ask before relying on it)' : 'just now'}):`,
    `- Screen: ${ctx.screen}; section: ${ctx.section}; open modal: ${ctx.modal}; workflow: ${ctx.workflowId ?? 'none'}${ctx.step ? `; wizard step: ${ctx.step}` : ''}.`,
    `- Current object: ${ctx.object.kind}; provenance: ${ctx.object.provenance}.`,
    ctx.draft ? `- Local draft: mode ${ctx.draft.mode}, unsaved changes ${ctx.draft.dirty ? 'yes' : 'no'}, local write ${ctx.draft.localWriteStatus}, server comparison ${ctx.draft.serverComparison}, recovery ${ctx.draft.recoveryState}. A local draft is NOT saved on the server - never say it is saved in the cloud/account.` : null,
    Object.keys(f).length ? `- UI facts: ${Object.entries(f).map(([k, v]) => `${k}=${v}`).join(', ')}.` : null,
  ].filter(Boolean).join('\n');
  const blk = active.length ? [
    `ACTIVE BLOCKERS (mode BLOCKED_WORKFLOW_HELP - the action is blocked, help is NOT; explain truthfully, never claim the action succeeded, never tell the user to bypass a required field, entitlement, or authorization):`,
    ...active.map((b) => `- ${b.code} [${b.type}; operation ${b.operation}; persistence ${b.persistence}; ${b.confirmation}]: ${explainBlocker(b, lang)}`),
  ].join('\n') : 'No active blocker was reported for this screen (mode NORMAL_HELP).';
  const drp = dropped.length ? `Ignored blocker claims (contradicted by the server or stale): ${dropped.map((b) => b.code).join(', ')} - do not mention them as current problems.` : '';
  return [trusted, dyn, blk, drp].filter(Boolean).join('\n\n');
}

export { sanitizeHelpContext, allowedNavigation };
