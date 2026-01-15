'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Bold, 
  Italic, 
  Underline,
  Heading1, 
  Type,
  Palette,
  Trash2,
  Copy,
  Move,
  Square,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import Draggable from 'react-draggable'

interface Block {
  id: string
  type: 'text' | 'heading' | 'button' | 'image' | 'divider' | 'box' | 'background'
  content: string
  x: number
  y: number
  width: number
  height: number
  zIndex?: number
  style: React.CSSProperties
}

interface CanvaEditorProps {
  value: string
  onChange: (value: string) => void
}

const templates = [
  {
    name: 'Promoción Simple',
    blocks: [
      { type: 'heading', content: '¡Oferta Especial!', x: 50, y: 50, width: 500, height: 60, style: { fontSize: '32px', color: '#1e40af', textAlign: 'center' } },
      { type: 'text', content: 'Hola {{name}},', x: 50, y: 130, width: 500, height: 40, style: { fontSize: '18px' } },
      { type: 'text', content: 'Tenemos una oferta increíble para ti. No te la pierdas.', x: 50, y: 180, width: 500, height: 60, style: { fontSize: '16px' } },
      { type: 'button', content: 'Ver Oferta', x: 200, y: 260, width: 200, height: 50, style: { backgroundColor: '#1e40af', color: 'white', borderRadius: '5px', textAlign: 'center', padding: '15px' } },
    ]
  },
  {
    name: 'Newsletter',
    blocks: [
      { type: 'heading', content: 'Newsletter', x: 50, y: 50, width: 500, height: 60, style: { fontSize: '28px', color: '#1e40af', textAlign: 'center' } },
      { type: 'box', content: 'Novedades de esta semana\n\nHola {{name}},\n\nTe compartimos las últimas novedades y ofertas especiales.', x: 50, y: 130, width: 500, height: 200, style: { backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '8px' } },
    ]
  },
]

// Component to handle editable content like Canva (double click to edit)
function EditableContent({
  blockId,
  content,
  onContentChange,
  onKeyDown,
  onMouseDown,
  onClick,
  onDoubleClick,
  className,
  style,
}: {
  blockId: string
  content: string
  onContentChange: (content: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onClick: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  className?: string
  style?: React.CSSProperties
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)
  const lastContentRef = useRef<string>(content)

  // Only update content if it changed from outside (not from user editing)
  useEffect(() => {
    if (elementRef.current && !isEditingRef.current && lastContentRef.current !== content) {
      elementRef.current.innerHTML = content
      lastContentRef.current = content
    }
  }, [content])

  const handleFocus = () => {
    isEditingRef.current = true
    if (elementRef.current) {
      elementRef.current.style.userSelect = 'text'
      elementRef.current.style.setProperty('-webkit-user-select', 'text')
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    isEditingRef.current = false
    const newContent = e.currentTarget.innerHTML || ''
    if (lastContentRef.current !== newContent) {
      lastContentRef.current = newContent
      onContentChange(newContent)
    }
    // Disable text selection when not editing
    e.currentTarget.style.userSelect = 'none'
    e.currentTarget.style.setProperty('-webkit-user-select', 'none')
  }

  // Initialize content on mount
  useEffect(() => {
    if (elementRef.current && !elementRef.current.innerHTML) {
      elementRef.current.innerHTML = content
      lastContentRef.current = content
    }
  }, [])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (elementRef.current) {
      elementRef.current.focus()
      // Select all text on double click
      const range = document.createRange()
      range.selectNodeContents(elementRef.current)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    onDoubleClick?.(e)
  }

  return (
    <div
      ref={elementRef}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{
        ...style,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        outline: 'none',
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
    />
  )
}

export default function CanvaEditor({ value, onChange }: CanvaEditorProps) {
  const { toast } = useToast()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#1e40af')
  const [hasTextSelection, setHasTextSelection] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)

  const colors = [
    '#1e40af', '#059669', '#dc2626', '#ea580c', '#7c3aed', 
    '#db2777', '#0891b2', '#65a30d', '#ca8a04', '#991b1b'
  ]

  // Convenience: when toolbar is visible, selectedBlock should exist. Use a safe fallback for TS.
  const selectedBlockId = selectedBlock ?? ''

  // Load blocks from value
  useEffect(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          setBlocks(parsed)
        }
      } catch {
        // If not JSON, convert HTML to blocks
        if (value.includes('<')) {
          convertHTMLToBlocks(value)
        }
      }
    }
  }, [])

  // Convert blocks to HTML
  useEffect(() => {
    if (blocks.length > 0) {
      const html = blocksToHTML(blocks)
      onChange(html)
    }
  }, [blocks])

  const convertHTMLToBlocks = (html: string) => {
    // Simple conversion - can be improved
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    const newBlocks: Block[] = []
    let y = 50

    tempDiv.querySelectorAll('h1, h2, p, div, a').forEach((el, idx) => {
      const tagName = el.tagName.toLowerCase()
      let type: Block['type'] = 'text'
      if (tagName === 'h1' || tagName === 'h2') type = 'heading'
      if (tagName === 'a') type = 'button'

      newBlocks.push({
        id: `block-${idx}`,
        type,
        content: el.textContent || '',
        x: 50,
        y: y,
        width: 500,
        height: 40,
        style: {
          fontSize: tagName === 'h1' ? '32px' : tagName === 'h2' ? '24px' : '16px',
          color: tagName === 'a' ? 'white' : '#333',
          backgroundColor: tagName === 'a' ? '#1e40af' : undefined,
          textAlign: 'left',
        }
      })
      y += 60
    })

    setBlocks(newBlocks)
  }

  const blocksToHTML = (blocks: Block[]): string => {
    // Sort by z-index first, then by y position
    const sortedBlocks = [...blocks].sort((a, b) => {
      const zA = a.zIndex || 0
      const zB = b.zIndex || 0
      if (zA !== zB) return zA - zB
      return a.y - b.y
    })
    
    let html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; position: relative; min-height: 600px; background-color: #ffffff;">'
    
    sortedBlocks.forEach(block => {
      const styleStr = Object.entries(block.style)
        .filter(([_, value]) => value !== undefined && value !== '')
        .map(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
          return `${cssKey}: ${value}`
        })
        .join('; ')

      const zIndexStyle = block.zIndex !== undefined ? `z-index: ${block.zIndex};` : ''
      const positionStyle = `position: absolute; left: ${block.x}px; top: ${block.y}px; width: ${block.width}px; min-height: ${block.height}px; ${zIndexStyle}`

      switch (block.type) {
        case 'background':
          html += `<div style="${positionStyle} ${styleStr}"></div>`
          break
        case 'heading':
          html += `<h1 style="${positionStyle} ${styleStr}">${block.content}</h1>`
          break
        case 'button':
          html += `<div style="${positionStyle} ${styleStr}"><a href="#" style="color: inherit; text-decoration: none; display: block; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${block.content}</a></div>`
          break
        case 'box':
          html += `<div style="${positionStyle} ${styleStr}">${block.content.replace(/\n/g, '<br>')}</div>`
          break
        case 'image':
          // Ensure image URLs are absolute for email compatibility
          // If it's a relative URL (starts with /), keep it as is (will be converted to absolute when sending email)
          // If it's base64, keep it as is (though Gmail may block it)
          // If it's already absolute, keep it as is
          const imageSrc = block.content
          html += `<img src="${imageSrc}" alt="Imagen" style="${positionStyle} ${styleStr} object-fit: cover;" />`
          break
        case 'divider':
          html += `<hr style="${positionStyle} border: none; border-top: 2px solid #e5e7eb;">`
          break
        default:
          html += `<p style="${positionStyle} ${styleStr}">${block.content}</p>`
      }
    })
    
    html += '</div>'
    return html
  }

  const addBlock = (type: Block['type'], defaultContent: string = '') => {
    const maxZIndex = blocks.length > 0 ? Math.max(...blocks.map(b => b.zIndex || 0)) : 0
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type,
      content: defaultContent,
      x: 50,
      y: blocks.length * 80 + 50,
      width: type === 'button' ? 200 : type === 'divider' ? 500 : type === 'background' ? 600 : type === 'image' ? 200 : 500,
      height: type === 'heading' ? 60 : type === 'button' ? 50 : type === 'divider' ? 2 : type === 'background' ? 300 : type === 'image' ? 200 : 40,
      zIndex: type === 'background' ? 0 : maxZIndex + 1,
      style: {
        fontSize: type === 'heading' ? '32px' : '16px',
        color: type === 'button' ? 'white' : '#333',
        backgroundColor: type === 'button' ? selectedColor : type === 'box' ? '#f0f9ff' : type === 'background' ? '#1a1a1a' : undefined,
        textAlign: 'left',
        padding: type === 'box' ? '20px' : undefined,
        borderRadius: type === 'button' || type === 'box' ? '8px' : type === 'background' ? '0px' : undefined,
      }
    }
    setBlocks([...blocks, newBlock])
    setSelectedBlock(newBlock.id)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast('Por favor selecciona un archivo de imagen válido', 'error')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast('La imagen debe ser menor a 5MB', 'error')
      return
    }

    try {
      // Upload image to server
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/marketing/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al subir la imagen')
      }

      const data = await response.json()
      // Use the relative URL - it will be converted to absolute when sending email
      // For preview in editor, we'll use the relative URL which works fine
      addBlock('image', data.url)
      toast('Imagen subida exitosamente', 'success')
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast(`Error al subir la imagen: ${error.message}`, 'error')
    }
  }

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ))
  }

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(block => block.id !== id))
    setSelectedBlock(null)
  }

  const duplicateBlock = (id: string) => {
    const block = blocks.find(b => b.id === id)
    if (block) {
      const newBlock: Block = {
        ...block,
        id: `block-${Date.now()}`,
        x: block.x + 20,
        y: block.y + 20,
      }
      setBlocks([...blocks, newBlock])
      setSelectedBlock(newBlock.id)
    }
  }

  const handleDrag = (id: string, data: { x: number; y: number }) => {
    updateBlock(id, { x: data.x, y: data.y })
  }

  const handleResize = (id: string, size: { width: number; height: number }) => {
    updateBlock(id, { width: size.width, height: size.height })
  }

  const selectedBlockData = blocks.find(b => b.id === selectedBlock)

  // Check for text selection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const hasSelection = selection && selection.toString().length > 0
      setHasTextSelection(hasSelection || false)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  const applyTextColor = (color: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    // Save the selected text and range position
    const selectedText = selection.toString()
    const startContainer = range.startContainer
    const startOffset = range.startOffset
    const endContainer = range.endContainer
    const endOffset = range.endOffset

    // Use execCommand for better compatibility
    document.execCommand('foreColor', false, color)
    
    // Restore selection to prevent text displacement
    try {
      const newRange = document.createRange()
      newRange.setStart(startContainer, startOffset)
      newRange.setEnd(endContainer, endOffset)
      selection.removeAllRanges()
      selection.addRange(newRange)
    } catch (e) {
      // If range restoration fails, try to find the text
      const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
      if (blockElement) {
        const editableElement = blockElement.querySelector('[contenteditable="true"]')
        if (editableElement) {
          // Try to restore selection by finding the text
          const walker = document.createTreeWalker(
            editableElement,
            NodeFilter.SHOW_TEXT,
            null
          )
          let node
          let found = false
          while (node = walker.nextNode()) {
            if (node.textContent?.includes(selectedText)) {
              const index = node.textContent.indexOf(selectedText)
              const newRange = document.createRange()
              newRange.setStart(node, index)
              newRange.setEnd(node, index + selectedText.length)
              selection.removeAllRanges()
              selection.addRange(newRange)
              found = true
              break
            }
          }
        }
      }
    }
    
    // Update the block content immediately
    if (selectedBlock) {
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
        if (blockElement) {
          const editableElement = blockElement.querySelector('[contenteditable="true"]')
          if (editableElement) {
            updateBlock(selectedBlock, { content: editableElement.innerHTML })
          }
        }
        // Keep selection visible
        setShowTextColorPicker(false)
      }, 10)
    } else {
      setShowTextColorPicker(false)
    }
  }

  const applyTextStyle = (command: string, value?: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) {
      // If no text is selected, apply to the whole block
      const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
      if (blockElement) {
        const editableElement = blockElement.querySelector('[contenteditable="true"]') as HTMLElement | null
        if (editableElement) {
          editableElement.focus()
          // Select all text in the element
          const selectAllRange = document.createRange()
          selectAllRange.selectNodeContents(editableElement)
          selection.removeAllRanges()
          selection.addRange(selectAllRange)
        }
      }
    }

    // Save selection info before applying command
    const selectedText = selection.toString()
    const startContainer = range.startContainer
    const startOffset = range.startOffset
    const endContainer = range.endContainer
    const endOffset = range.endOffset

    // Apply the style command
    document.execCommand(command, false, value)
    
    // Try to restore selection to prevent displacement
    try {
      const newRange = document.createRange()
      newRange.setStart(startContainer, startOffset)
      newRange.setEnd(endContainer, endOffset)
      selection.removeAllRanges()
      selection.addRange(newRange)
    } catch (e) {
      // If restoration fails, try to find and select the text
      const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
      if (blockElement && selectedText) {
        const editableElement = blockElement.querySelector('[contenteditable="true"]')
        if (editableElement) {
          const walker = document.createTreeWalker(
            editableElement,
            NodeFilter.SHOW_TEXT,
            null
          )
          let node
          while (node = walker.nextNode()) {
            if (node.textContent?.includes(selectedText)) {
              const index = node.textContent.indexOf(selectedText)
              const newRange = document.createRange()
              newRange.setStart(node, index)
              newRange.setEnd(node, index + selectedText.length)
              selection.removeAllRanges()
              selection.addRange(newRange)
              break
            }
          }
        }
      }
    }
    
    // Update block content after style change
    if (selectedBlock) {
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
        if (blockElement) {
          const editableElement = blockElement.querySelector('[contenteditable="true"]')
          if (editableElement) {
            updateBlock(selectedBlock, { content: editableElement.innerHTML })
          }
        }
      }, 0)
    }
  }

  const applyLink = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      // If no text is selected, check if we're inside a link
      const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
      if (blockElement) {
        const editableElement = blockElement.querySelector('[contenteditable="true"]')
        if (editableElement) {
          const linkElement = editableElement.querySelector('a')
          if (linkElement) {
            setLinkUrl(linkElement.href)
            setShowLinkDialog(true)
            return
          }
        }
      }
      return
    }

    const range = selection.getRangeAt(0)
    
    // Check if selection is already a link
    let linkElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element).closest('a')
      : (range.commonAncestorContainer.parentElement?.closest('a') || null)
    
    if (linkElement) {
      setLinkUrl(linkElement.getAttribute('href') || '')
      setShowLinkDialog(true)
      return
    }

    // Open dialog to get URL
    setLinkUrl('')
    setShowLinkDialog(true)
  }

  const confirmLink = () => {
    if (!linkUrl.trim()) {
      // If URL is empty, remove link
      removeLink()
      setShowLinkDialog(false)
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setShowLinkDialog(false)
      return
    }

    const range = selection.getRangeAt(0)
    
    // Check if we're editing an existing link
    let linkElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element).closest('a')
      : (range.commonAncestorContainer.parentElement?.closest('a') || null)
    
    if (linkElement) {
      // Update existing link
      linkElement.setAttribute('href', linkUrl.trim())
      linkElement.setAttribute('target', '_blank')
      linkElement.setAttribute('rel', 'noopener noreferrer')
    } else {
      // Create new link
      const url = linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://') 
        ? linkUrl.trim() 
        : `https://${linkUrl.trim()}`
      
      document.execCommand('createLink', false, url)
      
      // Set target and rel attributes
      const newLink = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element).closest('a')
        : (range.commonAncestorContainer.parentElement?.closest('a') || null)
      
      if (newLink) {
        newLink.setAttribute('target', '_blank')
        newLink.setAttribute('rel', 'noopener noreferrer')
      }
    }

    // Update block content
    if (selectedBlock) {
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
        if (blockElement) {
          const editableElement = blockElement.querySelector('[contenteditable="true"]')
          if (editableElement) {
            updateBlock(selectedBlock, { content: editableElement.innerHTML })
          }
        }
      }, 10)
    }

    setShowLinkDialog(false)
  }

  const removeLink = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const linkElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element).closest('a')
      : (range.commonAncestorContainer.parentElement?.closest('a') || null)
    
    if (linkElement) {
      // Select the link content
      const linkRange = document.createRange()
      linkRange.selectNodeContents(linkElement)
      selection.removeAllRanges()
      selection.addRange(linkRange)
      
      // Unlink
      document.execCommand('unlink', false)
      
      // Update block content
      if (selectedBlock) {
        setTimeout(() => {
          const blockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
          if (blockElement) {
            const editableElement = blockElement.querySelector('[contenteditable="true"]')
            if (editableElement) {
              updateBlock(selectedBlock, { content: editableElement.innerHTML })
            }
          }
        }, 10)
      }
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete element if:
      // 1. Delete or Backspace is pressed
      // 2. An element is selected
      // 3. User is NOT editing text (contentEditable element is not focused)
      // 4. No text is selected (to avoid deleting selected text)
      // 5. The event is not from an input/textarea/contentEditable
      const activeElement = document.activeElement
      const isEditing = activeElement?.getAttribute('contenteditable') === 'true' || 
                       activeElement?.tagName === 'INPUT' || 
                       activeElement?.tagName === 'TEXTAREA'
      
      // If user is editing, let the browser handle backspace/delete normally
      if (isEditing) {
        return
      }
      
      const selection = window.getSelection()
      const hasTextSelection = selection && selection.toString().length > 0
      
      // If there's text selected, don't delete the block
      if (hasTextSelection) {
        return
      }
      
      // Only delete block if not editing and no text is selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock) {
        // Check if the active element is inside the selected block
        const selectedBlockElement = document.querySelector(`[data-block-id="${selectedBlock}"]`)
        if (selectedBlockElement && !selectedBlockElement.contains(activeElement)) {
          e.preventDefault()
          deleteBlock(selectedBlock)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedBlock, blocks])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2 border-r pr-2">
          <span className="text-sm font-medium text-gray-700">Agregar:</span>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('text', 'Texto aquí')}>
            <Type className="h-4 w-4 mr-1" />
            Texto
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('heading', 'Título')}>
            <Heading1 className="h-4 w-4 mr-1" />
            Título
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('button', 'Botón')}>
            <Square className="h-4 w-4 mr-1" />
            Botón
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('box', 'Contenido destacado')}>
            <Square className="h-4 w-4 mr-1" />
            Caja
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('divider')}>
            <div className="h-4 w-8 border-t-2 border-gray-400" />
          </Button>
          <label htmlFor="image-upload-input" className="cursor-pointer">
            <input
              id="image-upload-input"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => document.getElementById('image-upload-input')?.click()}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Imagen
            </Button>
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('background', '')}>
            <Layers className="h-4 w-4 mr-1" />
            Fondo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasTextSelection && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTextColorPicker(!showTextColorPicker)}
              className="bg-blue-100"
            >
              <Palette className="h-4 w-4 mr-2" />
              Color Texto
            </Button>
          )}
          {selectedBlock && (
            <div className="flex items-center gap-1 border-r pr-2">
              <span className="text-sm font-medium text-gray-700 mr-1">Formato:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyTextStyle('bold')}
                title="Negrita"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyTextStyle('italic')}
                title="Cursiva"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyTextStyle('underline')}
                title="Subrayado"
              >
                <Underline className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyLink}
                title="Agregar/Editar Enlace"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
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
            onClick={() => setShowToolbar(!showToolbar)}
            disabled={!selectedBlock}
          >
            <Palette className="h-4 w-4 mr-2" />
            Estilo
          </Button>
        </div>
      </div>

      {showTextColorPicker && hasTextSelection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Color del Texto Seleccionado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyTextColor(color)}
                  className={`w-10 h-10 rounded border-2 ${
                    selectedColor === color ? 'border-gray-800' : 'border-gray-300'
                  } hover:scale-110 transition-transform`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selecciona un color para aplicar al texto seleccionado
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar/Editar Enlace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL del enlace</Label>
              <Input
                id="link-url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://ejemplo.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    confirmLink()
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Ingresa la URL completa (ej: https://ejemplo.com)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                removeLink()
                setShowLinkDialog(false)
              }}
            >
              Eliminar Enlace
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLinkDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmLink}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTemplates && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plantillas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const newBlocks: Block[] = template.blocks.map((b: any, i: number) => ({
                      ...(b as Omit<Block, 'id'>),
                      type: b.type as Block['type'],
                      id: `block-${Date.now()}-${i}`,
                    }))
                    setBlocks([...blocks, ...newBlocks])
                    setShowTemplates(false)
                  }}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showToolbar && selectedBlockData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Editar Estilo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Tamaño de fuente</Label>
                <input
                  type="range"
                  min="12"
                  max="48"
                  value={parseInt(String(selectedBlockData.style.fontSize || '16'))}
                  onChange={(e) => updateBlock(selectedBlockId, {
                    style: { ...selectedBlockData.style, fontSize: `${e.target.value}px` }
                  })}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{selectedBlockData.style.fontSize}</span>
              </div>
              <div>
                <Label className="text-xs">Color de texto</Label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateBlock(selectedBlockId, {
                        style: { ...selectedBlockData.style, color }
                      })}
                      className={`w-8 h-8 rounded border-2 ${
                        selectedBlockData.style.color === color ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {(selectedBlockData.type === 'button' || selectedBlockData.type === 'box' || selectedBlockData.type === 'background') && (
                <div>
                  <Label className="text-xs">Color de fondo</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateBlock(selectedBlockId, {
                          style: { ...selectedBlockData.style, backgroundColor: color }
                        })}
                        className={`w-8 h-8 rounded border-2 ${
                          selectedBlockData.style.backgroundColor === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {selectedBlockData.type === 'background' && (
                <div>
                  <Label className="text-xs">Imagen de fondo (URL)</Label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={selectedBlockData.style.backgroundImage?.replace('url(', '').replace(')', '').replace(/['"]/g, '') || ''}
                    onChange={(e) => updateBlock(selectedBlockId, {
                      style: { ...selectedBlockData.style, backgroundImage: e.target.value ? `url('${e.target.value}')` : undefined }
                    })}
                    className="w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Z-Index (Capa)</Label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedBlockData.zIndex || 0}
                  onChange={(e) => updateBlock(selectedBlockId, {
                    zIndex: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-2 py-1 text-xs border rounded"
                />
              </div>
              <div>
                <Label className="text-xs">Opacidad</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={parseFloat(String(selectedBlockData.style.opacity ?? '1')) * 100}
                  onChange={(e) => updateBlock(selectedBlockId, {
                    style: { ...selectedBlockData.style, opacity: `${parseFloat(e.target.value) / 100}` }
                  })}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{Math.round(parseFloat(String(selectedBlockData.style.opacity ?? '1')) * 100)}%</span>
              </div>
              <div>
                <Label className="text-xs">Alineación</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={selectedBlockData.style.textAlign === 'left' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateBlock(selectedBlockId, {
                      style: { ...selectedBlockData.style, textAlign: 'left' }
                    })}
                  >
                    Izq
                  </Button>
                  <Button
                    type="button"
                    variant={selectedBlockData.style.textAlign === 'center' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateBlock(selectedBlockId, {
                      style: { ...selectedBlockData.style, textAlign: 'center' }
                    })}
                  >
                    Cen
                  </Button>
                  <Button
                    type="button"
                    variant={selectedBlockData.style.textAlign === 'right' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateBlock(selectedBlockId, {
                      style: { ...selectedBlockData.style, textAlign: 'right' }
                    })}
                  >
                    Der
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateBlock(selectedBlockId, {
                  style: { ...selectedBlockData.style, fontWeight: selectedBlockData.style.fontWeight === 'bold' ? 'normal' : 'bold' }
                })}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateBlock(selectedBlockId, {
                  style: { ...selectedBlockData.style, fontStyle: selectedBlockData.style.fontStyle === 'italic' ? 'normal' : 'italic' }
                })}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => duplicateBlock(selectedBlockId)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => deleteBlock(selectedBlockId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Canvas */}
      <div>
        <Label>Editor Visual - Arrastra y redimensiona los elementos</Label>
        <div
          ref={canvasRef}
          className="border rounded-lg bg-gray-50 min-h-[600px] relative overflow-hidden"
          style={{ width: '100%', height: '600px' }}
          onClick={(e) => {
            if (e.target === canvasRef.current) {
              setSelectedBlock(null)
            }
          }}
        >
          {blocks.map((block) => (
            <Draggable
              key={block.id}
              position={{ x: block.x, y: block.y }}
              onStop={(e, data) => handleDrag(block.id, data)}
              handle={selectedBlock === block.id ? ".drag-handle-active" : undefined}
              bounds="parent"
              cancel="[contenteditable='true'], [contenteditable='true'] *"
            >
              <div
                data-block-id={block.id}
                className={`absolute ${
                  selectedBlock === block.id ? 'ring-2 ring-blue-500 z-10' : 'z-0'
                }`}
                style={{
                  width: block.width,
                  minHeight: block.height,
                  zIndex: block.zIndex,
                  cursor: 'move',
                  ...block.style,
                }}
                onClick={(e) => {
                  // Single click: select block (Canva behavior)
                  // Don't select if clicking on editable content that is focused
                  const editableElement = (e.target as HTMLElement).closest('[contenteditable="true"]')
                  if (!editableElement || document.activeElement !== editableElement) {
                    e.stopPropagation()
                    setSelectedBlock(block.id)
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent drag only if clicking on editable content that is focused
                  const editableElement = (e.target as HTMLElement).closest('[contenteditable="true"]')
                  if (editableElement && document.activeElement === editableElement) {
                    // If editing, don't allow drag
                    e.stopPropagation()
                    return
                  }
                  // Otherwise allow drag to work normally
                }}
              >
                {/* Drag handle - functional when selected */}
                {selectedBlock === block.id && (
                  <div 
                    className="drag-handle-active absolute -top-8 left-0 bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1 z-20 cursor-move hover:bg-blue-600 transition-colors"
                    style={{ 
                      pointerEvents: 'auto',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      touchAction: 'none'
                    }}
                  >
                    <Move className="h-3 w-3" />
                    <span>Arrastra para mover</span>
                  </div>
                )}
                
                {/* Content area - Canva-like behavior */}
                <div 
                  style={{ 
                    pointerEvents: 'auto', 
                    zIndex: block.zIndex || 'auto',
                    height: '100%',
                    width: '100%'
                  }}
                >
                  {block.type === 'background' ? (
                    <div 
                      className="w-full h-full"
                      style={{
                        backgroundColor: block.style.backgroundColor,
                        backgroundImage: block.style.backgroundImage,
                        backgroundSize: block.style.backgroundSize || 'cover',
                        backgroundPosition: block.style.backgroundPosition || 'center',
                        backgroundRepeat: block.style.backgroundRepeat || 'no-repeat',
                        borderRadius: block.style.borderRadius,
                        opacity: block.style.opacity,
                      }}
                    />
                  ) : block.type === 'image' ? (
                    <img 
                      src={block.content} 
                      alt="Imagen" 
                      className="w-full h-full object-cover"
                      style={{
                        borderRadius: block.style.borderRadius,
                        opacity: block.style.opacity,
                      }}
                    />
                  ) : block.type === 'divider' ? (
                    <div className="w-full border-t-2 border-gray-400" />
                  ) : block.type === 'button' ? (
                    <EditableContent
                      blockId={block.id}
                      content={block.content || 'Botón'}
                      onContentChange={(newContent) => {
                        updateBlock(block.id, { content: newContent })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          return
                        }
                        e.stopPropagation()
                      }}
                      onMouseDown={(e) => {
                        // Only stop propagation if element is focused (editing mode)
                        // Otherwise allow drag to work
                        if (document.activeElement === e.currentTarget) {
                          e.stopPropagation()
                        }
                      }}
                      onClick={(e) => {
                        // Single click: select block, don't edit
                        e.stopPropagation()
                        setSelectedBlock(block.id)
                      }}
                      onDoubleClick={(e) => {
                        // Double click: start editing
                        e.stopPropagation()
                      }}
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        backgroundColor: block.style.backgroundColor,
                        color: block.style.color,
                        borderRadius: block.style.borderRadius,
                        padding: block.style.padding,
                        cursor: 'default',
                      }}
                    />
                  ) : (
                    <EditableContent
                      blockId={block.id}
                      content={block.content || 'Edita aquí'}
                      onContentChange={(newContent) => {
                        updateBlock(block.id, { content: newContent })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          return
                        }
                        e.stopPropagation()
                      }}
                      onMouseDown={(e) => {
                        // Only stop propagation if element is focused (editing mode)
                        // Otherwise allow drag to work
                        if (document.activeElement === e.currentTarget) {
                          e.stopPropagation()
                        }
                      }}
                      onClick={(e) => {
                        // Single click: select block, don't edit
                        e.stopPropagation()
                        setSelectedBlock(block.id)
                      }}
                      onDoubleClick={(e) => {
                        // Double click: start editing
                        e.stopPropagation()
                      }}
                      className="w-full h-full outline-none"
                      style={{
                        whiteSpace: block.type === 'box' ? 'pre-wrap' : 'normal',
                        cursor: 'default',
                      }}
                    />
                  )}
                </div>
                {selectedBlock === block.id && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute -top-8 right-0 h-6 w-6 p-0 bg-red-500 text-white hover:bg-red-600 rounded z-20"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteBlock(block.id)
                      }}
                      title="Eliminar (Suprimir)"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <div
                      className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 cursor-se-resize rounded-tl-lg border-2 border-white shadow-lg hover:bg-blue-600"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        const startX = e.clientX
                        const startY = e.clientY
                        const startWidth = block.width
                        const startHeight = block.height

                        const handleMouseMove = (e: MouseEvent) => {
                          const deltaX = e.clientX - startX
                          const deltaY = e.clientY - startY
                          const newWidth = Math.max(50, Math.min(800, startWidth + deltaX))
                          const newHeight = Math.max(20, Math.min(400, startHeight + deltaY))
                          handleResize(block.id, { width: newWidth, height: newHeight })
                        }

                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }

                        document.addEventListener('mousemove', handleMouseMove)
                        document.addEventListener('mouseup', handleMouseUp)
                      }}
                      title="Arrastra para redimensionar"
                    />
                  </>
                )}
              </div>
            </Draggable>
          ))}
        </div>
        <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
          <p className="font-medium text-blue-900 mb-1">💡 Consejos:</p>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Haz clic en un elemento para seleccionarlo</li>
            <li>Arrastra los elementos para moverlos</li>
            <li>Arrastra la esquina inferior derecha para redimensionar</li>
            <li>Haz doble clic en el texto para editarlo</li>
            <li>Presiona <kbd className="bg-blue-100 px-1 py-0.5 rounded text-xs">Suprimir</kbd> o usa el botón <Trash2 className="h-3 w-3 inline" /> para eliminar elementos</li>
            <li>Usa <code className="bg-blue-100 px-1 rounded">{'{{name}}'}</code> y <code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code> para personalizar</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

