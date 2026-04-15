'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Send, Inbox, Sparkles, UserPlus, Mail,
  MailOpen, User, Loader2, ArrowLeft,
  MessageCircle, RefreshCw, Settings2, Link2, Check, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

const stageColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  QUOTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const stageLabels: Record<string, string> = {
  NEW: 'Nuevo', CONTACTED: 'Contactado', QUOTED: 'Cotizado',
  WON: 'Ganado', LOST: 'Perdido',
}

export default function MarketingInbox() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobile, setShowMobile] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [showExtractDialog, setShowExtractDialog] = useState(false)
  const [extractText, setExtractText] = useState('')
  const [extractedLeads, setExtractedLeads] = useState<any[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load saved email from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('marketing-inbox-email')
    if (saved) { setEmailAddress(saved); setEmailSaved(true) }
  }, [])

  // Fetch leads
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['inbox-leads', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.append('search', search)
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const leads = useMemo(() => {
    const items = leadsData?.leads || leadsData || []
    return Array.isArray(items) ? items : []
  }, [leadsData])

  // Fetch selected lead
  const { data: selectedLead, refetch: refetchLead } = useQuery({
    queryKey: ['inbox-lead', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const res = await fetch(`/api/leads/${selectedId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!selectedId,
    refetchInterval: 10000,
  })

  // Add note
  const addNoteMutation = useMutation({
    mutationFn: async ({ leadId, content }: { leadId: string; content: string }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: `${selectedLead?.notes || ''}\n[${new Date().toLocaleString('es-CO')}] ${content}`.trim()
        }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => { setNewNote(''); refetchLead(); toast('Nota agregada', 'success') },
  })

  // Update stage
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-leads'] })
      refetchLead()
      toast('Etapa actualizada', 'success')
    },
  })

  // AI suggest reply
  const handleAiSuggest = async () => {
    if (!selectedLead) return
    setIsAiLoading(true); setAiSuggestions([])
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest-reply',
          leadName: selectedLead.name,
          lastMessages: [selectedLead.notes || 'Sin notas previas'],
          leadStage: selectedLead.stage,
        }),
      })
      if (!res.ok) throw new Error('AI error')
      const data = await res.json()
      setAiSuggestions(data.suggestions || [])
    } catch { toast('Error al generar sugerencias', 'error') }
    finally { setIsAiLoading(false) }
  }

  // AI extract leads from pasted email/text
  const handleExtractLeads = async () => {
    if (!extractText.trim()) return
    setIsExtracting(true)
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract-leads', text: extractText }),
      })
      if (!res.ok) throw new Error('Error')
      const data = await res.json()
      setExtractedLeads(data.leads || [])
    } catch { toast('Error al extraer leads', 'error') }
    finally { setIsExtracting(false) }
  }

  // Save extracted lead
  const saveLeadMutation = useMutation({
    mutationFn: async (lead: any) => {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name, email: lead.email || '', phone: lead.phone || '',
          source: 'email-inbox',
          notes: `Interés: ${lead.interest || 'N/A'}\nFuente: correo electrónico`,
          stage: 'NEW',
        }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-leads'] })
      toast('Lead guardado', 'success')
    },
    onError: () => toast('Error al guardar lead', 'error'),
  })

  // Save email config
  const saveEmailConfig = () => {
    if (!emailAddress.trim()) return
    localStorage.setItem('marketing-inbox-email', emailAddress.trim())
    setEmailSaved(true)
    toast('Email vinculado correctamente', 'success')
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedLead?.notes])

  const selectLead = (id: string) => {
    setSelectedId(id); setShowMobile(true); setAiSuggestions([])
  }

  return (
    <div className="flex rounded-2xl border overflow-hidden bg-white dark:bg-slate-900" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
      {/* ── Sidebar — lead list ── */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r flex flex-col shrink-0",
        showMobile ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-3 border-b space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Inbox className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Inbox</h2>
                <p className="text-[10px] text-slate-400">{leads.length} contactos</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowEmailConfig(!showEmailConfig)} title="Configurar correo">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowExtractDialog(!showExtractDialog)} title="Extraer leads con IA">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => queryClient.invalidateQueries({ queryKey: ['inbox-leads'] })}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contacto..." className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>
        </div>

        {/* Email Config Panel */}
        {showEmailConfig && (
          <div className="p-3 border-b bg-blue-50/50 dark:bg-blue-900/10 space-y-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Vincular correo electrónico</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Pega tu dirección de correo para vincularla al inbox. Los correos recibidos aparecerán como contactos.
            </p>
            <div className="flex gap-1.5">
              <Input
                type="email" value={emailAddress}
                onChange={(e) => { setEmailAddress(e.target.value); setEmailSaved(false) }}
                placeholder="correo@tuempresa.com"
                className="flex-1 h-7 text-xs rounded-lg"
              />
              <Button
                size="sm" onClick={saveEmailConfig}
                disabled={!emailAddress.trim() || emailSaved}
                className={cn("h-7 px-2.5 rounded-lg text-xs", emailSaved ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700")}
              >
                {emailSaved ? <><Check className="w-3 h-3 mr-1" /> Vinculado</> : <><Link2 className="w-3 h-3 mr-1" /> Vincular</>}
              </Button>
            </div>
            {emailSaved && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <Check className="w-3 h-3" />
                <span>Correo <strong>{emailAddress}</strong> vinculado al inbox</span>
              </div>
            )}
          </div>
        )}

        {/* AI Extract Panel */}
        {showExtractDialog && (
          <div className="p-3 border-b bg-purple-50/50 dark:bg-purple-900/10 space-y-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400">Extraer leads con IA</span>
            </div>
            <textarea
              value={extractText} onChange={(e) => setExtractText(e.target.value)}
              placeholder="Pega aquí un correo electrónico, lista de contactos, o cualquier texto con datos de contacto y la IA extraerá los leads automáticamente..."
              className="w-full h-20 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 p-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Button
              size="sm" onClick={handleExtractLeads}
              disabled={isExtracting || !extractText.trim()}
              className="w-full h-7 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              {isExtracting ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analizando...</> : <><Sparkles className="w-3 h-3 mr-1" /> Extraer contactos</>}
            </Button>
            {extractedLeads.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-purple-600">{extractedLeads.length} contactos encontrados:</span>
                {extractedLeads.map((lead, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border text-[11px]">
                    <div>
                      <span className="font-bold">{lead.name}</span>
                      {lead.email && <span className="text-slate-400 ml-1">· {lead.email}</span>}
                      {lead.interest && <span className="text-purple-500 ml-1">· {lead.interest}</span>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => saveLeadMutation.mutate(lead)}>
                      <UserPlus className="w-3 h-3 mr-0.5" /> Guardar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Inbox className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs mb-1">No hay contactos</p>
              <p className="text-[10px] max-w-[200px] text-center">
                Pega un correo electrónico con el botón <Sparkles className="w-3 h-3 inline text-purple-400" /> para extraer leads automáticamente.
              </p>
            </div>
          ) : (
            leads.map((lead: any) => {
              const isSelected = selectedId === lead.id
              const initial = (lead.name || 'L').charAt(0).toUpperCase()
              return (
                <button
                  key={lead.id} onClick={() => selectLead(lead.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-2.5",
                    isSelected && "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500"
                  )}
                >
                  <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                    <AvatarFallback className={cn("text-xs font-bold",
                      isSelected ? "bg-indigo-200 text-indigo-800" : "bg-slate-200 text-slate-600"
                    )}>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{lead.name || 'Sin nombre'}</span>
                      <span className="text-[9px] text-slate-400 shrink-0 ml-1">{lead.updatedAt ? formatDateTime(lead.updatedAt).split(',')[0] : ''}</span>
                    </div>
                    {lead.email && <div className="text-[10px] text-slate-400 truncate mt-0.5">{lead.email}</div>}
                    <div className="flex items-center gap-1 mt-1">
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", stageColors[lead.stage] || stageColors.NEW)}>
                        {stageLabels[lead.stage] || lead.stage || 'Nuevo'}
                      </span>
                      {lead.source && (
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{lead.source}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Main — detail panel ── */}
      <div className={cn("flex-1 flex flex-col min-w-0", !showMobile ? "hidden md:flex" : "flex")}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
              <MailOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Selecciona un contacto</h3>
            <p className="text-xs max-w-xs text-center">
              Selecciona un contacto de tu inbox para ver detalles, agregar notas y obtener sugerencias de IA.
            </p>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="px-4 py-3 border-b flex items-center gap-3 bg-white dark:bg-slate-900 shrink-0">
              <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={() => setShowMobile(false)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-indigo-200 text-indigo-800 font-bold text-sm">
                  {(selectedLead?.name || 'L').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedLead?.name || 'Cargando...'}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  {selectedLead?.email && <span>{selectedLead.email}</span>}
                  {selectedLead?.phone && <span>· {selectedLead.phone}</span>}
                </div>
              </div>
              <select
                value={selectedLead?.stage || 'NEW'}
                onChange={(e) => selectedId && updateStageMutation.mutate({ id: selectedId, stage: e.target.value })}
                className={cn("text-[10px] px-2 py-1 rounded-full font-medium border-0 cursor-pointer appearance-none", stageColors[selectedLead?.stage || 'NEW'])}
              >
                {Object.entries(stageLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Notes feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
              {/* Lead info card */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border p-3 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Información</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Fuente:</span> <span className="font-medium">{selectedLead?.source || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Valor:</span> <span className="font-medium">{selectedLead?.value ? `$${selectedLead.value.toLocaleString()}` : 'N/A'}</span></div>
                  <div><span className="text-slate-400">Creado:</span> <span className="font-medium">{selectedLead?.createdAt ? formatDateTime(selectedLead.createdAt) : ''}</span></div>
                  <div><span className="text-slate-400">Actualizado:</span> <span className="font-medium">{selectedLead?.updatedAt ? formatDateTime(selectedLead.updatedAt) : ''}</span></div>
                </div>
              </div>

              {/* Notes */}
              {selectedLead?.notes ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border p-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas / Historial</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedLead.notes}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Sin notas aún. Escribe la primera nota abajo.
                </div>
              )}

              {/* AI Suggestions */}
              {aiSuggestions.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Sugerencias IA</span>
                  </div>
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => setNewNote(s)}
                      className="w-full text-left p-2 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-800 text-xs text-slate-700 dark:text-slate-300 hover:border-purple-400 transition-colors"
                    >{s}</button>
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t bg-white dark:bg-slate-900 shrink-0">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm"
                  className="shrink-0 h-9 px-2.5 rounded-lg text-purple-600 hover:bg-purple-50 hover:text-purple-700 border-purple-200"
                  onClick={handleAiSuggest} disabled={isAiLoading} title="Sugerencias de IA"
                >
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </Button>
                <Input
                  value={newNote} onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escribe una nota o respuesta..."
                  className="flex-1 h-9 text-xs rounded-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newNote.trim() && selectedId) {
                      addNoteMutation.mutate({ leadId: selectedId, content: newNote })
                    }
                  }}
                />
                <Button size="sm"
                  className="shrink-0 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700"
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  onClick={() => selectedId && newNote.trim() && addNoteMutation.mutate({ leadId: selectedId, content: newNote })}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
