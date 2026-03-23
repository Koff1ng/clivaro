# Deploy producción

## Solo migraciones SQL (CLI Supabase)

Aplica `supabase/migrations/*.sql` al proyecto de Supabase **enlazado**.

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npm run deploy:supabase
```

En CI, define `SUPABASE_ACCESS_TOKEN` y ejecuta `npx supabase db push` (el link puede guardarse en `supabase/config.toml` o variables del workflow).

## Flujo completo (Prisma + Supabase + Git + Vercel)

```bash
# Opcional: DATABASE_URL de producción en .env o en el entorno
npm run deploy:production
```

Saltar Supabase: `npm run deploy:production -- --no-supabase`

## Orden que ejecuta `deploy:production`

1. `prisma generate` + `prisma db push` (schema Prisma → misma BD que uses en `DATABASE_URL`)
2. `npx supabase db push` (migraciones de la carpeta `supabase/migrations/`)
3. `git push origin <rama-actual>`
4. `npx vercel --prod --yes`

PowerShell: `.\scripts\deploy-production.ps1` (usa `-NoSupabase` si no quieres el paso 2).
