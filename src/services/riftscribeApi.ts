// Cliente de busqueda para Riftbound/RiftScribe. Cambia aqui proxy, endpoint
// o adaptacion de cartas al formato comun del deck builder.
const RIFTSCRIBE_ORIGIN = "https://riftscribe.gg";
const CACHE_TTL_MS = 10 * 60 * 1000;

const responseCache = new Map<string, { expires: number; data: unknown }>();

/** Ruta de API pública, p. ej. `/api/cards/search?q=vex` */
function riftscribeRequestUrl(apiPath: string) {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const target = `${RIFTSCRIBE_ORIGIN}${path}`;

  if (import.meta.env.DEV) {
    return `/api/riftscribe${path}`;
  }

  return `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}`;
}

export async function fetchRiftscribe<T>(
  apiPath: string,
  signal?: AbortSignal,
): Promise<T | null> {
  const requestUrl = riftscribeRequestUrl(apiPath);
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
