'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Send, X, MessageSquare, Loader2, Bot, User, Maximize2, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/toast'
import { useSidebar } from '@/lib/sidebar-context'
import { getAssistantResponse } from './actions'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

const QUICK_SUGGESTIONS = [
    "Generar reporte de ventas",
    "Ver balance general",
    "¿Cómo crear un producto?",
    "Ajustes de facturación",
    "Ver inventario actual"
]

export function ChatAssistant() {
    const { isChatOpen: isOpen, setChatOpen: setIsOpen } = useSidebar()
    const [isExpanded, setIsExpanded] = useState(false)
    const [input, setInput] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [suggestions, setSuggestions] = useState<string[]>(QUICK_SUGGESTIONS)
    const scrollRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()
    const router = useRouter()

    const initialMessage = {
        role: 'assistant' as const,
        content: '¡Hola! Soy tu **asistente inteligente** de Clivaro. Puedo ayudarte a generar **reportes**, encontrar **módulos** o configurar tu **negocio**. ¿Sobre qué deseas consultar?'
    }

    // Cargar desde sessionStorage al montar
    useEffect(() => {
        const savedMessages = sessionStorage.getItem('clivaro-chat-messages')
        if (savedMessages) {
            setMessages(JSON.parse(savedMessages))
        } else {
            setMessages([initialMessage])
        }
    }, [])

    // Lógica de sugerencias en tiempo real
    useEffect(() => {
        if (input.trim().length > 0) {
            const filtered = QUICK_SUGGESTIONS.filter(s =>
                s.toLowerCase().includes(input.toLowerCase())
            )
            setSuggestions(filtered)
        } else {
            setSuggestions(QUICK_SUGGESTIONS)
        }
    }, [input])

    useEffect(() => {
        sessionStorage.setItem('clivaro-chat-is-expanded', isExpanded.toString())
    }, [isExpanded])

    const clearChat = () => {
        setMessages([initialMessage])
        sessionStorage.removeItem('clivaro-chat-messages')
        toast('Chat reiniciado', 'info')
    }

    // ─── Parsea markdown avanzado y limpio ──────────────────────────
    const parseMarkdown = (text: string): (string | JSX.Element)[] => {
        if (!text) return []

        // Primero separamos por bloques de párrafos (doble salto de línea)
        const paragraphs = text.split(/\n\n+/)

        return paragraphs.flatMap((p, pIdx) => {
            // Procesamos líneas individuales dentro del párrafo (listas o saltos simples)
            const lines = p.split('\n')
            const content = lines.flatMap((line, lIdx) => {
                // Si es un ítem de lista (empieza con * o - o •)
                const isListItem = /^[*-•]\s+/.test(line.trim())
                const cleanLine = isListItem ? line.trim().replace(/^[*-•]\s+/, '') : line

                // Procesamos negritas, cursivas y código en la línea
                const segments = cleanLine.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
                const processedSegments = segments.map((seg, sIdx) => {
                    if (/^\*\*(.+)\*\*$/.test(seg)) {
                        return <strong key={`${pIdx}-${lIdx}-${sIdx}`} className="font-bold text-sky-600 dark:text-sky-400">{seg.slice(2, -2)}</strong>
                    }
                    if (/^\*(.+)\*$/.test(seg)) {
                        return <em key={`${pIdx}-${lIdx}-${sIdx}`} className="italic text-muted-foreground/80">{seg.slice(1, -1)}</em>
                    }
                    if (/^`(.+)`$/.test(seg)) {
                        return <code key={`${pIdx}-${lIdx}-${sIdx}`} className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono border border-border/50 text-sky-700 dark:text-sky-300">{seg.slice(1, -1)}</code>
                    }
                    return seg
                })

                if (isListItem) {
                    return (
                        <div key={`${pIdx}-${lIdx}`} className="flex gap-2 items-start ml-2 my-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0 shadow-sm shadow-sky-500/50" />
                            <span className="flex-1">{processedSegments}</span>
                        </div>
                    )
                }

                return (
                    <span key={`${pIdx}-${lIdx}`}>
                        {processedSegments}
                        {lIdx < lines.length - 1 && <br />}
                    </span>
                )
            })

            // Retornamos el párrafo envuelto con espaciado
            return [
                <div key={pIdx} className="mb-4 last:mb-0 leading-relaxed tracking-tight">
                    {content}
                </div>
            ]
        })
    }

    // ─── Renderiza contenido con acciones y markdown ───────────────────
    const renderContent = (content: string) => {
        const actionRegex = /{{ACTION:([^|]+)\|([^}]+)}}/g
        const parts: (string | JSX.Element)[] = []
        let lastIndex = 0
        let match

        const textParts: string[] = []
        const actions: { label: string, path: string }[] = []

        while ((match = actionRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                textParts.push(content.substring(lastIndex, match.index))
            }
            actions.push({ label: match[1], path: match[2] })
            lastIndex = match.index + match[0].length
        }

        if (lastIndex < content.length) {
            textParts.push(content.substring(lastIndex))
        }

        // Si no hay acciones, devolvemos solo el texto parseado
        if (actions.length === 0) {
            return <div className="space-y-1">{parseMarkdown(content)}</div>
        }

        // Si hay acciones, las ponemos al final de forma elegante
        return (
            <div className="space-y-3">
                <div className="space-y-1">{parseMarkdown(textParts.join('\n'))}</div>
                <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Acciones sugeridas</p>
                    {actions.map((action, i) => (
                        <Button
                            key={i}
                            variant="secondary"
                            size="sm"
                            className="w-full h-10 flex items-center justify-between group bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-500 hover:text-white border-none shadow-sm transition-all transform active:scale-[0.98]"
                            onClick={() => {
                                router.push(action.path)
                                setIsOpen(false)
                            }}
                        >
                            <span className="font-semibold">{action.label}</span>
                            <div className="bg-white/20 p-1 rounded-md group-hover:bg-white/30 transition-colors">
                                <Maximize2 className="h-3 w-3" />
                            </div>
                        </Button>
                    ))}
                </div>
            </div>
        )
    }

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSuggestion = (suggestion: string) => {
        setInput(suggestion)
        handleSend(suggestion)
    }

    const handleSend = async (overrideInput?: string) => {
        const textToSend = overrideInput || input
        if (!textToSend.trim() || isLoading) return

        const userMsg = textToSend.trim()
        setInput('')
        setSuggestions([])
        const newMessages = [...messages, { role: 'user' as const, content: userMsg }]
        setMessages(newMessages)
        setIsLoading(true)

        try {
            const assistantResponse = await getAssistantResponse(
                userMsg,
                newMessages.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content
                }))
            )
            setMessages(prev => [...prev, { role: 'assistant' as const, content: assistantResponse }])
        } catch (error: any) {
            toast(error.message || 'Error en la conexión con la IA', 'error')
            setMessages(prev => [...prev, { role: 'assistant' as const, content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, verifica tu conexión o la configuración de la API.' }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] pointer-events-auto"
                        />

                        {/* Side Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0.5 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 bottom-0 w-full sm:w-[500px] bg-background border-l border-border shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
                        >
                            <Card className="h-full border-none flex flex-col rounded-none bg-transparent">
                                <CardHeader className="bg-slate-900 text-white py-4 flex flex-row items-center justify-between shrink-0 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-white/20 p-1.5 rounded-lg">
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <CardTitle className="text-sm font-bold">Asistente Clivaro IA</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                                            title="Reiniciar chat"
                                            onClick={clearChat}
                                        >
                                            <Loader2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                                            onClick={() => setIsExpanded(!isExpanded)}
                                        >
                                            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-primary-foreground hover:bg-white/10"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>

                                <CardContent ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50 scrollbar-thin">
                                    {messages.map((m, i) => (
                                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`flex gap-2.5 max-w-[90%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                                <div className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center border shadow-sm ${m.role === 'user'
                                                    ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700'
                                                    : 'bg-gradient-to-br from-sky-500 to-sky-600 text-white border-sky-400'
                                                    }`}>
                                                    {m.role === 'user' ? <User className="h-4 w-4 text-slate-600 dark:text-slate-400" /> : <Bot className="h-4 w-4" />}
                                                </div>
                                                <div className={`p-4 rounded-2xl text-[13.5px] leading-relaxed shadow-sm transition-all ${m.role === 'user'
                                                    ? 'bg-sky-500 text-white rounded-tr-none font-medium'
                                                    : 'bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-tl-none text-slate-800 dark:text-slate-200'
                                                    }`}>
                                                    {m.role === 'assistant' ? (
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ duration: 0.5 }}
                                                        >
                                                            {renderContent(m.content)}
                                                        </motion.div>
                                                    ) : (
                                                        renderContent(m.content)
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="flex gap-3 max-w-[85%]">
                                                <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground border shadow-sm">
                                                    <Bot className="h-4 w-4" />
                                                </div>
                                                <div className="bg-card border p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce delay-150" />
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce delay-300" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>

                                <CardFooter className="p-4 border-t bg-card shrink-0 flex flex-col gap-3">
                                    <AnimatePresence>
                                        {(suggestions.length > 0 && (isFocused || input.trim().length > 0)) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="w-full flex flex-wrap gap-1.5 mb-1"
                                            >
                                                {suggestions.slice(0, 4).map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => handleSuggestion(s)}
                                                        className="text-[11px] font-medium bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 dark:hover:text-white transition-all transform active:scale-95 shadow-sm"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <form
                                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                        className="flex gap-2 w-full"
                                    >
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onFocus={() => setIsFocused(true)}
                                            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                                            placeholder="Pregúntale a Clivaro IA..."
                                            className="flex-1 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-sky-500 h-10"
                                            autoFocus
                                        />
                                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-10 w-10 bg-sky-500 hover:bg-sky-600 transition-colors">
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </form>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}