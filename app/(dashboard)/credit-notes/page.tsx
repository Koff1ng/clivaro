import { CreditNotesList } from '@/components/sales/credit-notes-list'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { FileText } from 'lucide-react'

export default function CreditNotesPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Notas Crédito"
                    description="Gestión de notas de crédito electrónicas."
                    icon={<FileText className="h-5 w-5" />}
                />
                <CreditNotesList />
            </div>
        </MainLayout>
    )
}
