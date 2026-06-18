import { db, updateUnreadCount, cleanupOldArticles, getSettings } from './db';
import { parseFeed } from './rss-parser';
import { generateArticleId } from '@/utils/hash';
import { sanitizeHtml } from '@/utils/sanitize';
import { resolveFavicon } from './favicon';
import type { Feed, Article } from '@/types';
import { nanoid } from 'nanoid';

export interface FetchFeedResult {
  feedId: string;
  newArticles: number;
  error?: string;
  feed?: Feed;
}

export interface FetchAllFeedsOptions {
  onFeedFetched?: (result: FetchFeedResult) => void | Promise<void>;
}

/**
 * 抓取单个订阅源并更新文章与未读数。
 */
export async function fetchFeed(feedId: string): Promise<{ newArticles: number; error?: string }> {
  try {
    const feed = await db.feeds.get(feedId);
    if (!feed) {
      return { newArticles: 0, error: 'Feed not found' };
    }

    // 抓取 RSS XML
    const response = await fetch(feed.url);
    if (!response.ok) {
      return { newArticles: 0, error: `HTTP ${response.status}` };
    }

    const xmlText = await response.text();

    // 解析 RSS
    const parsed = parseFeed(xmlText);

    // 更新 feed 信息 (如果 title 变了)
    const updates: Partial<Feed> = {
      lastFetchedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (parsed.title && feed.title === feed.url) {
      updates.title = parsed.title;
    }
    if (parsed.description && !feed.description) {
      updates.description = parsed.description;
    }
    const siteUrl = parsed.link || feed.siteUrl;
    if (parsed.link && !feed.siteUrl) {
      updates.siteUrl = parsed.link;
    }
    // 若 favicon 仍为空, 尝试解析一次
    if (!feed.favicon && siteUrl) {
      try {
        updates.favicon = await resolveFavicon(siteUrl, parsed.image);
      } catch {
        // ignore
      }
    }
    await db.feeds.update(feedId, updates);

    // 检查已存在的文章
    const existingGuids = new Set(
      (await db.articles.where('feedId').equals(feedId).toArray())
        .map((a) => a.guid)
    );

    // 插入新文章
    const newArticles: Article[] = [];
    for (const item of parsed.items) {
      if (existingGuids.has(item.guid)) continue;

      const article: Article = {
        id: generateArticleId(item.guid, feedId),
        feedId,
        guid: item.guid,
        title: item.title,
        link: item.link,
        content: sanitizeHtml(item.content),
        contentSnippet: item.contentSnippet,
        author: item.author,
        publishedAt: item.publishedAt,
        fetchedAt: Date.now(),
        isRead: false,
        readAt: null,
        isStarred: false,
        starredAt: null,
      };
      newArticles.push(article);
    }

    if (newArticles.length > 0) {
      await db.articles.bulkAdd(newArticles);
    }

    // 清理旧文章
    const settings = await getSettings();
    await cleanupOldArticles(feedId, settings.maxArticlesPerFeed);

    // 更新未读数
    await updateUnreadCount(feedId);

    return { newArticles: newArticles.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { newArticles: 0, error: message };
  }
}

/**
 * 抓取所有订阅源，并在每个订阅源完成后触发进度回调。
 */
export async function fetchAllFeeds(
  options: FetchAllFeedsOptions = {}
): Promise<FetchFeedResult[]> {
  const feeds = await db.feeds.toArray();
  const results: FetchFeedResult[] = [];

  for (const feed of feeds) {
    const result = await fetchFeed(feed.id);
    const updatedFeed = await db.feeds.get(feed.id);
    const item = { feedId: feed.id, ...result, feed: updatedFeed };
    results.push(item);
    await options.onFeedFetched?.(item);
  }

  return results;
}

// 添加新的 feed
export async function addFeed(url: string, folderId: string | null = null): Promise<Feed> {
  // 检查是否已存在
  const existing = await db.feeds.where('url').equals(url).first();
  if (existing) {
    throw new Error('Feed already exists');
  }

  // 抓取一次验证
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: HTTP ${response.status}`);
  }

  const xmlText = await response.text();
  const parsed = parseFeed(xmlText);

  // 解析 favicon
  let favicon = '';
  try {
    favicon = await resolveFavicon(parsed.link || url, parsed.image);
  } catch {
    // ignore
  }

  const now = Date.now();
  const feedId = nanoid();

  const feed: Feed = {
    id: feedId,
    url,
    title: parsed.title || url,
    description: parsed.description,
    siteUrl: parsed.link,
    favicon,
    folderId,
    sortOrder: (await db.feeds.count()),
    lastFetchedAt: now,
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.feeds.add(feed);

  // 添加所有文章
  const articles: Article[] = parsed.items.map((item) => ({
    id: generateArticleId(item.guid, feedId),
    feedId,
    guid: item.guid,
    title: item.title,
    link: item.link,
    content: sanitizeHtml(item.content),
    contentSnippet: item.contentSnippet,
    author: item.author,
    publishedAt: item.publishedAt,
    fetchedAt: now,
    isRead: false,
    readAt: null,
    isStarred: false,
    starredAt: null,
  }));

  if (articles.length > 0) {
    await db.articles.bulkAdd(articles);
  }

  await updateUnreadCount(feedId);

  return feed;
}

// 删除 feed 及其文章
export async function deleteFeed(feedId: string): Promise<void> {
  await db.articles.where('feedId').equals(feedId).delete();
  await db.feeds.delete(feedId);
}
