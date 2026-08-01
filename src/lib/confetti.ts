import confetti from 'canvas-confetti'

/** Celebratory burst from a trigger element (payment marked paid). Respects reduced motion. */
export function celebrateFrom(el: HTMLElement | null) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  let origin = { x: 0.5, y: 0.6 }
  if (el) {
    const r = el.getBoundingClientRect()
    origin = {
      x: (r.left + r.width / 2) / window.innerWidth,
      y: (r.top + r.height / 2) / window.innerHeight,
    }
  }
  void confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 24,
    scalar: 0.8,
    ticks: 140,
    origin,
    colors: ['#4f46e5', '#818cf8', '#34d399', '#fbbf24'],
    disableForReducedMotion: true,
  })
}
