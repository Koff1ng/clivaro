'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Loader2, Minimize2, Maximize2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Page context mapping
const PAGE_CONTEXTS: Record<string, string> = {
  '/dashboard': 'el Dashboard principal — métricas de ventas, stock, clientes',
  '/inventory': 'Inventario — gestión de productos, stock, categorías',
  '/pos': 'Punto de Venta — facturación, cobros',
  '/cash': 'Caja — turnos, movimientos de efectivo',
  '/crm': 'CRM — leads, pipeline, oportunidades de venta',
  '/marketing': 'Marketing — campañas de email, inbox, leads',
  '/restaurant': 'Módulo de Restaurante — mesas, comandas, cocina',
  '/hr': 'Recursos Humanos — empleados, nómina',
  '/accounting': 'Contabilidad — cuentas, reportes',
  '/settings': 'Configuración — usuarios, roles, sucursales',
  '/reports': 'Reportes — análisis, gráficos, exportaciones',
}

function getPageContext(pathname: string): string {
  for (const [key, val] of Object.entries(PAGE_CONTEXTS)) {
    if (pathname.startsWith(key)) return val
  }
  return 'una página del sistema'
}

// Simple markdown → html (bold, italic, lists, code)
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px]">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-3">• $1</li>')
    .replace(/\n/g, '<br/>')
}

export default function CliviFab() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPulse, setShowPulse] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! 🐙 Soy **Clivi**, tu asistente inteligente. Puedo ayudarte con cualquier cosa del sistema: campañas, inventario, ventas, reportes... ¡Pregúntame lo que necesites!',
        timestamp: new Date(),
      }])
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setShowPulse(false)
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/clivi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history,
          pageContext: getPageContext(pathname),
        }),
      })

      if (!res.ok) {
        throw new Error('Error al comunicarme con el servidor')
      }

      const data = await res.json()

      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Lo siento, no pude procesar tu mensaje. 🐙',
        timestamp: new Date(),
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '¡Ups! Tuve un problemita procesando tu mensaje. ¿Puedes intentar de nuevo? 🐙💦',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, pathname])

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '¡Chat limpio! 🐙✨ ¿En qué te puedo ayudar?',
      timestamp: new Date(),
    }])
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group",
          isOpen
            ? "bg-slate-700 hover:bg-slate-600 rotate-0"
            : "bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:via-indigo-600 hover:to-blue-600"
        )}
        title={isOpen ? 'Cerrar Clivi' : 'Abrir Clivi 🐙'}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <>
            <span className="text-2xl">🐙</span>
            {showPulse && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col transition-all duration-300",
            isExpanded
              ? "bottom-0 right-0 w-full h-full sm:w-[480px] sm:h-[90vh] sm:bottom-4 sm:right-4 rounded-none sm:rounded-2xl"
              : "bottom-24 right-6 w-[360px] h-[500px] rounded-2xl"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-t-2xl shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-lg">🐙</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Clivi</h3>
              <p className="text-[10px] text-slate-400 truncate">
                Asistente IA • {getPageContext(pathname)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                title="Limpiar chat"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                title={isExpanded ? 'Minimizar' : 'Expandir'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-slate-400" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
              >
                <div className={cn(
                  "max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed",
                  msg.role === 'user'
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md"
                )}>
                  {msg.role === 'assistant' ? (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestions */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {[
                '¿Cómo creo una campaña?',
                '¿Cómo agrego un producto?',
                '¿Cómo cierro turno de caja?',
                'Resumen de ventas de hoy',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput('')
                    const msg: Message = { id: `user-${Date.now()}`, role: 'user', content: q, timestamp: new Date() }
                    setMessages(prev => [...prev, msg])
                    setIsLoading(true)
                    fetch('/api/ai/clivi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: q,
                        history: [],
                        pageContext: getPageContext(pathname),
                      }),
                    }).then(r => r.json())
                      .then(data => setMessages(prev => [...prev, { id: `bot-${Date.now()}`, role: 'assistant', content: data.reply || '🐙', timestamp: new Date() }]))
                      .catch(() => setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: '¡Ups! Intenta de nuevo 🐙', timestamp: new Date() }]))
                      .finally(() => setIsLoading(false))
                  }}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-2.5 border-t shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Escribe tu pregunta a Clivi..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  input.trim() && !isLoading
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                )}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-300 mt-1.5">Clivi 🐙 · Powered by Gemini</p>
          </div>
        </div>
      )}
    </>
  )
}
