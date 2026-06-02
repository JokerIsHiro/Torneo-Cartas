// Buscador unificado de cartas para el deck builder. Anade aqui nuevos juegos,
// normalizacion de resultados o fallback entre APIs.
import type { TournamentTCG } from "../types/tournament";
import { displayImageUrl } from "../utils/imageExport";
import { extractOnePieceCardCode } from "../utils/onePieceCardCode";
import {
  fetchLorcanaCardById,
  getLorcanaCardDisplayName,
  getLorcanaCardImageUrl,
  getLorcanaCardStableId,
  searchLorcanaCardsLocally,
  type LorcanaCard,
} from "./lorcanaApi";
import { fetchOnePieceCardByCode, searchOnePieceCardsByName } from "./optcgApi";
import { fetchRiftscribe } from "./riftscribeApi";

export interface CardSuggestion {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
  artUrl?: string;
  orientation?: "portrait" | "landscape";
  kind?: string;
  text?: string;
  legalities?: Record<string, string>;
}

export interface CardSearchFilters {
  kind?: string;
  color?: string;
  attribute?: string;
  cardType?: string;
  onlyImages?: boolean;
  exact?: boolean;
  text?: string;
  format?: string;
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SCRYFALL_MIN_REQUEST_INTERVAL_MS = 95;

const searchResultCache = new Map<
  string,
  { expires: number; cards: CardSuggestion[] }
>();
let nextScryfallRequestAt = 0;

function searchCacheKey(
  game: TournamentTCG,
  term: string,
  filters: CardSearchFilters,
) {
  return `${game}:${term.toLowerCase()}:${JSON.stringify(filters)}`;
}

export async function searchCards(
  game: TournamentTCG,
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const cacheKey = searchCacheKey(game, term, filters);
  const cached = searchResultCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.cards;
  }

  const cards = await (() => {
    if (game === "magic") return searchMagic(term, signal, filters);
    if (game === "pokemon") return searchPokemon(term, signal, filters);
    if (game === "yugioh") return searchYugioh(term, signal, filters);
    if (game === "lorcana") return searchLorcana(term, signal, filters);
    if (game === "one-piece") return searchOnePiece(term, signal, filters);
    if (game === "riftbound") return searchRiftbound(term, signal, filters);
    return Promise.resolve([]);
  })();

  if (
    !cards.length ||
    (filters.onlyImages && !cards.some((card) => card.imageUrl))
  ) {
    const fallback = await searchApiTcg(game, term, signal, filters).catch(
      () => [],
    );
    const combined = uniqueCards([...cards, ...fallback]);
    const merged = filters.onlyImages
      ? combined.filter((card) => card.imageUrl)
      : combined;
    searchResultCache.set(cacheKey, {
      cards: merged,
      expires: Date.now() + SEARCH_CACHE_TTL_MS,
    });
    return merged;
  }

  const result = filters.onlyImages
    ? uniqueCards(cards).filter((card) => card.imageUrl)
    : uniqueCards(cards);

  searchResultCache.set(cacheKey, {
    cards: result,
    expires: Date.now() + SEARCH_CACHE_TTL_MS,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Filtros de búsqueda por juego
// ---------------------------------------------------------------------------

export function getCardFilterOptions(
  game: TournamentTCG,
): Array<{ label: string; value: string }> {
  if (game === "magic") {
    return [
      { label: "Todas", value: "" },
      { label: "Criaturas", value: "creature" },
      { label: "Instantaneos", value: "instant" },
      { label: "Conjuros", value: "sorcery" },
      { label: "Artefactos", value: "artifact" },
      { label: "Encantamientos", value: "enchantment" },
      { label: "Tierras", value: "land" },
    ];
  }

  if (game === "pokemon") {
    return [
      { label: "Todas", value: "" },
      { label: "Pokemon", value: "pokemon" },
      { label: "Trainer", value: "trainer" },
      { label: "Energy", value: "energy" },
    ];
  }

  if (game === "yugioh") {
    return [
      { label: "Todas", value: "" },
      { label: "Monstruos", value: "monster" },
      { label: "Magias", value: "spell" },
      { label: "Trampas", value: "trap" },
    ];
  }

  if (game === "lorcana") {
    return [
      { label: "Todas", value: "" },
      { label: "Personajes", value: "character" },
      { label: "Acciones", value: "action" },
      { label: "Canciones", value: "song" },
      { label: "Objetos", value: "item" },
      { label: "Lugares", value: "location" },
    ];
  }

  if (game === "riftbound") {
    return [
      { label: "Todas", value: "" },
      { label: "Unidades", value: "Unit" },
      { label: "Campeones", value: "Champion" },
      { label: "Leyendas", value: "Legend" },
      { label: "Runas", value: "Rune" },
      { label: "Campos", value: "Battlefield" },
      { label: "Conjuros", value: "Spell" },
    ];
  }

  return [];
}

export function getAdvancedCardFilterOptions(game: TournamentTCG): Array<{
  key: "color" | "attribute" | "cardType";
  label: string;
  options: Array<{ label: string; value: string }>;
}> {
  if (game === "magic") {
    return [
      {
        key: "color",
        label: "Color",
        options: [
          { label: "Todos", value: "" },
          { label: "Blanco", value: "w" },
          { label: "Azul", value: "u" },
          { label: "Negro", value: "b" },
          { label: "Rojo", value: "r" },
          { label: "Verde", value: "g" },
          { label: "Incoloro", value: "c" },
        ],
      },
    ];
  }

  if (game === "pokemon") {
    return [
      {
        key: "cardType",
        label: "Tipo Pokemon",
        options: [
          { label: "Todos", value: "" },
          { label: "Grass", value: "Grass" },
          { label: "Fire", value: "Fire" },
          { label: "Water", value: "Water" },
          { label: "Lightning", value: "Lightning" },
          { label: "Psychic", value: "Psychic" },
          { label: "Fighting", value: "Fighting" },
          { label: "Darkness", value: "Darkness" },
          { label: "Metal", value: "Metal" },
          { label: "Dragon", value: "Dragon" },
          { label: "Colorless", value: "Colorless" },
        ],
      },
    ];
  }

  if (game === "yugioh") {
    return [
      {
        key: "attribute",
        label: "Atributo",
        options: [
          { label: "Todos", value: "" },
          { label: "Dark", value: "dark" },
          { label: "Light", value: "light" },
          { label: "Fire", value: "fire" },
          { label: "Water", value: "water" },
          { label: "Earth", value: "earth" },
          { label: "Wind", value: "wind" },
          { label: "Divine", value: "divine" },
        ],
      },
      {
        key: "cardType",
        label: "Tipo monstruo",
        options: [
          { label: "Todos", value: "" },
          { label: "Dragon", value: "dragon" },
          { label: "Spellcaster", value: "spellcaster" },
          { label: "Warrior", value: "warrior" },
          { label: "Beast", value: "beast" },
          { label: "Machine", value: "machine" },
          { label: "Fiend", value: "fiend" },
          { label: "Fairy", value: "fairy" },
          { label: "Zombie", value: "zombie" },
        ],
      },
    ];
  }

  if (game === "lorcana") {
    return [
      {
        key: "color",
        label: "Tinta",
        options: [
          { label: "Todas", value: "" },
          { label: "Amber", value: "amber" },
          { label: "Amethyst", value: "amethyst" },
          { label: "Emerald", value: "emerald" },
          { label: "Ruby", value: "ruby" },
          { label: "Sapphire", value: "sapphire" },
          { label: "Steel", value: "steel" },
        ],
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Magic — Scryfall
// ---------------------------------------------------------------------------

async function searchMagic(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  if (
    filters.exact &&
    !filters.kind &&
    !filters.color &&
    !filters.text?.trim()
  ) {
    const exactUrl = new URL("https://api.scryfall.com/cards/named");
    exactUrl.searchParams.set("exact", query);
    const card = await fetchScryfallJson<ScryfallCard>(exactUrl, signal);
    if (card?.id) {
      return [scryfallCardToSuggestion(card)];
    }
  }

  const url = new URL("https://api.scryfall.com/cards/search");
  const baseQuery = filters.exact ? `!"${escapeScryfallQuery(query)}"` : query;
  const typeQuery = filters.kind ? ` t:${filters.kind}` : "";
  const colorQuery = filters.color ? ` c:${filters.color}` : "";
  const formatQuery = filters.format ? ` f:${filters.format}` : "";
  const textQuery = filters.text?.trim()
    ? ` o:"${escapeScryfallQuery(filters.text.trim())}"`
    : "";
  url.searchParams.set(
    "q",
    `${baseQuery}${typeQuery}${colorQuery}${formatQuery}${textQuery}`,
  );
  url.searchParams.set("unique", "cards");
  url.searchParams.set("order", "name");
  url.searchParams.set("include_extras", "false");

  const payload = await fetchScryfallJson<{ data?: ScryfallCard[] }>(url, signal);
  return uniqueCards((payload?.data ?? []).map(scryfallCardToSuggestion)).slice(
    0,
    12,
  );
}

async function waitForScryfallTurn() {
  const now = Date.now();
  const waitMs = Math.max(0, nextScryfallRequestAt - now);
  nextScryfallRequestAt = now + waitMs + SCRYFALL_MIN_REQUEST_INTERVAL_MS;

  if (waitMs > 0) {
    await new Promise(resolve => globalThis.setTimeout(resolve, waitMs));
  }
}

async function fetchScryfallJson<T>(
  input: string | URL,
  signal?: AbortSignal,
  retries = 2,
  init: RequestInit = {},
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await waitForScryfallTurn();

    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    const response = await fetch(input, {
      ...init,
      signal,
      headers,
    });

    if (response.ok) return (await response.json()) as T;

    if (![429, 500, 502, 503, 504].includes(response.status)) return null;

    if (attempt < retries) {
      await new Promise(resolve => globalThis.setTimeout(resolve, 450 * (attempt + 1)));
    }
  }

  return null;
}

type ScryfallCard = {
  id: string;
  name: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  type_line?: string;
  oracle_text?: string;
  legalities?: Record<string, string>;
  image_uris?: { small?: string; normal?: string; large?: string; png?: string; art_crop?: string };
  card_faces?: Array<{
    oracle_text?: string;
    image_uris?: { small?: string; normal?: string; large?: string; png?: string; art_crop?: string };
  }>;
};

function scryfallCardToSuggestion(card: ScryfallCard): CardSuggestion {
  const imageUrl =
    card.image_uris?.normal ??
    card.image_uris?.large ??
    card.image_uris?.small ??
    card.image_uris?.png ??
    card.card_faces
      ?.flatMap(face => [
        face.image_uris?.normal,
        face.image_uris?.large,
        face.image_uris?.small,
        face.image_uris?.png,
      ])
      .find(Boolean);
  const artUrl =
    card.image_uris?.art_crop ??
    card.card_faces
      ?.flatMap(face => [face.image_uris?.art_crop])
      .find(Boolean);

  return {
    id: `magic:${card.id}`,
    name: card.name,
    subtitle: card.set_name,
    imageUrl: displayImageUrl(imageUrl),
    artUrl: displayImageUrl(artUrl),
    kind: card.type_line,
    text:
      card.oracle_text ??
      card.card_faces
        ?.map((f) => f.oracle_text)
        .filter(Boolean)
        .join("\n"),
    legalities: card.legalities,
  };
}

export async function resolveMagicCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<CardSuggestion | null> {
  const rawId = normalizeMagicLookupId(cardId);
  const card = await fetchScryfallCardByLookup(rawId, signal);
  return card ? scryfallCardToSuggestion(card) : null;
}

type MagicBatchLookup = {
  cardId: string;
  name: string;
};

type ScryfallCollectionIdentifier =
  | { id: string }
  | { set: string; collector_number: string }
  | { name: string };

export async function resolveMagicCardsBatch(
  lookups: MagicBatchLookup[],
  signal?: AbortSignal,
): Promise<Map<string, CardSuggestion>> {
  const matches = new Map<string, CardSuggestion>();
  const pending = lookups.filter(lookup => lookup.name.trim() || lookup.cardId.trim());
  if (!pending.length) return matches;

  const identifierByKey = new Map<string, ScryfallCollectionIdentifier>();

  for (const lookup of pending) {
    const rawId = normalizeMagicLookupId(lookup.cardId);
    const scryfallId = getScryfallUuid(rawId);
    const setCollector = parseMagicSetCollector(rawId);
    const identifier = scryfallId
      ? ({ id: scryfallId } satisfies ScryfallCollectionIdentifier)
      : setCollector
        ? ({
            set: setCollector.set,
            collector_number: setCollector.collectorNumber,
          } satisfies ScryfallCollectionIdentifier)
        : ({ name: lookup.name.trim() || rawId } satisfies ScryfallCollectionIdentifier);

    identifierByKey.set(getScryfallIdentifierKey(identifier), identifier);
  }

  const fetchedCards: ScryfallCard[] = [];
  const identifiers = [...identifierByKey.values()];

  for (let start = 0; start < identifiers.length; start += 75) {
    const chunk = identifiers.slice(start, start + 75);
    const payload = await fetchScryfallJson<{ data?: ScryfallCard[] }>(
      "https://api.scryfall.com/cards/collection",
      signal,
      2,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk }),
      },
    );

    fetchedCards.push(...(payload?.data ?? []));
  }

  if (!fetchedCards.length) return matches;

  const byId = new Map<string, ScryfallCard>();
  const bySetCollector = new Map<string, ScryfallCard>();
  const byName = new Map<string, ScryfallCard>();

  for (const card of fetchedCards) {
    byId.set(card.id.toLowerCase(), card);
    byName.set(normalizeMagicName(card.name), card);
    const splitName = card.name.split("//")[0]?.trim();
    if (splitName) byName.set(normalizeMagicName(splitName), card);
    if (card.set && card.collector_number) {
      bySetCollector.set(
        getMagicSetCollectorKey(card.set, card.collector_number),
        card,
      );
    }
  }

  for (const lookup of pending) {
    const rawId = normalizeMagicLookupId(lookup.cardId);
    const scryfallId = getScryfallUuid(rawId);
    const setCollector = parseMagicSetCollector(rawId);
    const found =
      (scryfallId ? byId.get(scryfallId.toLowerCase()) : undefined) ??
      (setCollector
        ? bySetCollector.get(
            getMagicSetCollectorKey(
              setCollector.set,
              setCollector.collectorNumber,
            ),
          )
        : undefined) ??
      byName.get(normalizeMagicName(lookup.name)) ??
      byName.get(normalizeMagicName(rawId));

    if (found) matches.set(lookup.cardId, scryfallCardToSuggestion(found));
  }

  return matches;
}

async function fetchScryfallCardByLookup(
  rawId: string,
  signal?: AbortSignal,
): Promise<ScryfallCard | null> {
  const scryfallId = getScryfallUuid(rawId);
  const setCollector = parseMagicSetCollector(rawId);

  const urls = [
    scryfallId ? `https://api.scryfall.com/cards/${scryfallId}` : "",
    setCollector
      ? `https://api.scryfall.com/cards/${encodeURIComponent(setCollector.set)}/${encodeURIComponent(setCollector.collectorNumber)}`
      : "",
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const card = await fetchScryfallJson<ScryfallCard>(url, signal);
      if (card?.id) return card;
    } catch {
      // Siguiente formato de lookup.
    }
  }

  return null;
}

function getScryfallUuid(value: string) {
  return value.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )?.[0];
}

function normalizeMagicLookupId(value: string) {
  let rawId = value.trim();
  rawId = rawId.replace(/^magic:/i, "").trim();
  rawId = rawId.replace(/^import:/i, "").trim();

  if (rawId.includes(":")) {
    rawId = rawId.split(":").filter(Boolean).pop() ?? rawId;
  }

  return rawId.trim();
}

function parseMagicSetCollector(value: string) {
  const match = value
    .trim()
    .match(/^([a-z0-9]{2,8})[\s_/#:-]+(?:no\.?\s*)?([a-z0-9★☆]{1,8})$/i);
  if (!match) return null;

  return {
    set: match[1].toLowerCase(),
    collectorNumber: match[2].toLowerCase(),
  };
}

function getScryfallIdentifierKey(identifier: ScryfallCollectionIdentifier) {
  if ("id" in identifier) return `id:${identifier.id.toLowerCase()}`;
  if ("set" in identifier) {
    return `set:${getMagicSetCollectorKey(identifier.set, identifier.collector_number)}`;
  }
  return `name:${normalizeMagicName(identifier.name)}`;
}

function getMagicSetCollectorKey(set: string, collectorNumber: string) {
  return `${set.toLowerCase()}:${collectorNumber.toLowerCase()}`;
}

function normalizeMagicName(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Pokemon — pokemontcg.io
// ---------------------------------------------------------------------------

async function searchPokemon(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const url = new URL("https://api.pokemontcg.io/v2/cards");
  const supertype = filters.kind ? ` supertype:${filters.kind}` : "";
  const type = filters.cardType ? ` types:${filters.cardType}` : "";
  const nameQuery = filters.exact
    ? `name:"${escapePokemonQuery(query)}"`
    : `name:${escapePokemonQuery(query)}*`;
  url.searchParams.set("q", `${nameQuery}${supertype}${type}`);
  url.searchParams.set("pageSize", filters.exact ? "24" : "32");
  url.searchParams.set("orderBy", "-set.releaseDate,name");
  url.searchParams.set(
    "select",
    "id,name,set,number,images,rarity,rules,attacks,abilities",
  );

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { data?: PokemonCard[] };
  return filterByText(
    sortPokemonPrintings(payload.data ?? []).map((card) =>
      pokemonCardToSuggestion(card, filters.kind),
    ),
    filters.text,
  ).slice(0, 12);
}

type PokemonCard = {
  id: string;
  name: string;
  number?: string;
  set?: { name?: string; releaseDate?: string; ptcgoCode?: string };
  types?: string[];
  images?: { small?: string; large?: string };
  rarity?: string;
  tcgplayer?: {
    prices?: Record<string, { market?: number; low?: number; mid?: number }>;
  };
  rules?: string[];
  attacks?: Array<{ text?: string }>;
  abilities?: Array<{ text?: string }>;
};

export async function resolvePokemonCard(
  cardId: string,
  name?: string,
  signal?: AbortSignal,
): Promise<CardSuggestion | null> {
  const rawId = cardId.split(":").pop()?.trim() ?? "";
  const directId = cardId.startsWith("pokemon:") ? rawId : "";

  if (directId && /^[a-z0-9]+-\d+[a-z]?$/i.test(directId)) {
    const direct = await fetchPokemonCardById(directId.toLowerCase(), signal);
    if (direct) return direct;
  }

  const setCollector = parsePokemonSetCollector(rawId);
  if (setCollector) {
    const byCollector = await searchPokemonBySetCollector(
      setCollector.setCode,
      setCollector.number,
      signal,
    );
    if (byCollector) return byCollector;
  }

  if (name?.trim()) {
    const exact = await searchPokemon(name, signal, {
      onlyImages: true,
      exact: true,
    }).catch(() => []);
    return (
      exact.find(candidate => candidate.name.toLowerCase() === name.toLowerCase()) ??
      exact[0] ??
      null
    );
  }

  return null;
}

async function fetchPokemonCardById(id: string, signal?: AbortSignal) {
  const response = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: PokemonCard };
  return payload.data ? pokemonCardToSuggestion(payload.data) : null;
}

async function searchPokemonBySetCollector(setCode: string, number: string, signal?: AbortSignal) {
  const url = new URL("https://api.pokemontcg.io/v2/cards");
  url.searchParams.set("q", `set.ptcgoCode:${escapePokemonQuery(setCode)} number:${escapePokemonQuery(number)}`);
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("select", "id,name,set,number,images,rarity,rules,attacks,abilities");

  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: PokemonCard[] };
  return payload.data?.[0] ? pokemonCardToSuggestion(payload.data[0]) : null;
}

function parsePokemonSetCollector(value: string) {
  const match = value.match(/\b([A-Z0-9]{2,8})[-\s_/#]+0*(\d{1,4}[a-z]?)/i);
  return match ? { setCode: match[1].toUpperCase(), number: match[2].toLowerCase() } : null;
}

function pokemonCardToSuggestion(card: PokemonCard, fallbackKind?: string): CardSuggestion {
  return {
    id: `pokemon:${card.id}`,
    name: card.name,
    subtitle: [card.set?.name, card.rarity].filter(Boolean).join(" - "),
    imageUrl: displayImageUrl(card.images?.large ?? card.images?.small),
    artUrl: displayImageUrl(card.images?.large ?? card.images?.small),
    kind: card.types?.join(", ") ?? fallbackKind,
    text: [
      ...(card.rules ?? []),
      ...(card.attacks ?? []).map((a) => a.text ?? ""),
      ...(card.abilities ?? []).map((a) => a.text ?? ""),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function sortPokemonPrintings(cards: PokemonCard[]) {
  return [...cards].sort((a, b) => {
    const rarityScore = getPokemonRarityScore(a) - getPokemonRarityScore(b);
    if (rarityScore !== 0) return rarityScore;
    const dateScore = getPokemonReleaseTime(b) - getPokemonReleaseTime(a);
    if (dateScore !== 0) return dateScore;
    return getPokemonPrice(a) - getPokemonPrice(b);
  });
}

function getPokemonRarityScore(card: PokemonCard) {
  const text = `${card.id} ${card.rarity ?? ""}`.toLowerCase();
  if (
    /promo|secret|rainbow|hyper|shiny|illustration|special|trainer gallery|gold|rare holo vmax|rare holo vstar|rare ultra|rare secret/.test(
      text,
    )
  )
    return 3;
  if (/rare holo|double rare|ace spec|amazing rare|radiant/.test(text))
    return 2;
  if (/rare/.test(text)) return 1;
  return 0;
}

function getPokemonReleaseTime(card: PokemonCard) {
  const raw = card.set?.releaseDate;
  const time = raw ? Date.parse(raw) : 0;
  return Number.isFinite(time) ? time : 0;
}

function getPokemonPrice(card: PokemonCard) {
  const values = Object.values(card.tcgplayer?.prices ?? {})
    .flatMap((p) => [p.market, p.low, p.mid])
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  return values.length ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
}

// ---------------------------------------------------------------------------
// Yu-Gi-Oh — ygoprodeck
// ---------------------------------------------------------------------------

async function searchYugioh(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const url = new URL("https://db.ygoprodeck.com/api/v7/cardinfo.php");
  url.searchParams.set(filters.exact ? "name" : "fname", query);

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { data?: YugiohApiCard[] };

  const cards = filterByText(
    uniqueCards((payload.data ?? []).map(yugiohCardToSuggestion)),
    filters.text,
  );

  return filterYugiohCards(cards, filters).slice(0, 12);
}

type YugiohApiCard = {
  id: number;
  name: string;
  type?: string;
  race?: string;
  attribute?: string;
  desc?: string;
  card_images?: Array<{ image_url?: string; image_url_small?: string; image_url_cropped?: string }>;
};

function yugiohCardToSuggestion(card: YugiohApiCard): CardSuggestion {
  const images = card.card_images?.[0];
  return {
    id: `yugioh:${card.id}`,
    name: card.name,
    subtitle: card.type,
    imageUrl: displayImageUrl(images?.image_url ?? images?.image_url_small),
    artUrl: displayImageUrl(images?.image_url_cropped ?? images?.image_url ?? images?.image_url_small),
    kind: [card.type, card.race, card.attribute].filter(Boolean).join(" - "),
    text: card.desc,
  };
}

export async function resolveYugiohCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<CardSuggestion | null> {
  const numericId = cardId.split(":").pop()?.trim();
  if (!numericId || !/^\d+$/.test(numericId)) return null;

  const url = new URL("https://db.ygoprodeck.com/api/v7/cardinfo.php");
  url.searchParams.set("id", numericId);

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: YugiohApiCard[] };
  const card = payload.data?.[0];
  return card ? yugiohCardToSuggestion(card) : null;
}
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Lorcana — Lorcast
// ---------------------------------------------------------------------------

function lorcanaCardToSuggestion(card: LorcanaCard): CardSuggestion {
  const displayName = getLorcanaCardDisplayName(card);

  return {
    id: `lorcana:${getLorcanaCardStableId(card)}`,
    name: displayName,
    subtitle: card.set?.name,
    imageUrl: displayImageUrl(getLorcanaCardImageUrl(card)),
    artUrl: displayImageUrl(getLorcanaCardImageUrl(card)),
    orientation: "portrait",
    kind: [card.type?.join(" - "), card.ink].filter(Boolean).join(" - "),
    text: card.text ?? undefined,
    legalities: card.legalities,
  };
}

export async function resolveLorcanaCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<CardSuggestion | null> {
  const card = await fetchLorcanaCardById(cardId, signal);
  if (!card?.name) return null;
  return lorcanaCardToSuggestion(card);
}

async function searchLorcana(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const results = await searchLorcanaCardsLocally(
    query,
    { type: filters.kind, color: filters.color, exact: filters.exact },
    signal,
  );

  if (!results?.length) return [];

  const suggestions = results.map(lorcanaCardToSuggestion);

  // Si no es búsqueda exacta, agrupamos por nombre para no saturar con reprints
  if (!filters.exact) {
    const byName = new Map<string, CardSuggestion>();
    for (const s of suggestions) {
      if (!byName.has(s.name)) byName.set(s.name, s);
    }
    return Array.from(byName.values()).slice(0, 12);
  }

  return uniqueCards(suggestions).slice(0, 12);
}

// ---------------------------------------------------------------------------
// One Piece — optcgapi + scrydex
// ---------------------------------------------------------------------------

async function searchOnePiece(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const code = extractOnePieceCardCode(query);
  if (code) {
    const byCode = await fetchOnePieceCardByCode(code);
    if (byCode && (!filters.onlyImages || byCode.imageUrl)) {
      if (
        !filters.exact ||
        byCode.name.toLowerCase().includes(query.toLowerCase()) ||
        query.toUpperCase() === code
      ) {
        return [byCode];
      }
    }
  }

  const optcgCards = await searchOnePieceCardsByName(query, signal);
  if (optcgCards.length) {
    const cards = filters.onlyImages
      ? optcgCards.filter((card) => card.imageUrl)
      : optcgCards;
    if (cards.length) return uniqueCards(cards);
  }

  return searchApiTcg("one-piece", query, signal, filters);
}

// ---------------------------------------------------------------------------
// Riftbound — RiftScribe (https://riftscribe.gg/api-docs)
//
// La API no expone CORS al navegador; en dev se usa proxy de Vite y en
// producción un proxy público (codetabs). Las imágenes vienen de cdn.riftscribe.gg.
//
//   GET /api/cards/search?q=<nombre>
//   GET /api/cards/<card_id>   (ej: ogn-030-298)
// ---------------------------------------------------------------------------

type RiftScribeSearchCard = {
  card_id: string;
  name: string;
  type?: string;
  set_id?: string;
  thumbnail_url?: string;
  is_banned?: boolean;
};

type RiftScribeDetailCard = RiftScribeSearchCard & {
  faction?: string;
  region?: string;
  rarity?: string;
  rules?: string[];
  text?: string;
  effect?: string;
};

async function searchRiftbound(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  // Si parece un código de carta (ej: OGN-030, ogn-030-298) buscar por ID directamente
  const isCardCode = /^[a-z]{2,4}-\d{1,3}[a-z]?(-\d+)?$/i.test(query.trim());

  if (isCardCode) {
    const card = await fetchRiftboundCardById(
      query.trim().toLowerCase(),
      signal,
    ).catch(() => null);
    if (card) return [card];
  }

  const apiPath = `/api/cards/search?q=${encodeURIComponent(query)}${filters.kind ? `&types=${encodeURIComponent(filters.kind)}` : ""}`;
  const rows = await fetchRiftscribe<RiftScribeSearchCard[]>(apiPath, signal);
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const cards = rows
    .filter((card) => card.name)
    .filter(
      (card) =>
        !filters.exact || card.name.toLowerCase() === query.toLowerCase(),
    )
    .map(riftScribeCardToSuggestion);

  const filtered = filters.kind
    ? cards.filter((card) =>
        card.kind?.toLowerCase().includes(filters.kind!.toLowerCase()),
      )
    : cards;

  return uniqueCards(filtered).slice(0, 12);
}

async function fetchRiftboundCardById(
  cardId: string,
  signal?: AbortSignal,
): Promise<CardSuggestion | null> {
  const apiPath = `/api/cards/${encodeURIComponent(cardId)}`;
  const card = await fetchRiftscribe<RiftScribeDetailCard>(apiPath, signal);
  if (!card?.name) return null;
  return riftScribeCardToSuggestion(card);
}

function riftScribeCardToSuggestion(
  card: RiftScribeSearchCard | RiftScribeDetailCard,
): CardSuggestion {
  const detail = card as RiftScribeDetailCard;
  return {
    id: `riftbound:${card.card_id}`,
    name: card.name,
    subtitle: [card.set_id, detail.rarity].filter(Boolean).join(" - "),
    imageUrl: displayImageUrl(card.thumbnail_url),
    artUrl: displayImageUrl(card.thumbnail_url),
    kind: [card.type, detail.faction, detail.region]
      .filter(Boolean)
      .join(" - "),
    text: Array.isArray(detail.rules)
      ? detail.rules.join("\n")
      : (detail.text ?? detail.effect),
  };
}

// ---------------------------------------------------------------------------
// API TCG — fallback genérico (no usado para Riftbound)
// ---------------------------------------------------------------------------

async function searchApiTcg(
  game: TournamentTCG,
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const gameSlug = getApiTcgGameSlug(game);
  if (!gameSlug) return [];

  const url = new URL(`https://apitcg.com/api/${gameSlug}/cards`);
  url.searchParams.set("name", query);
  url.searchParams.set("limit", filters.exact ? "12" : "20");

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];

  type ApiTcgCard = {
    id?: string | number;
    name?: string;
    title?: string;
    images?: { small?: string; large?: string; full?: string };
    image?: string;
    imageUrl?: string;
    type?: string;
    cardType?: string;
    supertype?: string;
    color?: string | string[];
    colors?: string[];
    types?: string[];
    family?: string;
    ability?: string;
    text?: string;
    effect?: string;
    set?: { name?: string };
    setName?: string;
  };

  const payload = (await response.json()) as
    | { data?: ApiTcgCard[] }
    | ApiTcgCard[];
  const rows = Array.isArray(payload) ? payload : (payload.data ?? []);

  return filterByText(
    rows
      .map((card) => {
        const name = card.name ?? card.title ?? "";
        const rawImage =
          card.images?.large ??
          card.images?.full ??
          card.images?.small ??
          card.imageUrl ??
          card.image;
        const kind = [
          card.supertype,
          card.type,
          card.cardType,
          Array.isArray(card.color) ? card.color.join(", ") : card.color,
          card.colors?.join(", "),
          card.types?.join(", "),
          card.family,
        ]
          .filter(Boolean)
          .join(" - ");
        return {
          id: `${game}:${String(card.id ?? name)}`,
          name,
          subtitle: card.set?.name ?? card.setName,
          imageUrl: displayImageUrl(rawImage),
          artUrl: displayImageUrl(rawImage),
          kind,
          text: card.text ?? card.effect ?? card.ability,
        };
      })
      .filter((card) => card.name),
    filters.text,
  )
    .filter(
      (card) =>
        !filters.exact || card.name.toLowerCase() === query.toLowerCase(),
    )
    .slice(0, 12);
}

function getApiTcgGameSlug(game: TournamentTCG) {
  if (game === "one-piece") return "one-piece";
  if (game === "pokemon") return "pokemon";
  if (game === "magic") return "magic";
  return "";
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function filterByText(cards: CardSuggestion[], text?: string) {
  const needle = text?.trim().toLowerCase();
  if (!needle) return cards;
  return cards.filter((card) => card.text?.toLowerCase().includes(needle));
}

function filterYugiohCards(
  cards: CardSuggestion[],
  filters: CardSearchFilters,
) {
  return cards.filter((card) => {
    const text = `${card.subtitle ?? ""} ${card.kind ?? ""}`.toLowerCase();
    if (filters.kind && !text.includes(filters.kind)) return false;
    if (filters.attribute && !text.includes(filters.attribute)) return false;
    if (filters.cardType && !text.includes(filters.cardType)) return false;
    return true;
  });
}

function uniqueCards(cards: CardSuggestion[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeScryfallQuery(query: string) {
  return query.replace(/"/g, '\\"');
}

function escapePokemonQuery(query: string) {
  return query.replace(/[\\"]/g, "");
}
