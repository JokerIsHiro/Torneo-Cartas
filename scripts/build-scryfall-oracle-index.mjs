import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BULK_DATA_URL = "https://api.scryfall.com/bulk-data";
const OUTPUT_PATH = path.resolve("public", "scryfall-oracle-index.json");

async function main() {
  const bulkResponse = await fetch(BULK_DATA_URL, {
    headers: { Accept: "application/json" },
  });
  if (!bulkResponse.ok) {
    throw new Error(`No se pudo leer bulk-data: ${bulkResponse.status}`);
  }

  const bulkPayload = await bulkResponse.json();
  const defaultCardsFile = bulkPayload.data?.find((item) => item.type === "default_cards");
  if (!defaultCardsFile?.download_uri) {
    throw new Error("No se encontro el archivo default_cards de Scryfall.");
  }

  console.log(`Descargando ${defaultCardsFile.name}...`);
  const cardsResponse = await fetch(defaultCardsFile.download_uri);
  if (!cardsResponse.ok) {
    throw new Error(`No se pudo descargar default_cards: ${cardsResponse.status}`);
  }

  const cards = await cardsResponse.json();
  const bestCards = new Map();

  for (const card of cards) {
    if (!card.id || !card.name || !getImageUrl(card)) continue;
    if (card.lang && card.lang !== "en") continue;
    if (card.digital) continue;
    if (card.layout === "art_series" || card.layout === "token" || card.layout === "emblem") continue;

    const key = card.oracle_id ?? normalizeName(card.name);
    const current = bestCards.get(key);
    if (!current || scoreNormalPrint(card) > scoreNormalPrint(current)) {
      bestCards.set(key, card);
    }
  }

  const compactCards = [...bestCards.values()].map((card) => ({
    id: card.id,
    name: card.name,
    subtitle: card.set_name,
    imageUrl: getImageUrl(card),
    artUrl: getArtUrl(card),
    kind: card.type_line,
    legalities: card.legalities,
  }));

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({
      source: "scryfall-oracle_cards",
      updatedAt: defaultCardsFile.updated_at,
      generatedAt: new Date().toISOString(),
      cards: compactCards,
    }),
  );

  const mb = (Buffer.byteLength(JSON.stringify(compactCards)) / 1024 / 1024).toFixed(1);
  console.log(`Indice generado: ${OUTPUT_PATH}`);
  console.log(`${compactCards.length} cartas, aprox. ${mb} MB antes de gzip.`);
}

function scoreNormalPrint(card) {
  const frameEffects = new Set(card.frame_effects ?? []);
  let score = 0;

  if (card.lang === "en") score += 100;
  if (!card.promo) score += 80;
  if (!card.full_art) score += 70;
  if (!card.textless) score += 45;
  if (!card.oversized) score += 45;
  if (!card.variation) score += 45;
  if (!frameEffects.has("showcase")) score += 75;
  if (!frameEffects.has("extendedart")) score += 75;
  if (!frameEffects.has("borderless")) score += 65;
  if (!frameEffects.has("inverted")) score += 40;
  if (!frameEffects.has("etched")) score += 40;
  if (card.booster) score += 30;
  if (card.highres_image) score += 10;
  if (card.image_status === "highres_scan") score += 10;

  if (["expansion", "core", "commander", "masters", "draft_innovation"].includes(card.set_type)) {
    score += 12;
  }

  return score;
}

function getImageUrl(card) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.large ??
    card.image_uris?.small ??
    card.image_uris?.png ??
    card.card_faces
      ?.flatMap((face) => [
        face.image_uris?.normal,
        face.image_uris?.large,
        face.image_uris?.small,
        face.image_uris?.png,
      ])
      .find(Boolean)
  );
}

function getArtUrl(card) {
  return (
    card.image_uris?.art_crop ??
    card.card_faces?.flatMap((face) => [face.image_uris?.art_crop]).find(Boolean)
  );
}

function normalizeName(value) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
