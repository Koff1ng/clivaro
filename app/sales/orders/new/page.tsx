'use client'

import { OrderForm } from '@/components/sales/order-form'

export default function NewSalesOrderPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Venta</h1>
                <p className="text-muted-foreground">Crea una orden o cotización formal para un cliente.</p>
            </div>

            <OrderForm />
        </div>
    )
}
