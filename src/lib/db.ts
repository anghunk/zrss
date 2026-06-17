import Dexie, { type Table } from 'dexie';
import type { Feed, Article, Folder, Settings } from '@/types';

export class ZrssDB extends Dexie {
  feeds!: Table<Feed, string>;
  articles!: Table<Article, string>;
  folders!: Table<Folder, string>;
  settings!: Table<Settings & { id: string }, string>;

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
  }
}

export const db = new ZrssDB();

// 默认设置
export const defaultSettings: Settings = {
  refreshInterval: 15,
  autoMarkRead: true,
  maxArticlesPerFeed: 500,
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  webdavPath: '/zrss',
  theme: 'system',
};

// 获取设置
export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.get('main');
  if (!settings) {
    await db.settings.put({ id: 'main', ...defaultSettings });
    return defaultSettings;
  }
  const { id, ...rest } = settings;
  return { ...defaultSettings, ...rest };
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
