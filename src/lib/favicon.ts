/**
 * Favicon 解析工具
 *
 * 按优先级尝试以下策略:
 * 1. Feed XML 内嵌的图片 (RSS <image> / Atom <logo>/<icon>)
 * 2. 站点根目录 /favicon.ico (验证 content-type 为 image/*)
 * 3. Google Favicon 服务 (https://www.google.com/s2/favicons?domain=...&sz=64)
 */

const GOOGLE_FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/**
 * 解析 feed 图标 URL
 * @param siteUrl 站点主页 URL, 用于派生 /favicon.ico 和 Google 服务
 * @param xmlImage Feed XML 中解析到的图片 URL (可选)
 */
export async function resolveFavicon(
  siteUrl: string,
  xmlImage?: string,
): Promise<string> {
  // 策略 1: XML 自带
  if (xmlImage && xmlImage.trim()) {
    return normalizeUrl(xmlImage.trim(), siteUrl);
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
        return icoUrl;
      }
    }
  } catch {
    // ignore and fallback
  }

  // 策略 3: Google favicon 服务
  if (domain) {
    return GOOGLE_FAVICON(domain);
  }

  return '';
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
