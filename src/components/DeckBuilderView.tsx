import { useEffect, useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import {
  getAdvancedCardFilterOptions,
  getCardFilterOptions,
  searchCards,
  type CardSearchFilters,
  type CardSuggestion,
} from '../services/cardSearch'
import { useExportImage } from '../hooks/useExportImage'
import type { DeckList, TournamentTCG } from '../types/tournament'
import { deckRuleConfigs, getDefaultSection, validateDeck } from '../utils/deckRules'

interface DeckCard {
  id: string
  cardId: string
  name: string
  subtitle?: string
  imageUrl?: string
  kind?: string
  section: string
  quantity: number
}

export function DeckBuilderView() {
  const tournamentId = new URLSearchParams(window.location.search).get('torneo') ?? ''
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const submitDecklist = useTournamentsStore(s => s.submitDecklist)
  const publishDecklist = useTournamentsStore(s => s.publishDecklist)
  const [playerId, setPlayerId] = useState('')
  const [deckName, setDeckName] = useState('')
  const [deckNotes, setDeckNotes] = useState('')
  const [query, setQuery] = useState('')
  const [searchKind, setSearchKind] = useState('')
  const [searchText, setSearchText] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState<Partial<CardSearchFilters>>({})
  const [onlyImages, setOnlyImages] = useState(true)
  const [results, setResults] = useState<CardSuggestion[]>([])
  const [cards, setCards] = useState<DeckCard[]>([])
  const [exportDeck, setExportDeck] = useState<DeckList | null>(null)
  const [exportCards, setExportCards] = useState<DeckCard[]>([])
  const [saveStatus, setSaveStatus] = useState('')
  const { ref: exportRef, exportImage } = useExportImage()

  const latestDecks = useMemo(() => {
    const latestByPlayer = new Map<string, DeckList>()
    for (const deck of tournament?.decklists ?? []) {
      const current = latestByPlayer.get(deck.playerId)
      if (!current || deck.updatedAt >= current.updatedAt) latestByPlayer.set(deck.playerId, deck)
    }
    return [...latestByPlayer.values()].sort((a, b) => a.playerName.localeCompare(b.playerName))
  }, [tournament?.decklists])

  useEffect(() => {
    if (!tournament || tournament.tcg === 'riftbound' || query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void searchCards(tournament.tcg, query, controller.signal, { ...advancedFilters, kind: searchKind, onlyImages, text: searchText })
        .then(setResults)
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setResults([])
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [advancedFilters, onlyImages, query, searchKind, searchText, tournament])

  if (!tournamentId) return <BuilderEmpty icon="ti-link-off" title="Falta torneo" text="Abre el constructor desde un torneo finalizado." />
  if (!tournament) return <BuilderEmpty icon="ti-loader-2" title="Cargando torneo" text="Sincronizando datos del evento." />
  if (tournament.status !== 'finished') {
    return <BuilderEmpty icon="ti-lock" title="Decklists bloqueadas" text="El constructor se activa cuando el torneo esta finalizado." />
  }

  const currentTournament = tournament
  const rules = deckRuleConfigs[currentTournament.tcg]
  const sections = rules.sections.map(section => section.id)
  const warnings = validateDeck(currentTournament.tcg, cards)
  const filterOptions = getCardFilterOptions(currentTournament.tcg)
  const advancedFilterOptions = getAdvancedCardFilterOptions(currentTournament.tcg)
  const selectedPlayer = currentTournament.players.find(player => player.id === playerId) ?? null

  function handlePlayerChange(nextPlayerId: string) {
    setPlayerId(nextPlayerId)
    const existingDeck = [...(currentTournament.decklists ?? [])].reverse().find(deck => deck.playerId === nextPlayerId)
    setDeckName(existingDeck?.name ?? '')
    setDeckNotes(existingDeck?.notes ?? '')
    setCards(existingDeck ? parseDeckCards(existingDeck.list, sections[0]) : [])
  }

  function addCard(card: CardSuggestion, section = getDefaultSection(currentTournament.tcg, card)) {
    setCards(current => {
      const existing = current.find(item => item.cardId === card.id && item.section === section)
      if (existing) {
        return current.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item)
      }

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          cardId: card.id,
          name: card.name,
          subtitle: card.subtitle,
          imageUrl: card.imageUrl,
          kind: card.kind,
          section,
          quantity: 1,
        },
      ]
    })
  }

  function addManualCard(section = sections[0]) {
    const name = query.trim()
    if (!name) return
    addCard({ id: `manual:${name.toLowerCase()}`, name }, section === sections[0] ? getDefaultSection(currentTournament.tcg, { name }) : section)
    setQuery('')
  }

  function moveCard(cardId: string, section: string) {
    setCards(current => current.map(card => card.id === cardId ? { ...card, section } : card))
  }

  function moveCardOrder(cardId: string, direction: -1 | 1) {
    setCards(current => {
      const index = current.findIndex(card => card.id === cardId)
      if (index === -1) return current

      const card = current[index]
      const sectionCards = current
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(item => item.candidate.section === card.section)
      const sectionIndex = sectionCards.findIndex(item => item.candidate.id === cardId)
      const target = sectionCards[sectionIndex + direction]
      if (!target) return current

      const next = [...current]
      next[index] = target.candidate
      next[target.candidateIndex] = card
      return next
    })
  }

  function reorderCard(cardId: string, targetCardId: string) {
    if (cardId === targetCardId) return
    setCards(current => {
      const fromIndex = current.findIndex(card => card.id === cardId)
      const targetIndex = current.findIndex(card => card.id === targetCardId)
      if (fromIndex === -1 || targetIndex === -1) return current

      const moved = current[fromIndex]
      const target = current[targetIndex]
      const next = current.filter(card => card.id !== cardId)
      const insertIndex = next.findIndex(card => card.id === targetCardId)
      next.splice(insertIndex, 0, { ...moved, section: target.section })
      return next
    })
  }

  function updateQuantity(cardId: string, quantity: number) {
    if (quantity <= 0) {
      setCards(current => current.filter(card => card.id !== cardId))
      return
    }
    setCards(current => current.map(card => card.id === cardId ? { ...card, quantity } : card))
  }

  function sortSection(section: string, mode: 'name' | 'quantity' | 'type') {
    setCards(current => {
      const target = current.filter(card => card.section === section)
      const sorted = [...target].sort((a, b) => {
        if (mode === 'quantity') return b.quantity - a.quantity || a.name.localeCompare(b.name)
        if (mode === 'type') return (a.kind ?? '').localeCompare(b.kind ?? '') || a.name.localeCompare(b.name)
        return a.name.localeCompare(b.name)
      })
      let index = 0
      return current.map(card => card.section === section ? sorted[index++] : card)
    })
  }

  function getCopyWarning(card: DeckCard) {
    const limit = rules.copyLimit
    if (!limit) return ''
    const total = cards
      .filter(candidate => candidate.name.toLowerCase() === card.name.toLowerCase())
      .reduce((sum, candidate) => sum + candidate.quantity, 0)
    return total > limit ? `Max ${limit}` : ''
  }

  function saveDeck() {
    if (!selectedPlayer || !deckName.trim() || cards.length === 0) {
      setSaveStatus('Completa jugador, nombre y cartas.')
      return
    }
    setSaveStatus('Guardando...')
    submitDecklist(currentTournament.id, selectedPlayer.id, {
      name: deckName,
      list: formatDeckCards(cards, sections, true),
      notes: deckNotes,
    })
    setSaveStatus('Guardado')
    window.setTimeout(() => setSaveStatus(''), 2200)
  }

  function importDeckText() {
    const text = window.prompt('Pega una decklist en texto')
    if (!text) return
    setCards(parseDeckCards(text, sections[0]))
  }

  async function exportCurrentDeckImage() {
    if (!selectedPlayer || !deckName.trim() || cards.length === 0) return
    const hydratedCards = await hydrateMissingImages(cards, currentTournament.tcg)
    setExportDeck({
      id: 'current',
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      game: currentTournament.tcg,
      name: deckName,
      list: formatDeckCards(hydratedCards, sections),
      notes: deckNotes,
      status: 'submitted',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setExportCards(hydratedCards)
    await waitFrame()
    await exportImage(`deck-${selectedPlayer.name}-${deckName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }

  async function exportSavedDeckImage(deck: DeckList) {
    const hydratedCards = await hydrateMissingImages(parseDeckCards(deck.list, sections[0]), currentTournament.tcg)
    setExportDeck(deck)
    setExportCards(hydratedCards)
    await waitFrame()
    await exportImage(`deck-${deck.playerName}-${deck.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }

  return (
    <div className="deck-builder-page">
      <header className="deck-builder-top">
        <div>
          <span>{rules.label}</span>
          <h1>{currentTournament.name}</h1>
          <p>Constructor bloqueado al juego del torneo</p>
        </div>
        <button onClick={() => window.close()}>
          <i className="ti ti-x" aria-hidden="true" />
          Cerrar
        </button>
      </header>

      <div className="deck-builder-toolbar">
        <button onClick={importDeckText}>
          <i className="ti ti-file-import" aria-hidden="true" />
          Importar
        </button>
        <button onClick={exportCurrentDeckImage} disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}>
          <i className="ti ti-photo-down" aria-hidden="true" />
          Exportar
        </button>
        <button onClick={saveDeck} disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}>
          <i className="ti ti-edit" aria-hidden="true" />
          Guardar
        </button>
        <button onClick={() => setCards([])} disabled={cards.length === 0}>
          <i className="ti ti-trash" aria-hidden="true" />
          Vaciar
        </button>
      </div>

      <section className="deck-builder-controls">
        <select value={playerId} onChange={event => handlePlayerChange(event.target.value)}>
          <option value="">Jugador</option>
          {currentTournament.players.map(player => (
            <option key={player.id} value={player.id}>{player.name}</option>
          ))}
        </select>
        <input value={deckName} onChange={event => setDeckName(event.target.value)} placeholder="Nombre del mazo" />
        <input value={deckNotes} onChange={event => setDeckNotes(event.target.value)} placeholder="Notas para redes" />
        <button onClick={saveDeck} disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}>
          <i className="ti ti-device-floppy" aria-hidden="true" />
          Guardar
        </button>
        <button onClick={exportCurrentDeckImage} disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}>
          <i className="ti ti-photo-down" aria-hidden="true" />
          Imagen
        </button>
        {saveStatus && <span className="deck-save-status">{saveStatus}</span>}
      </section>

      <section className="deck-builder-rulebar">
        <div>
          <strong>Total</strong>
          <span>{cards.reduce((sum, card) => sum + card.quantity, 0)} cartas</span>
        </div>
        {rules.sections.map(section => (
          <div key={section.id}>
            <strong>{section.label}</strong>
            <span>{cards.filter(card => card.section === section.id).reduce((sum, card) => sum + card.quantity, 0)} cartas</span>
          </div>
        ))}
        {warnings.length > 0 && (
          <div className="deck-rule-warning">
            <strong>Avisos</strong>
            <span>{warnings.slice(0, 3).join(' · ')}</span>
          </div>
        )}
      </section>

      <div className="deck-builder-layout">
        <aside className="deck-search-panel">
          <div className="deck-search-box">
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={currentTournament.tcg === 'riftbound' ? 'Carta manual' : 'Buscar carta'}
            />
            <button onClick={() => addManualCard()} disabled={!query.trim()}>
              <i className="ti ti-plus" aria-hidden="true" />
            </button>
          </div>

          <div className="deck-search-filters">
            {filterOptions.length > 0 && (
              <select value={searchKind} onChange={event => setSearchKind(event.target.value)}>
                {filterOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
            <label>
              <input
                type="checkbox"
                checked={onlyImages}
                onChange={event => setOnlyImages(event.target.checked)}
              />
              Con imagen
            </label>
          </div>

          {advancedFilterOptions.length > 0 && (
            <div className="deck-search-advanced-filters">
              {advancedFilterOptions.map(filter => (
                <select
                  key={filter.key}
                  value={String(advancedFilters[filter.key] ?? '')}
                  onChange={event => setAdvancedFilters(current => ({ ...current, [filter.key]: event.target.value }))}
                  aria-label={filter.label}
                >
                  {filter.options.map(option => (
                    <option key={option.value} value={option.value}>{filter.label}: {option.label}</option>
                  ))}
                </select>
              ))}
            </div>
          )}

          <input
            className="deck-search-text-filter"
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Texto en la descripcion"
          />

          <div className="deck-search-results">
            {results.map(card => (
              <button
                key={card.id}
                draggable
                onDragStart={event => event.dataTransfer.setData('application/x-card', JSON.stringify(card))}
                onClick={() => addCard(card)}
                className="deck-search-card"
              >
                {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <div className="deck-card-placeholder" />}
                <span>{card.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="deck-zone-grid">
          {rules.sections.map(section => (
            <DeckZone
              key={section.id}
              label={section.label}
              cards={cards.filter(card => card.section === section.id)}
              onDropCard={card => addCard(card, section.id)}
              onMoveCard={cardId => moveCard(cardId, section.id)}
              onReorderCard={reorderCard}
              onMoveOrder={moveCardOrder}
              onQuantityChange={updateQuantity}
              getCopyWarning={getCopyWarning}
              onSort={mode => sortSection(section.id, mode)}
            />
          ))}
        </main>

        <aside className="deck-review-panel">
          <strong>Listas guardadas</strong>
          {latestDecks.length === 0 ? (
            <span>No hay listas todavia.</span>
          ) : latestDecks.map(deck => (
            <article key={deck.id}>
              <div>
                <strong>{deck.name}</strong>
                <span>{deck.playerName}</span>
              </div>
              <button onClick={() => publishDecklist(currentTournament.id, deck.id, deck.status !== 'published')}>
                {deck.status === 'published' ? 'Ocultar' : 'Publicar'}
              </button>
              <button onClick={() => void exportSavedDeckImage(deck)}>
                Imagen
              </button>
            </article>
          ))}
        </aside>
      </div>

      <div style={exportHiddenStyle}>
        <DeckImageExport
          ref={exportRef}
          tournamentName={currentTournament.name}
          deck={exportDeck}
          cards={exportCards}
          sections={sections}
        />
      </div>
    </div>
  )
}

function DeckZone({
  label,
  cards,
  onDropCard,
  onMoveCard,
  onReorderCard,
  onMoveOrder,
  onQuantityChange,
  getCopyWarning,
  onSort,
}: {
  label: string
  cards: DeckCard[]
  onDropCard: (card: CardSuggestion) => void
  onMoveCard: (cardId: string) => void
  onReorderCard: (cardId: string, targetCardId: string) => void
  onMoveOrder: (cardId: string, direction: -1 | 1) => void
  onQuantityChange: (cardId: string, quantity: number) => void
  getCopyWarning: (card: DeckCard) => string
  onSort: (mode: 'name' | 'quantity' | 'type') => void
}) {
  const total = cards.reduce((sum, card) => sum + card.quantity, 0)
  const [dragTargetId, setDragTargetId] = useState('')

  return (
    <section
      className="deck-zone"
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault()
        const cardPayload = event.dataTransfer.getData('application/x-card')
        const deckCardId = event.dataTransfer.getData('application/x-deck-card')
        if (cardPayload) onDropCard(JSON.parse(cardPayload) as CardSuggestion)
        if (deckCardId) onMoveCard(deckCardId)
      }}
    >
      <header>
        <strong>{label}</strong>
        <div className="deck-zone-tools">
          <button onClick={() => onSort('name')}>Nombre</button>
          <button onClick={() => onSort('quantity')}>Copias</button>
          <button onClick={() => onSort('type')}>Tipo</button>
          <span>{total}</span>
        </div>
      </header>
      <div className="deck-card-grid">
        {cards.flatMap(card => Array.from({ length: card.quantity }, (_, copyIndex) => ({ card, copyIndex }))).map(({ card, copyIndex }) => {
          const copyWarning = getCopyWarning(card)
          const isDropTarget = dragTargetId === card.id && copyIndex === 0
          return (
          <article
            key={`${card.id}-${copyIndex}`}
            className={isDropTarget ? 'deck-card-tile compact drop-target' : 'deck-card-tile compact'}
            draggable
            onDragStart={event => {
              event.dataTransfer.setData('application/x-deck-card', card.id)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={event => {
              event.preventDefault()
              const deckCardId = event.dataTransfer.getData('application/x-deck-card')
              if (deckCardId && deckCardId !== card.id) setDragTargetId(card.id)
            }}
            onDragLeave={() => {
              if (dragTargetId === card.id) setDragTargetId('')
            }}
            onDrop={event => {
              event.preventDefault()
              const deckCardId = event.dataTransfer.getData('application/x-deck-card')
              if (deckCardId) onReorderCard(deckCardId, card.id)
              setDragTargetId('')
            }}
            onDragEnd={() => setDragTargetId('')}
          >
            {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <div className="deck-card-placeholder">{card.name}</div>}
            {copyWarning && copyIndex === 0 && <em>{copyWarning}</em>}
            {copyIndex === 0 && (
              <div className="deck-card-order">
                <button onClick={() => onMoveOrder(card.id, -1)} aria-label={`Subir ${card.name}`}>
                <i className="ti ti-chevron-up" aria-hidden="true" />
                </button>
                <button onClick={() => onMoveOrder(card.id, 1)} aria-label={`Bajar ${card.name}`}>
                <i className="ti ti-chevron-down" aria-hidden="true" />
                </button>
                <button onClick={() => onQuantityChange(card.id, card.quantity + 1)} aria-label={`Anadir copia de ${card.name}`}>
                  <i className="ti ti-plus" aria-hidden="true" />
                </button>
                <button onClick={() => onQuantityChange(card.id, card.quantity - 1)} aria-label={`Quitar copia de ${card.name}`}>
                  <i className="ti ti-minus" aria-hidden="true" />
                </button>
              </div>
            )}
          </article>
        )})}
      </div>
    </section>
  )
}

function BuilderEmpty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="empty-state">
      <i className={`ti ${icon}`} aria-hidden="true" />
      <div>{title}</div>
      <p style={{ marginTop: 6 }}>{text}</p>
    </div>
  )
}

function DeckImageExport({
  ref,
  tournamentName,
  deck,
  cards,
  sections,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  tournamentName: string
  deck: DeckList | null
  cards: DeckCard[]
  sections: string[]
}) {
  if (!deck) return <div ref={ref} />

  return (
    <div ref={ref} className="deck-export-card">
      <header>
        <img src="/subterra-logo.jpg" alt="" />
        <div>
          <span>{tournamentName}</span>
          <h2>{deck.name}</h2>
          <p>{deck.playerName} · {deckRuleConfigs[deck.game].label}</p>
        </div>
      </header>

      <div className="deck-export-body">
        {sections.map(section => {
          const sectionCards = cards.filter(card => card.section === section)
          if (!sectionCards.length) return null
          return (
            <section key={section}>
              <h3>{section} · {sectionCards.reduce((sum, card) => sum + card.quantity, 0)}</h3>
              <div className="deck-export-card-grid">
                {expandCards(sectionCards).map((card, index) => (
                  <div
                    key={`${card.id}-${index}`}
                    className="deck-export-card-tile"
                    style={card.imageUrl ? { backgroundImage: `url("${card.imageUrl}")` } : undefined}
                  >
                    <div className="deck-export-card-fallback">{card.name}</div>
                    {card.imageUrl && <img src={card.imageUrl} alt="" crossOrigin="anonymous" />}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {deck.notes && <footer>{deck.notes}</footer>}
    </div>
  )
}

function parseDeckCards(list: string, fallbackSection: string): DeckCard[] {
  const cards: DeckCard[] = []
  let section = fallbackSection

  list.split('\n').forEach(rawLine => {
    const line = rawLine.trim()
    if (!line) return
    if (line.endsWith(':')) {
      section = line.slice(0, -1)
      return
    }

    const match = line.match(/^(\d+)\s+(.+)$/)
    const rawName = match?.[2] ?? line
    const metadataMatch = rawName.match(/^(.*?)\s+\[(.+?)\]$/)
    const name = metadataMatch?.[1] ?? rawName
    const metadata = metadataMatch ? parseCardMetadata(metadataMatch[2]) : {}
    cards.push({
      id: crypto.randomUUID(),
      cardId: metadata.cardId ?? `saved:${section}:${name}`,
      section,
      quantity: Number(match?.[1] ?? 1),
      name,
      subtitle: metadata.subtitle,
      imageUrl: metadata.imageUrl,
      kind: metadata.kind,
    })
  })

  return cards
}

function formatDeckCards(cards: DeckCard[], sections: string[], includeMetadata = false) {
  return sections
    .map(section => {
      const sectionCards = cards.filter(card => card.section === section)
      if (!sectionCards.length) return ''
      return [
        `${section}:`,
        ...sectionCards.map(card => `${card.quantity} ${formatDeckCardLine(card, includeMetadata)}`),
      ].join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

function formatDeckCardLine(card: DeckCard, includeMetadata: boolean) {
  if (!includeMetadata) return card.name
  const metadata = [
    `id=${encodeURIComponent(card.cardId)}`,
    card.imageUrl ? `img=${encodeURIComponent(card.imageUrl)}` : '',
    card.subtitle ? `sub=${encodeURIComponent(card.subtitle)}` : '',
    card.kind ? `kind=${encodeURIComponent(card.kind)}` : '',
  ].filter(Boolean).join('|')

  return metadata ? `${card.name} [${metadata}]` : card.name
}

function parseCardMetadata(value: string) {
  return Object.fromEntries(
    value.split('|').map(part => {
      const [key, raw = ''] = part.split('=')
      return [key === 'id' ? 'cardId' : key === 'img' ? 'imageUrl' : key === 'sub' ? 'subtitle' : key, decodeURIComponent(raw)]
    })
  ) as Partial<Pick<DeckCard, 'cardId' | 'imageUrl' | 'subtitle' | 'kind'>>
}

function expandCards(cards: DeckCard[]) {
  return cards.flatMap(card => Array.from({ length: card.quantity }, () => card))
}

async function hydrateMissingImages(cards: DeckCard[], game: TournamentTCG) {
  if (game === 'riftbound') return cards

  const hydrated = await Promise.all(cards.map(async card => {
    if (card.imageUrl) {
      const imageUrl = normalizeExportImageUrl(card.imageUrl)
      const exportableImageUrl = await toDataUrl(imageUrl).catch(() => imageUrl)
      return { ...card, imageUrl: exportableImageUrl }
    }

    const exactSuggestions = await searchCards(game, card.name, undefined, { onlyImages: true, exact: true }).catch(() => [])
    const looseSuggestions = exactSuggestions.length
      ? exactSuggestions
      : await searchCards(game, card.name, undefined, { onlyImages: true }).catch(() => [])
    const suggestions = looseSuggestions
    const exact = suggestions.find(candidate => candidate.name.toLowerCase() === card.name.toLowerCase())
    const match = exact ?? suggestions[0]
    const rawImageUrl = match?.imageUrl ?? getKnownImageUrl(game, match?.id ?? card.cardId)
    if (!match || !rawImageUrl) return card
    const imageUrl = normalizeExportImageUrl(rawImageUrl)

    const exportableImageUrl = await toDataUrl(imageUrl).catch(() => imageUrl)

    return {
      ...card,
      cardId: match.id,
      subtitle: match.subtitle,
      imageUrl: exportableImageUrl,
    }
  }))

  return hydrated
}

async function toDataUrl(url: string) {
  const response = await fetch(normalizeExportImageUrl(url), { mode: 'cors' })
  if (!response.ok) throw new Error('No se pudo cargar la imagen')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function normalizeExportImageUrl(url: string) {
  if (!url.includes('ygoprodeck.com')) return url
  if (url.includes('images.weserv.nl')) return url
  const cleanUrl = url.replace(/^https?:\/\//, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`
}

function getKnownImageUrl(game: TournamentTCG, cardId: string) {
  if (game !== 'yugioh') return undefined
  const numericId = cardId.split(':').pop()
  return numericId && /^\d+$/.test(numericId)
    ? `https://images.ygoprodeck.com/images/cards/${numericId}.jpg`
    : undefined
}

function waitFrame() {
  return new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

const exportHiddenStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  transform: 'translateX(-140vw)',
}
