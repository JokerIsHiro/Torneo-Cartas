// Fallback local para Magic usando un indice compacto generado desde Scryfall Bulk Data.
// El archivo se sirve desde /scryfall-oracle-index.json cuando se genera con el script.
import { displayImageUrl } from "../utils/imageExport";
import type { CardSuggestion } from "./cardSearch";

type BulkCard = {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
  artUrl?: string;
  kind?: string;
  legalities?: Record<string, string>;
};

type BulkIndex = {
  cards: BulkCard[];
};

type BulkLookup = {
  cardId: string;
  name: string;
};

let bulkIndexPromise: Promise<Map<string, CardSuggestion>> | null = null;

export async function resolveMagicCardsFromBulkIndex(
  lookups: BulkLookup[],
): Promise<Map<string, CardSuggestion>> {
  const index = await getBulkIndex();
  const matches = new Map<string, CardSuggestion>();

  for (const lookup of lookups) {
    const candidates = getLookupNames(lookup);
    const match = candidates
      .map(candidate => index.get(normalizeMagicName(candidate)))
      .find(Boolean);
    if (match) matches.set(lookup.cardId, match);
  }

  return matches;
}

async function getBulkIndex() {
  bulkIndexPromise ??= loadBulkIndex();
  return bulkIndexPromise;
}

async function loadBulkIndex() {
  try {
    const response = await fetch("/scryfall-oracle-index.json", {
      cache: "force-cache",
    });
    if (!response.ok) return new Map<string, CardSuggestion>();

    const payload = (await response.json()) as BulkIndex;
    const index = new Map<string, CardSuggestion>();

    for (const card of payload.cards ?? []) {
      const suggestion: CardSuggestion = {
        id: `magic:${card.id}`,
        name: card.name,
        subtitle: card.subtitle,
        imageUrl: displayImageUrl(card.imageUrl) ?? card.imageUrl,
        artUrl: displayImageUrl(card.artUrl) ?? card.artUrl,
        kind: card.kind,
        legalities: card.legalities,
      };

      for (const name of getCardNames(card.name)) {
        index.set(normalizeMagicName(name), suggestion);
      }
    }

    return index;
  } catch {
    return new Map<string, CardSuggestion>();
  }
}

function getLookupNames(lookup: BulkLookup) {
  return [
    lookup.name,
    lookup.cardId.replace(/^magic:/i, "").replace(/^import:/i, "").split(":").pop() ?? "",
    slugToName(lookup.name),
    slugToName(lookup.cardId),
  ].filter(Boolean);
}

function getCardNames(name: string) {
  const frontFace = name.split("//")[0]?.trim();
  return [name, frontFace, nameToSlug(name)].filter((value, index, values): value is string =>
    Boolean(value) && values.indexOf(value) === index
  );
}

function slugToName(value: string) {
  const clean = value
    .replace(/^magic:/i, "")
    .replace(/^import:/i, "")
    .split(":")
    .pop()
    ?.trim() ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(clean)) return clean;
  if (clean === "harmonized-trio-brainstorm") return "Harmonized Trio // Brainstorm";
  return clean.replace(/-/g, " ");
}

function nameToSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\/\/\s*/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeMagicName(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s*\/\/\s*/g, " // ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
