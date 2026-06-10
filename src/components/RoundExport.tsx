// Plantillas ocultas para exportar rondas y clasificaciones como imagen.
// Mantener estilos inline aqui ayuda a que html2canvas capture un resultado estable.
import { forwardRef } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Match } from '../types/tournament'

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
              const playerNames = getMatchPlayerIds(match).map(getPlayerName)
              const isPod = playerNames.length > 2

              return (
                <div key={match.id} style={isPod ? pairingPodRowStyle : pairingRowStyle}>
                  <span style={tableNumberStyle}>Mesa {match.tableNumber}</span>
                  {isPod ? (
                    <div style={podPlayerGridStyle}>
                      {playerNames.map(name => (
                        <span key={name} style={playerNameStyle}>{name}</span>
                      ))}
                    </div>
                  ) : (
                    <>
                      <span style={{ ...playerNameStyle, textAlign: 'right' }}>{playerNames[0]}</span>
                      <span style={vsStyle}>vs</span>
                      <span style={playerNameStyle}>{playerNames[1]}</span>
                    </>
                  )}
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
                background: row.position % 2 === 0 ? '#000000' : '#05070c',
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

function getMatchPlayerIds(match: Match): string[] {
  if (match.playerIds?.length) return match.playerIds
  return match.p2Id === 'BYE' ? [match.p1Id] : [match.p1Id, match.p2Id]
}

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
  background: '#05070c',
  padding: '2rem',
  fontFamily: 'system-ui, sans-serif',
  color: '#f2f7ff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
  marginBottom: '1.5rem',
  paddingBottom: '1rem',
  borderBottom: '1px solid #0d274f',
}

const tournamentNameStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#7c9ad0',
  marginBottom: '6px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1,
  color: '#f2f7ff',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#7c9ad0',
  marginTop: '8px',
}

const dateStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#516b9a',
  textAlign: 'right',
}

const pairingRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '82px 1fr auto 1fr',
  alignItems: 'center',
  gap: '14px',
  padding: '15px 16px',
  marginBottom: '8px',
  border: '1px solid #0d274f',
  borderRadius: '8px',
  background: '#000000',
}

const pairingPodRowStyle: React.CSSProperties = {
  ...pairingRowStyle,
  gridTemplateColumns: '82px 1fr',
}

const podPlayerGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px 14px',
  minWidth: 0,
}

const tableNumberStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#58d7ff',
  fontWeight: 700,
  textTransform: 'uppercase',
}

const playerNameStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 650,
  color: '#f2f7ff',
  minWidth: 0,
}

const vsStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#516b9a',
  fontWeight: 700,
  textTransform: 'uppercase',
}

const standingsHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr 52px 48px 48px 48px',
  gap: '6px',
  padding: '6px 12px',
  fontSize: '11px',
  color: '#7c9ad0',
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
  color: '#f2f7ff',
}

const positionStyle: React.CSSProperties = {
  color: '#58d7ff',
  textAlign: 'center',
  fontSize: '13px',
  fontWeight: 700,
}

const scoreStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 750,
  color: '#f2f7ff',
}

const mutedScoreStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#7c9ad0',
}

const footerStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  paddingTop: '1rem',
  borderTop: '1px solid #0d274f',
  fontSize: '11px',
  color: '#516b9a',
  textAlign: 'center',
}
