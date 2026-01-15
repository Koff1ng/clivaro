'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'

const createUserSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(50, 'El nombre de usuario no puede exceder 50 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'El nombre es requerido'),
  active: z.boolean().default(true),
  roleIds: z.array(z.string()).min(1, 'Debe asignar al menos un rol'),
})

const updateUserSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(50, 'El nombre de usuario no puede exceder 50 caracteres').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string()).min(1, 'Debe asignar al menos un rol').optional(),
})

type UserFormData = z.infer<typeof createUserSchema> | z.infer<typeof updateUserSchema>

async function fetchRoles() {
  const res = await fetch('/api/admin/roles')
  if (!res.ok) throw new Error('Failed to fetch roles')
  const data = await res.json()
  return data.roles || []
}

export function UserForm({ user, onSuccess }: { user?: any; onSuccess: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  })

  const userSchema = user ? updateUserSchema : createUserSchema
  
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<UserFormData>({
    resolver: zodResolver(userSchema as any),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      name: '',
      active: true,
      roleIds: [],
    },
  })

  const watchedRoleIds = watch('roleIds')
  const watchedActive = watch('active')

  useEffect(() => {
    if (user) {
      setValue('username', user.username || '')
      setValue('email', user.email || '')
      setValue('name', user.name)
      setValue('active', user.active)
      setValue('roleIds', user.userRoles?.map((ur: any) => ur.role.id) || [])
      // Don't set password for existing users
    }
  }, [user, setValue])

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = user ? `/api/admin/users/${user.id}` : '/api/admin/users'
      const method = user ? 'PUT' : 'POST'
      
      // Remove password if it's empty (for updates)
      const payload: any = { ...data }
      if (user && (!payload.password || payload.password === '')) {
        delete payload.password
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al guardar usuario')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onSuccess()
    },
  })

  const onSubmit = async (data: UserFormData) => {
    setLoading(true)
    try {
      await mutation.mutateAsync(data)
    } catch (error: any) {
      toast(error.message || 'Error al guardar usuario', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleRole = (roleId: string) => {
    const current = watchedRoleIds || []
    if (current.includes(roleId)) {
      setValue('roleIds', current.filter((id) => id !== roleId))
    } else {
      setValue('roleIds', [...current, roleId])
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Nombre de Usuario *</Label>
        <Input
          id="username"
          {...register('username')}
          placeholder="nombre_usuario"
        />
        {errors.username && (
          <p className="text-sm text-red-500">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nombre Completo *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Nombre completo"
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email (Opcional)</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="usuario@ejemplo.com (opcional)"
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          Contraseña {user ? '(dejar vacío para no cambiar)' : '*'}
        </Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          placeholder={user ? '••••••••' : 'Mínimo 6 caracteres'}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Roles *</Label>
        <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
          {roles.length === 0 ? (
            <p className="text-sm text-gray-500">No hay roles disponibles</p>
          ) : (
            roles.map((role: any) => (
              <label
                key={role.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <Checkbox
                  checked={watchedRoleIds?.includes(role.id) || false}
                  onCheckedChange={() => toggleRole(role.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{role.name}</div>
                  {role.description && (
                    <div className="text-sm text-gray-500">{role.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Permisos: {role.rolePermissions?.map((rp: any) => rp.permission.name).join(', ') || 'Ninguno'}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
        {errors.roleIds && (
          <p className="text-sm text-red-500">{errors.roleIds.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="active"
          checked={watchedActive}
          onCheckedChange={(checked) => setValue('active', checked as boolean)}
        />
        <Label htmlFor="active" className="cursor-pointer">
          Usuario activo
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : user ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}

