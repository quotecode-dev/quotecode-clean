-- ============================================================================================================================
-- 20261020100000_support_inbound_stage2.sql  -  the smart support email, stage 2: sorting by colour, drafts, the Owner's answers,
-- sending by colour (the trial) with a stop switch, and the evening summary
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: שלב 2 של המייל החכם (צבעים, מונה, טיוטות, שבוע ניסיון ועמודת הכתובת)";
--   spec docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md sections 2-8. Additive: new nullable / defaulted columns on
--   support_inbound_messages, the status list widened (every stage-1 row stays 'new'), two new service-role tables.
--   Writers stay the Edge Functions with the service role only (support-inbound, support-admin after its super admin check,
--   support-digest); the app keeps read-only access for a super admin (RLS, is_super_admin()).
-- Rollback of THIS file: DROP TABLE public.support_digest_runs; DROP TABLE public.support_assistant_settings;
--   ALTER TABLE public.support_inbound_messages DROP COLUMN mailbox, DROP COLUMN is_automated, DROP COLUMN bin, DROP COLUMN bin_reason,
--   DROP COLUMN summary, DROP COLUMN reply_language, DROP COLUMN draft_reply, DROP COLUMN ack_sent_at, DROP COLUMN reply_text,
--   DROP COLUMN reply_sent_at, DROP COLUMN reply_sent_by, DROP COLUMN owner_notified_at, DROP COLUMN processed_at,
--   DROP COLUMN handled_at; then restore CHECK (status IN ('new')) after setting every status back to 'new'.
-- ============================================================================================================================

ALTER TABLE public.support_inbound_messages
  ADD COLUMN IF NOT EXISTS mailbox           text        CHECK (mailbox IS NULL OR mailbox IN ('support', 'info')),
  ADD COLUMN IF NOT EXISTS is_automated      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bin               text        CHECK (bin IS NULL OR bin IN ('green', 'yellow', 'red', 'black')),
  ADD COLUMN IF NOT EXISTS bin_reason        text        CHECK (bin_reason IS NULL OR char_length(bin_reason) <= 300),
  ADD COLUMN IF NOT EXISTS summary           text        CHECK (summary IS NULL OR char_length(summary) <= 300),
  ADD COLUMN IF NOT EXISTS reply_language    text        CHECK (reply_language IS NULL OR reply_language IN ('he', 'en')),
  ADD COLUMN IF NOT EXISTS draft_reply       text        CHECK (draft_reply IS NULL OR char_length(draft_reply) <= 20000),
  ADD COLUMN IF NOT EXISTS ack_sent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS reply_text        text        CHECK (reply_text IS NULL OR char_length(reply_text) <= 20000),
  ADD COLUMN IF NOT EXISTS reply_sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS reply_sent_by     text        CHECK (reply_sent_by IS NULL OR reply_sent_by IN ('assistant', 'owner')),
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS handled_at        timestamptz;

-- new = stored, not handled yet; waiting = needs the Owner (RED); draft = a reply waits for the Owner's approval; answered = a reply
-- was sent; dismissed = the Owner chose not to send; ignored = BLACK (automated / spam)
ALTER TABLE public.support_inbound_messages DROP CONSTRAINT IF EXISTS support_inbound_messages_status_check;
ALTER TABLE public.support_inbound_messages ADD CONSTRAINT support_inbound_messages_status_check
  CHECK (status IN ('new', 'waiting', 'draft', 'answered', 'dismissed', 'ignored'));
CREATE INDEX IF NOT EXISTS support_inbound_messages_waiting_idx ON public.support_inbound_messages (status) WHERE status IN ('new', 'waiting', 'draft');
CREATE INDEX IF NOT EXISTS support_inbound_messages_sender_idx ON public.support_inbound_messages (from_address, stored_at DESC);

-- one row: sending by colour (both off = every reply waits as a draft - the trial) and the stop switch (no email to any customer)
CREATE TABLE IF NOT EXISTS public.support_assistant_settings (
  id               smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_send_green  boolean     NOT NULL DEFAULT false,
  auto_send_yellow boolean     NOT NULL DEFAULT false,
  paused           boolean     NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_by       uuid
);
COMMENT ON TABLE public.support_assistant_settings IS
  'Owner 2026-10-20: smart support email stage 2 - sending by colour (off = drafts only) and the stop switch; written only by support-admin after its super admin check.';
INSERT INTO public.support_assistant_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.support_assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_assistant_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_assistant_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.support_assistant_settings TO authenticated;
DROP POLICY IF EXISTS support_assistant_settings_super_admin_read ON public.support_assistant_settings;
CREATE POLICY support_assistant_settings_super_admin_read ON public.support_assistant_settings
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- the evening summary is sent once a day (support-digest claims the Israel date)
CREATE TABLE IF NOT EXISTS public.support_digest_runs (
  day     date        PRIMARY KEY,
  sent_at timestamptz
);
COMMENT ON TABLE public.support_digest_runs IS
  'Owner 2026-10-20: smart support email stage 2 - one evening summary per Israel date; service role only.';
ALTER TABLE public.support_digest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_digest_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_digest_runs FROM PUBLIC, anon, authenticated;
