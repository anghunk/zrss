// 订阅源
export interface Feed {
  id: string;               // nanoid
  url: string;              // RSS feed URL
  title: string;            // 显示名称
  description: string;
  siteUrl: string;          // 网站主页
  favicon: string;          // 图标 URL
  folderId: string | null;  // 分组
  sortOrder: number;
  lastFetchedAt: number;    // 上次抓取时间戳
  unreadCount: number;      // 缓存的未读数
  createdAt: number;
  updatedAt: number;
}

// 文章
export interface Article {
  id: string;               // hash(guid + feedId)
  feedId: string;
  guid: string;             // RSS item 原始 guid
  title: string;
  link: string;             // 原文链接
  content: string;          // HTML 正文
  contentSnippet: string;   // 纯文本摘要 (前200字)
  author: string;
  publishedAt: number;      // 发布时间戳
  fetchedAt: number;        // 抓取时间戳
  isRead: boolean;          // 是否已读
  readAt: number | null;    // 标记已读的时间
  isStarred: boolean;       // 是否星标
  starredAt: number | null;
}

// 分组
export interface Folder {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
}

// 设置
export interface Settings {
  refreshInterval: number;    // 刷新间隔 (分钟), 默认 15
  autoMarkRead: boolean;      // 打开即标记已读, 默认 true
  maxArticlesPerFeed: number; // 每个 feed 最多保留文章数, 默认 500
  webdavUrl: string;
  webdavUser: string;
  webdavPass: string;
  webdavPath: string;
  theme: 'light' | 'dark' | 'system';
  // AI 功能
  aiEnabled: boolean;                    // 是否启用 AI 摘要功能
  activeProviderId: string | null;       // 当前选中的供应商 ID
  aiProviders: { [key: string]: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: 'openai' | 'anthropic' | 'ollama';
    models: string[];
    currentModel: string;
    modelsUpdatedAt?: number;
  }};
  aiAutoSummarize: boolean;              // 打开文章时自动摘要, 默认 false
}

// 筛选类型
export type FilterType = 'all' | 'unread' | 'starred';

// 解析后的 RSS 文章 (原始数据)
export interface ParsedFeedItem {
  guid: string;
  title: string;
  link: string;
  content: string;
  contentSnippet: string;
  author: string;
  publishedAt: number;
}

// 解析后的 RSS Feed (原始数据)
export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  image?: string;           // feed 自带的图标 (RSS <image> / Atom <logo>/<icon>)
  items: ParsedFeedItem[];
}

// 消息类型
export type MessageType =
  | { type: 'FETCH_FEEDS' }
  | { type: 'SETTINGS_UPDATED'; payload: { refreshInterval: number } }
  | { type: 'FEEDS_UPDATED'; payload: { feedId: string; newArticles: number }[] }
  | { type: 'FETCH_ERROR'; payload: { feedId: string; error: string } };
