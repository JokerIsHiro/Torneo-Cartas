import { useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'

// Convierte un nodo oculto del DOM en una imagen PNG descargable.
interface UseExportImageReturn {
  ref: React.RefObject<HTMLDivElement | null>
  exportImage: (filename?: string) => Promise<void>
}

export function useExportImage(): UseExportImageReturn {
  const ref = useRef<HTMLDivElement | null>(null)

  const exportImage = useCallback(async (filename = 'torneo') => {
    if (!ref.current) return
    await waitForImages(ref.current)

    const canvas = await html2canvas(ref.current, {
      backgroundColor: '#000000',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const link = document.createElement('a')
    link.download = `${filename}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  return { ref, exportImage }
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(images.map(image => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve()

    return new Promise<void>(resolve => {
      const timeout = window.setTimeout(resolve, 2500)

      image.addEventListener('load', () => {
        window.clearTimeout(timeout)
        resolve()
      }, { once: true })

      image.addEventListener('error', () => {
        window.clearTimeout(timeout)
        resolve()
      }, { once: true })
    })
  }))
}
