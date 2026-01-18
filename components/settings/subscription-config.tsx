'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Rocket, Calendar, CheckCircle2, Minus, ExternalLink, Loader2, X, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { PaySubscriptionButton } from '@/components/subscriptions/pay-subscription-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface SubscriptionConfigProps {
  settings: any
  onSave: (data: any) => void
  isLoading: boolean
}

async function fetchSubscription() {
  const res = await fetch('/api/tenant/plan')
  if (!res.ok) throw new Error('Failed to fetch subscription')
  return res.json()
}

async function fetchPaymentHistory() {
  const res = await fetch('/api/subscriptions/payments')
  if (!res.ok) throw new Error('Failed to fetch payment history')
  return res.json()
}

async function cancelSubscription(subscriptionId: string) {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Error al cancelar la suscripción')
  }
  return res.json()
}

export function SubscriptionConfig({ settings, onSave, isLoading }: SubscriptionConfigProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showManageDialog, setShowManageDialog] = useState(false)
  const [autoRenew, setAutoRenew] = useState(settings?.subscriptionAutoRenew ?? true)

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['tenant-plan'],
    queryFn: fetchSubscription,
  })

  const { data: paymentHistory, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['subscription-payments'],
    queryFn: fetchPaymentHistory,
  })

  const plan = subscriptionData?.plan
  const subscription = subscriptionData?.subscription
  const payments = paymentHistory?.payments || []

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] })
      setShowManageDialog(false)
      toast('Suscripción cancelada exitosamente', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'Error al cancelar la suscripción', 'error')
    },
  })

  const updateAutoRenewMutation = useMutation({
    mutationFn: async (value: boolean) => {
      onSave({ subscriptionAutoRenew: value })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
      toast('Configuración actualizada', 'success')
    },
    onError: (error: any) => {
      toast(error.message || 'Error al actualizar', 'error')
    },
  })

  // Sincronizar autoRenew con la suscripción cuando se carga
  useEffect(() => {
    if (subscription) {
      setAutoRenew(subscription.autoRenew ?? settings?.subscriptionAutoRenew ?? true)
    }
  }, [subscription, settings?.subscriptionAutoRenew])

  // Calcular fecha de renovación
  const getRenewalDate = () => {
    if (!subscription?.endDate) return null
    return new Date(subscription.endDate)
  }

  // Obtener información de la tarjeta de pago
  const getPaymentMethodInfo = () => {
    if (!subscription?.mercadoPagoPaymentMethod) return null
    
    const methodMap: Record<string, string> = {
      'credit_card': 'Tarjeta de Crédito',
      'debit_card': 'Tarjeta de Débito',
      'ticket': 'Ticket',
      'bank_transfer': 'Transferencia Bancaria',
    }
    
    return methodMap[subscription.mercadoPagoPaymentMethod] || subscription.mercadoPagoPaymentMethod
  }

  const renewalDate = getRenewalDate()
  const paymentMethod = getPaymentMethodInfo()
  const nextPaymentDate = subscription?.nextPaymentDate ? new Date(subscription.nextPaymentDate) : null

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Active</Badge>
      case 'trial':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">Trial</Badge>
      case 'expired':
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Expired</Badge>
      case 'pending_payment':
        return <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400">Pending</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    if (status === 'Paid') {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">Paid</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <Minus className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Pending</span>
      </div>
    )
  }

  if (isLoadingSubscription) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subscription Section */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Card */}
          {plan && (
            <div className="p-6 border rounded-lg bg-card">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Rocket className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(subscription?.status || 'inactive')}
                        <span className="text-sm text-muted-foreground">
                          {plan.interval === 'monthly' ? 'Renews monthly' : 'Renews yearly'}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(plan.price)} / {plan.interval === 'monthly' ? 'month' : 'year'}
                      <span className="ml-2">
                        {plan.interval === 'annual' ? 'Billed yearly' : 'Billed monthly'}
                      </span>
                    </div>
                  </div>
                </div>
                {subscription?.status !== 'active' && plan && (
                  <Button variant="outline">
                    Upgrade
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Subscription Details */}
          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renewalDate && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Renewal date</span>
                  </div>
                  <p className="text-base font-semibold">
                    {renewalDate.toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                </div>
                <div className="text-base font-semibold">
                  {getStatusBadge(subscription.status)}
                </div>
              </div>

              {nextPaymentDate && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Next payment</span>
                  </div>
                  <p className="text-base font-semibold">
                    {nextPaymentDate.toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  {paymentMethod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {paymentMethod}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manage Subscription Button */}
          {subscription?.status === 'active' && (
            <div className="flex justify-center">
              <Button 
                variant="default" 
                className="w-full sm:w-auto"
                onClick={() => setShowManageDialog(true)}
              >
                Manage subscription
              </Button>
            </div>
          )}

          {/* Payment Button for expired/pending subscriptions */}
          {subscription && (subscription.status === 'expired' || subscription.status === 'pending_payment') && plan && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                    {subscription.status === 'expired' ? 'Suscripción Expirada' : 'Pago Pendiente'}
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    Monto a pagar: <span className="font-bold">{formatCurrency(plan.price)}</span>
                  </p>
                </div>
                <PaySubscriptionButton
                  subscriptionId={subscription.id}
                  planName={plan.name}
                  amount={plan.price}
                  onPaymentCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['tenant-plan'] })
                    queryClient.invalidateQueries({ queryKey: ['subscription-payments'] })
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payments history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay pagos registrados
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 10).map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.date).toLocaleDateString('es-ES', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: payment.currency || 'COP',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(payment.amount)}
                      </TableCell>
                      <TableCell>
                        {payment.mercadoPagoPaymentId ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-primary"
                            onClick={() => {
                              // Aquí podrías abrir un modal o redirigir a la factura de Mercado Pago
                              window.open(
                                `https://www.mercadopago.com/activities/payments/${payment.mercadoPagoPaymentId}`,
                                '_blank'
                              )
                            }}
                          >
                            View invoice
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(payment.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {payments.length > 10 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="link"
                    className="text-primary"
                    onClick={() => {
                      // Aquí podrías implementar una vista completa de pagos
                      toast('Función en desarrollo', 'info')
                    }}
                  >
                    View all payments <ExternalLink className="h-4 w-4 ml-1 inline" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Manage Subscription Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Gestiona tu suscripción y configuración de renovación automática
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Current Plan Info */}
            {plan && subscription && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Current Plan</span>
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                    {plan.name}
                  </Badge>
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {plan.interval === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {renewalDate && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Renews on {renewalDate.toLocaleDateString('es-ES', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Auto Renew Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="autoRenew" className="text-base">
                  Auto-renewal
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically renew your subscription at the end of each billing period
                </p>
              </div>
              <Switch
                id="autoRenew"
                checked={autoRenew}
                onCheckedChange={(checked) => {
                  setAutoRenew(checked)
                  updateAutoRenewMutation.mutate(checked)
                }}
                disabled={updateAutoRenewMutation.isPending}
              />
            </div>

            {/* Payment Method Info */}
            {paymentMethod && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Payment Method</span>
                  <span className="text-sm font-medium">{paymentMethod}</span>
                </div>
              </div>
            )}

            {/* Cancel Subscription Warning */}
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                    Cancel Subscription
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                    Al cancelar tu suscripción, perderás acceso a todas las funciones premium al finalizar el período actual.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('¿Estás seguro de que deseas cancelar tu suscripción? Esta acción no se puede deshacer.')) {
                        cancelMutation.mutate(subscription.id)
                      }
                    }}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancel Subscription
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
