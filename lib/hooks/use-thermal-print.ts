import { useEffect, useCallback } from 'react'

type ThermalPrintOptions = {
  /** Unique id for the injected <style> tag */
  styleId?: string
  /** DOM id of the container that should be the ONLY visible content in print */
  targetId: string
  /** Width of the thermal paper in mm (default 80mm) */
  widthMm?: number
}

export function useThermalPrint(options: ThermalPrintOptions) {
  const { targetId, styleId = `thermal-print-style-${targetId}`, widthMm = 80 } = options

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
    // More aggressive CSS to ensure print content is visible
    style.innerHTML = `
@media print {
  @page { 
    size: ${widthMm}mm auto; 
    margin: 0mm; 
  }
  
  /* Reset everything */
  html, body { 
    width: ${widthMm}mm !important; 
    height: auto !important;
    margin: 0 !important; 
    padding: 0 !important; 
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Hide EVERYTHING by default */
  body *, body > *, html > * {
    visibility: hidden !important;
  }
  
  /* Hide specific elements that might have display:block */
  header, footer, nav, aside, .print\\:hidden, [class*="print:hidden"] {
    display: none !important;
  }
  
  /* Show the print container and ALL its ancestors */
  #${targetId},
  #${targetId} *,
  #${targetId}-ancestor,
  #${targetId}-ancestor * {
    visibility: visible !important;
  }
  
  /* Force the container to display even if it has .hidden class */
  #${targetId} {
    display: block !important;
    visibility: visible !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: ${widthMm}mm !important;
    max-width: ${widthMm}mm !important;
    min-height: 100vh !important;
    height: auto !important;
    z-index: 999999 !important;
    background: white !important;
    padding: 2mm !important;
    margin: 0 !important;
    overflow: visible !important;
    color: black !important;
  }
  
  /* Override Tailwind .hidden class specifically */
  #${targetId}.hidden,
  .hidden#${targetId},
  div#${targetId}.hidden,
  [id="${targetId}"].hidden {
    display: block !important;
    visibility: visible !important;
  }
  
  /* Make all children in the print container visible with proper display */
  #${targetId} div { display: block !important; visibility: visible !important; }
  #${targetId} span { display: inline !important; visibility: visible !important; }
  #${targetId} p { display: block !important; visibility: visible !important; }
  #${targetId} h1, #${targetId} h2, #${targetId} h3 { display: block !important; visibility: visible !important; }
  #${targetId} table { display: table !important; visibility: visible !important; }
  #${targetId} thead { display: table-header-group !important; visibility: visible !important; }
  #${targetId} tbody { display: table-row-group !important; visibility: visible !important; }
  #${targetId} tr { display: table-row !important; visibility: visible !important; }
  #${targetId} th, #${targetId} td { display: table-cell !important; visibility: visible !important; }
  
  /* Ensure text is visible */
  #${targetId}, #${targetId} * {
    color: black !important;
    background-color: white !important;
  }
  
  /* Thermal ticket specific styles */
  #${targetId} .thermal-ticket {
    width: 100% !important;
    font-family: 'Courier New', Courier, monospace !important;
    font-size: 10pt !important;
    line-height: 1.3 !important;
  }
}`
    document.head.appendChild(style)
  }, [styleId, targetId, widthMm, clearAllPrintStyles])

  const removeStyle = useCallback(() => {
    if (typeof window === 'undefined') return
    const style = document.getElementById(styleId)
    if (style) style.remove()
  }, [styleId])

  const print = useCallback(() => {
    try {
      injectStyle()
      // Give browser time to apply styles
      setTimeout(() => window.print(), 100)
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
