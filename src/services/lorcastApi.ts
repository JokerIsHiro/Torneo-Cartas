const LORCAST_API = "https://api.lorcast.com/v0";
const CACHE_TTL_MS = 10 * 60 * 1000;

const responseCache = new Map<string, { expires: number; data: unknown }>();

export type LorcastCard = {
  id: string;
  name: string;
  version?: string;
  type?: string[];
  ink?: string;
  text?: string;
  fullText?: string;
  set?: { name?: string };
  image_uris?: {
    digital?: { small?: string; normal?: string; large?: string };
  };
};

export function getLorcastCardImageUrl(card: LorcastCard) {
  return (
    card.image_uris?.digital?.large ??
    card.image_uris?.digital?.normal ??
    card.image_uris?.digital?.small
  );
}

export async function fetchLorcast<T>(
  apiPath: string,
  signal?: AbortSignal,
): Promise<T | null> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const requestUrl = `${LORCAST_API}${path}`;
  const cached = responseCache.get(requestUrl);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  const response = await fetch(requestUrl, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as T;
  responseCache.set(requestUrl, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function fetchLorcastCardById(
  cardId: string,
  signal?: AbortSignal,
): Promise<LorcastCard | null> {
  const rawId = cardId.replace(/^lorcana:/i, "").trim();
  if (!/^crd_[a-f0-9]+$/i.test(rawId)) return null;
  return fetchLorcast<LorcastCard>(`/cards/${encodeURIComponent(rawId)}`, signal);
}
