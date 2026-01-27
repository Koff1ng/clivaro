import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { CustomerDetails } from '@/components/crm/customer-details'
import { PageHeader } from '@/components/ui/page-header'
import { Users, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface CustomerPageProps {
    params: {
        id: string
    }
}

export default async function CustomerPage({ params }: CustomerPageProps) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    const prisma = await getPrismaForRequest(undefined, session)

    // Fetch customer with relations
    const customer = await prisma.customer.findUnique({
        where: { id: params.id },
    })

    if (!customer) {
        notFound()
    }

    // Fetch related data
    // Invoices (Sales History)
    const invoices = await prisma.invoice.findMany({
        where: { customerId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    // Quotations
    const quotations = await prisma.quotation.findMany({
        where: { customerId: params.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    // Calculate statistics
    const totalSales = invoices
        .filter((inv: any) => ['PAID', 'PAGADA', 'ISSUED', 'EMITIDA'].includes(inv.status))
        .reduce((sum: number, inv: any) => sum + Number(inv.total), 0)

    const totalInvoices = invoices.reduce((sum: number, inv: any) => sum + Number(inv.total), 0)

    const customerData = {
        customer,
        statistics: {
            totalSales,
            totalInvoices,
            invoicesCount: invoices.length,
            quotationsCount: quotations.length,
            ordersCount: 0, // Sales Orders not used
        },
        recentInvoices: invoices,
        recentQuotations: quotations,
        recentOrders: [], // Skipped
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title={`Cliente: ${customer.name}`}
                    breadcrumbs={[
                        { label: 'Clientes', href: '/crm/customers' },
                        { label: customer.name }
                    ]}
                    description="Detalle del cliente, historial de ventas y cotizaciones."
                    icon={<Users className="h-5 w-5" />}
                />

                <CustomerDetails customerData={customerData} />
            </div>
        </MainLayout>
    )
}
