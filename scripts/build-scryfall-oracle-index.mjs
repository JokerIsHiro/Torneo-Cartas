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
  const oracleFile = bulkPayload.data?.find((item) => item.type === "oracle_cards");
  if (!oracleFile?.download_uri) {
    throw new Error("No se encontro el archivo oracle_cards de Scryfall.");
  }

  console.log(`Descargando ${oracleFile.name}...`);
  const cardsResponse = await fetch(oracleFile.download_uri);
  if (!cardsResponse.ok) {
    throw new Error(`No se pudo descargar oracle_cards: ${cardsResponse.status}`);
  }

  const cards = await cardsResponse.json();
  const compactCards = cards
    .map((card) => {
      const imageUrl =
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
          .find(Boolean);
      const artUrl =
        card.image_uris?.art_crop ??
        card.card_faces?.flatMap((face) => [face.image_uris?.art_crop]).find(Boolean);

      return {
        id: card.id,
        name: card.name,
        subtitle: card.set_name,
        imageUrl,
        artUrl,
        kind: card.type_line,
        legalities: card.legalities,
      };
    })
    .filter((card) => card.id && card.name && card.imageUrl);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({
      source: "scryfall-oracle_cards",
      updatedAt: oracleFile.updated_at,
      generatedAt: new Date().toISOString(),
      cards: compactCards,
    }),
  );

  const mb = (Buffer.byteLength(JSON.stringify(compactCards)) / 1024 / 1024).toFixed(1);
  console.log(`Indice generado: ${OUTPUT_PATH}`);
  console.log(`${compactCards.length} cartas, aprox. ${mb} MB antes de gzip.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
