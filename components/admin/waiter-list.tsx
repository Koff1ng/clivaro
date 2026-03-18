'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Search, Plus, Edit, Trash2, Loader2, Key } from 'lucide-react'

async function fetchWaiters() {
  const res = await fetch('/api/admin/waiters')
  if (!res.ok) throw new Error('Failed to fetch waiters')
  return res.json()
}

export function WaiterList() {
  const { toast } = useToast()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedWaiter, setSelectedWaiter] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['waiters'],
    queryFn: fetchWaiters,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/waiters/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete waiter')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] })
      toast('Mesero desactivado correctamente', 'success')
    },
  })

  const waiters = data?.waiters || []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-700">Gestión de Meseros</h3>
        <Button size="sm" onClick={() => {
          setSelectedWaiter(null)
          setIsFormOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Mesero
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span>Cargando meseros...</span>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waiters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    No hay meseros registrados
                  </TableCell>
                </TableRow>
              ) : (
                waiters.map((waiter: any) => (
                  <TableRow key={waiter.id}>
                    <TableCell className="font-medium">{waiter.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <Key className="h-3 w-3 text-gray-400" />
                        {waiter.code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${waiter.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {waiter.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setSelectedWaiter(waiter)
                          setIsFormOpen(true)
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => {
                          if (confirm('¿Desactivar mesero?')) deleteMutation.mutate(waiter.id)
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedWaiter ? 'Editar Mesero' : 'Nuevo Mesero'}</DialogTitle>
          </DialogHeader>
          <WaiterForm 
            waiter={selectedWaiter} 
            onSuccess={() => {
              setIsFormOpen(false)
              queryClient.invalidateQueries({ queryKey: ['waiters'] })
            }} 
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WaiterForm({ waiter, onSuccess }: { waiter?: any, onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: waiter?.name || '',
    code: waiter?.code || '',
    pin: '',
    active: waiter?.active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const url = waiter ? `/api/admin/waiters/${waiter.id}` : '/api/admin/waiters'
      const method = waiter ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar')
      }
      toast('Mesero guardado correctamente', 'success')
      onSuccess()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre Completo</label>
        <Input 
          required 
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
          placeholder="Ej: Juan Perez"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Código Empleado</label>
          <Input 
            required 
            value={formData.code} 
            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
            placeholder="M001"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">PIN (6 dígitos)</label>
          <Input 
            required={!waiter}
            type="password"
            maxLength={6}
            value={formData.pin} 
            onChange={e => setFormData({...formData, pin: e.target.value})} 
            placeholder="******"
          />
        </div>
      </div>
      {waiter && (
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={formData.active} 
            onChange={e => setFormData({...formData, active: e.target.checked})} 
          />
          <label className="text-sm">Perfil activo</label>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar Mesero'}
      </Button>
    </form>
  )
}
