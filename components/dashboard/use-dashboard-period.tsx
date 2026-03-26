'use client'

import { useState } from 'react'

export type Period = 'today' | 'week' | 'month' | 'year'

export const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
}

export const PERIOD_CHART_TITLES: Record<Period, string> = {
  today: 'Hoy',
  week: 'Últimos 7 Días',
  month: 'Últimos 30 Días',
  year: 'Último Año',
}

export function useDashboardPeriod() {
  const [period, setPeriod] = useState<Period>('month')
  return { period, setPeriod }
}
