const URL_ATTRS = new Set(['href', 'src', 'poster', 'cite', 'formaction', 'xlink:href']);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i;

/**
 * 判断 URL 属性是否可以保留，拦截 javascript/data 等危险协议。
 */
function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
  if (SAFE_DATA_IMAGE_RE.test(trimmed)) return true;

  try {
    const url = new URL(trimmed, 'https://zrss.local');
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/**
 * 清理文章 HTML，移除危险标签、事件属性和危险 URL 协议。
 */
export function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 移除 script 和 style 标签
  const dangerousTags = [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'svg',
    'math',
    'link',
    'meta',
    'base',
    'template',
  ];
  dangerousTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // 移除危险属性
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'style' ||
        name === 'srcdoc' ||
        (URL_ATTRS.has(name) && !isSafeUrl(attr.value))
      ) {
        el.removeAttribute(attr.name);
      }
    });

    if (el.tagName.toLowerCase() === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return doc.body.innerHTML;
}

/**
 * 从 HTML 中提取纯文本摘要。
 */
export function extractSnippet(html: string, maxLength: number = 200): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength
    ? cleaned.substring(0, maxLength) + '...'
    : cleaned;
}
