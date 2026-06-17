import type { AIProviderConfig } from '@/types/ai';

export class AIError extends Error {
  constructor(
    message: string,
    public code: 'network' | 'auth' | 'rate_limit' | 'server' | 'config' | 'aborted'
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ==================== OpenAI 格式 ====================

async function chatStreamOpenAI(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.currentModel,
        messages,
        stream: true,
      }),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('已取消', 'aborted');
    }
    throw new AIError(`网络请求失败: ${(err as Error).message}`, 'network');
  }

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  return await parseOpenAIStream(response, onChunk, signal);
}

async function parseOpenAIStream(
  response: Response,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new AIError('响应体为空', 'server');
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('已取消', 'aborted');
    }
    throw new AIError(`读取响应失败: ${(err as Error).message}`, 'network');
  }

  return fullText;
}

// ==================== Anthropic 格式 ====================

async function chatStreamAnthropic(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  // Anthropic API URL: baseUrl + /messages
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.currentModel,
        max_tokens: 8192,
        messages,
        stream: true,
      }),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('已取消', 'aborted');
    }
    throw new AIError(`网络请求失败: ${(err as Error).message}`, 'network');
  }

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  return await parseAnthropicStream(response, onChunk, signal);
}

async function parseAnthropicStream(
  response: Response,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new AIError('响应体为空', 'server');
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (!data) continue;

        try {
          const json = JSON.parse(data);

          // Anthropic 的 text_delta 事件
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            const text = json.delta.text;
            if (text) {
              fullText += text;
              onChunk(text);
            }
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('已取消', 'aborted');
    }
    throw new AIError(`读取响应失败: ${(err as Error).message}`, 'network');
  }

  return fullText;
}

// ==================== Ollama 原生格式 ====================

async function chatStreamOllama(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildOllamaHeaders(config),
      body: JSON.stringify({
        model: config.currentModel,
        messages,
        stream: true,
      }),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('已取消', 'aborted');
    }
    throw new AIError(`网络请求失败: ${(err as Error).message}`, 'network');
  }

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  return await parseOllamaStream(response, onChunk);
}

async function parseOllamaStream(
  response: Response,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new AIError('响应体为空', 'server');
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const json = JSON.parse(trimmed);
          const content = json.message?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('已取消', 'aborted');
    }
    throw new AIError(`读取响应失败: ${(err as Error).message}`, 'network');
  }

  return fullText;
}

async function chatSimpleOllama(
  messages: { role: string; content: string }[],
  config: AIProviderConfig
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: buildOllamaHeaders(config),
    body: JSON.stringify({
      model: config.currentModel,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  const json = await response.json();
  return json.message?.content || '';
}

function buildOllamaHeaders(config: AIProviderConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

// ==================== 通用 ====================

async function handleErrorResponse(response: Response): Promise<never> {
  const status = response.status;

  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.message || body?.error?.type || '';
  } catch { /* ignore */ }

  if (status === 401 || status === 403) {
    throw new AIError(`API Key 无效或已过期${detail ? ': ' + detail : ''}`, 'auth');
  }
  if (status === 429) {
    throw new AIError('请求过于频繁，请稍后再试', 'rate_limit');
  }
  if (status >= 500) {
    throw new AIError(`服务器错误 (${status})${detail ? ': ' + detail : ''}`, 'server');
  }
  throw new AIError(`请求失败 (${status})${detail ? ': ' + detail : ''}`, 'server');
}

/**
 * 流式调用 AI API（自动适配 OpenAI / Anthropic / Ollama 格式）
 */
export async function chatStream(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  // 校验配置
  if (!config.baseUrl || !config.apiKey || !config.currentModel) {
    throw new AIError('请先在设置中配置 AI 的 API Base URL、API Key 和模型', 'config');
  }

  if (config.apiFormat === 'anthropic') {
    return chatStreamAnthropic(messages, config, onChunk, signal);
  }
  if (config.apiFormat === 'ollama') {
    return chatStreamOllama(messages, config, onChunk, signal);
  }
  return chatStreamOpenAI(messages, config, onChunk, signal);
}

/**
 * 非流式调用 (用于测试连接)
 */
export async function chatSimple(
  messages: { role: string; content: string }[],
  config: AIProviderConfig
): Promise<string> {
  if (!config.baseUrl || !config.apiKey || !config.currentModel) {
    throw new AIError('请先在设置中配置 AI 的 API Base URL、API Key 和模型', 'config');
  }

  if (config.apiFormat === 'anthropic') {
    return chatSimpleAnthropic(messages, config);
  }
  if (config.apiFormat === 'ollama') {
    return chatSimpleOllama(messages, config);
  }
  return chatSimpleOpenAI(messages, config);
}

async function chatSimpleOpenAI(
  messages: { role: string; content: string }[],
  config: AIProviderConfig
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.currentModel,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

async function chatSimpleAnthropic(
  messages: { role: string; content: string }[],
  config: AIProviderConfig
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.currentModel,
      max_tokens: 1024,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  const json = await response.json();
  // Anthropic 返回格式: { content: [{ type: "text", text: "..." }] }
  return json.content?.[0]?.text || '';
}
