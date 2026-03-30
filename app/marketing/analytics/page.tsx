import { Metadata } from 'next'
import PipelineAnalytics from '@/components/marketing/pipeline-analytics'
import { PlanGuard } from '@/components/guards/plan-guard'

export const metadata: Metadata = {
  title: 'Análisis de Pipeline | Clivaro',
  description: 'Dashboard de análisis del pipeline de ventas',
}

export default function PipelineAnalyticsPage() {
  return (
    <PlanGuard featureKey="marketing" featureLabel="Análisis de Pipeline" requiredPlan="Business">
      <PipelineAnalytics />
    </PlanGuard>
  )
}
