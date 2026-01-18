import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs'

// Cache de clientes Prisma por tenant usando globalThis para persistir en serverless
const globalForTenantClients = globalThis as unknown as {
  tenantClients: Map<string, PrismaClient> | undefined
}

const tenantClients = globalForTenantClients.tenantClients ?? new Map<string, PrismaClient>()

// Persistir cache en globalThis para reutilizar en serverless
if (!globalForTenantClients.tenantClients) {
  globalForTenantClients.tenantClients = tenantClients
}

/**
 * Normaliza la URL de la base de datos, convirtiendo rutas relativas a absolutas
 */
function normalizeDatabaseUrl(databaseUrl: string): string {
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    return databaseUrl
  }
  // Si ya es una ruta absoluta (comienza con file:/ y tiene ruta absoluta), retornarla
  if (databaseUrl.startsWith('file:/') && path.isAbsolute(databaseUrl.replace('file:', '').replace(/^\/+/, ''))) {
    return databaseUrl
  }

  // Extraer la ruta del archivo
  let dbPath = databaseUrl.replace(/^file:/, '').trim()
  
  // Normalizar separadores
  dbPath = dbPath.replace(/\\/g, '/')
  
  // Si comienza con ./ o ../, es relativa
  if (dbPath.startsWith('./') || dbPath.startsWith('../')) {
    dbPath = path.resolve(process.cwd(), dbPath)
  } else if (!path.isAbsolute(dbPath)) {
    // Si no es absoluta y no tiene prefijo, asumir relativa desde cwd
    dbPath = path.resolve(process.cwd(), dbPath)
  }
  
  // Normalizar la ruta
  dbPath = path.normalize(dbPath)
  
  // Asegurar que la extensión sea .db
  if (!dbPath.endsWith('.db')) {
    dbPath = `${dbPath}.db`
  }
  
  // Convertir a formato file: con separadores Unix para Prisma
  return `file:${dbPath.replace(/\\/g, '/')}`
}

/**
 * Añade connection_limit a URLs de PostgreSQL para limitar el pool
 */
function addConnectionLimit(url: string): string {
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    return url
  }
  
  // Si ya tiene connection_limit, no hacer nada
  if (url.includes('connection_limit=')) {
    return url
  }
  
  // Añadir connection_limit=1 y pool_timeout para usar solo 1 conexión del pool de Supabase
  const separator = url.includes('?') ? '&' : '?'
  // Usar connection_limit=1 y pool_timeout=10 para evitar exceder el límite
  let newUrl = url
  if (!newUrl.includes('connection_limit=')) {
    newUrl = `${newUrl}${separator}connection_limit=1`
  }
  if (!newUrl.includes('pool_timeout=')) {
    const sep = newUrl.includes('?') ? '&' : '?'
    newUrl = `${newUrl}${sep}pool_timeout=10`
  }
  return newUrl
}

/**
 * Obtiene el cliente Prisma para un tenant específico
 * Crea una nueva conexión si no existe
 */
export function getTenantPrisma(databaseUrl: string): PrismaClient {
  // Postgres tenants (Supabase) should not run any filesystem checks
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    // Normalizar URL añadiendo connection_limit si es necesario
    const normalizedUrl = addConnectionLimit(databaseUrl.trim())
    const key = normalizedUrl
    
    // Si ya existe, retornarlo inmediatamente
    if (tenantClients.has(key)) {
      return tenantClients.get(key)!
    }

    // Crear nuevo cliente (con connection_limit=1 para limitar el pool)
    const client = new PrismaClient({
      datasources: {
        db: {
          url: key,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
    
    // Double-check: verificar una vez más antes de guardar (evita race conditions)
    if (!tenantClients.has(key)) {
      tenantClients.set(key, client)
    } else {
      // Si otro thread creó uno mientras tanto, usar ese y desconectar este
      const existing = tenantClients.get(key)!
      client.$disconnect().catch(() => {}) // Desconectar en background
      return existing
    }
    
    return client
  }

  // Normalizar la URL (convertir ruta relativa a absoluta)
  const normalizedUrl = normalizeDatabaseUrl(databaseUrl)
  
  console.log('[getTenantPrisma] Database URL recibida:', databaseUrl)
  console.log('[getTenantPrisma] Database URL normalizada:', normalizedUrl)
  
  // Si ya existe un cliente para esta BD, reutilizarlo
  if (tenantClients.has(normalizedUrl)) {
    console.log('[getTenantPrisma] Reutilizando cliente Prisma existente para:', normalizedUrl)
    return tenantClients.get(normalizedUrl)!
  }

  // Verificar que el archivo existe (o su directorio)
  const dbPath = normalizedUrl.replace(/^file:/, '').replace(/\//g, path.sep)
  const dbDir = path.dirname(dbPath)
  
  console.log('[getTenantPrisma] Ruta de BD:', dbPath)
  console.log('[getTenantPrisma] Directorio de BD:', dbDir)
  console.log('[getTenantPrisma] Archivo existe:', fs.existsSync(dbPath))
  
  if (!fs.existsSync(dbDir)) {
    console.warn(`⚠️ Directorio de BD no existe: ${dbDir}, creándolo...`)
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Crear nuevo cliente Prisma con la URL del tenant normalizada
  console.log('[getTenantPrisma] Creando nuevo cliente Prisma para:', normalizedUrl)
  const client = new PrismaClient({
    datasources: {
      db: {
        url: normalizedUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  // Guardar en cache usando la URL original para consistencia
  tenantClients.set(normalizedUrl, client)
  console.log('[getTenantPrisma] Cliente Prisma creado y guardado en cache')

  return client
}

/**
 * Obtiene el tenant desde la URL o headers
 */
export async function getTenantFromRequest(request: Request): Promise<{ id: string; slug: string; databaseUrl: string } | null> {
  try {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    
    // Buscar tenant slug en la URL (ej: /login/mi-empresa)
    let tenantSlug: string | null = null
    
    // Intentar obtener de la URL
    const loginIndex = pathParts.indexOf('login')
    if (loginIndex !== -1 && pathParts[loginIndex + 1]) {
      tenantSlug = pathParts[loginIndex + 1]
    }

    // Si no está en la URL, intentar obtener de headers o cookies
    if (!tenantSlug) {
      const tenantHeader = request.headers.get('x-tenant-slug')
      if (tenantHeader) {
        tenantSlug = tenantHeader
      }
    }

    if (!tenantSlug) {
      return null
    }

    // Obtener tenant de la base de datos maestra
    const { prisma } = await import('./db')
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        databaseUrl: true,
        active: true,
      }
    })

    if (!tenant || !tenant.active) {
      return null
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      databaseUrl: tenant.databaseUrl,
    }
  } catch (error) {
    console.error('Error obteniendo tenant:', error)
    return null
  }
}

/**
 * Limpia el cache de clientes Prisma (útil para testing o cambios de BD)
 */
export function clearTenantCache() {
  tenantClients.forEach(client => {
    client.$disconnect()
  })
  tenantClients.clear()
}

