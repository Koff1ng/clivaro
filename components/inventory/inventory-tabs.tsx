'use client'

import { Suspense, useState } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Lazy load tab components - only load when tab is active
const StockLevels = dynamic(() => import('@/components/inventory/stock-levels').then(mod => ({ default: mod.StockLevels })), {
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
})

const MovementsList = dynamic(() => import('@/components/inventory/movements-list').then(mod => ({ default: mod.MovementsList })), {
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
})

const PhysicalInventoryList = dynamic(() => import('@/components/inventory/physical-inventory-list').then(mod => ({ default: mod.PhysicalInventoryList })), {
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
})

const ReorderSuggestions = dynamic(() => import('@/components/inventory/reorder-suggestions').then(mod => ({ default: mod.ReorderSuggestions })), {
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
})

export function InventoryTabs() {
  const [activeTab, setActiveTab] = useState('stock')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList>
        <TabsTrigger value="stock">Niveles de Stock</TabsTrigger>
        <TabsTrigger value="movements">Movimientos</TabsTrigger>
        <TabsTrigger value="reorder">Reorden</TabsTrigger>
        <TabsTrigger value="physical">Inventario Físico</TabsTrigger>
      </TabsList>
      <TabsContent value="stock" className="space-y-4">
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <StockLevels />
        </Suspense>
      </TabsContent>
      <TabsContent value="movements" className="space-y-4">
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <MovementsList />
        </Suspense>
      </TabsContent>
      <TabsContent value="reorder" className="space-y-4">
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <ReorderSuggestions />
        </Suspense>
      </TabsContent>
      <TabsContent value="physical" className="space-y-4">
        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <PhysicalInventoryList />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}

