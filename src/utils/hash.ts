// 简单的字符串哈希函数
export function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// 生成文章 ID
export function generateArticleId(guid: string, feedId: string): string {
  return hashCode(`${guid}:${feedId}`);
}
