import { useEffect } from 'react'

interface PageMetadataOptions {
  title: string
  description: string
  path: string
}

function upsertMetaDescription(description: string): void {
  let metaDescriptionTag = document.querySelector('meta[name="description"]')

  if (!metaDescriptionTag) {
    metaDescriptionTag = document.createElement('meta')
    metaDescriptionTag.setAttribute('name', 'description')
    document.head.append(metaDescriptionTag)
  }

  metaDescriptionTag.setAttribute('content', description)
}

function upsertCanonical(path: string): void {
  let canonicalTag = document.querySelector('link[rel="canonical"]')

  if (!canonicalTag) {
    canonicalTag = document.createElement('link')
    canonicalTag.setAttribute('rel', 'canonical')
    document.head.append(canonicalTag)
  }

  canonicalTag.setAttribute('href', `${window.location.origin}${path}`)
}

/**
 * Met a jour les metadonnees SEO essentielles pour la page active.
 */
export function usePageMetadata({ title, description, path }: PageMetadataOptions): void {
  useEffect(() => {
    document.title = title
    upsertMetaDescription(description)
    upsertCanonical(path)
  }, [description, path, title])
}
