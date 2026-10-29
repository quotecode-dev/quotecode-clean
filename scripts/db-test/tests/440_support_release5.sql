-- Night task 29-30/10 (migrations 20261030500000 + 20261030600000, Codex release 5, decisions 7 + 8).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: grey is a colour; the automation class is a closed list; a
-- reply ban can never be lifted; a conversation is placed once and only through a compatible parent; ONE acknowledgement claim per
-- conversation (released only by its own claim); the Owner's relink refuses another sender / mailbox and is audited; outbound records
-- are unique per send key; nothing of it is open to the app.
BEGIN;
SELECT tst.seed();

INSERT INTO public.support_inbound_messages (id, provider_event_id, provider_email_id, message_id, from_address, to_addresses, subject, text_body, received_at, mailbox) VALUES
  ('a4400000-0000-4000-8000-000000000001', 'evt-440-1', 'em-440-1', '<d1@c.test>', 'dana@c.test', ARRAY['support@in.test'], 'לוגו', 'שאלה', now() - interval '2 hours', 'support'),
  ('a4400000-0000-4000-8000-000000000002', 'evt-440-2', 'em-440-2', '<d2@c.test>', 'dana@c.test', ARRAY['support@in.test'], 'Re: לוגו', 'עוד שאלה', now() - interval '1 hour', 'support'),
  ('a4400000-0000-4000-8000-000000000003', 'evt-440-3', 'em-440-3', '<e1@c.test>', 'eve@c.test', ARRAY['support@in.test'], 'Re: לוגו', 'מישהי אחרת', now() - interval '30 minutes', 'support'),
  ('a4400000-0000-4000-8000-000000000004', 'evt-440-4', 'em-440-4', '<d3@c.test>', 'dana@c.test', ARRAY['info@in.test'], 'Re: לוגו', 'תיבה אחרת', now() - interval '20 minutes', 'info');

-- ------------------------------------------------------------------------------------------------- R5-1. grey, the class list, the ban
UPDATE public.support_inbound_messages SET bin = 'grey', status = 'waiting', automation_class = 'possible_automatic', reply_allowed = false WHERE id = 'a4400000-0000-4000-8000-000000000003';
SELECT tst.ok((SELECT bin = 'grey' AND NOT reply_allowed FROM public.support_inbound_messages WHERE id = 'a4400000-0000-4000-8000-000000000003'), 'R5-1 grey is a stored colour with a reply ban');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET automation_class = 'robot' WHERE id = 'a4400000-0000-4000-8000-000000000001'$q$, 'check', 'R5-1b the automation class is a closed list');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET reply_allowed = true WHERE id = 'a4400000-0000-4000-8000-000000000003'$q$, 'support_reply_ban_permanent', 'R5-1c a reply ban can never be lifted');
SELECT tst.ok((SELECT reply_allowed FROM public.support_inbound_messages WHERE id = 'a4400000-0000-4000-8000-000000000001'), 'R5-1d a human email is replyable by default');

-- ------------------------------------------------------------------------------------------------- R5-2. closed to the app
SELECT tst.anon();
SELECT tst.throws($q$SELECT count(*) FROM public.support_conversations$q$, 'permission denied', 'R5-2 the public cannot read conversations');
SELECT tst.throws($q$SELECT public.support_conversation_claim_ack('a4400000-0000-4000-8000-000000000001', 'x')$q$, 'permission denied', 'R5-2b nor claim an acknowledgement');
SELECT tst.logout();
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT count(*) FROM public.support_outbound_messages$q$, 'permission denied', 'R5-2c even a super admin reads the sent emails only through support-admin');
SELECT tst.throws($q$SELECT count(*) FROM public.support_conversation_links$q$, 'permission denied', 'R5-2d nor the link audit');
SELECT tst.throws($q$SELECT public.support_conversation_relink('a4400000-0000-4000-8000-000000000001', NULL, '00000000-0000-4000-8000-00000000000a')$q$, 'permission denied', 'R5-2e nor relink directly');
SELECT tst.logout();

-- ------------------------------------------------------------------------------------------------- R5-3. placing (as the service functions)
SELECT set_config('role', 'service_role', false);
SELECT set_config('tst.c1', public.support_conversation_assign('a4400000-0000-4000-8000-000000000001', NULL, NULL, 'new', 'לוגו')::text, false);
SELECT tst.ok(public.support_conversation_assign('a4400000-0000-4000-8000-000000000001', NULL, NULL, 'new', 'לוגו')::text = current_setting('tst.c1'), 'R5-3 an email is placed once (a replay returns the same conversation)');
SELECT tst.ok(public.support_conversation_assign('a4400000-0000-4000-8000-000000000002', current_setting('tst.c1')::uuid, NULL, 'reference', 'לוגו')::text = current_setting('tst.c1'), 'R5-3b a reply of the same sender + mailbox joins the referenced conversation');
SELECT tst.ok(public.support_conversation_assign('a4400000-0000-4000-8000-000000000003', current_setting('tst.c1')::uuid, NULL, 'reference', 'לוגו')::text <> current_setting('tst.c1'), 'R5-3c another sender referencing it opens its own conversation');
SELECT tst.ok(public.support_conversation_assign('a4400000-0000-4000-8000-000000000004', current_setting('tst.c1')::uuid, NULL, 'reference', 'לוגו')::text <> current_setting('tst.c1'), 'R5-3d the same sender in another mailbox opens its own conversation');
SELECT tst.ok((SELECT association = 'new' FROM public.support_inbound_messages WHERE id = 'a4400000-0000-4000-8000-000000000003'), 'R5-3e a refused parent is recorded as new, never as a reference');
SELECT tst.ok((SELECT association = 'reference' FROM public.support_inbound_messages WHERE id = 'a4400000-0000-4000-8000-000000000002'), 'R5-3f the joined reply is recorded as a reference');
SELECT tst.throws($q$SELECT public.support_conversation_assign('a4400000-0000-4000-8000-000000000001', NULL, NULL, 'manual', NULL)$q$, 'support_conversation_invalid', 'R5-3g placing only with a known association');

-- ------------------------------------------------------------------------------------------------- R5-4. ONE acknowledgement per conversation
SELECT tst.ok(public.support_conversation_claim_ack(current_setting('tst.c1')::uuid, 'ack:a4400000-0000-4000-8000-000000000001'), 'R5-4 the first acknowledgement of a conversation is claimed');
SELECT tst.ok(NOT public.support_conversation_claim_ack(current_setting('tst.c1')::uuid, 'ack:a4400000-0000-4000-8000-000000000002'), 'R5-4b a second email of it gets no second claim');
SELECT public.support_conversation_release_ack(current_setting('tst.c1')::uuid, 'ack:a4400000-0000-4000-8000-000000000002');
SELECT tst.ok(NOT public.support_conversation_claim_ack(current_setting('tst.c1')::uuid, 'ack:x'), 'R5-4c only the claim''s own release frees it');
SELECT public.support_conversation_release_ack(current_setting('tst.c1')::uuid, 'ack:a4400000-0000-4000-8000-000000000001');
SELECT tst.ok(public.support_conversation_claim_ack(current_setting('tst.c1')::uuid, 'ack:a4400000-0000-4000-8000-000000000002'), 'R5-4d after a refused send was released, the next email may acknowledge');

-- ------------------------------------------------------------------------------------------------- R5-5. outbound records
INSERT INTO public.support_outbound_messages (conversation_id, inbound_id, kind, actor, to_address, mailbox, body_text, state, send_key)
VALUES (current_setting('tst.c1')::uuid, 'a4400000-0000-4000-8000-000000000001', 'ack', 'system', 'dana@c.test', 'support', 'שלום', 'unknown', 'tekango-support/v1/a4400000-0000-4000-8000-000000000001/ack');
SELECT tst.throws($q$INSERT INTO public.support_outbound_messages (conversation_id, kind, actor, state, send_key) VALUES (current_setting('tst.c1')::uuid, 'ack', 'system', 'sent', 'tekango-support/v1/a4400000-0000-4000-8000-000000000001/ack')$q$, 'unique', 'R5-5 one record per send key');
SELECT tst.throws($q$INSERT INTO public.support_outbound_messages (conversation_id, kind, actor, state, send_key) VALUES (current_setting('tst.c1')::uuid, 'ack', 'system', 'delivered', 'tekango-support/v1/x/other')$q$, 'check', 'R5-5b the delivery state is sent / failed / unknown');

-- ------------------------------------------------------------------------------------------------- R5-6. the Owner's relink, audited
SELECT tst.throws(format($q$SELECT public.support_conversation_relink('a4400000-0000-4000-8000-000000000003', %L, '00000000-0000-4000-8000-00000000000a')$q$, current_setting('tst.c1')), 'support_conversation_mismatch', 'R5-6 another sender''s email cannot be moved into this conversation');
SELECT set_config('tst.c2', public.support_conversation_relink('a4400000-0000-4000-8000-000000000002', NULL, '00000000-0000-4000-8000-00000000000a')::text, false);
SELECT tst.ok(current_setting('tst.c2') <> current_setting('tst.c1') AND (SELECT association = 'manual' AND conversation_id::text = current_setting('tst.c2') FROM public.support_inbound_messages WHERE id = 'a4400000-0000-4000-8000-000000000002'), 'R5-6b unlink moves the email into its own new conversation');
SELECT tst.ok(NOT public.support_conversation_claim_ack(current_setting('tst.c2')::uuid, 'ack:after-unlink'), 'R5-6b2 the new conversation keeps the acknowledgement already sent (no second one)');
SELECT tst.ok(public.support_conversation_relink('a4400000-0000-4000-8000-000000000002', current_setting('tst.c1')::uuid, '00000000-0000-4000-8000-00000000000a')::text = current_setting('tst.c1'), 'R5-6c and link moves it back (reversible)');
SELECT tst.ok((SELECT count(*) = 2 AND bool_and(actor = '00000000-0000-4000-8000-00000000000a') FROM public.support_conversation_links WHERE inbound_id = 'a4400000-0000-4000-8000-000000000002'), 'R5-6d both moves are in the audit');
SELECT tst.ok((SELECT message_id = '<d2@c.test>' FROM public.support_inbound_messages WHERE id = 'a4400000-0000-4000-8000-000000000002'), 'R5-6e the original message identity is kept');

RESET role;
ROLLBACK;
