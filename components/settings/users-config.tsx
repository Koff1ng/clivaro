'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { UserList } from '@/components/admin/user-list'

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
      <CardContent>
        <UserList />
      </CardContent>
    </Card>
  )
}

