import { useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Player, TournamentTeamMode } from '../types/tournament'

interface PlayerListProps {
  tournamentId: string
}

export function PlayerList({ tournamentId }: PlayerListProps) {
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const { addPlayer, removePlayer } = useTournamentsStore()
  const { standings, totalRounds } = useSwissPairings(tournamentId)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [teamModalOpen, setTeamModalOpen] = useState(false)

  const players = tournament?.players ?? []
  const status = tournament?.status ?? 'setup'
  const teamMode = tournament?.teamMode ?? 'solo'
  const isSetup = status === 'setup'
  const isTeamMode = teamMode === '2v2' || teamMode === '3v3'
  const participantSingular = isTeamMode ? 'equipo' : 'jugador'
  const participantPlural = isTeamMode ? 'equipos' : 'jugadores'
  const participantTitle = isTeamMode ? 'Equipos' : 'Jugadores'
  const teamModeHint = teamMode === '2v2'
    ? 'Registra cada pareja como un equipo, con capitan.'
    : teamMode === '3v3'
      ? 'Registra cada trio como un equipo, con capitan.'
      : 'Registra participantes individuales.'

  function addSoloPlayer() {
    const name = input.trim()
    if (!name) return
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      setError(`Ya existe un ${participantSingular} con ese nombre`)
      return
    }
    addPlayer(tournamentId, name)
    setInput('')
    setError('')
  }

  function addTeam(teamName: string, members: string[], captainName: string) {
    if (players.find(p => p.name.toLowerCase() === teamName.toLowerCase())) {
      setError('Ya existe un equipo con ese nombre')
      return false
    }
    addPlayer(tournamentId, teamName, { members, captainName })
    setError('')
    return true
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !isTeamMode) addSoloPlayer()
    if (e.key === 'Escape') { setInput(''); setError('') }
  }

  return (
    <div>
      {isSetup && (
        <div className="setup-card player-entry-card" style={cardStyle}>
          <div className="player-card-header">
            <div style={cardTitleStyle}>
              <i className="ti ti-user-plus" aria-hidden="true" /> Anadir {participantPlural}
            </div>
            <span>{teamModeHint}</span>
          </div>

          {isTeamMode ? (
            <div className="player-add-form" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setTeamModalOpen(true)} style={btnStyle} title="Anade nombre del equipo, jugadores y capitan">
                <i className="ti ti-users-group" aria-hidden="true" /> Anadir equipo {getTeamSize(teamMode)}vs{getTeamSize(teamMode)}
              </button>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                El equipo es el participante del suizo; sus jugadores tendran decklists separadas.
              </span>
            </div>
          ) : (
            <div className="player-add-form" style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                placeholder="Nombre del jugador..."
                autoComplete="off"
                style={inputStyle(error)}
              />
              <button onClick={addSoloPlayer} disabled={!input.trim()} style={btnStyle} title="Registra un jugador manualmente en el torneo">
                <i className="ti ti-plus" aria-hidden="true" /> Anadir jugador
              </button>
            </div>
          )}

          {error && <FormError message={error} />}
        </div>
      )}

      <div className="setup-card player-list-card" style={cardStyle}>
        <div style={listHeaderStyle}>
          <span style={cardTitleStyle}>
            <i className="ti ti-users" aria-hidden="true" /> {participantTitle}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            {players.length} {participantPlural} - {totalRounds} rondas estimadas
          </span>
        </div>

        {players.length === 0 ? (
          <div className="player-empty-state">
            <i className="ti ti-user-off" aria-hidden="true" />
            <div>Sin {participantPlural} aun</div>
            <span>Anade al menos 2 {participantPlural} para iniciar.</span>
          </div>
        ) : isSetup ? (
          <div className="setup-player-list">
            {players.map((p, i) => (
              <SetupPlayerRow
                key={p.id}
                player={p}
                index={i + 1}
                isTeamMode={isTeamMode}
                participantSingular={participantSingular}
                onRemove={() => removePlayer(tournamentId, p.id)}
              />
            ))}
          </div>
        ) : (
          <div>
            <StandingsHeader participantTitle={participantTitle} />
            {standings.map(row => (
              <ActivePlayerRow
                key={row.player.id}
                player={row.player}
                position={row.position}
                isEliminated={row.isEliminated}
                isTeamMode={isTeamMode}
              />
            ))}
          </div>
        )}
      </div>

      {teamModalOpen && (
        <TeamModal
          mode={teamMode}
          onClose={() => setTeamModalOpen(false)}
          onSave={(teamName, members, captainName) => {
            const saved = addTeam(teamName, members, captainName)
            if (saved) setTeamModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function TeamModal({ mode, onClose, onSave }: {
  mode: TournamentTeamMode
  onClose: () => void
  onSave: (teamName: string, members: string[], captainName: string) => void
}) {
  const size = getTeamSize(mode)
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState(() => Array.from({ length: size }, () => ''))
  const [captainIndex, setCaptainIndex] = useState(0)
  const [error, setError] = useState('')
  const cleanMembers = useMemo(() => members.map(member => member.trim()).filter(Boolean), [members])

  function updateMember(index: number, value: string) {
    setMembers(current => current.map((member, memberIndex) => memberIndex === index ? value : member))
    setError('')
  }

  function save() {
    const cleanTeamName = teamName.trim()
    if (!cleanTeamName) {
      setError('Pon nombre al equipo.')
      return
    }
    if (cleanMembers.length !== size) {
      setError(`Completa los ${size} jugadores del equipo.`)
      return
    }
    onSave(cleanTeamName, cleanMembers, members[captainIndex]?.trim() || cleanMembers[0])
  }

  return (
    <div className="team-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="team-modal-card" role="dialog" aria-modal="true" aria-label="Anadir equipo" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <span>Nuevo equipo {size}vs{size}</span>
            <strong>Equipo y capitan</strong>
          </div>
          <button onClick={onClose} aria-label="Cerrar"><i className="ti ti-x" aria-hidden="true" /></button>
        </header>

        <label>
          Nombre del equipo
          <input value={teamName} onChange={event => { setTeamName(event.target.value); setError('') }} placeholder="Equipo Subterra" />
        </label>

        <div className="team-member-list">
          {members.map((member, index) => (
            <label key={index}>
              Jugador {index + 1}
              <div>
                <input value={member} onChange={event => updateMember(index, event.target.value)} placeholder={`Nombre jugador ${index + 1}`} />
                <button type="button" className={captainIndex === index ? 'active' : ''} onClick={() => setCaptainIndex(index)}>
                  Capitan
                </button>
              </div>
            </label>
          ))}
        </div>

        {error && <FormError message={error} />}

        <footer>
          <button onClick={onClose}>Cancelar</button>
          <button onClick={save}>Guardar equipo</button>
        </footer>
      </div>
    </div>
  )
}

function SetupPlayerRow({
  player,
  index,
  isTeamMode,
  participantSingular,
  onRemove,
}: {
  player: Player
  index: number
  isTeamMode: boolean
  participantSingular: string
  onRemove: () => void
}) {
  return (
    <div className="setup-player-row">
      <span className="setup-player-index">{index}</span>
      <div className="setup-player-copy">
        <span className="setup-player-name">{player.name}</span>
        {isTeamMode && player.teamMembers?.length ? (
          <small>Capitan: {player.captainName ?? player.teamMembers[0]} - {player.teamMembers.join(' / ')}</small>
        ) : null}
      </div>
      <button onClick={onRemove} style={rowButtonStyle} title={`Quitar a ${player.name} del torneo`} aria-label={`Quitar ${participantSingular} ${player.name}`}>
        <i className="ti ti-trash" aria-hidden="true" />
        <span>Quitar</span>
      </button>
    </div>
  )
}

function StandingsHeader({ participantTitle }: { participantTitle: string }) {
  return (
    <div style={standingsGridStyle}>
      <span>#</span><span>{participantTitle.slice(0, -1)}</span>
      <span style={{ textAlign: 'center' }}>Pts</span>
      <span style={{ textAlign: 'center' }}>V</span>
      <span style={{ textAlign: 'center' }}>E</span>
      <span style={{ textAlign: 'center' }}>D</span>
    </div>
  )
}

function ActivePlayerRow({ player, position, isEliminated, isTeamMode }: { player: Player; position: number; isEliminated: boolean; isTeamMode: boolean }) {
  const medals: Record<number, string> = { 1: '1', 2: '2', 3: '3' }

  return (
    <div style={{ ...standingsGridStyle, alignItems: 'center', padding: '7px 10px', borderRadius: 'var(--border-radius-md)', background: position % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent', opacity: isEliminated ? 0.5 : 1 }}>
      <span style={{ fontSize: '13px', textAlign: 'center' }}>{medals[position] ?? <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{position}</span>}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
        {isTeamMode && player.captainName && <Badge label={`Cap. ${player.captainName}`} bg="var(--color-draw-bg)" color="var(--color-accent-secondary)" border="var(--color-border-primary)" />}
        {isEliminated && <Badge label="eliminado" bg="var(--color-danger-bg)" color="var(--color-text-danger)" border="var(--color-border-danger)" />}
        {player.timeoutLosses > 0 && <Badge label={`T ${player.timeoutLosses}`} bg="var(--color-warning-bg)" color="var(--color-text-warning)" border="var(--color-border-warning)" />}
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
  return <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--border-radius-md)', background: bg, color, border: `0.5px solid ${border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
}

function FormError({ message }: { message: string }) {
  return <div style={{ fontSize: '12px', color: 'var(--color-text-danger)', marginTop: '6px' }}><i className="ti ti-alert-circle" aria-hidden="true" /> {message}</div>
}

function getTeamSize(mode: TournamentTeamMode) {
  if (mode === '2v2') return 2
  if (mode === '3v3') return 3
  return 1
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '.85rem 1rem',
  marginBottom: '.65rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.55rem',
}

function inputStyle(error: string): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 10px',
    fontSize: '13px',
    border: `0.5px solid ${error ? 'var(--color-border-danger)' : 'var(--color-border-tertiary)'}`,
    borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    outline: 'none',
  }
}

const btnStyle: React.CSSProperties = {
  padding: '8px 12px',
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

const rowButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '12px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
}

const listHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '.55rem',
  gap: '8px',
}

const standingsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr 44px 44px 44px 44px',
  gap: '4px',
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
}
