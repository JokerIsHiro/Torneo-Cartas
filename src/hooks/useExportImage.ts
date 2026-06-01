import { useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { prepareImagesInElement, waitForImages } from '../utils/imageExport'

// Convierte un nodo oculto del DOM en una imagen PNG descargable.
interface UseExportImageReturn {
  ref: React.RefObject<HTMLDivElement | null>
  exportImage: (filename?: string) => Promise<void>
}

interface UseExportImageOptions {
  scale?: number
}

export function useExportImage(options: UseExportImageOptions = {}): UseExportImageReturn {
  const ref = useRef<HTMLDivElement | null>(null)
  const scale = options.scale ?? 2

  const exportImage = useCallback(async (filename = 'torneo') => {
    if (!ref.current) return
    await prepareImagesInElement(ref.current)
    await waitForImages(ref.current)

    const canvas = await html2canvas(ref.current, {
      backgroundColor: '#000000',
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
    })

    const link = document.createElement('a')
    link.download = `${filename}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [scale])

  return { ref, exportImage }
}
