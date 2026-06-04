import { EventEmitter } from 'events'

// In-memory bus for SSE events. 
// Key: tenantId, Value: EventEmitter
const tenantBuses: Record<string, EventEmitter> = {}

/**
 * Gets or creates an event bus for a specific tenant.
 */
export function getTenantBus(tenantId: string): EventEmitter {
    if (!tenantBuses[tenantId]) {
        tenantBuses[tenantId] = new EventEmitter()
        // Limit listeners to avoid memory leaks
        tenantBuses[tenantId].setMaxListeners(100)
    }
    return tenantBuses[tenantId]
}

/**
 * Emits an event to all connected clients of a tenant.
 */
export function emitTenantEvent(tenantId: string, event: string, data: any) {
    const bus = getTenantBus(tenantId)
    bus.emit(event, data)
}
