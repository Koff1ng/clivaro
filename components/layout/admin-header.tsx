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
    <header className="sticky top-0 z-40 w-full border-b border-[#e5e5e5] bg-white print:hidden">
      <div className="flex h-12 sm:h-14 items-center justify-between px-3 sm:px-4 md:px-5">
        {/* Left: Sidebar toggle + Badge */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8 sm:h-9 sm:w-9 text-[#6e6e80] hover:bg-[#f7f7f8] hover:text-[#0d0d0d]"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {/* Super Admin Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#10a37f]/10 border border-[#10a37f]/30">
            <Shield className="h-3.5 w-3.5 text-[#10a37f]" />
            <span className="text-xs font-semibold text-[#10a37f] uppercase tracking-wider">
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
              className="h-8 gap-1.5 text-[#6e6e80] hover:bg-[#f7f7f8] hover:text-[#0d0d0d] text-xs hidden sm:flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al ERP
            </Button>
          </Link>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#f7f7f8] transition-all outline-none">
                <Avatar className="h-7 w-7 border border-[#e5e5e5]">
                  {session?.user?.image ? (
                    <AvatarImage src={session.user.image} alt={session.user.name || ''} />
                  ) : null}
                  <AvatarFallback className="bg-[#10a37f]/10 text-[#10a37f] font-bold text-xs">
                    {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs font-semibold text-[#0d0d0d] leading-none">
                    {session?.user?.name?.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-[#10a37f] leading-none mt-0.5">Super Admin</span>
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 bg-white border-[#e5e5e5] text-[#0d0d0d] shadow-lg rounded-xl"
            >
              <DropdownMenuLabel className="text-xs text-[#6e6e80] font-normal px-3 py-2">
                {session?.user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#e5e5e5]" />
              <Link href="/dashboard">
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#f7f7f8] focus:bg-[#f7f7f8] text-sm rounded-lg">
                  <ArrowLeft className="h-4 w-4 text-[#6e6e80]" />
                  Volver al ERP
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator className="bg-[#e5e5e5]" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-red-50 focus:bg-red-50 text-red-600 font-medium text-sm rounded-lg"
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
