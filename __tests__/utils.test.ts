/**
 * Basic utility function tests
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatDateTime } from '../lib/utils'

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00')
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-1000)).toBe('-$1,000.00')
    })

    it('should handle decimal places', () => {
      expect(formatCurrency(100.5)).toBe('$100.50')
      expect(formatCurrency(99.99)).toBe('$99.99')
    })
  })

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date)).toBe('15/01/2024')
    })

    it('should handle different dates', () => {
      const date = new Date('2024-12-25')
      expect(formatDate(date)).toBe('25/12/2024')
    })
  })

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const date = new Date('2024-01-15T14:30:00')
      const formatted = formatDateTime(date)
      expect(formatted).toContain('15/01/2024')
      expect(formatted).toContain('14:30')
    })
  })
})

