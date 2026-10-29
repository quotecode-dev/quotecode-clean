-- ============================================================================================================================
-- 20261030600000_support_conversations.sql  -  Codex release 5 (topic 7): support conversations - follow-ups and our replies together
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 night (the same typed night task approval, decision 8: "reference-based support conversations,
--   suggestions-only subject matching and one generic acknowledgement per conversation while substantive follow-ups can still receive
--   guarded replies"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 7. The receiving provider and the mailboxes are unchanged.
--   * support_conversations: one conversation per thread (participant + mailbox), its last activity and its ONE generic acknowledgement
--     (claimed atomically: ack_claim, so two messages at once never acknowledge twice).
--   * support_inbound_messages.conversation_id: every received email belongs to one conversation; reference_ids = the bounded RFC ids of
--     In-Reply-To / References; association = how it was placed (reference / new / suggested / ambiguous / manual / legacy);
--     suggested_conversation_id = a same-sender + same-subject conversation, a SUGGESTION only (never merged by itself).
--   * support_outbound_messages: every email we sent to the customer in a conversation - the acknowledgement, the assistant's and the
--     Owner's replies - with its plain text, actor, state (sent / failed / unknown), stable send key and the provider's id when known.
--   * support_conversation_links: the Owner's link / unlink of a message (audit, append-only).
--   Closed to the app: RLS forced, no policy, no grant to PUBLIC / anon / authenticated; the service role only (the support functions);
--   the admin reads conversations through support-admin with the existing inquiries.view permission.
--   History (retained evidence only, nothing sent): every stored email gets a conversation - a reply whose In-Reply-To is an earlier
--   email of the same sender and mailbox joins that email's conversation; past acknowledgements and replies become outbound records (an
--   old acknowledgement's exact text was not kept - recorded as unknown text, never invented).
--   ROLLBACK (spec): keep every conversation, outbound record, unknown state and reply ban; never delete history or mark unknown mail sent.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox           text         CHECK (mailbox IS NULL OR mailbox IN ('support', 'info')),
  participant       text         NOT NULL CHECK (char_length(participant) BETWEEN 3 AND 320),
  subject_norm      text         CHECK (subject_norm IS NULL OR char_length(subject_norm) <= 300),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  last_activity_at  timestamptz  NOT NULL DEFAULT now(),
  ack_sent_at       timestamptz,
  ack_claim         text         CHECK (ack_claim IS NULL OR char_length(ack_claim) <= 120)
);
COMMENT ON TABLE public.support_conversations IS
  'Owner 2026-10-29 (Codex release 5, decision 8): one support conversation per thread; service functions only.';
CREATE INDEX IF NOT EXISTS support_conversations_participant_idx ON public.support_conversations (participant, mailbox, last_activity_at DESC);

ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.support_conversations (id);
ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS reference_ids text[] CHECK (reference_ids IS NULL OR cardinality(reference_ids) <= 20);
ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS association text
  CHECK (association IS NULL OR association IN ('reference', 'new', 'suggested', 'ambiguous', 'manual', 'legacy'));
ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS suggested_conversation_id uuid REFERENCES public.support_conversations (id);
CREATE INDEX IF NOT EXISTS support_inbound_messages_conversation_idx ON public.support_inbound_messages (conversation_id, received_at);
CREATE INDEX IF NOT EXISTS support_inbound_messages_message_id_idx ON public.support_inbound_messages (message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_outbound_messages (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid         NOT NULL REFERENCES public.support_conversations (id),
  inbound_id       uuid         REFERENCES public.support_inbound_messages (id),
  kind             text         NOT NULL CHECK (kind IN ('ack', 'assistant', 'owner')),
  actor            text         NOT NULL CHECK (actor IN ('assistant', 'owner', 'system')),
  to_address       text         CHECK (to_address IS NULL OR char_length(to_address) <= 320),
  mailbox          text         CHECK (mailbox IS NULL OR mailbox IN ('support', 'info')),
  body_text        text         CHECK (body_text IS NULL OR char_length(body_text) <= 20000),
  body_known       boolean      NOT NULL DEFAULT true,
  state            text         NOT NULL CHECK (state IN ('sent', 'failed', 'unknown')),
  send_key         text         NOT NULL UNIQUE CHECK (char_length(send_key) BETWEEN 8 AND 250),
  provider_id      text         CHECK (provider_id IS NULL OR char_length(provider_id) <= 200),
  rfc_message_id   text         CHECK (rfc_message_id IS NULL OR char_length(rfc_message_id) <= 998),
  note             text         CHECK (note IS NULL OR char_length(note) <= 200),
  created_at       timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.support_outbound_messages IS
  'Owner 2026-10-29 (Codex release 5): every email sent to the customer in a support conversation (the requested history, not a debug log).';
CREATE INDEX IF NOT EXISTS support_outbound_messages_conversation_idx ON public.support_outbound_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.support_conversation_links (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id         uuid         NOT NULL REFERENCES public.support_inbound_messages (id),
  from_conversation  uuid         REFERENCES public.support_conversations (id),
  to_conversation    uuid         NOT NULL REFERENCES public.support_conversations (id),
  action             text         NOT NULL CHECK (action IN ('link', 'unlink')),
  actor              uuid         NOT NULL,
  created_at         timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.support_conversation_links IS 'Owner 2026-10-29 (Codex release 5): the Owner''s link / unlink of a support message - append-only audit.';

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_outbound_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversation_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_conversations, public.support_outbound_messages, public.support_conversation_links FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_outbound_messages TO service_role;
GRANT SELECT, INSERT ON TABLE public.support_conversation_links TO service_role;

-- places one received email into a conversation, once: the given parent (found by its RFC references), or a new conversation
CREATE OR REPLACE FUNCTION public.support_conversation_assign(p_inbound uuid, p_parent uuid, p_suggested uuid, p_association text, p_subject_norm text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_m public.support_inbound_messages%ROWTYPE; v_conv uuid;
BEGIN
  IF p_association NOT IN ('reference', 'new', 'suggested', 'ambiguous') THEN RAISE EXCEPTION 'support_conversation_invalid' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_m FROM public.support_inbound_messages WHERE id = p_inbound FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_conversation_invalid' USING ERRCODE = '22023'; END IF;
  IF v_m.conversation_id IS NOT NULL THEN RETURN v_m.conversation_id; END IF;
  IF p_parent IS NOT NULL AND p_association = 'reference' THEN
    SELECT id INTO v_conv FROM public.support_conversations WHERE id = p_parent AND participant = lower(v_m.from_address) AND mailbox IS NOT DISTINCT FROM v_m.mailbox;
  END IF;
  IF v_conv IS NULL THEN
    INSERT INTO public.support_conversations (mailbox, participant, subject_norm, created_at, last_activity_at)
    VALUES (v_m.mailbox, lower(v_m.from_address), left(p_subject_norm, 300), v_m.received_at, v_m.received_at) RETURNING id INTO v_conv;
  ELSE
    UPDATE public.support_conversations SET last_activity_at = greatest(last_activity_at, v_m.received_at) WHERE id = v_conv;
  END IF;
  UPDATE public.support_inbound_messages
     SET conversation_id = v_conv,
         association = CASE WHEN p_parent IS NOT NULL AND v_conv = p_parent THEN 'reference' WHEN p_association = 'reference' THEN 'new' ELSE p_association END,
         suggested_conversation_id = CASE WHEN p_association = 'suggested' AND p_suggested IS DISTINCT FROM v_conv THEN p_suggested END
   WHERE id = p_inbound;
  RETURN v_conv;
END
$function$;
REVOKE ALL ON FUNCTION public.support_conversation_assign(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_conversation_assign(uuid, uuid, uuid, text, text) TO service_role;

-- the conversation's ONE generic acknowledgement: claimed before the send, released if the provider refused it
CREATE OR REPLACE FUNCTION public.support_conversation_claim_ack(p_conversation uuid, p_claim text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH c AS (UPDATE public.support_conversations SET ack_sent_at = now(), ack_claim = left(p_claim, 120)
              WHERE id = p_conversation AND ack_sent_at IS NULL RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM c);
$function$;
REVOKE ALL ON FUNCTION public.support_conversation_claim_ack(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_conversation_claim_ack(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.support_conversation_release_ack(p_conversation uuid, p_claim text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  UPDATE public.support_conversations SET ack_sent_at = NULL, ack_claim = NULL WHERE id = p_conversation AND ack_claim = left(p_claim, 120);
$function$;
REVOKE ALL ON FUNCTION public.support_conversation_release_ack(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_conversation_release_ack(uuid, text) TO service_role;

-- the Owner's link (accept a suggestion / move a message) and unlink (its own new conversation), audited; original ids stay
CREATE OR REPLACE FUNCTION public.support_conversation_relink(p_inbound uuid, p_target uuid, p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_m public.support_inbound_messages%ROWTYPE; v_to uuid;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'support_conversation_invalid' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_m FROM public.support_inbound_messages WHERE id = p_inbound FOR UPDATE;
  IF NOT FOUND OR v_m.conversation_id IS NULL THEN RAISE EXCEPTION 'support_conversation_invalid' USING ERRCODE = '22023'; END IF;
  IF p_target IS NULL THEN
    -- the new conversation keeps the acknowledgement of the one it leaves (never a second generic acknowledgement)
    INSERT INTO public.support_conversations (mailbox, participant, created_at, last_activity_at, ack_sent_at, ack_claim)
    SELECT v_m.mailbox, lower(v_m.from_address), v_m.received_at, v_m.received_at, c.ack_sent_at, c.ack_claim
      FROM public.support_conversations c WHERE c.id = v_m.conversation_id RETURNING id INTO v_to;
  ELSE
    SELECT id INTO v_to FROM public.support_conversations WHERE id = p_target AND participant = lower(v_m.from_address) AND mailbox IS NOT DISTINCT FROM v_m.mailbox;
    IF v_to IS NULL THEN RAISE EXCEPTION 'support_conversation_mismatch' USING ERRCODE = '22023'; END IF;
    UPDATE public.support_conversations SET last_activity_at = greatest(last_activity_at, v_m.received_at) WHERE id = v_to;
  END IF;
  INSERT INTO public.support_conversation_links (inbound_id, from_conversation, to_conversation, action, actor)
  VALUES (p_inbound, v_m.conversation_id, v_to, CASE WHEN p_target IS NULL THEN 'unlink' ELSE 'link' END, p_actor);
  UPDATE public.support_inbound_messages SET conversation_id = v_to, association = 'manual', suggested_conversation_id = NULL WHERE id = p_inbound;
  RETURN v_to;
END
$function$;
REVOKE ALL ON FUNCTION public.support_conversation_relink(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_conversation_relink(uuid, uuid, uuid) TO service_role;

-- history: every stored email gets a conversation (a reply to an earlier email of the same sender + mailbox joins it)
DO $backfill$
DECLARE
  r record; v_parent uuid; v_conv uuid;
BEGIN
  FOR r IN SELECT * FROM public.support_inbound_messages WHERE conversation_id IS NULL ORDER BY received_at, stored_at LOOP
    v_parent := NULL;
    IF r.in_reply_to IS NOT NULL THEN
      SELECT p.conversation_id INTO v_parent FROM public.support_inbound_messages p
       WHERE p.message_id = r.in_reply_to AND lower(p.from_address) = lower(r.from_address) AND p.mailbox IS NOT DISTINCT FROM r.mailbox
         AND p.conversation_id IS NOT NULL ORDER BY p.received_at LIMIT 1;
    END IF;
    IF v_parent IS NULL THEN
      INSERT INTO public.support_conversations (mailbox, participant, created_at, last_activity_at, ack_sent_at, ack_claim)
      VALUES (r.mailbox, lower(r.from_address), r.received_at, r.received_at, r.ack_sent_at, CASE WHEN r.ack_sent_at IS NOT NULL THEN 'legacy' END)
      RETURNING id INTO v_conv;
    ELSE
      v_conv := v_parent;
      UPDATE public.support_conversations SET last_activity_at = greatest(last_activity_at, r.received_at),
             ack_sent_at = coalesce(ack_sent_at, r.ack_sent_at), ack_claim = coalesce(ack_claim, CASE WHEN r.ack_sent_at IS NOT NULL THEN 'legacy' END)
       WHERE id = v_conv;
    END IF;
    UPDATE public.support_inbound_messages SET conversation_id = v_conv, association = 'legacy' WHERE id = r.id;
  END LOOP;
END
$backfill$;

INSERT INTO public.support_outbound_messages (conversation_id, inbound_id, kind, actor, to_address, mailbox, body_text, body_known, state, send_key, note, created_at)
SELECT m.conversation_id, m.id, 'ack', 'system', m.from_address, m.mailbox, NULL, false, 'sent', 'tekango-support/v1/' || m.id::text || '/ack',
       'legacy: the exact acknowledgement text was not kept', m.ack_sent_at
  FROM public.support_inbound_messages m WHERE m.ack_sent_at IS NOT NULL AND m.conversation_id IS NOT NULL
ON CONFLICT (send_key) DO NOTHING;
INSERT INTO public.support_outbound_messages (conversation_id, inbound_id, kind, actor, to_address, mailbox, body_text, body_known, state, send_key, note, created_at)
SELECT m.conversation_id, m.id, CASE WHEN m.reply_sent_by = 'owner' THEN 'owner' ELSE 'assistant' END, CASE WHEN m.reply_sent_by = 'owner' THEN 'owner' ELSE 'assistant' END,
       m.from_address, m.mailbox, left(m.reply_text, 20000), m.reply_text IS NOT NULL, 'sent', 'legacy/' || m.id::text || '/reply', 'legacy', m.reply_sent_at
  FROM public.support_inbound_messages m WHERE m.reply_sent_at IS NOT NULL AND m.conversation_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.support_outbound_messages o WHERE o.inbound_id = m.id AND o.kind IN ('assistant', 'owner'))
ON CONFLICT (send_key) DO NOTHING;
