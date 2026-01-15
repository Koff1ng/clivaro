'use client'

import { useState, useEffect } from 'react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

interface ScrollNavbarProps {
  onContactClick: () => void
}

export function ScrollNavbar({ onContactClick }: ScrollNavbarProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Only run on client side
    if (typeof window === 'undefined') return

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Show navbar when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // During SSR, always show navbar
  const shouldShow = mounted ? isVisible : true

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 80 // Navbar height
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
    setMobileMenuOpen(false)
  }

  const navItems = [
    { label: 'Planes', action: () => scrollToSection('pricing') },
    { label: 'Vista Previa', action: () => scrollToSection('preview') },
    { label: 'Comparación', action: () => scrollToSection('comparison') },
    { label: 'Características', action: () => scrollToSection('features') },
    { label: 'FAQ', action: () => scrollToSection('faq') },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-200/50 dark:border-gray-800/50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/80 shadow-sm transition-transform duration-300 ${
        shouldShow ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="container mx-auto px-6 py-2 flex items-center justify-between h-16">
        <Link href="/login" className="flex items-center hover:opacity-80 transition-opacity h-full flex-shrink-0">
          <div className="flex items-center" style={{ 
            height: '100%',
            maxHeight: '64px',
            overflow: 'visible'
          }}>
            <div style={{ 
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              transform: 'scale(1.1)',
              transformOrigin: 'left center',
              marginLeft: '-4px',
              padding: 0,
              marginTop: 0,
              marginBottom: 0
            }}>
              <Logo size="md" showByline={false} />
            </div>
          </div>
        </Link>
        
        {/* Desktop Navigation - Centered */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="text-sm font-semibold text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors relative group"
            >
              {item.label}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:w-full transition-all duration-300"></span>
            </button>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Iniciar Sesión
          </Link>
          <Button
            onClick={onContactClick}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/50"
          >
            Contactar
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            onClick={onContactClick}
            size="sm"
            className="hidden sm:inline-flex"
          >
            Contactar
          </Button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-white dark:bg-gray-900">
          <div className="container mx-auto px-6 py-4 space-y-3">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="block w-full text-left text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors py-2"
              >
                {item.label}
              </button>
            ))}
            <Link
              href="/login"
              className="block text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Iniciar Sesión
            </Link>
            <Button
              onClick={() => {
                onContactClick()
                setMobileMenuOpen(false)
              }}
              className="w-full mt-2"
            >
              Contactar
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

