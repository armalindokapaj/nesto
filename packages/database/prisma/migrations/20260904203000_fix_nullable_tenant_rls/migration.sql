-- Fix the RLS policy on tables whose tenantId is nullable.
--
-- The original policy read:
--
--   ("tenantId" IS NOT NULL AND "tenantId" = current_tenant())
--   OR ("tenantId" IS NULL AND is_platform())
--
-- which says the platform audience may see rows with NO tenant, and *only*
-- those. That is wrong, and it broke two things that had to work:
--
--   - the outbox relay could not see a single event, because every event has a
--     tenant and the relay runs in the platform audience;
--   - the audit sealer could not read the events it exists to seal, and could
--     not insert a seal carrying a tenant id.
--
-- Neither failed loudly. The relay's claim query simply returned no rows, which
-- is the worst possible failure mode for this component: silence that looks
-- like "nothing to do".
--
-- The correct rule is the one already used on non-nullable tables: the platform
-- audience is unrestricted at the database, and application policy is what
-- actually gates it (§24.5 still forbids a tenant-data explorer). A tenant
-- session sees only its own rows, and never the tenantless platform ones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    WHERE c.column_name = 'tenantId'
      AND c.is_nullable = 'YES'
      AND c.table_schema IN (
        'foundation','identity','authorization','organization','projects','project_core','tasks',
        'documents','contracts','finance','procurement','inventory','site','quality','hse','hr',
        'crm','network','workflow','notifications','integration','audit')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I.%I', r.table_schema, r.table_name);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I.%I
      USING (
        public.nesto_is_platform()
        OR ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant())
      )
      WITH CHECK (
        public.nesto_is_platform()
        OR ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant())
      )
    $f$, r.table_schema, r.table_name);
  END LOOP;
END $$;
