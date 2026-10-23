-- ============================================================================================================================
-- 20261023200000_support_weekly_review.sql  -  the weekly automatic review of bug reports and improvement requests from email
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-22: סקירה שבועית אוטומטית של תקלות ובקשות שיפור מהמיילים, עם רשימה בלשונית
--   פניות ומייל סיכום"). Once a week (Sunday 20:00 Israel time) the function support-weekly-review reads the week's sorted support
--   emails (yellow = a bug or a request; red = needs the Owner), the AI merges duplicates and ranks them, the result is kept here as a
--   lasting list with a status per item (new / in progress / fixed / dismissed), and the Owner gets a short summary email.
--   * support_review_runs  - one row per review, keyed by the Israel date it ran on (the weekly Sunday run or an Owner "run now"; once a day).
--   * support_review_items - the list. Closed to the app; the admin reads it through support_review_admin_list() and changes a status
--     through support_review_set_status() - both super admin only. The function writes with the service role.
-- Rollback of THIS file: DROP FUNCTION public.support_review_set_status(uuid, text), public.support_review_admin_list();
--   DROP TABLE public.support_review_items, public.support_review_runs.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.support_review_runs (
  week        date        PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  inquiries   integer     NOT NULL DEFAULT 0 CHECK (inquiries >= 0),
  items       integer     NOT NULL DEFAULT 0 CHECK (items >= 0),
  mailed_at   timestamptz NULL
);
ALTER TABLE public.support_review_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_review_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_review_runs TO service_role;

CREATE TABLE IF NOT EXISTS public.support_review_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  week            date        NOT NULL REFERENCES public.support_review_runs (week) ON DELETE CASCADE,
  kind            text        NOT NULL CHECK (kind IN ('bug', 'request')),
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  summary         text        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 800),
  priority        integer     NOT NULL CHECK (priority BETWEEN 1 AND 3),
  inquiries_count integer     NOT NULL CHECK (inquiries_count BETWEEN 1 AND 500),
  inquiry_ids     uuid[]      NOT NULL DEFAULT '{}'::uuid[] CHECK (cardinality(inquiry_ids) <= 100),
  status          text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'fixed', 'dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_review_items_week ON public.support_review_items (week DESC, priority);
ALTER TABLE public.support_review_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_review_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_review_items TO service_role;

-- the list for the admin "פניות" tab: the last 12 review weeks, open items first - super admin only
CREATE OR REPLACE FUNCTION public.support_review_admin_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'support_review_admin_list: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'weeks', coalesce((SELECT jsonb_agg(jsonb_build_object('week', r.week, 'inquiries', r.inquiries, 'items', r.items, 'mailedAt', r.mailed_at) ORDER BY r.week DESC)
      FROM (SELECT * FROM public.support_review_runs ORDER BY week DESC LIMIT 12) r), '[]'::jsonb),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'week', i.week, 'kind', i.kind, 'title', i.title, 'summary', i.summary,
      'priority', i.priority, 'count', i.inquiries_count, 'status', i.status, 'updatedAt', i.updated_at)
      ORDER BY (i.status IN ('fixed', 'dismissed')), i.priority, i.week DESC, i.inquiries_count DESC)
      FROM public.support_review_items i WHERE i.week IN (SELECT week FROM public.support_review_runs ORDER BY week DESC LIMIT 12)), '[]'::jsonb)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.support_review_admin_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_review_admin_list() TO authenticated, service_role;

-- the Owner changes the status of one item - super admin only, a fixed list of statuses
CREATE OR REPLACE FUNCTION public.support_review_set_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_rows integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'support_review_set_status: super admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('new', 'in_progress', 'fixed', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_status');
  END IF;
  UPDATE public.support_review_items SET status = p_status, updated_at = now() WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_rows = 1, 'code', CASE WHEN v_rows = 1 THEN NULL ELSE 'not_found' END);
END
$function$;
REVOKE ALL ON FUNCTION public.support_review_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_review_set_status(uuid, text) TO authenticated, service_role;
