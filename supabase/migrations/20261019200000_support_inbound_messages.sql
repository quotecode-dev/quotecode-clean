-- ============================================================================================================================
-- 20261019200000_support_inbound_messages.sql  -  the smart support email, stage 1: inbound support / info emails are STORED (no AI,
-- no reply) and shown read-only in the Admin "Inquiries" tab
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-19 (spec docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md, "נשמע טוב, מאשר"; typed "מאשר שינוי ב-L-22: לשונית
--   "פניות" חדשה בממשק הניהול"). One row per received email: written only by the support-inbound Edge Function (service role) after
--   it verified the provider's webhook signature and fetched the message; the same provider event / email never makes a second row.
--   Only the plain text is kept (HTML is reduced to text by the function; nothing executable is stored); attachments are metadata only.
--   Readable by a super admin only (RLS, is_super_admin()); nobody but the service role can write. Additive: no existing row changes.
-- Rollback of THIS file: DROP TABLE public.support_inbound_messages;
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.support_inbound_messages (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           text        NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend')),
  provider_event_id  text        NOT NULL CHECK (char_length(provider_event_id) BETWEEN 1 AND 200),
  provider_email_id  text        NOT NULL CHECK (char_length(provider_email_id) BETWEEN 1 AND 200),
  message_id         text        CHECK (message_id IS NULL OR char_length(message_id) <= 998),
  in_reply_to        text        CHECK (in_reply_to IS NULL OR char_length(in_reply_to) <= 998),
  from_address       text        NOT NULL CHECK (char_length(from_address) BETWEEN 3 AND 320),
  from_name          text        CHECK (from_name IS NULL OR char_length(from_name) <= 200),
  to_addresses       text[]      NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(to_addresses) <= 50),
  subject            text        CHECK (subject IS NULL OR char_length(subject) <= 998),
  text_body          text        CHECK (text_body IS NULL OR char_length(text_body) <= 100000),
  attachments        jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array' AND pg_column_size(attachments) < 65536),
  auth_results       jsonb       CHECK (auth_results IS NULL OR (jsonb_typeof(auth_results) = 'object' AND pg_column_size(auth_results) < 4096)),
  received_at        timestamptz NOT NULL,
  stored_at          timestamptz NOT NULL DEFAULT pg_catalog.now(),
  status             text        NOT NULL DEFAULT 'new' CHECK (status IN ('new')),
  CONSTRAINT support_inbound_messages_event_unique UNIQUE (provider, provider_event_id),
  CONSTRAINT support_inbound_messages_email_unique UNIQUE (provider, provider_email_id)
);
COMMENT ON TABLE public.support_inbound_messages IS
  'Owner 2026-10-19: smart support email stage 1 - received support / info emails (plain text + metadata), written only by the support-inbound function, read by a super admin only.';
CREATE INDEX IF NOT EXISTS support_inbound_messages_received_idx ON public.support_inbound_messages (received_at DESC);

ALTER TABLE public.support_inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_inbound_messages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_inbound_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.support_inbound_messages TO authenticated;
DROP POLICY IF EXISTS support_inbound_messages_super_admin_read ON public.support_inbound_messages;
CREATE POLICY support_inbound_messages_super_admin_read ON public.support_inbound_messages
  FOR SELECT TO authenticated USING (public.is_super_admin());
