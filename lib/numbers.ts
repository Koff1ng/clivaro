// Helper functions for number handling (SQLite uses Float, not Decimal)

export function toDecimal(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  return typeof value === 'string' ? parseFloat(value) : value
}

export function fromDecimal(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  return typeof value === 'number' ? value : parseFloat(String(value))
}
