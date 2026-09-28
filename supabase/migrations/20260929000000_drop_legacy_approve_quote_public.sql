-- 20260929000000_drop_legacy_approve_quote_public.sql
--
-- SECURITY FIX (Owner decision after independent Codex review, 2026-09-28: remediation APPROVED FOR PREPARATION).
-- Drops EXACTLY public.approve_quote_public(uuid) and public.approve_quote_public(uuid, text): legacy, pre-git,
-- Production-native SECURITY DEFINER functions with no authorization / state / expiry / signature checks, EXECUTE held by
-- PUBLIC, anon and authenticated (fresh read-only probe 2026-09-28T20:51Z). No frontend, Edge Function, database object or
-- migration calls them. The supported approval RPC public.public_approve_quote(uuid, text) (OD-9 + OD-1, migration
-- 20260922000000) is NOT modified - its definition hash and ACL are asserted unchanged before and after.
--
-- Execution contract:
--   - Applied ONLY through the governed migration path (one-migration executor profile): the executor owns the transaction
--     (BEGIN / COMMIT) and inserts the ledger row. This file contains no BEGIN / COMMIT / ROLLBACK and no ledger insert.
--   - Idempotent across environments: on TEST (the two functions never existed) every check passes and both DROPs are
--     no-ops; on Production both are dropped. A replay after success is a no-op as well (the executor refuses replays).
--   - RESTRICT only (never CASCADE). No GRANT / REVOKE on any other object.
--   - FORWARD-FIX ONLY: there is no rollback that recreates the vulnerable functions. The draft rollback script kept in the
--     review evidence package (p0/aqp/draft-rollback-restore-legacy-approve_quote_public.sql) is NEVER APPLY - historical
--     review material only; it must never be executed against any environment.
--   - Every catalog / function reference is schema-qualified and search_path is pinned to pg_catalog, pg_temp for this
--     transaction.
--
-- Refusal codes (all abort the executor's transaction, nothing is changed):
--   TKA00 TK_AQP_SEARCH_PATH              search_path is not exactly the pinned 'pg_catalog, pg_temp' (SET LOCAL not in effect)
--   TKA01 TK_AQP_UNEXPECTED_OVERLOAD      an approve_quote_public overload other than the two known signatures exists
--   TKA02 TK_AQP_UNEXPECTED_DEFINITION    a known overload exists but its definition differs from the probed vulnerable body
--   TKA03 TK_AQP_DEPENDENCY               an object depends on one of the overloads (normal / auto pg_depend, a trigger /
--                                         event trigger), or any OTHER routine body / policy / rule / trigger text names it
--   TKA04 TK_AQP_CANONICAL_MISSING        public.public_approve_quote(uuid, text) does not exist
--   TKA05 TK_AQP_CANONICAL_DEFINITION     public.public_approve_quote definition hash differs from the expected constant
--   TKA06 TK_AQP_CANONICAL_ACL            public.public_approve_quote ACL / owner differs from the expected constant
--   TKA07 TK_AQP_POST_STILL_PRESENT       an approve_quote_public overload still exists after the DROP
--
-- Expected constants (provenance: p0/aqp-fix/EXPECTED_CONSTANTS.md; fresh probes security-probe-aqp-PRODUCTION-
-- 20260928T205133Z.json and security-probe-aqp-TEST-20260928T205140Z.json, equal on both environments where applicable):
--   public_approve_quote(uuid, text) definition sha256 = eab641c566ec6776c0f3a389e6ba80d7e7f204d1479194f681ca51e838aeb855
--   public_approve_quote(uuid, text) ACL (aclitems sorted, COLLATE "C") = anon=X/postgres,authenticated=X/postgres,postgres=X/postgres
--   public_approve_quote(uuid, text) owner = postgres
--   approve_quote_public(uuid)       definition sha256 = b50d1c880ba4f260eeea7925c33ca49d1d2dbed76730b4ba69f3b7af2b0a9a31
--   approve_quote_public(uuid, text) definition sha256 = e36067ab64ff0c8d52a5eb200e175565a160ba3cac1880b6924573197cf17d7b
--   (definition sha256 = sha256(convert_to(pg_get_functiondef(oid), 'UTF8')), exactly as the probe computed it)

SET LOCAL search_path = pg_catalog, pg_temp;

DO $tk_aqp_pre$
DECLARE
  c_canonical_sha  constant text := 'eab641c566ec6776c0f3a389e6ba80d7e7f204d1479194f681ca51e838aeb855';
  c_canonical_acl  constant text := 'anon=X/postgres,authenticated=X/postgres,postgres=X/postgres';
  c_canonical_own  constant text := 'postgres';
  c_legacy1_sha    constant text := 'b50d1c880ba4f260eeea7925c33ca49d1d2dbed76730b4ba69f3b7af2b0a9a31';
  c_legacy2_sha    constant text := 'e36067ab64ff0c8d52a5eb200e175565a160ba3cac1880b6924573197cf17d7b';
  v_legacy1        oid := pg_catalog.to_regprocedure('public.approve_quote_public(uuid)')::oid;
  v_legacy2        oid := pg_catalog.to_regprocedure('public.approve_quote_public(uuid,text)')::oid;
  v_canonical      oid := pg_catalog.to_regprocedure('public.public_approve_quote(uuid,text)')::oid;
  v_legacy         oid[];
  v_n              bigint;
  v_sha            text;
  v_acl            text;
  v_owner          text;
BEGIN
  -- TKA00: prove the pinned search_path (SET LOCAL above) is in effect inside the executor's transaction.
  IF pg_catalog.current_setting('search_path') COLLATE pg_catalog."C" IS DISTINCT FROM 'pg_catalog, pg_temp' COLLATE pg_catalog."C" THEN
    RAISE EXCEPTION 'TK_AQP_SEARCH_PATH: search_path is [%], expected [pg_catalog, pg_temp] - SET LOCAL not in effect (not inside the executor transaction?)',
      pg_catalog.current_setting('search_path') USING ERRCODE = 'TKA00';
  END IF;

  -- TKA01: third-overload refusal (0, 1 or 2 of the two known signatures are allowed; anything else is not).
  SELECT pg_catalog.count(*) INTO v_n
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'approve_quote_public'
     AND p.oid IS DISTINCT FROM v_legacy1 AND p.oid IS DISTINCT FROM v_legacy2;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TK_AQP_UNEXPECTED_OVERLOAD: % unexpected public.approve_quote_public overload(s) exist', v_n USING ERRCODE = 'TKA01';
  END IF;

  -- TKA02: the known overloads, when present, must be exactly the probed vulnerable bodies (anything else = re-assess).
  IF v_legacy1 IS NOT NULL THEN
    v_sha := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(v_legacy1), 'UTF8')), 'hex');
    IF v_sha IS DISTINCT FROM c_legacy1_sha THEN
      RAISE EXCEPTION 'TK_AQP_UNEXPECTED_DEFINITION: public.approve_quote_public(uuid) definition sha256 % differs from the probed %', v_sha, c_legacy1_sha USING ERRCODE = 'TKA02';
    END IF;
  END IF;
  IF v_legacy2 IS NOT NULL THEN
    v_sha := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(v_legacy2), 'UTF8')), 'hex');
    IF v_sha IS DISTINCT FROM c_legacy2_sha THEN
      RAISE EXCEPTION 'TK_AQP_UNEXPECTED_DEFINITION: public.approve_quote_public(uuid, text) definition sha256 % differs from the probed %', v_sha, c_legacy2_sha USING ERRCODE = 'TKA02';
    END IF;
  END IF;

  -- TKA03: dependency refusal. Any normal ('n') or auto ('a') dependency ON either overload (views, SQL-body functions,
  -- policies, triggers, rewrite rules, event triggers, column defaults ...) refuses; role/default-ACL links live in
  -- pg_shdepend and are dropped with the function. Triggers are also checked directly.
  v_legacy := pg_catalog.array_remove(ARRAY[v_legacy1, v_legacy2], NULL::oid);
  IF pg_catalog.cardinality(v_legacy) > 0 THEN
    SELECT pg_catalog.count(*) INTO v_n
      FROM pg_catalog.pg_depend d
     WHERE d.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
       AND d.refobjid = ANY (v_legacy)
       AND d.deptype IN ('n', 'a');
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % object(s) depend on public.approve_quote_public - refusing (no CASCADE)', v_n USING ERRCODE = 'TKA03';
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_trigger t WHERE t.tgfoid = ANY (v_legacy);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % trigger(s) call public.approve_quote_public - refusing', v_n USING ERRCODE = 'TKA03';
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_event_trigger e WHERE e.evtfoid = ANY (v_legacy);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % event trigger(s) call public.approve_quote_public - refusing', v_n USING ERRCODE = 'TKA03';
    END IF;
  END IF;

  -- TKA03 (text references, checked whether or not the overloads exist): PL/pgSQL and other non-SQL-body routines are
  -- invisible to pg_depend, so ANY other routine (any schema, prokind f/p) whose source names approve_quote_public refuses;
  -- likewise any policy expression, rewrite rule, or trigger definition / arguments text. The canonical
  -- public.public_approve_quote body does not contain the substring (verified in both probe JSONs).
  SELECT pg_catalog.count(*) INTO v_n
    FROM pg_catalog.pg_proc p
   WHERE p.prokind IN ('f', 'p')
     AND p.oid IS DISTINCT FROM v_legacy1 AND p.oid IS DISTINCT FROM v_legacy2
     AND pg_catalog.strpos(COALESCE(p.prosrc, '') COLLATE pg_catalog."C", 'approve_quote_public' COLLATE pg_catalog."C") > 0;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % other routine(s) reference approve_quote_public in their source - refusing', v_n USING ERRCODE = 'TKA03';
  END IF;
  SELECT pg_catalog.count(*) INTO v_n
    FROM pg_catalog.pg_policy pol
   WHERE pg_catalog.strpos((COALESCE(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
                            COALESCE(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')) COLLATE pg_catalog."C",
                           'approve_quote_public' COLLATE pg_catalog."C") > 0;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % policy expression(s) reference approve_quote_public - refusing', v_n USING ERRCODE = 'TKA03';
  END IF;
  SELECT pg_catalog.count(*) INTO v_n
    FROM pg_catalog.pg_rewrite r
   WHERE pg_catalog.strpos(COALESCE(pg_catalog.pg_get_ruledef(r.oid), '') COLLATE pg_catalog."C", 'approve_quote_public' COLLATE pg_catalog."C") > 0;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % rewrite rule(s) / view(s) reference approve_quote_public - refusing', v_n USING ERRCODE = 'TKA03';
  END IF;
  SELECT pg_catalog.count(*) INTO v_n
    FROM pg_catalog.pg_trigger t
   WHERE NOT t.tgisinternal
     AND pg_catalog.strpos((pg_catalog.pg_get_triggerdef(t.oid) || ' ' || pg_catalog.encode(t.tgargs, 'escape')) COLLATE pg_catalog."C",
                           'approve_quote_public' COLLATE pg_catalog."C") > 0;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TK_AQP_DEPENDENCY: % trigger definition(s) / argument list(s) reference approve_quote_public - refusing', v_n USING ERRCODE = 'TKA03';
  END IF;

  -- TKA04..TKA06: the canonical approval RPC must exist, byte-identical in definition, with the canonical ACL and owner.
  IF v_canonical IS NULL THEN
    RAISE EXCEPTION 'TK_AQP_CANONICAL_MISSING: public.public_approve_quote(uuid, text) does not exist' USING ERRCODE = 'TKA04';
  END IF;
  v_sha := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(v_canonical), 'UTF8')), 'hex');
  IF v_sha IS DISTINCT FROM c_canonical_sha THEN
    RAISE EXCEPTION 'TK_AQP_CANONICAL_DEFINITION: public.public_approve_quote definition sha256 % != expected %', v_sha, c_canonical_sha USING ERRCODE = 'TKA05';
  END IF;
  SELECT (SELECT pg_catalog.string_agg(a::pg_catalog.text, ',' ORDER BY a::pg_catalog.text COLLATE pg_catalog."C") FROM pg_catalog.unnest(p.proacl) AS a),
         pg_catalog.pg_get_userbyid(p.proowner)::pg_catalog.text
    INTO v_acl, v_owner
    FROM pg_catalog.pg_proc p WHERE p.oid = v_canonical;
  IF v_acl IS DISTINCT FROM c_canonical_acl OR v_owner IS DISTINCT FROM c_canonical_own THEN
    RAISE EXCEPTION 'TK_AQP_CANONICAL_ACL: public.public_approve_quote ACL [%] owner [%] != expected [%] [%]', v_acl, v_owner, c_canonical_acl, c_canonical_own USING ERRCODE = 'TKA06';
  END IF;
END
$tk_aqp_pre$;

DROP FUNCTION IF EXISTS public.approve_quote_public(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.approve_quote_public(uuid, text) RESTRICT;

DO $tk_aqp_post$
DECLARE
  c_canonical_sha  constant text := 'eab641c566ec6776c0f3a389e6ba80d7e7f204d1479194f681ca51e838aeb855';
  c_canonical_acl  constant text := 'anon=X/postgres,authenticated=X/postgres,postgres=X/postgres';
  c_canonical_own  constant text := 'postgres';
  v_canonical      oid := pg_catalog.to_regprocedure('public.public_approve_quote(uuid,text)')::oid;
  v_n              bigint;
  v_sha            text;
  v_acl            text;
  v_owner          text;
BEGIN
  SELECT pg_catalog.count(*) INTO v_n
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'approve_quote_public';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TK_AQP_POST_STILL_PRESENT: % public.approve_quote_public overload(s) remain', v_n USING ERRCODE = 'TKA07';
  END IF;
  IF v_canonical IS NULL THEN
    RAISE EXCEPTION 'TK_AQP_CANONICAL_MISSING: public.public_approve_quote(uuid, text) disappeared' USING ERRCODE = 'TKA04';
  END IF;
  v_sha := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(v_canonical), 'UTF8')), 'hex');
  IF v_sha IS DISTINCT FROM c_canonical_sha THEN
    RAISE EXCEPTION 'TK_AQP_CANONICAL_DEFINITION: public.public_approve_quote definition changed (sha256 %)', v_sha USING ERRCODE = 'TKA05';
  END IF;
  SELECT (SELECT pg_catalog.string_agg(a::pg_catalog.text, ',' ORDER BY a::pg_catalog.text COLLATE pg_catalog."C") FROM pg_catalog.unnest(p.proacl) AS a),
         pg_catalog.pg_get_userbyid(p.proowner)::pg_catalog.text
    INTO v_acl, v_owner
    FROM pg_catalog.pg_proc p WHERE p.oid = v_canonical;
  IF v_acl IS DISTINCT FROM c_canonical_acl OR v_owner IS DISTINCT FROM c_canonical_own THEN
    RAISE EXCEPTION 'TK_AQP_CANONICAL_ACL: public.public_approve_quote ACL [%] owner [%] changed', v_acl, v_owner USING ERRCODE = 'TKA06';
  END IF;
END
$tk_aqp_post$;
