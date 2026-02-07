import { CreditNoteDetails } from '@/components/sales/credit-note-details'

interface CreditNotePageProps {
    params: { id: string } | Promise<{ id: string }>
}

export default async function CreditNotePage({ params }: CreditNotePageProps) {
    const resolvedParams = await Promise.resolve(params)

    return (
        <div className="container mx-auto py-6">
            <CreditNoteDetails creditNoteId={resolvedParams.id} />
        </div>
    )
}
