-- Owner 2026-11-03 (typed approval): the system administrator never depends on a plan (20261103200000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a super_admin row is lifetime (also after a revoke attempt and on insert); SMART PACK is active for it in the enforced phase;
-- an ordinary user cannot make themselves lifetime, also not by claiming the role in the same update; the existing guard still holds.
BEGIN;
SELECT tst.seed();
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- user A becomes the system administrator (as the Owner's account is); user B stays an ordinary account
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET role = 'super_admin', is_lifetime = false WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT set_config('session_replication_role', 'origin', true);

-- the trigger: any update of the super admin row leaves it lifetime (the migration's one-time UPDATE is the same path)
UPDATE public.business_settings SET is_lifetime = true WHERE role = 'super_admin' AND is_lifetime IS DISTINCT FROM true;
SELECT tst.ok((SELECT is_lifetime FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
  'T1 the system administrator is lifetime');
SELECT tst.ok((public.smart_pack_state('00000000-0000-4000-8000-00000000000a') ->> 'source') = 'lifetime'
          AND (public.smart_pack_state('00000000-0000-4000-8000-00000000000a') ->> 'active')::boolean,
  'T2 enforced phase: SMART PACK is active for the system administrator (source lifetime), whatever the free window says');
UPDATE public.business_settings SET is_lifetime = false WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.ok((SELECT is_lifetime FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
  'T3 a revoke attempt leaves the system administrator lifetime');

-- an ordinary user cannot make themselves lifetime (the existing guard), also not by claiming the role in the same update
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
BEGIN
  BEGIN
    UPDATE public.business_settings SET is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000b';
    PERFORM tst.ok((SELECT NOT is_lifetime FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000b'), 'T4 an ordinary user cannot set lifetime');
  EXCEPTION WHEN others THEN
    PERFORM tst.ok(true, 'T4 an ordinary user cannot set lifetime (refused)');
  END;
  BEGIN
    UPDATE public.business_settings SET role = 'super_admin', is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000b';
    PERFORM tst.ok(false, 'T5 claiming the role in the same update must not give lifetime');
  EXCEPTION WHEN others THEN
    PERFORM tst.ok(true, 'T5 claiming the role in the same update is refused (OLD.role is not super_admin)');
  END;
END $$;
SELECT tst.logout();
SELECT tst.ok(NOT (SELECT is_lifetime FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000b'),
  'T6 the ordinary account is still not lifetime');

ROLLBACK;
