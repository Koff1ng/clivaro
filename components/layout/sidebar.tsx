'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import {
  NavArrowRight,
  NavArrowDown, // New import
  Box,
  Archive,
  Group,
  KanbanBoard,
  Mail,
  Page,
  Cart as CartIcon,
  Bag,
  Shop,
  Wallet as WalletIcon,
  UserSquare,
  Settings as SettingsIcon,
  LogOut as LogOutIcon,
  ShieldCheck,
  PasteClipboard,
  Truck,
  StatsUpSquare,
  Calculator, // For Accounting/General
  Cash,
  Settings,
  Globe,
  HelpCircle,
} from 'iconoir-react'
import { ChevronsUpDown, Sparkles, LayoutDashboard, Building2, Users, ShieldCheck as LuShieldCheck, ScrollText, CreditCard, Activity, ServerCog, BarChart3, ToggleRight, Headphones, FileText } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { AppIcon } from '@/components/ui/app-icon'
import { useSidebar } from '@/lib/sidebar-context'
import { useTenantPlan } from '@/lib/hooks/use-plan-features'
import { menuGroups, type MenuGroup, type MenuItem } from '@/lib/navigation-data'

// Admin-specific navigation for Super Admin panel — ONLY the 5 strategic modules
const adminMenuGroups = [
  {
    title: 'Dashboard Global',
    key: 'admin-dashboard',
    items: [
      { href: '/admin/dashboard', label: 'KPIs & Analítica', icon: BarChart3 },
    ]
  },
  {
    title: 'Gestión de Inquilinos',
    key: 'admin-tenants',
    items: [
      { href: '/admin/tenants', label: 'Directorio Empresas', icon: Building2 },
    ]
  },
  {
    title: 'Suscripciones y Pagos',
    key: 'admin-subscriptions',
    items: [
      { href: '/admin/subscriptions', label: 'Planes y Cobranza', icon: CreditCard },
    ]
  },
  {
    title: 'Feature Flags',
    key: 'admin-features',
    items: [
      { href: '/admin/feature-flags', label: 'Módulos & Beta', icon: ToggleRight },
    ]
  },
  {
    title: 'Auditoría y Soporte',
    key: 'admin-audit',
    items: [
      { href: '/admin/audit', label: 'Logs & Tickets', icon: Headphones },
    ]
  },
]
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { isOpen, toggle, toggleChat } = useSidebar()
  const userPermissions = (session?.user as any)?.permissions || []
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin || false
  const isOnAdminRoute = isSuperAdmin && pathname?.startsWith('/admin') && !pathname?.startsWith('/admin/login')
  const { hasFeature: hasPlanFeature, isNewFeature, newFeatures, isLoading, planName } = useTenantPlan()
  
  // Custom queries for module visibility
  const { data: restaurantConfig } = useQuery({
    queryKey: ['restaurant-config'],
    queryFn: async () => {
      const res = await fetch('/api/restaurant/config')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 5 * 60 * 1000 // 5 min cache
  })
  
  const [visitedFeatures, setVisitedFeatures] = useState<Record<string, number>>({})

  // Persist scroll position
  useEffect(() => {
    const nav = document.getElementById('sidebar-nav')
    if (nav) {
      const savedScroll = sessionStorage.getItem('sidebar-scroll')
      if (savedScroll) nav.scrollTop = parseInt(savedScroll)
    }
  }, [pathname])

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem('sidebar-scroll', e.currentTarget.scrollTop.toString())
  }

  // State for collapsible groups. Default all open or specific logic.
  // Using a map for open/closed state. Default to true (open).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    general: true,
    marketing: true,
    pos: true,
    inventory: true,
    accounting: true,
    hr: true,
    system: true
  })

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Effect for Visited Features (Persistance) - SAME AS BEFORE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('visited-new-features')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          const visited: Record<string, number> = {}
          Object.keys(parsed).forEach((key) => {
            visited[key] = Date.now()
          })
          setVisitedFeatures(visited)
        } catch (e) { }
      }
    }
  }, [])

  const handleUpgradePlan = () => {
    router.push('/settings?tab=subscription')
  }

  const handleHelp = () => {
    toggleChat()
  }

  const handleFeatureClick = (feature: string) => {
    if (!isNewFeature(feature as any)) return
    const featureKey = feature
    const now = Date.now()

    if (!visitedFeatures[featureKey]) {
      const updated = { ...visitedFeatures, [featureKey]: now }
      setVisitedFeatures(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('visited-new-features', JSON.stringify(updated))
      }
      setTimeout(() => {
        setVisitedFeatures(prev => {
          const newVisited = { ...prev }
          if (typeof window !== 'undefined') {
            localStorage.setItem('visited-new-features', JSON.stringify(newVisited))
          }
          return newVisited
        })
      }, 60 * 1000)
    }
  }

  useEffect(() => {
    if (!pathname || !newFeatures || newFeatures.length === 0) return
    const allItems = menuGroups.flatMap(g => g.items)
    const currentFeature = allItems.find(item => {
      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
      return isActive && item.planFeature && isNewFeature(item.planFeature as any)
    })
    if (currentFeature?.planFeature) {
      handleFeatureClick(currentFeature.planFeature)
    }
  }, [pathname, newFeatures, isNewFeature])

  const shouldShowNewBadge = (feature: string) => {
    if (!isNewFeature(feature as any)) return false
    const visitTime = visitedFeatures[feature]
    if (!visitTime) return true
    const now = Date.now()
    const timeSinceClick = now - visitTime
    return timeSinceClick < 60 * 1000
  }

  // Filter Items Function
  const filterGroupItems = (items: MenuItem[]) => {
    return items.filter(item => {
      let hasPermission = true
      // Super Admin bypass: Always has permission
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
        return hasPlanFeature(item.planFeature as any)
      }

      // Special check for restaurant group
      if ((item.href.startsWith('/restaurant') || item.href === '/pos/commander') && !isSuperAdmin) {
         // Comandero and other restaurant modules should only be visible if Restaurant Mode is explicitly enabled.
         const isRestaurantEnabled = restaurantConfig?.enableRestaurantMode === true
         if (!isRestaurantEnabled) return false

         return true 
      }

      return true
    })
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggle}
        />
      )}

      <aside
        className={cn(
          'fixed md:static top-0 left-0 z-50 h-screen flex flex-col border-r border-slate-800 bg-[#0F172A] text-slate-100 transition-all duration-300 ease-in-out overflow-hidden print:hidden',
          isOpen ? 'w-56 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-16'
        )}
      >
        {isOpen && (
          <div className={cn(
            'flex items-center justify-center border-b border-white/5 px-4 transition-opacity duration-300 opacity-100 h-16 sm:h-16 overflow-hidden'
          )}>
            <Link href={isOnAdminRoute ? '/admin/dashboard' : '/dashboard'} prefetch scroll={false} className="w-full flex items-center justify-center h-full">
              <Logo
                size="lg"
                showByline={false}
                className="!w-32 !h-auto !justify-center"
              />
            </Link>
          </div>
        )}

        <nav
          id="sidebar-nav"
          onScroll={handleScroll}
          className={cn(
            'flex-1 transition-opacity duration-300 overflow-y-auto overflow-x-hidden custom-scrollbar',
            isOpen ? 'opacity-100' : 'opacity-0 md:opacity-100',
            !isOpen && 'scrollbar-hide'
          )}>
          <div className={cn('flex flex-col gap-1', isOpen ? 'p-3' : 'p-1')}>

            {/* SUPER ADMIN MODE: Show admin-specific navigation */}
            {isOnAdminRoute ? (
              <>
                {/* Admin Navigation Groups — same aesthetic as ERP */}
                {adminMenuGroups.map((group, groupIndex) => {
                  const isGroupOpen = openGroups[group.key] !== false

                  return (
                    <div key={group.key} className={cn("mb-2", { 'border-t border-slate-800 pt-2 mt-2': groupIndex > 0 && !isOpen })}>
                      {isOpen && (
                        <div
                          className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                          onClick={() => toggleGroup(group.key)}
                        >
                          <span>{group.title}</span>
                          <NavArrowDown className={cn("w-3 h-3 transition-transform duration-200", !isGroupOpen && "-rotate-90")} />
                        </div>
                      )}
                      <div className={cn(
                        "flex flex-col gap-0.5 transition-all duration-300 ease-in-out overflow-hidden",
                        isOpen && !isGroupOpen ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                      )}>
                        {group.items.map(item => {
                          const Icon = item.icon
                          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

                          return (
                            <Link
                              key={item.href + item.label}
                              href={item.href}
                              prefetch
                              scroll={false}
                              className={cn(
                                'flex rounded-lg font-medium transition-all duration-200 relative group',
                                isOpen ? 'flex-row items-center gap-3 text-[13px] px-2.5 py-1.5 ml-1' : 'flex-col items-center justify-center gap-1 px-1 py-1.5',
                                isActive
                                  ? 'bg-slate-800/80 text-white font-semibold'
                                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                              )}
                              title={!isOpen ? item.label : undefined}
                            >
                              <AppIcon icon={Icon} className={cn("flex-shrink-0 transition-all", isOpen ? "w-[18px] h-[18px]" : "w-5 h-5 mb-0.5")} />
                              <span className={cn(
                                'transition-all duration-200',
                                isOpen ? 'whitespace-nowrap' : 'text-[10px] font-medium tracking-tight w-full truncate text-center px-0.5 opacity-90 block'
                              )}>
                                {item.label}
                              </span>
                              {!isOpen && (
                                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden md:block">
                                  {item.label}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              /* REGULAR ERP NAVIGATION */
              <>
                {menuGroups.map((group, groupIndex) => {
                  const visibleItems = filterGroupItems(group.items)
                  if (visibleItems.length === 0) return null

                  const isGroupOpen = openGroups[group.key]

                  return (
                    <div key={group.key} className={cn("mb-2", { 'border-t border-slate-800 pt-2 mt-2': groupIndex > 0 && !isOpen })}>
                      {/* Group Header - Only visible when Open */}
                      {isOpen && (
                        <div
                          className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                          onClick={() => toggleGroup(group.key)}
                        >
                          <span>{group.title}</span>
                          <NavArrowDown className={cn("w-3 h-3 transition-transform duration-200", !isGroupOpen && "-rotate-90")} />
                        </div>
                      )}

                      {/* Render Items */}
                      <div className={cn(
                        "flex flex-col gap-0.5 transition-all duration-300 ease-in-out overflow-hidden",
                        isOpen && !isGroupOpen ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                      )}>
                        {visibleItems.map(item => {
                          const Icon = item.icon
                          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              prefetch
                              scroll={false}
                              onClick={() => {
                                if (item.planFeature && shouldShowNewBadge(item.planFeature)) {
                                  handleFeatureClick(item.planFeature)
                                }
                              }}
                              className={cn(
                                'flex rounded-lg font-medium transition-all duration-200 relative group',
                                isOpen ? 'flex-row items-center gap-3 text-[13px] px-2.5 py-1.5 ml-1' : 'flex-col items-center justify-center gap-1 px-1 py-1.5',
                                isActive
                                  ? 'bg-slate-800/80 text-white font-semibold'
                                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                              )}
                              title={!isOpen ? item.label : undefined}
                            >
                              <AppIcon icon={Icon} className={cn("flex-shrink-0 transition-all", isOpen ? "w-[18px] h-[18px]" : "w-5 h-5 mb-0.5")} />
                              <span className={cn(
                                'transition-all duration-200',
                                isOpen ? 'flex items-center gap-1.5 whitespace-nowrap' : 'text-[10px] font-medium tracking-tight w-full truncate text-center px-0.5 opacity-90 block'
                              )}>
                                {item.label}
                                {item.planFeature && shouldShowNewBadge(item.planFeature) && isOpen && (
                                  <span className="font-bold text-white bg-green-500 rounded-full animate-pulse px-1 py-0.5 text-[9px]">
                                    NUEVO
                                  </span>
                                )}
                              </span>
                              {item.planFeature && shouldShowNewBadge(item.planFeature) && !isOpen && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 font-bold text-white bg-green-500 rounded-full animate-pulse" />
                              )}
                              {!isOpen && (
                                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden md:block">
                                  {item.label}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                <div className="pt-2 mt-2 border-t border-slate-800">
                  {isOpen && <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Soporte</p>}
                  <button
                    onClick={handleHelp}
                    className={cn(
                      'flex w-full rounded-lg font-medium transition-colors relative group text-left',
                      isOpen ? 'flex-row items-center gap-3 text-sm px-3 py-2 ml-1' : 'flex-col items-center justify-center gap-1 px-1 py-2',
                      'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                    )}
                    title={!isOpen ? 'Ayuda' : undefined}
                  >
                    <HelpCircle className={cn("flex-shrink-0 transition-all", isOpen ? "w-5 h-5" : "w-[22px] h-[22px] mb-0.5")} />
                    <span className={cn(
                      'transition-all duration-300',
                      isOpen ? 'text-sm whitespace-nowrap' : 'text-[10px] font-medium tracking-tight w-full truncate text-center px-0.5 opacity-90 block'
                    )}>
                      Ayuda
                    </span>
                  </button>
                </div>

                {isSuperAdmin && (
                  <div className="pt-2 mt-2 border-t border-slate-800">
                    {isOpen && <p className="px-3 py-2 text-xs font-semibold text-amber-400/80 uppercase tracking-wider">Super Admin</p>}
                    <Link
                      href="/admin/tenants"
                      prefetch
                      scroll={false}
                      className={cn(
                        'flex rounded-lg font-medium transition-colors relative group',
                        isOpen ? 'flex-row items-center gap-3 text-sm px-3 py-2 ml-1' : 'flex-col items-center justify-center gap-1 px-1 py-2',
                        pathname?.startsWith('/admin')
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                      )}
                      title={!isOpen ? 'Panel Admin' : undefined}
                    >
                      <LuShieldCheck className={cn("flex-shrink-0 transition-all", isOpen ? "w-5 h-5" : "w-[22px] h-[22px] mb-0.5")} />
                      <span className={cn(
                        'transition-all duration-300',
                        isOpen ? 'text-sm whitespace-nowrap' : 'text-[10px] font-medium tracking-tight w-full truncate text-center px-0.5 opacity-90 block'
                      )}>
                        Panel Admin
                      </span>
                    </Link>
                  </div>
                )}
              </>
            )}

          </div>
        </nav>

        <div className={cn(
          "border-t border-slate-800 p-2 sm:p-4 mt-auto",
          !isOpen && "flex flex-col items-center"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center w-full gap-3 p-2 rounded-xl transition-all duration-200 outline-none",
                  "hover:bg-slate-800 active:bg-slate-700 active:scale-[0.98]",
                  !isOpen ? "justify-center px-0" : "px-2"
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-9 w-9 border-2 border-slate-700 shadow-lg">
                    {session?.user?.image ? (
                      <AvatarImage src={session.user.image} alt={session.user.name || ''} />
                    ) : null}
                    <AvatarFallback className="bg-[#0EA5E9] text-white font-bold text-sm">
                      {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#0F172A] rounded-full" />
                </div>

                {isOpen && (
                  <>
                    <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                      <span className="text-sm font-semibold text-white truncate w-full tracking-tight">
                        {session?.user?.name?.split(' ')[0]}
                      </span>
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 truncate w-full uppercase tracking-widest opacity-80">
                        {isOnAdminRoute ? <span className="text-amber-400">Super Admin</span> : (planName || 'Plan Gratuito')}
                      </span>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-slate-500 shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side={isOpen ? "right" : "right"}
              align="end"
              sideOffset={isOpen ? 12 : 20}
              className="w-64 p-2 bg-[#0F172A] border-slate-800 text-slate-100 shadow-2xl rounded-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-[#0F172A]/90"
            >
              <div className="px-3 py-3 mb-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <p className="text-xs font-medium text-slate-400 mb-1">CUENTA</p>
                <p className="text-sm font-semibold truncate text-white">{session?.user?.email}</p>
              </div>

              <DropdownMenuSeparator className="bg-slate-800 my-2" />


              <div className="space-y-1">
                <Link href="/settings">
                  <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white transition-colors">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">Configuración</span>
                    <span className="ml-auto text-[10px] text-slate-500 font-mono">Ctrl+,</span>
                  </DropdownMenuItem>
                </Link>

                {!isOnAdminRoute && (
                  <DropdownMenuItem
                    onClick={handleUpgradePlan}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white transition-colors text-sky-400"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Mejorar Plan</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="bg-slate-800 my-1" />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white data-[state=open]:bg-slate-800 transition-colors">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium">Más información</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-56 bg-[#0F172A] border-slate-800 text-slate-100 shadow-2xl rounded-xl p-1.5 ml-2">
                      <Link href="/" target="_blank" rel="noopener noreferrer">
                        <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white transition-colors">
                          <span className="text-sm">Acerca de</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/politica-de-privacidad" target="_blank" rel="noopener noreferrer">
                        <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white transition-colors">
                          <span className="text-sm">Políticas y términos</span>
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem
                        onClick={handleHelp}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white transition-colors"
                      >
                        <span className="text-sm">Ayuda</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator className="bg-slate-800 my-1" />

                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10 text-red-400 font-medium transition-colors"
                >
                  <LogOutIcon className="w-4 h-4" />
                  <span className="text-sm">Cerrar sesión</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  )
}
