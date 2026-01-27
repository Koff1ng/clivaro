'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import {
    Phone, Mail, Calendar, CheckSquare, FileText,
    ArrowUpCircle, ArrowDownCircle, DollarSign, Package,
    Receipt, ShoppingCart, Truck, Search, Briefcase
} from 'lucide-react'

interface ActivityTimelineProps {
    customerId?: string
    leadId?: string
    limit?: number
}

async function fetchActivityFeed(customerId?: string, leadId?: string, limit: number = 20) {
    const params = new URLSearchParams()
    if (customerId) params.append('customerId', customerId)
    if (leadId) params.append('leadId', leadId)
    if (limit) params.append('limit', limit.toString())

    const res = await fetch(`/api/activity-feed?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to fetch activity feed')
    return res.json()
}

export function ActivityTimeline({ customerId, leadId, limit = 20 }: ActivityTimelineProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['activity-feed', customerId, leadId, limit],
        queryFn: () => fetchActivityFeed(customerId, leadId, limit),
        refetchInterval: 60000,
    })

    const activities = data?.activities || []

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 bg-gray-200 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-1/4" />
                            <div className="h-3 bg-gray-200 rounded w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    const getIcon = (iconName: string, color: string) => {
        const className = `h-4 w-4 text-${color}-600`
        switch (iconName) {
            case 'phone': return <Phone className={className} />
            case 'mail': return <Mail className={className} />
            case 'calendar': return <Calendar className={className} />
            case 'check-square': return <CheckSquare className={className} />
            case 'file-text': return <FileText className={className} />
            case 'arrow-up-circle': return <ArrowUpCircle className={className} />
            case 'arrow-down-circle': return <ArrowDownCircle className={className} />
            case 'dollar-sign': return <DollarSign className={className} />
            case 'package': return <Package className={className} />
            case 'receipt': return <Receipt className={className} />
            case 'shopping-cart': return <ShoppingCart className={className} />
            case 'truck': return <Truck className={className} />
            case 'file-search': return <Search className={className} />
            default: return <FileText className={className} />
        }
    }

    const getColorClass = (color: string) => {
        switch (color) {
            case 'blue': return 'bg-blue-50 border-blue-200'
            case 'green': return 'bg-green-50 border-green-200'
            case 'red': return 'bg-red-50 border-red-200'
            case 'yellow': return 'bg-yellow-50 border-yellow-200'
            case 'purple': return 'bg-purple-50 border-purple-200'
            case 'orange': return 'bg-orange-50 border-orange-200'
            case 'cyan': return 'bg-cyan-50 border-cyan-200'
            default: return 'bg-gray-50 border-gray-200'
        }
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p>No hay actividad reciente registrada.</p>
            </div>
        )
    }

    return (
        <div className="relative space-y-4 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {activities.map((activity: any) => (
                <div key={activity.id} className="relative flex items-start gap-4">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border shadow-sm z-10 flex-shrink-0 ${getColorClass(activity.color)}`}>
                        {getIcon(activity.icon, activity.color)}
                    </div>
                    <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-semibold truncate pr-4">
                                {activity.title}
                            </h4>
                            <time className="text-[10px] text-gray-400 whitespace-nowrap">
                                {formatDateTime(activity.createdAt)}
                            </time>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {activity.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                            <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {activity.user || 'Sistema'}
                            </span>
                            {activity.completed && (
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Completada
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
