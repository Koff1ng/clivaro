import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { OrderList } from '@/components/sales/order-list'
import { ShoppingBag } from 'lucide-react'

export default function SalesOrdersPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Órdenes de Venta"
                    description="Gestiona pedidos y cotizaciones antes de facturar."
                    icon={<ShoppingBag className="h-5 w-5" />}
                />

                <OrderList />
            </div>
        </MainLayout>
    )
}
