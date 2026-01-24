'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Send, Phone, User, MoreVertical, MessageCircle, Instagram, CheckCircle2, Circle, Plus, AlertCircle } from 'lucide-react'
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
                <div className="p-3 border-b bg-white dark:bg-slate-950">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar conversación..."
                            className="pl-9 h-9 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus-visible:ring-1"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col">
                        {leads.map((lead: any) => {
                            // Smart Preview: Last message or activity
                            // For demo we grab the stage or static text if no relations loaded in list
                            const preview = lead.company || 'Nueva oportunidad'

                            return (
                                <button
                                    key={lead.id}
                                    onClick={() => setSelectedLeadId(lead.id)}
                                    className={cn(
                                        "flex gap-3 p-3 text-left transition-all border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                                        selectedLeadId === lead.id && "bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-600 pl-[11px]"
                                    )}
                                >
                                    <Avatar className="h-10 w-10 mt-1">
                                        <AvatarFallback className={cn(
                                            "text-xs font-bold",
                                            selectedLeadId === lead.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                                        )}>
                                            {lead.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0 grid gap-0.5">
                                        <div className="flex justify-between items-center">
                                            <span className={cn("font-medium truncate text-sm", selectedLeadId === lead.id && "text-blue-700 dark:text-blue-400")}>
                                                {lead.name}
                                            </span>
                                            <span className="text-[10px] text-gray-400 tabular-nums">
                                                {formatDateTime(lead.updatedAt).split(' ')[0]} // Simplified date
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{preview}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] h-4 px-1 rounded-sm border-0 font-medium",
                                                stages.find(s => s.id === lead.stage)?.color.replace('bg-', 'text-')
                                            )}>
                                                {stages.find(s => s.id === lead.stage)?.label}
                                            </Badge>
                                            {lead.phone && <MessageCircle className="w-3 h-3 text-green-500 opacity-80" />}
                                            {lead.instagram && <Instagram className="w-3 h-3 text-pink-500 opacity-80" />}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#e5ddd5]/30 dark:bg-slate-950/50">
                {/* WhatsApp-ish background color hint */}
                {selectedLead ? (
                    <>
                        {/* Header */}
                        <div className="h-16 px-4 border-b flex justify-between items-center bg-white dark:bg-slate-950 shadow-sm z-20">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarFallback className="bg-blue-600 text-white font-bold">
                                        {selectedLead.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                        {selectedLead.name}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        {/* Status Dropdown - Compact */}
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <div className={cn("w-2 h-2 rounded-full", stages.find(s => s.id === selectedLead.stage)?.color)} />
                                            <select
                                                className="bg-transparent border-none p-0 h-auto text-xs focus:ring-0 cursor-pointer font-medium hover:underline"
                                                value={selectedLead.stage}
                                                onChange={(e) => updateStageMutation.mutate({ id: selectedLead.id, stage: e.target.value })}
                                            >
                                                {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {selectedLead.phone && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-green-600 hover:bg-green-50 h-9 w-9"
                                        title="Abrir WhatsApp Web"
                                        onClick={() => window.open(getWhatsAppLink(selectedLead.phone), '_blank')}
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </Button>
                                )}
                                {selectedLead.instagram && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-pink-600 hover:bg-pink-50 h-9 w-9"
                                        title="Perfil Instagram"
                                        onClick={() => window.open(getInstagramLink(selectedLead.instagram), '_blank')}
                                    >
                                        <Instagram className="w-5 h-5" />
                                    </Button>
                                )}
                                <div className="w-px h-6 bg-slate-200 mx-2" />
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <MoreVertical className="w-5 h-5 text-gray-500" />
                                </Button>
                            </div>
                        </div>

                        {/* Chat Timeline Body */}
                        <ScrollArea className="flex-1 p-4 sm:p-6">
                            <div className="flex flex-col space-y-4 max-w-3xl mx-auto">
                                <div className="flex justify-center my-4">
                                    <span className="text-[10px] text-gray-500 bg-white/80 dark:bg-slate-800/80 px-3 py-1 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 backdrop-blur-sm">
                                        Conversación iniciada el {formatDateTime(selectedLead.createdAt)}
                                    </span>
                                </div>

                                {timeline.map((item: any) => {
                                    // Chat Message
                                    if (item.isChat) {
                                        const isOutbound = item.direction === 'OUTBOUND'
                                        return (
                                            <div key={item.id} className={cn(
                                                "flex flex-col max-w-[85%] md:max-w-[70%]",
                                                isOutbound ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "px-3 py-2 rounded-lg text-sm shadow-sm relative group border",
                                                    isOutbound
                                                        ? "bg-[#d9fdd3] dark:bg-green-900/30 border-green-100 dark:border-green-900 text-gray-800 dark:text-gray-100 rounded-tr-none"
                                                        : "bg-white dark:bg-slate-800 border-white dark:border-slate-800 text-gray-800 dark:text-gray-100 rounded-tl-none"
                                                )}>
                                                    <p className="whitespace-pre-wrap leading-snug">{item.content}</p>
                                                    <div className="flex items-center justify-end gap-1 mt-1 opacity-60 select-none">
                                                        <span className="text-[10px]">
                                                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {isOutbound && item.status && (
                                                            <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                                            // Simplified "Read" indicator logic (can be nuanced based on status)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }

                                    // Activity Log (System Notes)
                                    return (
                                        <div key={item.id} className="flex justify-center w-full my-2">
                                            <div className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 text-xs px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-200/50">
                                                <User className="w-3 h-3" />
                                                <span className="font-medium">{item.type}: {item.subject}</span>
                                                <span className="opacity-50 text-[10px]">{formatDateTime(item.createdAt)}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-slate-950 border-t min-h-[70px] flex items-end gap-2">
                            <Button size="icon" variant="ghost" className="text-gray-500 shrink-0 h-10 w-10">
                                <Plus className="w-5 h-5" />
                            </Button>
                            <form
                                className="flex-1 flex items-end gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-transparent focus-within:border-slate-300 dark:focus-within:border-slate-700 transition-colors"
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    if (!newMessage.trim()) return
                                    sendMessageMutation.mutate({ leadId: selectedLead.id, content: newMessage })
                                }}
                            >
                                <Input
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-transparent border-none focus-visible:ring-0 px-2 py-0 h-auto min-h-[36px] max-h-32 resize-none"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 shrink-0 transition-opacity",
                                        newMessage.trim() ? "opacity-100 bg-green-600 hover:bg-green-700 text-white" : "opacity-0 pointer-events-none"
                                    )}
                                    disabled={sendMessageMutation.isPending}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                            <div className="w-2" /> {/* Spacer */}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-[#f0f2f5] dark:bg-slate-950">

                        <div className="max-w-md space-y-4">
                            <div className="w-32 h-32 bg-slate-200 dark:bg-slate-900 rounded-full mx-auto flex items-center justify-center opacity-50 grayscale">
                                <MessageCircle className="w-16 h-16" />
                            </div>
                            <h2 className="text-2xl font-light text-gray-600 dark:text-gray-300">Social Inbox</h2>
                            <p className="text-sm text-gray-500">Selecciona un chat para comenzar a gestionar tus oportunidades de venta de manera centralizada.</p>
                            <div className="flex justify-center gap-4 text-xs mt-8 opacity-50">
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> WhatsApp Business</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Instagram Direct</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
