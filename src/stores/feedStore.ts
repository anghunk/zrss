import { create } from 'zustand';
import { db, updateUnreadCount } from '@/lib/db';
import { addFeed, deleteFeed, fetchAllFeeds, fetchFeed } from '@/lib/feed-fetcher';
import type { Feed, Folder } from '@/types';
import { nanoid } from 'nanoid';

interface FeedState {
  feeds: Feed[];
  folders: Folder[];
  loading: boolean;
  refreshingAll: boolean;
  refreshingFeedIds: string[];
  error: string | null;

  // Actions
  loadFeeds: () => Promise<void>;
  loadFolders: () => Promise<void>;
  addFeed: (url: string, folderId?: string | null) => Promise<void>;
  deleteFeed: (feedId: string) => Promise<void>;
  updateFeed: (feedId: string, updates: Partial<Feed>) => Promise<void>;
  addFolder: (name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  updateFolder: (folderId: string, updates: Partial<Folder>) => Promise<void>;
  moveFeed: (feedId: string, targetFolderId: string | null) => Promise<void>;
  reorderFeeds: (feedIds: string[], targetFolderId: string | null) => Promise<void>;
  reorderFolders: (folderIds: string[]) => Promise<void>;
  refreshFeed: (feedId: string) => Promise<{ newArticles: number; error?: string }>;
  refreshAll: () => Promise<void>;
  setError: (error: string | null) => void;
}

/**
 * 将刷新后的单个订阅源合并进列表状态。
 */
function mergeFeed(feeds: Feed[], updatedFeed: Feed): Feed[] {
  const exists = feeds.some((feed) => feed.id === updatedFeed.id);
  if (!exists) {
    return [...feeds, updatedFeed];
  }

  return feeds.map((feed) =>
    feed.id === updatedFeed.id ? { ...feed, ...updatedFeed } : feed
  );
}

export const useFeedStore = create<FeedState>((set, get) => ({
  feeds: [],
  folders: [],
  loading: false,
  refreshingAll: false,
  refreshingFeedIds: [],
  error: null,

  loadFeeds: async () => {
    const feeds = await db.feeds.orderBy('sortOrder').toArray();
    set({ feeds });
  },

  loadFolders: async () => {
    const folders = await db.folders.orderBy('sortOrder').toArray();
    set({ folders });
  },

  addFeed: async (url: string, folderId: string | null = null) => {
    set({ loading: true, error: null });
    try {
      await addFeed(url, folderId);
      await get().loadFeeds();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add feed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteFeed: async (feedId: string) => {
    set({ loading: true, error: null });
    try {
      await deleteFeed(feedId);
      await get().loadFeeds();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete feed';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  updateFeed: async (feedId: string, updates: Partial<Feed>) => {
    await db.feeds.update(feedId, { ...updates, updatedAt: Date.now() });
    await get().loadFeeds();
  },

  addFolder: async (name: string) => {
    const folder: Folder = {
      id: nanoid(),
      name,
      sortOrder: get().folders.length,
      createdAt: Date.now(),
    };
    await db.folders.add(folder);
    await get().loadFolders();
  },

  deleteFolder: async (folderId: string) => {
    // 将文件夹内的 feeds 移到根目录
    await db.feeds.where('folderId').equals(folderId).modify({ folderId: null });
    await db.folders.delete(folderId);
    await get().loadFolders();
    await get().loadFeeds();
  },

  updateFolder: async (folderId: string, updates: Partial<Folder>) => {
    await db.folders.update(folderId, updates);
    await get().loadFolders();
  },

  moveFeed: async (feedId: string, targetFolderId: string | null) => {
    const feed = await db.feeds.get(feedId);
    if (!feed) return;
    // 如果已经在目标分组，不做改动
    if ((feed.folderId || null) === (targetFolderId || null)) return;
    // 追加到目标分组末尾
    const siblings = await db.feeds
      .where('folderId')
      .equals(targetFolderId || '')
      .filter((f) => (f.folderId || null) === (targetFolderId || null))
      .toArray();
    const maxOrder = siblings.reduce((m, f) => Math.max(m, f.sortOrder), -1);
    await db.feeds.update(feedId, {
      folderId: targetFolderId,
      sortOrder: maxOrder + 1,
      updatedAt: Date.now(),
    });
    await get().loadFeeds();
  },

  reorderFeeds: async (feedIds: string[], targetFolderId: string | null) => {
    await db.transaction('rw', db.feeds, async () => {
      for (let i = 0; i < feedIds.length; i++) {
        await db.feeds.update(feedIds[i], {
          folderId: targetFolderId,
          sortOrder: i,
          updatedAt: Date.now(),
        });
      }
    });
    await get().loadFeeds();
  },

  reorderFolders: async (folderIds: string[]) => {
    await db.transaction('rw', db.folders, async () => {
      for (let i = 0; i < folderIds.length; i++) {
        await db.folders.update(folderIds[i], { sortOrder: i });
      }
    });
    await get().loadFolders();
  },

  /**
   * 只刷新指定订阅源，并同步更新订阅源列表状态。
   */
  refreshFeed: async (feedId: string) => {
    set((state) => ({
      error: null,
      refreshingFeedIds: state.refreshingFeedIds.includes(feedId)
        ? state.refreshingFeedIds
        : [...state.refreshingFeedIds, feedId],
    }));
    try {
      const result = await fetchFeed(feedId);
      const updatedFeed = await db.feeds.get(feedId);
      if (updatedFeed) {
        set((state) => ({
          feeds: mergeFeed(state.feeds, updatedFeed),
        }));
      }
      await get().loadFeeds();
      if (result.error) {
        set({ error: result.error });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh feed';
      set({ error: message });
      return { newArticles: 0, error: message };
    } finally {
      set((state) => ({
        refreshingFeedIds: state.refreshingFeedIds.filter((id) => id !== feedId),
      }));
    }
  },

  /**
   * 刷新全部订阅源，并在单个订阅源完成时增量更新侧边栏状态。
   */
  refreshAll: async () => {
    set({ refreshingAll: true, error: null });
    try {
      await fetchAllFeeds({
        onFeedFetched: ({ feed }) => {
          if (!feed) return;
          set((state) => ({
            feeds: mergeFeed(state.feeds, feed),
          }));
        },
      });
      await get().loadFeeds();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh';
      set({ error: message });
    } finally {
      set({ refreshingAll: false });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
