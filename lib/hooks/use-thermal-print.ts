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
   /* ============================================================
      TICKET TERMICO 80MM – PRODUCCION
      Compatible: Chrome, Edge, Google Print, Antigravity
      Fuente: Monospace POS
      ============================================================ */
   
   @page {
     size: ${widthMm}mm auto;
     margin: 0;
   }
   
   @media print {
     html, body {
       width: ${widthMm}mm;
       margin: 0;
       padding: 0;
       background: #fff;
       color: #000;
       font-family: "Courier New", Courier, monospace;
       font-size: 11px;
       line-height: 1.25;
       -webkit-print-color-adjust: exact;
       print-color-adjust: exact;
     }
   
     /* Elimina cualquier borde o outline fantasma */
     * {
       border: 0 !important;
       outline: 0 !important;
       box-shadow: none !important;
       background: transparent !important;
     }
   
     /* Evita cortes raros */
     div, p, span, table, tr, td {
       page-break-inside: avoid;
     }
   }
   
   /* ============================================================
      CONTENEDOR PRINCIPAL
      ============================================================ */
   
   .ticket {
     width: ${widthMm}mm;
     padding: 6px 6px 10px 6px;
   }
   
   /* ============================================================
      TIPOGRAFIA
      ============================================================ */
   
   .center { text-align: center; }
   .right  { text-align: right; }
   .bold   { font-weight: bold; }
   .small  { font-size: 10px; }
   
   /* ============================================================
      SEPARADORES POS (UNICA LINEA PERMITIDA)
      ============================================================ */
   
   .separator {
     border-top: 1px dashed #000 !important; /* Force border for separator */
     margin: 6px 0;
     width: 100%;
     display: block;
   }
   
   /* ============================================================
      TABLA DE ITEMS
      ============================================================ */
   
   .items {
     width: 100%;
     border-collapse: collapse;
     margin-top: 4px;
   }
   
   .items th {
     text-align: left;
     font-weight: bold;
     font-size: 10px;
     padding-bottom: 2px;
   }
   
   .items td {
     font-size: 11px;
     padding: 2px 0;
     vertical-align: top;
   }
   
   .items .qty   { width: 15%; text-align: right; padding-right: 4px; }
   .items .desc  { width: 55%; }
   .items .price { width: 30%; text-align: right; }
   
   /* ============================================================
      TOTALES
      ============================================================ */
   
   .totals {
     width: 100%;
     margin-top: 6px;
     border-collapse: collapse;
   }
   
   .totals td {
     padding: 2px 0;
     font-size: 11px;
   }
   
   .totals .label {
     text-align: left;
     width: 60%;
   }
   
   .totals .value {
     text-align: right;
     width: 40%;
   }
   
   /* ============================================================
      QR DIAN / CODIGOS
      ============================================================ */
   
   .qr {
     display: block;
     margin: 6px auto;
     width: 140px;
   }
   
   /* ============================================================
      FOOTER
      ============================================================ */
   
   .footer {
     margin-top: 8px;
     text-align: center;
     font-size: 10px;
   }
   
   /* Reset global styles in popup */
   body {
     background: #fff;
     color: #000;
     font-family: "Courier New", Courier, monospace;
     font-size: 11px;
     padding: 0;
     margin: 0;
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
