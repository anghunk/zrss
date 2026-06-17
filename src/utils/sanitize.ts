// 简单的 HTML 清理 - 移除危险的标签和属性
export function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 移除 script 和 style 标签
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form'];
  dangerousTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // 移除事件属性
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (attr.name.startsWith('on') || attr.name === 'style') {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

// 提取纯文本摘要
export function extractSnippet(html: string, maxLength: number = 200): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength
    ? cleaned.substring(0, maxLength) + '...'
    : cleaned;
}
