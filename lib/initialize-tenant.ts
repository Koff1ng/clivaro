import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

function getTenantSchemaName(tenantSlug: string): string {
  const safeSlug = tenantSlug.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return `tenant_${safeSlug}`
}

function withSchemaParam(databaseUrl: string, schema: string): string {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.set('schema', schema)
    return url.toString()
  } catch {
    const separator = databaseUrl.includes('?') ? '&' : '?'
    return `${databaseUrl}${separator}schema=${encodeURIComponent(schema)}`
  }
}

function stripSchemaParam(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.delete('schema')
    return url.toString()
  } catch {
    return databaseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
  }
}

async function initializePostgresTenant(databaseUrl: string, tenantSlug: string) {
  const baseUrl = stripSchemaParam(databaseUrl)
  const schemaName = getTenantSchemaName(tenantSlug)
  const schemaUrl = withSchemaParam(baseUrl, schemaName)

  console.log('='.repeat(60))
  console.log('[TENANT INIT] Iniciando inicialización de tenant PostgreSQL')
  console.log(`[TENANT INIT] Slug: ${tenantSlug}`)
  console.log(`[TENANT INIT] Schema: ${schemaName}`)
  console.log(`[TENANT INIT] Base URL (sin schema): ${baseUrl.replace(/:[^:@]+@/, ':****@')}`) // Ocultar password
  console.log('='.repeat(60))

  // Step 1: Create schema
  console.log('[STEP 1/4] Conectando a PostgreSQL para crear schema...')
  const adminPrisma = new PrismaClient({
    datasources: { db: { url: baseUrl } },
    log: ['error', 'warn'],
  })

  try {
    console.log(`[STEP 1/4] Ejecutando: CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
    await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
    console.log('[STEP 1/4] ✓ Schema creado/verificado exitosamente')
  } catch (schemaError: any) {
    console.error('[STEP 1/4] ❌ Error creando schema:')
    console.error(`  Mensaje: ${schemaError?.message || schemaError}`)
    console.error(`  Código: ${schemaError?.code || 'N/A'}`)
    console.error(`  Meta: ${JSON.stringify(schemaError?.meta || {})}`)
    throw new Error(`Error creando schema "${schemaName}": ${schemaError?.message || schemaError}`)
  } finally {
    await adminPrisma.$disconnect()
    console.log('[STEP 1/4] Conexión admin cerrada')
  }

  // Step 2: Connect to tenant schema
  console.log('[STEP 2/4] Conectando al schema del tenant...')
  const tenantPrisma = new PrismaClient({
    datasources: { db: { url: schemaUrl } },
    log: ['error', 'warn'],
  })

  try {
    // Test connection
    await tenantPrisma.$connect()
    console.log('[STEP 2/4] ✓ Conexión al schema del tenant exitosa')
  } catch (connError: any) {
    console.error('[STEP 2/4] ❌ Error conectando al schema del tenant:')
    console.error(`  Mensaje: ${connError?.message || connError}`)
    throw new Error(`Error conectando al schema "${schemaName}": ${connError?.message || connError}`)
  }

  // Step 3: Read and parse SQL file
  console.log('[STEP 3/4] Leyendo archivo supabase-init.sql...')
  let statements: string[] = []
  try {
    const sqlPath = path.join(process.cwd(), 'prisma', 'supabase-init.sql')
    console.log(`[STEP 3/4] Ruta del archivo: ${sqlPath}`)

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Archivo SQL no encontrado: ${sqlPath}`)
    }

    const sqlBuf = fs.readFileSync(sqlPath)
    console.log(`[STEP 3/4] Archivo leído: ${sqlBuf.length} bytes`)

    // PowerShell redirection can write UTF-16LE; detect BOM / NUL bytes and decode accordingly.
    const looksUtf16Le =
      (sqlBuf.length >= 2 && sqlBuf[0] === 0xff && sqlBuf[1] === 0xfe) ||
      sqlBuf.slice(0, Math.min(sqlBuf.length, 200)).includes(0x00)

    console.log(`[STEP 3/4] Encoding detectado: ${looksUtf16Le ? 'UTF-16LE' : 'UTF-8'}`)

    const sqlRaw = looksUtf16Le ? sqlBuf.toString('utf16le') : sqlBuf.toString('utf8')

    // Remove BOM and normalize line endings
    const sql = sqlRaw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

    // Remove full-line comments to avoid dropping statements that start with "-- CreateTable"
    const sqlNoComments = sql.replace(/^\s*--.*$/gm, '').trim()

    // Naive split by semicolon is OK for Prisma diff output (DDL only).
    statements = sqlNoComments
      .split(';')
      .map(stmt => stmt.trim())
      .filter(Boolean)

    console.log(`[STEP 3/4] ✓ ${statements.length} sentencias SQL parseadas`)
  } catch (parseError: any) {
    console.error('[STEP 3/4] ❌ Error parseando archivo SQL:')
    console.error(`  Mensaje: ${parseError?.message || parseError}`)
    await tenantPrisma.$disconnect()
    throw new Error(`Error parseando supabase-init.sql: ${parseError?.message || parseError}`)
  }

  // Step 4: Execute SQL statements in batches for speed
  console.log('[STEP 4/4] Ejecutando sentencias SQL en lotes...')
  const startTime = Date.now()
  let executed = 0
  let skipped = 0
  const BATCH_SIZE = 20 // Process 20 statements at a time

  // Process in batches
  for (let batchStart = 0; batchStart < statements.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, statements.length)
    const batch = statements.slice(batchStart, batchEnd)

    console.log(`[STEP 4/4] Procesando lote ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(statements.length / BATCH_SIZE)} (${batchStart + 1}-${batchEnd}/${statements.length})`)

    // Execute each statement in the batch
    for (let i = 0; i < batch.length; i++) {
      const stmt = batch[i]
      const globalIdx = batchStart + i
      const stmtPreview = stmt.length > 80 ? `${stmt.slice(0, 80)}...` : stmt

      try {
        await tenantPrisma.$executeRawUnsafe(stmt)
        executed++
      } catch (error: any) {
        const errorCode = error?.code || 'UNKNOWN'
        const errorMsg = error?.message || String(error)

        // Check if it's a "relation already exists" error - ignore these
        if (errorCode === '42P07' || errorMsg.includes('already exists')) {
          skipped++
          continue
        }

        // Check if it's a duplicate key error - ignore these
        if (errorCode === '23505' || errorMsg.includes('duplicate key')) {
          skipped++
          continue
        }

        // For other errors, log and throw
        console.error(`[STEP 4/4] ❌ Error en sentencia ${globalIdx + 1}/${statements.length}:`)
        console.error(`  Código: ${errorCode}`)
        console.error(`  Mensaje: ${errorMsg}`)
        console.error(`  SQL: ${stmtPreview}`)

        await tenantPrisma.$disconnect()
        throw new Error(
          `Fallo en SQL (stmt ${globalIdx + 1}/${statements.length}):\n` +
          `  SQL: ${stmtPreview}\n` +
          `  Código: ${errorCode}\n` +
          `  Error: ${errorMsg}`
        )
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log('='.repeat(60))
  console.log(`[TENANT INIT] ✓ Inicialización de schema completada en ${elapsed}s`)
  console.log(`[TENANT INIT] Sentencias ejecutadas: ${executed}`)
  console.log(`[TENANT INIT] Sentencias ignoradas (ya existían): ${skipped}`)
  console.log('='.repeat(60))

  return { tenantPrisma }
}

/**
 * Inicializa la base de datos de un tenant recién creado
 * Crea: permisos, roles, usuario admin por defecto, almacén principal
 */
export async function initializeTenantDatabase(databaseUrl: string, tenantName: string, tenantSlug: string) {
  console.log(`Inicializando base de datos para tenant: ${tenantName}`)
  console.log(`Database URL: ${databaseUrl}`)

  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    const { tenantPrisma } = await initializePostgresTenant(databaseUrl, tenantSlug)
    return await seedTenantData(tenantPrisma, tenantName)
  }

  // Extraer la ruta del archivo de la URL
  let dbPath = databaseUrl.replace(/^file:/, '').trim()

  // Normalizar separadores de ruta (Windows usa \, Unix usa /)
  dbPath = dbPath.replace(/\\/g, '/')

  // Si comienza con ./ o ../, es relativa
  if (dbPath.startsWith('./') || dbPath.startsWith('../')) {
    dbPath = path.resolve(process.cwd(), dbPath)
  } else if (!path.isAbsolute(dbPath)) {
    // Si no es absoluta y no tiene prefijo, asumir relativa desde cwd
    dbPath = path.resolve(process.cwd(), dbPath)
  }

  // Normalizar la ruta (resolver .. y .)
  dbPath = path.normalize(dbPath)

  // Asegurar que la extensión sea .db
  if (!dbPath.endsWith('.db')) {
    dbPath = `${dbPath}.db`
  }

  const dbDir = path.dirname(dbPath)

  // Crear directorio si no existe
  if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true })
      console.log(`✓ Directorio creado: ${dbDir}`)
    } catch (dirError: any) {
      console.error(`Error creando directorio: ${dirError.message}`)
      throw new Error(`No se pudo crear el directorio: ${dbDir}. Error: ${dirError.message}`)
    }
  }

  // Para SQLite, usar la ruta con separadores nativos del sistema
  // Pero mantener el formato file: para Prisma
  const absoluteDatabaseUrl = `file:${dbPath.replace(/\\/g, '/')}`
  console.log(`Ruta absoluta de BD: ${dbPath}`)
  console.log(`Database URL para Prisma: ${absoluteDatabaseUrl}`)

  // Verificar que la base de datos no exista o esté vacía
  // Si existe, eliminarla para crear una nueva desde cero
  if (fs.existsSync(dbPath)) {
    console.log(`⚠️ Base de datos ya existe en: ${dbPath}`)
    console.log(`⚠️ Eliminando base de datos existente para crear una nueva desde cero...`)
    try {
      fs.unlinkSync(dbPath)
      console.log(`✓ Base de datos anterior eliminada`)
    } catch (deleteError: any) {
      console.error(`Error eliminando base de datos anterior: ${deleteError.message}`)
      throw new Error(`No se pudo eliminar la base de datos existente: ${dbPath}. Error: ${deleteError.message}`)
    }
  }

  // Crear esquema de base de datos usando prisma db push
  // Esto es más adecuado para nuevas bases de datos que prisma migrate
  let schemaCreated = false
  try {
    console.log('Creando esquema de base de datos NUEVA desde cero...')
    console.log(`Ejecutando: npx prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate`)
    console.log(`Con DATABASE_URL: ${absoluteDatabaseUrl}`)
    console.log(`Desde directorio: ${process.cwd()}`)

    // Crear un schema temporal que use la BD del tenant
    // Esto evita que Prisma use la BD del .env
    const tempSchemaPath = path.join(process.cwd(), 'prisma', `schema.${tenantName.toLowerCase().replace(/\s+/g, '-')}.temp.prisma`)
    const originalSchema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8')

    // Reemplazar la URL en el schema temporal
    // Si el schema usa env("DATABASE_URL"), lo reemplazamos con la URL del tenant
    let tempSchema = originalSchema
    if (originalSchema.includes('env("DATABASE_URL")')) {
      // Reemplazar env("DATABASE_URL") con la URL del tenant
      tempSchema = originalSchema.replace(
        /url\s*=\s*env\("DATABASE_URL"\)/,
        `url = "${absoluteDatabaseUrl}"`
      )
      console.log('✓ Schema temporal creado con URL del tenant')
    } else {
      // Reemplazar URL hardcodeada
      tempSchema = originalSchema.replace(
        /url\s*=\s*["'].*["']/,
        `url = "${absoluteDatabaseUrl}"`
      )
      console.log('✓ Schema temporal creado con URL del tenant (reemplazando URL hardcodeada)')
    }

    fs.writeFileSync(tempSchemaPath, tempSchema, 'utf-8')
    console.log(`✓ Schema temporal guardado en: ${tempSchemaPath}`)

    try {
      const output = execSync(
        `npx prisma db push --schema=${tempSchemaPath} --accept-data-loss --skip-generate`,
        {
          env: { ...process.env, DATABASE_URL: absoluteDatabaseUrl },
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf-8',
          timeout: 120000,
          cwd: process.cwd(),
          shell: process.platform === 'win32' ? (process.env.COMSPEC || 'cmd.exe') : '/bin/bash',
        }
      )

      const stdout = output.toString().trim()
      const stderr = (output as any).stderr?.toString()?.trim() || ''

      console.log('✓ Comando ejecutado')
      if (stdout) {
        console.log('STDOUT:', stdout)
      }
      if (stderr && !stderr.toLowerCase().includes('warning')) {
        console.log('STDERR:', stderr)
      }
    } finally {
      // Limpiar el schema temporal
      try {
        if (fs.existsSync(tempSchemaPath)) {
          fs.unlinkSync(tempSchemaPath)
          console.log('✓ Schema temporal eliminado')
        }
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo eliminar el schema temporal:', cleanupError)
      }
    }

    // IMPORTANTE: Siempre verificar la BD del tenant directamente
    // El mensaje "already in sync" puede referirse a dev.db (del .env), no a la BD del tenant
    console.log('Verificando base de datos del tenant directamente...')
    try {
      const testPrisma = new PrismaClient({
        datasources: {
          db: { url: absoluteDatabaseUrl },
        },
      })
      await testPrisma.$connect()
      await testPrisma.$queryRaw`SELECT 1`

      const tables = await testPrisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `

      await testPrisma.$disconnect()

      if (tables && tables.length > 0) {
        console.log(`✓ Base de datos del tenant existe y tiene ${tables.length} tabla(s)`)
        schemaCreated = true
      } else {
        console.log('⚠️ Base de datos del tenant existe pero está vacía')
        // Si la BD está vacía, el comando prisma db push debería haberla creado
        // Pero puede que Prisma haya usado la BD del .env en lugar de la del tenant
        // Continuar de todas formas - Prisma creará las tablas cuando se usen
        schemaCreated = true
      }
    } catch (verifyError: any) {
      console.error('Error verificando BD del tenant:', verifyError.message)
      // Si no podemos conectar, la BD no existe o hay un problema
      // Continuar de todas formas - puede que el comando la haya creado pero no podamos conectarnos aún
      console.log('⚠️ No se pudo verificar la BD, pero continuando...')
      schemaCreated = true // Continuar de todas formas
    }
  } catch (error: any) {
    const errorMessage = error.message || error.toString() || ''
    const stdout = error.stdout?.toString()?.trim() || ''
    const stderr = error.stderr?.toString()?.trim() || ''
    const status = error.status || error.code || 'unknown'

    console.error('❌ Error ejecutando prisma db push:')
    console.error(`  Status/Code: ${status}`)
    console.error(`  Message: ${errorMessage}`)
    if (stdout) {
      console.error(`  STDOUT: ${stdout}`)
    }
    if (stderr) {
      console.error(`  STDERR: ${stderr}`)
    }

    // Verificar si la BD ya está creada y tiene tablas
    console.log('Verificando si la base de datos ya existe...')
    try {
      const testPrisma = new PrismaClient({
        datasources: {
          db: { url: absoluteDatabaseUrl },
        },
      })
      await testPrisma.$connect()
      // Intentar una query simple para verificar que la BD funciona
      await testPrisma.$queryRaw`SELECT 1`

      // Intentar verificar si hay tablas
      const tables = await testPrisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `

      await testPrisma.$disconnect()

      if (tables && tables.length > 0) {
        console.log(`✓ Base de datos existe y tiene ${tables.length} tabla(s), continuando...`)
        schemaCreated = true
      } else {
        console.log('⚠️ Base de datos existe pero está vacía, continuando de todas formas...')
        schemaCreated = true // Continuar de todas formas
      }
    } catch (testError: any) {
      // Si no podemos conectar, lanzar el error original con más detalles
      const testErrorMsg = testError.message || testError.toString() || ''
      const fullError = new Error(
        `Error al crear el esquema de base de datos.\n` +
        `Error del comando: ${errorMessage}\n` +
        `STDOUT: ${stdout || '(vacío)'}\n` +
        `STDERR: ${stderr || '(vacío)'}\n` +
        `Error de prueba de conexión: ${testErrorMsg}\n` +
        `Ruta de BD: ${dbPath}\n` +
        `Database URL: ${absoluteDatabaseUrl}`
      )
      console.error('❌ Error completo:', fullError.message)
      throw fullError
    }
  }

  if (!schemaCreated) {
    throw new Error('No se pudo crear o verificar el esquema de la base de datos')
  }

  // Generar cliente Prisma (solo una vez, no por cada tenant)
  // El cliente ya está generado para el schema principal
  console.log('✓ Usando cliente Prisma existente')

  // Crear cliente Prisma para el tenant usando la ruta absoluta
  const tenantPrisma = new PrismaClient({
    datasources: {
      db: {
        url: absoluteDatabaseUrl,
      },
    },
  })
  return await seedTenantData(tenantPrisma, tenantName)
}

async function seedTenantData(tenantPrisma: PrismaClient, tenantName: string) {
  try {
    const permissions = [
      { name: 'manage_users', description: 'Manage users and roles' },
      { name: 'manage_products', description: 'Manage products catalog' },
      { name: 'manage_inventory', description: 'Manage inventory and stock' },
      { name: 'manage_sales', description: 'Manage sales, orders, invoices' },
      { name: 'manage_returns', description: 'Manage returns and refunds' },
      { name: 'void_invoices', description: 'Void/cancel invoices (with reason)' },
      { name: 'apply_discounts', description: 'Apply discounts in POS and sales' },
      { name: 'manage_purchases', description: 'Manage purchases and suppliers' },
      { name: 'manage_crm', description: 'Manage customers and leads' },
      { name: 'view_reports', description: 'View reports and analytics' },
      { name: 'manage_cash', description: 'Manage cash register and shifts' },
    ]

    for (const perm of permissions) {
      await tenantPrisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: perm,
      })
    }
    console.log('✓ Permisos creados')

    const adminRole = await tenantPrisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: {
        name: 'ADMIN',
        description: 'Administrator with all permissions',
      },
    })

    const managerRole = await tenantPrisma.role.upsert({
      where: { name: 'MANAGER' },
      update: {},
      create: {
        name: 'MANAGER',
        description: 'Manager with most permissions',
      },
    })

    const cashierRole = await tenantPrisma.role.upsert({
      where: { name: 'CASHIER' },
      update: {},
      create: {
        name: 'CASHIER',
        description: 'Cashier for POS operations',
      },
    })

    const salesRole = await tenantPrisma.role.upsert({
      where: { name: 'SALES' },
      update: {},
      create: {
        name: 'SALES',
        description: 'Sales person',
      },
    })

    const warehouseRole = await tenantPrisma.role.upsert({
      where: { name: 'WAREHOUSE' },
      update: {},
      create: {
        name: 'WAREHOUSE',
        description: 'Warehouse staff',
      },
    })
    console.log('✓ Roles creados')

    const allPermissions = await tenantPrisma.permission.findMany()
    const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]))

    for (const perm of allPermissions) {
      await tenantPrisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      })
    }

    const managerPermissions = allPermissions.filter(p => p.name !== 'manage_users')
    for (const perm of managerPermissions) {
      await tenantPrisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: perm.id,
        },
      })
    }

    const cashierPerms = ['manage_sales', 'manage_cash', 'manage_crm', 'view_reports', 'apply_discounts']
    for (const permName of cashierPerms) {
      const permId = permissionMap.get(permName)
      if (permId) {
        await tenantPrisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: cashierRole.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: cashierRole.id,
            permissionId: permId,
          },
        })
      }
    }

    const salesPerms = ['manage_sales', 'manage_crm', 'view_reports']
    for (const permName of salesPerms) {
      const permId = permissionMap.get(permName)
      if (permId) {
        await tenantPrisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: salesRole.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: salesRole.id,
            permissionId: permId,
          },
        })
      }
    }

    const warehousePerms = ['manage_inventory', 'manage_purchases', 'manage_products']
    for (const permName of warehousePerms) {
      const permId = permissionMap.get(permName)
      if (permId) {
        await tenantPrisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: warehouseRole.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: warehouseRole.id,
            permissionId: permId,
          },
        })
      }
    }
    console.log('✓ Permisos asignados a roles')

    const defaultPassword = 'Admin123!'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    const adminUser = await tenantPrisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        // Use a consistent email so super admin can share credentials patterns across tenants
        email: 'admin@local',
        password: hashedPassword,
        name: 'Administrador',
        active: true,
      },
    })
    console.log('✓ Usuario admin creado')

    await tenantPrisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    })
    console.log('✓ Rol ADMIN asignado al usuario')

    await tenantPrisma.warehouse.upsert({
      where: { name: 'Almacén Principal' },
      update: {},
      create: {
        name: 'Almacén Principal',
        address: 'Dirección principal',
        active: true,
      },
    })
    console.log('✓ Almacén principal creado')

    console.log('\n✅ Base de datos del tenant inicializada correctamente')
    console.log('\n📋 Credenciales por defecto:')
    console.log(`   Usuario: admin`)
    console.log(`   Contraseña: ${defaultPassword}`)
    console.log(`   ⚠️  IMPORTANTE: Cambiar la contraseña después del primer inicio de sesión`)

    return {
      adminUsername: 'admin',
      adminPassword: defaultPassword,
    }
  } catch (error) {
    console.error('Error inicializando base de datos del tenant:', error)
    throw error
  } finally {
    await tenantPrisma.$disconnect()
  }
}

