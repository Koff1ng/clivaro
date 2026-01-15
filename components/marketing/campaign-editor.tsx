'use client'

import { useState } from 'react'
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  List, 
  Link as LinkIcon,
  Image,
  Type,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Smile
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CampaignEditorProps {
  value: string
  onChange: (value: string) => void
}

const templates = [
  {
    name: 'Promoción Simple',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1e40af; text-align: center;">¡Oferta Especial!</h1>
        <p style="font-size: 18px; line-height: 1.6;">Hola {{name}},</p>
        <p style="font-size: 16px; line-height: 1.6;">Tenemos una oferta increíble para ti. No te la pierdas.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background-color: #1e40af; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Oferta</a>
        </div>
        <p style="font-size: 14px; color: #666;">Gracias por confiar en nosotros.</p>
      </div>
    `
  },
  {
    name: 'Newsletter',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <h1 style="color: #1e40af; text-align: center; margin-bottom: 30px;">Newsletter</h1>
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Novedades de esta semana</h2>
          <p style="line-height: 1.6;">Hola {{name}},</p>
          <p style="line-height: 1.6;">Te compartimos las últimas novedades y ofertas especiales.</p>
        </div>
        <p style="text-align: center; color: #666; font-size: 12px;">© 2026 Clivaro by Clientum Studio</p>
      </div>
    `
  },
  {
    name: 'Anuncio de Producto',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1e40af; text-align: center;">Nuevo Producto</h1>
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Descubre nuestro nuevo producto</h2>
          <p style="line-height: 1.6;">Hola {{name}},</p>
          <p style="line-height: 1.6;">Estamos emocionados de presentarte nuestro nuevo producto. ¡No te lo pierdas!</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="#" style="background-color: #1e40af; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Producto</a>
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Recordatorio',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Recordatorio Importante</h2>
        <p style="font-size: 16px; line-height: 1.6;">Hola {{name}},</p>
        <p style="font-size: 16px; line-height: 1.6;">Este es un recordatorio sobre tu pedido o cita pendiente.</p>
        <p style="font-size: 14px; color: #666; margin-top: 30px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
      </div>
    `
  }
]

export default function CampaignEditor({ value, onChange }: CampaignEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#1e40af')

  const colors = [
    '#1e40af', '#059669', '#dc2626', '#ea580c', '#7c3aed', 
    '#db2777', '#0891b2', '#65a30d', '#ca8a04', '#991b1b'
  ]

  const insertAtCursor = (before: string, after: string = '') => {
    const textarea = document.getElementById('htmlContent') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const newValue = 
      value.substring(0, start) + 
      before + selectedText + after + 
      value.substring(end)
    
    onChange(newValue)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      )
    }, 0)
  }

  const insertBlock = (html: string) => {
    const newValue = value + '\n\n' + html
    onChange(newValue)
  }

  const applyTemplate = (templateHtml: string) => {
    onChange(templateHtml.trim())
    setShowTemplates(false)
  }

  const formatButtons = [
    { icon: Bold, label: 'Negrita', action: () => insertAtCursor('<strong>', '</strong>') },
    { icon: Italic, label: 'Cursiva', action: () => insertAtCursor('<em>', '</em>') },
    { icon: Underline, label: 'Subrayado', action: () => insertAtCursor('<u>', '</u>') },
    { icon: Heading1, label: 'Título Grande', action: () => insertAtCursor('<h1 style="color: #1e40af; font-size: 28px;">', '</h1>') },
    { icon: Heading2, label: 'Título Mediano', action: () => insertAtCursor('<h2 style="color: #1e40af; font-size: 24px;">', '</h2>') },
    { icon: Type, label: 'Párrafo', action: () => insertAtCursor('<p style="line-height: 1.6; font-size: 16px;">', '</p>') },
  ]

  const blockButtons = [
    {
      label: 'Botón',
      action: () => insertBlock(`
        <div style="text-align: center; margin: 20px 0;">
          <a href="#" style="background-color: ${selectedColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Haz clic aquí</a>
        </div>
      `)
    },
    {
      label: 'Divisor',
      action: () => insertBlock('<hr style="border: none; border-top: 2px solid #e5e7eb; margin: 30px 0;">')
    },
    {
      label: 'Lista',
      action: () => insertBlock(`
        <ul style="line-height: 1.8;">
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      `)
    },
    {
      label: 'Caja Destacada',
      action: () => insertBlock(`
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid ${selectedColor}; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; line-height: 1.6;">Contenido destacado aquí</p>
        </div>
      `)
    },
    {
      label: 'Saludo Personalizado',
      action: () => insertBlock('<p style="font-size: 18px; line-height: 1.6;">Hola {{name}},</p>')
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2 border-r pr-2">
          <span className="text-sm font-medium text-gray-700">Formato:</span>
          {formatButtons.map((btn, idx) => {
            const Icon = btn.icon
            return (
              <Button
                key={idx}
                type="button"
                variant="outline"
                size="sm"
                onClick={btn.action}
                title={btn.label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 border-r pr-2">
          <span className="text-sm font-medium text-gray-700">Elementos:</span>
          {blockButtons.map((btn, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              size="sm"
              onClick={btn.action}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <Palette className="h-4 w-4 mr-2" />
            Plantillas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <Palette className="h-4 w-4 mr-2" />
            Color
          </Button>
        </div>
      </div>

      {showTemplates && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plantillas Predefinidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="outline"
                  onClick={() => applyTemplate(template.html)}
                  className="justify-start"
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showColorPicker && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Seleccionar Color</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedColor(color)
                    setShowColorPicker(false)
                  }}
                  className={`w-10 h-10 rounded border-2 ${
                    selectedColor === color ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Color seleccionado: {selectedColor}
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <Label htmlFor="htmlContent">Contenido del Email</Label>
        <Textarea
          id="htmlContent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu mensaje aquí o usa las plantillas y botones de arriba..."
          className="font-mono text-sm min-h-[400px]"
        />
        <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
          <p className="font-medium text-blue-900 mb-1">💡 Consejos:</p>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Usa <code className="bg-blue-100 px-1 rounded">{'{{name}}'}</code> para personalizar con el nombre del cliente</li>
            <li>Usa <code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code> para incluir el email del cliente</li>
            <li>Haz clic en los botones de arriba para agregar elementos sin escribir HTML</li>
            <li>Usa las plantillas como punto de partida</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

