export function parseDateOnlyToDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  // Anchor to local noon to avoid timezone/DST shifts
  return new Date(y, mo, day, 12, 0, 0, 0)
}


