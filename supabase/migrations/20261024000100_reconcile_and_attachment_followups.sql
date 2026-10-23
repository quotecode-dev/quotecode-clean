-- ============================================================================================================================
-- 20261024000100_reconcile_and_attachment_followups.sql  -  Codex review of the 23/10 releases: R-01 and R-03
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner (2026-10-23, Shabbat eve): "מאשר לך לעשות כל מה שאתה מוצא לנכון לתקן על פי הדוח שלו" (docs/CODEX_REVIEW_RELEASES_2026-10-23.md).
--   * R-01: a run keeps how many transactions were linked but whose AMOUNT could not be verified yet (the amount unit of PayPlus's history is
--     proven only by linked charges) - never counted as "matched". billing_reconcile_runs.unverified + the admin view returns it.
--   * R-03: the attachment limit (20261023310000) read the business's total and accepted the new file without a lock - two saves of the same
--     business at the same moment could each see 29 MB and together pass 30 MB. The check now takes a per-business transaction lock first,
--     so the decisions of one business are made one at a time (other businesses are never blocked by it).
-- Rollback of THIS file: ALTER TABLE public.billing_reconcile_runs DROP COLUMN unverified; re-run the function bodies of 20261023300000
--   (billing_reconcile_admin_state) and 20261023310000 (quote_attachment_size_guard).
-- ============================================================================================================================

ALTER TABLE public.billing_reconcile_runs ADD COLUMN IF NOT EXISTS unverified integer NOT NULL DEFAULT 0 CHECK (unverified >= 0);

CREATE OR REPLACE FUNCTION public.billing_reconcile_admin_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'billing_reconcile_admin_state: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'runs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.run_id, 'day', r.run_day, 'source', r.source, 'startedAt', r.started_at,
      'finishedAt', r.finished_at, 'status', r.status, 'from', r.window_from, 'until', r.window_until, 'provider', r.provider_count,
      'ours', r.ours_count, 'matched', r.matched, 'unverified', r.unverified, 'newFindings', r.new_findings, 'scale', r.amount_scale, 'types', r.types,
      'error', r.error_code, 'mailedAt', r.mailed_at) ORDER BY r.started_at DESC)
      FROM (SELECT * FROM public.billing_reconcile_runs ORDER BY started_at DESC LIMIT 30) r), '[]'::jsonb),
    'open', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'code', f.code, 'uid', f.uid, 'detail', f.detail, 'createdAt', f.created_at)
      ORDER BY f.created_at) FROM public.billing_reconcile_findings f WHERE f.status = 'new'), '[]'::jsonb),
    'checked', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'code', f.code, 'uid', f.uid, 'detail', f.detail, 'createdAt', f.created_at,
      'checkedAt', f.checked_at) ORDER BY f.checked_at DESC)
      FROM (SELECT * FROM public.billing_reconcile_findings WHERE status = 'checked' ORDER BY checked_at DESC LIMIT 50) f), '[]'::jsonb)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.billing_reconcile_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_reconcile_admin_state() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quote_attachment_size_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner uuid;
  v_size  bigint;
  v_total bigint;
BEGIN
  SELECT q.user_id INTO v_owner FROM public.quotes q WHERE q.id = NEW.quote_id;
  -- Codex R-03: one business's limit decisions one at a time (released at the end of the saving transaction)
  PERFORM pg_advisory_xact_lock(hashtext('tekango.quote_attachment_quota'), hashtext(coalesce(v_owner::text, '')));
  SELECT CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (o.metadata ->> 'size')::bigint END INTO v_size
    FROM storage.objects o WHERE o.bucket_id = 'quote-files' AND o.name = NEW.storage_path;
  v_size := greatest(coalesce(v_size, 0), coalesce(NEW.file_size, 0));
  IF v_size > 3145728 THEN
    RAISE EXCEPTION 'attachment_file_too_large: one attachment is at most 3 MB' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(sum(greatest(coalesce(CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (o.metadata ->> 'size')::bigint END, 0),
                               coalesce(a.file_size, 0))), 0)
    INTO v_total
    FROM public.quote_attachments a
    JOIN public.quotes q ON q.id = a.quote_id
    LEFT JOIN storage.objects o ON o.bucket_id = 'quote-files' AND o.name = a.storage_path
   WHERE q.user_id = v_owner
     AND (TG_OP = 'INSERT' OR a.id <> OLD.id);  -- a changed row is counted once, with its new size
  IF v_total + v_size > 31457280 THEN
    RAISE EXCEPTION 'attachment_total_exceeded: the attachments of a business are at most 30 MB together' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_attachment_size_guard() FROM PUBLIC, anon, authenticated;
