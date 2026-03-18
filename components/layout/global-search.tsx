'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Command, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { menuGroups, type MenuItem } from '@/lib/navigation-data'
import { AppIcon } from '@/components/ui/app-icon'
import { useSession } from 'next-auth/react'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const { data: session } = useSession()
    const { hasFeature, planName, isLoading } = useTenantPlan()

    const userPermissions = (session?.user as any)?.permissions || []
    const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false

    // Filter items based on permissions and plan (same logic as Sidebar)
    const allItems = menuGroups.flatMap(group => group.items).filter(item => {
        let hasPermission = true
        if (isSuperAdmin) {
            hasPermission = true
        } else if (item.permission) {
            if (Array.isArray(item.permission)) {
                hasPermission = item.permission.some(perm => userPermissions.includes(perm))
            } else {
                hasPermission = userPermissions.includes(item.permission)
            }
        }
        if (!hasPermission) return false

        if (item.planFeature && !isSuperAdmin) {
            if (isLoading) return true
            if (!planName) return true
            return hasFeature(item.planFeature as any)
        }
        return true
    })

    const filteredItems = allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
    )

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
            setQuery('')
            setSelectedIndex(0)
        }
    }, [isOpen])

    const handleSelect = (href: string) => {
        router.push(href)
        setIsOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => (prev + 1) % filteredItems.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length)
        } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex].href)
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 h-9 text-slate-500 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-white hover:border-sky-200 hover:shadow-sm hover:shadow-sky-500/10 transition-all w-56 group active:scale-[0.98]"
            >
                <Search className="w-4 h-4 text-slate-400 group-hover:text-sky-500 transition-colors" />
                <span className="flex-1 text-left text-xs font-medium">Buscar...</span>
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-bold text-slate-400 shadow-sm">
                    <span className="text-[10px]">⌘</span>K
                </kbd>
            </button>

            {/* Mobile Search Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="md:hidden flex items-center justify-center h-9 w-9 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
                <Search className="h-4 w-4" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 pointer-events-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: -10 }}
                            className="relative w-full max-w-xl bg-white/90 border border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl overflow-hidden backdrop-blur-2xl"
                            onKeyDown={handleKeyDown}
                        >
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                                <Search className="w-5 h-5 text-sky-500" />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value)
                                        setSelectedIndex(0)
                                    }}
                                    placeholder="¿Qué módulo necesitas hoy?"
                                    className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-lg font-medium"
                                />
                                <div className="flex items-center gap-2">
                                    <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 font-mono text-[10px] font-bold text-slate-500 shadow-sm">
                                        ESC
                                    </kbd>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto p-3 custom-scrollbar">
                                {filteredItems.length === 0 ? (
                                    <div className="py-16 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <Command className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <p className="text-slate-500 font-medium">No hay resultados para "{query}"</p>
                                        <p className="text-slate-400 text-xs mt-1">Intenta con una palabra clave diferente</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {filteredItems.map((item, index) => (
                                            <button
                                                key={item.href}
                                                onClick={() => handleSelect(item.href)}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                                className={cn(
                                                    "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group text-left relative",
                                                    index === selectedIndex
                                                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25 scale-[1.01] z-10"
                                                        : "text-slate-600 hover:bg-slate-50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl transition-colors",
                                                    index === selectedIndex ? "bg-white/20" : "bg-slate-100 text-slate-500 group-hover:bg-sky-50 group-hover:text-sky-600"
                                                )}>
                                                    <AppIcon icon={item.icon} className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold tracking-tight truncate">{item.label}</div>
                                                    <div className={cn(
                                                        "text-[10px] font-bold uppercase tracking-[0.1em] opacity-80 mt-0.5",
                                                        index === selectedIndex ? "text-sky-100" : "text-slate-400"
                                                    )}>
                                                        {item.href.replace('/', 'ERP / ').replace('-', ' ')}
                                                    </div>
                                                </div>
                                                {index === selectedIndex && (
                                                    <div className="bg-white/20 px-2 py-1 rounded-lg text-[9px] font-black tracking-widest flex items-center gap-1">
                                                        ENTER <ChevronRight className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                                <div className="flex items-center gap-6">
                                    <span className="flex items-center gap-2"><span className="w-5 h-5 flex items-center justify-center rounded bg-white shadow-sm border border-slate-200 text-[10px]">↑↓</span> Navegar</span>
                                    <span className="flex items-center gap-2"><span className="w-8 h-5 flex items-center justify-center rounded bg-white shadow-sm border border-slate-200 text-[10px] font-bold">↵</span> Ir al módulo</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 text-sky-600">
                                    <Sparkles className="w-3 h-3" />
                                    Clivaro Smart Search
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
