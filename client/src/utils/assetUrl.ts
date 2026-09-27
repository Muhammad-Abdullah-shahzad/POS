/**
 * Where an <img> loads a stored image from.
 *
 * Images are kept on Google Drive and the database holds the Drive link, but
 * Google rate-limits browsers loading those links directly (429 Too Many
 * Requests). Drive images are therefore loaded through the server, which
 * fetches them with its own Drive access and caches them.
 *
 * Older images are server paths like /uploads/logos/…. In the browser that
 * path works as is; the desktop app loads its pages from disk, so the path is
 * joined to the server address it was built with.
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const SERVER_ORIGIN = API_BASE.replace(/\/api$/, '');

/** The file id in any Google Drive or googleusercontent link, or null. */
function driveFileId(url: string): string | null {
  if (!/^(https?:\/\/)?([\w-]+\.)*(google|googleusercontent)\.com\//i.test(url)) return null;
  return url.match(/[?&]id=([\w-]+)/)?.[1] ?? url.match(/\/(?:file\/)?d\/([\w-]+)/)?.[1] ?? null;
}

export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const driveId = driveFileId(url);
  if (driveId) return `${API_BASE}/images/drive/${driveId}`;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${SERVER_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

/**
 * Where to load a product photo from. New photos are Google Drive links;
 * older ones may be server paths, or bare file names from the first version.
 */
export function productImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  if (/^(https?:|data:|blob:)/i.test(image) || image.startsWith('/')) return assetUrl(image);
  return assetUrl(`/uploads/products/${image}`);
}
