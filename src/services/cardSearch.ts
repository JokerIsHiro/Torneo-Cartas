import type { TournamentTCG } from "../types/tournament";
import { displayImageUrl } from "../utils/imageExport";
import { extractOnePieceCardCode } from "../utils/onePieceCardCode";
import { fetchLorcast, fetchLorcastCardById, getLorcastCardImageUrl, type LorcastCard } from "./lorcastApi";
import { fetchOnePieceCardByCode, searchOnePieceCardsByName } from "./optcgApi";
import { fetchRiftscribe } from "./riftscribeApi";

export interface CardSuggestion {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
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
const searchResultCache = new Map<
  string,
  { expires: number; cards: CardSuggestion[] }
>();

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
    const exactResponse = await fetch(exactUrl, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (exactResponse.ok) {
      const card = (await exactResponse.json()) as ScryfallCard;
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

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { data?: ScryfallCard[] };
  return uniqueCards((payload.data ?? []).map(scryfallCardToSuggestion)).slice(
    0,
    12,
  );
}

type ScryfallCard = {
  id: string;
  name: string;
  set_name?: string;
  type_line?: string;
  oracle_text?: string;
  legalities?: Record<string, string>;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{
    oracle_text?: string;
    image_uris?: { small?: string; normal?: string };
  }>;
};

function scryfallCardToSuggestion(card: ScryfallCard): CardSuggestion {
  return {
    id: `magic:${card.id}`,
    name: card.name,
    subtitle: card.set_name,
    imageUrl: displayImageUrl(
      card.image_uris?.normal ??
        card.image_uris?.small ??
        card.card_faces?.[0]?.image_uris?.normal ??
        card.card_faces?.[0]?.image_uris?.small,
    ),
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
  url.searchParams.set("pageSize", filters.exact ? "250" : "40");
  url.searchParams.set("orderBy", "-set.releaseDate,name");
  url.searchParams.set(
    "select",
    "id,name,set,images,rarity,tcgplayer,rules,attacks,abilities",
  );

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { data?: PokemonCard[] };
  return filterByText(
    sortPokemonPrintings(payload.data ?? []).map((card) => ({
      id: `pokemon:${card.id}`,
      name: card.name,
      subtitle: [card.set?.name, card.rarity].filter(Boolean).join(" - "),
      imageUrl: displayImageUrl(card.images?.large ?? card.images?.small),
      kind: card.types?.join(", ") ?? filters.kind,
      text: [
        ...(card.rules ?? []),
        ...(card.attacks ?? []).map((a) => a.text ?? ""),
        ...(card.abilities ?? []).map((a) => a.text ?? ""),
      ]
        .filter(Boolean)
        .join("\n"),
    })),
    filters.text,
  ).slice(0, 12);
}

type PokemonCard = {
  id: string;
  name: string;
  set?: { name?: string; releaseDate?: string };
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

  const payload = (await response.json()) as {
    data?: Array<{
      id: number;
      name: string;
      type?: string;
      race?: string;
      attribute?: string;
      desc?: string;
      card_images?: Array<{ image_url?: string; image_url_small?: string }>;
    }>;
  };

  const cards = filterByText(
    uniqueCards(
      (payload.data ?? []).map((card) => ({
        id: `yugioh:${card.id}`,
        name: card.name,
        subtitle: card.type,
        imageUrl: displayImageUrl(
          card.card_images?.[0]?.image_url ??
            card.card_images?.[0]?.image_url_small,
        ),
        kind: [card.type, card.race, card.attribute]
          .filter(Boolean)
          .join(" · "),
        text: card.desc,
      })),
    ),
    filters.text,
  );

  return filterYugiohCards(cards, filters).slice(0, 12);
}

// ---------------------------------------------------------------------------
// Lorcana — Lorcast (api.lorcast.com, imágenes en cards.lorcast.io AVIF)
// ---------------------------------------------------------------------------

function lorcanaCardToSuggestion(card: LorcastCard): CardSuggestion {
  return {
    id: `lorcana:${card.id}`,
    name: card.version ? `${card.name} - ${card.version}` : card.name,
    subtitle: card.set?.name,
    imageUrl: displayImageUrl(getLorcastCardImageUrl(card)),
    kind: [card.type?.join(", "), card.ink].filter(Boolean).join(" - "),
    text: card.fullText ?? card.text,
  };
}

export async function resolveLorcanaCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<CardSuggestion | null> {
  const card = await fetchLorcastCardById(cardId, signal);
  if (!card?.name) return null;
  return lorcanaCardToSuggestion(card);
}

async function searchLorcana(
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {},
): Promise<CardSuggestion[]> {
  const typeQuery = filters.kind ? ` type:${filters.kind}` : "";
  const colorQuery = filters.color ? ` ink:${filters.color}` : "";
  const apiPath = `/cards/search?q=${encodeURIComponent(`${query}${typeQuery}${colorQuery}`)}&unique=prints`;

  const payload = await fetchLorcast<{ results?: LorcastCard[] }>(apiPath, signal);
  if (!payload?.results?.length) return [];

  return filterByText(
    uniqueCards(payload.results.map(lorcanaCardToSuggestion)),
    filters.text,
  ).slice(0, 12);
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
