-- Continuation (D): rollback rehearsal at the database layer (disposable postgres:17 harness ONLY; DB owner = test device).
-- Issue under 'enforced' (output finalized + capability token + signature through the capability), then roll the phase back
-- to 'prepared' with set_activation_phase (the operational rollback) and prove:
--   the token still resolves (view + approve) and the signed, issued document is untouched; the ledger, attempts, counter,
--   tokens and assets are untouched (no refund, no deletion); the quote's bare id neither approves it nor - via
--   is_capability_scoped_quote - opens it (Edge layer); a NEW output is not_activated (no consumption, the legacy path takes
--   over by design); a legacy (never authority-issued) quote keeps its legacy id approval.
-- ONE transaction, rolled back at the end.
BEGIN;

CREATE OR REPLACE FUNCTION tst.ru(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('e9000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.rq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('e8000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.rtok(n int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT rpad(format('rollbackTok%s_', n), 43, 'x') $$;
CREATE OR REPLACE FUNCTION tst.rsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.rprep(p_user uuid, p_quote uuid, p_channel text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)); r jsonb;
BEGIN
  PERFORM tst.rsvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, p_key, d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.rfin(p_user uuid, p_attempt uuid, p_path text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p_path, jsonb_build_object('size', 100))
    ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.rsvc();
  r := public.finalize_quote_output(p_user, p_attempt, p_path, repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.rmint(p_user uuid, p_attempt uuid, p_tok text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.rsvc();
  r := public.mint_public_capability(p_user, p_attempt, encode(sha256(convert_to(p_tok, 'UTF8')), 'hex'), ARRAY['view', 'approve'], NULL);
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.rres(p_tok text, p_op text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.rsvc();
  r := public.resolve_public_capability(encode(sha256(convert_to(p_tok, 'UTF8')), 'hex'), p_op);
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.rscoped(p_quote uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN PERFORM tst.rsvc(); r := public.is_capability_scoped_quote(p_quote); PERFORM tst.logout(); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) VALUES (tst.ru(1), 'xrb-1@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role)
  VALUES (tst.ru(1), 'xrb-1@synthetic.test', 'Synthetic Rollback', 'Local', 'ILS', 'free', 'user') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.clients (id, company_name, email, user_id)
  VALUES ('e7000000-0000-4000-8000-000000000001', 'Synthetic Rollback Customer', 'xrbc@synthetic.test', tst.ru(1));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES
  (tst.rq(1), tst.ru(1), 87001, 'draft', 'e7000000-0000-4000-8000-000000000001', 'issued under enforcement'),
  (tst.rq(2), tst.ru(1), 87002, 'draft', 'e7000000-0000-4000-8000-000000000001', 'new output after rollback'),
  (tst.rq(3), tst.ru(1), 87003, 'sent',  'e7000000-0000-4000-8000-000000000001', 'legacy (pre-cutover) quote');
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.ru(1), 'free_10');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- issue under enforcement + token + signature through the capability
CREATE TEMP TABLE r1p AS SELECT tst.rprep(tst.ru(1), tst.rq(1), 'send', 'rollback-key-1') AS r;
CREATE TEMP TABLE r1f AS SELECT tst.rfin(tst.ru(1), (SELECT (r ->> 'attemptId')::uuid FROM r1p), (SELECT r ->> 'snapshotPath' FROM r1p)) AS r;
CREATE TEMP TABLE r1m AS SELECT tst.rmint(tst.ru(1), (SELECT (r ->> 'attemptId')::uuid FROM r1p), tst.rtok(1)) AS r;
SELECT tst.ok((SELECT r ->> 'state' FROM r1f) = 'finalized' AND (SELECT (r ->> 'ok')::boolean FROM r1m), 'RB1 enforced: issued + capability minted');
SELECT tst.lives(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.rtok(1)),
                 'RB2 enforced: signed through the capability');
CREATE TEMP TABLE rb_before AS SELECT
  (SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = tst.ru(1)) AS ledger,
  (SELECT count(*) FROM public.quote_output_attempts WHERE user_id = tst.ru(1)) AS attempts,
  (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.ru(1)) AS consumed,
  (SELECT count(*) FROM public.quote_public_capabilities WHERE user_id = tst.ru(1) AND revoked_at IS NULL) AS tokens,
  (SELECT signature FROM public.quotes WHERE id = tst.rq(1)) AS signature,
  (SELECT status FROM public.quotes WHERE id = tst.rq(1)) AS status;
SELECT tst.ok((SELECT signature FROM rb_before) IS NOT NULL AND (SELECT consumed FROM rb_before) = 1, 'RB3 before rollback: signature stored, 1 consumed');

-- operational rollback (DB owner): phase back to prepared
SELECT tst.lives($$ SELECT public.set_activation_phase('free_issue', 'prepared', 'rollback rehearsal (disposable DB)') $$, 'RB4 rollback: set_activation_phase(free_issue, prepared)');

-- issued documents and links survive
SELECT tst.ok((SELECT (tst.rres(tst.rtok(1), 'view') ->> 'ok')::boolean) AND (SELECT (tst.rres(tst.rtok(1), 'approve') ->> 'ok')::boolean),
  'RB5 after rollback: the capability URL still resolves (view + approve)');
SELECT tst.ok((SELECT tst.rres(tst.rtok(1), 'view') ->> 'snapshotPath') = (SELECT r ->> 'snapshotPath' FROM r1p), 'RB6 after rollback: same immutable snapshot');
SELECT tst.ok((SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = tst.ru(1)) = (SELECT ledger FROM rb_before)
  AND (SELECT count(*) FROM public.quote_output_attempts WHERE user_id = tst.ru(1)) = (SELECT attempts FROM rb_before)
  AND (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.ru(1)) = (SELECT consumed FROM rb_before)
  AND (SELECT count(*) FROM public.quote_public_capabilities WHERE user_id = tst.ru(1) AND revoked_at IS NULL) = (SELECT tokens FROM rb_before),
  'RB7 after rollback: ledger, attempts, consumption counter and tokens unchanged (no refund, no deletion)');
SELECT tst.ok((SELECT signature FROM public.quotes WHERE id = tst.rq(1)) = (SELECT signature FROM rb_before)
  AND (SELECT status FROM public.quotes WHERE id = tst.rq(1)) = (SELECT status FROM rb_before), 'RB8 after rollback: signature and status of the issued document unchanged');

-- no id bypass for the authority-issued document
SELECT tst.ok(tst.rscoped(tst.rq(1)) AND NOT tst.rscoped(tst.rq(3)), 'RB9 the authority-issued quote is capability-scoped; the legacy one is not');
SELECT tst.throws(format($$ SELECT public.public_approve_quote(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.rq(1)),
                  '^Quote not found or cannot be approved$', 'RB10 after rollback: the bare id cannot approve the authority-issued quote (uniform error)');

-- a NEW output after rollback: not metered by the authority (legacy path by design), nothing consumed
CREATE TEMP TABLE r2p AS SELECT tst.rprep(tst.ru(1), tst.rq(2), 'send', 'rollback-key-2') AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM r2p) = 'not_activated', 'RB11 after rollback: authorize/prepare answers not_activated (client takes the legacy path)');
SELECT tst.ok((SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.ru(1)) = 1, 'RB12 after rollback: nothing consumed by the new output');

-- legacy quote keeps the legacy id approval while not enforced
SELECT tst.lives(format($$ SELECT public.public_approve_quote(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.rq(3)),
                 'RB13 after rollback: a legacy quote keeps its legacy id approval');

ROLLBACK;
