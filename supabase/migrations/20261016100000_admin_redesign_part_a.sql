-- ============================================================================================================================
-- 20261016100000_admin_redesign_part_a.sql  -  admin redesign part A (server side): billing period in the account summary, the admin
-- dashboard summary and the paged admin accounts list
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) כולל החלטות D-01 עד D-08 ..."
--   (spec docs/CODEX_SPEC_ADMIN_REDESIGN_2026-10-16.md section 10, contracts 1-3). Read-only additions; nothing is written, no data
--   changes, no phase changes.
--   1. account_billing_period(uuid): 'month' | 'year' | NULL - ONLY from the ACTIVE subscription's real price version
--      (subscriptions -> checkout_attempts.plan_price_id -> price_versions.billing_period) for the entitled plan; conflicting periods
--      or a disagreeing package_period give NULL. Never from the legacy plan field, never defaulting to month (D-06).
--   2. account_summary_build: body = 20261011100000 + 'billingPeriod' (same signature; grants kept).
--   3. admin_market_of(text): the SQL twin of src/utils/adminMarket.js resolveAdminMarket (country list generated from
--      src/utils/adminCountries.json).
--   4. admin_account_status(uuid): the SQL twin of src/domain/subscriptions/subscriptionStatus.js accountStatus.
--   5. get_admin_dashboard_summary(): super_admin only - managed accounts, registrations 24h, app entries 10 min (last_sign_in, not
--      presence), market and status counts, plan-system state.
--   6. get_admin_accounts(...): super_admin only - search / market / status filters, allow-listed sort, page of 1-100 rows + total.
--   Managed account = role is not super_admin, email does not start with deleted_, business name is not "deleted" (the client rule).
--   Re-runnable: CREATE OR REPLACE only.
-- ============================================================================================================================

-- 1. billing period of the active subscription ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_billing_period(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent    public.account_entitlements%ROWTYPE;
  v_period text;
BEGIN
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND OR v_ent.account_mode IS DISTINCT FROM 'paid' OR v_ent.subscription_status IS DISTINCT FROM 'active' THEN
    RETURN NULL;
  END IF;
  SELECT CASE WHEN count(DISTINCT p.billing_period) = 1 THEN min(p.billing_period) END INTO v_period
    FROM public.subscriptions s
    JOIN public.checkout_attempts c ON c.attempt_id = s.attempt_id AND c.user_id = s.user_id
    JOIN public.price_versions p ON p.price_id = c.plan_price_id
   WHERE s.user_id = p_user_id AND s.status = 'active'
     AND p.plan_id = coalesce(v_ent.package_id, v_ent.style_plan_id);
  IF v_ent.package_period IS NOT NULL AND v_period IS DISTINCT FROM v_ent.package_period THEN
    v_period := NULL;
  END IF;
  RETURN v_period;
END
$function$;
REVOKE ALL ON FUNCTION public.account_billing_period(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 2. account_summary_build (body = 20261011100000 + billingPeriod) ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_summary_build(p_user_id uuid, p_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_out      text;
  v_cat      text;
  v_bill     text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_market   text;
  v_reserved integer;
  v_active   bigint;
  v_pcv      text;
  v_legacy   jsonb := NULL;
  v_res      jsonb;
BEGIN
  IF p_admin THEN
    SELECT jsonb_build_object('plan', b.plan, 'trialEndsAt', b.trial_ends_at, 'isLifetime', b.is_lifetime) INTO v_legacy
      FROM public.business_settings b WHERE b.user_id = p_user_id;
    v_legacy := coalesce(v_legacy, jsonb_build_object('plan', NULL, 'trialEndsAt', NULL, 'isLifetime', NULL));
  END IF;
  SELECT a.phase INTO v_out FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_out IS NULL OR v_out = 'prepared' THEN
    v_res := jsonb_build_object('ok', false, 'code', 'not_activated');
    RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    v_res := jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
    RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
  END IF;
  SELECT a.phase INTO v_cat FROM public.subscription_activation a WHERE a.component = 'catalog_capacity';
  SELECT b.phase INTO v_bill FROM public.billing_activation b WHERE b.id;
  SELECT m.market INTO v_market FROM public.account_market m WHERE m.user_id = p_user_id;
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  SELECT count(*) INTO v_active FROM public.services s WHERE s.user_id = p_user_id;
  IF v_market IS NOT NULL THEN
    SELECT 'pv1:' || left(encode(sha256(convert_to(string_agg(p.price_id || ':' || p.amount_minor || ':' || p.currency || ':'
                                                              || p.valid_from, ',' ORDER BY p.price_id), 'UTF8')), 'hex'), 16)
      INTO v_pcv FROM public.price_versions p WHERE p.market = v_market;
  END IF;
  v_res := jsonb_build_object(
    'ok', true,
    'schema', 'account-summary/v1',
    'version', v_ent.entitlement_version,
    'phase', jsonb_build_object('output', v_out, 'catalog', coalesce(v_cat, 'prepared'), 'billing', coalesce(v_bill, 'off')),
    'market', v_market,
    'plan', jsonb_build_object('id', CASE WHEN v_ent.account_mode = 'free_10' THEN 'free'
                                          WHEN v_ent.package_id IS NOT NULL THEN v_ent.package_id
                                          ELSE v_ent.style_plan_id END),
    'subscriptionStatus', v_ent.subscription_status,
    'billingPeriod', public.account_billing_period(p_user_id),
    'capabilities', to_jsonb(public.subscription_account_capabilities(p_user_id)),
    'eligiblePlans', '{}'::jsonb,
    'free10', CASE WHEN v_ent.account_mode = 'free_10' THEN jsonb_build_object(
                'limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
                'remaining', greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0)) END,
    'catalog', jsonb_build_object(
                'active', v_active,
                'countDefinition', 'unset',
                'limit', CASE WHEN v_ent.account_mode = 'paid' THEN 100 + 100 * v_ent.catalog_expansion_blocks END,
                'blocks', v_ent.catalog_expansion_blocks,
                'limitDecided', v_ent.account_mode = 'paid'),
    'priceCatalogVersion', v_pcv);
  RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
END
$function$;
REVOKE ALL ON FUNCTION public.account_summary_build(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 3. market of a stored country (twin of resolveAdminMarket) ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_market_of(p_country text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_value text := regexp_replace(coalesce(p_country, ''), '^\s+|\s+$', '', 'g');
  v_code  text;
BEGIN
  IF v_value IN ('Local', 'LCL') THEN RETURN 'Local'; END IF;
  IF v_value = 'International' THEN RETURN 'International'; END IF;
  SELECT c.code INTO v_code FROM (VALUES
      ('af', 'AF'),
      ('afghanistan', 'AF'),
      ('ax', 'AX'),
      ('aland islands', 'AX'),
      ('al', 'AL'),
      ('albania', 'AL'),
      ('dz', 'DZ'),
      ('algeria', 'DZ'),
      ('as', 'AS'),
      ('american samoa', 'AS'),
      ('ad', 'AD'),
      ('andorra', 'AD'),
      ('ao', 'AO'),
      ('angola', 'AO'),
      ('ai', 'AI'),
      ('anguilla', 'AI'),
      ('aq', 'AQ'),
      ('antarctica', 'AQ'),
      ('ag', 'AG'),
      ('antigua and barbuda', 'AG'),
      ('ar', 'AR'),
      ('argentina', 'AR'),
      ('am', 'AM'),
      ('armenia', 'AM'),
      ('aw', 'AW'),
      ('aruba', 'AW'),
      ('au', 'AU'),
      ('australia', 'AU'),
      ('at', 'AT'),
      ('austria', 'AT'),
      ('az', 'AZ'),
      ('azerbaijan', 'AZ'),
      ('bs', 'BS'),
      ('bahamas', 'BS'),
      ('bh', 'BH'),
      ('bahrain', 'BH'),
      ('bd', 'BD'),
      ('bangladesh', 'BD'),
      ('bb', 'BB'),
      ('barbados', 'BB'),
      ('by', 'BY'),
      ('belarus', 'BY'),
      ('be', 'BE'),
      ('belgium', 'BE'),
      ('bz', 'BZ'),
      ('belize', 'BZ'),
      ('bj', 'BJ'),
      ('benin', 'BJ'),
      ('bm', 'BM'),
      ('bermuda', 'BM'),
      ('bt', 'BT'),
      ('bhutan', 'BT'),
      ('bo', 'BO'),
      ('bolivia', 'BO'),
      ('bq', 'BQ'),
      ('bonaire, sint eustatius and saba', 'BQ'),
      ('ba', 'BA'),
      ('bosnia and herzegovina', 'BA'),
      ('bw', 'BW'),
      ('botswana', 'BW'),
      ('bv', 'BV'),
      ('bouvet island', 'BV'),
      ('br', 'BR'),
      ('brazil', 'BR'),
      ('io', 'IO'),
      ('british indian ocean territory', 'IO'),
      ('bn', 'BN'),
      ('brunei darussalam', 'BN'),
      ('bg', 'BG'),
      ('bulgaria', 'BG'),
      ('bf', 'BF'),
      ('burkina faso', 'BF'),
      ('bi', 'BI'),
      ('burundi', 'BI'),
      ('cv', 'CV'),
      ('cabo verde', 'CV'),
      ('kh', 'KH'),
      ('cambodia', 'KH'),
      ('cm', 'CM'),
      ('cameroon', 'CM'),
      ('ca', 'CA'),
      ('canada', 'CA'),
      ('ky', 'KY'),
      ('cayman islands', 'KY'),
      ('cf', 'CF'),
      ('central african republic', 'CF'),
      ('td', 'TD'),
      ('chad', 'TD'),
      ('cl', 'CL'),
      ('chile', 'CL'),
      ('cn', 'CN'),
      ('china', 'CN'),
      ('cx', 'CX'),
      ('christmas island', 'CX'),
      ('cc', 'CC'),
      ('cocos (keeling) islands', 'CC'),
      ('co', 'CO'),
      ('colombia', 'CO'),
      ('km', 'KM'),
      ('comoros', 'KM'),
      ('ck', 'CK'),
      ('cook islands', 'CK'),
      ('cr', 'CR'),
      ('costa rica', 'CR'),
      ('hr', 'HR'),
      ('croatia', 'HR'),
      ('cu', 'CU'),
      ('cuba', 'CU'),
      ('cw', 'CW'),
      ('curaçao', 'CW'),
      ('cy', 'CY'),
      ('cyprus', 'CY'),
      ('cz', 'CZ'),
      ('czech republic', 'CZ'),
      ('ci', 'CI'),
      ('côte d''ivoire', 'CI'),
      ('cd', 'CD'),
      ('democratic republic of the congo', 'CD'),
      ('dk', 'DK'),
      ('denmark', 'DK'),
      ('dj', 'DJ'),
      ('djibouti', 'DJ'),
      ('dm', 'DM'),
      ('dominica', 'DM'),
      ('do', 'DO'),
      ('dominican republic', 'DO'),
      ('ec', 'EC'),
      ('ecuador', 'EC'),
      ('eg', 'EG'),
      ('egypt', 'EG'),
      ('sv', 'SV'),
      ('el salvador', 'SV'),
      ('gq', 'GQ'),
      ('equatorial guinea', 'GQ'),
      ('er', 'ER'),
      ('eritrea', 'ER'),
      ('ee', 'EE'),
      ('estonia', 'EE'),
      ('sz', 'SZ'),
      ('eswatini', 'SZ'),
      ('et', 'ET'),
      ('ethiopia', 'ET'),
      ('fk', 'FK'),
      ('falkland islands', 'FK'),
      ('fo', 'FO'),
      ('faroe islands', 'FO'),
      ('fm', 'FM'),
      ('federated states of micronesia', 'FM'),
      ('fj', 'FJ'),
      ('fiji', 'FJ'),
      ('fi', 'FI'),
      ('finland', 'FI'),
      ('fr', 'FR'),
      ('france', 'FR'),
      ('gf', 'GF'),
      ('french guiana', 'GF'),
      ('pf', 'PF'),
      ('french polynesia', 'PF'),
      ('tf', 'TF'),
      ('french southern territories', 'TF'),
      ('ga', 'GA'),
      ('gabon', 'GA'),
      ('gm', 'GM'),
      ('gambia', 'GM'),
      ('ge', 'GE'),
      ('georgia', 'GE'),
      ('de', 'DE'),
      ('germany', 'DE'),
      ('gh', 'GH'),
      ('ghana', 'GH'),
      ('gi', 'GI'),
      ('gibraltar', 'GI'),
      ('gr', 'GR'),
      ('greece', 'GR'),
      ('gl', 'GL'),
      ('greenland', 'GL'),
      ('gd', 'GD'),
      ('grenada', 'GD'),
      ('gp', 'GP'),
      ('guadeloupe', 'GP'),
      ('gu', 'GU'),
      ('guam', 'GU'),
      ('gt', 'GT'),
      ('guatemala', 'GT'),
      ('gg', 'GG'),
      ('guernsey', 'GG'),
      ('gn', 'GN'),
      ('guinea', 'GN'),
      ('gw', 'GW'),
      ('guinea-bissau', 'GW'),
      ('gy', 'GY'),
      ('guyana', 'GY'),
      ('ht', 'HT'),
      ('haiti', 'HT'),
      ('hm', 'HM'),
      ('heard island and mcdonald islands', 'HM'),
      ('va', 'VA'),
      ('holy see', 'VA'),
      ('hn', 'HN'),
      ('honduras', 'HN'),
      ('hk', 'HK'),
      ('hong kong', 'HK'),
      ('hu', 'HU'),
      ('hungary', 'HU'),
      ('is', 'IS'),
      ('iceland', 'IS'),
      ('in', 'IN'),
      ('india', 'IN'),
      ('id', 'ID'),
      ('indonesia', 'ID'),
      ('ir', 'IR'),
      ('iran', 'IR'),
      ('iq', 'IQ'),
      ('iraq', 'IQ'),
      ('ie', 'IE'),
      ('ireland', 'IE'),
      ('im', 'IM'),
      ('isle of man', 'IM'),
      ('il', 'IL'),
      ('israel', 'IL'),
      ('it', 'IT'),
      ('italy', 'IT'),
      ('jm', 'JM'),
      ('jamaica', 'JM'),
      ('jp', 'JP'),
      ('japan', 'JP'),
      ('je', 'JE'),
      ('jersey', 'JE'),
      ('jo', 'JO'),
      ('jordan', 'JO'),
      ('kz', 'KZ'),
      ('kazakhstan', 'KZ'),
      ('ke', 'KE'),
      ('kenya', 'KE'),
      ('ki', 'KI'),
      ('kiribati', 'KI'),
      ('kw', 'KW'),
      ('kuwait', 'KW'),
      ('kg', 'KG'),
      ('kyrgyzstan', 'KG'),
      ('la', 'LA'),
      ('laos', 'LA'),
      ('lv', 'LV'),
      ('latvia', 'LV'),
      ('lb', 'LB'),
      ('lebanon', 'LB'),
      ('ls', 'LS'),
      ('lesotho', 'LS'),
      ('lr', 'LR'),
      ('liberia', 'LR'),
      ('ly', 'LY'),
      ('libya', 'LY'),
      ('li', 'LI'),
      ('liechtenstein', 'LI'),
      ('lt', 'LT'),
      ('lithuania', 'LT'),
      ('lu', 'LU'),
      ('luxembourg', 'LU'),
      ('mo', 'MO'),
      ('macau', 'MO'),
      ('mg', 'MG'),
      ('madagascar', 'MG'),
      ('mw', 'MW'),
      ('malawi', 'MW'),
      ('my', 'MY'),
      ('malaysia', 'MY'),
      ('mv', 'MV'),
      ('maldives', 'MV'),
      ('ml', 'ML'),
      ('mali', 'ML'),
      ('mt', 'MT'),
      ('malta', 'MT'),
      ('mh', 'MH'),
      ('marshall islands', 'MH'),
      ('mq', 'MQ'),
      ('martinique', 'MQ'),
      ('mr', 'MR'),
      ('mauritania', 'MR'),
      ('mu', 'MU'),
      ('mauritius', 'MU'),
      ('yt', 'YT'),
      ('mayotte', 'YT'),
      ('mx', 'MX'),
      ('mexico', 'MX'),
      ('md', 'MD'),
      ('moldova', 'MD'),
      ('mc', 'MC'),
      ('monaco', 'MC'),
      ('mn', 'MN'),
      ('mongolia', 'MN'),
      ('me', 'ME'),
      ('montenegro', 'ME'),
      ('ms', 'MS'),
      ('montserrat', 'MS'),
      ('ma', 'MA'),
      ('morocco', 'MA'),
      ('mz', 'MZ'),
      ('mozambique', 'MZ'),
      ('mm', 'MM'),
      ('myanmar', 'MM'),
      ('na', 'NA'),
      ('namibia', 'NA'),
      ('nr', 'NR'),
      ('nauru', 'NR'),
      ('np', 'NP'),
      ('nepal', 'NP'),
      ('nl', 'NL'),
      ('netherlands', 'NL'),
      ('nc', 'NC'),
      ('new caledonia', 'NC'),
      ('nz', 'NZ'),
      ('new zealand', 'NZ'),
      ('ni', 'NI'),
      ('nicaragua', 'NI'),
      ('ne', 'NE'),
      ('niger', 'NE'),
      ('ng', 'NG'),
      ('nigeria', 'NG'),
      ('nu', 'NU'),
      ('niue', 'NU'),
      ('nf', 'NF'),
      ('norfolk island', 'NF'),
      ('kp', 'KP'),
      ('north korea', 'KP'),
      ('mk', 'MK'),
      ('north macedonia', 'MK'),
      ('mp', 'MP'),
      ('northern mariana islands', 'MP'),
      ('no', 'NO'),
      ('norway', 'NO'),
      ('om', 'OM'),
      ('oman', 'OM'),
      ('pk', 'PK'),
      ('pakistan', 'PK'),
      ('pw', 'PW'),
      ('palau', 'PW'),
      ('pa', 'PA'),
      ('panama', 'PA'),
      ('pg', 'PG'),
      ('papua new guinea', 'PG'),
      ('py', 'PY'),
      ('paraguay', 'PY'),
      ('pe', 'PE'),
      ('peru', 'PE'),
      ('ph', 'PH'),
      ('philippines', 'PH'),
      ('pn', 'PN'),
      ('pitcairn', 'PN'),
      ('pl', 'PL'),
      ('poland', 'PL'),
      ('pt', 'PT'),
      ('portugal', 'PT'),
      ('pr', 'PR'),
      ('puerto rico', 'PR'),
      ('qa', 'QA'),
      ('qatar', 'QA'),
      ('cg', 'CG'),
      ('republic of the congo', 'CG'),
      ('ro', 'RO'),
      ('romania', 'RO'),
      ('ru', 'RU'),
      ('russia', 'RU'),
      ('rw', 'RW'),
      ('rwanda', 'RW'),
      ('re', 'RE'),
      ('réunion', 'RE'),
      ('bl', 'BL'),
      ('saint barthélemy', 'BL'),
      ('sh', 'SH'),
      ('saint helena, ascension and tristan da cunha', 'SH'),
      ('kn', 'KN'),
      ('saint kitts and nevis', 'KN'),
      ('lc', 'LC'),
      ('saint lucia', 'LC'),
      ('mf', 'MF'),
      ('saint martin', 'MF'),
      ('pm', 'PM'),
      ('saint pierre and miquelon', 'PM'),
      ('vc', 'VC'),
      ('saint vincent and the grenadines', 'VC'),
      ('ws', 'WS'),
      ('samoa', 'WS'),
      ('sm', 'SM'),
      ('san marino', 'SM'),
      ('st', 'ST'),
      ('sao tome and principe', 'ST'),
      ('sa', 'SA'),
      ('saudi arabia', 'SA'),
      ('sn', 'SN'),
      ('senegal', 'SN'),
      ('rs', 'RS'),
      ('serbia', 'RS'),
      ('sc', 'SC'),
      ('seychelles', 'SC'),
      ('sl', 'SL'),
      ('sierra leone', 'SL'),
      ('sg', 'SG'),
      ('singapore', 'SG'),
      ('sx', 'SX'),
      ('sint maarten', 'SX'),
      ('sk', 'SK'),
      ('slovakia', 'SK'),
      ('si', 'SI'),
      ('slovenia', 'SI'),
      ('sb', 'SB'),
      ('solomon islands', 'SB'),
      ('so', 'SO'),
      ('somalia', 'SO'),
      ('za', 'ZA'),
      ('south africa', 'ZA'),
      ('gs', 'GS'),
      ('south georgia and the south sandwich islands', 'GS'),
      ('kr', 'KR'),
      ('south korea', 'KR'),
      ('ss', 'SS'),
      ('south sudan', 'SS'),
      ('es', 'ES'),
      ('spain', 'ES'),
      ('lk', 'LK'),
      ('sri lanka', 'LK'),
      ('ps', 'PS'),
      ('state of palestine', 'PS'),
      ('sd', 'SD'),
      ('sudan', 'SD'),
      ('sr', 'SR'),
      ('suriname', 'SR'),
      ('sj', 'SJ'),
      ('svalbard and jan mayen', 'SJ'),
      ('se', 'SE'),
      ('sweden', 'SE'),
      ('ch', 'CH'),
      ('switzerland', 'CH'),
      ('sy', 'SY'),
      ('syria', 'SY'),
      ('tw', 'TW'),
      ('taiwan', 'TW'),
      ('tj', 'TJ'),
      ('tajikistan', 'TJ'),
      ('tz', 'TZ'),
      ('tanzania', 'TZ'),
      ('th', 'TH'),
      ('thailand', 'TH'),
      ('tl', 'TL'),
      ('timor-leste', 'TL'),
      ('tg', 'TG'),
      ('togo', 'TG'),
      ('tk', 'TK'),
      ('tokelau', 'TK'),
      ('to', 'TO'),
      ('tonga', 'TO'),
      ('tt', 'TT'),
      ('trinidad and tobago', 'TT'),
      ('tn', 'TN'),
      ('tunisia', 'TN'),
      ('tm', 'TM'),
      ('turkmenistan', 'TM'),
      ('tc', 'TC'),
      ('turks and caicos islands', 'TC'),
      ('tv', 'TV'),
      ('tuvalu', 'TV'),
      ('tr', 'TR'),
      ('türkiye', 'TR'),
      ('ug', 'UG'),
      ('uganda', 'UG'),
      ('ua', 'UA'),
      ('ukraine', 'UA'),
      ('ae', 'AE'),
      ('united arab emirates', 'AE'),
      ('gb', 'GB'),
      ('united kingdom', 'GB'),
      ('um', 'UM'),
      ('united states minor outlying islands', 'UM'),
      ('us', 'US'),
      ('united states of america', 'US'),
      ('uy', 'UY'),
      ('uruguay', 'UY'),
      ('uz', 'UZ'),
      ('uzbekistan', 'UZ'),
      ('vu', 'VU'),
      ('vanuatu', 'VU'),
      ('ve', 'VE'),
      ('venezuela', 'VE'),
      ('vn', 'VN'),
      ('vietnam', 'VN'),
      ('vg', 'VG'),
      ('virgin islands (british)', 'VG'),
      ('vi', 'VI'),
      ('virgin islands (u.s.)', 'VI'),
      ('wf', 'WF'),
      ('wallis and futuna', 'WF'),
      ('eh', 'EH'),
      ('western sahara', 'EH'),
      ('ye', 'YE'),
      ('yemen', 'YE'),
      ('zm', 'ZM'),
      ('zambia', 'ZM'),
      ('zw', 'ZW'),
      ('zimbabwe', 'ZW'),
      ('uk', 'GB'),
      ('united states', 'US')
    ) AS c(name, code) WHERE c.name = lower(v_value);
  IF v_code IS NULL THEN RETURN 'Unknown'; END IF;
  RETURN CASE WHEN v_code = 'IL' THEN 'Local' ELSE 'International' END;
END
$function$;
REVOKE ALL ON FUNCTION public.admin_market_of(text) FROM PUBLIC, anon, authenticated, service_role;

-- 4. one subscription status per account (twin of subscriptionStatus.js accountStatus) ------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_account_status(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_b      public.business_settings%ROWTYPE;
  v_ent    public.account_entitlements%ROWTYPE;
  v_out    text;
  v_period text;
BEGIN
  SELECT * INTO v_b FROM public.business_settings b WHERE b.user_id = p_user_id;
  IF v_b.is_lifetime IS TRUE THEN RETURN 'lifetime'; END IF;
  SELECT a.phase INTO v_out FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_out IS NOT NULL AND v_out <> 'prepared' THEN
    SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
    IF FOUND THEN
      IF v_ent.subscription_status = 'active' THEN
        v_period := public.account_billing_period(p_user_id);
        RETURN CASE v_period WHEN 'year' THEN 'paid_annual' WHEN 'month' THEN 'paid_monthly' ELSE 'paid_unverified' END;
      END IF;
      IF v_ent.account_mode = 'free_10' AND v_out = 'enforced' THEN RETURN 'free10'; END IF;
    END IF;
  END IF;
  IF v_b.trial_ends_at IS NOT NULL THEN
    RETURN CASE WHEN v_b.trial_ends_at > now() THEN 'trial' ELSE 'trial_ended' END;
  END IF;
  RETURN 'free10_inactive';
END
$function$;
REVOKE ALL ON FUNCTION public.admin_account_status(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 5. admin dashboard summary ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_phase text;
  v_res   jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = v_uid AND b.role = 'super_admin') THEN
    RAISE EXCEPTION 'get_admin_dashboard_summary: super_admin required' USING ERRCODE = '42501';
  END IF;
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  WITH m AS (
    SELECT b.created_at, b.last_sign_in, public.admin_market_of(b.country) AS market, public.admin_account_status(b.user_id) AS status
      FROM public.business_settings b
     WHERE b.role IS DISTINCT FROM 'super_admin'
       AND lower(coalesce(b.email, '')) NOT LIKE 'deleted\_%'
       AND lower(coalesce(b.business_name, '')) <> 'deleted'
  )
  SELECT jsonb_build_object(
    'schema', 'admin-dashboard-summary/v1',
    'generatedAt', now(),
    'managedAccounts', count(*),
    'registrationsLast24h', count(*) FILTER (WHERE m.created_at > now() - interval '24 hours' AND m.created_at <= now()),
    'signedInLast10m', count(*) FILTER (WHERE m.last_sign_in >= now() - interval '10 minutes' AND m.last_sign_in <= now()),
    'market', jsonb_build_object(
      'Local', count(*) FILTER (WHERE m.market = 'Local'),
      'International', count(*) FILTER (WHERE m.market = 'International'),
      'Unknown', count(*) FILTER (WHERE m.market = 'Unknown')),
    'subscriptionStatus', jsonb_build_object(
      'lifetime', count(*) FILTER (WHERE m.status = 'lifetime'),
      'paid_annual', count(*) FILTER (WHERE m.status = 'paid_annual'),
      'paid_monthly', count(*) FILTER (WHERE m.status = 'paid_monthly'),
      'paid_unverified', count(*) FILTER (WHERE m.status = 'paid_unverified'),
      'free10', count(*) FILTER (WHERE m.status = 'free10'),
      'trial', count(*) FILTER (WHERE m.status = 'trial'),
      'trial_ended', count(*) FILTER (WHERE m.status = 'trial_ended'),
      'free10_inactive', count(*) FILTER (WHERE m.status = 'free10_inactive')),
    'planSystem', CASE WHEN v_phase IS NULL OR v_phase = 'prepared' THEN 'not_active' ELSE 'active' END)
    INTO v_res FROM m;
  RETURN v_res;
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_dashboard_summary() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;

-- 6. paged admin accounts list -----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_accounts(
  p_query text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_direction text DEFAULT 'desc',
  p_page_size integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_ids bigint[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_query text := nullif(lower(regexp_replace(coalesce(p_query, ''), '^\s+|\s+$', '', 'g')), '');
  v_total bigint;
  v_rows  jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = v_uid AND b.role = 'super_admin') THEN
    RAISE EXCEPTION 'get_admin_accounts: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_sort IS NULL OR p_sort NOT IN ('created_at', 'last_sign_in', 'business_name', 'country', 'plan', 'indicators')
     OR p_direction IS NULL OR p_direction NOT IN ('asc', 'desc')
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 OR p_offset IS NULL OR p_offset < 0
     OR (p_market IS NOT NULL AND p_market NOT IN ('Local', 'International', 'Unknown'))
     OR (p_status IS NOT NULL AND p_status NOT IN ('lifetime', 'paid_annual', 'paid_monthly', 'paid_unverified', 'free10', 'trial',
                                                    'trial_ended', 'free10_inactive')) THEN
    RAISE EXCEPTION 'get_admin_accounts: invalid argument' USING ERRCODE = '22023';
  END IF;
  WITH m AS (
    SELECT b.id, b.user_id, b.business_name, b.email, b.phone, b.address, b.tax_id, b.country, b.currency, b.role, b.is_lifetime,
           b.trial_ends_at, b.created_at, b.last_sign_in,
           public.admin_market_of(b.country) AS market, public.admin_account_status(b.user_id) AS status
      FROM public.business_settings b
     WHERE b.role IS DISTINCT FROM 'super_admin'
       AND lower(coalesce(b.email, '')) NOT LIKE 'deleted\_%'
       AND lower(coalesce(b.business_name, '')) <> 'deleted'
       AND (p_ids IS NULL OR b.id = ANY (p_ids))
       AND (v_query IS NULL OR position(v_query IN lower(coalesce(b.business_name, '') || ' ' || coalesce(b.email, ''))) > 0)
  ), f AS (
    SELECT * FROM m WHERE (p_market IS NULL OR m.market = p_market) AND (p_status IS NULL OR m.status = p_status)
  ), ranked AS (
    SELECT f.*, row_number() OVER (ORDER BY
       CASE WHEN p_sort = 'created_at' AND p_direction = 'asc' THEN coalesce(f.created_at, 'epoch') END ASC,
         CASE WHEN p_sort = 'created_at' AND p_direction = 'desc' THEN coalesce(f.created_at, 'epoch') END DESC,
         CASE WHEN p_sort = 'last_sign_in' AND p_direction = 'asc' THEN coalesce(f.last_sign_in, 'epoch') END ASC,
         CASE WHEN p_sort = 'last_sign_in' AND p_direction = 'desc' THEN coalesce(f.last_sign_in, 'epoch') END DESC,
         CASE WHEN p_sort = 'business_name' AND p_direction = 'asc' THEN lower(coalesce(f.business_name, '')) END ASC,
         CASE WHEN p_sort = 'business_name' AND p_direction = 'desc' THEN lower(coalesce(f.business_name, '')) END DESC,
         CASE WHEN p_sort = 'country' AND p_direction = 'asc' THEN coalesce(f.country, 'Local') END ASC,
         CASE WHEN p_sort = 'country' AND p_direction = 'desc' THEN coalesce(f.country, 'Local') END DESC,
         -- plan: the shared status order (src/domain/subscriptions/subscriptionStatus.js ACCOUNT_STATUS_ORDER)
         CASE WHEN p_sort = 'plan' AND p_direction = 'asc' THEN array_position(ARRAY['free10', 'trial', 'trial_ended', 'paid_monthly',
           'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified'], f.status) END ASC,
         CASE WHEN p_sort = 'plan' AND p_direction = 'desc' THEN array_position(ARRAY['free10', 'trial', 'trial_ended', 'paid_monthly',
           'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified'], f.status) END DESC,
         -- indicators: the shown indicator group (verified, usage not verified, legacy trial, legacy trial ended, payment unverified, none)
         CASE WHEN p_sort = 'indicators' AND p_direction = 'asc' THEN CASE f.status WHEN 'free10' THEN 0 WHEN 'paid_monthly' THEN 0
           WHEN 'paid_annual' THEN 0 WHEN 'free10_inactive' THEN 1 WHEN 'trial' THEN 2 WHEN 'trial_ended' THEN 3
           WHEN 'paid_unverified' THEN 4 ELSE 5 END END ASC,
         CASE WHEN p_sort = 'indicators' AND p_direction = 'desc' THEN CASE f.status WHEN 'free10' THEN 0 WHEN 'paid_monthly' THEN 0
           WHEN 'paid_annual' THEN 0 WHEN 'free10_inactive' THEN 1 WHEN 'trial' THEN 2 WHEN 'trial_ended' THEN 3
           WHEN 'paid_unverified' THEN 4 ELSE 5 END END DESC,
         f.id DESC) AS rn
      FROM f
  ), page AS (
    SELECT * FROM ranked WHERE rn > p_offset AND rn <= p_offset + p_page_size
  )
  SELECT (SELECT count(*) FROM f),
         coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id', p.id, 'user_id', p.user_id, 'business_name', p.business_name, 'email', p.email, 'phone', p.phone,
            'address', p.address, 'tax_id', p.tax_id, 'country', p.country, 'market', p.market, 'currency', p.currency,
            'role', p.role, 'is_lifetime', p.is_lifetime, 'trial_ends_at', p.trial_ends_at, 'created_at', p.created_at,
            'last_sign_in', p.last_sign_in, 'status', p.status) ORDER BY p.rn) FROM page p), '[]'::jsonb)
    INTO v_total, v_rows;
  RETURN jsonb_build_object('schema', 'admin-accounts/v1', 'generatedAt', now(), 'total', v_total, 'offset', p_offset,
                            'pageSize', p_page_size, 'rows', v_rows);
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]) TO authenticated;
