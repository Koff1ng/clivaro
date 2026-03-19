import { prisma as masterPrisma } from './db'
import { withTenantRead, withTenantTx } from './tenancy'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

/**
 * Ensures that restaurant mode is enabled for the current tenant.
 * To be used in API routes.
 */
export async function ensureRestaurantMode(tenantId: string) {
    const settings = await masterPrisma.tenantSettings.findUnique({
        where: { tenantId }
    })

    if (!settings?.enableRestaurantMode) {
        return NextResponse.json(
            { error: 'El modo restaurante no está habilitado para esta cuenta.' },
            { status: 403 }
        )
    }
    return null
}

/**
 * Gets or initializes the restaurant configuration for a tenant.
 */
export async function getRestaurantConfig(tenantId: string) {
    return await withTenantTx(tenantId, async (tx) => {
        let config = await tx.restaurantConfig.findUnique({
            where: { tenantId }
        })

        if (!config) {
            config = await tx.restaurantConfig.create({
                data: {
                    tenantId,
                    isActive: true,
                }
            })
        }

        return config
    })
}

/**
 * Validates Alegra credentials for restaurant integration.
 */
export async function updateRestaurantConfig(tenantId: string, data: {
    isActive?: boolean,
    alegraBusinessId?: string,
    alegraEmail?: string,
    alegraToken?: string,
    alegraEnabled?: boolean
}) {
    return await withTenantTx(tenantId, async (tx) => {
        return await tx.restaurantConfig.upsert({
            where: { tenantId },
            create: {
                tenantId,
                ...data
            },
            update: data
        })
    })
}

/**
 * Hashes a PIN using SHA-256 for simple but secure storage.
 */
export function hashPin(pin: string): string {
    return crypto.createHash('sha256').update(pin).digest('hex')
}

/**
 * Verifies a PIN against a hash.
 */
export function verifyPin(pin: string, hash: string): boolean {
    return hashPin(pin) === hash
}

/**
 * Generates a JWT token for a waiter session.
 */
export function generateWaiterToken(waiter: { id: string, name: string, code: string, tenantId: string }) {
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) throw new Error('NEXTAUTH_SECRET is not defined')

    return jwt.sign(
        {
            sub: waiter.id,
            name: waiter.name,
            code: waiter.code,
            tenantId: waiter.tenantId,
            type: 'waiter_session',
            role: 'WAITER',
            iat: Math.floor(Date.now() / 1000),
        },
        secret,
        { expiresIn: '12h' } // Waiter sessions typically last a shift
    )
}
/**
 * Verifies a waiter token and returns the waiter profile
 */
export async function getWaiterFromToken(token: string, tenantId: string) {
    try {
        const secret = process.env.NEXTAUTH_SECRET
        if (!secret) return null

        const decoded = jwt.verify(token, secret) as any
        if (!decoded || decoded.tenantId !== tenantId) return null

        return await withTenantRead(tenantId, async (prisma) => {
            return await prisma.waiterProfile.findUnique({
                where: { id: decoded.sub, active: true }
            })
        })
    } catch (error) {
        console.error('Error verifying waiter token:', error)
        return null
    }
}
