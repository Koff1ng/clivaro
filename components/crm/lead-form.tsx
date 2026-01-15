'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { DatePicker } from '@/components/ui/date-picker'

const leadSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  company: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']),
  expectedRevenue: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

export function LeadForm({ lead, users, onSuccess }: { lead: any; users: any[]; onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      source: '',
      stage: 'NEW',
      expectedRevenue: 0,
      probability: 0,
      expectedCloseDate: null,
      assignedToId: null,
      notes: '',
    },
  })

  useEffect(() => {
    if (lead) {
      setValue('name', lead.name || '')
      setValue('company', lead.company || '')
      setValue('email', lead.email || '')
      setValue('phone', lead.phone || '')
      setValue('source', lead.source || '')
      setValue('stage', lead.stage || 'NEW')
      setValue('expectedRevenue', lead.expectedRevenue || 0)
      setValue('probability', lead.probability || 0)
      setValue('expectedCloseDate', lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().split('T')[0] : null)
      setValue('assignedToId', lead.assignedToId || null)
      setValue('notes', lead.notes || '')
    }
  }, [lead, setValue])

  const mutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const url = lead ? `/api/leads/${lead.id}` : '/api/leads'
      const method = lead ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar oportunidad')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidar todas las queries de leads (con cualquier combinación de filtros)
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      // También forzar un refetch inmediato
      queryClient.refetchQueries({ queryKey: ['leads'] })
      toast('Oportunidad guardada exitosamente', 'success')
      onSuccess()
    },
  })

  const onSubmit = async (data: LeadFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al guardar oportunidad', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre de la Oportunidad *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Ej: Cliente potencial - Empresa XYZ"
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            {...register('company')}
            placeholder="Nombre de la empresa"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="email@ejemplo.com"
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="+57 300 123 4567"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="source">Origen</Label>
          <Input
            id="source"
            {...register('source')}
            placeholder="Ej: Web, Referido, Publicidad"
          />
        </div>
        <div>
          <Label htmlFor="stage">Estado *</Label>
          <select
            id="stage"
            {...register('stage')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="NEW">Nueva</option>
            <option value="CONTACTED">Contactado</option>
            <option value="QUOTED">Cotizado</option>
            <option value="WON">Ganada</option>
            <option value="LOST">Perdida</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="expectedRevenue">Ingreso Esperado (COP)</Label>
          <Input
            id="expectedRevenue"
            type="number"
            step="0.01"
            {...register('expectedRevenue', { valueAsNumber: true })}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="probability">Probabilidad (%)</Label>
          <Input
            id="probability"
            type="number"
            min="0"
            max="100"
            {...register('probability', { valueAsNumber: true })}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="expectedCloseDate">Fecha de Cierre Esperada</Label>
        <Input
          id="expectedCloseDate"
          type="date"
          {...register('expectedCloseDate')}
        />
      </div>

      <div>
        <Label htmlFor="assignedToId">Asignado a</Label>
        <select
          id="assignedToId"
          {...register('assignedToId')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sin asignar</option>
          {users.map((user: any) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          {...register('notes')}
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Notas adicionales sobre la oportunidad..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : lead ? 'Actualizar' : 'Crear Oportunidad'}
        </Button>
      </div>
    </form>
  )
}

