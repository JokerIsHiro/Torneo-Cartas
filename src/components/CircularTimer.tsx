// Reloj circular reutilizable. Este componente es deliberadamente "tonto":
// recibe tiempo/progreso ya calculados y solo se encarga de pintar el SVG.
interface CircularTimerProps {
  formatted: string
  progress: number
  color: string
  trackColor: string
  glowColor: string
  size?: number | string
  strokeWidth?: number
  label?: string
  labelColor?: string
  timeColor?: string
  timeSize?: string
}

const VIEWBOX_SIZE = 100
const VIEWBOX_CENTER = VIEWBOX_SIZE / 2

export function CircularTimer({
  formatted,
  progress,
  color,
  trackColor,
  glowColor,
  size = 220,
  strokeWidth = 12,
  label,
  labelColor,
  timeColor = 'var(--color-text-primary)',
  timeSize = '42px',
}: CircularTimerProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const radius = VIEWBOX_CENTER - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clampedProgress)

  return (
    <div style={{
      width: size,
      aspectRatio: '1',
      position: 'relative',
      margin: '0 auto',
      display: 'grid',
      placeItems: 'center',
      filter: `drop-shadow(0 0 20px ${glowColor})`,
    }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'rotate(-90deg)',
        }}
      >
        <circle
          cx={VIEWBOX_CENTER}
          cy={VIEWBOX_CENTER}
          r={VIEWBOX_CENTER - strokeWidth}
          fill="var(--color-background-primary)"
        />
        <circle
          cx={VIEWBOX_CENTER}
          cy={VIEWBOX_CENTER}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={VIEWBOX_CENTER}
          cy={VIEWBOX_CENTER}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }}
        />
      </svg>

      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        width: '78%',
      }}>
        <div style={{
          fontSize: timeSize,
          fontWeight: 600,
          fontFamily: 'var(--font-mono, monospace)',
          color: timeColor,
          lineHeight: 1,
          letterSpacing: 0,
          fontVariantNumeric: 'tabular-nums',
          transition: 'color .3s',
        }}>
          {formatted}
        </div>
        {label && (
          <div style={{
            margin: '12px auto 0',
            width: 'fit-content',
            maxWidth: '100%',
            minHeight: '26px',
            padding: '5px 12px',
            borderRadius: '999px',
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            fontSize: '12px',
            color: labelColor ?? 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color .3s',
          }}>
            <i className="ti ti-bell" aria-hidden="true" style={{ fontSize: '12px', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          </div>
        )}
      </div>
    </div>
  )
}
