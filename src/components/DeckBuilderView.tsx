import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTournamentsStore } from '../store/tournamentsStore'
import {
  getAdvancedCardFilterOptions,
  getCardFilterOptions,
  searchCards,
  type CardSearchFilters,
  type CardSuggestion,
} from '../services/cardSearch'
import { useExportImage } from '../hooks/useExportImage'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { DeckList, TournamentTCG } from '../types/tournament'
import { deckRuleConfigs, getDefaultSection, validateDeck } from '../utils/deckRules'
import { formatDeckCards, parseDeckImport, parseSavedDeckCards, type ImportedDeckCard } from '../utils/deckImport'
import { getOnePieceSectionFromKind, resolveOnePieceCard } from '../services/optcgApi'
import { fetchImageAsDataUrl } from '../utils/imageExport'
import { ActionButton } from './ActionButton'

type DeckCard = ImportedDeckCard
type DeckExportFormat = 'normal' | 'feed' | 'story'
type MagicFormat = 'standard' | 'pioneer' | 'modern' | 'pauper' | 'commander' | 'legacy' | 'vintage'

const magicFormatOptions: Array<{ value: MagicFormat; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'pioneer', label: 'Pioneer' },
  { value: 'modern', label: 'Modern' },
  { value: 'pauper', label: 'Pauper' },
  { value: 'commander', label: 'Commander' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'vintage', label: 'Vintage' },
]

interface SavedDeckTemplate {
  id: string
  game: TournamentTCG
  playerName: string
  name: string
  list: string
  notes: string
  updatedAt: number
}

const DECK_LIBRARY_KEY = 'subterra-deck-library-v1'

function now() {
  return Date.now()
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
  const [exportFormat, setExportFormat] = useState<DeckExportFormat>('feed')
  const [magicFormat, setMagicFormat] = useState<MagicFormat>('pauper')
  const [saveStatus, setSaveStatus] = useState('')
  const [deckLibrary, setDeckLibrary] = useState<SavedDeckTemplate[]>(loadDeckLibrary)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { ref: exportRef, exportImage } = useExportImage()
  const { standings } = useSwissPairings(tournamentId)

  const latestDecks = useMemo(() => {
    const latestByPlayer = new Map<string, DeckList>()
    for (const deck of tournament?.decklists ?? []) {
      const current = latestByPlayer.get(deck.playerId)
      if (!current || deck.updatedAt >= current.updatedAt) latestByPlayer.set(deck.playerId, deck)
    }
    return [...latestByPlayer.values()].sort((a, b) => a.playerName.localeCompare(b.playerName))
  }, [tournament?.decklists])

  const reusableDecks = useMemo(() => {
    return deckLibrary
      .filter(deck => deck.game === tournament?.tcg)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12)
  }, [deckLibrary, tournament?.tcg])

  useEffect(() => {
    if (!tournament || query.trim().length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void searchCards(tournament.tcg, query, controller.signal, {
        ...advancedFilters,
        kind: searchKind,
        onlyImages,
        text: searchText,
        format: tournament.tcg === 'magic' ? magicFormat : undefined,
      })
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
  }, [advancedFilters, magicFormat, onlyImages, query, searchKind, searchText, tournament])

  if (!tournamentId) return <BuilderEmpty icon="ti-link-off" title="Falta torneo" text="Abre el constructor desde un torneo finalizado." />
  if (!tournament) return <BuilderEmpty icon="ti-loader-2" title="Cargando torneo" text="Sincronizando datos del evento." />
  if (tournament.tcg === 'chess') {
    return <BuilderEmpty icon="ti-chess" title="Ajedrez no usa mazos" text="Este torneo no tiene constructor de decks." />
  }
  if (tournament.status !== 'finished') {
    return <BuilderEmpty icon="ti-lock" title="Decklists bloqueadas" text="El constructor se activa cuando el torneo esta finalizado." />
  }

  const currentTournament = tournament
  const rules = deckRuleConfigs[currentTournament.tcg]
  const sections = rules.sections.map(section => section.id)
  const warnings = [
    ...validateDeck(currentTournament.tcg, cards),
    ...(currentTournament.tcg === 'magic' ? getMagicFormatWarnings(cards, magicFormat) : []),
  ]
  const filterOptions = getCardFilterOptions(currentTournament.tcg)
  const advancedFilterOptions = getAdvancedCardFilterOptions(currentTournament.tcg)
  const selectedPlayer = currentTournament.players.find(player => player.id === playerId) ?? null
  const visibleResults = query.trim().length < 2 ? [] : results
  const quickSideSection = rules.sections.find(section => ['Side', 'Sideboard'].includes(section.id))

  function handlePlayerChange(nextPlayerId: string) {
    setPlayerId(nextPlayerId)
    const existingDeck = [...(currentTournament.decklists ?? [])].reverse().find(deck => deck.playerId === nextPlayerId)
    setDeckName(existingDeck?.name ?? '')
    setDeckNotes(existingDeck?.notes ?? '')
    setCards(existingDeck ? splitCardCopies(parseSavedDeckCards(currentTournament.tcg, existingDeck.list)) : [])
  }

  function addCard(card: CardSuggestion, section = getDefaultSection(currentTournament.tcg, card)) {
    if (!canPlaceCardInSection(currentTournament.tcg, card, section)) {
      showDeckStatus(`Esa carta no pertenece a ${getSectionLabel(section)}.`)
      return
    }

    setCards(current => [
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
    ])
  }

  function addManualCard(section = sections[0]) {
    const name = query.trim()
    if (!name) return
    addCard({ id: `manual:${name.toLowerCase()}`, name }, section === sections[0] ? getDefaultSection(currentTournament.tcg, { name }) : section)
    setQuery('')
  }

  function moveCard(cardId: string, section: string) {
    setCards(current => {
      const card = current.find(candidate => candidate.id === cardId)
      if (!card) return current
      if (!canPlaceCardInSection(currentTournament.tcg, card, section)) {
        showDeckStatus(`Movimiento rechazado: ${card.name} no pertenece a ${getSectionLabel(section)}.`)
        return current
      }
      return current.map(candidate => candidate.id === cardId ? { ...candidate, section } : candidate)
    })
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
      if (!canPlaceCardInSection(currentTournament.tcg, moved, target.section)) {
        showDeckStatus(`Movimiento rechazado: ${moved.name} no pertenece a ${getSectionLabel(target.section)}.`)
        return current
      }
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
    setCards(current => {
      const index = current.findIndex(card => card.id === cardId)
      if (index === -1) return current
      const card = current[index]
      if (quantity <= card.quantity) return current.map(item => item.id === cardId ? { ...item, quantity } : item)

      const copies = Array.from({ length: quantity - card.quantity }, () => ({
        ...card,
        id: crypto.randomUUID(),
        quantity: 1,
      }))
      const next = [...current]
      next.splice(index + 1, 0, ...copies)
      return next
    })
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
    const formattedList = formatDeckCards(cards, sections, true, currentTournament.tcg)
    submitDecklist(currentTournament.id, selectedPlayer.id, {
      name: deckName,
      list: formattedList,
      notes: deckNotes,
    })
    saveReusableDeck({
      id: `${currentTournament.tcg}:${selectedPlayer.name}:${deckName}`.toLowerCase(),
      game: currentTournament.tcg,
      playerName: selectedPlayer.name,
      name: deckName.trim(),
      list: formattedList,
      notes: deckNotes.trim(),
      updatedAt: now(),
    })
    setSaveStatus('Guardado')
    window.setTimeout(() => setSaveStatus(''), 2200)
  }

  function showDeckStatus(message: string) {
    setSaveStatus(message)
    window.setTimeout(() => setSaveStatus(''), 2600)
  }

  function getSectionLabel(sectionId: string) {
    return rules.sections.find(section => section.id === sectionId)?.label ?? sectionId
  }

  async function applyImportedText(text: string) {
    if (!text) return
    const result = parseDeckImport(currentTournament.tcg, text)
    setSaveStatus('Importando cartas...')
    const hydratedCards = await hydrateMissingImages(result.cards, currentTournament.tcg)
    setCards(splitCardCopies(hydratedCards))
    const importedTotal = result.cards.reduce((sum, card) => sum + card.quantity, 0)
    const withImages = hydratedCards.filter(card => card.imageUrl).length
    const ignoredSuffix = result.ignoredLines.length ? ` ${result.ignoredLines.length} lineas sin reconocer.` : ''
    const imageSuffix = currentTournament.tcg === 'one-piece'
      ? ` ${withImages}/${hydratedCards.length} con imagen y edicion.`
      : ` ${withImages}/${hydratedCards.length} con imagen.`
    setSaveStatus(`Importadas ${importedTotal} cartas.${imageSuffix}${ignoredSuffix}`)
    window.setTimeout(() => setSaveStatus(''), 3500)
  }

  function importDeckText() {
    const text = window.prompt('Pega la lista del mazo (una carta por linea, con cantidad y codigo si lo tienes)')
    if (text) void applyImportedText(text)
  }

  async function importDeckFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    await applyImportedText(text)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function loadDeckList(deck: Pick<DeckList, 'name' | 'list' | 'notes'>) {
    setDeckName(deck.name)
    setDeckNotes(deck.notes)
    setCards(splitCardCopies(parseSavedDeckCards(currentTournament.tcg, deck.list)))
    setSaveStatus('Lista cargada')
    window.setTimeout(() => setSaveStatus(''), 2200)
  }

  function saveReusableDeck(deck: SavedDeckTemplate) {
    setDeckLibrary(current => {
      const next = [deck, ...current.filter(candidate => candidate.id !== deck.id)].slice(0, 80)
      localStorage.setItem(DECK_LIBRARY_KEY, JSON.stringify(next))
      return next
    })
  }

  function deleteReusableDeck(deckId: string) {
    setDeckLibrary(current => {
      const next = current.filter(deck => deck.id !== deckId)
      localStorage.setItem(DECK_LIBRARY_KEY, JSON.stringify(next))
      return next
    })
  }

  async function exportCurrentDeckImage() {
    if (!selectedPlayer || !deckName.trim() || cards.length === 0) return
    setSaveStatus('Preparando imagenes para la exportacion...')
    const hydratedCards = await hydrateMissingImages(cards, currentTournament.tcg, true)
    const withImages = hydratedCards.filter(card => card.imageUrl?.startsWith('data:')).length
    flushSync(() => {
      setExportDeck({
        id: 'current',
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        game: currentTournament.tcg,
        name: deckName,
        list: formatDeckCards(hydratedCards, sections, false, currentTournament.tcg),
        notes: deckNotes,
        status: 'submitted',
        createdAt: now(),
        updatedAt: now(),
      })
      setExportCards(hydratedCards)
    })
    await waitForExportPaint()
    await exportImage(`deck-${selectedPlayer.name}-${deckName}-${exportFormat}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    setSaveStatus(`Imagen descargada (${withImages}/${hydratedCards.length} cartas con foto).`)
    window.setTimeout(() => setSaveStatus(''), 3500)
  }

  async function exportSavedDeckImage(deck: DeckList) {
    setSaveStatus('Preparando imagenes para la exportacion...')
    const hydratedCards = await hydrateMissingImages(parseSavedDeckCards(currentTournament.tcg, deck.list), currentTournament.tcg, true)
    flushSync(() => {
      setExportDeck(deck)
      setExportCards(hydratedCards)
    })
    await waitForExportPaint()
    await exportImage(`deck-${deck.playerName}-${deck.name}-${exportFormat}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    setSaveStatus('Imagen del mazo descargada.')
    window.setTimeout(() => setSaveStatus(''), 3500)
  }

  return (
    <div className="deck-builder-page">
      <header className="deck-builder-top">
        <div>
          <span>{rules.label}</span>
          <h1>{currentTournament.name}</h1>
          <p>Constructor bloqueado al juego del torneo</p>
        </div>
        <ActionButton onClick={() => window.close()} icon="ti-x" title="Cierra esta ventana del constructor">
          Cerrar constructor
        </ActionButton>
      </header>

      <div className="deck-builder-toolbar">
        <ActionButton onClick={importDeckText} icon="ti-file-import" title="Pega una lista copiada desde otra app">
          Pegar lista de texto
        </ActionButton>
        <ActionButton onClick={() => fileInputRef.current?.click()} icon="ti-upload" title="Importa un archivo .txt, .ydk u otro formato de lista">
          Importar desde archivo
        </ActionButton>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.ydk,.dek,.csv,text/plain"
          className="deck-file-input"
          onChange={event => void importDeckFile(event.target.files?.[0])}
        />
        <ActionButton
          onClick={exportCurrentDeckImage}
          disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}
          icon="ti-photo-down"
          title="Genera una imagen PNG lista para Instagram o WhatsApp"
        >
          Descargar imagen PNG
        </ActionButton>
        <ActionButton
          onClick={saveDeck}
          disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}
          icon="ti-device-floppy"
          title="Guarda el mazo en el torneo para este jugador"
        >
          Guardar mazo del torneo
        </ActionButton>
        <ActionButton
          onClick={() => setCards([])}
          disabled={cards.length === 0}
          icon="ti-trash"
          title="Elimina todas las cartas del editor"
        >
          Vaciar mazo actual
        </ActionButton>
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
        {currentTournament.tcg === 'magic' && (
          <select value={magicFormat} onChange={event => setMagicFormat(event.target.value as MagicFormat)}>
            {magicFormatOptions.map(option => (
              <option key={option.value} value={option.value}>Formato: {option.label}</option>
            ))}
          </select>
        )}
        <select value={exportFormat} onChange={event => setExportFormat(event.target.value as DeckExportFormat)}>
          <option value="feed">Feed vertical 4:5</option>
          <option value="story">Historias / Reels 9:16</option>
          <option value="normal">Imagen normal</option>
        </select>
        <ActionButton
          onClick={saveDeck}
          disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}
          icon="ti-device-floppy"
          title="Guarda el mazo en el torneo para este jugador"
        >
          Guardar mazo
        </ActionButton>
        <ActionButton
          onClick={exportCurrentDeckImage}
          disabled={!selectedPlayer || !deckName.trim() || cards.length === 0}
          icon="ti-photo-down"
          title="Genera una imagen PNG lista para redes"
        >
          Descargar PNG
        </ActionButton>
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
              placeholder="Buscar carta"
            />
            <ActionButton
              onClick={() => addManualCard()}
              disabled={!query.trim()}
              icon="ti-plus"
              title="Anade la carta escrita aunque no aparezca en la busqueda"
            >
              Anadir manual
            </ActionButton>
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
            {visibleResults.map(card => (
              <article
                key={card.id}
                draggable
                onDragStart={event => event.dataTransfer.setData('application/x-card', JSON.stringify(card))}
                className="deck-search-card"
              >
                {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <div className="deck-card-placeholder" />}
                <span>{card.name}</span>
                <div className="deck-search-card-actions">
                  <button onClick={() => addCard(card)} title="Anade esta carta al mazo principal">
                    <i className="ti ti-plus" aria-hidden="true" />
                    Al mazo
                  </button>
                  {quickSideSection && (
                    <button onClick={() => addCard(card, quickSideSection.id)} title="Anade esta carta al banquillo">
                      <i className="ti ti-layout-sidebar-right" aria-hidden="true" />
                      Al banquillo
                    </button>
                  )}
                </div>
              </article>
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
              canDropCard={card => canPlaceCardInSection(currentTournament.tcg, card, section.id)}
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
              <button
                onClick={() => publishDecklist(currentTournament.id, deck.id, deck.status !== 'published')}
                title={deck.status === 'published' ? 'Deja de mostrar este mazo como publicado' : 'Marca el mazo como listo para redes'}
              >
                {deck.status === 'published' ? 'Ocultar de redes' : 'Publicar en redes'}
              </button>
              <button onClick={() => loadDeckList(deck)} title="Abre esta lista en el editor">
                Abrir en editor
              </button>
              <button onClick={() => void exportSavedDeckImage(deck)} title="Descarga una imagen PNG de este mazo">
                Descargar PNG
              </button>
            </article>
          ))}

          <strong>Biblioteca</strong>
          {reusableDecks.length === 0 ? (
            <span>No hay mazos reutilizables para este juego.</span>
          ) : reusableDecks.map(deck => (
            <article key={deck.id}>
              <div>
                <strong>{deck.name}</strong>
                <span>{deck.playerName}</span>
              </div>
              <button onClick={() => loadDeckList(deck)} title="Carga esta plantilla en el editor">
                Usar plantilla
              </button>
              <button onClick={() => deleteReusableDeck(deck.id)} title="Elimina la plantilla guardada en este navegador">
                Eliminar plantilla
              </button>
            </article>
          ))}
        </aside>
      </div>

      <div style={exportHiddenStyle}>
        <DeckImageExport
          ref={exportRef}
          deck={exportDeck}
          cards={exportCards}
          sections={sections}
          standings={standings}
          format={exportFormat}
          magicFormat={magicFormat}
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
  canDropCard,
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
  canDropCard: (card: Pick<CardSuggestion, 'name' | 'kind' | 'subtitle'>) => boolean
}) {
  const total = cards.reduce((sum, card) => sum + card.quantity, 0)
  const [dragTargetId, setDragTargetId] = useState('')
  const [dropState, setDropState] = useState<'valid' | 'invalid' | ''>('')

  return (
    <section
      className={dropState ? `deck-zone ${dropState === 'invalid' ? 'drop-invalid' : 'drop-valid'}` : 'deck-zone'}
      onDragOver={event => {
        event.preventDefault()
        const cardPayload = event.dataTransfer.getData('application/x-card')
        const deckCardId = event.dataTransfer.getData('application/x-deck-card')
        if (cardPayload) {
          const card = JSON.parse(cardPayload) as CardSuggestion
          setDropState(canDropCard(card) ? 'valid' : 'invalid')
        } else if (deckCardId) {
          const dragged = cards.find(card => card.id === deckCardId)
          setDropState(dragged && canDropCard(dragged) ? 'valid' : '')
        }
      }}
      onDragLeave={() => setDropState('')}
      onDrop={event => {
        event.preventDefault()
        const cardPayload = event.dataTransfer.getData('application/x-card')
        const deckCardId = event.dataTransfer.getData('application/x-deck-card')
        if (cardPayload) {
          const card = JSON.parse(cardPayload) as CardSuggestion
          if (canDropCard(card)) onDropCard(card)
        }
        if (deckCardId) onMoveCard(deckCardId)
        setDropState('')
      }}
    >
      <header>
        <strong>{label}</strong>
        <div className="deck-zone-tools">
          <button onClick={() => onSort('name')} title="Ordena alfabeticamente">Ordenar por nombre</button>
          <button onClick={() => onSort('quantity')} title="Agrupa por cantidad de copias">Ordenar por copias</button>
          <button onClick={() => onSort('type')} title="Agrupa por tipo de carta">Ordenar por tipo</button>
          <span>{total}</span>
        </div>
      </header>
      <div className="deck-card-grid">
        {cards.map(card => {
          const copyWarning = getCopyWarning(card)
          const isDropTarget = dragTargetId === card.id
          return (
          <article
            key={card.id}
            className={isDropTarget ? 'deck-card-tile compact drop-target' : 'deck-card-tile compact'}
            draggable
            onDragStart={event => {
              event.dataTransfer.setData('application/x-deck-card', card.id)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={event => {
              event.preventDefault()
              const cardPayload = event.dataTransfer.getData('application/x-card')
              const deckCardId = event.dataTransfer.getData('application/x-deck-card')
              if (cardPayload) {
                const dragged = JSON.parse(cardPayload) as CardSuggestion
                if (canDropCard(dragged)) setDragTargetId(card.id)
              }
              if (deckCardId && deckCardId !== card.id && canDropCard(card)) setDragTargetId(card.id)
            }}
            onDragLeave={() => {
              if (dragTargetId === card.id) setDragTargetId('')
            }}
            onDrop={event => {
              event.preventDefault()
              event.stopPropagation()
              const cardPayload = event.dataTransfer.getData('application/x-card')
              const deckCardId = event.dataTransfer.getData('application/x-deck-card')
              if (cardPayload) {
                const dragged = JSON.parse(cardPayload) as CardSuggestion
                if (canDropCard(dragged)) onDropCard(dragged)
              }
              if (deckCardId) onReorderCard(deckCardId, card.id)
              setDragTargetId('')
            }}
            onDragEnd={() => setDragTargetId('')}
          >
            {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <div className="deck-card-placeholder">{card.name}</div>}
            {copyWarning && <em>{copyWarning}</em>}
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
  deck,
  cards,
  sections,
  standings,
  format,
  magicFormat,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  deck: DeckList | null
  cards: DeckCard[]
  sections: string[]
  standings: ReturnType<typeof useSwissPairings>['standings']
  format: DeckExportFormat
  magicFormat: MagicFormat
}) {
  if (!deck) return <div ref={ref} />
  const standing = standings.find(row => row.player.id === deck.playerId || row.player.name === deck.playerName)
  const rankLabel = getPlacementLabel(standing?.position)
  const titleParts = getDeckTitleParts(deck.name)

  return (
    <div ref={ref} className={`deck-export-card deck-export-card-${format} deck-export-game-${deck.game}`}>
      <header className="deck-export-hero">
        <div className="deck-export-hero-mark">
          <img src="/subterra-logo.jpg" alt="" />
        </div>
        <div className="deck-export-hero-title">
          <div className="deck-export-rank-line">
            <strong className={`deck-export-rank deck-export-rank-${getPlacementTone(standing?.position)}`}>{rankLabel}</strong>
            {deck.game === 'magic' && <span className="deck-export-format-pill">{getMagicFormatLabel(magicFormat)}</span>}
          </div>
          <h2>
            {titleParts.main && <span className="deck-export-title-main">{titleParts.main}</span>}
            <span className="deck-export-title-accent">{titleParts.accent}</span>
          </h2>
        </div>
      </header>

      <div className="deck-export-layout">
        <div className="deck-export-body">
          {sections.map(section => {
            const sectionCards = cards.filter(card => card.section === section)
            if (!sectionCards.length) return null
            const groupedExport = shouldGroupExportCards(deck.game)
            const visualCards = groupedExport ? groupDeckCards(sectionCards) : expandCards(sectionCards)
            const compactFallback = shouldUseCompactFallback(deck.game, section)
            return (
              <section key={section} className={`deck-export-section deck-export-section-${section.toLowerCase()}`}>
                <h3>
                  <span>{getExportSectionLabel(deck.game, section)}</span>
                  <strong>{sectionCards.reduce((sum, card) => sum + card.quantity, 0)} cartas</strong>
                </h3>
                <div className="deck-export-card-grid">
                  {visualCards.map((card, index) => (
                    <div
                      key={`${card.id}-${index}`}
                      className={`deck-export-card-tile${groupedExport ? ' deck-export-card-tile-grouped' : ''}`}
                      style={card.imageUrl ? { backgroundImage: `url("${card.imageUrl}")` } : undefined}
                    >
                      {card.imageUrl && (
                        <img
                          src={card.imageUrl}
                          alt=""
                          crossOrigin={card.imageUrl.startsWith('data:') ? undefined : 'anonymous'}
                        />
                      )}
                      <div className={`deck-export-card-fallback${compactFallback ? ' deck-export-card-fallback-compact' : ''}`}>{card.name}</div>
                      {groupedExport && <span className="deck-export-copy-badge">{card.quantity}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <aside className="deck-export-sidebar">
          <div className="deck-export-player-card">
            <span>Jugador</span>
            <strong>{deck.playerName}</strong>
          </div>

          <div className="deck-export-promo">
            <img src="/subterra-logo.jpg" alt="" />
            <div>
              <span>Subterra TCG</span>
              <strong>@subterra_oficial</strong>
              <small>Instagram oficial</small>
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}

function getExportSectionLabel(game: TournamentTCG, sectionId: string) {
  return deckRuleConfigs[game].sections.find(section => section.id === sectionId)?.label ?? sectionId
}

function getPlacementLabel(position?: number) {
  if (!position) return 'DECK PROFILE'
  if (position === 1) return 'WINNER'
  if (position === 2) return 'RUNNER-UP'
  if (position <= 4) return 'TOP 4'
  if (position <= 8) return 'TOP 8'
  if (position <= 16) return 'TOP 16'
  if (position <= 32) return 'TOP 32'
  if (position <= 64) return 'TOP 64'
  return `TOP ${position}`
}

function getPlacementTone(position?: number) {
  if (position === 1) return 'winner'
  if (position === 2) return 'runner-up'
  return 'default'
}

function getDeckTitleParts(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return { main: '', accent: words[0] ?? name }
  return {
    main: words.slice(0, -1).join(' '),
    accent: words.at(-1) ?? '',
  }
}

function canPlaceCardInSection(game: TournamentTCG, card: Pick<CardSuggestion, 'name' | 'kind' | 'subtitle'>, section: string) {
  if (['Side', 'Sideboard'].includes(section)) return true

  const defaultSection = getDefaultSection(game, card)
  if (section === defaultSection) return true

  if (game === 'magic') return section === 'Main'
  if (game === 'lorcana') return section === 'Main'
  if (game === 'one-piece') return section === 'Main' && defaultSection !== 'Leader'
  return false
}

function getMagicFormatWarnings(cards: DeckCard[], format: MagicFormat) {
  const warnings: string[] = []
  const mainTotal = cards.filter(card => card.section === 'Main').reduce((sum, card) => sum + card.quantity, 0)
  const sideTotal = cards.filter(card => card.section === 'Sideboard').reduce((sum, card) => sum + card.quantity, 0)

  if (format === 'commander') {
    const total = mainTotal + sideTotal
    if (total !== 100) warnings.push('Commander: exactamente 100 cartas')
    cards.forEach(card => {
      if (card.quantity > 1 && !isBasicMagicLand(card.name)) warnings.push(`${card.name}: singleton en Commander`)
    })
  } else {
    if (mainTotal < 60) warnings.push(`${getMagicFormatLabel(format)}: minimo 60 cartas en main`)
    if (sideTotal > 15) warnings.push(`${getMagicFormatLabel(format)}: maximo 15 cartas en sideboard`)
  }

  const illegalCards = cards
    .filter(card => card.legalities?.[format] && card.legalities[format] !== 'legal')
    .map(card => `${card.name} (${card.legalities?.[format]})`)

  if (illegalCards.length) warnings.push(`No legales en ${getMagicFormatLabel(format)}: ${illegalCards.slice(0, 4).join(', ')}`)
  return [...new Set(warnings)]
}

function getMagicFormatLabel(format: MagicFormat) {
  return magicFormatOptions.find(option => option.value === format)?.label ?? format
}

function isBasicMagicLand(name: string) {
  return ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'].includes(name.toLowerCase())
}

function expandCards(cards: DeckCard[]) {
  return cards.flatMap(card => Array.from({ length: card.quantity }, () => card))
}

function groupDeckCards(cards: DeckCard[]) {
  const grouped = new Map<string, DeckCard>()
  for (const card of cards) {
    const key = `${card.section}:${card.cardId}:${card.name.toLowerCase()}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantity += card.quantity
    } else {
      grouped.set(key, { ...card })
    }
  }
  return [...grouped.values()]
}

function shouldGroupExportCards(game: TournamentTCG) {
  return game !== 'yugioh' && game !== 'magic'
}

function shouldUseCompactFallback(game: TournamentTCG, section: string) {
  return game === 'magic' && ['Sideboard', 'Side'].includes(section)
}

function splitCardCopies(cards: DeckCard[]) {
  return cards.flatMap(card =>
    Array.from({ length: Math.max(1, card.quantity) }, () => ({
      ...card,
      id: crypto.randomUUID(),
      quantity: 1,
    }))
  )
}

function loadDeckLibrary(): SavedDeckTemplate[] {
  try {
    const raw = localStorage.getItem(DECK_LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedDeckTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function hydrateMissingImages(cards: DeckCard[], game: TournamentTCG, forExport = false) {
  const imageCache = new Map<string, Promise<string>>()
  const searchCache = new Map<string, Promise<CardSuggestion[]>>()

  const hydrated = await mapWithConcurrency(cards, 4, async card => {
    if (game === 'one-piece') {
      const enriched = await hydrateOnePieceCard(card, forExport, imageCache).catch(() => null)
      if (enriched) return enriched
    }

    if (card.imageUrl) {
      const usableImageUrl = forExport ? await cachedDataUrl(card.imageUrl, imageCache).catch(() => card.imageUrl) : card.imageUrl
      return { ...card, imageUrl: usableImageUrl }
    }

    const cardById = await hydrateKnownCardById(card, game, forExport).catch(() => null)
    if (cardById) return cardById

    const exactSuggestions = await cachedCardSearch(game, card.name, true, searchCache).catch(() => [])
    const looseSuggestions = exactSuggestions.length
      ? exactSuggestions
      : await cachedCardSearch(game, card.name, false, searchCache).catch(() => [])
    const suggestions = looseSuggestions
    const exact = suggestions.find(candidate => candidate.name.toLowerCase() === card.name.toLowerCase())
    const match = exact ?? suggestions[0]
    const rawImageUrl = match?.imageUrl ?? getKnownImageUrl(game, match?.id ?? card.cardId)
    if (!match || !rawImageUrl) return card

    const usableImageUrl = forExport ? await cachedDataUrl(rawImageUrl, imageCache).catch(() => rawImageUrl) : rawImageUrl

    return {
      ...card,
      cardId: match.id,
      subtitle: match.subtitle,
      kind: match.kind,
      legalities: match.legalities,
      imageUrl: usableImageUrl,
    }
  })

  return hydrated
}

function cachedCardSearch(game: TournamentTCG, name: string, exact: boolean, cache: Map<string, Promise<CardSuggestion[]>>) {
  const key = `${game}:${exact ? 'exact' : 'loose'}:${name.toLowerCase()}`
  const current = cache.get(key)
  if (current) return current
  const next = searchCards(game, name, undefined, { onlyImages: true, exact })
  cache.set(key, next)
  return next
}

function cachedDataUrl(url: string, cache: Map<string, Promise<string>>) {
  const key = url
  const current = cache.get(key)
  if (current) return current
  const next = fetchImageAsDataUrl(url)
  cache.set(key, next)
  return next
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = []
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function hydrateOnePieceCard(
  card: DeckCard,
  forExport: boolean,
  imageCache: Map<string, Promise<string>>,
): Promise<DeckCard | null> {
  const match = await resolveOnePieceCard(card)
  if (!match?.imageUrl) return null

  const usableImageUrl = forExport
    ? await cachedDataUrl(match.imageUrl, imageCache).catch(() => '')
    : match.imageUrl

  if (forExport && !usableImageUrl) return null

  return {
    ...card,
    cardId: match.id,
    name: match.name || card.name,
    subtitle: match.subtitle,
    kind: match.kind,
    section: getOnePieceSectionFromKind(match.kind),
    imageUrl: usableImageUrl || match.imageUrl,
  }
}

async function hydrateKnownCardById(card: DeckCard, game: TournamentTCG, forExport: boolean): Promise<DeckCard | null> {
  if (game === 'one-piece') {
    return hydrateOnePieceCard(card, forExport, new Map())
  }

  if (game === 'riftbound') {
    const code = card.cardId.split(':').pop()
    if (!code || !/^[A-Z]{2,4}\d{2}-\d{3}[a-z]?$/i.test(code)) return null
    const match = (await searchCards(game, code, undefined, { onlyImages: true, exact: true }))[0]
    if (!match?.imageUrl) return null

    const usableImageUrl = forExport ? await fetchImageAsDataUrl(match.imageUrl).catch(() => match.imageUrl) : match.imageUrl
    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      kind: match.kind,
      legalities: match.legalities,
      imageUrl: usableImageUrl,
    }
  }

  if (game !== 'yugioh') return null
  const numericId = card.cardId.split(':').pop()
  if (!numericId || !/^\d+$/.test(numericId)) return null

  const url = new URL('https://db.ygoprodeck.com/api/v7/cardinfo.php')
  url.searchParams.set('id', numericId)
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) return null
  const payload = await response.json() as {
    data?: Array<{ id: number; name: string; type?: string; race?: string; attribute?: string; card_images?: Array<{ image_url?: string; image_url_small?: string }> }>
  }
  const match = payload.data?.[0]
  if (!match) return null

  const imageUrl = match.card_images?.[0]?.image_url ?? match.card_images?.[0]?.image_url_small ?? getKnownImageUrl(game, String(match.id)) ?? ''
  const usableImageUrl = imageUrl && forExport ? await fetchImageAsDataUrl(imageUrl).catch(() => '') : imageUrl

  return {
    ...card,
    cardId: `yugioh:${match.id}`,
    name: match.name,
    subtitle: match.type,
    kind: [match.type, match.race, match.attribute].filter(Boolean).join(' - '),
    imageUrl: usableImageUrl,
  }
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

async function waitForExportPaint() {
  await waitFrame()
  await new Promise<void>(resolve => window.setTimeout(resolve, 80))
  await waitFrame()
}

const exportHiddenStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  transform: 'translateX(-140vw)',
}
