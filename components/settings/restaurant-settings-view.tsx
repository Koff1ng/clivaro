'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { 
  UtensilsCrossed, 
  Map as MapIcon, 
  Users, 
  ChefHat, 
  Settings2, 
  Plus, 
  Loader2,
  ChevronRight,
  Monitor,
  Layout
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { ConfigSectionCard } from './ui/config-section-card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RestaurantTableMap } from '../restaurant/table-map'

export function RestaurantSettingsView() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showMapDialog, setShowMapDialog] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  const { data: tenantPlan, isLoading: isLoadingPlan } = useQuery({
    queryKey: ['tenant-plan'],
    queryFn: async () => {
      const res = await fetch('/api/tenant/plan')
      if (!res.ok) return null
      return res.json()
    },
    retry: false,
  })

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['restaurant-config'],
    queryFn: async () => {
      const res = await fetch('/api/restaurant/config')
      if (!res.ok) return null
      return res.json()
    },
    retry: false,
    refetchOnWindowFocus: false,
  })

  const { data: zones = [], isLoading: isLoadingZones } = useQuery({
    queryKey: ['restaurant-zones'],
    queryFn: async () => {
      const res = await fetch('/api/restaurant/zones')
      if (!res.ok) return []
      return res.json()
    },
    retry: false,
    refetchOnWindowFocus: false,
  })

  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/restaurant/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Error al actualizar')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] }) // Sync with general settings
      toast('Configuración de restaurante actualizada', 'success')
    }
  })

  if (isLoadingConfig || isLoadingZones || isLoadingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    )
  }

  const isEnabled = config?.enableRestaurantMode || false
  const isStarterPlan = tenantPlan?.plan?.name?.toUpperCase() === 'STARTER' || tenantPlan?.plan?.name?.toUpperCase() === 'FREE'
  
  const handleToggleRestaurant = (val: boolean) => {
    if (val && isStarterPlan) {
      setShowUpgradeDialog(true)
      return
    }
    updateConfigMutation.mutate({ enableRestaurantMode: val })
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl shadow-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-white/10 rounded-2xl shadow-inner">
              <UtensilsCrossed size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter">Módulo de Restaurante</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">ESTADO DE OPERACIÓN GASTRONÓMICA</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-full border border-white/10">
             <Switch 
               className="data-[state=checked]:bg-emerald-500"
               checked={isEnabled} 
               onCheckedChange={handleToggleRestaurant} 
             />
             <span className="text-xs font-black uppercase tracking-widest">{isEnabled ? 'Activo' : 'Desactivado'}</span>
          </div>
        </div>
      </div>

      {!isEnabled ? (
        <Card className="border-dashed border-2 rounded-[2.5rem] p-12 text-center bg-white/50">
           <div className="max-w-md mx-auto space-y-6">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                 <UtensilsCrossed size={32} />
              </div>
              <div className="space-y-2">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">Activa el Modo Restaurante</h3>
                 <p className="text-sm text-slate-500 leading-relaxed font-medium">Habilita comandas, gestión de mesas, zonas, meseros y estaciones de cocina para llevar tu negocio al siguiente nivel.</p>
              </div>
              <Button 
                onClick={() => handleToggleRestaurant(true)}
                className="rounded-full px-8 h-12 font-black uppercase tracking-widest text-xs"
              >
                Habilitar Ahora
              </Button>
           </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Zonas y Mesas */}
          <ConfigSectionCard 
            title="Zonas y Salones" 
            description="GESTIÓN FÍSICA DEL RESTAURANTE"
            icon={<MapIcon size={20} />}
            className="rounded-[2.5rem] col-span-2 md:col-span-1"
          >
             <div className="space-y-4">
               {zones.map((zone: any) => (
                 <div key={zone.id} className="p-5 border rounded-2xl bg-slate-50 flex items-center justify-between group hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm font-black text-slate-400">
                          {zone.name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <div className="font-bold text-sm text-slate-800">{zone.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">{zone._count?.tables || 0} Mesas registradas</div>
                       </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="rounded-xl h-9 px-4 font-bold text-[10px] uppercase gap-2"
                      onClick={() => {
                        setSelectedZoneId(zone.id)
                        setShowMapDialog(true)
                      }}
                    >
                       <Layout size={14} />
                       Ver Mapa
                    </Button>
                 </div>
               ))}
               <Button variant="outline" className="w-full rounded-2xl border-dashed h-12 font-black text-xs text-slate-400">
                  <Plus size={16} className="mr-2" />
                  Añadir Nueva Zona
               </Button>
             </div>
          </ConfigSectionCard>

          {/* Meseros y Staff */}
          <ConfigSectionCard 
            title="Personal y Meseros" 
            description="CÓDIGOS DE ACCESO Y TURNOS"
            icon={<Users size={20} />}
            className="rounded-[2.5rem]"
          >
             <div className="space-y-4">
                <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                   <p className="text-[11px] font-bold text-indigo-700 leading-relaxed uppercase tracking-tighter">
                      Gestiona quién puede tomar comandas y sus códigos PIN de 4 dígitos para acceso rápido al comandero.
                   </p>
                   <Button className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold h-10 text-xs">
                      Ir a Gestión de Usuarios
                   </Button>
                </div>
             </div>
          </ConfigSectionCard>

          {/* Configuración de Pantallas de Cocina (KDS) */}
          <ConfigSectionCard 
            title="Monitor de Cocina (KDS)" 
            description="VELOCIDAD DE DESPACHO"
            icon={<ChefHat size={20} />}
            className="rounded-[2.5rem]"
          >
             <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-2xl bg-emerald-50/50 border-emerald-100">
                   <div className="flex items-center gap-3">
                      <Monitor size={18} className="text-emerald-600" />
                      <span className="text-sm font-bold text-slate-700">Auto-Refrescar Pantalla</span>
                   </div>
                   <Switch defaultChecked />
                </div>
                <div className="p-4 border rounded-2xl bg-slate-50 text-center">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Tiempo de Alerta Amarilla: 5m</p>
                </div>
             </div>
          </ConfigSectionCard>
        </div>
      )}

      {/* Map Dialog */}
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
          <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
             <div className="h-20 border-b bg-slate-900 text-white flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-white/10 rounded-xl"><Layout size={20} /></div>
                   <h3 className="text-lg font-black tracking-tight">Diseñador de Salón - {zones.find(z => z.id === selectedZoneId)?.name}</h3>
                </div>
                <Button variant="ghost" className="text-white/60 hover:text-white" onClick={() => setShowMapDialog(false)}>Cerrar</Button>
             </div>
             <div className="flex-1 overflow-hidden p-8 bg-slate-100">
                {selectedZoneId && <RestaurantTableMap zoneId={selectedZoneId} isEditMode={true} />}
              </div>
           </DialogContent>
       </Dialog>

       {/* Upgrade Plan Dialog */}
       <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden text-center max-w-md">
             <div className="p-8 bg-gradient-to-b from-indigo-50 to-white">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                   <UtensilsCrossed size={32} />
                </div>
                <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight mb-2">Sube de nivel tu negocio</DialogTitle>
                <div className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
                   El Modo Restaurante es una función avanzada exclusiva para planes <strong className="text-slate-800">Business</strong> y superiores. Obtendrás gestión de mesas, comanderas móviles y monitor KDS para cocina.
                </div>
                <div className="space-y-3">
                   <Button className="w-full rounded-full h-12 bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest text-xs" onClick={() => {
                     setShowUpgradeDialog(false)
                     window.location.href = '/settings/billing' // Navigate to billing/subscription page
                   }}>
                      Mejorar a Business
                   </Button>
                   <Button variant="ghost" className="w-full rounded-full h-10 font-bold text-xs uppercase" onClick={() => setShowUpgradeDialog(false)}>
                      Quizás más tarde
                   </Button>
                </div>
             </div>
          </DialogContent>
       </Dialog>
     </div>
   )
 }
