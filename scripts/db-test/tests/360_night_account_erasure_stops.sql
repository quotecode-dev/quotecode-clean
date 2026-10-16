-- Night task 2026-10-16 (A-5 / MIG-1) - 20261016000000_account_erasure_contact_stops.sql on the disposable DB.
-- Proves: erasing an account is no longer blocked by its customer contact stops (a customer_link and a business stop, both removed
-- with the account, no audit line for the deleted user); while the account exists a business still can never lift a customer's own
-- stop, and lifting its own business stop still writes the history line.
INSERT INTO auth.users (id, email) VALUES
  ('36000000-0000-4000-8000-0000000000e1', 'erase.one@synthetic.test'),
  ('36000000-0000-4000-8000-0000000000e2', 'erase.two@synthetic.test');

-- the server records a stop the customer set from their link (service_role) + the business records its own stop
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
INSERT INTO public.customer_contact_stops (user_id, email_lower, source) VALUES ('36000000-0000-4000-8000-0000000000e1', 'customer.link@synthetic.test', 'customer_link');
SELECT tst.logout();
SELECT tst.login('36000000-0000-4000-8000-0000000000e1');
INSERT INTO public.customer_contact_stops (email_lower) VALUES ('business.own@synthetic.test');
SELECT tst.throws($q$DELETE FROM public.customer_contact_stops WHERE email_lower = 'customer.link@synthetic.test'$q$, 'TK_STOP_NOT_LIFTABLE', 'STOPS: while the account exists the business still cannot lift the customer''s stop');
SELECT tst.logout();

-- the second account lifts its own business stop: allowed, with the history line
SELECT tst.login('36000000-0000-4000-8000-0000000000e2');
INSERT INTO public.customer_contact_stops (email_lower) VALUES ('lift.me@synthetic.test');
DELETE FROM public.customer_contact_stops WHERE email_lower = 'lift.me@synthetic.test';
SELECT tst.logout();
SELECT tst.ok((SELECT count(*) FROM public.reminder_audit WHERE user_id = '36000000-0000-4000-8000-0000000000e2' AND action = 'contact_stop_lifted') = 1, 'STOPS: lifting a business stop still writes the history line');

-- erasing the first account (the admin delete calls auth.admin.deleteUser): the cascade removes both stops and is not refused
DO $$
BEGIN
  DELETE FROM auth.users WHERE id = '36000000-0000-4000-8000-0000000000e1';
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '36000000-0000-4000-8000-0000000000e1'), 'ERASURE: the account with a customer stop and a business stop is deleted');
  PERFORM tst.ok((SELECT count(*) FROM public.customer_contact_stops WHERE user_id = '36000000-0000-4000-8000-0000000000e1') = 0, 'ERASURE: its stops are removed with it');
  PERFORM tst.ok((SELECT count(*) FROM public.reminder_audit WHERE user_id = '36000000-0000-4000-8000-0000000000e1' AND action = 'contact_stop_lifted') = 0, 'ERASURE: no history line is written for the deleted account');
EXCEPTION WHEN OTHERS THEN
  PERFORM tst.ok(false, 'ERASURE: deleting the account raised ' || SQLERRM);
END $$;
