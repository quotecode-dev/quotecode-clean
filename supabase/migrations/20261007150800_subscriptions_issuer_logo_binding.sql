-- ============================================================================================================================
-- 20261007150800_subscriptions_issuer_logo_binding.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Subscriptions cross-cut, continuation (A): bind the IMMUTABLE logo asset to the issued document.
--
-- Before: the issuer projection 'issuer/v1' carried business_settings.logo_url, a mutable external URL. prepare_quote_output and
-- the orchestrator therefore fail closed with logo_snapshot_policy_pending for every issuer with a logo (CODEX_PREP_CLOSURE
-- 10.1), and a logo could never appear on an issued document.
--
-- After: ONE function is replaced, public.quote_output_issuer(uuid). Commercial logo eligibility is NOT changed.
--   * logo switched on (business_settings.logo_url non-empty) AND a finalized immutable logo binding exists
--       -> projection 'issuer/v2': the same issuer fields, WITHOUT logo_url, plus 'logo' = the asset identity
--          {assetId, objectPath, sha256, bytes, mime, width, height, bindingId} of the CURRENT binding (owner-matched,
--          finalized). The mutable URL value is never used for the bytes and is never fetched.
--   * logo switched on but NOT imported yet -> projection 'issuer/v1' exactly as before -> prepare still fails closed with
--          logo_snapshot_policy_pending (unchanged guard; no logo is dropped silently, nothing is reserved or consumed).
--   * no logo -> 'issuer/v1' with logo_url NULL/empty exactly as before.
-- The issuer digest (bound at prepare, re-checked at finalize) covers the asset identity, so a document reserved with asset A
-- cannot finalize with B (issuer_changed), and an issued document keeps A after the owner binds B (bindings are append-only;
-- a finalized asset is never updated or deleted - account_assets_guard).
--
-- Not applied to TEST/Production by this change. Inert until the DB owner raises the free_issue phase.
-- Rollback: CREATE OR REPLACE public.quote_output_issuer with the 'issuer/v1' body of 20261007150000 (verbatim below in the
-- comment). Issued snapshots that already carry 'issuer/v2' stay readable: the public renderer accepts both projections.
--   SELECT jsonb_build_object('issuerProjection', 'issuer/v1', 'business_name', b.business_name, 'logo_url', b.logo_url,
--                             'tax_id', b.tax_id, 'email', b.email, 'phone', b.phone, 'address', b.address,
--                             'currency', b.currency, 'country', b.country)
--     FROM public.business_settings b WHERE b.user_id = p_user_id
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.quote_output_issuer(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT CASE
    WHEN nullif(btrim(coalesce(b.logo_url, '')), '') IS NOT NULL AND l.asset IS NOT NULL THEN
      jsonb_build_object('issuerProjection', 'issuer/v2', 'business_name', b.business_name, 'logo', l.asset,
                         'tax_id', b.tax_id, 'email', b.email, 'phone', b.phone, 'address', b.address,
                         'currency', b.currency, 'country', b.country)
    ELSE
      jsonb_build_object('issuerProjection', 'issuer/v1', 'business_name', b.business_name, 'logo_url', b.logo_url,
                         'tax_id', b.tax_id, 'email', b.email, 'phone', b.phone, 'address', b.address,
                         'currency', b.currency, 'country', b.country)
  END
    FROM public.business_settings b
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object('assetId', a.asset_id, 'objectPath', a.object_path, 'sha256', a.sha256, 'bytes', a.bytes,
                                'mime', a.mime, 'width', a.width, 'height', a.height, 'bindingId', bd.binding_id) AS asset
        FROM public.account_logo_bindings bd
        JOIN public.account_assets a ON a.asset_id = bd.asset_id AND a.owner_id = bd.owner_id
       WHERE bd.owner_id = b.user_id AND a.state = 'finalized' AND a.kind = 'logo'
       ORDER BY bd.binding_id DESC
       LIMIT 1) l ON true
   WHERE b.user_id = p_user_id
$function$;
REVOKE ALL ON FUNCTION public.quote_output_issuer(uuid) FROM PUBLIC, anon, authenticated, service_role;
