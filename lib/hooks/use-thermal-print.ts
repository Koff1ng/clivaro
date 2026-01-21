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

  const injectStyle = useCallback(() => {
    if (typeof window === 'undefined') return
    const existing = document.getElementById(styleId)
    if (existing) return

    const style = document.createElement('style')
    style.id = styleId
    style.innerHTML = `
@media print {
  @page { size: ${widthMm}mm auto; margin: 0; }
  body { width: ${widthMm}mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #${targetId}, #${targetId} * { visibility: visible !important; }
  #${targetId} { position: absolute !important; left: 0 !important; top: 0 !important; width: ${widthMm}mm !important; max-width: ${widthMm}mm !important; }
}`
    document.head.appendChild(style)
  }, [styleId, targetId, widthMm])

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

  const injectStyle = useCallback(() => {
    if (typeof window === 'undefined') return
    const existing = document.getElementById(styleId)
    if (existing) return

    const style = document.createElement('style')
    style.id = styleId
    style.innerHTML = `
@media print {
  @page { 
    size: letter ${orientation}; 
    margin: 15mm 10mm; 
  }
  body { 
    width: 100% !important; 
    margin: 0 !important; 
    padding: 0 !important; 
    background: #fff !important; 
    font-size: 11pt !important;
    line-height: 1.4 !important;
  }
  body * { visibility: hidden !important; }
  #${targetId}, #${targetId} * { visibility: visible !important; }
  #${targetId} { 
    position: absolute !important; 
    left: 0 !important; 
    top: 0 !important; 
    width: 100% !important; 
  }
  #${targetId} table {
    width: 100% !important;
    border-collapse: collapse !important;
  }
  #${targetId} th, #${targetId} td {
    border: 1px solid #ddd !important;
    padding: 6px 8px !important;
    font-size: 10pt !important;
  }
  #${targetId} th {
    background-color: #f5f5f5 !important;
    font-weight: bold !important;
  }
  #${targetId} h1, #${targetId} h2, #${targetId} h3 {
    page-break-after: avoid !important;
  }
  #${targetId} table, #${targetId} .avoid-break {
    page-break-inside: avoid !important;
  }
}`
    document.head.appendChild(style)
  }, [styleId, targetId, orientation])

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
