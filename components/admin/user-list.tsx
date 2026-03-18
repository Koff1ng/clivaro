'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserForm } from './user-form'
import { UserDetails } from './user-details'
import { WaiterList } from './waiter-list'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Search, Plus, Edit, Trash2, Eye, Mail, User as UserIcon, Shield, Loader2, Utensils } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

async function fetchUsers(search: string, includeInactive: boolean) {
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  if (includeInactive) params.append('includeInactive', 'true')

  const res = await fetch(`/api/admin/users?${params}`)
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

export function UserList() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [viewUser, setViewUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('users')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, includeInactive],
    queryFn: () => fetchUsers(search, includeInactive),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleEdit = (user: any) => {
    setSelectedUser(user)
    setIsFormOpen(true)
  }

  const handleDelete = async (user: any) => {
    if (confirm(`¿Estás seguro de desactivar a ${user.name}?`)) {
      try {
        await deleteMutation.mutateAsync(user.id)
      } catch (error: any) {
        toast(error.message || 'Error al desactivar usuario', 'error')
      }
    }
  }

  const handleView = async (user: any) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`)
      if (!res.ok) throw new Error('Failed to fetch user details')
      const data = await res.json()
      setViewUser(data)
    } catch (error: any) {
      toast(error.message || 'Error al cargar detalles del usuario', 'error')
    }
  }

  const { users = [] } = useMemo(() => {
    return data || { users: [] }
  }, [data])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <UserIcon className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="waiters" className="gap-2">
            <Utensils className="h-4 w-4" />
            Meseros (Restaurante)
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="users" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, usuario o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded accent-primary"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Incluir inactivos</span>
            </label>
            <div className="flex gap-2 shrink-0">
              <Link href="/admin/roles">
                <Button variant="outline" size="sm" className="h-9">
                  <Shield className="h-4 w-4 mr-2 text-primary" />
                  Roles
                </Button>
              </Link>
              <Button size="sm" onClick={() => {
                setSelectedUser(null)
                setIsFormOpen(true)
              }} className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </div>
          </div>
        </div>

        {isLoading && users.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">Cargando usuarios...</span>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          {user.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-700">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {user.email || <span className="text-gray-400 text-sm">Sin email</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.userRoles?.map((ur: any) => (
                            <span
                              key={ur.role.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-800"
                            >
                              <Shield className="h-3 w-3" />
                              {ur.role.name}
                            </span>
                          ))}
                          {(!user.userRoles || user.userRoles.length === 0) && (
                            <span className="text-xs text-gray-400">Sin roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs rounded ${user.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(user)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            title="Desactivar"
                            className="text-red-600 hover:text-red-700"
                          >
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
      </TabsContent>

      <TabsContent value="waiters">
        <WaiterList />
      </TabsContent>

      {/* Form Dialogs and Detail Dialogs remain outside */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>
          <UserForm
            user={selectedUser}
            onSuccess={() => {
              setIsFormOpen(false)
              setSelectedUser(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Usuario</DialogTitle>
          </DialogHeader>
          {viewUser && <UserDetails user={viewUser.user} />}
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}

