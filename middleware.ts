import { NextResponse, type NextRequest } from 'next/server'

/**
 * Adds a request id to API requests for traceability across logs and clients.
 */
export function middleware(request: NextRequest) {
  // Ensure we only attach to API routes
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Also expose it to clients (useful when debugging 429/500)
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}


