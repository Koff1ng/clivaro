import { Metadata } from 'next'
import OpportunitiesBoard from '@/components/marketing/opportunities-board'
import { PlanGuard } from '@/components/guards/plan-guard'

export const metadata: Metadata = {
  title: 'Pipeline de Oportunidades | Clivaro',
  description: 'CRM - Pipeline de oportunidades de venta con análisis',
}

export default function OpportunitiesPage() {
  return (
    <PlanGuard featureKey="marketing" featureLabel="Pipeline de Oportunidades" requiredPlan="Business">
      <div className="h-[calc(100vh-64px)]">
        <OpportunitiesBoard />
      </div>
    </PlanGuard>
  )
}
