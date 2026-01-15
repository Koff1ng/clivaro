'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Loader2, Mail, Building2, User, Phone, MessageSquare, Sparkles } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { SuccessAnimation } from './success-animation'

interface ContactFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planName?: string
}

export function ContactForm({ open, onOpenChange, planName }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    plan: planName || '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const { toast } = useToast()

  // Update plan when planName changes
  useEffect(() => {
    if (planName) {
      setFormData(prev => ({
        ...prev,
        plan: planName,
      }))
    }
  }, [planName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar el formulario')
      }

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        plan: planName || '',
        message: '',
      })
      
      // Close dialog and show success animation
      onOpenChange(false)
      setTimeout(() => {
        setShowSuccess(true)
      }, 300)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Por favor, intenta nuevamente.'
      toast(`Error al enviar el formulario: ${detail}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Comienza tu Prueba Gratis
                </DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Completa el formulario y nos pondremos en contacto contigo
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-blue-600" />
                  Nombre completo *
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Juan Pérez"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="h-11 transition-all focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Correo electrónico *
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="juan@ejemplo.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="h-11 transition-all focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-blue-600" />
                  Teléfono *
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+57 300 123 4567"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="h-11 transition-all focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Empresa
                </Label>
                <Input
                  id="company"
                  name="company"
                  type="text"
                  placeholder="Mi Empresa S.A.S"
                  value={formData.company}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="h-11 transition-all focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {planName && (
              <div className="space-y-2">
                <Label htmlFor="plan" className="flex items-center gap-2 text-sm font-medium">
                  Plan seleccionado
                </Label>
                <Input
                  id="plan"
                  name="plan"
                  type="text"
                  value={planName}
                  disabled
                  className="h-11 bg-gray-50 dark:bg-gray-800"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message" className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                Mensaje adicional
              </Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Cuéntanos sobre tu negocio y tus necesidades..."
                value={formData.message}
                onChange={handleChange}
                disabled={isSubmitting}
                rows={4}
                className="resize-none transition-all focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Enviar Solicitud
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-12"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isSubmitting && <LoadingOverlay message="Enviando tu solicitud..." />}
      
      {/* Success Animation */}
      {showSuccess && (
        <SuccessAnimation
          onClose={() => {
            setShowSuccess(false)
          }}
        />
      )}
    </>
  )
}

