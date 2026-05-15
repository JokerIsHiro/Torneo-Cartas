import { useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Player } from '../types/tournament'
import { cardStyle } from '../styles/shared'

export function PlayerList() {
  const { players, status, addPlayer, removePlayer } = useTournamentStore()
  const { standings, totalRounds } = useSwissPairings()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  function handleAdd() {
    const name = input.trim()
    if (!name) return

    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      setError('Ya existe un jugador con ese nombre')
      return
    }

    addPlayer(name)
    setInput('')
    setError('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setInput(''); setError('') }
  }

  const isSetup = status === 'setup'

  return (
    <div>
      {/* Formulario de alta — solo visible en configuración */}
      {isSetup && (
        <div style={{
          ...cardStyle,
          background: 'var(--color-background-primary)',
          border: '0.5px solid black',
          borderRadius: '15px',
          padding: '1rem 1.25rem',
          marginBottom: '.75rem',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '.75rem', color: 'var(--color-text-primary)' }}>
            <i className="ti ti-user-plus" aria-hidden="true" /> Añadir jugadores
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="Nombre del jugador..."
              autoComplete="off"
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '13px',
                border: '0.5px solid black',
                borderRadius: '15px',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button onClick={handleAdd} style={btnStyle}>
              <i className="ti ti-plus" aria-hidden="true" /> Añadir
            </button>
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '6px' }}>
              <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid black',
        borderRadius: '15px',
        padding: '1rem 1.25rem',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '.75rem',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            <i className="ti ti-users" aria-hidden="true" /> Participantes
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {players.length} jugadores · {totalRounds} rondas estimadas
          </span>
        </div>

        {players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            <i className="ti ti-user-off" aria-hidden="true" />
            <div style={{ marginTop: '6px' }}>Sin jugadores aún</div>
          </div>
        ) : isSetup ? (
          // Vista de configuración: lista simple con botón de eliminar
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {players.map((p, i) => (
              <SetupPlayerRow
                key={p.id}
                player={p}
                index={i + 1}
                onRemove={() => removePlayer(p.id)}
              />
            ))}
          </div>
        ) : (
          // Vista de torneo activo: clasificación con stats
          <div>
            <StandingsHeader />
            {standings.map(row => (
              <ActivePlayerRow
                key={row.player.id}
                player={row.player}
                position={row.position}
                isEliminated={row.isEliminated}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

interface SetupPlayerRowProps {
  player: Player
  index: number
  onRemove: () => void
}

function SetupPlayerRow({ player, index, onRemove }: SetupPlayerRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 10px',
      background: 'var(--color-background-secondary)',
      borderRadius: 'var(--border-radius-md)',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '20px' }}>
        {index}
      </span>
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
        {player.name}
      </span>
      <button
        onClick={onRemove}
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-md)',
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
        aria-label={`Eliminar a ${player.name}`}
      >
        <i className="ti ti-trash" aria-hidden="true" />
      </button>
    </div>
  )
}

function StandingsHeader() {
  const cellStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    padding: '4px 10px',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 44px 44px 44px', gap: '4px', ...cellStyle }}>
      <span>#</span>
      <span>Jugador</span>
      <span style={{ textAlign: 'center' }}>Pts</span>
      <span style={{ textAlign: 'center' }}>V</span>
      <span style={{ textAlign: 'center' }}>E</span>
      <span style={{ textAlign: 'center' }}>D</span>
    </div>
  )
}

interface ActivePlayerRowProps {
  player: Player
  position: number
  isEliminated: boolean
}

function ActivePlayerRow({ player, position, isEliminated }: ActivePlayerRowProps) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 44px 44px 44px 44px',
      gap: '4px',
      alignItems: 'center',
      padding: '7px 10px',
      borderRadius: 'var(--border-radius-md)',
      background: position % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent',
      opacity: isEliminated ? 0.5 : 1,
      transition: 'opacity .2s',
    }}>

      {/* Posición */}
      <span style={{ fontSize: '13px', textAlign: 'center' }}>
        {medals[position] ?? (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{position}</span>
        )}
      </span>

      {/* Nombre + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <span style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {player.name}
        </span>
        {isEliminated && (
          <span style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: 'var(--border-radius-md)',
            background: '#FCEBEB',
            color: '#791F1F',
            border: '0.5px solid #F7C1C1',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            eliminado
          </span>
        )}
        {player.timeoutLosses > 0 && (
          <span style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: 'var(--border-radius-md)',
            background: '#FAEEDA',
            color: '#633806',
            border: '0.5px solid #FAC775',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title={`${player.timeoutLosses} ${player.timeoutLosses === 1 ? 'derrota' : 'derrotas'} por tiempo`}
          >
            <i className="ti ti-clock-off" aria-hidden="true" style={{ fontSize: '10px' }} />
            {' '}{player.timeoutLosses}
          </span>
        )}
        {player.byes > 0 && (
          <span style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: 'var(--border-radius-md)',
            background: '#E6F1FB',
            color: '#0C447C',
            border: '0.5px solid #B5D4F4',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            bye
          </span>
        )}
      </div>

      {/* Stats */}
      <span style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center', color: 'var(--color-text-primary)' }}>
        {player.points}
      </span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {player.wins}
      </span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {player.draws}
      </span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {player.losses}
      </span>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap',
}