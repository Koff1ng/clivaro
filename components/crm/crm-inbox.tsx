'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Search, Send, User, MoreVertical, MessageCircle, Instagram,
    CheckCircle2, Plus, ArrowLeft, Loader2, MessageSquarePlus,
    Zap, Clock, UserPlus
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

async function fetchLeads(search: string) {
    const params = new URLSearchParams({ limit: '100' })
    if (search) params.append('search', search)
    const res = await fetch(`/api/leads?${params}`)
    if (!res.ok) throw new Error('Failed to fetch leads')
    return res.json()
}

// Quick reply template options
const quickReplies = [
    { label: '👋 Saludo', text: 'Hola, ¿en qué te puedo ayudar hoy?' },
    { label: '💰 Cotización', text: 'Te envío la cotización en unos minutos. ¿Necesitas algo más?' },
    { label: '📦 Seguimiento', text: 'Tu pedido está en proceso. Te avisamos cuando esté listo.' },
    { label: '🙏 Gracias', text: '¡Gracias por tu compra! Cualquier cosa, aquí estamos.' },
]

export function CrmInbox() {
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [newMessage, setNewMessage] = useState('')
    const [showMobileChat, setShowMobileChat] = useState(false)
    const [showQuickReplies, setShowQuickReplies] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const { data, isLoading, isError } = useQuery({
        queryKey: ['leads', search],
        queryFn: () => fetchLeads(search),
        refetchInterval: 10000,
    })

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
            toast('Etapa actualizada', 'success')
        },
        onError: () => toast('Error al cambiar la etapa', 'error'),
    })

    const sendMessageMutation = useMutation({
        mutationFn: async ({ leadId, content }: { leadId: string, content: string }) => {
            const lead = leads.find((l: any) => l.id === leadId)
            const phone = lead?.phone?.replace(/[^0-9]/g, '')
            if (!phone) throw new Error('El lead no tiene teléfono registrado')

            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: phone, message: content })
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'No se pudo enviar el mensaje')
            }

            await fetch(`/api/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }).catch(() => {})

            return res.json()
        },
        onSuccess: () => {
            setNewMessage('')
            setShowQuickReplies(false)
            refetchLead()
        },
        onError: (error: any) => {
            toast(error.message || 'Error al enviar el mensaje', 'error')
        },
    })

    const leads = useMemo(() => data?.leads || [], [data])

    useEffect(() => {
        if (!selectedLeadId && leads.length > 0) {
            setSelectedLeadId(leads[0].id)
        }
    }, [leads, selectedLeadId])

    // Auto-scroll to latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [selectedLead?.chatMessages, selectedLead?.activities])

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

    const timeline = useMemo(() => {
        if (!selectedLead) return []
        const msgs = (selectedLead.chatMessages || []).map((m: any) => ({ ...m, isChat: true, date: new Date(m.createdAt) }))
        const acts = (selectedLead.activities || []).map((a: any) => ({ ...a, isChat: false, date: new Date(a.createdAt) }))
        return [...msgs, ...acts].sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
    }, [selectedLead])

    const handleSelectLead = (id: string) => {
        setSelectedLeadId(id)
        setShowMobileChat(true)
    }

    const handleBackToList = () => {
        setShowMobileChat(false)
    }

    // ─── Loading Skeleton ───
    const LeadSkeleton = () => (
        <div className="flex gap-3 p-3 border-b border-slate-100 dark:border-slate-800 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
            </div>
        </div>
    )

    // ─── Empty State ───
    const EmptyState = () => (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                <MessageSquarePlus className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Tu inbox está vacío</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-6">
                Crea tu primer lead para empezar a gestionar conversaciones con tus clientes desde aquí.
            </p>
            <Button
                onClick={() => window.location.href = '/crm/leads'}
                className="bg-blue-600 hover:bg-blue-700"
            >
                <UserPlus className="w-4 h-4 mr-2" />
                Crear Primer Lead
            </Button>
        </div>
    )

    // ─── No Chat Selected State ───
    const NoChatSelected = () => (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-[#f0f2f5] dark:bg-slate-950">
            <div className="max-w-md space-y-4">
                <div className="w-28 h-28 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-full mx-auto flex items-center justify-center">
                    <MessageCircle className="w-14 h-14 text-slate-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300">Social Inbox</h2>
                <p className="text-sm text-gray-500">Selecciona una conversación para ver el historial y enviar mensajes.</p>
                <div className="flex justify-center gap-6 text-xs mt-6 opacity-60">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> WhatsApp</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-pink-500" /> Instagram</span>
                </div>
            </div>
        </div>
    )

    // ─── Lead List Sidebar ───
    const LeadListSidebar = ({ className = '' }: { className?: string }) => (
        <div className={cn("border-r flex flex-col bg-slate-50/50 dark:bg-slate-900/50", className)}>
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
                {isLoading ? (
                    <div className="flex flex-col">
                        {Array.from({ length: 6 }).map((_, i) => <LeadSkeleton key={i} />)}
                    </div>
                ) : isError ? (
                    <div className="p-6 text-center text-sm text-red-500">
                        Error al cargar. Intenta de nuevo.
                    </div>
                ) : leads.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="flex flex-col">
                        {leads.map((lead: any) => {
                            const preview = lead.company || 'Nueva oportunidad'
                            return (
                                <button
                                    key={lead.id}
                                    onClick={() => handleSelectLead(lead.id)}
                                    className={cn(
                                        "flex gap-3 p-3 text-left transition-all border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                                        selectedLeadId === lead.id && "bg-blue-50/80 dark:bg-blue-900/10 border-l-4 border-l-blue-600 pl-[11px]"
                                    )}
                                >
                                    <Avatar className="h-10 w-10 mt-1 shrink-0">
                                        <AvatarFallback className={cn(
                                            "text-xs font-bold",
                                            selectedLeadId === lead.id ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                        )}>
                                            {lead.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0 grid gap-0.5">
                                        <div className="flex justify-between items-center">
                                            <span className={cn("font-medium truncate text-sm", selectedLeadId === lead.id && "text-blue-700 dark:text-blue-400")}>
                                                {lead.name}
                                            </span>
                                            <span className="text-[10px] text-gray-400 tabular-nums shrink-0 ml-2">
                                                {formatDateTime(lead.updatedAt).split(' ')[0]}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{preview}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] h-4 px-1.5 rounded-sm border-0 font-medium",
                                                stages.find(s => s.id === lead.stage)?.color,
                                                "text-white"
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
                )}
            </ScrollArea>
        </div>
    )

    // ─── Chat Panel ───
    const ChatPanel = ({ onBack }: { onBack?: () => void }) => {
        if (!selectedLead) return <NoChatSelected />

        return (
            <>
                {/* Header */}
                <div className="h-16 px-4 border-b flex justify-between items-center bg-white dark:bg-slate-950 shadow-sm z-20">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={onBack}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        )}
                        <Avatar>
                            <AvatarFallback className="bg-blue-600 text-white font-bold">
                                {selectedLead.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h2 className="font-semibold text-sm text-gray-900 dark:text-white">{selectedLead.name}</h2>
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
                    <div className="flex items-center gap-1">
                        {selectedLead.phone && (
                            <Button size="icon" variant="ghost" className="text-green-600 hover:bg-green-50 h-9 w-9"
                                title="Abrir WhatsApp Web"
                                onClick={() => window.open(getWhatsAppLink(selectedLead.phone), '_blank')}>
                                <MessageCircle className="w-5 h-5" />
                            </Button>
                        )}
                        {selectedLead.instagram && (
                            <Button size="icon" variant="ghost" className="text-pink-600 hover:bg-pink-50 h-9 w-9"
                                title="Perfil Instagram"
                                onClick={() => window.open(getInstagramLink(selectedLead.instagram), '_blank')}>
                                <Instagram className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Chat Timeline */}
                <ScrollArea className="flex-1 p-4 sm:p-6">
                    <div className="flex flex-col space-y-3 max-w-3xl mx-auto">
                        <div className="flex justify-center my-4">
                            <span className="text-[10px] text-gray-500 bg-white/80 dark:bg-slate-800/80 px-3 py-1 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 backdrop-blur-sm">
                                Conversación iniciada el {formatDateTime(selectedLead.createdAt)}
                            </span>
                        </div>

                        {timeline.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Clock className="w-8 h-8 text-slate-300 mb-3" />
                                <p className="text-sm text-slate-400">No hay mensajes aún.</p>
                                <p className="text-xs text-slate-400 mt-1">Envía el primer mensaje para iniciar la conversación.</p>
                            </div>
                        )}

                        {timeline.map((item: any) => {
                            if (item.isChat) {
                                const isOutbound = item.direction === 'OUTBOUND'
                                return (
                                    <div key={item.id} className={cn(
                                        "flex flex-col max-w-[85%] md:max-w-[70%]",
                                        isOutbound ? "ml-auto items-end" : "mr-auto items-start"
                                    )}>
                                        <div className={cn(
                                            "px-3 py-2 rounded-xl text-sm shadow-sm border",
                                            isOutbound
                                                ? "bg-[#d9fdd3] dark:bg-green-900/30 border-green-100 dark:border-green-900 text-gray-800 dark:text-gray-100 rounded-tr-sm"
                                                : "bg-white dark:bg-slate-800 border-white dark:border-slate-700 text-gray-800 dark:text-gray-100 rounded-tl-sm"
                                        )}>
                                            <p className="whitespace-pre-wrap leading-snug">{item.content}</p>
                                            <div className="flex items-center justify-end gap-1 mt-1 opacity-50 select-none">
                                                <span className="text-[10px]">
                                                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isOutbound && item.status && (
                                                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div key={item.id} className="flex justify-center w-full my-1">
                                    <div className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-200/50 dark:border-slate-700/50">
                                        <User className="w-3 h-3" />
                                        <span className="font-medium">{item.type}: {item.subject}</span>
                                        <span className="opacity-40 text-[10px]">{formatDateTime(item.createdAt)}</span>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={chatEndRef} />
                    </div>
                </ScrollArea>

                {/* Quick Replies */}
                {showQuickReplies && (
                    <div className="px-3 pt-2 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-2 flex-wrap">
                        {quickReplies.map((qr, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setNewMessage(qr.text)
                                    setShowQuickReplies(false)
                                }}
                                className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                                {qr.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-3 bg-white dark:bg-slate-950 border-t min-h-[64px] flex items-end gap-2">
                    <Button
                        size="icon"
                        variant="ghost"
                        className={cn("text-gray-500 shrink-0 h-9 w-9", showQuickReplies && "bg-blue-50 text-blue-600")}
                        onClick={() => setShowQuickReplies(!showQuickReplies)}
                        title="Respuestas rápidas"
                    >
                        <Zap className="w-4 h-4" />
                    </Button>
                    <form
                        className="flex-1 flex items-end gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-transparent focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-colors"
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
                                "h-8 w-8 shrink-0 transition-all",
                                newMessage.trim() ? "opacity-100 bg-green-600 hover:bg-green-700 text-white" : "opacity-30 pointer-events-none bg-slate-300"
                            )}
                            disabled={sendMessageMutation.isPending}
                        >
                            {sendMessageMutation.isPending
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Send className="w-4 h-4" />
                            }
                        </Button>
                    </form>
                </div>
            </>
        )
    }

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white dark:bg-slate-950 border rounded-xl overflow-hidden shadow-sm">
            {/* Desktop: always show sidebar */}
            <LeadListSidebar className="hidden md:flex w-80" />

            {/* Mobile: show sidebar or chat */}
            <div className="flex md:hidden flex-1">
                {showMobileChat ? (
                    <div className="flex-1 flex flex-col min-w-0 bg-[#e5ddd5]/30 dark:bg-slate-950/50">
                        <ChatPanel onBack={handleBackToList} />
                    </div>
                ) : (
                    <LeadListSidebar className="flex flex-1" />
                )}
            </div>

            {/* Desktop: chat panel */}
            <div className="hidden md:flex flex-1 flex-col min-w-0 bg-[#e5ddd5]/30 dark:bg-slate-950/50">
                <ChatPanel />
            </div>
        </div>
    )
}
