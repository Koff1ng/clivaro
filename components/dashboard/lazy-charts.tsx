'use client'

import dynamic from 'next/dynamic'

const Last30DaysChartInner = dynamic(
  () => import('@/components/dashboard/last-30-days-chart').then((m) => m.Last30DaysChart),
  {
    ssr: false,
    loading: () => <div className="h-[450px] bg-gray-100 animate-pulse rounded-lg" />,
  }
)

const ProductCategoriesInner = dynamic(
  () => import('@/components/dashboard/product-categories').then((m) => m.ProductCategories),
  {
    ssr: false,
    loading: () => <div className="h-[350px] bg-gray-100 animate-pulse rounded-lg" />,
  }
)

export function Last30DaysChartLazy() {
  return <Last30DaysChartInner />
}

export function ProductCategoriesLazy() {
  return <ProductCategoriesInner />
}


