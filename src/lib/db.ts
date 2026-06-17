import Dexie, { type Table } from 'dexie';
import type { Feed, Article, Folder, Settings } from '@/types';
import type { AICacheEntry, AITaskType } from '@/types/ai';

export class ZrssDB extends Dexie {
  feeds!: Table<Feed, string>;
  articles!: Table<Article, string>;
  folders!: Table<Folder, string>;
  settings!: Table<Settings & { id: string }, string>;
  aiCache!: Table<AICacheEntry, string>;

  constructor() {
    super('zrss');
    this.version(1).stores({
      feeds: 'id, url, folderId, sortOrder, createdAt',
      articles: 'id, feedId, guid, publishedAt, isRead, isStarred',
      folders: 'id, sortOrder',
      settings: 'id',
    });
    this.version(2).stores({
      folders: 'id, name, sortOrder',
    });
    this.version(3).stores({
      aiCache: 'id, articleId, taskType, createdAt',
    });
  }
}

export const db = new ZrssDB();

// 默认设置（空的 AI 配置，用户需要自行添加供应商）
export const defaultSettings: Settings = {
  refreshInterval: 15,
  autoMarkRead: true,
  maxArticlesPerFeed: 500,
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  webdavPath: '/zrss',
  theme: 'system',
  aiEnabled: false,
  activeProviderId: null,
  aiProviders: {},
  aiAutoSummarize: false,
};

// 获取设置（含旧版数据迁移）
export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.get('main');
  if (!settings) {
    await db.settings.put({ id: 'main', ...defaultSettings });
    return { ...defaultSettings };
  }

  const { id, ...rest } = settings as Settings & { id: string } & Record<string, unknown>;

  // 检测并迁移旧版数据
  const migrated = migrateSettings(rest);

  return { ...defaultSettings, ...migrated };
}

// 旧版数据迁移逻辑
function migrateSettings(raw: Record<string, unknown>): Partial<Settings> {
  const result: Record<string, unknown> = { ...raw };

  // 版本 1: 扁平字段 (aiBaseUrl, aiApiKey, aiModel, aiApiFormat, aiProvider)
  if ('aiBaseUrl' in raw || 'aiApiKey' in raw) {
    const providerId = `legacy_${Date.now()}`;
    const provider = {
      id: providerId,
      name: 'Legacy',
      baseUrl: (raw.aiBaseUrl as string) || '',
      apiKey: (raw.aiApiKey as string) || '',
      apiFormat: (raw.aiApiFormat as 'openai' | 'anthropic') || 'openai',
      models: [],
      currentModel: (raw.aiModel as string) || '',
    };

    result.aiProviders = { [providerId]: provider };
    result.activeProviderId = providerId;

    // 清理旧字段
    delete result.aiBaseUrl;
    delete result.aiApiKey;
    delete result.aiModel;
    delete result.aiApiFormat;
    delete result.aiProvider;
  }

  // 版本 2: aiProviderConfigs (Record<AIProvider, AIProviderConfig>)
  if ('aiProviderConfigs' in raw && raw.aiProviderConfigs) {
    const oldConfigs = raw.aiProviderConfigs as Record<string, {
      baseUrl: string;
      apiKey: string;
      model: string;
      apiFormat: 'openai' | 'anthropic';
    }>;
    const oldProvider = raw.aiProvider as string;

    const newProviders: Record<string, Settings['aiProviders'][string]> = {};
    let activeId: string | null = null;

    for (const [key, config] of Object.entries(oldConfigs)) {
      if (config.apiKey || config.baseUrl) {
        const providerId = key === 'custom' ? `custom_${Date.now()}` : `preset_${key}`;
        newProviders[providerId] = {
          id: providerId,
          name: key.charAt(0).toUpperCase() + key.slice(1),
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          apiFormat: config.apiFormat,
          models: [],
          currentModel: config.model,
        };
        if (key === oldProvider) {
          activeId = providerId;
        }
      }
    }

    result.aiProviders = newProviders;
    result.activeProviderId = activeId;

    // 清理旧字段
    delete result.aiProviderConfigs;
    delete result.aiProvider;
  }

  return result as Partial<Settings>;
}

// 保存设置
export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await db.settings.put({ id: 'main', ...updated });
  return updated;
}

// 更新未读数缓存
export async function updateUnreadCount(feedId: string): Promise<number> {
  const articles = await db.articles
    .where('feedId')
    .equals(feedId)
    .filter((a) => !a.isRead)
    .toArray();
  const count = articles.length;
  await db.feeds.update(feedId, { unreadCount: count });
  return count;
}

// 清理旧文章
export async function cleanupOldArticles(feedId: string, maxCount: number): Promise<number> {
  const allArticles = await db.articles
    .where('feedId')
    .equals(feedId)
    .reverse()
    .sortBy('publishedAt');

  if (allArticles.length <= maxCount) return 0;

  const toDelete = allArticles
    .slice(maxCount)
    .filter((a) => !a.isStarred);

  if (toDelete.length === 0) return 0;

  await db.articles.bulkDelete(toDelete.map((a) => a.id));
  return toDelete.length;
}

// AI 缓存: 获取
export async function getAICache(
  articleId: string,
  taskType: AITaskType
): Promise<AICacheEntry | undefined> {
  const id = `${articleId}:${taskType}`;
  return db.aiCache.get(id);
}

// AI 缓存: 保存
export async function setAICache(
  articleId: string,
  taskType: AITaskType,
  result: string,
  model: string
): Promise<void> {
  const entry: AICacheEntry = {
    id: `${articleId}:${taskType}`,
    articleId,
    taskType,
    result,
    model,
    createdAt: Date.now(),
  };
  await db.aiCache.put(entry);
}
