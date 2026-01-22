import { useCallback, useEffect } from 'react'

type ThermalPrintOptions = {
  /** DOM id of the container that should be printed */
  targetId: string
  /** Width of the thermal paper in mm (default 80mm) */
  widthMm?: number
}

/**
 * Hook for thermal ticket printing using a popup window approach
 * This is more reliable than CSS injection as it avoids conflicts with page styles
 */
export function useThermalPrint(options: ThermalPrintOptions) {
  const { targetId, widthMm = 80 } = options

  const print = useCallback(() => {
    if (typeof window === 'undefined') return

    // Get the content to print
    const printContent = document.getElementById(targetId)
    if (!printContent) {
      console.error(`Print target #${targetId} not found`)
      return
    }

    // Get the HTML content
    const contentHtml = printContent.innerHTML

    // Create popup window with the content
    const printWindow = window.open('', '_blank', `width=400,height=600,scrollbars=yes`)
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir')
      return
    }

    // Write the document with embedded styles
    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket de Venta</title>
  <style>
    @page {
      size: ${widthMm}mm auto;
      margin: 0;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html, body {
      width: ${widthMm}mm;
      margin: 0;
      padding: 4mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      line-height: 1.2;
      background: white;
      color: black;
    }
    
    .thermal-ticket {
      width: 100%;
    }
    
    /* Typography */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-semibold { font-weight: 600; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }
    
    .text-xs { font-size: 8pt; }
    .text-sm { font-size: 9pt; }
    .text-\\[10px\\], .text-\\[9px\\], .text-\\[8px\\] { font-size: 8pt; }
    
    /* Spacing */
    .mb-0\\.5 { margin-bottom: 1mm; }
    .mb-1 { margin-bottom: 2mm; }
    .mb-2 { margin-bottom: 3mm; }
    .mt-1 { margin-top: 1mm; }
    .mt-2 { margin-top: 2mm; }
    .pb-1 { padding-bottom: 1mm; }
    .pb-2 { padding-bottom: 2mm; }
    .pt-1 { padding-top: 1mm; }
    .pl-2 { padding-left: 2mm; }
    .py-1 { padding-top: 1mm; padding-bottom: 1mm; }
    .px-1 { padding-left: 1mm; padding-right: 1mm; }
    .gap-0\\.5 { gap: 1mm; }
    .space-y-0\\.5 > * + * { margin-top: 1mm; }
    .space-y-1 > * + * { margin-top: 2mm; }
    
    /* Borders - Thinner and cleaner */
    .border-b { border-bottom: 0.5px solid #000; }
    .border-t { border-top: 0.5px solid #000; }
    .border-dashed { border-style: dotted; } /* Dotted looks cleaner on thermal */
    
    /* Flexbox */
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .flex-1 { flex: 1; min-width: 0; } /* min-width 0 allows truncate to work */
    
    /* Width - Adjusted for better alignment */
    .w-\\[12mm\\] { width: 12mm; min-width: 12mm; }
    .w-\\[8mm\\] { width: 8mm; min-width: 8mm; }
    .w-\\[14mm\\] { width: 14mm; min-width: 14mm; }
    
    /* Text utilities */
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .break-words { word-wrap: break-word; }
    .break-all { word-break: break-all; }
    .leading-tight { line-height: 1.1; }
    .uppercase { text-transform: uppercase; }
    
    /* Colors */
    .text-gray-500, .text-gray-600, .text-gray-700 { color: #000; }
    .text-green-700 { color: #000; }
    .text-blue-700 { color: #000; }
    .bg-white { background: white; }
    
    .hidden { display: none !important; }
    
    @media print {
      html, body {
        width: ${widthMm}mm;
        padding: 0; /* Remove padding for print to use full width */
      }
      @page {
        margin: 2mm;
      }
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>
`)
    printWindow.document.close()

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        // Close after print dialog closes
        printWindow.onafterprint = () => printWindow.close()
      }, 100)
    }

    // Fallback: if onload doesn't fire (some browsers)
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.print()
      }
    }, 500)

  }, [targetId, widthMm])

  return { print }
}


type LetterPrintOptions = {
  /** Unique id for the injected <style> tag */
  styleId?: string
  /** DOM id of the container that should be the ONLY visible content in print */
  targetId: string
  /** Portrait or landscape orientation (default portrait) */
  orientation?: 'portrait' | 'landscape'
}

/**
 * Hook for letter-size (Carta) printing - 8.5" x 11" (216mm x 279mm)
 * Used for full-page reports and documents
 */
export function useLetterPrint(options: LetterPrintOptions) {
  const { targetId, styleId = `letter-print-style-${targetId}`, orientation = 'portrait' } = options

  const clearAllPrintStyles = useCallback(() => {
    if (typeof window === 'undefined') return
    // Remove all print-related style tags to avoid conflicts
    document.querySelectorAll('style[id*="print-style"]').forEach(el => el.remove())
  }, [])

  const injectStyle = useCallback(() => {
    if (typeof window === 'undefined') return
    // Clear any existing print styles first
    clearAllPrintStyles()

    const style = document.createElement('style')
    style.id = styleId
    style.innerHTML = `
@media print {
  @page { 
    size: letter ${orientation}; 
    margin: 15mm 10mm; 
  }
  
  /* Reset everything */
  html, body { 
    width: 100% !important; 
    height: auto !important;
    margin: 0 !important; 
    padding: 0 !important; 
    background: white !important; 
    font-size: 11pt !important;
    line-height: 1.4 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Hide EVERYTHING by default */
  body *, body > *, html > * {
    visibility: hidden !important;
  }
  
  /* Hide specific elements */
  header, footer, nav, aside, .print\\:hidden, [class*="print:hidden"] {
    display: none !important;
  }
  
  /* Show the print container and ALL its children */
  #${targetId},
  #${targetId} * {
    visibility: visible !important;
  }
  
  /* Force the container to display */
  #${targetId} { 
    display: block !important;
    visibility: visible !important;
    position: absolute !important; 
    left: 0 !important; 
    top: 0 !important; 
    width: 100% !important;
    height: auto !important;
    z-index: 999999 !important;
    background: white !important;
    color: black !important;
  }
  
  /* Override Tailwind .hidden class */
  #${targetId}.hidden,
  .hidden#${targetId},
  div#${targetId}.hidden,
  [id="${targetId}"].hidden {
    display: block !important;
    visibility: visible !important;
  }
  
  /* Make all children visible with proper display */
  #${targetId} div { display: block !important; visibility: visible !important; }
  #${targetId} span { display: inline !important; visibility: visible !important; }
  #${targetId} p { display: block !important; visibility: visible !important; }
  #${targetId} h1, #${targetId} h2, #${targetId} h3 { 
    display: block !important; 
    visibility: visible !important;
    page-break-after: avoid !important;
  }
  
  /* Tables */
  #${targetId} table { display: table !important; visibility: visible !important; width: 100% !important; }
  #${targetId} thead { display: table-header-group !important; visibility: visible !important; }
  #${targetId} tbody { display: table-row-group !important; visibility: visible !important; }
  #${targetId} tr { display: table-row !important; visibility: visible !important; }
  #${targetId} th, #${targetId} td { display: table-cell !important; visibility: visible !important; }
  
  /* Grid and Flex */
  #${targetId} .grid { display: grid !important; }
  #${targetId} .flex { display: flex !important; }
  
  /* Ensure text is visible */
  #${targetId}, #${targetId} * {
    color: black !important;
  }
  
  /* Page breaks */
  #${targetId} table, #${targetId} .avoid-break {
    page-break-inside: avoid !important;
  }
}`
    document.head.appendChild(style)
  }, [styleId, targetId, orientation, clearAllPrintStyles])

  const removeStyle = useCallback(() => {
    if (typeof window === 'undefined') return
    const style = document.getElementById(styleId)
    if (style) style.remove()
  }, [styleId])

  const print = useCallback(() => {
    try {
      injectStyle()
      // Let the browser apply styles before printing
      setTimeout(() => window.print(), 50)
    } catch {
      // Swallow: UI layer should toast.
    }
  }, [injectStyle])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onAfterPrint = () => removeStyle()
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('afterprint', onAfterPrint)
      removeStyle()
    }
  }, [removeStyle])

  return { print }
}
