import { forwardRef } from 'react'
import { useTournamentStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

export const RoundExport = forwardRef<HTMLDivElement, object>((_, ref) => {
  const { name, currentRound } = useTournamentStore()
  const { currentMatches, standings, getPlayerName } = useSwissPairings()

  const now = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div ref={ref} style={{
      width: '640px',
      background: '#ffffff',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
      color: '#1a1a1a',
    }}>

      {/* Cabecera */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e5e5',
      }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>
            Ronda {currentRound} · Sistema Swiss
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'right' }}>
          {now}
        </div>
      </div>

      {/* Emparejamientos */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#555',
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
            if (match.result === 'timeout') return '#fee2e2'
            if (match.result === 'draw')    return '#dbeafe'
            return '#dcfce7'
          })()

          return (
            <div key={match.id} style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr auto 1fr auto',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              marginBottom: '6px',
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
              background: '#fafafa',
            }}>
              <span style={{ fontSize: '11px', color: '#aaa', textAlign: 'center' }}>
                M{match.tableNumber}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500, textAlign: 'right' }}>
                {p1Name}
              </span>
              <span style={{ fontSize: '11px', color: '#bbb', padding: '0 4px' }}>vs</span>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>
                {p2Name}
              </span>
              {resultText ? (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: resultColor,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>
                  {resultText}
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: '#ccc' }}>—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Clasificación */}
      <div>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#555',
        }}>
          Clasificación
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 40px 40px 40px 40px',
          gap: '4px',
          padding: '4px 8px',
          fontSize: '11px',
          color: '#aaa',
          fontWeight: 600,
        }}>
          <span>#</span>
          <span>Jugador</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
          <span style={{ textAlign: 'center' }}>V</span>
          <span style={{ textAlign: 'center' }}>E</span>
          <span style={{ textAlign: 'center' }}>D</span>
        </div>

        {standings.map(row => (
          <div key={row.player.id} style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 40px 40px 40px 40px',
            gap: '4px',
            alignItems: 'center',
            padding: '7px 8px',
            borderRadius: '6px',
            background: row.position % 2 === 0 ? '#f9f9f9' : '#ffffff',
            fontSize: '13px',
          }}>
            <span style={{ color: '#aaa', textAlign: 'center', fontSize: '12px' }}>
              {row.position}
            </span>
            <span style={{ fontWeight: 500 }}>{row.player.name}</span>
            <span style={{ textAlign: 'center', fontWeight: 600 }}>{row.player.points}</span>
            <span style={{ textAlign: 'center', color: '#666' }}>{row.player.wins}</span>
            <span style={{ textAlign: 'center', color: '#666' }}>{row.player.draws}</span>
            <span style={{ textAlign: 'center', color: '#666' }}>{row.player.losses}</span>
          </div>
        ))}
      </div>

      {/* Pie */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px solid #f0f0f0',
        fontSize: '11px',
        color: '#ccc',
        textAlign: 'center',
      }}>
        Generado con Gestor de Torneos · {now}
      </div>
    </div>
  )
})