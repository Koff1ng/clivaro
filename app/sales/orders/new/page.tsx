'use client'

import { OrderForm } from '@/components/sales/order-form'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { FilePlus } from 'lucide-react'

export default function NewSalesOrderPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Nueva Orden de Venta"
                    description="Crea una orden o cotización formal para un cliente."
                    icon={<FilePlus className="h-5 w-5" />}
                />

                <OrderForm />
            </div>
        </MainLayout>
    )
}
