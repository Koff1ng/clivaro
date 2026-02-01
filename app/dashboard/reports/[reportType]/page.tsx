import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SalesByPeriodReport } from '@/components/reports/sales-by-period'
import { TopProductsReport } from '@/components/reports/top-products'
import { CurrentStockReport } from '@/components/reports/current-stock'
import { ProfitMarginsReport } from '@/components/reports/profit-margins'
import { CashFlowReport } from '@/components/reports/cash-flow'

const REPORT_COMPONENTS = {
    'sales-by-period': SalesByPeriodReport,
    'top-products': TopProductsReport,
    'current-stock': CurrentStockReport,
    'inventory-valuation': CurrentStockReport, // Reuse the same for now
    'profit-margins': ProfitMarginsReport,
    'cash-flow': CashFlowReport,
}

export default async function ReportPage({ params }: { params: { reportType: string } }) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    const userPermissions = (session.user as any).permissions || []

    if (!userPermissions.includes('view_reports')) {
        redirect('/login')
    }

    const { reportType } = params
    const ReportComponent = (REPORT_COMPONENTS as any)[reportType]

    if (!ReportComponent) {
        redirect('/dashboard/reports')
    }

    return (
        <MainLayout>
            <ReportComponent />
        </MainLayout>
    )
}
