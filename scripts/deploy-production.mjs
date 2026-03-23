#!/usr/bin/env node
/**
 * Despliegue: sincroniza schema Prisma con la BD + opcionalmente git push y Vercel.
 *
 * Prisma lee DATABASE_URL desde el entorno o desde `.env` en la raíz del proyecto
 * (igual que `npx prisma db push` a mano).
 *
 * Uso:
 *   npm run deploy:production
 *   npm run deploy:production -- --no-git
 *   npm run deploy:production -- --no-db --no-vercel
 *
 * Windows (PowerShell), apuntando a producción:
 *   $env:DATABASE_URL="postgresql://..."; npm run deploy:production
 *
 * Supabase CLI (migraciones en supabase/migrations/):
 *   npx supabase login
 *   npx supabase link --project-ref <REF>   # una vez por máquina/proyecto
 *   En CI: SUPABASE_ACCESS_TOKEN
 *
 * Opciones:
 *   --no-db           No ejecuta prisma generate / db push
 *   --no-supabase     No ejecuta `supabase db push`
 *   --no-git          No hace git push
 *   --no-vercel       No ejecuta vercel --prod
 *   --branch <name>   Rama a pushear (default: rama actual)
 *   --accept-data-loss  Pasa el flag a `prisma db push`
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function run(label, command, args, options = {}) {
  console.log(`\n▶ ${label}\n  ${command} ${args.join(' ')}`)
  const r = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })
  if (r.status !== 0) {
    console.error(`\n✖ Falló: ${label} (código ${r.status ?? r.signal})`)
    process.exit(r.status ?? 1)
  }
}

function hasArg(name) {
  return process.argv.includes(name)
}

function argValue(name) {
  const i = process.argv.indexOf(name)
  if (i === -1 || !process.argv[i + 1]) return null
  return process.argv[i + 1]
}

const skipDb = hasArg('--no-db')
const skipSupabase = hasArg('--no-supabase')
const skipGit = hasArg('--no-git')
const skipVercel = hasArg('--no-vercel')
const acceptDataLoss = hasArg('--accept-data-loss')
const branchArg = argValue('--branch')

function getCurrentBranch() {
  const r = spawnSync('git', ['branch', '--show-current'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  return (r.stdout || '').trim() || 'master'
}

console.log('══ Clivaro — deploy producción ══')
console.log(`Raíz: ${root}`)

const envFile = path.join(root, '.env')
if (!process.env.DATABASE_URL && !fs.existsSync(envFile)) {
  console.warn(
    '\n⚠ No hay DATABASE_URL en el entorno ni archivo .env.\n  Define DATABASE_URL (producción) antes de continuar o crea .env en la raíz.\n'
  )
}

if (!skipDb) {
  run('Prisma generate', 'npx', ['prisma', 'generate'])
  const pushArgs = ['prisma', 'db', 'push']
  if (acceptDataLoss) pushArgs.push('--accept-data-loss')
  run('Prisma db push (schema → BD)', 'npx', pushArgs)
} else {
  console.log('\n○ Saltado: prisma (--no-db)')
}

if (!skipSupabase) {
  console.log(
    '\n  (Supabase: proyecto enlazado con `npx supabase link`. Token CI: SUPABASE_ACCESS_TOKEN)\n'
  )
  run('Supabase db push (migraciones SQL)', 'npx', ['supabase', 'db', 'push'])
} else {
  console.log('\n○ Saltado: supabase db push (--no-supabase)')
}

if (!skipGit) {
  const branch = branchArg || getCurrentBranch()
  run('Git push', 'git', ['push', 'origin', branch])
} else {
  console.log('\n○ Saltado: git push (--no-git)')
}

if (!skipVercel) {
  run('Vercel producción', 'npx', ['vercel', '--prod', '--yes'])
} else {
  console.log('\n○ Saltado: vercel (--no-vercel)')
}

console.log('\n✓ Flujo de deploy completado.\n')
