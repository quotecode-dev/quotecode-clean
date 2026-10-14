// Task 16 - Quote Experience V2: Deno twin of the capability core of src/quoteDocument/quoteStyles.js.
// Edge Functions cannot import src/, so this deliberate copy is parity-tested against the client module
// (src/quoteDocument/quoteStyles.parity.test.js). Change BOTH files together or the parity test fails.
// Tiers are PROPOSED and NOT mapped to FREE/BASIC/PRO (commercial mapping = pending Owner decision).
// Pure module: no Deno globals, no remote imports.

export type QuoteStyleId = 'classic' | 'modern' | 'visual';
export type PresentationTierId = QuoteStyleId;

export const QUOTE_STYLE_IDS: readonly QuoteStyleId[] = Object.freeze(['classic', 'modern', 'visual'] as QuoteStyleId[]);

export const QUOTE_STYLE_VERSIONS: Readonly<Record<QuoteStyleId, number>> = Object.freeze({ classic: 1, modern: 1, visual: 1 });

export const DEFAULT_QUOTE_STYLE: QuoteStyleId = 'classic';

export const PRESENTATION_TIERS: ReadonlyArray<{ id: PresentationTierId; rank: number; includes: readonly QuoteStyleId[] }> = Object.freeze([
  Object.freeze({ id: 'classic' as const, rank: 1, includes: Object.freeze(['classic'] as QuoteStyleId[]) }),
  Object.freeze({ id: 'modern' as const, rank: 2, includes: Object.freeze(['classic', 'modern'] as QuoteStyleId[]) }),
  Object.freeze({ id: 'visual' as const, rank: 3, includes: Object.freeze(['classic', 'modern', 'visual'] as QuoteStyleId[]) }),
]);

export const COMMERCIAL_MAPPING_STATUS = 'pending_owner_decision';

export function normalizeStyleId(value: unknown): QuoteStyleId | null {
  return typeof value === 'string' && (QUOTE_STYLE_IDS as readonly string[]).includes(value) ? value as QuoteStyleId : null;
}

export function normalizeTierId(value: unknown): PresentationTierId {
  return PRESENTATION_TIERS.some((t) => t.id === value) ? value as PresentationTierId : 'classic';
}

export function isStyleIncluded(tierId: unknown, styleId: unknown): boolean {
  const tier = PRESENTATION_TIERS.find((t) => t.id === normalizeTierId(tierId))!;
  return !!normalizeStyleId(styleId) && tier.includes.includes(styleId as QuoteStyleId);
}

export function styleSupportsImages(styleId: unknown): boolean {
  return styleId === 'modern' || styleId === 'visual';
}

export function resolveEffectiveStyle({ draftStyle, businessDefault, tierId }: { draftStyle?: unknown; businessDefault?: unknown; tierId?: unknown }):
  { style: QuoteStyleId; source: 'draft' | 'business_default' | 'fallback'; entitled: boolean } {
  const requested = normalizeStyleId(draftStyle) || normalizeStyleId(businessDefault) || DEFAULT_QUOTE_STYLE;
  const source = normalizeStyleId(draftStyle) ? 'draft' : normalizeStyleId(businessDefault) ? 'business_default' : 'fallback';
  return { style: requested, source, entitled: isStyleIncluded(tierId, requested) };
}
