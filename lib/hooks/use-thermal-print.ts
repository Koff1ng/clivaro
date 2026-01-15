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


