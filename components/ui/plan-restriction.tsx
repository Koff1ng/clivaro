'use client'

import { AlertCircle, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PlanRestrictionProps {
  feature: string
  requiredPlan?: string
  onUpgrade?: () => void
}

export function PlanRestriction({ feature, requiredPlan = 'Business', onUpgrade }: PlanRestrictionProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            <CardTitle>Función no disponible</CardTitle>
          </div>
          <CardDescription>
            Esta función no está disponible en tu plan actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Función:</strong> {feature}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              <strong>Plan requerido:</strong> {requiredPlan} o superior
            </p>
          </div>
          
          {onUpgrade && (
            <Button 
              onClick={onUpgrade}
              className="w-full"
              variant="default"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Actualizar Plan
            </Button>
          )}
          
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Contacta con el administrador para actualizar tu plan y acceder a esta función.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

