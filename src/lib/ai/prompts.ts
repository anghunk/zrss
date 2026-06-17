// AI Prompt 模板

/**
 * HTML 转纯文本，用于摘要
 */
export function htmlToPlainText(html: string, maxLength: number = 12000): string {
  let text = '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    text = doc.body?.textContent || '';
  } catch {
    text = html.replace(/<[^>]+>/g, ' ');
  }
  // 压缩空白
  text = text.replace(/\s+/g, ' ').trim();
  // 截断
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }
  return text;
}

/**
 * 构建摘要 prompt — 始终返回中文 JSON
 */
export function buildSummaryPrompt(title: string, content: string): string {
  const plainText = htmlToPlainText(content);

  return `请用中文总结以下文章，无论原文是什么语言，摘要必须全部使用中文。

请严格返回以下 JSON 格式（不要添加任何额外文字或 markdown 代码块标记）：
{"tldr":"一句话总结（中文）","keyPoints":["要点1（中文）","要点2（中文）","要点3（中文）"]}

文章标题：${title}

文章内容：
${plainText}`;
}

/**
 * 构建翻译 prompt — 返回翻译后的 HTML
 */
export function buildTranslatePrompt(content: string): string {
  return `请将以下 HTML 文章内容翻译成中文。

要求：
1. 保持 HTML 标签结构不变，只翻译文本内容
2. 保留所有 HTML 属性（class, href, src 等）
3. 只返回翻译后的 HTML，不要添加任何额外说明文字或 markdown 代码块标记

${content}`;
}
