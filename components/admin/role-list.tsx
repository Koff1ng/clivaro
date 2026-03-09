'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RoleForm } from './role-form'
import { useToast } from '@/components/ui/toast'
import { Plus, Edit, Trash2, Shield, Loader2, Info } from 'lucide-react'

async function fetchRoles() {
    const res = await fetch('/api/admin/roles')
    if (!res.ok) throw new Error('Failed to fetch roles')
    const data = await res.json()
    return data.roles || []
}

export function RoleList() {
    const { toast } = useToast()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<any>(null)
    const queryClient = useQueryClient()

    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: fetchRoles,
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/roles/${id}`, {
                method: 'DELETE',
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to delete role')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] })
            toast('Rol eliminado correctamente', 'success')
        },
        onError: (error: any) => {
            toast(error.message || 'Error al eliminar rol', 'error')
        },
    })

    const handleEdit = (role: any) => {
        setSelectedRole(role)
        setIsFormOpen(true)
    }

    const handleDelete = (role: any) => {
        if (confirm(`¿Estás seguro de eliminar el rol "${role.name}"?\n\nEsta acción no se puede deshacer.`)) {
            deleteMutation.mutate(role.id)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Roles Disponibles
                </h2>
                <Button onClick={() => {
                    setSelectedRole(null)
                    setIsFormOpen(true)
                }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Rol
                </Button>
            </div>

            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre del Rol</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Permisos</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {roles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    No se han definido roles personalizados
                                </TableCell>
                            </TableRow>
                        ) : (
                            roles.map((role: any) => (
                                <TableRow key={role.id}>
                                    <TableCell className="font-medium min-w-[150px]">
                                        {role.name.replace(/_/g, ' ')}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                                        {role.description || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-[10px] font-medium border border-blue-100 dark:border-blue-800">
                                                {role.rolePermissions?.length || 0} permisos
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(role)}
                                                title="Editar rol"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            {role.name !== 'ADMIN' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(role)}
                                                    title="Eliminar rol"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-4 rounded-lg flex gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                    Los roles definen qué módulos y acciones puede realizar un usuario.
                    Al modificar un rol, los cambios se aplicarán automáticamente a todos los usuarios que lo tengan asignado.
                </p>
            </div>

            {/* Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
                        </DialogTitle>
                    </DialogHeader>
                    <RoleForm
                        role={selectedRole}
                        onSuccess={() => {
                            setIsFormOpen(false)
                            setSelectedRole(null)
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
