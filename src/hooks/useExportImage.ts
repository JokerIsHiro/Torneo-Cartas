// Hook de exportacion PNG. Si la descarga falla, revisa aqui la preparacion de
// imagenes y la carga diferida de html2canvas.
import { useRef, useCallback, type RefObject } from 'react'
import { Capacitor } from '@capacitor/core'
import { prepareImagesInElement, waitForImages } from '../utils/imageExport'

// Convierte un nodo oculto del DOM en una imagen PNG descargable.
interface UseExportImageReturn {
  ref: RefObject<HTMLDivElement | null>
  exportImage: (filename?: string) => Promise<void>
  shareImage: (filename?: string) => Promise<void>
}

interface UseExportImageOptions {
  scale?: number
}

export function useExportImage(options: UseExportImageOptions = {}): UseExportImageReturn {
  const ref = useRef<HTMLDivElement | null>(null)
  const scale = options.scale ?? 2

  const createCanvas = useCallback(async () => {
    if (!ref.current) return
    await prepareImagesInElement(ref.current)
    await waitForImages(ref.current)

    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(ref.current, {
      backgroundColor: '#000000',
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
    })
  }, [scale])

  const exportImage = useCallback(async (filename = 'torneo') => {
    const canvas = await createCanvas()
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')

    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await Filesystem.writeFile({
        path: `${filename}.png`,
        data: dataUrl.split(',')[1],
        directory: Directory.Documents,
      })
      alert(`Imagen guardada como ${filename}.png`)
      return
    }

    const link = document.createElement('a')
    link.download = `${filename}.png`
    link.href = dataUrl
    link.click()
  }, [createCanvas])

  const shareImage = useCallback(async (filename = 'torneo') => {
    const canvas = await createCanvas()
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')

    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const writeResult = await Filesystem.writeFile({
        path: `${filename}.png`,
        data: dataUrl.split(',')[1],
        directory: Directory.Cache,
      })
      await Share.share({
        title: 'AetherHub',
        text: filename,
        files: [writeResult.uri],
        dialogTitle: 'Compartir imagen',
      })
      return
    }

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      await exportImage(filename)
      return
    }

    const file = new File([blob], `${filename}.png`, { type: 'image/png' })
    const shareData = { files: [file], title: filename }

    if (navigator.canShare?.(shareData)) {
      await navigator.share(shareData)
      return
    }

    await exportImage(filename)
  }, [createCanvas, exportImage])

  return { ref, exportImage, shareImage }
}
