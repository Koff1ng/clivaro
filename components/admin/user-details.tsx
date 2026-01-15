'use client'

import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User as UserIcon, Mail, Shield, Calendar, CheckCircle, XCircle } from 'lucide-react'

export function UserDetails({ user }: { user: any }) {
  const roles = user.userRoles || []
  const allPermissions = new Set<string>()
  
  roles.forEach((ur: any) => {
    ur.role.rolePermissions?.forEach((rp: any) => {
      allPermissions.add(rp.permission.name)
    })
  })

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Información Básica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-500">Nombre</label>
            <p className="text-base">{user.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Nombre de Usuario</label>
            <p className="text-base font-mono">{user.username}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </label>
            <p className="text-base">{user.email || <span className="text-gray-400">Sin email</span>}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
              Estado
            </label>
            <div className="mt-1">
              {user.active ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Activo
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactivo
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles Asignados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <p className="text-sm text-gray-500">No tiene roles asignados</p>
          ) : (
            <div className="space-y-3">
              {roles.map((ur: any) => (
                <div key={ur.role.id} className="border rounded-lg p-3">
                  <div className="font-medium text-base">{ur.role.name}</div>
                  {ur.role.description && (
                    <p className="text-sm text-gray-600 mt-1">{ur.role.description}</p>
                  )}
                  {ur.role.rolePermissions && ur.role.rolePermissions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Permisos:</p>
                      <div className="flex flex-wrap gap-1">
                        {ur.role.rolePermissions.map((rp: any) => (
                          <Badge key={rp.permission.id} variant="outline" className="text-xs">
                            {rp.permission.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Permissions Summary */}
      {allPermissions.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Permisos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(allPermissions).map((perm) => (
                <Badge key={perm} variant="outline">
                  {perm}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <label className="text-gray-500">Creado:</label>
            <p>{formatDate(user.createdAt)}</p>
          </div>
          {user.updatedAt && (
            <div>
              <label className="text-gray-500">Actualizado:</label>
              <p>{formatDate(user.updatedAt)}</p>
            </div>
          )}
          {user.createdBy && (
            <div>
              <label className="text-gray-500">Creado por:</label>
              <p>{user.createdBy.name} ({user.createdBy.email})</p>
            </div>
          )}
          {user.updatedBy && (
            <div>
              <label className="text-gray-500">Actualizado por:</label>
              <p>{user.updatedBy.name} ({user.updatedBy.email})</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

