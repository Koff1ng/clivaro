'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Send, Phone, User, MoreVertical, MessageCircle, Instagram, CheckCircle2, Circle } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Reusing fetch logic from lead-list (could be extracted to a hook)
async function fetchLeads(search: string) {
    const params = new URLSearchParams({ limit: '100' }) // Grab more for the inbox list
    if (search) params.append('search', search)

    const res = await fetch(`/api/leads?${params}`)
    if (!res.ok) throw new Error('Failed to fetch leads')
    return res.json()
}

export function CrmInbox() {
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [newMessage, setNewMessage] = useState('')
    const queryClient = useQueryClient()

    // Polling for "real-time" feel updates (every 10s)
    const { data } = useQuery({
        queryKey: ['leads', search],
        queryFn: () => fetchLeads(search),
        refetchInterval: 10000
    })

    // Fetch full details of selected lead (including activities/timeline)
    // We poll this specifically to get new messages
    const { data: leadData, refetch: refetchLead } = useQuery({
        queryKey: ['lead', selectedLeadId],
        queryFn: async () => {
            if (!selectedLeadId) return null
            const res = await fetch(`/api/leads/${selectedLeadId}`)
            return res.json()
        },
        enabled: !!selectedLeadId,
        refetchInterval: 5000,
    })

    const selectedLead = leadData

    const updateStageMutation = useMutation({
        mutationFn: async ({ id, stage }: { id: string, stage: string }) => {
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage }),
            })
            if (!res.ok) throw new Error("Failed to update stage")
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead', selectedLeadId] })
            queryClient.invalidateQueries({ queryKey: ['leads'] })
        }
    })

    const sendMessageMutation = useMutation({
        mutationFn: async ({ leadId, content }: { leadId: string, content: string }) => {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, content })
            })
            if (!res.ok) throw new Error("Failed to send message")
            return res.json()
        },
        onSuccess: () => {
            setNewMessage('')
            refetchLead()
        }
    })

    const leads = useMemo(() => data?.leads || [], [data])

    // Select first lead on load if none selected
    useEffect(() => {
        if (!selectedLeadId && leads.length > 0) {
            setSelectedLeadId(leads[0].id)
        }
    }, [leads, selectedLeadId])


    const stages = [
        { id: 'NEW', label: 'Nueva', color: 'bg-blue-500' },
        { id: 'CONTACTED', label: 'Contactado', color: 'bg-yellow-500' },
        { id: 'QUOTED', label: 'Cotizado', color: 'bg-purple-500' },
        { id: 'WON', label: 'Ganada', color: 'bg-green-500' },
        { id: 'LOST', label: 'Perdida', color: 'bg-red-500' },
    ]

    const getWhatsAppLink = (phone: string) => `https://wa.me/${phone?.replace(/[^0-9]/g, '')}`
    const getInstagramLink = (handle: string) => {
        let clean = handle?.trim() || ''
        if (clean.startsWith('http')) return clean
        if (clean.startsWith('@')) clean = clean.substring(1)
        return `https://instagram.com/${clean}`
    }

    // Merge activities and messages for the timeline
    const timeline = useMemo(() => {
        if (!selectedLead) return []
        const msgs = (selectedLead.chatMessages || []).map((m: any) => ({ ...m, isChat: true, date: new Date(m.createdAt) }))
        const acts = (selectedLead.activities || []).map((a: any) => ({ ...a, isChat: false, date: new Date(a.createdAt) }))
        return [...msgs, ...acts].sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
    }, [selectedLead])

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white dark:bg-slate-950 border rounded-xl overflow-hidden shadow-sm">

            {/* Left Sidebar: Lead List */}
            <div className="w-80 border-r flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar chats..."
                            className="pl-9 bg-white dark:bg-slate-800"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col">
                        {leads.map((lead: any) => (
                            <button
                                key={lead.id}
                                onClick={() => setSelectedLeadId(lead.id)}
                                className={cn(
                                    "flex items-start gap-3 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-transparent",
                                    selectedLeadId === lead.id && "bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 shadow-sm"
                                )}
                            >
                                <Avatar>
                                    <AvatarFallback className="bg-blue-100 text-blue-700">
                                        {lead.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-semibold truncate text-sm">{lead.name}</span>
                                        <span className="text-[10px] text-gray-400">{formatDateTime(lead.updatedAt).split(' ')[0]}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{lead.company || 'Sin empresa'}</p>
                                    <div className="mt-2 flex gap-1">
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                            {stages.find(s => s.id === lead.stage)?.label || lead.stage}
                                        </Badge>
                                        {lead.phone && <MessageCircle className="w-3 h-3 text-green-500" />}
                                        {lead.instagram && <Instagram className="w-3 h-3 text-pink-500" />}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950">
                {selectedLead ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-white dark:bg-slate-950 z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-blue-600 text-white font-bold">
                                        {selectedLead.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {selectedLead.name}
                                        {selectedLead.company && <span className="text-xs font-normal text-gray-500">({selectedLead.company})</span>}
                                    </h2>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        Asignado a: {selectedLead.assignedTo?.name || 'Nadie'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedLead.phone && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-green-600 border-green-200 hover:bg-green-50 hidden md:flex gap-2"
                                        onClick={() => window.open(getWhatsAppLink(selectedLead.phone), '_blank')}
                                    >
                                        <MessageCircle className="w-4 h-4" /> WhatsApp
                                    </Button>
                                )}
                                {selectedLead.instagram && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-pink-600 border-pink-200 hover:bg-pink-50 hidden md:flex gap-2"
                                        onClick={() => window.open(getInstagramLink(selectedLead.instagram), '_blank')}
                                    >
                                        <Instagram className="w-4 h-4" /> Instagram
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Pipeline Progress Bar */}
                        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b flex items-center justify-between gap-2 overflow-x-auto">
                            {stages.map((stage, idx) => {
                                const isCurrent = selectedLead.stage === stage.id
                                const isPast = stages.findIndex(s => s.id === selectedLead.stage) > idx
                                return (
                                    <button
                                        key={stage.id}
                                        onClick={() => updateStageMutation.mutate({ id: selectedLead.id, stage: stage.id })}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                                            isCurrent ? `${stage.color} text-white shadow-md scale-105` :
                                                isPast ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 opacity-70 hover:opacity-100" :
                                                    "bg-white border text-slate-400 hover:bg-slate-100 dark:bg-transparent dark:border-slate-800"
                                        )}
                                    >
                                        {isCurrent || isPast ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                        {stage.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Chat Timeline Body */}
                        <ScrollArea className="flex-1 p-6 bg-slate-50/30 dark:bg-slate-900/10">
                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                        Inicio de la conversación ({formatDateTime(selectedLead.createdAt)})
                                    </span>
                                </div>

                                {timeline.map((item: any) => {
                                    // Chat Message
                                    if (item.isChat) {
                                        const isOutbound = item.direction === 'OUTBOUND'
                                        return (
                                            <div key={item.id} className={cn(
                                                "flex flex-col max-w-[80%]",
                                                isOutbound ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "p-3 rounded-2xl text-sm shadow-sm",
                                                    isOutbound
                                                        ? "bg-green-100 text-green-900 rounded-tr-sm"
                                                        : "bg-white dark:bg-slate-800 border rounded-tl-sm"
                                                )}>
                                                    <p className="leading-relaxed whitespace-pre-wrap">{item.content}</p>
                                                    <span className="text-[9px] mt-1 block w-full text-right opacity-60">
                                                        {formatDateTime(item.createdAt)}
                                                        {item.status && <span className="ml-1 uppercase">· {item.status}</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    }

                                    // Activity Log
                                    return (
                                        <div key={item.id} className="flex flex-col max-w-[80%] mx-auto items-center w-full my-4">
                                            <div className="text-[10px] text-gray-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full flex items-center gap-2">
                                                <User className="w-3 h-3" />
                                                <span>{item.type}: {item.subject}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-950 border-t">
                            <form
                                className="flex gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    if (!newMessage.trim()) return
                                    sendMessageMutation.mutate({ leadId: selectedLead.id, content: newMessage })
                                }}
                            >
                                <Input
                                    placeholder="Escribe un mensaje de WhatsApp..."
                                    className="flex-1 bg-slate-50 border-slate-200 focus-visible:ring-green-500"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                                    disabled={sendMessageMutation.isPending}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                            <MessageCircle className="w-8 h-8 opacity-50" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Social Inbox</h3>
                        <p className="max-w-sm mt-2">Selecciona una conversación de la izquierda para ver el historial y gestionar la oportunidad.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
