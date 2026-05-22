// Carga y convierte imágenes externas para html2canvas (evita CORS y canvas contaminado).

const PROXY_HOST = "images.weserv.nl";

// Hosts/CDN que cargan bien en <img> sin proxy (más rápido que images.weserv.nl).
const DISPLAY_DIRECT_HOSTS = [
  "cdn.riftscribe.gg",
  "images.ygoprodeck.com",
  "cards.scryfall.io",
  "images.pokemontcg.io",
  "optcgapi.com",
  "lorcast.org",
  "lorcast.io",
];

const displayUrlCache = new Map<string, string | undefined>();

function hostUsesDirectDisplay(host: string) {
  return DISPLAY_DIRECT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

function unwrapWeservUrl(url: string) {
  if (!url.includes(PROXY_HOST)) return undefined;
  try {
    const raw = new URL(url).searchParams.get("url");
    if (!raw) return undefined;
    if (raw.startsWith("ssl:")) return `https://${raw.slice(4)}`;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  } catch {
    return undefined;
  }
}

/** URL para mostrar en <img> del builder (prioriza CDN directo cuando funciona). */
export function displayImageUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.startsWith("/")) return url;

  const cached = displayUrlCache.get(url);
  if (cached !== undefined) return cached;

  let resolved = url;
  const unwrapped = unwrapWeservUrl(url);
  if (unwrapped) resolved = unwrapped;

  try {
    const host = new URL(resolved).host;
    if (hostUsesDirectDisplay(host)) {
      displayUrlCache.set(url, resolved);
      return resolved;
    }
  } catch {
    displayUrlCache.set(url, undefined);
    return undefined;
  }

  const proxied = proxiedImageUrl(resolved);
  displayUrlCache.set(url, proxied);
  return proxied;
}

/** URL con proxy CORS para exportar PNG (html2canvas). */
export function proxiedImageUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.includes(PROXY_HOST)) return url;

  const unwrapped = unwrapWeservUrl(url);
  if (unwrapped) url = unwrapped;

  try {
    const parsed = new URL(url);

    if (parsed.protocol === "https:") {
      return `https://${PROXY_HOST}/?url=ssl:${parsed.host}${parsed.pathname}${parsed.search}&output=webp`;
    }
    const cleanUrl = url.replace(/^https?:\/\//, "");
    return `https://${PROXY_HOST}/?url=${encodeURIComponent(cleanUrl)}&output=webp`;
  } catch {
    return undefined;
  }
}

function corsProxyUrl(url: string) {
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

export function getExportImageCandidates(url: string) {
  if (!url || url.startsWith("data:")) return [url];
  if (!/^https?:\/\//i.test(url)) return [url];

  const proxied = proxiedImageUrl(url);
  const corsProxy = corsProxyUrl(url);

  // RiftScribe CDN y similares: proxy primero (sin CORS en origen)
  if (/cdn\.riftscribe\.gg/i.test(url)) {
    return [...new Set([proxied, corsProxy, url].filter(Boolean) as string[])];
  }

  if (/images\.ygoprodeck\.com|optcgapi\.com/i.test(url)) {
    return [...new Set([url, proxied, corsProxy].filter(Boolean) as string[])];
  }

  return [...new Set([proxied, corsProxy, url].filter(Boolean) as string[])];
}

export function isEmbeddableImageUrl(url?: string) {
  return Boolean(url?.startsWith("data:") || url?.includes(PROXY_HOST));
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchImageBlob(candidate: string) {
  const response = await fetch(candidate, {
    mode: "cors",
    cache: "force-cache",
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (blob.size > 0 && blob.type.startsWith("image/")) return blob;
  return null;
}

async function loadImageViaCanvas(src: string) {
  return await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas no disponible"));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    image.src = src;
  });
}

export async function fetchImageAsDataUrl(url: string) {
  if (!url) throw new Error("URL vacia");
  if (url.startsWith("data:")) return url;

  for (const candidate of getExportImageCandidates(url)) {
    try {
      const blob = await fetchImageBlob(candidate);
      if (blob) return await blobToDataUrl(blob);
    } catch {
      // Siguiente candidato.
    }
  }

  for (const candidate of getExportImageCandidates(url)) {
    try {
      return await loadImageViaCanvas(candidate);
    } catch {
      // Siguiente candidato.
    }
  }

  throw new Error("No se pudo cargar la imagen");
}

export async function prepareImagesInElement(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (image) => {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:") || src.startsWith("/")) return;

      try {
        const dataUrl = await fetchImageAsDataUrl(src);
        image.src = dataUrl;
        image.removeAttribute("crossorigin");
      } catch {
        // Mantiene la URL original; html2canvas puede omitirla.
      }
    }),
  );
}

export async function waitForImages(root: HTMLElement, timeoutMs = 4000) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) {
        return image.decode?.().catch(() => undefined) ?? Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, timeoutMs);

        const done = () => {
          window.clearTimeout(timeout);
          void (
            image.decode?.().catch(() => undefined) ?? Promise.resolve()
          ).finally(resolve);
        };

        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
      });
    }),
  );
}
