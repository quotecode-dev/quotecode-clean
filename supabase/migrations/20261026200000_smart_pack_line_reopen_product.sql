-- 20261026200000_smart_pack_line_reopen_product.sql  -  re-open the SMART PACK line again (item א2, the missing catalog product)
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-26 (typed: "מאשר ליצור בפיי פלוס את שני מוצרי חכם פלוס ולשחרר את התיקון"): after 20261026100000 the retry reached
-- PayPlus and was refused again - the PayPlus catalog had no SMART PACK product (a one-time page creates none). The products now exist
-- (created 2026-10-26 with the Owner's approval) and the Edge function treats a missing product as a retried configuration gap. Same
-- statement as 20261026100000: re-opens the paid, in-period refused lines of the live package without the line. Data only, idempotent.
UPDATE public.smart_pack_add_ons a
   SET line_state = NULL, line_at = NULL
 WHERE a.state = 'paid'
   AND a.line_state = 'not_added'
   AND a.period_end > now()
   AND EXISTS (SELECT 1 FROM public.account_entitlements e
                WHERE e.user_id = a.user_id AND e.live_attempt_id = a.package_attempt_id AND e.smart_pack_line = false);
