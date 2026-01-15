import { PricingClient } from '@/components/pricing/pricing-client'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Precios y Planes - Clivaro',
  description: 'Planes de suscripción para tu negocio. Más económico y adaptable que otras soluciones del mercado.',
}

export default function PricingPage() {
  return <PricingClient />
}

