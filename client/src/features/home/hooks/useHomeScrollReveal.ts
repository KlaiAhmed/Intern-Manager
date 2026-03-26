import { useEffect } from 'react'

export function useHomeScrollReveal() {
  useEffect(() => {
    const root = document.getElementById('main-content')

    if (!root) {
      return
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const observedElements = new WeakSet<Element>()

    if (reducedMotionQuery.matches) {
      root.querySelectorAll<HTMLElement>('.reveal-on-scroll').forEach((element) => {
        element.classList.add('is-visible')
      })

      return
    }

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
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.14,
      },
    )

    const observePendingElements = (): void => {
      root.querySelectorAll<HTMLElement>('.reveal-on-scroll').forEach((element) => {
        if (observedElements.has(element)) {
          return
        }

        observedElements.add(element)
        observer.observe(element)
      })
    }

    observePendingElements()

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
