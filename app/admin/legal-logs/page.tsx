import { Metadata } from 'next'
import { MainLayout } from '@/components/layout/main-layout'
import { LegalAuditDashboard } from '@/components/admin/legal-audit-dashboard'

export const metadata: Metadata = {
    title: 'Auditoría Legal | Clivaro Admin',
    description: 'Registro de aceptación de términos y condiciones',
}

export default function LegalAuditPage() {
    return (
        <MainLayout>
            <div className="p-6 md:p-8">
                <LegalAuditDashboard />
            </div>
        </MainLayout>
    )
}
