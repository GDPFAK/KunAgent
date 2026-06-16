let installed = false

export function installCursorSpotlightTracking(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  document.addEventListener(
    'pointermove',
    (event) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-cursor-spotlight-target]')
        : null
      if (!target) return
      const rect = target.getBoundingClientRect()
      target.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`)
      target.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`)
    },
    { passive: true }
  )
}
