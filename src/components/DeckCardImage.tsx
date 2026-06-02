// Renderiza una carta del mazo como imagen o fallback textual. Toca este archivo
// para cambiar como se muestran cartas sin imagen o estados de carga.
import { memo, useMemo } from 'react'
import { displayImageUrl } from '../utils/imageExport'

type DeckCardImageProps = {
  url: string
  alt?: string
  /** Resultados de búsqueda visibles: prioridad alta. Mazo: lazy. */
  priority?: 'high' | 'low'
  className?: string
}

function DeckCardImageInner({ url, alt = '', priority = 'low', className }: DeckCardImageProps) {
  const src = useMemo(() => displayImageUrl(url) ?? url, [url])

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={priority === 'high' ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority === 'high' ? 'high' : 'auto'}
      draggable={false}
    />
  )
}

export const DeckCardImage = memo(DeckCardImageInner)
