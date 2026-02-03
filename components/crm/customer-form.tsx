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

const customerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
  isCompany: z.boolean().default(false),
  taxRegime: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.isCompany) {
    if (!data.taxId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIT es obligatorio para empresas", path: ['taxId'] })
    if (!data.email) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email es obligatorio para empresas", path: ['email'] })
    if (!data.address) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dirección es obligatoria para empresas", path: ['address'] })
    if (!data.phone) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Teléfono es obligatorio para empresas", path: ['phone'] })
  }
})

type CustomerFormData = z.infer<typeof customerSchema>

export function CustomerForm({ customer, onSuccess }: { customer: any; onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      tags: '',
      notes: '',
      active: true,
      isCompany: false,
      taxRegime: 'SIMPLIFIED' // Default 'No Responsable de IVA'
    },
  })

  // Watch isCompany to toggle UI
  const isCompany = watch('isCompany')

  useEffect(() => {
    if (customer) {
      setValue('name', customer.name || '')
      setValue('phone', customer.phone || '')
      setValue('email', customer.email || '')
      setValue('address', customer.address || '')
      setValue('taxId', customer.taxId || '')
      setValue('tags', customer.tags ? (Array.isArray(customer.tags) ? customer.tags.join(', ') : customer.tags) : '')
      setValue('notes', customer.notes || '')
      setValue('active', customer.active !== false)
      setValue('isCompany', customer.isCompany || false)
      setValue('taxRegime', customer.taxRegime || 'SIMPLIFIED')
    }
  }, [customer, setValue])

  const mutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const url = customer ? `/api/customers/${customer.id}` : '/api/customers'
      const method = customer ? 'PUT' : 'POST'

      const tagsArray = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          tags: tagsArray,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar cliente')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: CustomerFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
      toast('Cliente guardado correctamente')
      onSuccess()
    } catch (error: any) {
      toast(error.message || 'Error al guardar cliente', 'destructive')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center justify-between p-2 border rounded-md bg-muted/20">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isCompany"
            {...register('isCompany')}
            className="h-4 w-4"
          />
          <Label htmlFor="isCompany" className="cursor-pointer font-medium">
            Es Persona Jurídica / Empresa
          </Label>
        </div>
        <span className="text-xs text-muted-foreground">
          {isCompany ? 'Requiere todos los datos legales' : 'Datos simplificados'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre / Razón Social *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder={isCompany ? "Razón Social SAS" : "Nombre del cliente"}
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="taxId">NIT / Documento {isCompany && '*'}</Label>
          <Input
            id="taxId"
            {...register('taxId')}
            placeholder="123456789"
          />
          {errors.taxId && (
            <p className="text-sm text-red-500">{errors.taxId.message}</p>
          )}
        </div>
      </div>

      {/* Régimen Switch or Select */}
      <div>
        <Label htmlFor="taxRegime">Tipo de Régimen</Label>
        <select
          id="taxRegime"
          {...register('taxRegime')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="SIMPLIFIED">Responsable de IVA (Común) / Simplificado</option>
          <option value="COMMON">Responsable de IVA (Jurídica)</option>
          <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email {isCompany && '*'}</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="facturacion@empresa.com"
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Teléfono {isCompany && '*'}</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="300 123 4567"
          />
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="address">Dirección {isCompany && '*'}</Label>
        <Input
          id="address"
          {...register('address')}
          placeholder="Calle 123 # 45-67"
        />
        {errors.address && (
          <p className="text-sm text-red-500">{errors.address.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="tags">Etiquetas</Label>
        <Input
          id="tags"
          {...register('tags')}
          placeholder="Separadas por comas (ej: VIP, Mayorista)"
        />
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          {...register('notes')}
          rows={3}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Notas adicionales..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          {...register('active')}
          className="h-4 w-4"
        />
        <Label htmlFor="active" className="cursor-pointer">
          Cliente activo
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : customer ? 'Actualizar' : 'Guardar Cliente'}
        </Button>
      </div>
    </form>
  )
}

