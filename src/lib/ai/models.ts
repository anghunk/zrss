import type { AIApiFormat } from '@/types/ai';

/**
 * 从供应商 API 获取模型列表。
 */
export async function fetchModels(
  baseUrl: string,
  apiKey: string,
  apiFormat: AIApiFormat
): Promise<string[]> {
  if (apiFormat === 'anthropic') {
    return [];
  }

  if (apiFormat === 'ollama') {
    return fetchOllamaModels(baseUrl, apiKey);
  }

  // OpenAI 兼容格式：调用 /models 端点
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // OpenAI 格式：{ data: [{ id: "gpt-4", ... }, ...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data
        .map((m: { id?: string }) => m.id)
        .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0)
        .sort();
    }

    return [];
  } catch (error) {
    console.error('[AI] 获取模型列表失败:', error);
    return [];
  }
}

/**
 * 从 Ollama 原生 /tags 端点获取模型列表。
 */
async function fetchOllamaModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/tags`;

  try {
    const response = await fetch(url, {
      headers: {
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models
        .map((m: { name?: string }) => m.name)
        .filter((name: string | undefined): name is string => typeof name === 'string' && name.length > 0)
        .sort();
    }

    return [];
  } catch (error) {
    console.error('[AI] 获取 Ollama 模型列表失败:', error);
    return [];
  }
}

// 生成供应商 ID
export function generateProviderId(prefix: string = 'provider'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
