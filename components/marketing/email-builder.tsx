'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Trash2, MoveUp, MoveDown, Type, Image as ImageIcon,
  Square, Minus, MousePointer2, Link2, Copy, Palette, Bold,
  Italic, AlignLeft, AlignCenter, AlignRight, Share2, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

// ── Types ──
export type BlockType = 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'social' | 'two-column'

export interface EmailBlock {
  id: string
  type: BlockType
  content: string
  href?: string
  src?: string
  alt?: string
  style: {
    backgroundColor?: string
    color?: string
    fontSize?: string
    fontWeight?: string
    fontStyle?: string
    textAlign?: string
    padding?: string
    borderRadius?: string
    height?: string
    // Two column
    leftContent?: string
    rightContent?: string
  }
}

interface EmailBuilderProps {
  value: string // HTML string
  onChange: (html: string) => void
}

// ── Palette ──
const COLORS = [
  '#1e40af', '#2563eb', '#3b82f6',
  '#059669', '#10b981', '#34d399',
  '#dc2626', '#ef4444', '#f87171',
  '#7c3aed', '#8b5cf6', '#a78bfa',
  '#ea580c', '#f97316', '#fb923c',
  '#111827', '#374151', '#6b7280',
  '#ffffff', '#f3f4f6', '#e5e7eb',
]

// ── Helpers ──
const uid = () => `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

function defaultBlock(type: BlockType): EmailBlock {
  const id = uid()
  switch (type) {
    case 'header':
      return { id, type, content: 'Tu título aquí', style: { fontSize: '28px', fontWeight: '700', color: '#111827', textAlign: 'center', padding: '24px 20px', backgroundColor: '#ffffff' } }
    case 'text':
      return { id, type, content: 'Hola {{name}}, escribe tu contenido aquí. Puedes personalizar el texto y darle estilo.', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '12px 20px' } }
    case 'image':
      return { id, type, content: '', src: '', alt: 'Imagen', style: { padding: '12px 20px', textAlign: 'center' } }
    case 'button':
      return { id, type, content: 'Ver más', href: 'https://tusitio.com', style: { backgroundColor: '#2563eb', color: '#ffffff', fontSize: '15px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '8px' } }
    case 'divider':
      return { id, type, content: '', style: { padding: '8px 20px' } }
    case 'spacer':
      return { id, type, content: '', style: { height: '24px' } }
    case 'social':
      return { id, type, content: 'facebook,instagram,whatsapp', style: { textAlign: 'center', padding: '16px 20px' } }
    case 'two-column':
      return { id, type, content: '', style: { padding: '12px 20px', leftContent: 'Columna izquierda', rightContent: 'Columna derecha' } }
    default:
      return { id, type: 'text', content: '', style: {} }
  }
}

// ── Block to HTML ──
function blockToHtml(block: EmailBlock): string {
  const pad = block.style.padding || '12px 20px'

  switch (block.type) {
    case 'header':
      return `<tr><td style="padding:${pad};background-color:${block.style.backgroundColor || '#ffffff'};font-family:Arial,sans-serif;">
        <h1 style="margin:0;font-size:${block.style.fontSize || '28px'};font-weight:${block.style.fontWeight || '700'};color:${block.style.color || '#111827'};text-align:${block.style.textAlign || 'center'};font-style:${block.style.fontStyle || 'normal'};">${block.content}</h1>
      </td></tr>`

    case 'text':
      return `<tr><td style="padding:${pad};font-family:Arial,sans-serif;">
        <p style="margin:0;font-size:${block.style.fontSize || '15px'};color:${block.style.color || '#374151'};text-align:${block.style.textAlign || 'left'};line-height:1.6;font-weight:${block.style.fontWeight || '400'};font-style:${block.style.fontStyle || 'normal'};">${block.content}</p>
      </td></tr>`

    case 'image':
      if (!block.src) {
        return `<tr><td style="padding:${pad};text-align:${block.style.textAlign || 'center'};font-family:Arial,sans-serif;">
          <div style="background:#f3f4f6;border:2px dashed #d1d5db;border-radius:12px;padding:40px 20px;color:#9ca3af;font-size:13px;">📷 Haz clic para agregar imagen</div>
        </td></tr>`
      }
      return `<tr><td style="padding:${pad};text-align:${block.style.textAlign || 'center'};font-family:Arial,sans-serif;">
        <img src="${block.src}" alt="${block.alt || 'Imagen'}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;" />
      </td></tr>`

    case 'button':
      return `<tr><td style="padding:${pad};text-align:center;font-family:Arial,sans-serif;">
        <a href="${block.href || '#'}" style="display:inline-block;background-color:${block.style.backgroundColor || '#2563eb'};color:${block.style.color || '#ffffff'};text-decoration:none;padding:14px 32px;border-radius:${block.style.borderRadius || '8px'};font-size:${block.style.fontSize || '15px'};font-weight:${block.style.fontWeight || '700'};font-family:Arial,sans-serif;">${block.content}</a>
      </td></tr>`

    case 'divider':
      return `<tr><td style="padding:${pad};font-family:Arial,sans-serif;">
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
      </td></tr>`

    case 'spacer':
      return `<tr><td style="height:${block.style.height || '24px'};font-size:1px;line-height:1px;">&nbsp;</td></tr>`

    case 'social': {
      const networks = (block.content || '').split(',').map(s => s.trim()).filter(Boolean)
      const icons = networks.map(n => {
        const colors: Record<string, string> = { facebook: '#1877F2', instagram: '#E4405F', whatsapp: '#25D366', twitter: '#1DA1F2', linkedin: '#0A66C2', youtube: '#FF0000', tiktok: '#000000' }
        const color = colors[n] || '#6b7280'
        return `<a href="#" style="display:inline-block;width:36px;height:36px;background-color:${color};border-radius:50%;margin:0 6px;text-align:center;line-height:36px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif;">${n.charAt(0).toUpperCase()}</a>`
      }).join('')
      return `<tr><td style="padding:${pad};text-align:${block.style.textAlign || 'center'};font-family:Arial,sans-serif;">${icons}</td></tr>`
    }

    case 'two-column':
      return `<tr><td style="padding:${pad};font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="48%" valign="top" style="padding:8px;font-size:14px;color:#374151;">${block.style.leftContent || ''}</td>
          <td width="4%"></td>
          <td width="48%" valign="top" style="padding:8px;font-size:14px;color:#374151;">${block.style.rightContent || ''}</td>
        </tr></table>
      </td></tr>`

    default:
      return ''
  }
}

function blocksToFullHtml(blocks: EmailBlock[]): string {
  const rows = blocks.map(blockToHtml).join('\n')
  return `<div style="font-family:Arial,sans-serif;padding:0;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${rows}
    <tr><td style="padding:16px 20px;text-align:center;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">
      Enviado con <a href="https://www.clientumstudio.com" style="color:#6366f1;text-decoration:none;font-weight:600;">Clivaro</a> · Si no deseas recibir estos correos, ignora este mensaje.
    </td></tr>
  </table>
</div>`
}

// ── Parse HTML back to blocks (best effort) ──
function htmlToBlocks(html: string): EmailBlock[] | null {
  if (!html || !html.includes('<')) return null
  
  // Must look like email HTML
  if (!html.includes('<t') && !html.includes('<div')) return null
  
  try {
    // Use a temporary DOM parser
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null
    if (!parser) return null
    
    const doc = parser.parseFromString(html, 'text/html')
    const blocks: EmailBlock[] = []
    
    // Find all table rows or top-level elements
    const rows = doc.querySelectorAll('tr')
    const processedElements = new Set<Element>()
    
    if (rows.length > 0) {
      rows.forEach(row => {
        const td = row.querySelector('td') as HTMLElement | null
        if (!td || processedElements.has(row)) return
        processedElements.add(row)
        
        const innerHtml = td.innerHTML.trim()
        const textContent = td.textContent?.trim() || ''
        
        // Skip empty or footer rows
        if (!textContent && !td.querySelector('img')) return
        if (innerHtml.includes('Clivaro') && textContent.length < 200) return
        
        // Detect H1/H2 → header block
        const heading = td.querySelector('h1, h2') as HTMLElement | null
        if (heading) {
          const bgColor = td.style.backgroundColor || '#ffffff'
          blocks.push({
            id: uid(), type: 'header',
            content: heading.textContent || 'Título',
            style: {
              fontSize: heading.tagName === 'H1' ? '28px' : '22px',
              fontWeight: '700',
              color: heading.style.color || '#111827',
              textAlign: (heading.style.textAlign as any) || 'center',
              padding: td.style.padding || '24px 20px',
              backgroundColor: bgColor,
            }
          })
          return
        }
        
        // Detect IMG → image block
        const img = td.querySelector('img')
        if (img && (!textContent || textContent.length < 20)) {
          blocks.push({
            id: uid(), type: 'image', content: '',
            src: img.getAttribute('src') || '',
            alt: img.getAttribute('alt') || 'Imagen',
            style: { padding: td.style.padding || '12px 20px', textAlign: 'center' }
          })
          return
        }
        
        // Detect A with button-like style → button block
        const link = td.querySelector('a[style*="background"]')
        if (link && link.textContent && !link.closest('table table')) {
          const linkStyle = (link as HTMLElement).style
          blocks.push({
            id: uid(), type: 'button',
            content: link.textContent.trim(),
            href: link.getAttribute('href') || '#',
            style: {
              backgroundColor: linkStyle.backgroundColor || '#2563eb',
              color: linkStyle.color || '#ffffff',
              fontSize: linkStyle.fontSize || '15px',
              fontWeight: '700',
              textAlign: 'center',
              padding: '12px 20px',
              borderRadius: linkStyle.borderRadius || '8px',
            }
          })
          return
        }
        
        // Detect HR → divider block
        if (td.querySelector('hr')) {
          blocks.push({
            id: uid(), type: 'divider', content: '',
            style: { padding: td.style.padding || '8px 20px' }
          })
          return
        }
        
        // Detect social links (multiple <a> with short text)
        const links = td.querySelectorAll('a')
        if (links.length >= 2 && textContent.length < 50) {
          const networks = Array.from(links).map(a => {
            const t = a.textContent?.toLowerCase().trim() || ''
            if (t.startsWith('f')) return 'facebook'
            if (t.startsWith('i')) return 'instagram'
            if (t.startsWith('w')) return 'whatsapp'
            if (t.startsWith('t')) return 'twitter'
            if (t.startsWith('l')) return 'linkedin'
            return t
          }).filter(Boolean)
          if (networks.length >= 2) {
            blocks.push({
              id: uid(), type: 'social',
              content: networks.join(','),
              style: { textAlign: 'center', padding: '16px 20px' }
            })
            return
          }
        }
        
        // Detect nested table → two-column
        const innerTable = td.querySelector('table')
        if (innerTable) {
          const cols = innerTable.querySelectorAll('td')
          if (cols.length >= 2) {
            blocks.push({
              id: uid(), type: 'two-column', content: '',
              style: {
                padding: td.style.padding || '12px 20px',
                leftContent: cols[0].innerHTML.trim(),
                rightContent: cols[cols.length > 2 ? 2 : 1].innerHTML.trim(),
              }
            })
            return
          }
        }
        
        // Default → text block (with P tag or raw text)
        const p = td.querySelector('p') as HTMLElement | null
        const content = p ? p.innerHTML.trim() : innerHtml
        if (content && content.length > 0) {
          const bgColor = td.style.backgroundColor || ''
          blocks.push({
            id: uid(), type: 'text',
            content: content,
            style: {
              fontSize: p?.style.fontSize || '15px',
              color: p?.style.color || '#374151',
              textAlign: (p?.style.textAlign as any) || 'left',
              padding: td.style.padding || '12px 20px',
              ...(bgColor ? { backgroundColor: bgColor } : {}),
            }
          })
        }
      })
    }
    
    return blocks.length > 0 ? blocks : null
  } catch {
    return null
  }
}

// ── BLOCK TYPES CONFIG ──
const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'header', label: 'Título', icon: <Type className="w-4 h-4" />, desc: 'Encabezado grande' },
  { type: 'text', label: 'Texto', icon: <AlignLeft className="w-4 h-4" />, desc: 'Párrafo de texto' },
  { type: 'image', label: 'Imagen', icon: <ImageIcon className="w-4 h-4" />, desc: 'Foto o banner' },
  { type: 'button', label: 'Botón', icon: <MousePointer2 className="w-4 h-4" />, desc: 'Llamada a acción' },
  { type: 'divider', label: 'Línea', icon: <Minus className="w-4 h-4" />, desc: 'Separador' },
  { type: 'spacer', label: 'Espacio', icon: <Square className="w-4 h-4" />, desc: 'Espaciado vertical' },
  { type: 'social', label: 'Redes', icon: <Share2 className="w-4 h-4" />, desc: 'Iconos sociales' },
  { type: 'two-column', label: '2 Columnas', icon: <Copy className="w-4 h-4" />, desc: 'Contenido lado a lado' },
]

// ── Component ──
export default function EmailBuilder({ value, onChange }: EmailBuilderProps) {
  const { toast } = useToast()
  const [isRawMode, setIsRawMode] = useState(false)
  const [rawHtml, setRawHtml] = useState(value || '')
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    const parsed = htmlToBlocks(value)
    if (!parsed || (parsed.length <= 1 && value && value.length > 200)) {
      // AI-generated HTML that couldn't be well decomposed — start in raw mode
      if (value && value.includes('<')) {
        setIsRawMode(true)
        setRawHtml(value)
        return []
      }
    }
    return parsed || []
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadBlockIdRef = useRef<string | null>(null)

  // Sync blocks → HTML
  const syncHtml = useCallback((newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks)
    if (newBlocks.length > 0) {
      onChange(blocksToFullHtml(newBlocks))
    }
  }, [onChange])

  const addBlock = useCallback((type: BlockType) => {
    const block = defaultBlock(type)
    const newBlocks = [...blocks, block]
    syncHtml(newBlocks)
    setSelectedId(block.id)
    setShowAddMenu(false)
  }, [blocks, syncHtml])

  const removeBlock = useCallback((id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id)
    syncHtml(newBlocks)
    if (selectedId === id) setSelectedId(null)
  }, [blocks, selectedId, syncHtml])

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx < 0) return
    const ni = idx + dir
    if (ni < 0 || ni >= blocks.length) return
    const copy = [...blocks]
    ;[copy[idx], copy[ni]] = [copy[ni], copy[idx]]
    syncHtml(copy)
  }, [blocks, syncHtml])

  const updateBlock = useCallback((id: string, updates: Partial<EmailBlock>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b)
    syncHtml(newBlocks)
  }, [blocks, syncHtml])

  const updateBlockStyle = useCallback((id: string, styleUpdates: Partial<EmailBlock['style']>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, style: { ...b.style, ...styleUpdates } } : b)
    syncHtml(newBlocks)
  }, [blocks, syncHtml])

  const duplicateBlock = useCallback((id: string) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return
    const idx = blocks.findIndex(b => b.id === id)
    const copy = { ...block, id: uid(), style: { ...block.style } }
    const newBlocks = [...blocks]
    newBlocks.splice(idx + 1, 0, copy)
    syncHtml(newBlocks)
    setSelectedId(copy.id)
  }, [blocks, syncHtml])

  // Apply template as blocks
  const applyTemplate = useCallback((templateBlocks: EmailBlock[]) => {
    syncHtml(templateBlocks)
    setSelectedId(null)
  }, [syncHtml])

  // Image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Selecciona una imagen válida', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Máximo 5MB', 'error'); return }

    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/marketing/upload-image', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al subir')
      const data = await res.json()
      const blockId = uploadBlockIdRef.current
      if (blockId) {
        updateBlock(blockId, { src: data.url })
        toast('Imagen subida', 'success')
      }
    } catch (err: any) {
      toast(err.message || 'Error', 'error')
    }
    e.target.value = ''
  }, [updateBlock, toast])

  const selectedBlock = blocks.find(b => b.id === selectedId)

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Mode toggle (only when there is content) */}
      {(blocks.length > 0 || isRawMode) && (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => {
              if (isRawMode && rawHtml) {
                // Try to parse raw HTML back into blocks
                const parsed = htmlToBlocks(rawHtml)
                if (parsed && parsed.length > 1) {
                  setBlocks(parsed)
                  setIsRawMode(false)
                } else {
                  toast('El HTML no se pudo descomponer en bloques editables', 'warning')
                }
              } else {
                setIsRawMode(false)
              }
            }}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
              !isRawMode ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
            )}
          >
            📦 Bloques
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isRawMode) {
                // Convert blocks to HTML and switch to raw mode
                setRawHtml(blocks.length > 0 ? blocksToFullHtml(blocks) : value || '')
              }
              setIsRawMode(true)
            }}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
              isRawMode ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
            )}
          >
            {'<>'} HTML
          </button>
        </div>
      )}

      {/* Raw HTML mode */}
      {isRawMode && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Contenido generado por IA — edita el HTML directamente o usa la vista previa a la derecha.</span>
          </div>
          <textarea
            value={rawHtml}
            onChange={e => {
              setRawHtml(e.target.value)
              onChange(e.target.value)
            }}
            className="w-full min-h-[300px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-mono text-slate-700 dark:text-slate-300 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Pega o edita tu HTML aquí..."
            spellCheck={false}
          />
        </div>
      )}

      {/* Templates section — only when empty and not in raw mode */}
      {!isRawMode && blocks.length === 0 && (
        <TemplateSelector onApply={applyTemplate} />
      )}

      {/* Blocks canvas */}
      {!isRawMode && blocks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bloques ({blocks.length})</span>
            <div className="flex gap-1">
              {blocks.length > 0 && (
                <Button type="button" variant="ghost" size="sm" className="text-xs text-slate-400 h-7" onClick={() => { if (confirm('¿Borrar todo el contenido?')) syncHtml([]) }}>
                  <Trash2 className="w-3 h-3 mr-1" /> Limpiar
                </Button>
              )}
            </div>
          </div>

          {blocks.map((block, idx) => (
            <BlockRow
              key={block.id}
              block={block}
              isSelected={selectedId === block.id}
              isFirst={idx === 0}
              isLast={idx === blocks.length - 1}
              onSelect={() => setSelectedId(selectedId === block.id ? null : block.id)}
              onMove={(dir) => moveBlock(block.id, dir)}
              onRemove={() => removeBlock(block.id)}
              onDuplicate={() => duplicateBlock(block.id)}
              onUpdate={(updates) => updateBlock(block.id, updates)}
              onUpdateStyle={(s) => updateBlockStyle(block.id, s)}
              onUploadImage={() => { uploadBlockIdRef.current = block.id; fileInputRef.current?.click() }}
            />
          ))}

          {/* Add block button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all flex items-center justify-center gap-2 text-xs font-medium"
            >
              <Plus className="w-4 h-4" /> Agregar bloque
            </button>
            {showAddMenu && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 grid grid-cols-4 gap-1">
                {BLOCK_TYPES.map(bt => (
                  <button
                    key={bt.type}
                    type="button"
                    onClick={() => addBlock(bt.type)}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      {bt.icon}
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{bt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── BlockRow ──
function BlockRow({
  block, isSelected, isFirst, isLast,
  onSelect, onMove, onRemove, onDuplicate, onUpdate, onUpdateStyle, onUploadImage,
}: {
  block: EmailBlock; isSelected: boolean; isFirst: boolean; isLast: boolean;
  onSelect: () => void; onMove: (dir: -1 | 1) => void; onRemove: () => void;
  onDuplicate: () => void; onUpdate: (u: Partial<EmailBlock>) => void;
  onUpdateStyle: (s: Partial<EmailBlock['style']>) => void; onUploadImage: () => void;
}) {
  const typeLabel = BLOCK_TYPES.find(bt => bt.type === block.type)?.label || block.type
  const typeIcon = BLOCK_TYPES.find(bt => bt.type === block.type)?.icon

  return (
    <div
      className={cn(
        'group relative rounded-xl border-2 transition-all',
        isSelected
          ? 'border-blue-400 dark:border-blue-500 shadow-sm shadow-blue-100 dark:shadow-blue-900/20'
          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
      )}
    >
      {/* Block header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-t-xl transition-colors',
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-800/50'
        )}
        onClick={onSelect}
      >
        <span className="text-slate-400">{typeIcon}</span>
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex-1">{typeLabel}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFirst && <button type="button" onClick={(e) => { e.stopPropagation(); onMove(-1) }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><MoveUp className="w-3 h-3" /></button>}
          {!isLast && <button type="button" onClick={(e) => { e.stopPropagation(); onMove(1) }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><MoveDown className="w-3 h-3" /></button>}
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate() }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><Copy className="w-3 h-3" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove() }} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Block edit area (expanded when selected) */}
      {isSelected && (
        <div className="p-3 space-y-3 bg-white dark:bg-slate-900 rounded-b-xl">
          {/* HEADER / TEXT */}
          {(block.type === 'header' || block.type === 'text') && (
            <>
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contenido</Label>
                {block.type === 'header' ? (
                  <Input
                    value={block.content}
                    onChange={e => onUpdate({ content: e.target.value })}
                    placeholder="Escribe tu título..."
                    className="font-bold text-base"
                  />
                ) : (
                  <textarea
                    value={block.content}
                    onChange={e => onUpdate({ content: e.target.value })}
                    placeholder="Escribe tu texto..."
                    className="w-full min-h-[80px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              {/* Text formatting toolbar */}
              <div className="flex items-center gap-1 flex-wrap">
                <button type="button" onClick={() => onUpdateStyle({ fontWeight: block.style.fontWeight === '700' ? '400' : '700' })}
                  className={cn('p-1.5 rounded-md border text-xs', block.style.fontWeight === '700' ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => onUpdateStyle({ fontStyle: block.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  className={cn('p-1.5 rounded-md border text-xs', block.style.fontStyle === 'italic' ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                {(['left', 'center', 'right'] as const).map(al => (
                  <button key={al} type="button" onClick={() => onUpdateStyle({ textAlign: al })}
                    className={cn('p-1.5 rounded-md border text-xs', block.style.textAlign === al ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                    {al === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : al === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                <select
                  value={block.style.fontSize || '15px'}
                  onChange={e => onUpdateStyle({ fontSize: e.target.value })}
                  className="h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-1.5"
                >
                  <option value="12px">12</option>
                  <option value="13px">13</option>
                  <option value="14px">14</option>
                  <option value="15px">15</option>
                  <option value="16px">16</option>
                  <option value="18px">18</option>
                  <option value="20px">20</option>
                  <option value="24px">24</option>
                  <option value="28px">28</option>
                  <option value="32px">32</option>
                  <option value="36px">36</option>
                </select>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                <div className="flex gap-1">
                  {['#111827', '#374151', '#2563eb', '#059669', '#dc2626', '#7c3aed', '#ea580c', '#ffffff'].map(c => (
                    <button key={c} type="button" onClick={() => onUpdateStyle({ color: c })}
                      className={cn('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110', block.style.color === c ? 'border-blue-500 scale-110' : 'border-slate-200 dark:border-slate-600')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {block.type === 'header' && (
                <div>
                  <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Color de fondo</Label>
                  <div className="flex gap-1">
                    {['#ffffff', '#f3f4f6', '#1e293b', '#1e40af', '#059669', '#7c3aed', '#dc2626', '#ea580c'].map(c => (
                      <button key={c} type="button" onClick={() => onUpdateStyle({ backgroundColor: c })}
                        className={cn('w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110', block.style.backgroundColor === c ? 'border-blue-500 scale-110' : 'border-slate-200 dark:border-slate-600')}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* IMAGE */}
          {block.type === 'image' && (
            <div className="space-y-3">
              {block.src ? (
                <div className="relative group/img">
                  <img src={block.src} alt={block.alt || ''} className="w-full rounded-lg border" />
                  <button type="button" onClick={onUploadImage} className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                    Cambiar imagen
                  </button>
                </div>
              ) : (
                <button type="button" onClick={onUploadImage} className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all flex flex-col items-center gap-2">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs font-medium">Haz clic para subir imagen</span>
                  <span className="text-[10px]">JPG, PNG o WebP · Máx 5MB</span>
                </button>
              )}
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Texto alternativo</Label>
                <Input value={block.alt || ''} onChange={e => onUpdate({ alt: e.target.value })} placeholder="Descripción de la imagen" className="text-xs" />
              </div>
            </div>
          )}

          {/* BUTTON */}
          {block.type === 'button' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Texto del botón</Label>
                  <Input value={block.content} onChange={e => onUpdate({ content: e.target.value })} placeholder="Ver más" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Enlace (URL)</Label>
                  <Input value={block.href || ''} onChange={e => onUpdate({ href: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Color del botón</Label>
                <div className="flex gap-1.5">
                  {['#2563eb', '#1e40af', '#059669', '#7c3aed', '#dc2626', '#ea580c', '#111827', '#f97316'].map(c => (
                    <button key={c} type="button" onClick={() => onUpdateStyle({ backgroundColor: c })}
                      className={cn('w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110', block.style.backgroundColor === c ? 'border-blue-500 scale-110 ring-2 ring-blue-200' : 'border-slate-200 dark:border-slate-600')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bordes redondeados</Label>
                <div className="flex gap-1.5">
                  {[{ label: 'Recto', val: '0px' }, { label: 'Suave', val: '8px' }, { label: 'Redondo', val: '24px' }, { label: 'Pill', val: '999px' }].map(r => (
                    <button key={r.val} type="button" onClick={() => onUpdateStyle({ borderRadius: r.val })}
                      className={cn('px-2.5 py-1 rounded-md border text-[10px] font-medium', block.style.borderRadius === r.val ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SPACER */}
          {block.type === 'spacer' && (
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Altura</Label>
              <div className="flex gap-1.5">
                {['8px', '16px', '24px', '32px', '48px', '64px'].map(h => (
                  <button key={h} type="button" onClick={() => onUpdateStyle({ height: h })}
                    className={cn('px-2.5 py-1 rounded-md border text-[10px] font-medium', block.style.height === h ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                    {parseInt(h)}px
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SOCIAL */}
          {block.type === 'social' && (
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Redes (separar con comas)</Label>
              <Input
                value={block.content}
                onChange={e => onUpdate({ content: e.target.value })}
                placeholder="facebook, instagram, whatsapp, twitter"
                className="text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">Opciones: facebook, instagram, whatsapp, twitter, linkedin, youtube, tiktok</p>
            </div>
          )}

          {/* TWO COLUMN */}
          {block.type === 'two-column' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Columna izquierda</Label>
                <textarea
                  value={block.style.leftContent || ''}
                  onChange={e => onUpdateStyle({ leftContent: e.target.value })}
                  className="w-full min-h-[60px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contenido izquierdo..."
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Columna derecha</Label>
                <textarea
                  value={block.style.rightContent || ''}
                  onChange={e => onUpdateStyle({ rightContent: e.target.value })}
                  className="w-full min-h-[60px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contenido derecho..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed preview for unselected blocks */}
      {!isSelected && (
        <div className="px-3 py-2 text-xs text-slate-500 truncate cursor-pointer" onClick={onSelect}>
          {block.type === 'header' && <span className="font-bold text-slate-700 dark:text-slate-300">{block.content || 'Título vacío'}</span>}
          {block.type === 'text' && <span>{block.content?.slice(0, 80) || 'Texto vacío'}{block.content?.length > 80 ? '…' : ''}</span>}
          {block.type === 'image' && <span className="italic">{block.src ? '📷 Imagen cargada' : '📷 Sin imagen'}</span>}
          {block.type === 'button' && <span className="text-blue-600 font-medium">[{block.content}] → {block.href || '#'}</span>}
          {block.type === 'divider' && <span className="text-slate-300">─────────────</span>}
          {block.type === 'spacer' && <span className="text-slate-300">↕ {block.style.height || '24px'}</span>}
          {block.type === 'social' && <span>🔗 {block.content}</span>}
          {block.type === 'two-column' && <span>⬛⬛ Dos columnas</span>}
        </div>
      )}
    </div>
  )
}

// ── Template Selector ──
function TemplateSelector({ onApply }: { onApply: (blocks: EmailBlock[]) => void }) {
  const TEMPLATES: { id: string; name: string; description: string; gradient: string; icon: React.ReactNode; blocks: EmailBlock[] }[] = [
    {
      id: 'promo',
      name: 'Promoción',
      description: 'Oferta con imagen, precio y CTA',
      gradient: 'from-blue-500 to-indigo-600',
      icon: <Sparkles className="w-5 h-5" />,
      blocks: [
        { id: uid(), type: 'header', content: '🔥 ¡Oferta Exclusiva!', style: { fontSize: '28px', fontWeight: '700', color: '#ffffff', textAlign: 'center', padding: '32px 20px 16px', backgroundColor: '#1e40af' } },
        { id: uid(), type: 'text', content: 'Hola {{name}}, tenemos algo especial para ti. Aprovecha esta oferta por tiempo limitado.', style: { fontSize: '16px', color: '#e0e7ff', textAlign: 'center', padding: '0 20px 24px', backgroundColor: '#1e40af' } },
        { id: uid(), type: 'image', content: '', src: '', alt: 'Producto en oferta', style: { padding: '20px', textAlign: 'center' } },
        { id: uid(), type: 'text', content: '<strong>Producto Destacado</strong><br>Descripción breve del producto y sus beneficios principales. Precio especial con envío gratis.', style: { fontSize: '15px', color: '#374151', textAlign: 'center', padding: '8px 24px' } },
        { id: uid(), type: 'text', content: '<strong style="font-size:24px;color:#111827;">$99.900</strong> <span style="text-decoration:line-through;color:#9ca3af;">$149.900</span>', style: { fontSize: '16px', color: '#374151', textAlign: 'center', padding: '8px 20px' } },
        { id: uid(), type: 'button', content: 'Comprar Ahora', href: 'https://tusitio.com', style: { backgroundColor: '#1e40af', color: '#ffffff', fontSize: '16px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '8px' } },
        { id: uid(), type: 'spacer', content: '', style: { height: '16px' } },
        { id: uid(), type: 'divider', content: '', style: { padding: '8px 20px' } },
        { id: uid(), type: 'social', content: 'facebook,instagram,whatsapp', style: { textAlign: 'center', padding: '16px 20px' } },
      ]
    },
    {
      id: 'newsletter',
      name: 'Newsletter',
      description: 'Noticias semanales con secciones',
      gradient: 'from-emerald-500 to-teal-600',
      icon: <Type className="w-5 h-5" />,
      blocks: [
        { id: uid(), type: 'header', content: '📬 Novedades de la semana', style: { fontSize: '26px', fontWeight: '700', color: '#111827', textAlign: 'left', padding: '28px 24px 8px', backgroundColor: '#ffffff' } },
        { id: uid(), type: 'text', content: 'Hola {{name}}, aquí tienes lo más importante de esta semana.', style: { fontSize: '15px', color: '#6b7280', textAlign: 'left', padding: '4px 24px 16px' } },
        { id: uid(), type: 'divider', content: '', style: { padding: '4px 24px' } },
        { id: uid(), type: 'text', content: '<strong>1. Nuevo producto disponible</strong><br>Descripción breve de la novedad y por qué es relevante para el cliente.', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '16px 24px 8px' } },
        { id: uid(), type: 'text', content: '<strong>2. Tips de uso</strong><br>Un consejo práctico que tu cliente puede aplicar hoy mismo.', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '8px 24px' } },
        { id: uid(), type: 'text', content: '<strong>3. Oferta de la semana</strong><br>Incluye el descuento, fecha límite y un enlace directo.', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '8px 24px 16px' } },
        { id: uid(), type: 'button', content: 'Ver todas las novedades', href: 'https://tusitio.com', style: { backgroundColor: '#059669', color: '#ffffff', fontSize: '15px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '8px' } },
        { id: uid(), type: 'spacer', content: '', style: { height: '16px' } },
        { id: uid(), type: 'divider', content: '', style: { padding: '8px 24px' } },
        { id: uid(), type: 'social', content: 'facebook,instagram,whatsapp', style: { textAlign: 'center', padding: '16px 20px' } },
      ]
    },
    {
      id: 'welcome',
      name: 'Bienvenida',
      description: 'Email de bienvenida para nuevos clientes',
      gradient: 'from-violet-500 to-purple-600',
      icon: <Sparkles className="w-5 h-5" />,
      blocks: [
        { id: uid(), type: 'header', content: '¡Bienvenido a nuestra familia! 🎉', style: { fontSize: '26px', fontWeight: '700', color: '#ffffff', textAlign: 'center', padding: '32px 20px', backgroundColor: '#7c3aed' } },
        { id: uid(), type: 'text', content: 'Hola {{name}},<br><br>Estamos encantados de tenerte con nosotros. A partir de ahora, recibirás las mejores ofertas y novedades directamente en tu correo.', style: { fontSize: '15px', color: '#374151', textAlign: 'center', padding: '24px' } },
        { id: uid(), type: 'divider', content: '', style: { padding: '4px 24px' } },
        { id: uid(), type: 'text', content: '<strong>¿Qué puedes esperar?</strong><br>✅ Ofertas exclusivas solo para ti<br>✅ Novedades antes que nadie<br>✅ Tips y consejos útiles', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '16px 24px' } },
        { id: uid(), type: 'button', content: 'Explorar productos', href: 'https://tusitio.com', style: { backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '15px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '999px' } },
        { id: uid(), type: 'spacer', content: '', style: { height: '24px' } },
        { id: uid(), type: 'social', content: 'facebook,instagram,whatsapp', style: { textAlign: 'center', padding: '16px 20px' } },
      ]
    },
    {
      id: 'sale',
      name: 'Liquidación',
      description: 'Gran venta con urgencia y descuentos',
      gradient: 'from-red-500 to-orange-600',
      icon: <Sparkles className="w-5 h-5" />,
      blocks: [
        { id: uid(), type: 'header', content: '⚡ LIQUIDACIÓN · Hasta 50% OFF', style: { fontSize: '26px', fontWeight: '700', color: '#ffffff', textAlign: 'center', padding: '28px 20px 12px', backgroundColor: '#dc2626' } },
        { id: uid(), type: 'text', content: '¡Solo por esta semana! No te pierdas las mejores rebajas del año.', style: { fontSize: '16px', color: '#fef2f2', textAlign: 'center', padding: '0 20px 24px', backgroundColor: '#dc2626' } },
        { id: uid(), type: 'spacer', content: '', style: { height: '8px' } },
        { id: uid(), type: 'two-column', content: '', style: { padding: '16px 20px', leftContent: '<strong>🔧 Herramientas</strong><br>Hasta 40% OFF<br>Taladros, sierras, destornilladores...', rightContent: '<strong>🎨 Pinturas</strong><br>Hasta 50% OFF<br>Vinilos, esmaltes, aerosoles...' } },
        { id: uid(), type: 'two-column', content: '', style: { padding: '8px 20px', leftContent: '<strong>💡 Eléctricos</strong><br>Hasta 30% OFF<br>Cables, interruptores, lámparas...', rightContent: '<strong>🔩 Plomería</strong><br>Hasta 35% OFF<br>Tubos, válvulas, accesorios...' } },
        { id: uid(), type: 'button', content: '🛒 Ver todas las ofertas', href: 'https://tusitio.com', style: { backgroundColor: '#dc2626', color: '#ffffff', fontSize: '16px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '8px' } },
        { id: uid(), type: 'text', content: '⏰ Oferta válida hasta agotar existencias. No acumulable con otros descuentos.', style: { fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '16px 24px' } },
        { id: uid(), type: 'social', content: 'facebook,instagram,whatsapp', style: { textAlign: 'center', padding: '12px 20px' } },
      ]
    },
    {
      id: 'event',
      name: 'Evento / Invitación',
      description: 'Invitación a evento, webinar o inauguración',
      gradient: 'from-amber-500 to-yellow-600',
      icon: <Sparkles className="w-5 h-5" />,
      blocks: [
        { id: uid(), type: 'header', content: '📅 ¡Estás Invitado!', style: { fontSize: '28px', fontWeight: '700', color: '#111827', textAlign: 'center', padding: '32px 20px 12px', backgroundColor: '#fefce8' } },
        { id: uid(), type: 'text', content: 'Hola {{name}}, nos encantaría contar contigo en nuestro próximo evento.', style: { fontSize: '16px', color: '#92400e', textAlign: 'center', padding: '0 20px 20px', backgroundColor: '#fefce8' } },
        { id: uid(), type: 'divider', content: '', style: { padding: '4px 24px' } },
        { id: uid(), type: 'text', content: '<strong>📍 Lugar:</strong> Tu dirección aquí<br><strong>🗓 Fecha:</strong> Sábado 15 de Abril, 2026<br><strong>⏰ Hora:</strong> 10:00 AM - 1:00 PM<br><strong>🎯 Tema:</strong> Novedades y productos exclusivos', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '20px 24px' } },
        { id: uid(), type: 'button', content: 'Confirmar Asistencia', href: 'https://tusitio.com', style: { backgroundColor: '#ca8a04', color: '#ffffff', fontSize: '15px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '8px' } },
        { id: uid(), type: 'spacer', content: '', style: { height: '16px' } },
        { id: uid(), type: 'text', content: 'Habrá sorpresas, descuentos exclusivos y premios para los asistentes. ¡No te lo pierdas!', style: { fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '8px 24px' } },
        { id: uid(), type: 'social', content: 'facebook,instagram,whatsapp', style: { textAlign: 'center', padding: '16px 20px' } },
      ]
    },
    {
      id: 'blank',
      name: 'En blanco',
      description: 'Empieza desde cero con tu propio diseño',
      gradient: 'from-slate-400 to-slate-600',
      icon: <Plus className="w-5 h-5" />,
      blocks: [
        { id: uid(), type: 'header', content: 'Tu título aquí', style: { fontSize: '28px', fontWeight: '700', color: '#111827', textAlign: 'center', padding: '28px 20px', backgroundColor: '#ffffff' } },
        { id: uid(), type: 'text', content: 'Hola {{name}}, escribe tu mensaje aquí...', style: { fontSize: '15px', color: '#374151', textAlign: 'left', padding: '12px 20px' } },
        { id: uid(), type: 'button', content: 'Tu botón', href: 'https://tusitio.com', style: { backgroundColor: '#2563eb', color: '#ffffff', fontSize: '15px', fontWeight: '700', textAlign: 'center', padding: '12px 20px', borderRadius: '8px' } },
      ]
    },
  ]

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
          <Palette className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Elige una plantilla para empezar</span>
        </div>
        <p className="text-xs text-slate-400">Selecciona una base profesional. Podrás personalizar cada elemento después.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply(t.blocks.map(b => ({ ...b, id: uid(), style: { ...b.style } })))}
            className="group text-left rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 overflow-hidden transition-all hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20"
          >
            <div className={`bg-gradient-to-br ${t.gradient} p-4 flex items-center justify-center text-white`}>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                {t.icon}
              </div>
            </div>
            <div className="p-3">
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{t.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Export for use in campaign form
export { blocksToFullHtml }
export type { EmailBlock as EmailBuilderBlock }
