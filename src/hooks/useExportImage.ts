// Hook de exportacion PNG. Si la descarga falla, revisa aqui la preparacion de
// imagenes y la carga diferida de html2canvas.
import { useRef, useCallback, type RefObject } from 'react'
import { prepareImagesInElement, waitForImages } from '../utils/imageExport'

// Convierte un nodo oculto del DOM en una imagen PNG descargable.
interface UseExportImageReturn {
  ref: RefObject<HTMLDivElement | null>
  previewImage: (filename?: string) => Promise<ExportedImage | null>
  downloadImage: (image: ExportedImage) => void
  exportImage: (filename?: string) => Promise<void>
}

export interface ExportedImage {
  filename: string
  dataUrl: string
}

interface UseExportImageOptions {
  scale?: number
}

export function useExportImage(options: UseExportImageOptions = {}): UseExportImageReturn {
  const ref = useRef<HTMLDivElement | null>(null)
  const scale = options.scale ?? 2

  const previewImage = useCallback(async (filename = 'torneo'): Promise<ExportedImage | null> => {
    if (!ref.current) return null
    await prepareImagesInElement(ref.current)
    await waitForImages(ref.current)

    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(ref.current, {
      backgroundColor: '#000000',
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
    })

    return {
      filename,
      dataUrl: canvas.toDataURL('image/png'),
    }
  }, [scale])

  const downloadImage = useCallback((image: ExportedImage) => {
    const link = document.createElement('a')
    link.download = `${image.filename}.png`
    link.href = image.dataUrl
    link.click()
  }, [])

  const exportImage = useCallback(async (filename = 'torneo') => {
    const image = await previewImage(filename)
    if (image) downloadImage(image)
  }, [downloadImage, previewImage])

  return { ref, previewImage, downloadImage, exportImage }
}
