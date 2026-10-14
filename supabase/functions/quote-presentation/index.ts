/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// Task 16 - Quote Experience V2: quote-presentation Edge Function (docs/task16-quote-experience-v2/CONTRACT.md §2, §3).
// Thin I/O shell: every decision lives in ./lib.ts (pure, unit-tested). Deployed with verify_jwt = false; auth is
// enforced HERE: every action except public_get requires a Bearer user JWT verified with auth.getUser, and ownership is
// always quotes.user_id / the caller's own t16-presentation/<uid>/ prefix. Uses the service-role client because the
// t16-presentation/ prefix is unreachable for every client role (storage policies require first folder = auth.uid()).
// Never logs tokens, request bodies or image bytes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ASSET_LIST_PAGE,
  BUCKET,
  MAX_ASSETS_PER_USER,
  MAX_REQUEST_BYTES,
  checkAssetCap,
  countAssetMetas,
  isStorageConflict,
  isStorageNotFound,
  userRoot,
  PresentationError,
  PUBLIC_ACTIONS,
  QA_CAPABILITIES_PATH,
  SIGNED_URL_TTL_SECONDS,
  applyQaCapability,
  assetMetaPath,
  assetObjectPath,
  authorizeQaSetCapability,
  buildAssetMeta,
  catalogPath,
  decodeImageBase64,
  detectImage,
  draftPath,
  extForMime,
  isLockedQuote,
  isPastDraft,
  isUuid,
  issuedPath,
  normalizeCatalog,
  normalizeIssued,
  normalizeStoredDraft,
  parseAssetIdList,
  parseBearer,
  parseMediaRefs,
  parseRequestBody,
  planCatalogLink,
  planDraftSave,
  planSetDefault,
  publicMediaView,
  readDefaultStyle,
  resolveIssueSnapshot,
  resolvePublicPresentation,
  resolveTier,
  settingsPath,
  sha256Hex,
  testModeFor,
  uniqueAssetIds,
} from './lib.ts';
import { COMMERCIAL_MAPPING_STATUS, DEFAULT_QUOTE_STYLE, isStyleIncluded } from '../_shared/quoteStyleCapabilities.ts';
import {
  NO_PRESENTATION_BODY, capabilityForPurpose, decideCapabilityGate, parseUploadPurpose, presentationFromSnapshot,
  type CapabilityCheckAnswer, type GateCapability,
} from './capabilityGate.ts';
import { classifyPhaseRead, decideLegacyIdAccess, isMissingFunctionError } from '../_shared/activationPhase.ts';
import { parseCapabilityResolution, readVerifiedSnapshot, tokenHash } from '../_shared/capabilityToken.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorResponse(code: string, status: number, message: string) {
  return jsonResponse({ error: code, message }, status);
}

// deno-lint-ignore no-explicit-any
type Admin = any;
type QuoteRow = { id: string; user_id: string; status: string | null; signature: string | null };

// ---------------------------------------------------------------------------------------------------------------------
// Storage helpers (bucket quote-files, server-only prefix)
// ---------------------------------------------------------------------------------------------------------------------
// Only a missing OBJECT means "no record"; "Bucket not found" or any other storage failure is a 503 (lib.ts).
const isNotFound = isStorageNotFound;
const isConflict = isStorageConflict;

// Per-user asset count from the meta objects under the caller's own prefix (paginated; stops at the cap).
async function countUserAssets(admin: Admin, uid: string): Promise<number> {
  const prefix = `${userRoot(uid)}/assets`;
  let count = 0;
  for (let offset = 0; count < MAX_ASSETS_PER_USER; offset += ASSET_LIST_PAGE) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: ASSET_LIST_PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) {
      if (isNotFound(error)) return count;
      throw new PresentationError('storage_unavailable', 503, 'Storage is temporarily unavailable');
    }
    const page = Array.isArray(data) ? data : [];
    count += countAssetMetas(page);
    if (page.length < ASSET_LIST_PAGE) break;
  }
  return count;
}

async function readJson(admin: Admin, path: string): Promise<unknown | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error) {
    if (isNotFound(error)) return null;
    throw new PresentationError('storage_unavailable', 503, 'Storage is temporarily unavailable');
  }
  try {
    return JSON.parse(await data.text());
  } catch {
    throw new PresentationError('corrupt_record', 500, 'A stored presentation record is unreadable');
  }
}

// Returns false on an upsert:false conflict (object already exists); throws on any other failure.
async function writeJson(admin: Admin, path: string, value: unknown, upsert: boolean): Promise<boolean> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'application/json',
    upsert,
    cacheControl: '0',
  });
  if (error) {
    if (!upsert && isConflict(error)) return false;
    throw new PresentationError('storage_unavailable', 503, 'Storage is temporarily unavailable');
  }
  return true;
}

// Ownership by construction: an asset is the caller's only if its meta exists under THEIR prefix and agrees with the id.
async function ownedAssetExts(admin: Admin, uid: string, ids: string[]): Promise<Map<string, string>> {
  const owned = new Map<string, string>();
  await Promise.all(ids.map(async (id) => {
    const meta = await readJson(admin, assetMetaPath(uid, id)) as { id?: unknown; mime?: unknown } | null;
    const ext = extForMime(meta?.mime);
    if (meta && typeof meta.id === 'string' && meta.id.toLowerCase() === id && ext) owned.set(id, ext);
  }));
  return owned;
}

async function signAssetUrls(admin: Admin, uid: string, ids: string[]): Promise<Record<string, string | null>> {
  const exts = await ownedAssetExts(admin, uid, ids);
  const urls: Record<string, string | null> = {};
  await Promise.all(ids.map(async (id) => {
    const ext = exts.get(id);
    if (!ext) { urls[id] = null; return; }
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(assetObjectPath(uid, id, ext), SIGNED_URL_TTL_SECONDS);
    urls[id] = !error && data?.signedUrl ? data.signedUrl : null;
  }));
  return urls;
}

async function loadTier(admin: Admin, testMode: boolean, uid: string) {
  const fixture = testMode ? await readJson(admin, QA_CAPABILITIES_PATH) : null;
  return resolveTier({ testMode, fixture, userId: uid });
}

async function loadQuote(admin: Admin, quoteId: unknown): Promise<QuoteRow> {
  if (!isUuid(quoteId)) throw new PresentationError('invalid_id', 400, 'Invalid quote id');
  const { data, error } = await admin.from('quotes').select('id, user_id, status, signature').eq('id', quoteId).maybeSingle();
  if (error) throw new PresentationError('database_unavailable', 503, 'Unable to load quote');
  if (!data) throw new PresentationError('quote_not_found', 404, 'Quote not found');
  return data as QuoteRow;
}

async function loadOwnedQuote(admin: Admin, quoteId: unknown, uid: string): Promise<QuoteRow> {
  const quote = await loadQuote(admin, quoteId);
  // Same response as a missing quote: never reveal that another account's quote exists.
  if (quote.user_id !== uid) throw new PresentationError('quote_not_found', 404, 'Quote not found');
  return quote;
}

async function loadBusiness(admin: Admin, uid: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin.from('business_settings')
    .select('business_name, logo_url, tax_id, email, phone, address, role')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw new PresentationError('database_unavailable', 503, 'Unable to load business settings');
  return data ?? null;
}

// Body read with a hard cap, independent of a (possibly absent or false) Content-Length.
async function readBoundedText(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > MAX_REQUEST_BYTES) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(all);
}

// ---------------------------------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------------------------------
type Ctx = { admin: Admin; testMode: boolean; body: Record<string, unknown>; authHeader?: string | null };

// Subscriptions (OD-17/18; CROSSCUT §2.2): the server capability answer for the JWT user. Never a body field.
async function capabilityAnswer(admin: Admin, uid: string, capability: GateCapability): Promise<CapabilityCheckAnswer> {
  try {
    const { data, error } = await admin.rpc('capability_check', { p_user_id: uid, p_capability: capability });
    if (error) return isMissingFunctionError(error) ? { kind: 'not_deployed' } : { kind: 'error' };
    return { kind: 'answer', data };
  } catch {
    return { kind: 'error' };
  }
}
/** null = allowed; otherwise the refusal response (nothing has been read, decoded or written yet). */
async function capabilityGate(admin: Admin, uid: string, capability: GateCapability): Promise<Response | null> {
  const d = decideCapabilityGate(await capabilityAnswer(admin, uid, capability), capability);
  return d.allow ? null : jsonResponse(d.body, d.status);
}

async function optionalCaller(admin: Admin, authHeader: string | null | undefined): Promise<string | null> {
  const token = parseBearer(authHeader ?? null);
  if (!token) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    const id = data?.user?.id;
    return !error && isUuid(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

const noPresentation = () => jsonResponse({ ...NO_PRESENTATION_BODY }, 200);

// public_get {capabilityToken}: the presentation of the IMMUTABLE issued snapshot only (no draft, no freeze, no write).
// Unknown / revoked / expired / malformed token -> the same "no presentation" answer as any non-served id (no oracle).
async function publicGetByCapability({ admin, body }: Ctx) {
  const hash = await tokenHash(body.capabilityToken);
  if (!hash) return noPresentation();
  const { data, error } = await admin.rpc('resolve_public_capability', { p_token_hash: hash, p_op: 'view' });
  const bound = error ? null : parseCapabilityResolution(data, 'view');
  if (!bound) return noPresentation();
  const read = async (path: string) => {
    const r = await admin.storage.from(BUCKET).download(path);
    if (r.error) {
      if (isNotFound(r.error)) return null;
      throw new PresentationError('storage_unavailable', 503, 'Storage is temporarily unavailable');
    }
    return new Uint8Array(await r.data.arrayBuffer());
  };
  const v = await readVerifiedSnapshot(bound, read);
  const pres = v.ok ? presentationFromSnapshot(v.snapshot) : null;
  if (!pres) throw new PresentationError('document_unavailable', 503, 'The issued document is unavailable');
  const urls = pres.media.length ? await signAssetUrls(admin, bound.userId, uniqueAssetIds(pres.media)) : {};
  return jsonResponse({ mode: 'issued', style: pres.style, styleVersion: pres.styleVersion, branding: pres.branding,
    media: publicMediaView(pres.media, urls), capability: true }, 200);
}

async function publicGet(ctx: Ctx) {
  const { admin, testMode, body } = ctx;
  if (Object.prototype.hasOwnProperty.call(body, 'capabilityToken')) return await publicGetByCapability(ctx);
  // Legacy id mode: unchanged while free_issue is not enforced ('absent' = schema not applied here). Enforced: only the
  // verified owner (owner preview, decided by the caller JWT) or an is_legacy_public_quote id; everything else - including an
  // unknown id - gets the SAME "no presentation" answer (the page falls back to Classic), after the same lookups.
  // A non-allowlisted owner preview never lazily freezes anything.
  const phase = classifyPhaseRead(await admin.from('subscription_activation').select('phase').eq('component', 'free_issue').maybeSingle());
  if (phase === 'error') throw new PresentationError('database_unavailable', 503, 'Unable to load quote');
  let mayFreeze = true;
  let quote: QuoteRow;
  // Continuation (D): a quote issued through the output authority stays capability-scoped in every phase (rollback-safe)
  const scopedRes = await admin.rpc('is_capability_scoped_quote', { p_quote_id: body.quoteId });
  if (scopedRes.error && !isMissingFunctionError(scopedRes.error)) throw new PresentationError('database_unavailable', 503, 'Unable to load quote');
  const capabilityScoped = !scopedRes.error && scopedRes.data === true;
  if (phase === 'enforced' || capabilityScoped) {
    if (!isUuid(body.quoteId)) throw new PresentationError('invalid_id', 400, 'Invalid quote id');
    const [caller, legacyRes, loaded] = await Promise.all([
      optionalCaller(admin, ctx.authHeader),
      phase === 'enforced' ? admin.rpc('is_legacy_public_quote', { p_quote_id: body.quoteId }) : Promise.resolve({ data: false, error: null }),
      loadQuote(admin, body.quoteId).then((q) => ({ q, e: null as unknown }), (e) => ({ q: null as QuoteRow | null, e })),
    ]);
    if (legacyRes.error) throw new PresentationError('database_unavailable', 503, 'Unable to load quote');
    const missing = loaded.e instanceof PresentationError && loaded.e.code === 'quote_not_found';
    if (loaded.e && !missing) throw loaded.e;
    const decision = decideLegacyIdAccess({ phase, isLegacy: legacyRes.data, callerUserId: caller, quoteOwnerId: loaded.q?.user_id ?? null, capabilityScoped });
    if (decision !== 'serve' || !loaded.q) return noPresentation();
    mayFreeze = legacyRes.data === true;
    quote = loaded.q;
  } else {
    quote = await loadQuote(admin, body.quoteId);
  }
  const uid = quote.user_id;
  let issued = await readJson(admin, issuedPath(uid, quote.id));
  const draft = issued ? null : await readJson(admin, draftPath(uid, quote.id));
  const settings = issued || !draft ? null : await readJson(admin, settingsPath(uid));
  const { tier } = issued || !draft ? { tier: 'classic' } : await loadTier(admin, testMode, uid);
  const business = !issued && draft && isPastDraft(quote) ? await loadBusiness(admin, uid) : null;
  let decision = resolvePublicPresentation({ issued, draft, quote, tier, defaultStyle: readDefaultStyle(settings), business, now: new Date() });
  if (decision.freeze && mayFreeze) {
    const written = await writeJson(admin, issuedPath(uid, quote.id), decision.freeze, false);
    if (!written) {
      // Lost a race with another freeze/issue: serve whichever snapshot won.
      issued = await readJson(admin, issuedPath(uid, quote.id));
      decision = resolvePublicPresentation({ issued, draft, quote, tier, defaultStyle: readDefaultStyle(settings), business, now: new Date() });
    }
  }
  const urls = decision.media.length ? await signAssetUrls(admin, uid, uniqueAssetIds(decision.media)) : {};
  return jsonResponse({
    mode: decision.mode,
    style: decision.style,
    styleVersion: decision.styleVersion,
    branding: decision.branding,
    media: publicMediaView(decision.media, urls),
  }, 200);
}

async function handleAuthed(action: string, ctx: Ctx, uid: string) {
  const { admin, testMode, body } = ctx;
  const now = new Date();
  switch (action) {
    case 'context': {
      const [settings, catalog, tierInfo] = await Promise.all([
        readJson(admin, settingsPath(uid)), readJson(admin, catalogPath(uid)), loadTier(admin, testMode, uid),
      ]);
      const defaultStyle = readDefaultStyle(settings) ?? DEFAULT_QUOTE_STYLE;
      return jsonResponse({
        testMode,
        tier: tierInfo.tier,
        tierSource: tierInfo.tierSource,
        commercialMapping: COMMERCIAL_MAPPING_STATUS,
        defaultStyle,
        defaultStyleEntitled: isStyleIncluded(tierInfo.tier, defaultStyle),
        catalog: normalizeCatalog(catalog),
      }, 200);
    }
    case 'set_default': {
      const { tier } = await loadTier(admin, testMode, uid);
      const plan = planSetDefault({ style: body.style, tier, now });
      if (!plan.ok) return errorResponse(plan.code, plan.status, plan.message);
      await writeJson(admin, settingsPath(uid), plan.settings, true);
      return jsonResponse({ defaultStyle: plan.settings.defaultStyle }, 200);
    }
    case 'upload_media': {
      // purpose + server capability BEFORE any decode / Storage write (prepare). Missing purpose = quote_media.
      const purpose = parseUploadPurpose(body.purpose);
      if (!purpose.ok) return jsonResponse(purpose.body, purpose.status);
      const refused = await capabilityGate(admin, uid, capabilityForPurpose(purpose.purpose));
      if (refused) return refused;
      const declared = String(body.contentType ?? '').toLowerCase();
      if (declared && !['image/jpeg', 'image/png', 'image/webp'].includes(declared)) {
        return errorResponse('unsupported_image_type', 415, 'Only JPEG, PNG or WebP images are accepted');
      }
      const decoded = decodeImageBase64(body.dataBase64);
      if (!decoded.ok) return errorResponse(decoded.code, decoded.status, decoded.message);
      const detected = detectImage(decoded.bytes);
      if (!detected.ok) return errorResponse(detected.code, detected.status, detected.message);
      const cap = checkAssetCap(await countUserAssets(admin, uid));
      if (!cap.ok) return errorResponse(cap.code, cap.status, cap.message);
      const id = crypto.randomUUID();
      const meta = buildAssetMeta({ id, image: detected.image, bytes: decoded.bytes.byteLength, sha256: await sha256Hex(decoded.bytes), now });
      const { error } = await admin.storage.from(BUCKET).upload(assetObjectPath(uid, id, detected.image.ext), decoded.bytes, {
        contentType: detected.image.mime, // detected from magic bytes, never the declared type
        upsert: false,
        cacheControl: '3600',
      });
      if (error) throw new PresentationError('storage_unavailable', 503, 'Storage is temporarily unavailable');
      if (!await writeJson(admin, assetMetaPath(uid, id), meta, false)) throw new PresentationError('storage_unavailable', 503, 'Storage conflict');
      return jsonResponse({ asset: meta }, 200);
    }
    case 'media_urls': {
      const list = parseAssetIdList(body.assetIds);
      if (!list.ok) return errorResponse(list.code, list.status, list.message);
      return jsonResponse({ urls: await signAssetUrls(admin, uid, list.ids) }, 200);
    }
    case 'get_quote': {
      const quote = await loadOwnedQuote(admin, body.quoteId, uid);
      const [issuedRaw, draftRaw] = await Promise.all([readJson(admin, issuedPath(uid, quote.id)), readJson(admin, draftPath(uid, quote.id))]);
      const issued = normalizeIssued(issuedRaw);
      const draft = normalizeStoredDraft(draftRaw);
      const ids = uniqueAssetIds([...(draft?.media ?? []), ...(issued?.media ?? [])]);
      return jsonResponse({ draft, issued, locked: isLockedQuote(quote), urls: ids.length ? await signAssetUrls(admin, uid, ids) : {} }, 200);
    }
    case 'save_quote': {
      const quote = await loadOwnedQuote(admin, body.quoteId, uid);
      const parsed = parseMediaRefs(body.media);
      if (!parsed.ok) return errorResponse(parsed.code, parsed.status, parsed.message);
      const [issued, existingDraft, tierInfo, owned] = await Promise.all([
        readJson(admin, issuedPath(uid, quote.id)), readJson(admin, draftPath(uid, quote.id)), loadTier(admin, testMode, uid),
        ownedAssetExts(admin, uid, uniqueAssetIds(parsed.media)),
      ]);
      const plan = planDraftSave({
        // key omitted => undefined => keep the stored draft style; explicit null => clear to the business default
        quote, issued, existingDraft, style: Object.prototype.hasOwnProperty.call(body, 'style') ? body.style : undefined, media: body.media, tier: tierInfo.tier, ownedAssetIds: owned.keys(), now,
      });
      if (!plan.ok) return errorResponse(plan.code, plan.status, plan.message);
      await writeJson(admin, draftPath(uid, quote.id), plan.draft, true);
      return jsonResponse({ draft: plan.draft }, 200);
    }
    case 'issue': {
      const quote = await loadOwnedQuote(admin, body.quoteId, uid);
      const existing = normalizeIssued(await readJson(admin, issuedPath(uid, quote.id)));
      if (existing) return jsonResponse({ issued: existing, alreadyIssued: true }, 200);
      const [draft, settings, tierInfo, business] = await Promise.all([
        readJson(admin, draftPath(uid, quote.id)), readJson(admin, settingsPath(uid)), loadTier(admin, testMode, uid), loadBusiness(admin, uid),
      ]);
      const plan = resolveIssueSnapshot({ draft, settings, tier: tierInfo.tier, business, now });
      if (!plan.ok) return jsonResponse({ error: plan.code, message: plan.message, style: plan.style ?? null }, plan.status);
      if (!await writeJson(admin, issuedPath(uid, quote.id), plan.snapshot, false)) {
        const winner = normalizeIssued(await readJson(admin, issuedPath(uid, quote.id)));
        return jsonResponse({ issued: winner, alreadyIssued: true }, 200);
      }
      return jsonResponse({ issued: plan.snapshot, alreadyIssued: false }, 200);
    }
    case 'catalog_link': {
      const assetId = body.assetId ?? null;
      const linking = assetId !== null; // unlinking is never gated (it grants nothing and deletes nothing)
      if (linking) {
        const refused = await capabilityGate(admin, uid, 'catalog_product_image.upload'); // prepare
        if (refused) return refused;
      }
      const owned = isUuid(assetId) ? await ownedAssetExts(admin, uid, [assetId.toLowerCase()]) : new Map<string, string>();
      const catalog = await readJson(admin, catalogPath(uid));
      const plan = planCatalogLink({ catalog, serviceId: body.serviceId, assetId, caption: body.caption, ownedAssetIds: owned.keys() });
      if (!plan.ok) return errorResponse(plan.code, plan.status, plan.message);
      if (linking) {
        const refused = await capabilityGate(admin, uid, 'catalog_product_image.upload'); // finalize: right before the write
        if (refused) return refused;
      }
      await writeJson(admin, catalogPath(uid), plan.catalog, true);
      return jsonResponse({ catalog: plan.catalog }, 200);
    }
    case 'qa_set_capability': {
      // Cheap refusal first: outside TEST the action does not exist, whoever calls it.
      if (!testMode) return errorResponse('qa_not_available', 404, 'QA capability fixtures exist only on the TEST project');
      const business = await loadBusiness(admin, uid);
      const auth = authorizeQaSetCapability({ testMode, callerRole: business?.role, userId: body.userId, tier: body.tier ?? null });
      if (!auth.ok) return errorResponse(auth.code, auth.status, auth.message);
      const fixture = applyQaCapability(await readJson(admin, QA_CAPABILITIES_PATH), auth.userId, auth.tier);
      await writeJson(admin, QA_CAPABILITIES_PATH, fixture, true);
      return jsonResponse({ userId: auth.userId, tier: auth.tier }, 200);
    }
    default:
      return errorResponse('unknown_action', 400, 'Unknown action');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405, 'Method not allowed');

  let action = 'unknown';
  try {
    const text = await readBoundedText(req);
    if (text === null) return errorResponse('payload_too_large', 413, 'Request body is too large');
    const parsed = parseRequestBody(text);
    if (!parsed.ok) return errorResponse(parsed.code, parsed.status, parsed.message);
    action = parsed.action;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    if (!supabaseUrl || !secretKey) {
      console.error('quote-presentation: missing required server configuration');
      return errorResponse('server_misconfigured', 500, 'Service unavailable');
    }
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ctx: Ctx = { admin, testMode: testModeFor(supabaseUrl), body: parsed.body, authHeader: req.headers.get('Authorization') };

    if (PUBLIC_ACTIONS.includes(action)) return await publicGet(ctx);

    const token = parseBearer(req.headers.get('Authorization'));
    if (!token) return errorResponse('unauthorized', 401, 'Sign in required');
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userError || !isUuid(uid)) return errorResponse('unauthorized', 401, 'Sign in required');
    return await handleAuthed(action, ctx, uid.toLowerCase());
  } catch (error: unknown) {
    if (error instanceof PresentationError) {
      if (error.status >= 500) console.error(`quote-presentation ${action}: ${error.code}`);
      return errorResponse(error.code, error.status, error.message);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`quote-presentation ${action} error:`, message);
    return errorResponse('internal_error', 500, 'Unable to process the request');
  }
});
