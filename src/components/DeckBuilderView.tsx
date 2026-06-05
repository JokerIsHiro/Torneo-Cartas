// Pantalla completa del constructor de mazos. Aqui vive la experiencia de busqueda,
// edicion, importacion y exportacion; separa subcomponentes si crece mas.
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTournamentsStore } from '../store/tournamentsStore'
import {
  getAdvancedCardFilterOptions,
  getCardFilterOptions,
  resolveMagicCard,
  resolveMagicCardsBatch,
  resolvePokemonCard,
  resolveLorcanaCard,
  resolveYugiohCard,
  searchCards,
  type CardSearchFilters,
  type CardSuggestion,
} from '../services/cardSearch'
import { useExportImage } from '../hooks/useExportImage'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { DeckList, MagicFormat, Tournament, TournamentTCG } from '../types/tournament'
import { deckRuleConfigs, getDefaultSection, validateDeck } from '../utils/deckRules'
import { formatDeckCards, normalizeImportedSection, parseDeckImport, parseSavedDeckCards, type ImportedDeckCard } from '../utils/deckImport'
import { getOnePieceSectionFromKind, resolveOnePieceCard } from '../services/optcgApi'
import { DeckCardImage } from './DeckCardImage'
import { displayImageUrl, fetchImageAsDataUrl, proxiedImageUrl } from '../utils/imageExport'
import { ActionButton } from './ActionButton'
import { extractOnePieceCardCode } from '../utils/onePieceCardCode'

type DeckCard = ImportedDeckCard
type DeckExportFormat = 'social'
type DeckExportVisualCard = DeckCard & {
  exportBadge?: number
  exportRole?: 'rune-summary'
}

const magicFormatOptions: Array<{ value: MagicFormat; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'pioneer', label: 'Pioneer' },
  { value: 'modern', label: 'Modern' },
  { value: 'pauper', label: 'Pauper' },
  { value: 'commander', label: 'Commander' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'vintage', label: 'Vintage' },
]

const magicCommanderSections = [
  { id: 'Commander', label: 'Comandante', min: 1, max: 2 },
  { id: 'Main', label: 'Mazo principal', min: 98, max: 99 },
]

interface SavedDeckTemplate {
  id: string
  game: TournamentTCG
  playerName: string
  archetype?: string
  name: string
  list: string
  notes: string
  updatedAt: number
}

type ReusableDeckTemplate = SavedDeckTemplate & {
  sourceLabel: string
}

function now() {
  return Date.now()
}

export function DeckBuilderView() {
  const tournamentId = new URLSearchParams(window.location.search).get('torneo') ?? ''
  const requestedPlayerId = new URLSearchParams(window.location.search).get('jugador') ?? ''
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))

  if (!tournamentId) return <BuilderEmpty icon="ti-link-off" title="Falta torneo" text="Abre el constructor desde un torneo." />
  if (!tournament) return <BuilderEmpty icon="ti-loader-2" title="Cargando torneo" text="Sincronizando datos del evento." />
  if (tournament.tcg === 'chess') {
    return <BuilderEmpty icon="ti-chess" title="Ajedrez no usa mazos" text="Este torneo no tiene constructor de decks." />
  }

  return (
    <DeckBuilderEditor
      key={`${tournament.id}:${requestedPlayerId}`}
      tournamentId={tournamentId}
      tournament={tournament}
      requestedPlayerId={requestedPlayerId}
    />
  )
}

function DeckBuilderEditor({
  tournamentId,
  tournament,
  requestedPlayerId,
}: {
  tournamentId: string
  tournament: Tournament
  requestedPlayerId: string
}) {
  const submitDecklist = useTournamentsStore(s => s.submitDecklist)
  const setTournamentMagicFormat = useTournamentsStore(s => s.setTournamentMagicFormat)
  const allTournaments = useTournamentsStore(s => s.tournaments)
  const requestedPlayer = tournament?.players.find(player => player.id === requestedPlayerId) ?? null
  const requestedOwnerName = requestedPlayer?.teamMembers?.[0] ?? requestedPlayer?.name ?? ''
  const requestedDeck = requestedPlayer
    ? [...(tournament?.decklists ?? [])].reverse().find(deck =>
        deck.playerId === requestedPlayer.id && (!requestedPlayer.teamMembers?.length || deck.playerName === requestedOwnerName)
      )
    : undefined
  const [playerId, setPlayerId] = useState(() => requestedPlayer?.id ?? '')
  const [deckOwnerName, setDeckOwnerName] = useState(() => requestedOwnerName)
  const [deckArchetype, setDeckArchetype] = useState(() => requestedDeck?.archetype ?? requestedDeck?.name ?? '')
  const [deckName, setDeckName] = useState(() => requestedDeck?.name ?? '')
  const [deckNotes, setDeckNotes] = useState(() => requestedDeck?.notes ?? '')
  const [query, setQuery] = useState('')
  const [searchKind, setSearchKind] = useState('')
  const [searchText, setSearchText] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState<Partial<CardSearchFilters>>({})
  const [onlyImages, setOnlyImages] = useState(true)
  const [results, setResults] = useState<CardSuggestion[]>([])
  const [cards, setCards] = useState<DeckCard[]>(() =>
    requestedDeck?.list?.trim() && tournament
      ? splitCardCopies(normalizeResolvedDeckSectionsForGame(parseSavedDeckCards(tournament.tcg, requestedDeck.list), tournament.tcg))
      : []
  )
  const [exportDeck, setExportDeck] = useState<DeckList | null>(null)
  const [exportCards, setExportCards] = useState<DeckCard[]>([])
  const exportFormat: DeckExportFormat = 'social'
  const [saveStatus, setSaveStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const deckHydrateRef = useRef(0)
  const { ref: exportRef, exportImage } = useExportImage({ scale: 3 })
  const { standings } = useSwissPairings(tournamentId)
  const magicFormat = tournament?.magicFormat ?? 'pauper'
  const currentTournament = tournament
  const rules = deckRuleConfigs[currentTournament.tcg]
  const ruleSections = getActiveDeckSections(currentTournament.tcg, rules.sections, magicFormat)
  const activeSections = getVisibleDeckSections(currentTournament.tcg, ruleSections)
  const sections = ruleSections.map(section => section.id)
  const selectedPlayer = currentTournament.players.find(player => player.id === playerId) ?? null
  const selectedTeamMembers = selectedPlayer?.teamMembers ?? []
  const selectedDeckOwnerName = selectedTeamMembers.length ? deckOwnerName : selectedPlayer?.name ?? ''

  const latestDecks = useMemo(() => {
    const latestByPlayer = new Map<string, DeckList>()
    for (const deck of tournament?.decklists ?? []) {
      const key = `${deck.playerId}:${deck.playerName}`
      const current = latestByPlayer.get(key)
      if (!current || deck.updatedAt >= current.updatedAt) latestByPlayer.set(key, deck)
    }
    return [...latestByPlayer.values()].sort((a, b) => a.playerName.localeCompare(b.playerName))
  }, [tournament?.decklists])

  const playerDeckHistory = selectedDeckOwnerName
    ? getReusableDecksFromPlayerHistory(
      allTournaments,
      currentTournament.id,
      currentTournament.tcg,
      selectedDeckOwnerName,
    )
    : []
  const reusableDecks = playerDeckHistory
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)

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

  const warnings = [
    ...(currentTournament.tcg === 'magic' && magicFormat === 'commander'
      ? []
      : validateDeck(currentTournament.tcg, cards)),
    ...(currentTournament.tcg === 'magic' ? getMagicFormatWarnings(cards, magicFormat) : []),
  ]
  const filterOptions = getCardFilterOptions(currentTournament.tcg)
  const advancedFilterOptions = getAdvancedCardFilterOptions(currentTournament.tcg)
  const visibleResults = query.trim().length < 2 ? [] : results
  const quickSideSection = activeSections.find(section => ['Side', 'Sideboard'].includes(section.id))
  const activeSearchFilters = [
    searchKind,
    searchText,
    onlyImages ? '' : 'all-images',
    ...Object.values(advancedFilters).map(value => String(value ?? '')),
  ].filter(Boolean).length

  function toSplitDeckRows(imported: ImportedDeckCard[]) {
    const displayCards = normalizeResolvedDeckSectionsForGame(
      imported.map(card => ({
        ...card,
        imageUrl: card.imageUrl ? (displayImageUrl(card.imageUrl) ?? card.imageUrl) : undefined,
        artUrl: card.artUrl ? (displayImageUrl(card.artUrl) ?? card.artUrl) : undefined,
      })),
      currentTournament.tcg,
    )

    return splitCardCopies(
      displayCards,
    )
  }

  async function loadDeckFromList(list: string, statusLabel = 'Mazo cargado') {
    const generation = ++deckHydrateRef.current
    const parsed = parseSavedDeckCards(currentTournament.tcg, list)
    setCards(toSplitDeckRows(parsed))

    if (!parsed.length) {
      setSaveStatus('')
      return
    }

    const needsHydration = parsed.some(card => !card.imageUrl)
    if (needsHydration) {
      setSaveStatus('Cargando imagenes del mazo...')
    }

    const hydrated = await hydrateMissingImages(parsed, currentTournament.tcg)
    if (generation !== deckHydrateRef.current) return

    setCards(toSplitDeckRows(hydrated))
    const withImages = hydrated.filter(card => card.imageUrl).length
    const imageNote =
      withImages < hydrated.length ? ` (${withImages}/${hydrated.length} con imagen)` : ''
    setSaveStatus(`${statusLabel}${imageNote}`)
    window.setTimeout(() => setSaveStatus(''), 2800)
  }

  function handlePlayerChange(nextPlayerId: string) {
    deckHydrateRef.current += 1
    setPlayerId(nextPlayerId)
    const nextPlayer = currentTournament.players.find(player => player.id === nextPlayerId)
    const nextOwnerName = nextPlayer?.teamMembers?.[0] ?? nextPlayer?.name ?? ''
    setDeckOwnerName(nextOwnerName)
    const existingDeck = [...(currentTournament.decklists ?? [])].reverse().find(deck =>
      deck.playerId === nextPlayerId && (!nextPlayer?.teamMembers?.length || deck.playerName === nextOwnerName)
    )
    const historyDeck = !existingDeck?.list?.trim() && nextOwnerName
      ? getReusableDecksFromPlayerHistory(allTournaments, currentTournament.id, currentTournament.tcg, nextOwnerName)[0]
      : undefined
    const deckToLoad = existingDeck?.list?.trim() ? existingDeck : historyDeck

    setDeckArchetype(deckToLoad?.archetype ?? deckToLoad?.name ?? '')
    setDeckName(deckToLoad?.name ?? '')
    setDeckNotes(deckToLoad?.notes ?? '')
    if (!deckToLoad?.list?.trim()) {
      setCards([])
      return
    }
    void loadDeckFromList(deckToLoad.list, existingDeck ? 'Mazo cargado' : 'Mazo recuperado del historial')
  }

  function handleDeckOwnerChange(nextOwnerName: string) {
    deckHydrateRef.current += 1
    setDeckOwnerName(nextOwnerName)
    const existingDeck = [...(currentTournament.decklists ?? [])].reverse().find(deck =>
      deck.playerId === playerId && deck.playerName === nextOwnerName
    )
    const historyDeck = !existingDeck?.list?.trim() && nextOwnerName
      ? getReusableDecksFromPlayerHistory(allTournaments, currentTournament.id, currentTournament.tcg, nextOwnerName)[0]
      : undefined
    const deckToLoad = existingDeck?.list?.trim() ? existingDeck : historyDeck

    setDeckArchetype(deckToLoad?.archetype ?? deckToLoad?.name ?? '')
    setDeckName(deckToLoad?.name ?? '')
    setDeckNotes(deckToLoad?.notes ?? '')
    if (!deckToLoad?.list?.trim()) {
      setCards([])
      return
    }
    void loadDeckFromList(deckToLoad.list, existingDeck ? 'Mazo cargado' : 'Mazo recuperado del historial')
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
        imageUrl: card.imageUrl ? (displayImageUrl(card.imageUrl) ?? card.imageUrl) : undefined,
        artUrl: card.artUrl ? (displayImageUrl(card.artUrl) ?? card.artUrl) : undefined,
        orientation: card.orientation,
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
      if (!canPlaceCardInVisibleSection(currentTournament.tcg, card, section)) {
        showDeckStatus(`Movimiento rechazado: ${card.name} no pertenece a ${getSectionLabel(section)}.`)
        return current
      }
      const storedSection = getStoredSectionForVisibleDrop(currentTournament.tcg, section, card)
      return current.map(candidate => candidate.id === cardId ? { ...candidate, section: storedSection } : candidate)
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
      const visibleTargetSection = getVisibleSectionId(currentTournament.tcg, target.section)
      if (!canPlaceCardInVisibleSection(currentTournament.tcg, moved, visibleTargetSection)) {
        showDeckStatus(`Movimiento rechazado: ${moved.name} no pertenece a ${getSectionLabel(visibleTargetSection)}.`)
        return current
      }
      const storedSection = getStoredSectionForVisibleDrop(currentTournament.tcg, visibleTargetSection, moved)
      const next = current.filter(card => card.id !== cardId)
      const insertIndex = next.findIndex(card => card.id === targetCardId)
      next.splice(insertIndex, 0, { ...moved, section: storedSection })
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
        const landOrder = compareMagicLandOrder(currentTournament.tcg, section, a, b)
        if (landOrder !== 0) return landOrder
        if (mode === 'quantity') return b.quantity - a.quantity || a.name.localeCompare(b.name)
        if (mode === 'type') return (a.kind ?? '').localeCompare(b.kind ?? '') || a.name.localeCompare(b.name)
        return a.name.localeCompare(b.name)
      })
      let index = 0
      return current.map(card => card.section === section ? sorted[index++] : card)
    })
  }

  function getCopyWarning(card: DeckCard) {
    const limit = currentTournament.tcg === 'magic' && magicFormat === 'commander'
      ? 1
      : rules.copyLimit
    if (!limit) return ''
    const total = cards
      .filter(candidate => candidate.name.toLowerCase() === card.name.toLowerCase())
      .reduce((sum, candidate) => sum + candidate.quantity, 0)
    if (currentTournament.tcg === 'magic' && isBasicMagicLand(card.name)) return ''
    return total > limit ? `Max ${limit}` : ''
  }

  function saveDeck() {
    if (!selectedPlayer || !selectedDeckOwnerName || !deckName.trim() || cards.length === 0) {
      setSaveStatus('Completa jugador, nombre y cartas.')
      return
    }
    setSaveStatus('Guardando...')
    const formattedList = formatDeckCards(cards, sections, true, currentTournament.tcg)
    submitDecklist(currentTournament.id, selectedPlayer.id, {
      archetype: deckArchetype,
      name: deckName,
      list: formattedList,
      notes: deckNotes,
      playerName: selectedDeckOwnerName,
      teamName: selectedPlayer.teamMembers?.length ? selectedPlayer.name : undefined,
    })
    setSaveStatus('Guardado')
    window.setTimeout(() => setSaveStatus(''), 2200)
  }

  function showDeckStatus(message: string) {
    setSaveStatus(message)
    window.setTimeout(() => setSaveStatus(''), 2600)
  }

  function getSectionLabel(sectionId: string) {
    return activeSections.find(section => section.id === sectionId)?.label ?? sectionId
  }

  function clearSearchFilters() {
    setSearchKind('')
    setSearchText('')
    setAdvancedFilters({})
    setOnlyImages(true)
  }

  async function applyImportedText(text: string) {
    if (!text) return
    const result = parseDeckImport(currentTournament.tcg, text)
    const importedCards = normalizeImportedDeckSectionsForTournament(
      result.cards,
      currentTournament.tcg,
      magicFormat,
    )
    const importedTotal = importedCards.reduce((sum, card) => sum + card.quantity, 0)
    const ignoredSuffix = result.ignoredLines.length ? ` ${result.ignoredLines.length} lineas sin reconocer.` : ''

    deckHydrateRef.current += 1
    const generation = ++deckHydrateRef.current
    setCards(toSplitDeckRows(importedCards))
    setSaveStatus(`Importadas ${importedTotal} cartas. Cargando imagenes...${ignoredSuffix}`)

    const hydratedCards = await hydrateMissingImages(importedCards, currentTournament.tcg)
    if (generation !== deckHydrateRef.current) return
    setCards(toSplitDeckRows(hydratedCards))
    const withImages = hydratedCards.filter(card => card.imageUrl).length
    const imageSuffix = currentTournament.tcg === 'one-piece'
      ? ` ${withImages}/${hydratedCards.length} con imagen y edicion.`
      : ` ${withImages}/${hydratedCards.length} con imagen.`
    setSaveStatus(`Importadas ${importedTotal} cartas.${imageSuffix}${ignoredSuffix}`)
    window.setTimeout(() => setSaveStatus(''), 3500)
  }

  function importDeckText() {
    const text = window.prompt(
      'Pega la lista del mazo.\n\nFormatos admitidos: OPTCG Sim (4xOP01-016), Egman/Limitless (4 OP01-016 Nombre), tablas, JSON, TCGplayer, Pokemon.com y mas.',
    )
    if (text) void applyImportedText(text)
  }

  async function importDeckFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    await applyImportedText(text)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function repairDeckImages() {
    if (!cards.length) return

    const generation = ++deckHydrateRef.current
    setSaveStatus('Reparando imagenes del mazo...')

    const cardsToRepair = cards.map(card => ({
      ...card,
      imageUrl: undefined,
    }))

    const hydratedCards = await hydrateMissingImages(cardsToRepair, currentTournament.tcg)
    if (generation !== deckHydrateRef.current) return

    setCards(toSplitDeckRows(hydratedCards))
    const withImages = hydratedCards.filter(card => card.imageUrl).length
    setSaveStatus(`Imagenes reparadas (${withImages}/${hydratedCards.length} con imagen).`)
    window.setTimeout(() => setSaveStatus(''), 3500)
  }

  function loadDeckList(deck: Pick<DeckList, 'name' | 'archetype' | 'list' | 'notes'>) {
    setDeckArchetype(deck.archetype ?? deck.name)
    setDeckName(deck.name)
    setDeckNotes(deck.notes)
    void loadDeckFromList(deck.list, 'Lista cargada')
  }

  async function exportCurrentDeckImage() {
    if (!selectedPlayer || !selectedDeckOwnerName || !deckName.trim() || cards.length === 0) return
    setSaveStatus('Preparando imagenes para la exportacion...')
    const hydratedCards = await hydrateMissingImages(cards, currentTournament.tcg, true)
    const withImages = hydratedCards.filter(card => card.imageUrl?.startsWith('data:')).length
    flushSync(() => {
      setExportDeck({
        id: 'current',
        playerId: selectedPlayer.id,
        playerName: selectedDeckOwnerName,
        teamName: selectedPlayer.teamMembers?.length ? selectedPlayer.name : undefined,
        game: currentTournament.tcg,
        archetype: deckArchetype.trim() || deckName,
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
    await exportImage(`deck-${selectedPlayer.name}-${selectedDeckOwnerName}-${deckArchetype || deckName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
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
    await exportImage(`deck-${deck.playerName}-${deck.archetype || deck.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    setSaveStatus('Imagen del mazo descargada.')
    window.setTimeout(() => setSaveStatus(''), 3500)
  }

  return (
    <div className="deck-builder-page">
      <header className="deck-builder-top">
        <div>
          <span>{rules.label}</span>
          <h1>{currentTournament.name}</h1>
          <p>{currentTournament.status === 'finished' ? 'Listas listas para revisar, publicar y exportar' : 'Recepcion de listas abierta antes de finalizar'}</p>
        </div>
        <ActionButton className="deck-action-ghost" onClick={() => window.close()} icon="ti-x" title="Cierra esta ventana del constructor">
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
          className="deck-action-warning"
          onClick={repairDeckImages}
          disabled={cards.length === 0}
          icon="ti-photo-search"
          title="Fuerza una nueva busqueda de imagenes para todo el mazo"
        >
          Reparar imagenes
        </ActionButton>
        <ActionButton
          className="deck-action-primary"
          onClick={exportCurrentDeckImage}
          disabled={!selectedPlayer || !selectedDeckOwnerName || !deckName.trim() || cards.length === 0}
          icon="ti-photo-down"
          title="Genera una imagen PNG lista para Instagram o WhatsApp"
        >
          Descargar imagen PNG
        </ActionButton>
        <ActionButton
          className="deck-action-primary"
          onClick={saveDeck}
          disabled={!selectedPlayer || !selectedDeckOwnerName || !deckName.trim() || cards.length === 0}
          icon="ti-device-floppy"
          title="Guarda el mazo en el torneo para este jugador"
        >
          Guardar mazo del torneo
        </ActionButton>
        <ActionButton
          className="deck-action-danger"
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
          <option value="">{currentTournament.teamMode === 'solo' ? 'Jugador' : 'Equipo'}</option>
          {currentTournament.players.map(player => (
            <option key={player.id} value={player.id}>{player.name}</option>
          ))}
        </select>
        {selectedTeamMembers.length > 0 && (
          <select value={deckOwnerName} onChange={event => handleDeckOwnerChange(event.target.value)}>
            {selectedTeamMembers.map(member => (
              <option key={member} value={member}>
                {member}{member === selectedPlayer?.captainName ? ' (capitan)' : ''}
              </option>
            ))}
          </select>
        )}
        <input value={deckArchetype} onChange={event => setDeckArchetype(event.target.value)} placeholder="Arquetipo para redes" />
        <input value={deckName} onChange={event => setDeckName(event.target.value)} placeholder="Nombre del mazo" />
        <input value={deckNotes} onChange={event => setDeckNotes(event.target.value)} placeholder="Notas para redes" />
        {currentTournament.tcg === 'magic' && (
          <select value={magicFormat} onChange={event => setTournamentMagicFormat(currentTournament.id, event.target.value as MagicFormat)}>
            {magicFormatOptions.map(option => (
              <option key={option.value} value={option.value}>Formato: {option.label}</option>
            ))}
          </select>
        )}
        {saveStatus && <span className="deck-save-status">{saveStatus}</span>}
      </section>

      <section className="deck-builder-rulebar">
        <div>
          <strong>Total</strong>
          <span>{cards.reduce((sum, card) => sum + card.quantity, 0)} cartas</span>
        </div>
        {activeSections.map(section => (
          <div key={section.id}>
            <strong>{section.label}</strong>
            <span>{getCardsForVisibleSection(currentTournament.tcg, section.id, cards).reduce((sum, card) => sum + card.quantity, 0)} cartas</span>
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
          <div className="deck-search-panel-header">
            <div>
              <span>Base de datos</span>
              <strong>Buscar cartas</strong>
            </div>
            <em>{visibleResults.length ? `${visibleResults.length} resultados` : query.trim().length >= 2 ? 'Sin resultados' : rules.label}</em>
          </div>

          <div className="deck-search-box">
            <div className="deck-search-input-shell">
              <i className="ti ti-search" aria-hidden="true" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={`Buscar carta de ${rules.label}`}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} title="Limpiar busqueda" aria-label="Limpiar busqueda">
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="deck-search-submit-icon"
                onClick={() => addManualCard()}
                disabled={!query.trim()}
                title="Anadir como carta manual si no aparece en la busqueda"
                aria-label="Anadir carta manual"
              >
                <i className="ti ti-search" aria-hidden="true" />
              </button>
            </div>
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

          <div className="deck-search-filterbar">
            <span>{activeSearchFilters} filtros activos</span>
            <button type="button" onClick={clearSearchFilters} disabled={activeSearchFilters === 0}>
              Restablecer filtros
            </button>
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
            {query.trim().length < 2 && (
              <div className="deck-search-empty">
                <i className="ti ti-cards" aria-hidden="true" />
                <strong>Empieza escribiendo una carta</strong>
                <span>Busca por nombre, filtra por tipo y arrastra resultados al mazo.</span>
              </div>
            )}
            {query.trim().length >= 2 && visibleResults.length === 0 && (
              <div className="deck-search-empty">
                <i className="ti ti-mood-empty" aria-hidden="true" />
                <strong>No he encontrado cartas</strong>
                <span>Prueba con menos filtros o usa la lupa del buscador para guardarla manualmente.</span>
              </div>
            )}
            {visibleResults.map(card => (
              <article
                key={card.id}
                draggable
                onDragStart={event => event.dataTransfer.setData('application/x-card', JSON.stringify(card))}
                className="deck-search-card"
              >
                <div className="deck-search-card-image">
                  {card.imageUrl ? <DeckCardImage url={card.imageUrl} priority="high" className={getCardImageOrientationClass(card, currentTournament.tcg)} /> : <div className="deck-card-placeholder" />}
                </div>
                <div className="deck-search-card-copy">
                  <strong>{card.name}</strong>
                  {(card.subtitle || card.kind) && <small>{[card.subtitle, card.kind].filter(Boolean).join(' · ')}</small>}
                </div>
                <div className="deck-search-card-actions">
                  <button onClick={() => addCard(card)} title="Anade esta carta al mazo principal" aria-label={`Anadir ${card.name} al mazo`}>
                    <i className="ti ti-plus" aria-hidden="true" />
                    <span>Mazo</span>
                  </button>
                  {quickSideSection && (
                    <button onClick={() => addCard(card, quickSideSection.id)} title="Anade esta carta al banquillo" aria-label={`Anadir ${card.name} al banquillo`}>
                      <i className="ti ti-layout-sidebar-right" aria-hidden="true" />
                      <span>Side</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>

        <main className="deck-zone-grid">
          {activeSections.map(section => (
            <DeckZone
              key={section.id}
              sectionId={section.id}
              label={section.label}
              cards={getCardsForVisibleSection(currentTournament.tcg, section.id, cards)}
              onDropCard={card => addCard(card, getStoredSectionForVisibleDrop(currentTournament.tcg, section.id, card))}
              onMoveCard={cardId => moveCard(cardId, section.id)}
              onReorderCard={reorderCard}
              onMoveOrder={moveCardOrder}
              onQuantityChange={updateQuantity}
              getCopyWarning={getCopyWarning}
              onSort={mode => sortSection(section.id, mode)}
              game={currentTournament.tcg}
              canDropCard={card => canPlaceCardInVisibleSection(currentTournament.tcg, card, section.id)}
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
                <strong>{deck.archetype || deck.name}</strong>
                <span>{deck.teamName ? `${deck.teamName} - ${deck.playerName}` : deck.playerName}</span>
                {deck.archetype && deck.archetype !== deck.name && <span>{deck.name}</span>}
              </div>
              <button onClick={() => loadDeckList(deck)} title="Abre esta lista en el editor">
                Abrir en editor
              </button>
              <button onClick={() => void exportSavedDeckImage(deck)} title="Descarga una imagen PNG de este mazo">
                Descargar PNG
              </button>
            </article>
          ))}

          <strong>{selectedDeckOwnerName ? `Mazos reutilizables de ${selectedDeckOwnerName}` : 'Biblioteca'}</strong>
          {reusableDecks.length === 0 ? (
            <span>No hay mazos reutilizables para este juego.</span>
          ) : reusableDecks.map(deck => (
            <article key={deck.id}>
              <div>
                <strong>{deck.archetype || deck.name}</strong>
                <span>{deck.playerName}</span>
                <span>{deck.sourceLabel}</span>
              </div>
              <button onClick={() => loadDeckList(deck)} title="Carga esta plantilla en el editor">
                Usar plantilla
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
  sectionId,
  label,
  cards,
  onDropCard,
  onMoveCard,
  onReorderCard,
  onMoveOrder,
  onQuantityChange,
  getCopyWarning,
  onSort,
  game,
  canDropCard,
}: {
  sectionId: string
  label: string
  cards: DeckCard[]
  onDropCard: (card: CardSuggestion) => void
  onMoveCard: (cardId: string) => void
  onReorderCard: (cardId: string, targetCardId: string) => void
  onMoveOrder: (cardId: string, direction: -1 | 1) => void
  onQuantityChange: (cardId: string, quantity: number) => void
  getCopyWarning: (card: DeckCard) => string
  onSort: (mode: 'name' | 'quantity' | 'type') => void
  game: TournamentTCG
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
            className={getDeckCardTileClass(game, sectionId, card, isDropTarget)}
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
            {card.imageUrl ? <DeckCardImage url={card.imageUrl} className={getCardImageOrientationClass(card, game)} /> : <div className="deck-card-placeholder">{card.name}</div>}
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
  const standing = standings.find(row => row.player.id === deck.playerId || row.player.name === (deck.teamName ?? deck.playerName))
  const rankLabel = getPlacementLabel(standing?.position)
  const titleParts = getDeckTitleParts(deck.archetype || deck.name)

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
            if (shouldSkipExportSection(deck.game, section, cards)) return null
            const sectionCards = getExportSectionCards(deck.game, section, cards)
            if (!sectionCards.length) return null
            const visualCards = getExportVisualCards(deck.game, section, sectionCards, cards)
            return (
              <section key={section} className={`deck-export-section deck-export-section-${section.toLowerCase()}`}>
                <h3>
                  <span>{getExportSectionHeading(deck.game, section, cards)}</span>
                  <strong>{getExportSectionCountLabel(deck.game, section, sectionCards, cards)}</strong>
                </h3>
                <div className="deck-export-card-grid">
                  {visualCards.map((card, index) => (
                    <div
                      key={`${card.id}-${index}`}
                      className={getExportCardTileClass(deck.game, card)}
                      style={getExportCardTileStyle(deck.game, card)}
                    >
                      {card.exportBadge && <div className="deck-export-rune-count">{card.exportBadge}</div>}
                      {card.imageUrl && (
                        <img
                          src={card.imageUrl}
                          alt=""
                          className={getExportCardImageClass(deck.game, card)}
                          crossOrigin={
                            card.imageUrl.startsWith('data:') || card.imageUrl.includes('images.weserv.nl')
                              ? undefined
                              : 'anonymous'
                          }
                        />
                      )}
                      <div className="deck-export-card-fallback">{card.name}</div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <aside className="deck-export-sidebar">
          <div className="deck-export-player-card">
            {deck.teamName ? (
              <>
                <span>Equipo</span>
                <strong>{deck.teamName}</strong>
                <small>{deck.playerName}</small>
              </>
            ) : (
              <>
                <span>Jugador</span>
                <strong>{deck.playerName}</strong>
              </>
            )}
            {deck.archetype && deck.archetype !== deck.name && <small>{deck.name}</small>}
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
  if (game === 'magic' && sectionId === 'Commander') return 'Comandante'
  return deckRuleConfigs[game].sections.find(section => section.id === sectionId)?.label ?? sectionId
}

function shouldSkipExportSection(game: TournamentTCG, sectionId: string, cards: DeckCard[]) {
  if (game !== 'riftbound' || sectionId !== 'Rune') return false
  return cards.some(card => card.section === 'Legend') && cards.some(card => card.section === 'Rune')
}

function getExportSectionCards(game: TournamentTCG, sectionId: string, cards: DeckCard[]) {
  return orderVisibleDeckCards(game, sectionId, cards.filter(card => card.section === sectionId))
}

function getExportVisualCards(
  game: TournamentTCG,
  sectionId: string,
  sectionCards: DeckCard[],
  allCards: DeckCard[],
): DeckExportVisualCard[] {
  if (game === 'riftbound' && sectionId === 'Legend') {
    return [
      ...expandCards(sectionCards),
      ...getRiftboundRuneSummaries(allCards),
    ]
  }

  if (game === 'riftbound' && sectionId === 'Rune') {
    return getRiftboundRuneSummaries(sectionCards)
  }

  return expandCards(sectionCards)
}

function getExportSectionHeading(game: TournamentTCG, sectionId: string, cards: DeckCard[]) {
  if (game === 'riftbound' && sectionId === 'Legend' && cards.some(card => card.section === 'Rune')) {
    return 'Leyenda / Runas'
  }
  return getExportSectionLabel(game, sectionId)
}

function getExportSectionCountLabel(
  game: TournamentTCG,
  sectionId: string,
  sectionCards: DeckCard[],
  allCards: DeckCard[],
) {
  const sectionTotal = sectionCards.reduce((sum, card) => sum + card.quantity, 0)
  if (game === 'riftbound' && sectionId === 'Legend') {
    const runeTotal = allCards
      .filter(card => card.section === 'Rune')
      .reduce((sum, card) => sum + card.quantity, 0)
    if (runeTotal > 0) return `${sectionTotal} + ${runeTotal} runas`
  }
  if (game === 'riftbound' && sectionId === 'Rune') return `${sectionTotal} runas`
  return `${sectionTotal} cartas`
}

function getRiftboundRuneSummaries(cards: DeckCard[]): DeckExportVisualCard[] {
  const grouped = new Map<string, DeckExportVisualCard>()

  for (const card of cards.filter(card => card.section === 'Rune')) {
    const key = normalizeExportCardName(card.name)
    const current = grouped.get(key)
    if (current) {
      current.exportBadge = (current.exportBadge ?? 0) + card.quantity
      continue
    }

    grouped.set(key, {
      ...card,
      quantity: 1,
      exportBadge: card.quantity,
      exportRole: 'rune-summary',
    })
  }

  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeExportCardName(name: string) {
  return name.trim().toLowerCase()
}

function getExportCardTileClass(game: TournamentTCG, card: DeckExportVisualCard) {
  return [
    'deck-export-card-tile',
    card.exportRole === 'rune-summary' ? 'deck-export-card-tile-rune-summary' : '',
    isRiftboundBattlefieldCard(game, card) ? 'deck-export-card-tile-battlefield' : '',
    !isRiftboundBattlefieldCard(game, card) && inferCardOrientation(card, game) === 'landscape'
      ? 'deck-export-card-tile-landscape'
      : '',
  ].filter(Boolean).join(' ')
}

function getExportCardTileStyle(game: TournamentTCG, card: DeckExportVisualCard) {
  if (!card.imageUrl) return undefined
  if (game === 'riftbound') return undefined
  if (isRiftboundBattlefieldCard(game, card)) return undefined
  if (inferCardOrientation(card, game) === 'landscape') return undefined
  return { backgroundImage: `url("${card.imageUrl}")` }
}

function getExportCardImageClass(game: TournamentTCG, card: DeckExportVisualCard) {
  if (isRiftboundBattlefieldCard(game, card)) return undefined
  return getCardImageOrientationClass(card, game)
}

function isRiftboundBattlefieldCard(game: TournamentTCG, card: Pick<DeckCard, 'section' | 'kind' | 'name'>) {
  if (game !== 'riftbound') return false
  const text = `${card.section} ${card.kind ?? ''} ${card.name}`.toLowerCase()
  return text.includes('battlefield') || text.includes('campo de batalla')
}

function getActiveDeckSections(
  game: TournamentTCG,
  sections: Array<{ id: string; label: string; min?: number; max?: number }>,
  magicFormat: MagicFormat,
) {
  if (game === 'magic' && magicFormat === 'commander') return magicCommanderSections
  return sections
}

function getVisibleDeckSections(
  game: TournamentTCG,
  sections: Array<{ id: string; label: string; min?: number; max?: number }>,
) {
  if (game !== 'riftbound') return sections
  return sections.filter(section => section.id !== 'Rune')
}

function getVisibleSectionId(game: TournamentTCG, sectionId: string) {
  if (game === 'riftbound' && sectionId === 'Rune') return 'Legend'
  return sectionId
}

function getCardsForVisibleSection(game: TournamentTCG, sectionId: string, cards: DeckCard[]) {
  if (game === 'riftbound' && sectionId === 'Legend') {
    return cards.filter(card => card.section === 'Legend' || card.section === 'Rune')
  }

  return orderVisibleDeckCards(game, sectionId, cards.filter(card => card.section === sectionId))
}

function orderVisibleDeckCards(game: TournamentTCG, sectionId: string, cards: DeckCard[]) {
  if (game !== 'magic' || sectionId !== 'Main') return cards
  return [...cards].sort((a, b) => compareMagicLandOrder(game, sectionId, a, b))
}

function compareMagicLandOrder(
  game: TournamentTCG,
  sectionId: string,
  a: Pick<DeckCard, 'name' | 'kind'>,
  b: Pick<DeckCard, 'name' | 'kind'>,
) {
  if (game !== 'magic' || sectionId !== 'Main') return 0
  const aLand = isMagicLandCard(a)
  const bLand = isMagicLandCard(b)
  if (aLand === bLand) return 0
  return aLand ? 1 : -1
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
  if (game === 'magic' && section === 'Commander') return true

  const defaultSection = getDefaultSection(game, card)
  if (section === defaultSection) return true

  if (game === 'magic') return section === 'Main'
  if (game === 'lorcana') return section === 'Main'
  if (game === 'one-piece') return section === 'Main' && defaultSection !== 'Leader'
  return false
}

function canPlaceCardInVisibleSection(
  game: TournamentTCG,
  card: Pick<CardSuggestion, 'name' | 'kind' | 'subtitle'>,
  section: string,
) {
  if (game === 'riftbound' && section === 'Legend') {
    const defaultSection = getDefaultSection(game, card)
    return defaultSection === 'Legend' || defaultSection === 'Rune'
  }

  return canPlaceCardInSection(game, card, section)
}

function getStoredSectionForVisibleDrop(
  game: TournamentTCG,
  section: string,
  card: Pick<CardSuggestion, 'name' | 'kind' | 'subtitle'>,
) {
  if (game === 'riftbound' && section === 'Legend') {
    const defaultSection = getDefaultSection(game, card)
    if (defaultSection === 'Rune') return 'Rune'
  }

  return section
}

function getDeckCardTileClass(
  game: TournamentTCG,
  sectionId: string,
  card: Pick<DeckCard, 'section' | 'kind' | 'name'>,
  isDropTarget: boolean,
) {
  return [
    'deck-card-tile compact',
    isRiftboundBattlefieldCard(game, { ...card, section: sectionId }) ? 'deck-card-tile-battlefield' : '',
    isDropTarget ? 'drop-target' : '',
  ].filter(Boolean).join(' ')
}

function normalizeResolvedDeckSectionsForGame(cards: DeckCard[], game: TournamentTCG) {
  if (game !== 'riftbound' && game !== 'yugioh') return cards
  return cards.map(card => ({
    ...card,
    section: getHydratedCardSection(game, card, card),
  }))
}

function getMagicFormatWarnings(cards: DeckCard[], format: MagicFormat) {
  const warnings: string[] = []
  const commanderTotal = cards.filter(card => card.section === 'Commander').reduce((sum, card) => sum + card.quantity, 0)
  const mainTotal = cards.filter(card => card.section === 'Main').reduce((sum, card) => sum + card.quantity, 0)
  const sideTotal = cards.filter(card => card.section === 'Sideboard').reduce((sum, card) => sum + card.quantity, 0)

  if (format === 'commander') {
    const total = commanderTotal + mainTotal
    if (total !== 100) warnings.push('Commander: exactamente 100 cartas')
    if (commanderTotal < 1) warnings.push('Commander: anade el comandante')
    if (commanderTotal > 2) warnings.push('Commander: maximo 2 cartas en comandante')
    if (sideTotal > 0) warnings.push('Commander: el sideboard no cuenta para el mazo')
    const byName = new Map<string, number>()
    cards
      .filter(card => card.section !== 'Sideboard')
      .forEach(card => byName.set(card.name.toLowerCase(), (byName.get(card.name.toLowerCase()) ?? 0) + card.quantity))
    byName.forEach((quantity, name) => {
      if (quantity > 1 && !isBasicMagicLand(name)) warnings.push(`${titleCase(name)}: singleton en Commander`)
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

function isMagicLandCard(card: Pick<DeckCard, 'name' | 'kind'>) {
  return /\bland\b/i.test(card.kind ?? '') || isBasicMagicLand(card.name.trim())
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, letter => letter.toUpperCase())
}

function expandCards(cards: DeckCard[]) {
  return cards.flatMap(card => Array.from({ length: card.quantity }, () => card))
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

function normalizeImportedDeckSectionsForTournament(
  cards: DeckCard[],
  game: TournamentTCG,
  magicFormat: MagicFormat,
) {
  if (game !== 'magic' || magicFormat !== 'commander') return cards

  const sideboardTotal = cards
    .filter(card => card.section === 'Sideboard')
    .reduce((sum, card) => sum + card.quantity, 0)

  if (sideboardTotal < 1 || sideboardTotal > 2) return cards

  return cards.map(card =>
    card.section === 'Sideboard'
      ? { ...card, section: 'Commander' }
      : card,
  )
}

function getCardImageOrientationClass(card: Pick<DeckCard, 'orientation' | 'kind' | 'name'>, game?: TournamentTCG) {
  return inferCardOrientation(card, game) === 'landscape' ? 'deck-card-image-landscape' : undefined
}

function inferCardOrientation(
  card: Pick<DeckCard, 'orientation' | 'kind' | 'name'>,
  game?: TournamentTCG,
): DeckCard['orientation'] {
  if (game === 'lorcana') return undefined
  if (card.orientation) return card.orientation
  return undefined
}

function getHydratedCardSection(
  game: TournamentTCG,
  card: Pick<DeckCard, 'section'>,
  resolved?: Pick<CardSuggestion, 'name' | 'kind' | 'subtitle'>,
) {
  if (!resolved) return card.section
  const section = getDefaultSection(game, resolved)
  const importedSection = normalizeImportedSection(game, card.section)

  if (game === 'yugioh') {
    if (importedSection === 'Side') return 'Side'
    if (importedSection === 'Extra') return 'Extra'
    return 'Main'
  }

  if (game !== 'riftbound') return importedSection

  if (importedSection === 'Legend' || importedSection === 'Champion' || importedSection === 'Sideboard') {
    return importedSection
  }

  if (importedSection === 'Rune') {
    return section === 'Main' ? 'Main' : 'Rune'
  }

  if (importedSection === 'Battlefield') {
    return section === 'Rune' ? 'Rune' : 'Battlefield'
  }

  if (!resolved.kind && !resolved.subtitle && section === 'Main') return importedSection
  return section
}

function getReusableDecksFromPlayerHistory(
  tournaments: Tournament[],
  currentTournamentId: string,
  game: TournamentTCG,
  playerName: string,
): ReusableDeckTemplate[] {
  const normalizedPlayerName = normalizePlayerNameForDeckHistory(playerName)
  if (!normalizedPlayerName) return []

  const byDeck = new Map<string, ReusableDeckTemplate>()

  for (const tournament of tournaments) {
    if (tournament.id === currentTournamentId || tournament.tcg !== game) continue

    for (const deck of tournament.decklists ?? []) {
      if (normalizePlayerNameForDeckHistory(deck.playerName) !== normalizedPlayerName) continue
      if (!deck.list?.trim()) continue

      const reusableDeck: ReusableDeckTemplate = {
        id: `history:${tournament.id}:${deck.id}`,
        game: deck.game,
        playerName: deck.playerName,
        archetype: deck.archetype,
        name: deck.name,
        list: deck.list,
        notes: deck.notes,
        updatedAt: deck.updatedAt,
        sourceLabel: `Historial: ${tournament.name}`,
      }
      const key = getReusableDeckKey(reusableDeck)
      const current = byDeck.get(key)
      if (!current || reusableDeck.updatedAt > current.updatedAt) {
        byDeck.set(key, reusableDeck)
      }
    }
  }

  return [...byDeck.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

function getReusableDeckKey(deck: Pick<SavedDeckTemplate, 'game' | 'name' | 'list'>) {
  return `${deck.game}:${deck.name.trim().toLowerCase()}:${deck.list.trim()}`
}

function normalizePlayerNameForDeckHistory(name: string) {
  return name.trim().toLocaleLowerCase('es-ES').replace(/\s+/g, ' ')
}

async function hydrateMissingImages(cards: DeckCard[], game: TournamentTCG, forExport = false) {
  const imageCache = new Map<string, Promise<string>>()
  const searchCache = new Map<string, Promise<CardSuggestion[]>>()

  if (game === 'magic') {
    return hydrateMagicDeckImages(cards, forExport, imageCache, searchCache)
  }

  const hydrated = await hydrateCardsUniquely(cards, 8, async card => {
    if (card.imageUrl) {
      const orientation = inferCardOrientation(card, game)
      const section = getHydratedCardSection(game, card, card)
      const usableImageUrl = forExport
        ? await cachedDataUrl(card.imageUrl, imageCache).catch(async () => {
            const proxied = proxiedImageUrl(card.imageUrl)
            if (proxied && proxied !== card.imageUrl) {
              return cachedDataUrl(proxied, imageCache).catch(() => proxied)
            }
            return card.imageUrl
        })
        : card.imageUrl
      return { ...card, section, orientation, imageUrl: usableImageUrl, artUrl: card.artUrl }
    }

    if (game === 'one-piece') {
      const enriched = await hydrateOnePieceCard(card, forExport, imageCache).catch(() => null)
      if (enriched) return enriched
      if (extractOnePieceCardCode(card.cardId) || extractOnePieceCardCode(card.name)) return card
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

    const usableImageUrl = forExport
      ? await cachedDataUrl(rawImageUrl, imageCache).catch(async () => {
          const proxied = proxiedImageUrl(rawImageUrl)
          if (proxied && proxied !== rawImageUrl) {
            return cachedDataUrl(proxied, imageCache).catch(() => proxied)
          }
          return rawImageUrl
        })
      : rawImageUrl
    return {
      ...card,
      cardId: match.id,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, game),
      kind: match.kind,
      legalities: match.legalities,
      section: getHydratedCardSection(game, card, match),
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  })

  return hydrated
}

async function hydrateMagicDeckImages(
  cards: DeckCard[],
  forExport: boolean,
  imageCache: Map<string, Promise<string>>,
  searchCache: Map<string, Promise<CardSuggestion[]>>,
) {
  const batchMatches = await resolveMagicCardsBatch(
    cards
      .filter(card => !card.imageUrl)
      .map(card => ({ cardId: card.cardId, name: card.name })),
  ).catch(() => new Map<string, CardSuggestion>())

  const hydrateWithMatch = async (card: DeckCard, match: CardSuggestion) => {
    if (!match.imageUrl) return card
    const usableImageUrl = forExport
      ? await cachedExportImage(match.imageUrl, imageCache)
      : match.imageUrl
    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, 'magic'),
      kind: match.kind,
      legalities: match.legalities,
      section: card.section,
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  }

  return hydrateCardsUniquely(cards, 1, async card => {
    if (card.imageUrl) {
      const usableImageUrl = forExport
        ? await cachedExportImage(card.imageUrl, imageCache)
        : card.imageUrl
      return {
        ...card,
        orientation: inferCardOrientation(card, 'magic'),
        imageUrl: usableImageUrl,
        artUrl: card.artUrl,
      }
    }

    const batchMatch = batchMatches.get(card.cardId)
    if (batchMatch?.imageUrl) return hydrateWithMatch(card, batchMatch)

    const cardById = await hydrateKnownCardById(card, 'magic', forExport, imageCache).catch(() => null)
    if (cardById) return cardById

    const exactSuggestions = await cachedCardSearch('magic', card.name, true, searchCache).catch(() => [])
    const looseSuggestions = exactSuggestions.length
      ? exactSuggestions
      : await cachedCardSearch('magic', card.name, false, searchCache).catch(() => [])
    const exact = looseSuggestions.find(candidate => candidate.name.toLowerCase() === card.name.toLowerCase())
    const match = exact ?? looseSuggestions[0]
    if (!match?.imageUrl) return card

    return hydrateWithMatch(card, match)
  })
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

async function cachedExportImage(url: string, cache: Map<string, Promise<string>>) {
  return cachedDataUrl(url, cache).catch(async () => {
    const proxied = proxiedImageUrl(url)
    if (proxied && proxied !== url) {
      return cachedDataUrl(proxied, cache).catch(() => proxied)
    }
    return url
  })
}

async function hydrateCardsUniquely(
  cards: DeckCard[],
  limit: number,
  mapper: (item: DeckCard) => Promise<DeckCard>,
) {
  const uniqueCards: DeckCard[] = []
  const indexByKey = new Map<string, number>()

  for (const card of cards) {
    const key = getHydrationKey(card)
    if (!indexByKey.has(key)) {
      indexByKey.set(key, uniqueCards.length)
      uniqueCards.push(card)
    }
  }

  const hydratedUnique = await mapWithConcurrency(uniqueCards, limit, mapper)

  return cards.map(card => {
    const hydrated = hydratedUnique[indexByKey.get(getHydrationKey(card)) ?? 0] ?? card
    return {
      ...hydrated,
      id: card.id,
      quantity: card.quantity,
    }
  })
}

function getHydrationKey(card: DeckCard) {
  return [
    card.section,
    card.cardId,
    card.name.toLowerCase(),
    card.imageUrl ?? '',
    card.artUrl ?? '',
  ].join('|')
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
    orientation: inferCardOrientation(match, 'one-piece'),
    kind: match.kind,
    section: getOnePieceSectionFromKind(match.kind),
    imageUrl: usableImageUrl || match.imageUrl,
    artUrl: match.artUrl,
  }
}

async function hydrateKnownCardById(
  card: DeckCard,
  game: TournamentTCG,
  forExport: boolean,
  imageCache = new Map<string, Promise<string>>(),
): Promise<DeckCard | null> {
  if (game === 'magic') {
    const match = await resolveMagicCard(card.cardId).catch(() => null)
    if (!match?.imageUrl) return null

    const usableImageUrl = forExport
      ? await cachedExportImage(match.imageUrl, imageCache)
      : match.imageUrl
    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, game),
      kind: match.kind,
      legalities: match.legalities,
      section: card.section,
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  }

  if (game === 'one-piece') {
    return hydrateOnePieceCard(card, forExport, new Map())
  }

  if (game === 'pokemon') {
    const match = await resolvePokemonCard(card.cardId, card.name).catch(() => null)
    if (!match?.imageUrl) return null

    const usableImageUrl = forExport
      ? await cachedExportImage(match.imageUrl, imageCache)
      : match.imageUrl

    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, game),
      kind: match.kind,
      legalities: match.legalities,
      section: getHydratedCardSection(game, card, match),
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  }

  if (game === 'yugioh') {
    const match = await resolveYugiohCard(card.cardId).catch(() => null)
    if (!match?.imageUrl) return null

    const usableImageUrl = forExport
      ? await cachedExportImage(match.imageUrl, imageCache)
      : match.imageUrl
    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, game),
      kind: match.kind,
      legalities: match.legalities,
      section: getHydratedCardSection(game, card, match),
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  }

  if (game === 'riftbound') {
    const code = card.cardId.split(':').pop()
    if (!code || !/^[a-z]{2,4}-\d{1,3}[a-z]?(?:-\d+)?$/i.test(code)) return null
    const match = (await searchCards(game, code, undefined, { onlyImages: true, exact: true }))[0]
    if (!match?.imageUrl) return null

    const usableImageUrl = forExport
      ? await fetchImageAsDataUrl(match.imageUrl).catch(() => match.imageUrl)
      : match.imageUrl
    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, game),
      kind: match.kind,
      legalities: match.legalities,
      section: getDefaultSection(game, match),
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  }

  if (game === 'lorcana') {
    const canResolveById = card.cardId.startsWith('lorcana:') && !card.cardId.startsWith('lorcana:name:')
    const lorcanaId = card.cardId.startsWith('lorcana:') ? card.cardId : `lorcana:${card.cardId}`
    const match =
      (canResolveById ? await resolveLorcanaCard(lorcanaId).catch(() => null) : null) ??
      (await searchCards(game, card.name, undefined, { onlyImages: true, exact: true }).catch(() => []))[0] ??
      (await searchCards(game, card.name, undefined, { onlyImages: true, exact: false }).catch(() => []))[0]
    if (!match?.imageUrl) return null

    const usableImageUrl = forExport
      ? await fetchImageAsDataUrl(match.imageUrl).catch(() => match.imageUrl)
      : match.imageUrl
    return {
      ...card,
      cardId: match.id,
      name: match.name || card.name,
      subtitle: match.subtitle,
      orientation: inferCardOrientation(match, game),
      kind: match.kind,
      legalities: match.legalities,
      section: getDefaultSection(game, match),
      imageUrl: usableImageUrl,
      artUrl: match.artUrl,
    }
  }

  return null
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
