import { PricingClient } from '@/components/pricing/pricing-client'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clivaro - Smart ERP & CRM para tu Negocio',
  description: 'Gestiona tu inventario, ventas y clientes con la plataforma más potente y económica del mercado. Pruébalo gratis hoy mismo.',
}

export default function RootPage() {
  return <PricingClient />
}
