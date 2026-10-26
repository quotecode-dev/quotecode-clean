-- 20261026300000_smart_pack_line_reopen_diagnosed.sql  -  re-open the SMART PACK line for a diagnosed retry (item א2)
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-26 (item א2; "פתחתי" after PR #72): the retry with the terminal and the catalog products in place was refused
-- again, before or by PayPlus, and nothing said which check. The Edge function now logs the exact refusal (the failed check / PayPlus'
-- own words). Same statement as 20261026100000: re-opens the paid, in-period refused lines of the live package. Data only, idempotent.
UPDATE public.smart_pack_add_ons a
   SET line_state = NULL, line_at = NULL
 WHERE a.state = 'paid'
   AND a.line_state = 'not_added'
   AND a.period_end > now()
   AND EXISTS (SELECT 1 FROM public.account_entitlements e
                WHERE e.user_id = a.user_id AND e.live_attempt_id = a.package_attempt_id AND e.smart_pack_line = false);
