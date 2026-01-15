'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { DatePicker } from '@/components/ui/date-picker'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

const activitySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE']),
  subject: z.string().min(1, 'El asunto es requerido'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().default(false),
})

type ActivityFormData = z.infer<typeof activitySchema>

export function ActivityForm({ leadId, customerId, onSuccess }: { leadId?: string; customerId?: string; onSuccess: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, control, formState: { errors } } = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: 'NOTE',
      subject: '',
      description: '',
      dueDate: '',
      completed: false,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          leadId: leadId || undefined,
          customerId: customerId || undefined,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear actividad')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: ActivityFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al crear actividad', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="type">Tipo *</Label>
        <select
          id="type"
          {...register('type')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="CALL">Llamada</option>
          <option value="EMAIL">Email</option>
          <option value="MEETING">Reunión</option>
          <option value="TASK">Tarea</option>
          <option value="NOTE">Nota</option>
        </select>
      </div>

      <div>
        <Label htmlFor="subject">Asunto *</Label>
        <Input
          id="subject"
          {...register('subject')}
          placeholder="Asunto de la actividad"
        />
        {errors.subject && (
          <p className="text-sm text-red-500">{errors.subject.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Descripción detallada..."
        />
      </div>

      <div>
        <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
        <Controller
          name="dueDate"
          control={control}
          render={({ field }) => (
            <DatePicker
              id="dueDate"
              value={field.value || null}
              onChange={(value) => field.onChange(value || '')}
              placeholder="Seleccionar fecha"
            />
          )}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Crear Actividad'}
        </Button>
      </div>
    </form>
  )
}

