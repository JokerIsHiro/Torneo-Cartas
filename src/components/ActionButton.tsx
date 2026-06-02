// Boton reutilizable para acciones principales. Ajusta aqui la apariencia comun
// si varios botones de la app deben cambiar a la vez.
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string
  children: ReactNode
}

// Botón con icono Tabler + texto descriptivo para la interfaz de tienda.
export function ActionButton({ icon, children, className, type = 'button', ...props }: ActionButtonProps) {
  return (
    <button type={type} className={['action-button', className].filter(Boolean).join(' ')} {...props}>
      {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}
