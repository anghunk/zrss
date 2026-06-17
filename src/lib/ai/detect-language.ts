import type { DetectedLanguage } from '@/types/ai';

/**
 * 启发式语言检测 — 基于 Unicode 区块字符占比
 * 零 token 消耗，速度快
 */
export function detectLanguage(text: string): DetectedLanguage {
  // 取前 500 字符用于分析
  const sample = text.slice(0, 500);
  const totalChars = sample.length;

  if (totalChars === 0) return 'other';

  let cjkCount = 0;     // CJK 统一表意文字 (中文)
  let hiraganaKatakana = 0; // 平假名 + 片假名 (日语)
  let hangulCount = 0;  // 韩文 (谚文)

  for (const char of sample) {
    const code = char.codePointAt(0)!;

    // CJK Unified Ideographs: U+4E00 - U+9FFF
    if (code >= 0x4e00 && code <= 0x9fff) {
      cjkCount++;
    }
    // Hiragana: U+3040 - U+309F, Katakana: U+30A0 - U+30FF
    else if (code >= 0x3040 && code <= 0x30ff) {
      hiraganaKatakana++;
    }
    // Hangul Syllables: U+AC00 - U+D7AF
    else if (code >= 0xac00 && code <= 0xd7af) {
      hangulCount++;
    }
  }

  const cjkRatio = cjkCount / totalChars;
  const japaneseRatio = hiraganaKatakana / totalChars;
  const koreanRatio = hangulCount / totalChars;

  // 日语: 有假名就基本确定是日语
  if (japaneseRatio > 0.05) return 'ja';

  // 韩语: 有谚文就基本确定是韩语
  if (koreanRatio > 0.05) return 'ko';

  // 中文: CJK 字符占比 > 30%
  if (cjkRatio > 0.3) return 'zh';

  // 其余视为外文
  return 'other';
}

/**
 * 从 HTML 中提取纯文本用于语言检测
 */
export function extractTextForDetection(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  } catch {
    // 简单的标签剥离 fallback
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
