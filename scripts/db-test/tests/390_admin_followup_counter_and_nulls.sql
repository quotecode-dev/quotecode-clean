-- Admin part A follow-up (Owner 2026-10-17, Codex verification AV-09 / AV-13) - 20261017000000_admin_followup_counter_and_nulls.sql on the
-- disposable DB. Proves: the dashboard summary reports the Free-10 counter enforced ONLY in the enforced phase (shadow / prepared =
-- not_enforced); an account without a last sign-in / registration date sorts LAST in both directions. The free_issue phase is restored.
CREATE TEMP TABLE t390 (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t390 TO authenticated;
INSERT INTO t390 SELECT 'phase', to_jsonb(phase) FROM public.subscription_activation WHERE component = 'free_issue';

INSERT INTO auth.users (id, email) VALUES
  ('39000000-0000-4000-8000-0000000000b0', 'admin.390@synthetic.test'),
  ('39000000-0000-4000-8000-0000000000b1', 'early.390@synthetic.test'),
  ('39000000-0000-4000-8000-0000000000b2', 'late.390@synthetic.test'),
  ('39000000-0000-4000-8000-0000000000b3', 'never.390@synthetic.test');
INSERT INTO public.business_settings (user_id, role) VALUES ('39000000-0000-4000-8000-0000000000b0', 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.business_settings (user_id, email, business_name, country, role, created_at, last_sign_in) VALUES
    ('39000000-0000-4000-8000-0000000000b1', 'early.390@synthetic.test', 'Early 390', 'Local', 'user', now() - interval '3 day', now() - interval '3 day'),
    ('39000000-0000-4000-8000-0000000000b2', 'late.390@synthetic.test', 'Late 390', 'Local', 'user', now() - interval '2 day', now() - interval '1 hour'),
    ('39000000-0000-4000-8000-0000000000b3', 'never.390@synthetic.test', 'Never 390', 'Local', 'user', now() - interval '1 day', NULL)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- AV-09: the counter state per phase
DO $$
DECLARE ph text;
BEGIN
  FOREACH ph IN ARRAY ARRAY['prepared', 'shadow', 'enforced'] LOOP
    SET LOCAL session_replication_role = replica;
    UPDATE public.subscription_activation SET phase = ph WHERE component = 'free_issue';
    SET LOCAL session_replication_role = origin;
    PERFORM tst.login('39000000-0000-4000-8000-0000000000b0');
    INSERT INTO t390 VALUES ('summary_' || ph, public.get_admin_dashboard_summary()) ON CONFLICT (k) DO UPDATE SET v = excluded.v;
    PERFORM tst.logout();
  END LOOP;
END $$;
SELECT tst.ok((SELECT v ->> 'free10Counter' FROM t390 WHERE k = 'summary_prepared') = 'not_enforced', 'COUNTER: prepared -> not_enforced');
SELECT tst.ok((SELECT v ->> 'free10Counter' FROM t390 WHERE k = 'summary_shadow') = 'not_enforced' AND (SELECT v ->> 'planSystem' FROM t390 WHERE k = 'summary_shadow') = 'active', 'COUNTER: shadow -> plan system active but the counter not enforced (AV-09)');
SELECT tst.ok((SELECT v ->> 'free10Counter' FROM t390 WHERE k = 'summary_enforced') = 'enforced', 'COUNTER: enforced -> enforced');

-- AV-13: missing dates last, both directions
SELECT tst.login('39000000-0000-4000-8000-0000000000b0');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.get_admin_accounts('390', NULL, NULL, 'last_sign_in', 'asc', 25, 0);
  PERFORM tst.ok(r #>> '{rows,0,business_name}' = 'Early 390' AND r #>> '{rows,1,business_name}' = 'Late 390' AND r #>> '{rows,2,business_name}' = 'Never 390', 'NULLS: last sign-in ascending - no date last');
  r := public.get_admin_accounts('390', NULL, NULL, 'last_sign_in', 'desc', 25, 0);
  PERFORM tst.ok(r #>> '{rows,0,business_name}' = 'Late 390' AND r #>> '{rows,1,business_name}' = 'Early 390' AND r #>> '{rows,2,business_name}' = 'Never 390', 'NULLS: last sign-in descending - no date last');
  r := public.get_admin_accounts('390', NULL, NULL, 'created_at', 'asc', 25, 0);
  PERFORM tst.ok(r #>> '{rows,0,business_name}' = 'Early 390' AND r #>> '{rows,2,business_name}' = 'Never 390', 'NULLS: registration ascending unchanged for dated rows');
END $$;
SELECT tst.logout();

DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.subscription_activation SET phase = (SELECT v #>> '{}' FROM t390 WHERE k = 'phase') WHERE component = 'free_issue';
END $$;
