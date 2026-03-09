'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface SidebarContextType {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
  isChatOpen: boolean
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Cargar estado desde localStorage al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-open')
    const savedChat = sessionStorage.getItem('clivaro-chat-is-open')
    if (saved !== null) {
      setIsOpen(saved === 'true')
    }
    if (savedChat === 'true') {
      setIsChatOpen(true)
    }
  }, [])

  // Guardar estado en localStorage cuando cambia
  useEffect(() => {
    localStorage.setItem('sidebar-open', String(isOpen))
  }, [isOpen])

  useEffect(() => {
    sessionStorage.setItem('clivaro-chat-is-open', String(isChatOpen))
  }, [isChatOpen])

  const toggle = () => setIsOpen(prev => !prev)
  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggleChat = () => setIsChatOpen(prev => !prev)
  const setChatOpen = (open: boolean) => setIsChatOpen(open)

  return (
    <SidebarContext.Provider value={{
      isOpen, toggle, open, close,
      isChatOpen, toggleChat, setChatOpen
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

