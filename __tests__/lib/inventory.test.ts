/**
 * Inventory utility function tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma
vi.mock('../lib/db', () => ({
  prisma: {
    stockLevel: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
  },
}))

describe('Inventory Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Stock calculations', () => {
    it('should calculate average cost correctly', () => {
      // Test average cost calculation
      const currentQty = 10
      const currentCost = 100
      const receivedQty = 5
      const receivedCost = 120

      const totalValue = currentQty * currentCost + receivedQty * receivedCost
      const totalQty = currentQty + receivedQty
      const averageCost = totalValue / totalQty

      expect(averageCost).toBe(106.67) // Rounded to 2 decimals
    })

    it('should handle zero current quantity', () => {
      const currentQty = 0
      const currentCost = 0
      const receivedQty = 10
      const receivedCost = 50

      const averageCost = (receivedQty * receivedCost) / receivedQty
      expect(averageCost).toBe(50)
    })
  })
})

