'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  Settings2, 
  Save, 
  Plus, 
  Trash2, 
  Move,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-toastify'
import { cn } from '@/lib/utils'

interface Table {
  id: string
  name: string
  capacity: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY'
  x: number
  y: number
  zoneId: string
}

interface RestaurantTableMapProps {
  zoneId: string
  isEditMode?: boolean
  onTableClick?: (table: Table) => void
}

export function RestaurantTableMap({ zoneId, isEditMode = false, onTableClick }: RestaurantTableMapProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch tables
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch(`/api/restaurant/tables?zoneId=${zoneId}`)
      if (!res.ok) throw new Error('Error al cargar mesas')
      const data = await res.json()
      setTables(data)
    } catch (error) {
      toast.error('No se pudieron cargar las mesas')
    } finally {
      setLoading(false)
    }
  }, [zoneId])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  // SSE Setup
  useEffect(() => {
    const eventSource = new EventSource('/api/restaurant/tables/status')

    eventSource.addEventListener('table_updated', (event: any) => {
      const updatedData = JSON.parse(event.data)
      setTables(prev => {
        if (updatedData.isDeleted) {
          return prev.filter(t => t.id !== updatedData.id)
        }
        const index = prev.findIndex(t => t.id === updatedData.id)
        if (index === -1) {
          // If not in current zone, ignore or fetch if needed
          return prev
        }
        const newTables = [...prev]
        newTables[index] = { ...newTables[index], ...updatedData }
        return newTables
      })
    })

    return () => eventSource.close()
  }, [zoneId])

  const handleDragEnd = async (tableId: string, info: any) => {
    if (!isEditMode) return

    const table = tables.find(t => t.id === tableId)
    if (!table) return

    // Calculate new position relative to container
    // This is a simplified version, ideally we check container bounds
    const newX = table.x + info.offset.x
    const newY = table.y + info.offset.y

    try {
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, x: newX, y: newY } : t))
      
      const res = await fetch(`/api/restaurant/tables/${tableId}`, {
        method: 'PATCH',
        body: JSON.stringify({ x: Math.round(newX), y: Math.round(newY) })
      })
      if (!res.ok) throw new Error()
    } catch (error) {
      toast.error('Error al guardar posición')
      fetchTables() // Revert
    }
  }

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'OCCUPIED': return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'RESERVED': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'DIRTY': return 'bg-slate-50 text-slate-700 border-slate-200'
      default: return 'bg-white text-slate-700 border-slate-200'
    }
  }

  const getStatusDot = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-500'
      case 'OCCUPIED': return 'bg-rose-500'
      case 'RESERVED': return 'bg-amber-500'
      case 'DIRTY': return 'bg-slate-400'
      default: return 'bg-slate-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[600px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
      {/* Map Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', 
        backgroundSize: '24px 24px' 
      }} />

      {/* Tables Container */}
      <div className="relative w-full h-full p-8">
        <AnimatePresence>
          {tables.map((table) => (
            <motion.div
              key={table.id}
              drag={isEditMode}
              dragMomentum={false}
              onDragEnd={(_, info) => handleDragEnd(table.id, info)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: table.x,
                y: table.y,
              }}
              whileHover={{ scale: isEditMode ? 1.02 : 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="absolute cursor-pointer"
              onClick={() => !isEditMode && onTableClick?.(table)}
            >
              <Card className={cn(
                "w-32 h-32 flex flex-col items-center justify-center p-3 gap-2 transition-colors shadow-lg border-2",
                getStatusColor(table.status),
                isEditMode && "ring-2 ring-indigo-500 ring-offset-2"
              )}>
                <div className="flex flex-col items-center text-center">
                    <span className="text-lg font-bold tracking-tight">{table.name}</span>
                    <div className="flex items-center gap-1 text-[10px] opacity-70 mt-1">
                        <Users size={12} />
                        <span>Cap. {table.capacity}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 mt-auto">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", getStatusDot(table.status))} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        {table.status === 'AVAILABLE' ? 'Libre' : 
                         table.status === 'OCCUPIED' ? 'Ocupada' : 
                         table.status === 'RESERVED' ? 'Reserv.' : 'Sucia'}
                    </span>
                </div>

                {isEditMode && (
                    <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-1 rounded-full shadow-md">
                        <Move size={12} />
                    </div>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {tables.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Info size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">No hay mesas en esta zona</p>
            {isEditMode && <p className="text-sm">¡Añade tu primera mesa para comenzar!</p>}
          </div>
        )}
      </div>

      {/* Floating Instructions for Edit Mode */}
      {isEditMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-indigo-100 px-4 py-2 rounded-full shadow-xl flex items-center gap-3 animate-bounce">
            <Settings2 size={16} className="text-indigo-600" />
            <span className="text-xs font-semibold text-slate-700">Modo Edición: Arrastra las mesas para organizar el salón</span>
        </div>
      )}
    </div>
  )
}
