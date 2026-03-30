'use client'

import { useState } from 'react'
import { Inbox, Megaphone, Sparkles,  } from 'lucide-react'
import { cn } from '@/lib/utils'
import CampaignsClient from '@/components/marketing/campaigns-client'
import MarketingInbox from '@/components/marketing/marketing-inbox'
import { PageHeader } from '@/components/ui/page-header'

const TABS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, desc: 'Contactos y conversaciones' },
  { id: 'campaigns', label: 'Campañas', icon: Megaphone, desc: 'Email marketing' },
] as const

type TabId = typeof TABS[number]['id']

export default function MarketingHub() {
  const [activeTab, setActiveTab] = useState<TabId>('campaigns')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Marketing"
          description="Gestiona campañas, contactos e inteligencia artificial."
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
      {activeTab === 'inbox' && <MarketingInbox />}
      {activeTab === 'campaigns' && <CampaignsClient />}
    </div>
  )
}
