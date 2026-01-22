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
    style.innerHTML = `
@media print {
  @page { size: ${widthMm}mm auto; margin: 0; }
  html, body { 
    width: ${widthMm}mm !important; 
    height: auto !important;
    margin: 0 !important; 
    padding: 0 !important; 
    background: #fff !important;
    overflow: visible !important;
  }
  /* Hide everything first */
  body > * { 
    display: none !important; 
    visibility: hidden !important; 
  }
  /* Force show the print container - override Tailwind .hidden */
  #${targetId} { 
    display: block !important;
    visibility: visible !important;
    position: fixed !important; 
    left: 0 !important; 
    top: 0 !important; 
    width: ${widthMm}mm !important; 
    max-width: ${widthMm}mm !important;
    height: auto !important;
    z-index: 999999 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  #${targetId}.hidden {
    display: block !important;
  }
  /* Make all children visible */
  #${targetId} * { 
    visibility: visible !important;
  }
  #${targetId} > * {
    display: revert !important;
  }
  #${targetId} div {
    display: block !important;
  }
  #${targetId} table { display: table !important; }
  #${targetId} thead { display: table-header-group !important; }
  #${targetId} tbody { display: table-row-group !important; }
  #${targetId} tr { display: table-row !important; }
  #${targetId} th, #${targetId} td { display: table-cell !important; }
  #${targetId} span { display: inline !important; }
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
  html, body { 
    width: 100% !important; 
    height: auto !important;
    margin: 0 !important; 
    padding: 0 !important; 
    background: #fff !important; 
    font-size: 11pt !important;
    line-height: 1.4 !important;
    overflow: visible !important;
  }
  /* Hide everything first */
  body > * { 
    display: none !important; 
    visibility: hidden !important; 
  }
  /* Force show the print container - override Tailwind .hidden */
  #${targetId} { 
    display: block !important;
    visibility: visible !important;
    position: fixed !important; 
    left: 0 !important; 
    top: 0 !important; 
    width: 100% !important;
    height: auto !important;
    z-index: 999999 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  #${targetId}.hidden {
    display: block !important;
  }
  /* Make all children visible */
  #${targetId} * { 
    visibility: visible !important;
  }
  #${targetId} > * {
    display: revert !important;
  }
  /* Restore specific display types */
  #${targetId} .grid {
    display: grid !important;
  }
  #${targetId} .flex {
    display: flex !important;
  }
  #${targetId} div {
    display: block !important;
  }
  #${targetId} span {
    display: inline !important;
  }
  #${targetId} table {
    display: table !important;
    width: 100% !important;
    border-collapse: collapse !important;
  }
  #${targetId} thead { display: table-header-group !important; }
  #${targetId} tbody { display: table-row-group !important; }
  #${targetId} tr { display: table-row !important; }
  #${targetId} th, #${targetId} td {
    display: table-cell !important;
    border: 1px solid #ddd !important;
    padding: 6px 8px !important;
    font-size: 10pt !important;
  }
  #${targetId} th {
    background-color: #f5f5f5 !important;
    font-weight: bold !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #${targetId} h1, #${targetId} h2, #${targetId} h3 {
    page-break-after: avoid !important;
    display: block !important;
  }
  #${targetId} table, #${targetId} .avoid-break {
    page-break-inside: avoid !important;
  }
  #${targetId} .bg-gray-50, #${targetId} .bg-gray-100, #${targetId} .bg-blue-50, #${targetId} .bg-green-50 {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #${targetId} .letter-print-content {
    display: block !important;
    padding: 0 !important;
  }
  #${targetId} .letter-print-content * {
    visibility: visible !important;
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
