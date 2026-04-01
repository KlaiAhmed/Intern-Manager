import { useEffect } from 'react'

export function useHomeScrollReveal() {
  useEffect(() => {
    const root = document.getElementById('main-content')

    if (!root) {
      return
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    // If reduced motion is preferred, show all content immediately
    if (reducedMotionQuery.matches) {
      root.querySelectorAll<HTMLElement>('.reveal-on-scroll').forEach((element) => {
        element.classList.add('is-visible')
      })
      return
    }

    // Track observed elements to prevent duplicates
    const observedElements = new WeakSet<Element>()

    // Create intersection observer for scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }

          const target = entry.target as HTMLElement
          target.classList.add('is-visible')
          observer.unobserve(target)
        })
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.1,
      }
    )

    // Observe all reveal elements
    const observePendingElements = (): void => {
      root.querySelectorAll<HTMLElement>('.reveal-on-scroll').forEach((element) => {
        if (observedElements.has(element)) {
          return
        }

        observedElements.add(element)
        observer.observe(element)
      })
    }

    // Initial observation
    observePendingElements()

    // Watch for dynamically added content (lazy loaded sections)
    const mutationObserver = new MutationObserver(() => {
      observePendingElements()
    })

    mutationObserver.observe(root, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      observer.disconnect()
    }
  }, [])
}
