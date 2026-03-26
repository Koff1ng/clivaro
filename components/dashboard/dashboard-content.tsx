'use client'

import { Suspense, useState } from 'react'
import { DashboardStats } from '@/components/dashboard/stats'
import { Last30DaysChart } from '@/components/dashboard/last-30-days-chart'
import { TopClients } from '@/components/dashboard/top-clients'
import { LowStockDashboard } from '@/components/dashboard/low-stock-dashboard'
import { RecentProducts } from '@/components/dashboard/recent-products'
import { ProductCategories } from '@/components/dashboard/product-categories'
import { InventoryValueReport } from '@/components/dashboard/inventory-value-report'
import type { Period } from '@/components/dashboard/use-dashboard-period'

export function DashboardContent() {
  const [period, setPeriod] = useState<Period>('month')

  return (
    <>
      {/* Stats cards with period selector */}
      <DashboardStats period={period} onPeriodChange={setPeriod} />

      {/* Chart — responds to the same period */}
      <Last30DaysChart period={period} />

      {/* Inventory & Categories */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <InventoryValueReport />
        <ProductCategories />
      </div>

      {/* Top Clients, Low Stock, Recent Products */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <TopClients />
        </Suspense>
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <LowStockDashboard />
        </Suspense>
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <RecentProducts />
        </Suspense>
      </div>
    </>
  )
}
