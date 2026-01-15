import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { getToken } from 'next-auth/jwt'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { PERMISSIONS } from './permissions'
import { logger } from './logger'
import { prisma } from './db'
import { getPrismaForRequest } from './get-tenant-prisma'
import { rateLimiters } from './rate-limit'

/**
 * Require authentication for API routes
 * Tries multiple approaches to get the session
 */
export async function requireAuth(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    
    if (!cookieHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'No cookies found' },
        { status: 401 }
      )
    }
    
    const secret = authOptions.secret || process.env.NEXTAUTH_SECRET
    
    if (!secret) {
      logger.error('NEXTAUTH_SECRET is not configured', undefined, { scope: 'requireAuth' })
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Server configuration error' },
        { status: 401 }
      )
    }
    
    // Approach 1: Try getServerSession with headers
    let session: any = null
    
    try {
      // Build headers object for getServerSession
      const headers = new Headers()
      headers.set('cookie', cookieHeader)
      
      // getServerSession can work with headers in App Router
      session = await getServerSession(authOptions)
    } catch (sessionError) {
      logger.debug('getServerSession failed, trying getToken', { scope: 'requireAuth', sessionError })
    }
    
    // Approach 2: If getServerSession failed, try getToken
    if (!session || !session.user || !(session.user as any)?.id) {
      try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
        
        const token = await getToken({
          req: {
            headers: {
              cookie: cookieString || cookieHeader,
            },
          } as any,
          secret,
        })
        
        if (token && token.sub) {
          // Create session from token
          session = {
            user: {
              id: token.sub,
              email: token.email || '',
              name: token.name || '',
              permissions: (token.permissions as string[]) || [],
              roles: (token.roles as string[]) || [],
              isSuperAdmin: (token.isSuperAdmin as boolean) || false,
              tenantId: (token.tenantId as string) || null,
            },
          }
        }
      } catch (tokenError) {
        logger.error('getToken also failed', tokenError, { scope: 'requireAuth' })
      }
    }
    
    if (!session || !session.user || !(session.user as any).id) {
      logger.warn('All authentication methods failed', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!(session?.user as any)?.id,
        cookieHeaderLength: cookieHeader.length,
      })
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          details: 'No valid session found. Please close your browser completely, clear cookies, and log in again.',
          hint: 'Your session may be invalid. Try logging out and logging back in.'
        },
        { status: 401 }
      )
    }
    
    const user = session.user as any
    
    // Ensure session has all required fields
    const sessionData = {
      user: {
        id: user.id || '',
        email: user.email || '',
        name: user.name || '',
        permissions: user.permissions || [],
        roles: user.roles || [],
        isSuperAdmin: user.isSuperAdmin || false,
        tenantId: user.tenantId || null,
      },
    }
    
    if (!sessionData.user.id) {
      logger.warn('Session missing user ID', { scope: 'requireAuth' })
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Session is missing user ID. Please log out and log back in.' },
        { status: 401 }
      )
    }
    
    return sessionData as any
  } catch (error) {
    logger.error('Error getting session', error, { scope: 'requireAuth' })
    return NextResponse.json(
      { error: 'Unauthorized', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 401 }
    )
  }
}

function getDefaultRateLimitType(method: string): 'auth' | 'api' | 'read' | 'write' {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD') return 'read'
  return 'write'
}

/**
 * Require specific permission for API routes
 */
export async function requirePermission(
  request: Request,
  permission: string | string[],
  options?: { rateLimit?: 'auth' | 'api' | 'read' | 'write' }
): Promise<any> {
  const startTime = Date.now()
  const path = new URL(request.url).pathname
  
  logger.apiRequest(request.method, path)
  
  const session = await requireAuth(request)
  
  if (session instanceof NextResponse) {
    return session
  }

  const user = session.user as any

  // Apply rate limiting (keyed by tenantId + userId + IP when available)
  const rateLimiterType = options?.rateLimit || getDefaultRateLimitType(request.method)
  const rateLimiter = rateLimiters[rateLimiterType]
  const rateLimitResult = await rateLimiter(request, {
    tenantId: user.tenantId,
    userId: user.id,
    scope: path,
  })
  
  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded', {
      path,
      method: request.method,
      retryAfter: rateLimitResult.retryAfter,
      limiter: rateLimiterType,
      tenantId: user.tenantId,
      userId: user.id,
    })
    return NextResponse.json(
      { 
        error: rateLimitResult.message || 'Too many requests',
        retryAfter: rateLimitResult.retryAfter,
      },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          ...(rateLimitResult.limit ? { 'X-RateLimit-Limit': String(rateLimitResult.limit) } : {}),
          ...(typeof rateLimitResult.remaining === 'number' ? { 'X-RateLimit-Remaining': String(rateLimitResult.remaining) } : {}),
          ...(rateLimitResult.reset ? { 'X-RateLimit-Reset': String(rateLimitResult.reset) } : {}),
        },
      }
    )
  }
  
  // Verificar que usuarios de tenant tengan tenantId
  if (!user.isSuperAdmin && !user.tenantId) {
    logger.warn('Invalid session - missing tenantId', {
      userId: user.id,
      path,
      method: request.method,
    })
    return NextResponse.json(
      { 
        error: 'Sesión inválida', 
        details: 'Por favor, cierre sesión y vuelva a iniciar sesión con su empresa.',
        hint: 'Su sesión es de una versión anterior. Debe iniciar sesión nuevamente.'
      },
      { status: 401 }
    )
  }
  
  // Get the correct Prisma client (master or tenant)
  const db = await getPrismaForRequest(request, session)
  
  // Get user roles and permissions
  const userRoles = await db.userRole.findMany({
    where: { userId: user.id },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  const userPermissions = new Set<string>()
  userRoles.forEach(userRole => {
    userRole.role.rolePermissions.forEach(rp => {
      userPermissions.add(rp.permission.name)
    })
  })

  const requiredPermissions = Array.isArray(permission) ? permission : [permission]
  const hasPermission = requiredPermissions.some(perm => userPermissions.has(perm))

  if (!hasPermission) {
    const duration = Date.now() - startTime
    logger.warn('Permission denied', {
      userId: user.id,
      requiredPermissions,
      userPermissions: Array.from(userPermissions),
      path,
      method: request.method,
    })
    logger.apiResponse(request.method, path, 403, duration)
    return NextResponse.json(
      { error: 'Forbidden - Insufficient permissions' },
      { status: 403 }
    )
  }

  const duration = Date.now() - startTime
  logger.apiResponse(request.method, path, 200, duration, {
    userId: user.id,
  })

  return session
}

/**
 * Require any of the specified permissions for API routes
 * Returns session if user has at least one of the required permissions
 */
export async function requireAnyPermission(
  request: Request,
  permissions: string[],
  options?: { rateLimit?: 'auth' | 'api' | 'read' | 'write' }
): Promise<any> {
  const startTime = Date.now()
  const path = new URL(request.url).pathname
  
  logger.apiRequest(request.method, path)
  
  const session = await requireAuth(request)
  
  if (session instanceof NextResponse) {
    return session
  }

  const user = session.user as any

  // Apply rate limiting (keyed by tenantId + userId + IP when available)
  const rateLimiterType = options?.rateLimit || getDefaultRateLimitType(request.method)
  const rateLimiter = rateLimiters[rateLimiterType]
  const rateLimitResult = await rateLimiter(request, {
    tenantId: user.tenantId,
    userId: user.id,
    scope: path,
  })
  
  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded', {
      path,
      method: request.method,
      retryAfter: rateLimitResult.retryAfter,
      limiter: rateLimiterType,
      tenantId: user.tenantId,
      userId: user.id,
    })
    return NextResponse.json(
      { 
        error: rateLimitResult.message || 'Too many requests',
        retryAfter: rateLimitResult.retryAfter,
      },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          ...(rateLimitResult.limit ? { 'X-RateLimit-Limit': String(rateLimitResult.limit) } : {}),
          ...(typeof rateLimitResult.remaining === 'number' ? { 'X-RateLimit-Remaining': String(rateLimitResult.remaining) } : {}),
          ...(rateLimitResult.reset ? { 'X-RateLimit-Reset': String(rateLimitResult.reset) } : {}),
        },
      }
    )
  }
  
  // Get the correct Prisma client (master or tenant)
  const db = await getPrismaForRequest(request, session)
  
  // Verificar que usuarios de tenant tengan tenantId
  if (!user.isSuperAdmin && !user.tenantId) {
    logger.warn('Invalid session - missing tenantId', {
      userId: user.id,
      path,
      method: request.method,
    })
    return NextResponse.json(
      { 
        error: 'Sesión inválida', 
        details: 'Por favor, cierre sesión y vuelva a iniciar sesión con su empresa.',
        hint: 'Su sesión es de una versión anterior. Debe iniciar sesión nuevamente.'
      },
      { status: 401 }
    )
  }
  
  // Get user roles and permissions
  const userRoles = await db.userRole.findMany({
    where: { userId: user.id },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  const userPermissions = new Set<string>()
  userRoles.forEach(userRole => {
    userRole.role.rolePermissions.forEach(rp => {
      userPermissions.add(rp.permission.name)
    })
  })

  // Check if user has at least one of the required permissions
  const hasPermission = permissions.some(perm => userPermissions.has(perm))

  if (!hasPermission) {
    const duration = Date.now() - startTime
    logger.warn('Permission denied', {
      userId: user.id,
      requiredPermissions: permissions,
      userPermissions: Array.from(userPermissions),
      path,
      method: request.method,
    })
    logger.apiResponse(request.method, path, 403, duration)
    return NextResponse.json(
      { error: 'Forbidden - Insufficient permissions' },
      { status: 403 }
    )
  }

  const duration = Date.now() - startTime
  logger.apiResponse(request.method, path, 200, duration, {
    userId: user.id,
  })

  return session
}
