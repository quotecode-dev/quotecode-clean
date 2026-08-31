-- PROFLOW — Full Runtime TEST Environment Build, Phase 1 (schema capture)
-- Part 1 of 4: base application TABLES, SEQUENCE, CONSTRAINTS, INDEXES
--
-- ============================================================
-- ⚠️⚠️⚠️ TEST / BOOTSTRAP MIGRATION — NOT A PRODUCTION FORWARD-MIGRATION
-- PATH. READ BEFORE APPLYING ANYWHERE. ⚠️⚠️⚠️
-- ============================================================
-- This file is a POINT-IN-TIME CAPTURE of Production's structure as it
-- existed on 2026-08-26 (see PURPOSE below) — it is NOT a forward
-- migration and must NEVER be applied to Production for that reason.
-- Production already contains this exact structure NATIVELY; applying
-- this file there is unnecessary at best and, if Production's live
-- state has drifted since 2026-08-26, DANGEROUS — a `db push`/
-- `--include-all` against Production (ref `ixabnzhjeqevtbhdfswv`) using
-- this file would silently OVERWRITE that drift with this stale
-- snapshot. DO NOT apply this file to Production merely because it
-- exists in `supabase/migrations/`. Any future consideration of
-- Production use requires its own completely separate, fresh audit and
-- explicit Owner + ChatGPT authorization — this header is not that
-- authorization, and existence in this directory is not either.
--
-- Scoped exclusively for `quotecode-test` (ref `ljfizgrdyzxddswcedwr`),
-- via a future, separately-authorized Phase 2 apply
-- (`supabase db push --project-ref ljfizgrdyzxddswcedwr`, TEST only).
-- NOT applied to Production. NOT yet applied to quotecode-test either —
-- this rename does not itself authorize any apply.
--
-- PURPOSE: captures the base ProFlow application schema that has existed
-- live on Production since before this repository's own migration history
-- began, and was therefore never represented in any tracked migration file.
-- Confirmed via direct, fresh, read-only introspection of Production
-- (`ixabnzhjeqevtbhdfswv`) during the "Full Runtime TEST Environment Build
-- Plan" task (see PROFLOW_HANDOFF.md §18.CK) and re-verified during the
-- Phase 1 capture task (§18.CL). This file intentionally does NOT touch
-- anything already correctly owned by the six existing item-17/18
-- migrations (20260827000000 → 20260827000003, 202608270000015,
-- 20260828000000) — see the `quotes.quote_number` handling below for the
-- exact reconciliation.
--
-- RETIMESTAMPED 2026-08-30 (originally authored/captured 2026-08-26,
-- filename `20260826000000_...`) — per the Migration Order Resolution
-- Audit (PROFLOW_HANDOFF.md §18.CP), to sort AFTER the already-applied
-- 20260827*/20260828* chain on `quotecode-test` and satisfy the Supabase
-- CLI's chronological migration-push ordering requirement (without this,
-- `supabase db push` refused to proceed without `--include-all` — see
-- §18.CO). The capture DATE and CONTENT below are unchanged; only the
-- filename/version identifier moved.
--
-- ⚠️ TRADEOFF FROM RETIMESTAMPING, documented per §18.CP: this file's
-- ORIGINAL position (before the chain) was deliberate — it let this whole
-- four-file set replay onto a genuinely BLANK future Supabase project,
-- where the chain's own files assume `quotes`/`auth.users` already exist
-- (this file is what creates them). Retimestamped to run AFTER the chain,
-- this file (and Parts 2-4) are now safe ONLY for an environment — like
-- `quotecode-test` — that already has the chain applied. Do NOT assume
-- this file, in its current position, can still one-shot-bootstrap a
-- genuinely blank project; that would require restoring its original
-- relative ordering (before the chain) for that specific scenario, a
-- separate future exercise if ever needed.
--
-- Reconciliation note on `quotecode-test`'s CURRENT partial state: TEST
-- already has a minimal `quotes` table (9 columns) and its own
-- `quotes_quote_number_seq`, created by an untracked, ad-hoc bootstrap step
-- from an earlier disposable-validation task — NOT by any tracked
-- migration, and NOT by this file either. Every statement below uses
-- `ADD COLUMN IF NOT EXISTS` (never a bare `CREATE TABLE` for `quotes`
-- itself beyond a minimal bootstrap), so it is a safe no-op for every
-- column TEST already has, and correctly backfills the 14 columns it does
-- not have — see Part 3 below. This behavior is confirmed order-independent
-- (§18.CP's `quote_number` column-default safety analysis) — Postgres only
-- evaluates an `ADD COLUMN`'s DEFAULT clause when the column doesn't yet
-- exist, regardless of migration order.

-- ============================================================
-- PART 1 — Tables with no pre-existing partial state (8 of 9)
-- ============================================================
-- None of these exist at all in quotecode-test today (confirmed via
-- pg_tables) — plain CREATE TABLE IF NOT EXISTS is safe and complete.

CREATE TABLE IF NOT EXISTS public.business_settings (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_name         text DEFAULT 'ProFlow',
  tax_id                text,
  email                 text,
  phone                 text,
  address               text,
  created_at            timestamptz DEFAULT now(),
  logo_url              text,
  plan                  text DEFAULT 'free',
  user_id               uuid NOT NULL,
  role                  text DEFAULT 'user',
  emailjs_service_id    text,
  emailjs_template_id   text,
  emailjs_public_key    text,
  country               text DEFAULT 'Unknown',
  last_sign_in          timestamptz DEFAULT now(),
  trial_ends_at         timestamptz,
  trial_reminder_sent   boolean DEFAULT false,
  default_terms         text,
  currency              text DEFAULT 'USD',
  trial_reminder_3d_sent  boolean DEFAULT false,
  trial_reminder_24h_sent boolean DEFAULT false
);

COMMENT ON TABLE public.business_settings IS
  'Captured 2026-08-30 from live Production introspection (Phase 1, Full Runtime TEST Build). One row per business/user — the account-level profile, plan, trial, market (country/currency), and email-integration settings. Not represented in any earlier tracked migration.';

CREATE TABLE IF NOT EXISTS public.chat_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    text,
  user_question text,
  ai_response   text,
  category      text,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.chat_logs IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). AI-chat-widget conversation log, super-admin-visible only (see RLS in Part 2 of this capture).';

CREATE TABLE IF NOT EXISTS public.clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name character varying NOT NULL,
  contact_name character varying,
  email        character varying NOT NULL,
  created_at   timestamptz DEFAULT CURRENT_TIMESTAMP,
  phone        text,
  user_id      uuid,
  client_type  text DEFAULT 'business',
  tax_id       text,
  address      text,
  terms        text,
  notes        text
);

COMMENT ON TABLE public.clients IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). Per-business client/customer directory.';

CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  description  text NOT NULL,
  amount       numeric NOT NULL,
  category     text DEFAULT 'General',
  expense_date date DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  is_recurring boolean DEFAULT false
);

COMMENT ON TABLE public.expenses IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). Per-business expense tracking for the Finances tab.';

CREATE TABLE IF NOT EXISTS public.quote_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid,
  file_name    text NOT NULL,
  file_url     text NOT NULL,
  file_size    bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  storage_path text
);

COMMENT ON TABLE public.quote_attachments IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). File attachments for a quote, backed by the `quote-files` storage bucket (see Part 4 of this capture).';

CREATE TABLE IF NOT EXISTS public.quote_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid,
  description character varying NOT NULL,
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL,
  total_price numeric NOT NULL
);

COMMENT ON TABLE public.quote_items IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). Line items belonging to a quote.';

CREATE TABLE IF NOT EXISTS public.quotecode_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  client_name      text NOT NULL,
  client_email     text,
  doc_type         text NOT NULL,
  currency         text NOT NULL,
  total_amount     text NOT NULL,
  items            jsonb NOT NULL,
  terms            text,
  user_id          text,
  quote_number     text,
  client_phone     text,
  valid_until      text,
  discount_percent numeric DEFAULT 0
);

COMMENT ON TABLE public.quotecode_documents IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). A separate, intentionally publicly-readable document-sharing table (distinct from `quotes`/`quote_items`) — see its permissive RLS policies in Part 2, which are faithfully replicated, not a gap.';

CREATE TABLE IF NOT EXISTS public.services (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  price      numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  user_id    uuid
);

COMMENT ON TABLE public.services IS
  'Captured 2026-08-30 from live Production introspection (Phase 1). Per-business services/products catalog, reused when building quote line items.';

-- ============================================================
-- PART 2 — `quotes` base columns (reconciled with the existing
-- item-17/18 migration chain, NOT a fresh CREATE TABLE)
-- ============================================================
-- `quotes` already exists in quotecode-test with 9 columns (id, user_id,
-- quote_number, status, signature, notes, created_at, attn_name,
-- attn_role) via an untracked ad-hoc bootstrap + the six existing tracked
-- migrations. This section backfills the 14 REMAINING base columns using
-- `ADD COLUMN IF NOT EXISTS` throughout, so it is a safe no-op for columns
-- that already exist and a correct backfill for columns that don't —
-- safe against both TEST's current partial state and any future blank
-- project.
--
-- `id`, `user_id`, `status`, `signature`, `notes`, `created_at` are
-- included below too (also via IF NOT EXISTS) purely so this file alone
-- can bootstrap `quotes` from nothing on a genuinely blank future project,
-- without conflicting with their already-correct definitions on TEST today.

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- `status` uses a `quote_status` enum type on Production purely as the
-- literal cast inside its DEFAULT expression (the column itself is plain
-- `text` — confirmed via information_schema.columns.data_type). The enum
-- type must exist before it can be referenced in that DEFAULT, so it is
-- created here, BEFORE the ADD COLUMN below (moved during this task's own
-- static validation pass, which caught the original ordering as a genuine
-- bug — see the file-level note further down for the full rationale).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'approved', 'paid');
  END IF;
END
$$;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_id                uuid,
  ADD COLUMN IF NOT EXISTS status                   text DEFAULT 'draft'::quote_status,
  ADD COLUMN IF NOT EXISTS valid_until               date,
  ADD COLUMN IF NOT EXISTS currency                  character varying DEFAULT 'USD'::character varying,
  ADD COLUMN IF NOT EXISTS subtotal                  numeric DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_rate                  numeric DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total                     numeric DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS notes                     text,
  ADD COLUMN IF NOT EXISTS created_at                timestamptz DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS discount                  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id                   uuid,
  ADD COLUMN IF NOT EXISTS client_type               text DEFAULT 'business'::text,
  ADD COLUMN IF NOT EXISTS terms                     text,
  ADD COLUMN IF NOT EXISTS expiration_reminder_sent  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature                 text,
  ADD COLUMN IF NOT EXISTS view_count                integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subject                   text,
  ADD COLUMN IF NOT EXISTS quote_subject             text,
  ADD COLUMN IF NOT EXISTS email_bounced             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_bounce_reason       text,
  ADD COLUMN IF NOT EXISTS email_bounced_at          timestamptz;

-- `quote_number` is DELIBERATELY NOT added here. It is already fully owned
-- by the existing tracked migration chain on quotecode-test (created via
-- an untracked bootstrap, then correctly advanced through
-- 20260827000000→20260827000003 there — confirmed NOT NULL, no default,
-- exactly the intended post-cutover state). Production's OWN quote_number
-- (also NOT NULL, but still DEFAULT nextval('quotes_quote_number_seq'),
-- pre-cutover) is captured separately below via its own guarded ADD COLUMN
-- so a genuinely blank future project gets Production's CURRENT
-- (pre-cutover) baseline, while TEST's already-more-advanced state is left
-- untouched — this is the exact reconciliation this task's own §6
-- required, not an oversight.
CREATE SEQUENCE IF NOT EXISTS public.quotes_quote_number_seq;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_number integer NOT NULL DEFAULT nextval('public.quotes_quote_number_seq'::regclass);

ALTER SEQUENCE public.quotes_quote_number_seq OWNED BY public.quotes.quote_number;

-- ============================================================
-- PART 3 — Constraints (PK/FK/UNIQUE) — guarded, idempotent, matching the
-- exact pattern already used by 202608270000015_attach_quote_number_unique_
-- constraint.sql for the same reason (plain Postgres has no `ADD
-- CONSTRAINT IF NOT EXISTS`).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_user_id_fkey' AND conrelid = 'public.business_settings'::regclass) THEN
    ALTER TABLE public.business_settings ADD CONSTRAINT business_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_user_id_unique' AND conrelid = 'public.business_settings'::regclass) THEN
    ALTER TABLE public.business_settings ADD CONSTRAINT business_settings_user_id_unique UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_user_id_fkey' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_user_id_fkey' AND conrelid = 'public.expenses'::regclass) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_attachments_quote_id_fkey' AND conrelid = 'public.quote_attachments'::regclass) THEN
    ALTER TABLE public.quote_attachments ADD CONSTRAINT quote_attachments_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_quote_id_fkey' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_client_id_fkey' AND conrelid = 'public.quotes'::regclass) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_user_id_fkey' AND conrelid = 'public.quotes'::regclass) THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END
$$;

-- Note: `business_settings_user_id_idx` (a plain, separate unique index
-- duplicating what `business_settings_user_id_unique` already enforces) is
-- a confirmed, pre-existing, harmless Production redundancy — faithfully
-- NOT recreated here as a second mechanism beyond the UNIQUE constraint
-- above (the constraint already creates its own backing index), since
-- adding a literal second index with a different name would not change
-- runtime behavior and only existed on Production as historical accretion,
-- not a required object for TEST parity. Flagged for the record, not
-- silently omitted.

-- No CHECK constraints exist on any of these 9 tables on Production
-- (confirmed via `pg_constraint` — zero `contype = 'c'` rows) — none to
-- capture.

-- ============================================================
-- ROLLBACK (not part of the forward migration — run manually, and only
-- against quotecode-test, NEVER Production; would need to run after
-- rolling back Parts 2–4 of this same capture package first, since they
-- depend on these tables/columns):
--
-- ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_client_id_fkey, DROP CONSTRAINT IF EXISTS quotes_user_id_fkey;
-- (then drop the 14 backfilled quotes columns individually if a full revert to TEST's pre-Phase-1 9-column state is required)
-- DROP TABLE IF EXISTS public.quote_attachments, public.quote_items, public.quotecode_documents, public.clients, public.expenses, public.services, public.chat_logs, public.business_settings CASCADE;
-- ============================================================
