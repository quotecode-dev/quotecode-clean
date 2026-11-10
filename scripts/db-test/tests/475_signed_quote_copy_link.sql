-- 20261110100000 (Owner 2026-11-09: "צריך לתת אפשרות העתקה, מה השאלה?" + the night-task approval "מאשר משימת לילה 1-5: תיקון ההעתקה
-- בהצעה חתומה עד שער עובר, ..."). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a quote edited after its link went out and then signed (A100736) - "copy" (public_share) returns the version already output to
-- that customer, counts nothing, writes no ledger row, leaves the quote signed; the notice never says a free quote is used. Every other
-- channel and every unsigned closed / never-output case keep their earlier answer.
BEGIN;
SET tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.cu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd475000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.cq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd475100-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.cc(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd475200-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.csvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.cdigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
CREATE OR REPLACE FUNCTION tst.cprep(p_user uuid, p_quote uuid, p_channel text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.cdigest(p_user, p_quote); r jsonb;
BEGIN
  PERFORM tst.csvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, format('out:%s:%s:%s', p_quote, p_channel, d), d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.cout(p_user uuid, p_quote uuid, p_channel text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb; r jsonb;
BEGIN
  p := tst.cprep(p_user, p_quote, p_channel);
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.csvc();
  r := public.finalize_quote_output(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.cused(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.crows(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.quote_issue_ledger WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.cnotice(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.csvc(); r := public.output_notice(p_user, p_quote); PERFORM tst.logout(); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) VALUES (tst.cu(1), 'c475-1@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES (tst.cu(1), 'c475-1@synthetic.test', 'Synthetic C475', 'Local', 'ILS');
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.cu(1), 'free_10');
INSERT INTO public.clients (id, company_name, email, user_id) VALUES (tst.cc(1), 'Synthetic Customer 475', 'c475-a@synthetic.test', tst.cu(1));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES
  (tst.cq(1), tst.cu(1), 94751, 'draft', tst.cc(1), 'v1'),   -- edited after its link went out, then signed (the A100736 case)
  (tst.cq(2), tst.cu(1), 94752, 'draft', tst.cc(1), 'v1'),   -- signed before enforcement, never output by the authority (legacy)
  (tst.cq(3), tst.cu(1), 94753, 'draft', tst.cc(1), 'v1');   -- output, then closed WITHOUT a signature
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
  SELECT tst.cq(n), 'Synthetic work', 1, 100, 100 FROM generate_series(1, 3) n;
UPDATE public.quotes SET signature = 'data:image/png;base64,BBBB', status = 'approved' WHERE id = tst.cq(2);  -- enforcement still off

UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
DO $$
DECLARE r jsonb; first jsonb; n jsonb; used0 int; rows0 int;
BEGIN
  -- the link goes out once (version 1), the quote is edited (version 2 never output), the customer signs
  first := tst.cout(tst.cu(1), tst.cq(1), 'public_share');
  PERFORM tst.ok(first ->> 'state' = 'finalized', 'C0 the first link of the quote goes out (version 1)');
  UPDATE public.quotes SET notes = 'v2 edited after the link went out' WHERE id = tst.cq(1);
  UPDATE public.quotes SET signature = 'data:image/png;base64,AAAA', status = 'approved' WHERE id = tst.cq(1);
  used0 := tst.cused(tst.cu(1)); rows0 := tst.crows(tst.cu(1));

  n := tst.cnotice(tst.cu(1), tst.cq(1));
  PERFORM tst.ok(n ->> 'ok' = 'true' AND n ->> 'alreadyFinalized' = 'true' AND n ->> 'wouldConsume' = 'false',
    'C1 the notice of a signed quote already output to its customer: already output, never uses a free quote');

  r := tst.cout(tst.cu(1), tst.cq(1), 'public_share');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND r ->> 'alreadyFinalized' = 'true' AND r ->> 'attemptId' = first ->> 'attemptId'
                 AND (r ->> 'consumed') IS NOT NULL AND r -> 'descriptor' ->> 'path' = first -> 'descriptor' ->> 'path',
    'C2 copy of the signed quote returns the version already output to the same customer (its existing link)');
  PERFORM tst.ok(tst.cused(tst.cu(1)) = used0 AND tst.crows(tst.cu(1)) = rows0
                 AND NOT EXISTS (SELECT 1 FROM public.quote_output_attempts a WHERE a.user_id = tst.cu(1) AND a.state = 'preparing'),
    'C3 the copy counts nothing, writes no ledger row and reserves nothing');
  PERFORM tst.ok((SELECT status = 'approved' AND signature = 'data:image/png;base64,AAAA' FROM public.quotes WHERE id = tst.cq(1)),
    'C4 the quote stays signed (status and signature untouched)');
  r := tst.cout(tst.cu(1), tst.cq(1), 'public_share');
  PERFORM tst.ok(r ->> 'alreadyFinalized' = 'true' AND tst.cused(tst.cu(1)) = used0, 'C5 a second copy answers the same, still nothing counted');

  PERFORM tst.ok(tst.cout(tst.cu(1), tst.cq(1), 'send') ->> 'code' = 'quote_closed'
                 AND tst.cout(tst.cu(1), tst.cq(1), 'final_pdf') ->> 'code' = 'quote_closed'
                 AND tst.cout(tst.cu(1), tst.cq(1), 'final_print') ->> 'code' = 'quote_closed' AND tst.cused(tst.cu(1)) = used0,
    'C6 send / final PDF / final print of the new version of a signed quote keep quote_closed (unchanged)');

  -- signed but never output by the authority: unchanged answer
  PERFORM tst.ok(tst.cout(tst.cu(1), tst.cq(2), 'public_share') ->> 'code' = 'legacy_issue_policy_pending'
                 AND tst.cnotice(tst.cu(1), tst.cq(2)) ->> 'alreadyFinalized' = 'false',
    'C7 a signed quote never output by the authority keeps its earlier answer');

  -- output, edited, then closed WITHOUT a signature: unchanged answer
  PERFORM tst.ok(tst.cout(tst.cu(1), tst.cq(3), 'public_share') ->> 'state' = 'finalized', 'C8a quote 3 goes out once');
  UPDATE public.quotes SET notes = 'v2', status = 'rejected' WHERE id = tst.cq(3);
  PERFORM tst.ok(tst.cout(tst.cu(1), tst.cq(3), 'public_share') ->> 'code' = 'quote_closed'
                 AND tst.cnotice(tst.cu(1), tst.cq(3)) ->> 'alreadyFinalized' = 'false',
    'C8b a closed quote WITHOUT a signature keeps quote_closed and its notice is unchanged');
END $$;

ROLLBACK;
