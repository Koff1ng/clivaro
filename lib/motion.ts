// Pequeños helpers de animación respetando prefers-reduced-motion

export const transitions = {
  subtle: 'transform 160ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1)',
  fade: 'opacity 180ms cubic-bezier(0.4, 0, 0.2, 1)',
}

export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function hoverLiftStyle(reducedMotion?: boolean) {
  const disabled = typeof reducedMotion === 'boolean' ? reducedMotion : shouldReduceMotion()
  if (disabled) return {}
  return {
    transition: transitions.subtle,
  }
}


