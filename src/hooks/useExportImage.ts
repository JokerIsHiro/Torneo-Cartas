import { useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { prepareImagesInElement, waitForImages } from '../utils/imageExport'

// Convierte un nodo oculto del DOM en una imagen PNG descargable.
interface UseExportImageReturn {
  ref: React.RefObject<HTMLDivElement | null>
  exportImage: (filename?: string) => Promise<void>
}

export function useExportImage(): UseExportImageReturn {
  const ref = useRef<HTMLDivElement | null>(null)

  const exportImage = useCallback(async (filename = 'torneo') => {
    if (!ref.current) return
    await prepareImagesInElement(ref.current)
    await waitForImages(ref.current)

    const canvas = await html2canvas(ref.current, {
      backgroundColor: '#000000',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
    })

    const link = document.createElement('a')
    link.download = `${filename}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  return { ref, exportImage }
}
