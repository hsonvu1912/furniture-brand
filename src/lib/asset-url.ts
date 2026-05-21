// =============================================================================
// assetUrl — prefix basePath cho asset path (raw <img>, fetch URL, etc).
// Next.js tự prefix basePath cho <Link> và <Image>, KHÔNG cho raw <img src>
// hoặc fetch. Phải dùng helper này.
//
// Set qua next.config.ts: env.NEXT_PUBLIC_BASE_PATH = basePath khi GITHUB_PAGES.
// Local dev không có biến → trả raw path.
// =============================================================================
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix basePath cho asset path. URL absolute (http://) trả về nguyên. */
export function assetUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path)) return path; // absolute URL, không prefix
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
