'use client'

import { useSession, signOut } from 'next-auth/react'
import { useSidebar } from '@/lib/sidebar-context'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function AdminHeader() {
  const { toggle } = useSidebar()
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-amber-900/30 bg-[#0F172A]/95 backdrop-blur-xl print:hidden shadow-lg shadow-black/20">
      <div className="flex h-12 sm:h-14 items-center justify-between px-3 sm:px-4 md:px-5">
        {/* Left: Sidebar toggle + Badge */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8 sm:h-9 sm:w-9 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {/* Super Admin Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Super Admin
            </span>
          </div>
        </div>

        {/* Right: Back to ERP + User */}
        <div className="flex items-center gap-2">
          {/* Back to ERP App */}
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-xs hidden sm:flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al ERP
            </Button>
          </Link>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 transition-all outline-none">
                <Avatar className="h-7 w-7 border-2 border-slate-700">
                  {session?.user?.image ? (
                    <AvatarImage src={session.user.image} alt={session.user.name || ''} />
                  ) : null}
                  <AvatarFallback className="bg-amber-500/20 text-amber-400 font-bold text-xs">
                    {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs font-semibold text-slate-200 leading-none">
                    {session?.user?.name?.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-amber-400/80 leading-none mt-0.5">Super Admin</span>
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 bg-[#0F172A] border-slate-800 text-slate-100 shadow-2xl rounded-xl"
            >
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal px-3 py-2">
                {session?.user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              <Link href="/dashboard">
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white text-sm rounded-lg">
                  <ArrowLeft className="h-4 w-4 text-slate-400" />
                  Volver al ERP
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10 text-red-400 font-medium text-sm rounded-lg"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
