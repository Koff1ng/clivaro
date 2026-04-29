'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  List, 
  Link as LinkIcon,
  Type,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Plus,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface VisualEditorProps {
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
          <a href="#" style="background-color: #1e40af; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Ver Oferta</a>
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

const colors = [
  '#1e40af', '#059669', '#dc2626', '#ea580c', '#7c3aed', 
  '#db2777', '#0891b2', '#65a30d', '#ca8a04', '#991b1b'
]

export default function VisualEditor({ value, onChange }: VisualEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#1e40af')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current && value) {
      editorRef.current.innerHTML = value
    }
  }, [])

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    updateContent()
  }

  const updateContent = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const insertElement = (html: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      const fragment = document.createDocumentFragment()
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild)
      }
      
      range.insertNode(fragment)
      updateContent()
    } else if (editorRef.current) {
      editorRef.current.innerHTML += html
      updateContent()
    }
  }

  const applyTemplate = (templateHtml: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = templateHtml.trim()
      updateContent()
    }
    setShowTemplates(false)
  }

  const insertButton = () => {
    const url = prompt('URL del botón (deja vacío para #):', '#')
    const text = prompt('Texto del botón:', 'Haz clic aquí')
    insertElement(`
      <div style="text-align: center; margin: 20px 0;">
        <a href="${url || '#'}" style="background-color: ${selectedColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${text}</a>
      </div>
    `)
  }

  const insertDivider = () => {
    insertElement('<hr style="border: none; border-top: 2px solid #e5e7eb; margin: 30px 0;">')
  }

  const insertList = () => {
    insertElement(`
      <ul style="line-height: 1.8; padding-left: 20px;">
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `)
  }

  const insertHighlightBox = () => {
    insertElement(`
      <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid ${selectedColor}; margin: 20px 0;">
        <p style="margin: 0; font-size: 16px; line-height: 1.6;">Contenido destacado aquí</p>
      </div>
    `)
  }

  const insertGreeting = () => {
    insertElement('<p style="font-size: 18px; line-height: 1.6;">Hola {{name}},</p>')
  }

  const formatButtons = [
    { icon: Bold, label: 'Negrita', command: 'bold' },
    { icon: Italic, label: 'Cursiva', command: 'italic' },
    { icon: Underline, label: 'Subrayado', command: 'underline' },
    { icon: Heading1, label: 'Título Grande', action: () => {
      const text = prompt('Texto del título:', 'Título')
      if (text) {
        insertElement(`<h1 style="color: ${selectedColor}; font-size: 28px; margin: 20px 0;">${text}</h1>`)
      }
    }},
    { icon: Heading2, label: 'Título Mediano', action: () => {
      const text = prompt('Texto del título:', 'Subtítulo')
      if (text) {
        insertElement(`<h2 style="color: ${selectedColor}; font-size: 24px; margin: 20px 0;">${text}</h2>`)
      }
    }},
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
                onClick={() => btn.command ? execCommand(btn.command) : btn.action?.()}
                title={btn.label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 border-r pr-2">
          <span className="text-sm font-medium text-gray-700">Insertar:</span>
          <Button type="button" variant="outline" size="sm" onClick={insertButton}>
            Botón
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={insertDivider}>
            Divisor
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={insertList}>
            Lista
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={insertHighlightBox}>
            Caja
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={insertGreeting}>
            Saludo
          </Button>
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
            <p className="text-xs text-gray-500 mt-3">
              ⚠️ Aplicar una plantilla reemplazará todo el contenido actual
            </p>
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
              Color seleccionado: {selectedColor} (se aplicará a nuevos elementos)
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <Label>Editor Visual - Edita directamente aquí</Label>
        <div
          ref={editorRef}
          contentEditable
          onInput={updateContent}
          onBlur={updateContent}
          className="border rounded-lg p-6 bg-white min-h-[500px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            fontFamily: 'Arial, sans-serif',
            maxWidth: '600px',
            margin: '0 auto',
          }}
          suppressContentEditableWarning
        />
        <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
          <p className="font-medium text-blue-900 mb-1">💡 Consejos:</p>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Escribe directamente en el editor como si fuera un documento</li>
            <li>Selecciona texto y usa los botones de formato (negrita, cursiva, etc.)</li>
            <li>Usa <code className="bg-blue-100 px-1 rounded">{'{{name}}'}</code> para personalizar con el nombre del cliente</li>
            <li>Usa <code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code> para incluir el email del cliente</li>
            <li>Haz clic en "Plantillas" para empezar con un diseño predefinido</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

