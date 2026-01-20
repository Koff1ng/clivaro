import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { DashboardStats } from '@/components/dashboard/stats'
import { TopClients } from '@/components/dashboard/top-clients'
import { LowStockDashboard } from '@/components/dashboard/low-stock-dashboard'
import { RecentProducts } from '@/components/dashboard/recent-products'
import { Last30DaysChartLazy, ProductCategoriesLazy } from '@/components/dashboard/lazy-charts'
import { PageHeader } from '@/components/ui/page-header'
import { PageHeaderBadges } from '@/components/ui/page-header-badges'
import { DashboardGreeting } from '@/components/dashboard/greeting'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const userPermissions = (session.user as any).permissions || []
  
  // Allow access to dashboard if user has view_reports OR manage_sales (for cashiers)
  if (!userPermissions.includes('view_reports') && !userPermissions.includes('manage_sales')) {
    // Otherwise redirect to first available page
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          badges={<PageHeaderBadges />}
        />
        
        {/* Saludo Personalizado */}
        <DashboardGreeting />
        
        {/* Cards de métricas - 4 columnas */}
        <Suspense fallback={<div className="grid gap-4 md:grid-cols-4"><div className="h-24 bg-gray-100 animate-pulse rounded" /><div className="h-24 bg-gray-100 animate-pulse rounded" /><div className="h-24 bg-gray-100 animate-pulse rounded" /><div className="h-24 bg-gray-100 animate-pulse rounded" /></div>}>
          <DashboardStats />
        </Suspense>

        {/* Gráfico de últimos 30 días - ancho completo */}
        <Last30DaysChartLazy />

        {/* Grid de 3 columnas: Top Clientes, Stock Bajo, Productos */}
        <div className="grid gap-6 md:grid-cols-3">
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

        {/* Gráfico de categorías de productos - ancho completo */}
        <ProductCategoriesLazy />
      </div>
    </MainLayout>
  )
}

