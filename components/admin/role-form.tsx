'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'
import { PERMISSION_LABELS, PERMISSIONS } from '@/lib/permissions'
import { Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const roleSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    description: z.string().optional(),
    permissionIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un permiso'),
})

type RoleFormData = z.infer<typeof roleSchema>

// List of all technical permissions to display
const ALL_PERMS = Object.entries(PERMISSION_LABELS).map(([id, label]) => ({
    id,
    label,
}))

export function RoleForm({ role, onSuccess }: { role?: any; onSuccess: () => void }) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()

    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<RoleFormData>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: '',
            description: '',
            permissionIds: [],
        },
    })

    const watchedPermissionIds = watch('permissionIds')

    useEffect(() => {
        if (role) {
            setValue('name', role.name)
            setValue('description', role.description || '')
            setValue('permissionIds', role.rolePermissions?.map((rp: any) => rp.permission.name) || [])
        }
    }, [role, setValue])

    const mutation = useMutation({
        mutationFn: async (data: RoleFormData) => {
            const url = role ? `/api/admin/roles/${role.id}` : '/api/admin/roles'
            const method = role ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al guardar el rol')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            toast(role ? 'Rol actualizado' : 'Rol creado correctamente', 'success')
            onSuccess()
        },
        onError: (error: any) => {
            toast(error.message || 'Error al guardar el rol', 'error')
        },
    })

    const onSubmit = async (data: RoleFormData) => {
        setLoading(true)
        try {
            await mutation.mutateAsync(data)
        } finally {
            setLoading(false)
        }
    }

    const togglePermission = (permId: string) => {
        const current = watchedPermissionIds || []
        if (current.includes(permId)) {
            setValue('permissionIds', current.filter((id) => id !== permId))
        } else {
            setValue('permissionIds', [...current, permId])
        }
    }

    const selectAll = () => {
        setValue('permissionIds', ALL_PERMS.map(p => p.id))
    }

    const selectNone = () => {
        setValue('permissionIds', [])
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Rol *</Label>
                    <Input
                        id="name"
                        {...register('name')}
                        placeholder="Ej: Vendedor Junior"
                        disabled={role?.name === 'ADMIN'}
                    />
                    {errors.name && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" /> {errors.name.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Input
                        id="description"
                        {...register('description')}
                        placeholder="Breve explicación de las funciones"
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Configuración de Permisos
                    </Label>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="text-[10px] h-7">
                            Marcar Todos
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={selectNone} className="text-[10px] h-7">
                            Desmarcar
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-xl p-4 bg-muted/30 max-h-[400px] overflow-y-auto shadow-inner">
                    {ALL_PERMS.map((perm) => (
                        <label
                            key={perm.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${watchedPermissionIds?.includes(perm.id)
                                ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10'
                                : 'bg-white dark:bg-zinc-950 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800'
                                }`}
                        >
                            <Checkbox
                                id={perm.id}
                                checked={watchedPermissionIds?.includes(perm.id) || false}
                                onCheckedChange={() => togglePermission(perm.id)}
                                className="mt-1"
                            />
                            <div className="space-y-1">
                                <span className="text-sm font-medium leading-none flex items-center gap-1.5">
                                    {perm.label}
                                    {watchedPermissionIds?.includes(perm.id) && (
                                        <CheckCircle2 className="h-3 w-3 text-primary animate-in zoom-in-50 duration-300" />
                                    )}
                                </span>
                                <p className="text-[10px] text-muted-foreground font-mono opacity-60">
                                    ID: {perm.id}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>
                {errors.permissionIds && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.permissionIds.message}
                    </p>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onSuccess}
                    disabled={loading}
                >
                    Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="px-8">
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        role ? 'Actualizar Rol' : 'Crear Rol'
                    )}
                </Button>
            </div>
        </form>
    )
}
