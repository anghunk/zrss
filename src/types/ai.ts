// AI 相关类型定义

// AI API 格式
export type AIApiFormat = 'openai' | 'anthropic' | 'ollama';

// 单个供应商配置
export interface AIProviderConfig {
  id: string;                    // 唯一标识（nanoid 或自定义）
  name: string;                  // 显示名称
  baseUrl: string;               // API Base URL
  apiKey: string;                // API Key
  apiFormat: AIApiFormat;        // API 格式
  models: string[];              // 模型列表（可手动维护或自动获取）
  currentModel: string;          // 当前选中的模型
  modelsUpdatedAt?: number;      // 上次获取模型列表的时间戳
}

// AI 供应商预设模板（用于创建新供应商）
export interface AIProviderPreset {
  id: string;                    // 预设标识
  name: string;                  // 显示名称
  icon: 'openai' | 'deepseek' | 'aliyun' | 'ollama' | 'ollama-cloud' | 'anthropic';
  baseUrl: string;               // 默认 Base URL
  apiFormat: AIApiFormat;        // API 格式
  description: string;           // 描述
  suggestedModels: string[];     // 推荐的模型列表
}

// 预设的 AI 供应商模板
export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai',
    description: 'OpenAI 官方 API，支持 GPT 系列模型',
    suggestedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiFormat: 'openai',
    description: 'DeepSeek API，性价比高',
    suggestedModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  },
  {
    id: 'aliyun',
    name: '阿里云百炼',
    icon: 'aliyun',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai',
    description: '阿里云百炼，支持通义千问等模型',
    suggestedModels: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
  },
  {
    id: 'ollama',
    name: 'Ollama 本地',
    icon: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    apiFormat: 'openai',
    description: '本地运行，需先启动 Ollama',
    suggestedModels: ['qwen2.5:7b', 'llama3.1:8b', 'phi3:mini', 'mistral:7b'],
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama 云端',
    icon: 'ollama-cloud',
    baseUrl: 'https://ollama.com/api',
    apiFormat: 'ollama',
    description: 'Ollama 云端模型，使用 Ollama 账号 API Key',
    suggestedModels: ['gpt-oss:120b', 'qwen3:480b', 'deepseek-v3.1'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiFormat: 'anthropic',
    description: 'Anthropic 官方 API，Claude 系列模型',
    suggestedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
];

// AI 设置
export interface AISettings {
  aiEnabled: boolean;                    // 总开关
  activeProviderId: string | null;       // 当前选中的供应商 ID
  providers: Record<string, AIProviderConfig>;  // 所有供应商配置
  aiAutoSummarize: boolean;              // 打开文章时自动摘要
}

// 从预设创建新的供应商配置
export function createProviderFromPreset(
  preset: AIProviderPreset,
  customId?: string
): AIProviderConfig {
  const id = customId || `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: '',
    apiFormat: preset.apiFormat,
    models: [...preset.suggestedModels],
    currentModel: preset.suggestedModels[0] || '',
  };
}

// 创建自定义供应商配置
export function createCustomProvider(
  name: string,
  baseUrl: string,
  apiFormat: AIApiFormat,
  customId?: string
): AIProviderConfig {
  const id = customId || `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    baseUrl,
    apiKey: '',
    apiFormat,
    models: [],
    currentModel: '',
  };
}

// 从 AISettings 中解析出当前活跃的供应商完整配置
export function resolveActiveAIConfig(settings: AISettings): AIProviderConfig | null {
  if (!settings.activeProviderId) return null;
  return settings.providers[settings.activeProviderId] || null;
}

// AI 任务类型
export type AITaskType = 'summary' | 'translate';

// AI 缓存条目
export interface AICacheEntry {
  id: string;                   // `${articleId}:${taskType}`
  articleId: string;
  taskType: AITaskType;
  result: string;               // 摘要为 JSON string {tldr, keyPoints}，翻译为 HTML string
  model: string;
  createdAt: number;
}

// 摘要结果结构
export interface AISummaryResult {
  tldr: string;                 // 一句话总结
  keyPoints: string[];          // 要点列表
}

// 语言检测结果
export type DetectedLanguage = 'zh' | 'ja' | 'ko' | 'other';
