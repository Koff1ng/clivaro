'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Inbox, Megaphone, Sparkles, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import CampaignsClient from '@/components/marketing/campaigns-client'
import MarketingInbox from '@/components/marketing/marketing-inbox'
import { LeadList } from '@/components/crm/lead-list'
import { PageHeader } from '@/components/ui/page-header'

const TABS = [
  { id: 'leads', label: 'Oportunidades', icon: Target, desc: 'Pipeline de ventas' },
  { id: 'campaigns', label: 'Campañas', icon: Megaphone, desc: 'Email marketing' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, desc: 'Contactos y correo' },
] as const

type TabId = typeof TABS[number]['id']

function getInitialTab(pathname: string | null): TabId {
  if (pathname?.includes('/campaigns')) return 'campaigns'
  if (pathname?.includes('/inbox')) return 'inbox'
  return 'leads'
}

export default function MarketingHub() {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<TabId>(() => getInitialTab(pathname))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Marketing"
          description="Oportunidades, campañas e inbox en un solo lugar."
          icon={<Sparkles className="h-5 w-5" />}
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'leads' && <LeadList />}
      {activeTab === 'campaigns' && <CampaignsClient />}
      {activeTab === 'inbox' && <MarketingInbox />}
    </div>
  )
}
