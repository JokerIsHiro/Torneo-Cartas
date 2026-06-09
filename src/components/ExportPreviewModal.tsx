import { createPortal } from 'react-dom'
import type { ExportedImage } from '../hooks/useExportImage'

interface ExportPreviewModalProps {
  image: ExportedImage | null
  title: string
  onClose: () => void
  onDownload: (image: ExportedImage) => void
}

export function ExportPreviewModal({ image, title, onClose, onDownload }: ExportPreviewModalProps) {
  if (!image) return null

  return createPortal(
    <div className="export-preview-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="export-preview-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={event => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Vista previa</span>
            <strong>{title}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar vista previa">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="export-preview-image-shell">
          <img src={image.dataUrl} alt={title} />
        </div>

        <footer>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" onClick={() => onDownload(image)}>
            <i className="ti ti-download" aria-hidden="true" />
            Descargar PNG
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
