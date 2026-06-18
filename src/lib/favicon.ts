/**
 * Favicon 解析工具
 *
 * 按优先级尝试以下策略:
 * 1. Feed XML 内嵌的图片 (RSS <image> / Atom <logo>/<icon>)
 * 2. 站点根目录 /favicon.ico (验证 content-type 为 image/*)
 * 3. Google Favicon 服务 (https://www.google.com/s2/favicons?domain=...&sz=64)
 */

const MAX_FAVICON_CACHE_BYTES = 128 * 1024;

const GOOGLE_FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/**
 * 解析并缓存 feed 图标。
 * @param siteUrl 站点主页 URL, 用于派生 /favicon.ico 和 Google 服务
 * @param xmlImage Feed XML 中解析到的图片 URL (可选)
 */
export async function resolveFavicon(
  siteUrl: string,
  xmlImage?: string,
): Promise<string> {
  // 策略 1: XML 自带
  if (xmlImage && xmlImage.trim()) {
    const imageUrl = normalizeUrl(xmlImage.trim(), siteUrl);
    return cacheFavicon(imageUrl, siteUrl);
  }

  if (!siteUrl) return '';

  let origin = '';
  let domain = '';
  try {
    const u = new URL(siteUrl);
    origin = u.origin;
    domain = u.hostname;
  } catch {
    return '';
  }

  // 策略 2: /favicon.ico
  try {
    const icoUrl = `${origin}/favicon.ico`;
    const res = await fetch(icoUrl, { method: 'GET' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.startsWith('image/') || ct.startsWith('application/octet-stream')) {
        return cacheFaviconResponse(icoUrl, res);
      }
    }
  } catch {
    // ignore and fallback
  }

  // 策略 3: Google favicon 服务
  if (domain) {
    const googleFavicon = GOOGLE_FAVICON(domain);
    return cacheFavicon(googleFavicon, siteUrl);
  }

  return '';
}

/**
 * 判断图标是否已经是本地缓存后的 data URL。
 */
export function isCachedFavicon(favicon: string): boolean {
  return /^data:image\//i.test(favicon);
}

/**
 * 下载图标并转成 data URL，失败时保留原 URL。
 */
export async function cacheFavicon(url: string, baseUrl?: string): Promise<string> {
  const normalizedUrl = normalizeUrl(url.trim(), baseUrl || '');

  if (!normalizedUrl || isCachedFavicon(normalizedUrl)) {
    return normalizedUrl;
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  try {
    const res = await fetch(normalizedUrl, { method: 'GET' });
    if (!res.ok) return normalizedUrl;

    return cacheFaviconResponse(normalizedUrl, res);
  } catch {
    return normalizedUrl;
  }
}

/**
 * 将 favicon 响应内容写入 data URL 缓存。
 */
async function cacheFaviconResponse(url: string, res: Response): Promise<string> {
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_FAVICON_CACHE_BYTES) {
    return url;
  }

  const contentType = getImageContentType(res.headers.get('content-type'), url);
  if (!contentType) {
    return url;
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FAVICON_CACHE_BYTES) {
    return url;
  }

  return arrayBufferToDataUrl(arrayBuffer, contentType);
}

/**
 * 解析图片 MIME 类型，兼容部分站点把 favicon 返回为 octet-stream 的情况。
 */
function getImageContentType(contentType: string | null, url: string): string | null {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() || '';

  if (type.startsWith('image/')) {
    return type;
  }

  if (type === 'application/octet-stream' || !type) {
    const pathname = safePathname(url);

    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.svg')) return 'image/svg+xml';
    return 'image/x-icon';
  }

  return null;
}

/**
 * 安全地提取 URL 路径。
 */
function safePathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * 将图片二进制内容转为 data URL。
 */
function arrayBufferToDataUrl(arrayBuffer: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

/**
 * 将可能的相对 URL 转为绝对 URL
 */
function normalizeUrl(url: string, base: string): string {
  try {
    return new URL(url, base || undefined).toString();
  } catch {
    return url;
  }
}
