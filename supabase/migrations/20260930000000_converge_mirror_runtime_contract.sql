-- 20260930000000_converge_mirror_runtime_contract.sql
--
-- CANONICAL CONVERGENCE, Milestone 1 (Owner-approved Codex spec). Converges the runtime schema/security contract of TEST onto
-- Production (R-1, R-2, R-3, R-4, R-6, R-8 ACL part, R-9) and carries the two Production-target least-privilege clauses (R-7
-- MAINTAIN, R-5 duplicate index). Authority for every target definition = the read-only contract captures
--   TEST       db-capture-TEST-20260930T142058Z.json        sha256 59851589b0aadcf88e9c8e733e77de64f37ae2a5099077429396b88aacc6b84d
--   PRODUCTION db-capture-PRODUCTION-20260930T175507Z.json  sha256 375b01c780cf7db2dbbf6e5c09df43348a0b04dad3e1928acd865f93d2cec3bd
-- (definition texts matched byte-exactly to the recorded per-item digests; residuals/resolved_definitions.json).
--
-- Execution contract:
--   - Applied ONLY through the governed migration path: the executor owns the transaction (BEGIN / COMMIT) and inserts the
--     ledger row. This file contains no BEGIN / COMMIT / ROLLBACK and no ledger insert.
--   - ONE transaction; every precondition runs BEFORE the first change; any failure raises a unique TK code and the executor's
--     transaction rolls back completely (nothing is changed).
--   - Converges ONLY what differs from the target: every item is classified as exactly "current = source shape" (converge) or
--     "current = target shape" (no-op); any third state refuses. A replay on a converged database changes nothing.
--   - Data-loss guards are aggregate / count-only reads (no row value is ever emitted). row_security is pinned off for this
--     transaction so a guard can never be silently filtered by RLS (a filtered read errors instead: fail closed).
--   - NOT touched (intentionally left different): table / function comments, function bodies (CRLF vs LF), the R-10 policy
--     text, migration 20260922000000's ledger row, any ledger row, any customer row value.
--   - Every catalog / function reference is schema-qualified; search_path is pinned to pg_catalog, pg_temp.
--
-- TEST-target clauses (no-ops where already canonical, e.g. on Production):
--   R-1  clients.company_name / contact_name / email, quote_items.description -> varchar(255); quote_items.unit_price /
--        total_price, quotes.subtotal / total -> numeric(10,2); quotes.tax_rate -> numeric(5,2); quotes.currency -> varchar(3).
--        Defaults are preserved exactly. Refused if any dependent other than the column's own default exists (pg_depend).
--   R-2  enum public.quote_status labels draft,sent,approved,paid -> draft,sent,accepted,paid (RENAME VALUE; the label OID and
--        sort order are unchanged). Refused unless NOTHING but column DEFAULT expressions depends on the type or its array
--        type: no column / composite attribute / domain / range / array / routine argument or result / other dependency.
--        quotes.status is TEXT - the rename changes no stored value.
--   R-3  sequence public.quotes_quote_number_seq AS bigint -> AS integer (all other parameters end equal to Production).
--   R-4  publication supabase_realtime: ADD TABLE public.quotes when absent.
--   R-9  quotes.status DEFAULT 'draft'::public.quote_status; quotes.created_at DROP NOT NULL, DEFAULT CURRENT_TIMESTAMP.
--   R-6  REVOKE INSERT (professional_domain) ON public.business_settings FROM authenticated.
--   R-8  REVOKE EXECUTE ON FUNCTION public.is_admin(), public.is_super_admin(), public.public_increment_quote_view(uuid)
--        FROM PUBLIC.
-- Production-target clauses (no-ops where already canonical, e.g. on TEST):
--   R-7  REVOKE MAINTAIN ON TABLE business_settings, chat_logs, expenses, quotecode_documents, services FROM anon,
--        authenticated (only from the roles that hold it).
--   R-5  DROP INDEX public.business_settings_user_id_idx, only after proving the canonical UNIQUE constraint
--        business_settings_user_id_unique is present, validated, immediate, unique, valid and covers exactly (user_id), and
--        that nothing depends on the duplicate index. Absent index = no-op.
--
-- Refusal codes (all abort the executor's transaction, nothing is changed):
--   TKM00 TK_M1_SESSION               search_path is not exactly 'pg_catalog, pg_temp' or row_security is not off
--   TKM01 TK_M1_COLUMN_STATE          a governed column is missing or neither its TEST-source nor its target definition
--   TKM02 TK_M1_COLUMN_DEPENDENCY     a column to be retyped has a dependent other than its own default (view, rule, policy,
--                                     index, constraint, trigger, statistics, routine ...)
--   TKM03 TK_M1_DATA_LENGTH           a value longer than 255 characters in a column being narrowed to varchar(255)
--   TKM04 TK_M1_DATA_CURRENCY         a quotes.currency value longer than 3 characters
--   TKM05 TK_M1_DATA_NUMERIC_SCALE    a numeric value that is not exactly representable at scale 2 (value <> round(value, 2))
--   TKM06 TK_M1_DATA_NUMERIC_RANGE    a numeric value outside the target precision (or NaN / Infinity)
--   TKM07 TK_M1_ENUM_LABELS           public.quote_status missing / not an enum / labels neither the TEST set nor the canonical set
--   TKM08 TK_M1_ENUM_DEPENDENCY       something other than a column DEFAULT depends on public.quote_status or its array type
--   TKM09 TK_M1_SEQUENCE_STATE        public.quotes_quote_number_seq missing or parameters neither TEST nor Production
--   TKM10 TK_M1_SEQUENCE_RANGE        sequence last_value > 2147483647 or quotes.quote_number is not integer
--   TKM11 TK_M1_PUBLICATION_MISSING   publication supabase_realtime does not exist
--   TKM12 TK_M1_PUBLICATION_STATE     supabase_realtime definition neither TEST nor Production, or not alterable by this role
--   TKM13 TK_M1_ACL_STATE             a governed ACL (column / function / table) is neither its source nor its target value
--   TKM14 TK_M1_DUP_INDEX_STATE       business_settings_user_id_idx differs from the expected definition, backs a constraint
--                                     or has dependents
--   TKM15 TK_M1_CANONICAL_CONSTRAINT  business_settings_user_id_unique missing / not UNIQUE / not validated / deferrable /
--                                     its index not unique, valid, ready, live, immediate or not exactly (user_id)
--   TKM16 TK_M1_POSTCONDITION         a converged item does not equal its target definition after the change

SET LOCAL search_path = pg_catalog, pg_temp;
SET LOCAL row_security = off;

DO $tk_m1_pre_apply$
DECLARE
  -- governed columns: source (TEST) definition -> target (Production) definition, contract text rendered under the pinned path
  c_cols constant text[][] := ARRAY[
    -- tbl, col, kind, source definition, target definition, target type, limit / precision
    ARRAY['clients', 'company_name', 'V',
          'type=character varying;notnull=true;default=;identity=;generated=;collation=default',
          'type=character varying(255);notnull=true;default=;identity=;generated=;collation=default', 'character varying(255)', '255'],
    ARRAY['clients', 'contact_name', 'V',
          'type=character varying;notnull=false;default=;identity=;generated=;collation=default',
          'type=character varying(255);notnull=false;default=;identity=;generated=;collation=default', 'character varying(255)', '255'],
    ARRAY['clients', 'email', 'V',
          'type=character varying;notnull=true;default=;identity=;generated=;collation=default',
          'type=character varying(255);notnull=true;default=;identity=;generated=;collation=default', 'character varying(255)', '255'],
    ARRAY['quote_items', 'description', 'V',
          'type=character varying;notnull=true;default=;identity=;generated=;collation=default',
          'type=character varying(255);notnull=true;default=;identity=;generated=;collation=default', 'character varying(255)', '255'],
    ARRAY['quote_items', 'total_price', 'N',
          'type=numeric;notnull=true;default=;identity=;generated=;collation=',
          'type=numeric(10,2);notnull=true;default=;identity=;generated=;collation=', 'numeric(10,2)', '10'],
    ARRAY['quote_items', 'unit_price', 'N',
          'type=numeric;notnull=true;default=;identity=;generated=;collation=',
          'type=numeric(10,2);notnull=true;default=;identity=;generated=;collation=', 'numeric(10,2)', '10'],
    ARRAY['quotes', 'currency', 'C',
          'type=character varying;notnull=false;default=''USD''::character varying;identity=;generated=;collation=default',
          'type=character varying(3);notnull=false;default=''USD''::character varying;identity=;generated=;collation=default', 'character varying(3)', '3'],
    ARRAY['quotes', 'subtotal', 'N',
          'type=numeric;notnull=false;default=0.00;identity=;generated=;collation=',
          'type=numeric(10,2);notnull=false;default=0.00;identity=;generated=;collation=', 'numeric(10,2)', '10'],
    ARRAY['quotes', 'tax_rate', 'N',
          'type=numeric;notnull=false;default=0.00;identity=;generated=;collation=',
          'type=numeric(5,2);notnull=false;default=0.00;identity=;generated=;collation=', 'numeric(5,2)', '5'],
    ARRAY['quotes', 'total', 'N',
          'type=numeric;notnull=false;default=0.00;identity=;generated=;collation=',
          'type=numeric(10,2);notnull=false;default=0.00;identity=;generated=;collation=', 'numeric(10,2)', '10'],
    ARRAY['quotes', 'status', 'S',
          'type=text;notnull=false;default=;identity=;generated=;collation=default',
          'type=text;notnull=false;default=''draft''::public.quote_status;identity=;generated=;collation=default', '', ''],
    ARRAY['quotes', 'created_at', 'T',
          'type=timestamp with time zone;notnull=true;default=now();identity=;generated=;collation=',
          'type=timestamp with time zone;notnull=false;default=CURRENT_TIMESTAMP;identity=;generated=;collation=', '', '']
  ];
  c_enum_src   constant text := 'draft,sent,approved,paid';
  c_enum_dst   constant text := 'draft,sent,accepted,paid';
  c_seq_src    constant text := 'type=bigint;start=1;inc=1;min=1;max=9223372036854775807;cycle=false;cache=1;owner=postgres';
  c_seq_dst    constant text := 'type=integer;start=1;inc=1;min=1;max=2147483647;cycle=false;cache=1;owner=postgres';
  c_pub_src    constant text := 'all=false;ins=true;upd=true;del=true;trunc=true;tables=';
  c_pub_dst    constant text := 'all=false;ins=true;upd=true;del=true;trunc=true;tables=public.quotes';
  c_colacl_src constant text := 'authenticated=aw/postgres';
  c_colacl_dst constant text := 'authenticated=w/postgres';
  -- function ACLs: signature, source (TEST), target (Production)
  c_fns constant text[][] := ARRAY[
    ARRAY['public.is_admin()',
          '=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres',
          'authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres'],
    ARRAY['public.is_super_admin()',
          '=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres',
          'authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres'],
    ARRAY['public.public_increment_quote_view(uuid)',
          '=X/postgres,anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres',
          'anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres']
  ];
  -- table ACLs: table, source (Production, holds MAINTAIN), target (canonical, no MAINTAIN for anon / authenticated)
  c_tbls constant text[][] := ARRAY[
    ARRAY['business_settings',
          'anon=m/postgres,authenticated=rm/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres',
          'authenticated=r/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['chat_logs',
          'authenticated=rm/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres',
          'authenticated=r/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['expenses',
          'anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres',
          'anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['quotecode_documents',
          'anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres',
          'anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['services',
          'anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres',
          'anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres']
  ];
  c_idx_def constant text := 'CREATE UNIQUE INDEX business_settings_user_id_idx ON public.business_settings USING btree (user_id)';
  i            integer;
  v_rel        oid;
  v_att        smallint;
  v_def        text;
  v_n          bigint;
  v_n2         bigint;
  v_plan_tbl   text[] := ARRAY[]::text[];
  v_plan_sql   text[] := ARRAY[]::text[];
  v_stmt       text;
  v_tbl        text;
  v_enum       oid;
  v_enum_arr   oid;
  v_labels     text;
  v_do_enum    boolean := false;
  v_seq        oid;
  v_last       bigint;
  v_do_seq     boolean := false;
  v_pub        oid;
  v_pub_owner  oid;
  v_do_pub     boolean := false;
  v_do_colacl  boolean := false;
  v_fn         oid;
  v_fn_revoke  text[] := ARRAY[]::text[];
  v_tbl_revoke text[] := ARRAY[]::text[];
  v_roles      text;
  v_bs         oid;
  v_idx        oid;
  v_user_att   smallint;
  v_do_idx     boolean := false;
  v_con        record;
BEGIN
  -- TKM00: the pinned session settings (SET LOCAL above) must be in effect inside the executor's transaction.
  IF pg_catalog.current_setting('search_path') COLLATE pg_catalog."C" IS DISTINCT FROM 'pg_catalog, pg_temp' COLLATE pg_catalog."C"
     OR pg_catalog.current_setting('row_security') IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'TK_M1_SESSION: search_path [%] / row_security [%] not pinned (expected [pg_catalog, pg_temp] / off)',
      pg_catalog.current_setting('search_path'), pg_catalog.current_setting('row_security') USING ERRCODE = 'TKM00';
  END IF;

  -- =========================== PHASE 1: every precondition, no change =========================================================
  -- R-1 / R-9 columns
  FOR i IN 1 .. pg_catalog.array_length(c_cols, 1) LOOP
    v_rel := pg_catalog.to_regclass('public.' || c_cols[i][1]);
    v_att := NULL; v_def := NULL;
    IF v_rel IS NOT NULL THEN
      SELECT a.attnum,
             pg_catalog.concat_ws(';',
               'type=' || pg_catalog.format_type(a.atttypid, a.atttypmod),
               'notnull=' || a.attnotnull::pg_catalog.text,
               'default=' || COALESCE(pg_catalog.pg_get_expr(ad.adbin, ad.adrelid), ''),
               'identity=' || a.attidentity::pg_catalog.text,
               'generated=' || a.attgenerated::pg_catalog.text,
               'collation=' || COALESCE((SELECT co.collname::pg_catalog.text FROM pg_catalog.pg_collation co
                                          WHERE co.oid = a.attcollation AND a.attcollation <> 0), ''))
        INTO v_att, v_def
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
       WHERE a.attrelid = v_rel AND a.attname = c_cols[i][2] AND a.attnum > 0 AND NOT a.attisdropped;
    END IF;
    IF v_att IS NULL THEN
      RAISE EXCEPTION 'TK_M1_COLUMN_STATE: public.%.% does not exist', c_cols[i][1], c_cols[i][2] USING ERRCODE = 'TKM01';
    END IF;
    IF v_def = c_cols[i][5] THEN
      CONTINUE; -- already the target definition: no-op
    END IF;
    IF v_def IS DISTINCT FROM c_cols[i][4] THEN
      RAISE EXCEPTION 'TK_M1_COLUMN_STATE: public.%.% definition [%] is neither the source [%] nor the target [%]',
        c_cols[i][1], c_cols[i][2], v_def, c_cols[i][4], c_cols[i][5] USING ERRCODE = 'TKM01';
    END IF;
    IF c_cols[i][3] IN ('V', 'C', 'N') THEN
      -- TKM02: nothing but the column's own default may depend on a column whose type changes.
      SELECT pg_catalog.count(*) INTO v_n
        FROM pg_catalog.pg_depend d
       WHERE d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid = v_rel AND d.refobjsubid = v_att
         AND NOT (d.classid = 'pg_catalog.pg_attrdef'::pg_catalog.regclass
                  AND d.objid IN (SELECT ad.oid FROM pg_catalog.pg_attrdef ad WHERE ad.adrelid = v_rel AND ad.adnum = v_att));
      IF v_n <> 0 THEN
        RAISE EXCEPTION 'TK_M1_COLUMN_DEPENDENCY: % object(s) depend on public.%.% - refusing to retype it', v_n, c_cols[i][1], c_cols[i][2]
          USING ERRCODE = 'TKM02';
      END IF;
    END IF;
    -- data-loss guards: aggregate counts only, never a row value
    IF c_cols[i][3] IN ('V', 'C') THEN
      EXECUTE pg_catalog.format('SELECT pg_catalog.count(*) FROM public.%I WHERE pg_catalog.char_length(%I) > %s',
                                c_cols[i][1], c_cols[i][2], c_cols[i][7]::integer) INTO v_n;
      IF v_n <> 0 AND c_cols[i][3] = 'C' THEN
        RAISE EXCEPTION 'TK_M1_DATA_CURRENCY: % row(s) of public.%.% are longer than % characters', v_n, c_cols[i][1], c_cols[i][2], c_cols[i][7]
          USING ERRCODE = 'TKM04';
      ELSIF v_n <> 0 THEN
        RAISE EXCEPTION 'TK_M1_DATA_LENGTH: % row(s) of public.%.% are longer than % characters', v_n, c_cols[i][1], c_cols[i][2], c_cols[i][7]
          USING ERRCODE = 'TKM03';
      END IF;
    ELSIF c_cols[i][3] = 'N' THEN
      -- target numeric(p,2): exact iff value = round(value, 2) and abs(value) < 10^(p-2); NaN / Infinity fail the range test.
      EXECUTE pg_catalog.format('SELECT pg_catalog.count(*) FILTER (WHERE %1$I <> pg_catalog.round(%1$I, 2)),'
                                ' pg_catalog.count(*) FILTER (WHERE NOT (pg_catalog.abs(%1$I) < %2$s::pg_catalog.numeric)) FROM public.%3$I',
                                c_cols[i][2], pg_catalog.power(10::pg_catalog.numeric, c_cols[i][7]::integer - 2)::pg_catalog.int8, c_cols[i][1])
        INTO v_n, v_n2;
      IF v_n <> 0 THEN
        RAISE EXCEPTION 'TK_M1_DATA_NUMERIC_SCALE: % row(s) of public.%.% have more than 2 decimal places', v_n, c_cols[i][1], c_cols[i][2]
          USING ERRCODE = 'TKM05';
      END IF;
      IF v_n2 <> 0 THEN
        RAISE EXCEPTION 'TK_M1_DATA_NUMERIC_RANGE: % row(s) of public.%.% do not fit %', v_n2, c_cols[i][1], c_cols[i][2], c_cols[i][6]
          USING ERRCODE = 'TKM06';
      END IF;
    END IF;
    -- plan the clause (executed in phase 2, one ALTER TABLE per table)
    v_plan_tbl := v_plan_tbl || c_cols[i][1];
    v_plan_sql := v_plan_sql || CASE c_cols[i][3]
      WHEN 'S' THEN pg_catalog.format('ALTER COLUMN %I SET DEFAULT ''draft''::public.quote_status', c_cols[i][2])
      WHEN 'T' THEN pg_catalog.format('ALTER COLUMN %1$I DROP NOT NULL, ALTER COLUMN %1$I SET DEFAULT CURRENT_TIMESTAMP', c_cols[i][2])
      ELSE pg_catalog.format('ALTER COLUMN %I TYPE %s', c_cols[i][2], c_cols[i][6]) END;
  END LOOP;

  -- R-2 enum
  v_enum := pg_catalog.to_regtype('public.quote_status')::oid;
  IF v_enum IS NULL OR (SELECT t.typtype FROM pg_catalog.pg_type t WHERE t.oid = v_enum) IS DISTINCT FROM 'e' THEN
    RAISE EXCEPTION 'TK_M1_ENUM_LABELS: public.quote_status does not exist or is not an enum' USING ERRCODE = 'TKM07';
  END IF;
  SELECT pg_catalog.string_agg(e.enumlabel::pg_catalog.text, ',' ORDER BY e.enumsortorder) INTO v_labels
    FROM pg_catalog.pg_enum e WHERE e.enumtypid = v_enum;
  IF v_labels IS DISTINCT FROM c_enum_dst THEN
    IF v_labels IS DISTINCT FROM c_enum_src THEN
      RAISE EXCEPTION 'TK_M1_ENUM_LABELS: public.quote_status labels [%] are neither [%] nor [%]', v_labels, c_enum_src, c_enum_dst
        USING ERRCODE = 'TKM07';
    END IF;
    v_enum_arr := (SELECT t.typarray FROM pg_catalog.pg_type t WHERE t.oid = v_enum);
    -- TKM08: no stored value of the type may exist anywhere; only column DEFAULT expressions may reference it.
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_attribute a
     WHERE a.atttypid IN (v_enum, v_enum_arr) AND NOT a.attisdropped;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_M1_ENUM_DEPENDENCY: % column(s) / attribute(s) are typed public.quote_status or its array', v_n USING ERRCODE = 'TKM08';
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_type t
     WHERE t.oid <> v_enum_arr AND (t.typbasetype IN (v_enum, v_enum_arr) OR t.typelem IN (v_enum, v_enum_arr));
    SELECT v_n + pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_range r WHERE r.rngsubtype IN (v_enum, v_enum_arr);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_M1_ENUM_DEPENDENCY: % domain / array / range type(s) are built on public.quote_status', v_n USING ERRCODE = 'TKM08';
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_proc p
     WHERE p.prorettype IN (v_enum, v_enum_arr)
        OR v_enum = ANY (p.proargtypes::pg_catalog.oid[]) OR v_enum_arr = ANY (p.proargtypes::pg_catalog.oid[])
        OR v_enum = ANY (COALESCE(p.proallargtypes, ARRAY[]::pg_catalog.oid[]))
        OR v_enum_arr = ANY (COALESCE(p.proallargtypes, ARRAY[]::pg_catalog.oid[]));
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_M1_ENUM_DEPENDENCY: % routine(s) take or return public.quote_status', v_n USING ERRCODE = 'TKM08';
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_depend d
     WHERE d.refclassid = 'pg_catalog.pg_type'::pg_catalog.regclass AND d.refobjid IN (v_enum, v_enum_arr)
       AND d.classid <> 'pg_catalog.pg_attrdef'::pg_catalog.regclass
       AND NOT (d.classid = 'pg_catalog.pg_type'::pg_catalog.regclass AND d.objid = v_enum_arr);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_M1_ENUM_DEPENDENCY: % non-DEFAULT object(s) depend on public.quote_status', v_n USING ERRCODE = 'TKM08';
    END IF;
    v_do_enum := true;
  END IF;

  -- R-3 sequence
  v_seq := pg_catalog.to_regclass('public.quotes_quote_number_seq');
  SELECT pg_catalog.concat_ws(';', 'type=' || s.data_type::pg_catalog.text, 'start=' || s.start_value::pg_catalog.text,
           'inc=' || s.increment_by::pg_catalog.text, 'min=' || s.min_value::pg_catalog.text, 'max=' || s.max_value::pg_catalog.text,
           'cycle=' || s.cycle::pg_catalog.text, 'cache=' || s.cache_size::pg_catalog.text, 'owner=' || s.sequenceowner::pg_catalog.text)
    INTO v_def
    FROM pg_catalog.pg_sequences s WHERE s.schemaname = 'public' AND s.sequencename = 'quotes_quote_number_seq';
  IF v_seq IS NULL OR v_def IS NULL OR v_def NOT IN (c_seq_src, c_seq_dst) THEN
    RAISE EXCEPTION 'TK_M1_SEQUENCE_STATE: public.quotes_quote_number_seq [%] is neither [%] nor [%]', v_def, c_seq_src, c_seq_dst
      USING ERRCODE = 'TKM09';
  END IF;
  IF v_def = c_seq_src THEN
    EXECUTE 'SELECT last_value FROM public.quotes_quote_number_seq' INTO v_last;
    IF v_last > 2147483647 OR v_last < -2147483648 THEN
      RAISE EXCEPTION 'TK_M1_SEQUENCE_RANGE: public.quotes_quote_number_seq last_value does not fit integer' USING ERRCODE = 'TKM10';
    END IF;
    IF (SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = pg_catalog.to_regclass('public.quotes') AND a.attname = 'quote_number' AND NOT a.attisdropped)
       IS DISTINCT FROM 'integer' THEN
      RAISE EXCEPTION 'TK_M1_SEQUENCE_RANGE: public.quotes.quote_number is not integer' USING ERRCODE = 'TKM10';
    END IF;
    v_do_seq := true;
  END IF;

  -- R-4 publication
  SELECT pb.oid, pb.pubowner,
         pg_catalog.concat_ws(';', 'all=' || pb.puballtables::pg_catalog.text, 'ins=' || pb.pubinsert::pg_catalog.text,
           'upd=' || pb.pubupdate::pg_catalog.text, 'del=' || pb.pubdelete::pg_catalog.text, 'trunc=' || pb.pubtruncate::pg_catalog.text,
           'tables=' || COALESCE((SELECT pg_catalog.string_agg(pt.schemaname::pg_catalog.text || '.' || pt.tablename::pg_catalog.text, ','
                                           ORDER BY pt.schemaname::pg_catalog.text || '.' || pt.tablename::pg_catalog.text COLLATE pg_catalog."C")
                                    FROM pg_catalog.pg_publication_tables pt WHERE pt.pubname = pb.pubname), ''))
    INTO v_pub, v_pub_owner, v_def
    FROM pg_catalog.pg_publication pb WHERE pb.pubname = 'supabase_realtime';
  IF v_pub IS NULL THEN
    RAISE EXCEPTION 'TK_M1_PUBLICATION_MISSING: publication supabase_realtime does not exist' USING ERRCODE = 'TKM11';
  END IF;
  IF v_def NOT IN (c_pub_src, c_pub_dst) THEN
    RAISE EXCEPTION 'TK_M1_PUBLICATION_STATE: supabase_realtime [%] is neither [%] nor [%]', v_def, c_pub_src, c_pub_dst USING ERRCODE = 'TKM12';
  END IF;
  IF v_def = c_pub_src THEN
    IF NOT pg_catalog.pg_has_role(v_pub_owner, 'USAGE') THEN
      RAISE EXCEPTION 'TK_M1_PUBLICATION_STATE: the current role cannot alter publication supabase_realtime (owner %)',
        pg_catalog.pg_get_userbyid(v_pub_owner) USING ERRCODE = 'TKM12';
    END IF;
    v_do_pub := true;
  END IF;

  -- R-6 column ACL
  SELECT (SELECT COALESCE(pg_catalog.string_agg(x::pg_catalog.text, ',' ORDER BY x::pg_catalog.text COLLATE pg_catalog."C"), '<empty>')
            FROM pg_catalog.unnest(a.attacl) AS x)
    INTO v_def
    FROM pg_catalog.pg_attribute a
   WHERE a.attrelid = pg_catalog.to_regclass('public.business_settings') AND a.attname = 'professional_domain' AND NOT a.attisdropped;
  IF v_def IS NULL OR v_def NOT IN (c_colacl_src, c_colacl_dst) THEN
    RAISE EXCEPTION 'TK_M1_ACL_STATE: business_settings.professional_domain column ACL [%] is neither [%] nor [%]', v_def, c_colacl_src, c_colacl_dst
      USING ERRCODE = 'TKM13';
  END IF;
  v_do_colacl := (v_def = c_colacl_src);

  -- R-8 function ACLs
  FOR i IN 1 .. pg_catalog.array_length(c_fns, 1) LOOP
    v_fn := pg_catalog.to_regprocedure(c_fns[i][1])::oid;
    v_def := NULL;
    SELECT CASE WHEN p.proacl IS NULL THEN '<default>'
                ELSE (SELECT COALESCE(pg_catalog.string_agg(x::pg_catalog.text, ',' ORDER BY x::pg_catalog.text COLLATE pg_catalog."C"), '')
                        FROM pg_catalog.unnest(p.proacl) AS x) END
      INTO v_def FROM pg_catalog.pg_proc p WHERE p.oid = v_fn;
    IF v_fn IS NULL OR v_def IS NULL OR v_def NOT IN (c_fns[i][2], c_fns[i][3]) THEN
      RAISE EXCEPTION 'TK_M1_ACL_STATE: % ACL [%] is neither [%] nor [%]', c_fns[i][1], v_def, c_fns[i][2], c_fns[i][3] USING ERRCODE = 'TKM13';
    END IF;
    IF v_def = c_fns[i][2] THEN
      v_fn_revoke := v_fn_revoke || c_fns[i][1];
    END IF;
  END LOOP;

  -- R-7 table ACLs (Production-target)
  FOR i IN 1 .. pg_catalog.array_length(c_tbls, 1) LOOP
    v_rel := pg_catalog.to_regclass('public.' || c_tbls[i][1]);
    v_def := NULL;
    SELECT CASE WHEN c.relacl IS NULL THEN '<default>'
                ELSE (SELECT COALESCE(pg_catalog.string_agg(x::pg_catalog.text, ',' ORDER BY x::pg_catalog.text COLLATE pg_catalog."C"), '')
                        FROM pg_catalog.unnest(c.relacl) AS x) END
      INTO v_def FROM pg_catalog.pg_class c WHERE c.oid = v_rel AND c.relkind = 'r';
    IF v_rel IS NULL OR v_def IS NULL OR v_def NOT IN (c_tbls[i][2], c_tbls[i][3]) THEN
      RAISE EXCEPTION 'TK_M1_ACL_STATE: public.% ACL [%] is neither [%] nor [%]', c_tbls[i][1], v_def, c_tbls[i][2], c_tbls[i][3] USING ERRCODE = 'TKM13';
    END IF;
    IF v_def = c_tbls[i][2] THEN
      v_tbl_revoke := v_tbl_revoke || c_tbls[i][1];
    END IF;
  END LOOP;

  -- R-5 duplicate index (Production-target)
  v_bs := pg_catalog.to_regclass('public.business_settings');
  v_idx := pg_catalog.to_regclass('public.business_settings_user_id_idx');
  IF v_idx IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class c ON c.oid = x.indexrelid
                    WHERE x.indexrelid = v_idx AND x.indrelid = v_bs AND c.relkind = 'i')
       OR pg_catalog.pg_get_indexdef(v_idx) IS DISTINCT FROM c_idx_def THEN
      RAISE EXCEPTION 'TK_M1_DUP_INDEX_STATE: public.business_settings_user_id_idx is not [%]', c_idx_def USING ERRCODE = 'TKM14';
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_depend d
     WHERE (d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid = v_idx)
        OR (d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.objid = v_idx AND d.refclassid = 'pg_catalog.pg_constraint'::pg_catalog.regclass);
    SELECT v_n + pg_catalog.count(*) INTO v_n FROM pg_catalog.pg_constraint co WHERE co.conindid = v_idx;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TK_M1_DUP_INDEX_STATE: public.business_settings_user_id_idx backs a constraint or has % dependent(s)', v_n USING ERRCODE = 'TKM14';
    END IF;
    v_user_att := (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = v_bs AND a.attname = 'user_id' AND NOT a.attisdropped);
    SELECT co.contype, co.convalidated, co.condeferrable, co.condeferred, co.conkey,
           x.indisunique, x.indisvalid, x.indisready, x.indislive, x.indimmediate, x.indnatts, x.indnkeyatts,
           x.indkey[0] AS indkey0, x.indexprs IS NULL AS noexprs, x.indpred IS NULL AS nopred, x.indrelid
      INTO v_con
      FROM pg_catalog.pg_constraint co
      LEFT JOIN pg_catalog.pg_index x ON x.indexrelid = co.conindid
     WHERE co.conrelid = v_bs AND co.conname = 'business_settings_user_id_unique';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TK_M1_CANONICAL_CONSTRAINT: business_settings_user_id_unique does not exist - refusing to drop the duplicate index'
        USING ERRCODE = 'TKM15';
    END IF;
    IF v_con.contype IS DISTINCT FROM 'u' OR v_con.convalidated IS NOT TRUE OR v_con.condeferrable IS NOT FALSE OR v_con.condeferred IS NOT FALSE
       OR v_con.conkey IS DISTINCT FROM ARRAY[v_user_att]
       OR v_con.indisunique IS NOT TRUE OR v_con.indisvalid IS NOT TRUE OR v_con.indisready IS NOT TRUE OR v_con.indislive IS NOT TRUE
       OR v_con.indimmediate IS NOT TRUE OR v_con.indnatts IS DISTINCT FROM 1::smallint OR v_con.indnkeyatts IS DISTINCT FROM 1::smallint
       OR v_con.indkey0 IS DISTINCT FROM v_user_att OR v_con.noexprs IS NOT TRUE OR v_con.nopred IS NOT TRUE OR v_con.indrelid IS DISTINCT FROM v_bs THEN
      RAISE EXCEPTION 'TK_M1_CANONICAL_CONSTRAINT: business_settings_user_id_unique is not a validated, immediate UNIQUE constraint with a valid unique index on exactly (user_id) - refusing to drop the duplicate index'
        USING ERRCODE = 'TKM15';
    END IF;
    v_do_idx := true;
  END IF;

  -- =========================== PHASE 2: converge exactly what differs =========================================================
  FOREACH v_tbl IN ARRAY ARRAY['clients', 'quote_items', 'quotes'] LOOP
    v_stmt := NULL;
    FOR i IN 1 .. COALESCE(pg_catalog.array_length(v_plan_tbl, 1), 0) LOOP
      IF v_plan_tbl[i] = v_tbl THEN
        v_stmt := COALESCE(v_stmt || ', ', '') || v_plan_sql[i];
      END IF;
    END LOOP;
    IF v_stmt IS NOT NULL THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.%I %s', v_tbl, v_stmt);
    END IF;
  END LOOP;
  IF v_do_enum THEN
    EXECUTE 'ALTER TYPE public.quote_status RENAME VALUE ''approved'' TO ''accepted''';
  END IF;
  IF v_do_seq THEN
    EXECUTE 'ALTER SEQUENCE public.quotes_quote_number_seq AS integer';
  END IF;
  IF v_do_pub THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.quotes';
  END IF;
  IF v_do_colacl THEN
    EXECUTE 'REVOKE INSERT (professional_domain) ON TABLE public.business_settings FROM authenticated';
  END IF;
  FOREACH v_stmt IN ARRAY v_fn_revoke LOOP
    EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_stmt);
  END LOOP;
  FOREACH v_tbl IN ARRAY v_tbl_revoke LOOP
    SELECT pg_catalog.string_agg(pg_catalog.quote_ident(r.rolname::pg_catalog.text), ', ' ORDER BY r.rolname::pg_catalog.text COLLATE pg_catalog."C")
      INTO v_roles
      FROM pg_catalog.pg_class c
      CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) AS ax
      JOIN pg_catalog.pg_roles r ON r.oid = ax.grantee
     WHERE c.oid = pg_catalog.to_regclass('public.' || v_tbl) AND ax.privilege_type = 'MAINTAIN' AND r.rolname IN ('anon', 'authenticated');
    IF v_roles IS NOT NULL THEN
      EXECUTE pg_catalog.format('REVOKE MAINTAIN ON TABLE public.%I FROM %s', v_tbl, v_roles);
    END IF;
  END LOOP;
  IF v_do_idx THEN
    EXECUTE 'DROP INDEX public.business_settings_user_id_idx RESTRICT';
  END IF;
END
$tk_m1_pre_apply$;

-- =========================== PHASE 3: post-conditions, re-derived from the catalogs ========================================
DO $tk_m1_post$
DECLARE
  c_cols constant text[][] := ARRAY[
    ARRAY['clients', 'company_name', 'type=character varying(255);notnull=true;default=;identity=;generated=;collation=default'],
    ARRAY['clients', 'contact_name', 'type=character varying(255);notnull=false;default=;identity=;generated=;collation=default'],
    ARRAY['clients', 'email', 'type=character varying(255);notnull=true;default=;identity=;generated=;collation=default'],
    ARRAY['quote_items', 'description', 'type=character varying(255);notnull=true;default=;identity=;generated=;collation=default'],
    ARRAY['quote_items', 'total_price', 'type=numeric(10,2);notnull=true;default=;identity=;generated=;collation='],
    ARRAY['quote_items', 'unit_price', 'type=numeric(10,2);notnull=true;default=;identity=;generated=;collation='],
    ARRAY['quotes', 'currency', 'type=character varying(3);notnull=false;default=''USD''::character varying;identity=;generated=;collation=default'],
    ARRAY['quotes', 'subtotal', 'type=numeric(10,2);notnull=false;default=0.00;identity=;generated=;collation='],
    ARRAY['quotes', 'tax_rate', 'type=numeric(5,2);notnull=false;default=0.00;identity=;generated=;collation='],
    ARRAY['quotes', 'total', 'type=numeric(10,2);notnull=false;default=0.00;identity=;generated=;collation='],
    ARRAY['quotes', 'status', 'type=text;notnull=false;default=''draft''::public.quote_status;identity=;generated=;collation=default'],
    ARRAY['quotes', 'created_at', 'type=timestamp with time zone;notnull=false;default=CURRENT_TIMESTAMP;identity=;generated=;collation=']
  ];
  c_fns constant text[][] := ARRAY[
    ARRAY['public.is_admin()', 'authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres'],
    ARRAY['public.is_super_admin()', 'authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres'],
    ARRAY['public.public_increment_quote_view(uuid)', 'anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres']
  ];
  c_tbls constant text[][] := ARRAY[
    ARRAY['business_settings', 'authenticated=r/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['chat_logs', 'authenticated=r/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['expenses', 'anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['quotecode_documents', 'anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres'],
    ARRAY['services', 'anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres']
  ];
  i      integer;
  v_def  text;
BEGIN
  FOR i IN 1 .. pg_catalog.array_length(c_cols, 1) LOOP
    SELECT pg_catalog.concat_ws(';',
             'type=' || pg_catalog.format_type(a.atttypid, a.atttypmod),
             'notnull=' || a.attnotnull::pg_catalog.text,
             'default=' || COALESCE(pg_catalog.pg_get_expr(ad.adbin, ad.adrelid), ''),
             'identity=' || a.attidentity::pg_catalog.text,
             'generated=' || a.attgenerated::pg_catalog.text,
             'collation=' || COALESCE((SELECT co.collname::pg_catalog.text FROM pg_catalog.pg_collation co
                                        WHERE co.oid = a.attcollation AND a.attcollation <> 0), ''))
      INTO v_def
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
     WHERE a.attrelid = pg_catalog.to_regclass('public.' || c_cols[i][1]) AND a.attname = c_cols[i][2] AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_def IS DISTINCT FROM c_cols[i][3] THEN
      RAISE EXCEPTION 'TK_M1_POSTCONDITION: col:public.%.% is [%], expected [%]', c_cols[i][1], c_cols[i][2], v_def, c_cols[i][3] USING ERRCODE = 'TKM16';
    END IF;
  END LOOP;

  SELECT pg_catalog.string_agg(e.enumlabel::pg_catalog.text, ',' ORDER BY e.enumsortorder) INTO v_def
    FROM pg_catalog.pg_enum e WHERE e.enumtypid = pg_catalog.to_regtype('public.quote_status')::oid;
  IF v_def IS DISTINCT FROM 'draft,sent,accepted,paid' THEN
    RAISE EXCEPTION 'TK_M1_POSTCONDITION: typ:public.quote_status labels [%]', v_def USING ERRCODE = 'TKM16';
  END IF;

  SELECT pg_catalog.concat_ws(';', 'type=' || s.data_type::pg_catalog.text, 'start=' || s.start_value::pg_catalog.text,
           'inc=' || s.increment_by::pg_catalog.text, 'min=' || s.min_value::pg_catalog.text, 'max=' || s.max_value::pg_catalog.text,
           'cycle=' || s.cycle::pg_catalog.text, 'cache=' || s.cache_size::pg_catalog.text, 'owner=' || s.sequenceowner::pg_catalog.text)
    INTO v_def
    FROM pg_catalog.pg_sequences s WHERE s.schemaname = 'public' AND s.sequencename = 'quotes_quote_number_seq';
  IF v_def IS DISTINCT FROM 'type=integer;start=1;inc=1;min=1;max=2147483647;cycle=false;cache=1;owner=postgres' THEN
    RAISE EXCEPTION 'TK_M1_POSTCONDITION: seq:public.quotes_quote_number_seq is [%]', v_def USING ERRCODE = 'TKM16';
  END IF;

  SELECT pg_catalog.concat_ws(';', 'all=' || pb.puballtables::pg_catalog.text, 'ins=' || pb.pubinsert::pg_catalog.text,
           'upd=' || pb.pubupdate::pg_catalog.text, 'del=' || pb.pubdelete::pg_catalog.text, 'trunc=' || pb.pubtruncate::pg_catalog.text,
           'tables=' || COALESCE((SELECT pg_catalog.string_agg(pt.schemaname::pg_catalog.text || '.' || pt.tablename::pg_catalog.text, ','
                                           ORDER BY pt.schemaname::pg_catalog.text || '.' || pt.tablename::pg_catalog.text COLLATE pg_catalog."C")
                                    FROM pg_catalog.pg_publication_tables pt WHERE pt.pubname = pb.pubname), ''))
    INTO v_def
    FROM pg_catalog.pg_publication pb WHERE pb.pubname = 'supabase_realtime';
  IF v_def IS DISTINCT FROM 'all=false;ins=true;upd=true;del=true;trunc=true;tables=public.quotes' THEN
    RAISE EXCEPTION 'TK_M1_POSTCONDITION: pub:supabase_realtime is [%]', v_def USING ERRCODE = 'TKM16';
  END IF;

  SELECT (SELECT COALESCE(pg_catalog.string_agg(x::pg_catalog.text, ',' ORDER BY x::pg_catalog.text COLLATE pg_catalog."C"), '<empty>')
            FROM pg_catalog.unnest(a.attacl) AS x)
    INTO v_def
    FROM pg_catalog.pg_attribute a
   WHERE a.attrelid = pg_catalog.to_regclass('public.business_settings') AND a.attname = 'professional_domain' AND NOT a.attisdropped;
  IF v_def IS DISTINCT FROM 'authenticated=w/postgres' THEN
    RAISE EXCEPTION 'TK_M1_POSTCONDITION: colacl:public.business_settings.professional_domain is [%]', v_def USING ERRCODE = 'TKM16';
  END IF;

  FOR i IN 1 .. pg_catalog.array_length(c_fns, 1) LOOP
    SELECT (SELECT COALESCE(pg_catalog.string_agg(x::pg_catalog.text, ',' ORDER BY x::pg_catalog.text COLLATE pg_catalog."C"), '')
              FROM pg_catalog.unnest(p.proacl) AS x)
      INTO v_def FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(c_fns[i][1])::oid;
    IF v_def IS DISTINCT FROM c_fns[i][2] THEN
      RAISE EXCEPTION 'TK_M1_POSTCONDITION: fn:% ACL is [%], expected [%]', c_fns[i][1], v_def, c_fns[i][2] USING ERRCODE = 'TKM16';
    END IF;
  END LOOP;

  FOR i IN 1 .. pg_catalog.array_length(c_tbls, 1) LOOP
    SELECT (SELECT COALESCE(pg_catalog.string_agg(x::pg_catalog.text, ',' ORDER BY x::pg_catalog.text COLLATE pg_catalog."C"), '')
              FROM pg_catalog.unnest(c.relacl) AS x)
      INTO v_def FROM pg_catalog.pg_class c WHERE c.oid = pg_catalog.to_regclass('public.' || c_tbls[i][1]);
    IF v_def IS DISTINCT FROM c_tbls[i][2] THEN
      RAISE EXCEPTION 'TK_M1_POSTCONDITION: tbl:public.% ACL is [%], expected [%]', c_tbls[i][1], v_def, c_tbls[i][2] USING ERRCODE = 'TKM16';
    END IF;
  END LOOP;

  IF pg_catalog.to_regclass('public.business_settings_user_id_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'TK_M1_POSTCONDITION: idx:public.business_settings_user_id_idx still exists' USING ERRCODE = 'TKM16';
  END IF;
END
$tk_m1_post$;
