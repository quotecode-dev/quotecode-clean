-- baseline: the platform stubs + every repo migration applied; the synthetic fixtures seed cleanly
SELECT tst.seed();
DO $$ BEGIN
  PERFORM tst.ok((SELECT count(*) FROM public.business_settings) >= 2, 'synthetic tenants seeded');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'public_approve_quote'), 'public_approve_quote exists');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_quote_structured'), 'save_quote_structured exists');
END $$;
