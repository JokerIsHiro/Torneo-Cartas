import { forwardRef } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

interface RoundExportProps {
  tournamentId: string
}

export const RoundExport = forwardRef<HTMLDivElement, RoundExportProps>(
  ({ tournamentId }, ref) => {
    const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
    const { currentMatches, standings, getPlayerName } = useSwissPairings(tournamentId)

    if (!tournament) return null

    const now = new Date().toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    return (
      <div ref={ref} style={{
        width: '640px',
        background: 'var(--color-background-primary)',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--color-text-primary)',
      }}>

        {/* Cabecera */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--color-border-tertiary)',
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>{tournament.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Ronda {tournament.currentRound} · Sistema Swiss
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
            {now}
          </div>
        </div>

        {/* Emparejamientos */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontSize: '13px', fontWeight: 600, marginBottom: '.75rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
          }}>
            Emparejamientos
          </div>

          {currentMatches.map(match => {
            const p1Name = getPlayerName(match.p1Id)
            const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)

            const resultText = (() => {
              if (!match.result)              return null
              if (match.result === 'bye')     return `${p1Name} · BYE`
              if (match.result === 'p1')      return `Gana ${p1Name}`
              if (match.result === 'p2')      return `Gana ${p2Name}`
              if (match.result === 'draw')    return 'Empate'
              if (match.result === 'timeout') return 'Tiempo agotado'
              return null
            })()

            const resultColor = (() => {
              if (!match.result)              return 'transparent'
              if (match.result === 'timeout') return 'var(--color-danger-bg)'
              if (match.result === 'draw')    return 'var(--color-draw-bg)'
              return 'var(--color-success-bg)'
            })()

            return (
              <div key={match.id} style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto 1fr auto',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                marginBottom: '6px',
                border: '1px solid var(--color-border-tertiary)',
                borderRadius: '8px',
                background: 'var(--color-background-secondary)',
              }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  M{match.tableNumber}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 500, textAlign: 'right' }}>
                  {p1Name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', padding: '0 4px' }}>vs</span>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {p2Name}
                </span>
                {resultText ? (
                  <span style={{
                    fontSize: '11px', padding: '2px 8px',
                    borderRadius: '4px', background: resultColor,
                    fontWeight: 500, whiteSpace: 'nowrap',
                  }}>
                    {resultText}
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>—</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Clasificación */}
        <div>
          <div style={{
            fontSize: '13px', fontWeight: 600, marginBottom: '.75rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
          }}>
            Clasificación
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 40px 40px 40px 40px',
            gap: '4px', padding: '4px 8px',
            fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600,
          }}>
            <span>#</span><span>Jugador</span>
            <span style={{ textAlign: 'center' }}>Pts</span>
            <span style={{ textAlign: 'center' }}>V</span>
            <span style={{ textAlign: 'center' }}>E</span>
            <span style={{ textAlign: 'center' }}>D</span>
          </div>

          {standings.map(row => (
            <div key={row.player.id} style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 40px 40px 40px 40px',
              gap: '4px', alignItems: 'center',
              padding: '7px 8px', borderRadius: '6px',
              background: row.position % 2 === 0 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
              fontSize: '13px',
            }}>
              <span style={{ color: 'var(--color-text-muted)', textAlign: 'center', fontSize: '12px' }}>
                {row.position}
              </span>
              <span style={{ fontWeight: 500 }}>{row.player.name}</span>
              <span style={{ textAlign: 'center', fontWeight: 600 }}>{row.player.points}</span>
              <span style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.wins}</span>
              <span style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.draws}</span>
              <span style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.losses}</span>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div style={{
          marginTop: '1.5rem', paddingTop: '1rem',
          borderTop: '1px solid var(--color-border-tertiary)',
          fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center',
        }}>
          Generado con Gestor de Torneos · {now}
        </div>
      </div>
    )
  }
)

RoundExport.displayName = 'RoundExport'
