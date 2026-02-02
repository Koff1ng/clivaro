import { NextResponse } from 'next/server'
import { logger } from './logger'
import { TenancyError } from './tenancy'

/**
 * Standard API error responder
 */
export function handleError(error: unknown, context: string = 'API') {
    const isDev = process.env.NODE_ENV === 'development'

    if (error instanceof TenancyError) {
        logger.warn(`Tenancy Error [${context}]: ${error.message}`, { code: error.code })
        return NextResponse.json(
            { error: 'Tenant error', details: error.message },
            { status: error.code }
        )
    }

    // Log everything else as error
    logger.error(`Unhandled Error [${context}]:`, error)

    const message = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json(
        {
            error: 'Internal Server Error',
            details: isDev ? message : 'Consulte con soporte técnico.'
        },
        { status: 500 }
    )
}

/**
 * Validates that the request has an authenticated session and returns it
 */
export async function validateRequest(request: Request, session: any) {
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return session
}
