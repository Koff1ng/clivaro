import { Metadata } from 'next'
import { CrmInbox } from '@/components/crm/crm-inbox'

export const metadata: Metadata = {
    title: 'Social Inbox - CRM',
    description: 'Gestión centralizada de conversaciones y oportunidades.',
}

export default function InboxPage() {
    return (
        <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Social Inbox</h1>
                    <p className="text-muted-foreground">
                        Gestiona tus conversaciones de WhatsApp e Instagram en un solo lugar.
                    </p>
                </div>
            </div>
            <CrmInbox />
        </div>
    )
}
