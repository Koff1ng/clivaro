'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, UserPlus } from 'lucide-react'
import Link from 'next/link'

export function UsersConfig() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Gestión de Usuarios
        </CardTitle>
        <CardDescription>
          Administra los usuarios de tu empresa, roles y permisos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Desde aquí puedes gestionar todos los usuarios de tu empresa, asignar roles,
            permisos y controlar el acceso a las diferentes funcionalidades del sistema.
          </p>
        </div>
        
        <div className="flex gap-4 pt-4">
          <Link href="/admin/users">
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Ver Usuarios
            </Button>
          </Link>
          <Link href="/admin/users?new=true">
            <Button variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Usuario
            </Button>
          </Link>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Funcionalidades disponibles:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Crear, editar y desactivar usuarios</li>
            <li>Asignar roles y permisos personalizados</li>
            <li>Gestionar acceso a funcionalidades por plan</li>
            <li>Ver historial de actividades de usuarios</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

