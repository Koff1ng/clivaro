'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Send, X, MessageSquare, Loader2, Bot, User, Maximize2, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/toast'
import { getAssistantResponse } from './actions'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export function ChatAssistant() {
    const [isOpen, setIsOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()
    const router = useRouter()

    const initialMessage = { role: 'assistant' as const, content: '¡Hola! Soy tu asistente inteligente del ERP. ¿En qué puedo ayudarte hoy?' }

    // Cargar desde sessionStorage al montar
    useEffect(() => {
        const savedMessages = sessionStorage.getItem('clivaro-chat-messages')
        const savedIsOpen = sessionStorage.getItem('clivaro-chat-is-open')
        const savedIsExpanded = sessionStorage.getItem('clivaro-chat-is-expanded')

        if (savedMessages) {
            setMessages(JSON.parse(savedMessages))
        } else {
            setMessages([initialMessage])
        }

        if (savedIsOpen === 'true') setIsOpen(true)
        if (savedIsExpanded === 'true') setIsExpanded(true)
    }, [])

    // Guardar en sessionStorage cuando cambie el estado
    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem('clivaro-chat-messages', JSON.stringify(messages))
        }
    }, [messages])

    useEffect(() => {
        sessionStorage.setItem('clivaro-chat-is-open', isOpen.toString())
    }, [isOpen])

    useEffect(() => {
        sessionStorage.setItem('clivaro-chat-is-expanded', isExpanded.toString())
    }, [isExpanded])

    const clearChat = () => {
        setMessages([initialMessage])
        sessionStorage.removeItem('clivaro-chat-messages')
        toast('Chat reiniciado', 'info')
    }

    // ─── Parsea markdown básico: **negrita**, *cursiva*, `código`, \n ───
    const parseMarkdown = (text: string): (string | JSX.Element)[] => {
        const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\n)/g)
        return segments.map((seg, i) => {
            if (/^\*\*(.+)\*\*$/.test(seg)) {
                return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>
            }
            if (/^\*(.+)\*$/.test(seg)) {
                return <em key={i} className="italic">{seg.slice(1, -1)}</em>
            }
            if (/^`(.+)`$/.test(seg)) {
                return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{seg.slice(1, -1)}</code>
            }
            if (seg === '\n') {
                return <br key={i} />
            }
            return seg
        })
    }

    // ─── Renderiza contenido con acciones y markdown ───────────────────
    const renderContent = (content: string) => {
        const actionRegex = /{{ACTION:([^|]+)\|([^}]+)}}/g
        const parts: (string | JSX.Element)[] = []
        let lastIndex = 0
        let match

        while ((match = actionRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(...parseMarkdown(content.substring(lastIndex, match.index)))
            }
            const label = match[1]
            const path = match[2]
            parts.push(
                <Button
                    key={match.index}
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full flex items-center justify-between group hover:bg-primary hover:text-primary-foreground border-primary/20 bg-background/50 backdrop-blur-sm"
                    onClick={() => {
                        router.push(path)
                        setIsOpen(false)
                    }}
                >
                    <span className="font-medium">{label}</span>
                    <Maximize2 className="h-3 w-3 opacity-70 group-hover:opacity-100 transition-opacity" />
                </Button>
            )
            lastIndex = match.index + match[0].length
        }

        if (lastIndex < content.length) {
            parts.push(...parseMarkdown(content.substring(lastIndex)))
        }

        return parts.length > 0 ? <div className="flex flex-col gap-1">{parts}</div> : content
    }

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg = input.trim()
        setInput('')
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
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className={`mb-4 w-[350px] sm:w-[400px] ${isExpanded ? 'h-[600px]' : 'h-[500px]'} transition-all`}
                    >
                        <Card className="h-full shadow-2xl border-primary/10 flex flex-col overflow-hidden">
                            <CardHeader className="bg-primary text-primary-foreground py-3 flex flex-row items-center justify-between shrink-0">
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
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center border shadow-sm ${m.role === 'user' ? 'bg-secondary' : 'bg-primary text-primary-foreground'
                                                }`}>
                                                {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                            </div>
                                            <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-card border rounded-tl-none'
                                                }`}>
                                                {m.role === 'assistant' ? (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.4, ease: "easeOut" }}
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

                            <CardFooter className="p-3 border-t bg-card shrink-0">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                    className="flex gap-2 w-full"
                                >
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Escribe una pregunta..."
                                        className="flex-1"
                                        autoFocus
                                    />
                                    <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center border-4 border-white dark:border-zinc-950 relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary to-primary-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                {isOpen ? <X className="h-6 w-6 relative z-10" /> : <MessageSquare className="h-6 w-6 relative z-10" />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500 border-2 border-white dark:border-zinc-950"></span>
                    </span>
                )}
            </motion.button>
        </div>
    )
}