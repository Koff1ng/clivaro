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
      className={`fixed top-0 left-0 right-0 z-50 w-full border-b border-blue-500/30 bg-blue-600 shadow-md transition-transform duration-300 ${shouldShow ? 'translate-y-0' : '-translate-y-full'
        }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <div className="flex items-center h-full">
            <Logo size="lg" showByline={false} className="!w-48 md:!w-64 !h-auto !justify-start mt-2 invert brightness-0" />
          </div>
        </Link>

        {/* Desktop Navigation - Centered */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="text-sm font-semibold text-blue-50 hover:text-white transition-colors relative group"
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
            className="text-sm font-medium text-blue-100 hover:text-white transition-colors"
          >
            Iniciar Sesión
          </Link>
          <Button
            onClick={onContactClick}
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg shadow-blue-800/20 border-none"
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
            className="p-2 text-blue-100 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-blue-500/30 bg-blue-600">
          <div className="container mx-auto px-6 py-4 space-y-3">
            {navItems.filter(item => item.label !== 'Vista Previa').map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="block w-full text-left text-sm font-medium text-blue-50 hover:text-white transition-colors py-2 font-semibold"
              >
                {item.label}
              </button>
            ))}
            <Link
              href="/login"
              className="block text-sm font-medium text-blue-100 hover:text-white transition-colors py-2 font-semibold"
              onClick={() => setMobileMenuOpen(false)}
            >
              Iniciar Sesión
            </Link>
            <Button
              onClick={() => {
                onContactClick()
                setMobileMenuOpen(false)
              }}
              className="w-full mt-2 bg-white text-blue-600 hover:bg-blue-50 font-bold border-none"
            >
              Contactar
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

