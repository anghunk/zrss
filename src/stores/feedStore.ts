import { create } from 'zustand';
import { db, updateUnreadCount } from '@/lib/db';
import { addFeed, deleteFeed, fetchAllFeeds } from '@/lib/feed-fetcher';
import type { Feed, Folder } from '@/types';
import { nanoid } from 'nanoid';

interface FeedState {
  feeds: Feed[];
  folders: Folder[];
  loading: boolean;
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
  refreshAll: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  feeds: [],
  folders: [],
  loading: false,
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

  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      await fetchAllFeeds();
      await get().loadFeeds();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
