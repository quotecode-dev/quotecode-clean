-- ============================================================================================================================
-- 20261023100000_expense_invoices.sql  -  the Owner's expense-invoice tool (admin > מערכת)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-22 (typed: "מאשר שינוי ב-L-22: כלי חשבוניות הוצאה במסך מערכת בניהול, עם משיכה מתיבות הדואר, אישור, ושליחה
--   להוצאות בפיי פלוס - מ 28 ליולי והלאה"; the Owner chose a direct read-only Google connection - the tool finds the invoices itself).
--   Plan: docs/EXPENSE_INVOICES_TOOL_PLAN_2026-10-22.md.
--   * expense_mail_tokens      - the Google refresh token of each connected mailbox, ENCRYPTED by the Edge Function (AES-GCM, a key derived
--                                from a function secret). Service role only.
--   * expense_mail_connections - what the Owner sees about a mailbox (connected at, last scan, last error) - never the token.
--   * expense_mail_seen        - every scanned email once (so a scan never reads it twice), with what was decided; an email that failed
--                                is 'retry' (read again next scan) and 'failed' after 3 attempts (never lost silently, never paid for forever).
--   * expense_invoices         - one row per found invoice: the fields the AI read, the Owner's decision and the PayPlus result.
--   * expense_settings         - the PayPlus expense types (subcategory ids) the Owner can choose from, and the default one.
--   Every table is closed to the app (RLS on, no grant to anon / authenticated); the Edge Function expense-invoices writes with the
--   service role AFTER its super-admin check; the admin screen reads through expense_invoices_admin_state() (super admin only).
--   The invoice files are kept in the private storage bucket expense-invoices (no policy = no client access).
-- Rollback of THIS file: DROP FUNCTION public.expense_invoices_admin_state(); DROP TABLE public.expense_invoices,
--   public.expense_mail_seen, public.expense_mail_connections, public.expense_mail_tokens, public.expense_settings;
--   DELETE FROM storage.buckets WHERE id = 'expense-invoices' (after emptying it).
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.expense_mail_tokens (
  mailbox       text        PRIMARY KEY CHECK (mailbox ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  refresh_token text        NOT NULL CHECK (length(refresh_token) BETWEEN 10 AND 4000),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_mail_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_mail_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_mail_tokens TO service_role;

CREATE TABLE IF NOT EXISTS public.expense_mail_connections (
  mailbox        text        PRIMARY KEY CHECK (mailbox ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  connected_at   timestamptz NOT NULL DEFAULT now(),
  last_scan_at   timestamptz NULL,
  scanned_until  date        NULL,
  last_error     text        NULL CHECK (last_error IS NULL OR length(last_error) <= 300)
);
ALTER TABLE public.expense_mail_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_mail_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_mail_connections TO service_role;

CREATE TABLE IF NOT EXISTS public.expense_mail_seen (
  mailbox     text        NOT NULL,
  message_id  text        NOT NULL CHECK (length(message_id) BETWEEN 1 AND 200),
  outcome     text        NOT NULL CHECK (outcome IN ('invoice', 'not_invoice', 'retry', 'failed')),
  attempts    integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mailbox, message_id)
);
ALTER TABLE public.expense_mail_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_mail_seen FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_mail_seen TO service_role;

CREATE TABLE IF NOT EXISTS public.expense_invoices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox             text        NOT NULL,
  message_id          text        NOT NULL,
  received_at         timestamptz NULL,
  email_from          text        NULL CHECK (email_from IS NULL OR length(email_from) <= 300),
  email_subject       text        NULL CHECK (email_subject IS NULL OR length(email_subject) <= 300),
  supplier_name       text        NULL CHECK (supplier_name IS NULL OR length(supplier_name) <= 200),
  supplier_vat_id     text        NULL CHECK (supplier_vat_id IS NULL OR supplier_vat_id ~ '^[0-9]{5,12}$'),
  supplier_country    text        NOT NULL DEFAULT 'unknown' CHECK (supplier_country IN ('IL', 'foreign', 'unknown')),
  doc_type            text        NOT NULL DEFAULT 'other' CHECK (doc_type IN ('tax_invoice', 'receipt', 'tax_invoice_receipt', 'other')),
  doc_number          text        NULL CHECK (doc_number IS NULL OR length(doc_number) BETWEEN 1 AND 80),
  doc_date            date        NULL,
  amount              numeric(14, 2) NULL CHECK (amount IS NULL OR amount >= 0),
  currency            text        NULL CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  amount_includes_vat boolean     NOT NULL DEFAULT false,
  vat_percentage      numeric(5, 2) NOT NULL DEFAULT 0 CHECK (vat_percentage >= 0 AND vat_percentage <= 30),
  category            text        NULL CHECK (category IS NULL OR length(category) <= 60),
  confidence          text        NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
  reason              text        NULL CHECK (reason IS NULL OR length(reason) <= 400),
  has_file            boolean     NOT NULL DEFAULT false,
  file_path           text        NULL CHECK (file_path IS NULL OR length(file_path) <= 300),
  file_name           text        NULL CHECK (file_name IS NULL OR length(file_name) <= 200),
  file_type           text        NULL CHECK (file_type IS NULL OR file_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  status              text        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'excluded', 'sending', 'sent', 'send_failed')),
  subcategory_id      bigint      NULL CHECK (subcategory_id IS NULL OR subcategory_id > 0),
  payplus_uuid        text        NULL CHECK (payplus_uuid IS NULL OR length(payplus_uuid) <= 80),
  send_error          text        NULL CHECK (send_error IS NULL OR length(send_error) <= 300),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz NULL,
  UNIQUE (mailbox, message_id),
  CHECK (status <> 'sent' OR payplus_uuid IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS expense_invoices_status ON public.expense_invoices (status, doc_date DESC);
ALTER TABLE public.expense_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_invoices TO service_role;

CREATE TABLE IF NOT EXISTS public.expense_settings (
  id                     integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- [{ "id": <PayPlus subcategory id>, "name": "<the Owner's name for it>" }]
  expense_types          jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(expense_types) = 'array' AND octet_length(expense_types::text) <= 8000),
  default_subcategory_id bigint      NULL CHECK (default_subcategory_id IS NULL OR default_subcategory_id > 0),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.expense_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.expense_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.expense_settings TO service_role;

-- the admin screen: the mailboxes (never a token), the invoices and the settings - super admin only
CREATE OR REPLACE FUNCTION public.expense_invoices_admin_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'expense_invoices_admin_state: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'connections', coalesce((SELECT jsonb_agg(jsonb_build_object('mailbox', c.mailbox, 'connectedAt', c.connected_at, 'lastScanAt', c.last_scan_at,
      'scannedUntil', c.scanned_until, 'lastError', c.last_error) ORDER BY c.mailbox) FROM public.expense_mail_connections c), '[]'::jsonb),
    'invoices', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'mailbox', i.mailbox, 'receivedAt', i.received_at, 'emailFrom', i.email_from,
      'emailSubject', i.email_subject, 'supplierName', i.supplier_name, 'supplierVatId', i.supplier_vat_id, 'supplierCountry', i.supplier_country,
      'docType', i.doc_type, 'docNumber', i.doc_number, 'docDate', i.doc_date, 'amount', i.amount, 'currency', i.currency,
      'amountIncludesVat', i.amount_includes_vat, 'vatPercentage', i.vat_percentage, 'category', i.category, 'confidence', i.confidence, 'reason', i.reason,
      'hasFile', i.has_file, 'fileName', i.file_name, 'status', i.status, 'subcategoryId', i.subcategory_id, 'sendError', i.send_error,
      'sentAt', i.sent_at) ORDER BY i.doc_date DESC NULLS LAST, i.created_at DESC) FROM public.expense_invoices i), '[]'::jsonb),
    'settings', (SELECT jsonb_build_object('expenseTypes', s.expense_types, 'defaultSubcategoryId', s.default_subcategory_id) FROM public.expense_settings s WHERE s.id = 1)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.expense_invoices_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_invoices_admin_state() TO authenticated, service_role;

-- the invoice files: a private bucket, no storage policy (only the service role reads / writes; the Owner gets a short signed link)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-invoices', 'expense-invoices', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;
