import { forwardRef } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

// Plantilla oculta que se renderiza para exportar imagenes de ronda o clasificacion.
interface RoundExportProps {
  tournamentId: string
  type: 'round' | 'standings'
}

export const RoundExport = forwardRef<HTMLDivElement, RoundExportProps>(
  ({ tournamentId, type }, ref) => {
    const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
    const { currentMatches, standings, getPlayerName } = useSwissPairings(tournamentId)

    if (!tournament) return null

    const now = new Date().toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const title = type === 'round' ? `Ronda ${tournament.currentRound}` : 'Clasificación'
    const subtitle = type === 'round' ? 'Emparejamientos' : `Tras la ronda ${tournament.currentRound}`
    const hasDraws = tournament.tcg !== 'yugioh'
    const exportStandingsColumns = hasDraws
      ? '36px 1fr 52px 48px 48px 48px'
      : '36px 1fr 52px 48px 48px'

    return (
      <div ref={ref} style={exportShellStyle}>
        <ExportHeader
          tournamentName={tournament.name}
          title={title}
          subtitle={subtitle}
          date={now}
        />

        {type === 'round' && (
          <div>
            {currentMatches.map(match => {
              const p1Name = getPlayerName(match.p1Id)
              const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)

              return (
                <div key={match.id} style={pairingRowStyle}>
                  <span style={tableNumberStyle}>Mesa {match.tableNumber}</span>
                  <span style={{ ...playerNameStyle, textAlign: 'right' }}>{p1Name}</span>
                  <span style={vsStyle}>vs</span>
                  <span style={playerNameStyle}>{p2Name}</span>
                </div>
              )
            })}
          </div>
        )}

        {type === 'standings' && (
          <div>
            <div style={{ ...standingsHeaderStyle, gridTemplateColumns: exportStandingsColumns }}>
              <span>#</span><span>Jugador</span>
              <span style={{ textAlign: 'center' }}>Pts</span>
              <span style={{ textAlign: 'center' }}>V</span>
              {hasDraws && <span style={{ textAlign: 'center' }}>E</span>}
              <span style={{ textAlign: 'center' }}>D</span>
            </div>

            {standings.map(row => (
              <div key={row.player.id} style={{
                ...standingRowStyle,
                gridTemplateColumns: exportStandingsColumns,
                background: row.position % 2 === 0
                  ? 'var(--color-background-secondary)'
                  : 'var(--color-background-primary)',
              }}>
                <span style={positionStyle}>{row.position}</span>
                <span style={{ fontWeight: 600 }}>{row.player.name}</span>
                <span style={scoreStyle}>{row.player.points}</span>
                <span style={mutedScoreStyle}>{row.player.wins}</span>
                {hasDraws && <span style={mutedScoreStyle}>{row.player.draws}</span>}
                <span style={mutedScoreStyle}>{row.player.losses}</span>
              </div>
            ))}
          </div>
        )}

        <div style={footerStyle}>
          Subterra TCG · {now}
        </div>
      </div>
    )
  }
)

RoundExport.displayName = 'RoundExport'

function ExportHeader({
  tournamentName,
  title,
  subtitle,
  date,
}: {
  tournamentName: string
  title: string
  subtitle: string
  date: string
}) {
  return (
    <div style={headerStyle}>
      <div>
        <div style={tournamentNameStyle}>{tournamentName}</div>
        <div style={titleStyle}>{title}</div>
        <div style={subtitleStyle}>{subtitle}</div>
      </div>
      <div style={dateStyle}>{date}</div>
    </div>
  )
}

const exportShellStyle: React.CSSProperties = {
  width: '720px',
  background: 'var(--color-background-primary)',
  padding: '2rem',
  fontFamily: 'system-ui, sans-serif',
  color: 'var(--color-text-primary)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
  marginBottom: '1.5rem',
  paddingBottom: '1rem',
  borderBottom: '1px solid var(--color-border-tertiary)',
}

const tournamentNameStyle: React.CSSProperties = {
  fontSize: '15px',
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-text-secondary)',
  marginTop: '8px',
}

const dateStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  textAlign: 'right',
}

const pairingRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '82px 1fr auto 1fr',
  alignItems: 'center',
  gap: '14px',
  padding: '15px 16px',
  marginBottom: '8px',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: '8px',
  background: 'var(--color-background-secondary)',
}

const tableNumberStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-accent-secondary)',
  fontWeight: 700,
  textTransform: 'uppercase',
}

const playerNameStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 650,
  minWidth: 0,
}

const vsStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  fontWeight: 700,
  textTransform: 'uppercase',
}

const standingsHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr 52px 48px 48px 48px',
  gap: '6px',
  padding: '6px 12px',
  fontSize: '11px',
  color: 'var(--color-text-secondary)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const standingRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr 52px 48px 48px 48px',
  gap: '6px',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: '7px',
  fontSize: '15px',
}

const positionStyle: React.CSSProperties = {
  color: 'var(--color-accent-secondary)',
  textAlign: 'center',
  fontSize: '13px',
  fontWeight: 700,
}

const scoreStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 750,
  color: 'var(--color-text-primary)',
}

const mutedScoreStyle: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--color-text-secondary)',
}

const footerStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  paddingTop: '1rem',
  borderTop: '1px solid var(--color-border-tertiary)',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  textAlign: 'center',
}
