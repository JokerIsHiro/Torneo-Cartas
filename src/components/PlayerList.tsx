import { useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Player } from '../types/tournament'

interface PlayerListProps {
  tournamentId: string
}

export function PlayerList({ tournamentId }: PlayerListProps) {
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const { addPlayer, removePlayer } = useTournamentsStore()
  const { standings, totalRounds } = useSwissPairings(tournamentId)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const players = tournament?.players ?? []
  const status = tournament?.status ?? 'setup'
  const isSetup = status === 'setup'

  function handleAdd() {
    const name = input.trim()
    if (!name) return
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      setError('Ya existe un jugador con ese nombre')
      return
    }
    addPlayer(tournamentId, name)
    setInput('')
    setError('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setInput(''); setError('') }
  }

  return (
    <div>
      {/* Formulario — solo en setup */}
      {isSetup && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-user-plus" aria-hidden="true" /> Añadir jugadores
          </div>
          <div className="player-add-form" style={{ display: 'flex', gap: '8px' }}>
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
                border: `0.5px solid ${error ? 'var(--color-border-danger)' : 'var(--color-border-tertiary)'}`,
                borderRadius: 'var(--border-radius-md)',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button onClick={handleAdd} disabled={!input.trim()} style={btnStyle}>
              <i className="ti ti-plus" aria-hidden="true" /> Añadir
            </button>
          </div>
          {error && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-danger)', marginTop: '6px' }}>
              <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '.75rem',
        }}>
          <span style={cardTitleStyle}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {players.map((p, i) => (
              <SetupPlayerRow
                key={p.id}
                player={p}
                index={i + 1}
                onRemove={() => removePlayer(tournamentId, p.id)}
              />
            ))}
          </div>
        ) : (
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

function SetupPlayerRow({ player, index, onRemove }: { player: Player; index: number; onRemove: () => void }) {
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
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
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
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 44px 44px 44px 44px',
      gap: '4px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: 500,
      color: 'var(--color-text-secondary)',
    }}>
      <span>#</span><span>Jugador</span>
      <span style={{ textAlign: 'center' }}>Pts</span>
      <span style={{ textAlign: 'center' }}>V</span>
      <span style={{ textAlign: 'center' }}>E</span>
      <span style={{ textAlign: 'center' }}>D</span>
    </div>
  )
}

function ActivePlayerRow({ player, position, isEliminated }: { player: Player; position: number; isEliminated: boolean }) {
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
    }}>
      <span style={{ fontSize: '13px', textAlign: 'center' }}>
        {medals[position] ?? <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{position}</span>}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <span style={{
          fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {player.name}
        </span>
        {isEliminated && <Badge label="eliminado" bg="var(--color-danger-bg)" color="var(--color-text-danger)" border="var(--color-border-danger)" />}
        {player.timeoutLosses > 0 && <Badge label={`⏱ ${player.timeoutLosses}`} bg="var(--color-warning-bg)" color="var(--color-text-warning)" border="var(--color-border-warning)" />}
        {player.byes > 0 && <Badge label="bye" bg="var(--color-draw-bg)" color="var(--color-accent-secondary)" border="var(--color-border-primary)" />}
      </div>
      <span style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>{player.points}</span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{player.wins}</span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{player.draws}</span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{player.losses}</span>
    </div>
  )
}

function Badge({ label, bg, color, border }: { label: string; bg: string; color: string; border: string }) {
  return (
    <span style={{
      fontSize: '10px', padding: '1px 6px',
      borderRadius: 'var(--border-radius-md)',
      background: bg, color, border: `0.5px solid ${border}`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '1rem 1.25rem',
  marginBottom: '.75rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.75rem',
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
}
