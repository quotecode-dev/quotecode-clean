-- ============================================================================================================================
-- 20261030900000_scheduled_health.sql  -  Codex release 7 (topic 6c): a scheduled run that never happened is noticed - outside Vercel
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-30 (typed: "אשר עבודה רצופה מעכשיו: ... שחרורים 6, 7, 8 ... ו-9, כל אחד בשער משלו לפי הסדר ..."); decision 11
--   (a watcher outside Vercel, 30 minutes of grace after the final slot, a deadline per job, the private schedule / Vault / dispatch
--   settings typed by the Owner); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 6c.
--   * scheduled_jobs: the seven scheduled jobs, their kind (daily / weekly on Sunday / monthly on the 1st), the UTC time of their final
--     slot and their completion deadline; enabled_from = no alert for any window before it (activation never pages for history).
--   * scheduled_job_events: the workers record started / completed / partial / failed / skipped for a window the DATABASE derives from
--     the server time (a caller never names its window); only the service role writes; no secrets, bodies or payloads.
--   * scheduled_job_incidents: one per job + window that ended without a valid completion (missed / failed / partial); its Owner alert
--     and its recovery notice are each sent once, a failed delivery stays pending.
--   * scheduled_health_evaluate(): the latest window of each job whose deadline passed - no completion = an incident; a later completed
--     window = the incident recovers. Called every ten minutes by the scheduled-health function (pg_cron + Vault, Owner-typed).
--   Closed to the app: RLS forced, no policy, no grant to PUBLIC / anon / authenticated; the service role only.
--   ROLLBACK: unschedule tekango-schedule-watch (Owner); keep the history.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  job           text         PRIMARY KEY CHECK (job ~ '^[a-z0-9-]{3,40}$'),
  kind          text         NOT NULL CHECK (kind IN ('daily', 'weekly_sunday', 'monthly_first')),
  final_slot    time         NOT NULL,
  deadline_min  integer      NOT NULL CHECK (deadline_min BETWEEN 1 AND 240),
  label_he      text         NOT NULL CHECK (char_length(label_he) <= 80),
  enabled_from  timestamptz  NOT NULL DEFAULT now()
);
INSERT INTO public.scheduled_jobs (job, kind, final_slot, deadline_min, label_he) VALUES
  ('daily-cron',            'daily',         '08:00', 45, 'תזכורות המנוי ושערי המטבע'),
  ('support-digest',        'daily',         '18:00', 45, 'סיכום הפניות של הערב'),
  ('expense-scan',          'monthly_first', '05:00', 60, 'סריקת חשבוניות ההוצאה החודשית'),
  ('support-weekly-review', 'weekly_sunday', '18:00', 45, 'הסקירה השבועית של הפניות'),
  ('billing-reconcile',     'daily',         '05:00', 45, 'התאמת התשלומים היומית'),
  ('agents-weekly',         'weekly_sunday', '06:00', 45, 'הריצה השבועית של הסוכנים'),
  ('agents-daily',          'daily',         '04:30', 45, 'הבדיקה היומית של הסוכנים')
ON CONFLICT (job) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.scheduled_job_events (
  id          bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job         text         NOT NULL REFERENCES public.scheduled_jobs (job),
  window_key  date         NOT NULL,
  event       text         NOT NULL CHECK (event IN ('started', 'completed', 'partial', 'failed', 'skipped')),
  outcome     text         CHECK (outcome IS NULL OR outcome ~ '^[a-z0-9_:-]{1,60}$'),
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_job_events_window_idx ON public.scheduled_job_events (job, window_key, event);

CREATE TABLE IF NOT EXISTS public.scheduled_job_incidents (
  id                     bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job                    text         NOT NULL REFERENCES public.scheduled_jobs (job),
  window_key             date         NOT NULL,
  kind                   text         NOT NULL CHECK (kind IN ('missed', 'failed', 'partial')),
  opened_at              timestamptz  NOT NULL DEFAULT now(),
  alerted_at             timestamptz,
  recovered_at           timestamptz,
  recovery_alerted_at    timestamptz,
  UNIQUE (job, window_key)
);

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_job_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_job_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_job_incidents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scheduled_jobs, public.scheduled_job_events, public.scheduled_job_incidents FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.scheduled_jobs, public.scheduled_job_events, public.scheduled_job_incidents TO service_role;

-- the window a moment belongs to (UTC date of the job's final slot: no job's slots cross midnight UTC)
CREATE OR REPLACE FUNCTION public.scheduled_window_of(p_kind text, p_at timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE p_kind
    WHEN 'daily' THEN (p_at AT TIME ZONE 'UTC')::date
    WHEN 'weekly_sunday' THEN (p_at AT TIME ZONE 'UTC')::date - extract(dow FROM (p_at AT TIME ZONE 'UTC'))::integer
    WHEN 'monthly_first' THEN date_trunc('month', p_at AT TIME ZONE 'UTC')::date
  END;
$function$;

-- a worker records its event; the window is the database's (from the server time)
CREATE OR REPLACE FUNCTION public.scheduled_health_record(p_job text, p_event text, p_outcome text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM public.scheduled_jobs WHERE job = p_job;
  IF v_kind IS NULL OR p_event NOT IN ('started', 'completed', 'partial', 'failed', 'skipped') THEN RETURN false; END IF;
  INSERT INTO public.scheduled_job_events (job, window_key, event, outcome)
  VALUES (p_job, public.scheduled_window_of(v_kind, now()), p_event, CASE WHEN p_outcome ~ '^[a-z0-9_:-]{1,60}$' THEN p_outcome END);
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.scheduled_health_record(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scheduled_health_record(text, text, text) TO service_role;

-- the latest due window of every job: an incident when it ended without a valid completion; a recovery when a later window completed.
-- Returns what to mail: [{id, job, label, window, kind, mail: 'alert' | 'recovery'}].
CREATE OR REPLACE FUNCTION public.scheduled_health_evaluate(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  j public.scheduled_jobs%ROWTYPE; v_win date; v_due timestamptz; v_best text;
BEGIN
  FOR j IN SELECT * FROM public.scheduled_jobs LOOP
    v_win := public.scheduled_window_of(j.kind, p_now);
    v_due := (v_win + j.final_slot) AT TIME ZONE 'UTC' + make_interval(mins => j.deadline_min);
    IF v_due > p_now THEN
      -- this window is not over yet: the previous one is the latest due window
      v_win := public.scheduled_window_of(j.kind, (v_win - 1)::timestamp AT TIME ZONE 'UTC');
      v_due := (v_win + j.final_slot) AT TIME ZONE 'UTC' + make_interval(mins => j.deadline_min);
    END IF;
    CONTINUE WHEN v_due <= j.enabled_from;  -- never page for a window before activation
    SELECT CASE WHEN bool_or(event IN ('completed', 'skipped')) THEN 'ok' WHEN bool_or(event = 'partial') THEN 'partial'
                WHEN bool_or(event = 'failed') THEN 'failed' ELSE 'missed' END
      INTO v_best FROM public.scheduled_job_events WHERE job = j.job AND window_key = v_win;
    v_best := coalesce(v_best, 'missed');
    IF v_best = 'ok' THEN
      UPDATE public.scheduled_job_incidents SET recovered_at = p_now WHERE job = j.job AND recovered_at IS NULL AND window_key <= v_win;
    ELSE
      INSERT INTO public.scheduled_job_incidents (job, window_key, kind) VALUES (j.job, v_win, v_best) ON CONFLICT (job, window_key) DO NOTHING;
    END IF;
  END LOOP;
  -- one alert per incident; one recovery notice per job (the newest recovered incident), never a periodic "still broken"
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x ->> 'job') FROM (
    SELECT jsonb_build_object('id', i.id, 'job', i.job, 'label', s.label_he, 'window', i.window_key, 'kind', i.kind, 'mail', 'alert') x
      FROM public.scheduled_job_incidents i JOIN public.scheduled_jobs s ON s.job = i.job
     WHERE i.alerted_at IS NULL AND i.recovered_at IS NULL
    UNION ALL
    SELECT jsonb_build_object('id', i.id, 'job', i.job, 'label', s.label_he, 'window', i.window_key, 'kind', i.kind, 'mail', 'recovery')
      FROM public.scheduled_job_incidents i JOIN public.scheduled_jobs s ON s.job = i.job
     WHERE i.recovered_at IS NOT NULL AND i.recovery_alerted_at IS NULL AND i.alerted_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.scheduled_job_incidents n WHERE n.job = i.job AND n.window_key > i.window_key AND n.recovered_at IS NOT NULL)
  ) q), '[]'::jsonb);
END
$function$;
REVOKE ALL ON FUNCTION public.scheduled_health_evaluate(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scheduled_health_evaluate(timestamptz) TO service_role;

-- a delivered mail is recorded once (a failed delivery stays pending, retried at the next evaluation)
CREATE OR REPLACE FUNCTION public.scheduled_health_mailed(p_id bigint, p_mail text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH u AS (
    UPDATE public.scheduled_job_incidents
       SET alerted_at = CASE WHEN p_mail = 'alert' THEN coalesce(alerted_at, now()) ELSE alerted_at END,
           recovery_alerted_at = CASE WHEN p_mail = 'recovery' THEN coalesce(recovery_alerted_at, now()) ELSE recovery_alerted_at END
     WHERE id = p_id AND p_mail IN ('alert', 'recovery')
     RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$function$;
REVOKE ALL ON FUNCTION public.scheduled_health_mailed(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scheduled_health_mailed(bigint, text) TO service_role;
