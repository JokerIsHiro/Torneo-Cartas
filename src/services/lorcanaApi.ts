const LORCAST_API = "https://api.lorcast.com/v0";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LORCAST_MIN_REQUEST_INTERVAL_MS = 75;

const responseCache = new Map<string, { expires: number; data: unknown }>();

let nextLorcastRequestAt = 0;

export type LorcanaCard = {
  id: string;
  name: string;
  version?: string | null;
  layout?: string;
  released_at?: string;
  image_uris?: {
    digital?: {
      small?: string;
      normal?: string;
      large?: string;
      full?: string;
    };
    small?: string;
    normal?: string;
    large?: string;
    full?: string;
  };
  cost?: number | null;
  inkwell?: boolean;
  ink?: string | null;
  type?: string[];
  classifications?: string[] | null;
  text?: string | null;
  strength?: number | null;
  willpower?: number | null;
  lore?: number | null;
  rarity?: string;
  collector_number?: string;
  lang?: string;
  legalities?: Record<string, string>;
  set?: {
    id?: string;
    code?: string;
    name?: string;
  };
};

type LorcastSearchResponse = {
  results?: LorcanaCard[];
};

const LEGACY_SET_CODE_TO_LORCAST: Record<string, string> = {
  TFC: "1",
  FIRST: "1",
  ROF: "2",
  ROTF: "2",
  FLOODBORN: "2",
  ITI: "3",
  INK: "3",
  URR: "4",
  URSULA: "4",
  SSK: "5",
  SS: "5",
  SHM: "5",
  AZU: "6",
  AS: "6",
  ARC: "7",
  AI: "7",
  ROJ: "8",
  JAF: "8",
  FBL: "9",
  FAB: "9",
  WIW: "10",
  WHI: "10",
  WWW: "10",
};

export function getLorcanaCardDisplayName(card: LorcanaCard) {
  return [card.name, card.version].filter(Boolean).join(" - ");
}

export function getLorcanaCardImageUrl(card: LorcanaCard) {
  return (
    card.image_uris?.digital?.large ??
    card.image_uris?.digital?.normal ??
    card.image_uris?.digital?.full ??
    card.image_uris?.digital?.small ??
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.image_uris?.full ??
    card.image_uris?.small
  );
}

export function getLorcanaCardStableId(card: LorcanaCard) {
  if (card.set?.code && card.collector_number) {
    return `${card.set.code}-${card.collector_number}`;
  }
  return card.id;
}

async function waitForLorcastTurn() {
  const now = Date.now();
  const waitMs = Math.max(0, nextLorcastRequestAt - now);
  nextLorcastRequestAt = now + waitMs + LORCAST_MIN_REQUEST_INTERVAL_MS;

  if (waitMs > 0) {
    await new Promise(resolve => globalThis.setTimeout(resolve, waitMs));
  }
}

async function fetchLorcast<T>(
  apiPath: string,
  signal?: AbortSignal,
): Promise<T | null> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const requestUrl = `${LORCAST_API}${path}`;
  const cached = responseCache.get(requestUrl);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  await waitForLorcastTurn();

  const response = await fetch(requestUrl, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as T;
  responseCache.set(requestUrl, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function fetchLorcanaCardById(
  cardId: string,
  signal?: AbortSignal,
): Promise<LorcanaCard | null> {
  const rawId = normalizeLorcanaLookupId(cardId);

  if (rawId.startsWith("name:")) {
    const name = rawId.replace(/^name:/i, "").trim();
    const results = await searchLorcanaCardsLocally(name, { exact: true }, signal);
    return results[0] ?? null;
  }

  const parsedCode = parseLorcanaSetNumber(rawId);
  if (parsedCode) {
    const card = await fetchLorcast<LorcanaCard>(
      `/cards/${encodeURIComponent(parsedCode.set)}/${encodeURIComponent(parsedCode.number)}`,
      signal,
    );
    if (card?.id) return card;
  }

  const results = await searchLorcanaCardsLocally(rawId, { exact: true }, signal);
  return results.find(card => card.id === rawId) ?? results[0] ?? null;
}

export async function searchLorcanaCardsLocally(
  query: string,
  filters: { type?: string; color?: string; exact?: boolean } = {},
  signal?: AbortSignal,
): Promise<LorcanaCard[]> {
  const q = normalizeLorcanaSearchQuery(query);
  if (!q) return [];

  const unique = filters.exact ? "prints" : "cards";
  const results = await fetchLorcastSearchResults(
    buildLorcastSearchQueries(q, filters),
    unique,
    !filters.exact,
    signal,
  );

  const filtered = results.filter(card => {
    if (filters.exact) {
      const normalizedQuery = normalizeSearchText(q);
      const normalizedFullName = normalizeSearchText(getLorcanaCardDisplayName(card));
      const normalizedName = normalizeSearchText(card.name);
      const matchesName =
        normalizedFullName === normalizedQuery ||
        normalizedName === normalizedQuery ||
        normalizeSearchText(getLorcanaCardStableId(card)) === normalizedQuery;
      if (!matchesName) return false;
    }

    if (
      filters.type &&
      !card.type?.some(type => type.toLowerCase() === filters.type?.toLowerCase())
    ) {
      return false;
    }

    if (filters.color && card.ink?.toLowerCase() !== filters.color.toLowerCase()) {
      return false;
    }

    return true;
  });

  if (!filters.exact || filtered.length > 0) return sortLorcanaMatches(filtered, q);

  // Los listados exportados no son consistentes: a veces traen solo nombre,
  // a veces "Nombre - Versión", y a veces códigos de otra base de datos.
  // Si Lorcast encontró candidatos pero el filtro exacto los descartó, elegimos
  // el mejor candidato con imagen antes de dejar la carta sin resolver.
  const relaxed = results.filter(card => {
    if (
      filters.type &&
      !card.type?.some(type => type.toLowerCase() === filters.type?.toLowerCase())
    ) {
      return false;
    }
    if (filters.color && card.ink?.toLowerCase() !== filters.color.toLowerCase()) {
      return false;
    }
    return true;
  });

  return sortLorcanaMatches(relaxed, q);
}

async function fetchLorcastSearchResults(
  searches: string[],
  unique: "cards" | "prints",
  stopOnFirstMatch: boolean,
  signal?: AbortSignal,
) {
  const byId = new Map<string, LorcanaCard>();

  for (const search of searches) {
    const payload = await fetchLorcast<LorcastSearchResponse>(
      `/cards/search?q=${encodeLorcastSearchParam(search)}&unique=${unique}`,
      signal,
    );

    for (const card of payload?.results ?? []) {
      byId.set(card.id, card);
    }

    if (stopOnFirstMatch && byId.size > 0) break;
  }

  return [...byId.values()];
}

function buildLorcastSearchQueries(
  query: string,
  filters: { type?: string; color?: string; exact?: boolean },
) {
  const baseQueries = filters.exact
    ? buildExactLorcastNameQueries(query)
    : [query];

  return baseQueries.map(baseQuery => {
    const terms = [baseQuery];

    if (filters.type) terms.push(`t:${quoteLorcastValue(filters.type)}`);
    if (filters.color) terms.push(`i:${quoteLorcastValue(filters.color)}`);

    return terms.join(" ");
  });
}

function buildExactLorcastNameQueries(query: string) {
  const split = splitLorcanaNameAndVersion(query);
  const queries = [
    quoteLorcastValue(query),
    `name:${quoteLorcastValue(query)}`,
    query,
  ];

  if (split) {
    queries.unshift(
      `name:${quoteLorcastValue(split.name)} version:${quoteLorcastValue(split.version)}`,
      `n:${quoteLorcastValue(split.name)} v:${quoteLorcastValue(split.version)}`,
    );
  }

  return [...new Set(queries)];
}

function quoteLorcastValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function encodeLorcastSearchParam(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function normalizeLorcanaLookupId(value: string) {
  let rawId = value.replace(/^lorcana:/i, "").trim();

  if (/^import:/i.test(rawId)) {
    const parts = rawId.split(":").filter(Boolean);
    rawId = parts[parts.length - 1] ?? rawId;
  }

  return rawId.trim();
}

function normalizeLorcanaSearchQuery(value: string) {
  return value
    .trim()
    .replace(/\s+\[[^\]]+\]\s*$/g, "")
    .replace(/\s+\((?:[A-Z0-9]{1,6}|EN|ES|FR|DE|IT)\)\s*$/i, "")
    .replace(/\s+\b(?:[A-Z]{1,5}|D100|\d{1,2})[\s_/#-]+0*\d{1,3}[a-z]?\b\s*$/i, "")
    .replace(/\s+\b0*\d{1,3}[a-z]?\s*\/\s*\d{1,3}\b\s*$/i, "")
    .replace(/\s+#\s*0*\d{1,3}[a-z]?\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLorcanaNameAndVersion(value: string) {
  const match = value.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!match) return null;

  return {
    name: match[1].trim(),
    version: match[2].trim(),
  };
}

function sortLorcanaMatches(cards: LorcanaCard[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  return [...cards].sort((a, b) => {
    const aScore = scoreLorcanaMatch(a, normalizedQuery);
    const bScore = scoreLorcanaMatch(b, normalizedQuery);
    return bScore - aScore;
  });
}

function scoreLorcanaMatch(card: LorcanaCard, normalizedQuery: string) {
  const fullName = normalizeSearchText(getLorcanaCardDisplayName(card));
  const name = normalizeSearchText(card.name);
  const stableId = normalizeSearchText(getLorcanaCardStableId(card));
  const hasImage = getLorcanaCardImageUrl(card) ? 10 : 0;

  if (stableId === normalizedQuery) return 100 + hasImage;
  if (fullName === normalizedQuery) return 90 + hasImage;
  if (name === normalizedQuery) return 80 + hasImage;
  if (fullName.startsWith(normalizedQuery)) return 60 + hasImage;
  if (normalizedQuery.startsWith(fullName)) return 50 + hasImage;
  if (fullName.includes(normalizedQuery)) return 40 + hasImage;
  return hasImage;
}

function parseLorcanaSetNumber(value: string) {
  const clean = value.trim();
  const match = clean.match(/^([a-z0-9]+)[\s_/#-]+(?:no\.?\s*)?(0*\d{1,3}[a-z]?)(?:[\s_/#-]+[a-z]{2})?$/i);
  if (!match) return null;

  const rawSet = match[1].toUpperCase();
  const normalizedNumericSet = rawSet.replace(/^0+(\d)/, "$1");
  const set = LEGACY_SET_CODE_TO_LORCAST[rawSet] ?? normalizedNumericSet;
  const number = match[2].replace(/^0+(\d)/, "$1").toLowerCase();

  return { set, number };
}
