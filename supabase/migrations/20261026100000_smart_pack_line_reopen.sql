-- 20261026100000_smart_pack_line_reopen.sql  -  re-open a refused SMART PACK line (item א2)
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז בשחרור אחד ..." - item א2: the cause of the SMART PACK line that did not
-- reach the standing order, and an automatic retry). The first real add-on (2026-10-25) was paid, but its line was marked 'not_added'
-- before PayPlus was asked: the account terminal secret held no terminal UID. The Edge function now treats a missing terminal as a
-- configuration gap (retried, never final); this re-opens every paid add-on whose line was refused, that is still inside its period,
-- on the account's live package and without the line - the next checkout status call (the plans window) adds it.
-- No table, function or grant changes. Rollback: nothing to undo (a re-opened row is either added by the retry or refused again).
UPDATE public.smart_pack_add_ons a
   SET line_state = NULL, line_at = NULL
 WHERE a.state = 'paid'
   AND a.line_state = 'not_added'
   AND a.period_end > now()
   AND EXISTS (SELECT 1 FROM public.account_entitlements e
                WHERE e.user_id = a.user_id AND e.live_attempt_id = a.package_attempt_id AND e.smart_pack_line = false);
