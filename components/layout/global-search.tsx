'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Command } from 'lucide-react'
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
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all w-64 group"
            >
                <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="flex-1 text-left">Buscar módulos...</span>
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-600 bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            {/* Mobile Search Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="md:hidden flex items-center justify-center h-8 w-8 text-slate-100 hover:bg-slate-800 rounded-full"
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
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
                            onKeyDown={handleKeyDown}
                        >
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value)
                                        setSelectedIndex(0)
                                    }}
                                    placeholder="Buscar por módulo, reporte o microservicio..."
                                    className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-500 text-base"
                                />
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                                {filteredItems.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <Command className="w-12 h-12 text-slate-700 mx-auto mb-3 opacity-20" />
                                        <p className="text-slate-400">No se encontraron resultados para "{query}"</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredItems.map((item, index) => (
                                            <button
                                                key={item.href}
                                                onClick={() => handleSelect(item.href)}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group text-left",
                                                    index === selectedIndex
                                                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                                                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                                )}
                                            >
                                                <div className={cn(
                                                    "flex-shrink-0 p-1.5 rounded-md",
                                                    index === selectedIndex ? "bg-white/20" : "bg-slate-800"
                                                )}>
                                                    <AppIcon icon={item.icon} className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{item.label}</div>
                                                    <div className={cn(
                                                        "text-[10px] uppercase tracking-wider opacity-70",
                                                        index === selectedIndex ? "text-sky-100" : "text-slate-500"
                                                    )}>
                                                        {item.href}
                                                    </div>
                                                </div>
                                                {index === selectedIndex && (
                                                    <motion.div
                                                        layoutId="active-indicator"
                                                        className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded"
                                                    >
                                                        ENTER
                                                    </motion.div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-[10px] text-slate-500">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-slate-800">↑↓</span> Navegar</span>
                                    <span className="flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-slate-800">ENTER</span> Seleccionar</span>
                                    <span className="flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-slate-800">ESC</span> Cerrar</span>
                                </div>
                                <div className="hidden sm:block">
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
