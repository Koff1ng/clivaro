'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'

interface AddRecipientsDialogProps {
  campaignId: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddRecipientsDialog({
  campaignId,
  onClose,
  onSuccess,
}: AddRecipientsDialogProps) {
  const { toast } = useToast()
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [manualEmails, setManualEmails] = useState<string[]>([''])
  const queryClient = useQueryClient()

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('/api/customers?active=true')
      if (!res.ok) throw new Error('Failed to fetch customers')
      const data = await res.json()
      return data.customers?.filter((c: any) => c.email) || []
    },
  })

  const addMutation = useMutation({
    mutationFn: async (data: { customerIds?: string[]; emails?: string[] }) => {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add recipients')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaign', campaignId] })
      toast(`${data.added} destinatarios agregados`, 'success')
      onSuccess()
    },
    onError: (error: any) => {
      toast(`Error: ${error.message}`, 'error')
    },
  })

  const handleAddManualEmail = () => {
    setManualEmails([...manualEmails, ''])
  }

  const handleRemoveManualEmail = (index: number) => {
    setManualEmails(manualEmails.filter((_, i) => i !== index))
  }

  const handleManualEmailChange = (index: number, value: string) => {
    const newEmails = [...manualEmails]
    newEmails[index] = value
    setManualEmails(newEmails)
  }

  const handleSubmit = () => {
    const customerIds = selectedCustomers.length > 0 ? selectedCustomers : undefined
    const emails = manualEmails.filter(e => e.trim() && e.includes('@'))
    const validEmails = emails.length > 0 ? emails : undefined

    if (!customerIds && !validEmails) {
      toast('Selecciona al menos un cliente o agrega un email manual', 'warning')
      return
    }

    addMutation.mutate({
      customerIds,
      emails: validEmails,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Agregar Destinatarios</CardTitle>
              <CardDescription>
                Selecciona clientes o agrega emails manualmente
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Clientes con Email</Label>
              {customers && customers.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedCustomers.length === customers.length) {
                      // Deseleccionar todos
                      setSelectedCustomers([])
                    } else {
                      // Seleccionar todos
                      setSelectedCustomers(customers.map((c: any) => c.id))
                    }
                  }}
                >
                  {selectedCustomers.length === customers.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </Button>
              )}
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto p-2">
              {customers?.length === 0 ? (
                <p className="text-sm text-gray-500 p-4">No hay clientes con email</p>
              ) : (
                customers?.map((customer: any) => (
                  <div key={customer.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCustomers([...selectedCustomers, customer.id])
                        } else {
                          setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedCustomers.length} cliente(s) seleccionado(s) de {customers?.length || 0} total
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Emails Manuales</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddManualEmail}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Email
              </Button>
            </div>
            <div className="space-y-2">
              {manualEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={email}
                    onChange={(e) => handleManualEmailChange(index, e.target.value)}
                  />
                  {manualEmails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveManualEmail(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? 'Agregando...' : 'Agregar Destinatarios'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

