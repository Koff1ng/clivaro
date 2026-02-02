-- Find the tenant ID for 'la-comitiva'
SELECT id, slug, active, "databaseUrl" FROM "Tenant" WHERE slug = 'la-comitiva';

-- Once we have the ID (e.g., 'cm...'), we check the user in that schema
-- Dynamic SQL isn't easy here, so I'll write a second query after getting the ID.
-- But standard naming is 'tenant_<id>'.
