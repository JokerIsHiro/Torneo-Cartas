// Plantillas ocultas para exportar rondas y clasificaciones como imagen.
// Mantener estilos inline aqui ayuda a que html2canvas capture un resultado estable.
import { forwardRef } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Match, Tournament } from '../types/tournament'

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
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const title = type === 'round' ? `Ronda ${tournament.currentRound}` : 'Clasificacion'
    const subtitle = type === 'round' ? 'Emparejamientos oficiales' : `Tras la ronda ${tournament.currentRound}`
    const hasDraws = tournament.tcg !== 'yugioh'
    const exportStandingsColumns = hasDraws
      ? '44px 1fr 64px 54px 54px 54px'
      : '44px 1fr 64px 54px 54px'

    return (
      <div ref={ref} style={exportShellStyle}>
        <ExportHeader
          tournament={tournament}
          title={title}
          subtitle={subtitle}
          date={now}
        />

        {type === 'round' && (
          <div style={pairingListStyle}>
            {currentMatches.map(match => {
              const playerNames = getMatchPlayerIds(match).map(getPlayerName)
              const isPod = playerNames.length > 2

              return (
                <div key={match.id} style={isPod ? pairingPodRowStyle : pairingRowStyle}>
                  <TableBadge tableNumber={match.tableNumber} />
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
              <span>#</span>
              <span>Jugador</span>
              <span style={{ textAlign: 'center' }}>Pts</span>
              <span style={{ textAlign: 'center' }}>V</span>
              {hasDraws && <span style={{ textAlign: 'center' }}>E</span>}
              <span style={{ textAlign: 'center' }}>D</span>
            </div>

            {standings.map(row => (
              <div key={row.player.id} style={{
                ...standingRowStyle,
                gridTemplateColumns: exportStandingsColumns,
                background: row.position % 2 === 0 ? '#02060c' : '#07101d',
              }}>
                <span style={positionStyle}>{row.position}</span>
                <span style={{ fontWeight: 700 }}>{row.player.name}</span>
                <span style={scoreStyle}>{row.player.points}</span>
                <span style={mutedScoreStyle}>{row.player.wins}</span>
                {hasDraws && <span style={mutedScoreStyle}>{row.player.draws}</span>}
                <span style={mutedScoreStyle}>{row.player.losses}</span>
              </div>
            ))}
          </div>
        )}

        <div style={footerStyle}>
          <span>SUBTERRA TCG</span>
          <span>{type === 'round' ? 'Emparejamientos' : 'Standing'} - {now}</span>
        </div>
      </div>
    )
  },
)

RoundExport.displayName = 'RoundExport'

function getMatchPlayerIds(match: Match): string[] {
  if (match.playerIds?.length) return match.playerIds
  return match.p2Id === 'BYE' ? [match.p1Id] : [match.p1Id, match.p2Id]
}

function ExportHeader({
  tournament,
  title,
  subtitle,
  date,
}: {
  tournament: Tournament
  title: string
  subtitle: string
  date: string
}) {
  return (
    <div style={headerStyle}>
      <div style={brandHeaderStyle}>
        <img src="/subterra-logo.jpg" alt="Subterra TCG" style={logoStyle} />
        <div>
          <div style={tournamentNameStyle}>{tournament.name}</div>
          <div style={titleStyle}>{title}</div>
          <div style={subtitleStyle}>{subtitle}</div>
        </div>
      </div>
      <div style={exportMetaStyle}>
        <span>{getTournamentGameLabel(tournament)}</span>
        <span>{date}</span>
      </div>
    </div>
  )
}

function TableBadge({ tableNumber }: { tableNumber: number }) {
  return (
    <span style={tableNumberStyle}>
      <em style={tableNumberLabelStyle}>Mesa</em>
      <strong style={tableNumberValueStyle}>{tableNumber}</strong>
    </span>
  )
}

function getTournamentGameLabel(tournament: Tournament) {
  if (tournament.tcg === 'magic' && tournament.magicFormat === 'commander') return 'Magic Commander'
  if (tournament.tcg === 'magic') return 'Magic'
  if (tournament.tcg === 'yugioh') return 'YuGiOh'
  if (tournament.tcg === 'one-piece') return 'One Piece'
  if (tournament.tcg === 'chess') return 'Ajedrez'
  return tournament.tcg
}

const exportShellStyle: React.CSSProperties = {
  width: '900px',
  background: '#04080f',
  padding: '28px',
  fontFamily: 'system-ui, sans-serif',
  color: '#f2f7ff',
  border: '1px solid #123a70',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '18px',
  marginBottom: '22px',
  padding: '16px 18px',
  border: '1px solid #123a70',
  borderRadius: '10px',
  background: 'linear-gradient(90deg, #07162a, #04080f 72%)',
}

const brandHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  minWidth: 0,
}

const logoStyle: React.CSSProperties = {
  width: '54px',
  height: '54px',
  objectFit: 'contain',
  background: '#000',
  border: '1px solid #123a70',
  borderRadius: '7px',
}

const tournamentNameStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#7c9ad0',
  marginBottom: '6px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '34px',
  fontWeight: 800,
  lineHeight: 1,
  color: '#f2f7ff',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#58d7ff',
  marginTop: '8px',
}

const exportMetaStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  justifyItems: 'end',
  fontSize: '12px',
  color: '#7c9ad0',
  textAlign: 'right',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const pairingListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const pairingRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '96px 1fr auto 1fr',
  alignItems: 'center',
  gap: '14px',
  padding: '16px 18px',
  border: '1px solid #123a70',
  borderRadius: '10px',
  background: 'linear-gradient(90deg, rgba(14, 48, 82, 0.72), #03060b 46%)',
}

const pairingPodRowStyle: React.CSSProperties = {
  ...pairingRowStyle,
  gridTemplateColumns: '96px 1fr',
}

const podPlayerGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px 14px',
  minWidth: 0,
}

const tableNumberStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '58px',
  border: '1px solid #2fbbff',
  borderRadius: '9px',
  background: '#061b32',
  color: '#58d7ff',
}

const tableNumberLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontStyle: 'normal',
  fontWeight: 800,
  lineHeight: 1,
  textTransform: 'uppercase',
}

const tableNumberValueStyle: React.CSSProperties = {
  color: '#f2f7ff',
  fontSize: '29px',
  lineHeight: 1,
}

const playerNameStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#f2f7ff',
  minWidth: 0,
}

const vsStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '34px',
  height: '34px',
  border: '1px solid #123a70',
  borderRadius: '50%',
  fontSize: '12px',
  color: '#58d7ff',
  fontWeight: 800,
  textTransform: 'uppercase',
}

const standingsHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px 1fr 64px 54px 54px 54px',
  gap: '6px',
  padding: '8px 14px',
  fontSize: '11px',
  color: '#7c9ad0',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const standingRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px 1fr 64px 54px 54px 54px',
  gap: '6px',
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: '8px',
  fontSize: '17px',
  color: '#f2f7ff',
}

const positionStyle: React.CSSProperties = {
  color: '#58d7ff',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: 800,
}

const scoreStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 800,
  color: '#f2f7ff',
}

const mutedScoreStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#7c9ad0',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '22px',
  paddingTop: '14px',
  borderTop: '1px solid #123a70',
  fontSize: '11px',
  color: '#516b9a',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
