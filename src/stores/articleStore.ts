import { create } from 'zustand';
import { db } from '@/lib/db';
import { useFeedStore } from './feedStore';
import type { Article, FilterType } from '@/types';

const FILTER_STORAGE_KEY = 'zrss:filter';

function loadStoredFilter(): FilterType {
  try {
    const value = localStorage.getItem(FILTER_STORAGE_KEY);
    if (value === 'all' || value === 'unread' || value === 'starred') {
      return value;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return 'all';
}

function persistFilter(filter: FilterType) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
  } catch {
    // localStorage 不可用时忽略
  }
}

interface ArticleState {
  articles: Article[];
  selectedArticle: Article | null;
  filter: FilterType;
  selectedFeedId: string | null;
  searchQuery: string;
  loading: boolean;

  // Actions
  loadArticles: () => Promise<void>;
  setSelectedArticle: (article: Article | null) => void;
  setFilter: (filter: FilterType) => void;
  setSelectedFeedId: (feedId: string | null) => void;
  setSearchQuery: (query: string) => void;
  markAsRead: (articleId: string) => Promise<void>;
  markAsUnread: (articleId: string) => Promise<void>;
  toggleStarred: (articleId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markFeedAsRead: (feedId: string) => Promise<void>;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  articles: [],
  selectedArticle: null,
  filter: loadStoredFilter(),
  selectedFeedId: null,
  searchQuery: '',
  loading: false,

  loadArticles: async () => {
    set({ loading: true });
    try {
      const { filter, selectedFeedId, searchQuery } = get();

      let articles: Article[];

      if (selectedFeedId === ('__starred__' as any)) {
        // 星标文章：取全部后过滤，按星标时间倒序
        articles = await db.articles.toArray();
        articles = articles.filter((a) => a.isStarred);
        articles.sort((a, b) => (b.starredAt || 0) - (a.starredAt || 0));
      } else if (selectedFeedId) {
        // 按 feed 筛选：先取出再按发布时间倒序
        articles = await db.articles
          .where('feedId')
          .equals(selectedFeedId)
          .toArray();
        articles.sort((a, b) => b.publishedAt - a.publishedAt);
      } else {
        // 全部文章：按发布时间倒序
        articles = await db.articles
          .orderBy('publishedAt')
          .reverse()
          .toArray();
      }

      // 筛选类型
      if (filter === 'unread') {
        articles = articles.filter((a) => !a.isRead);
      } else if (filter === 'starred') {
        articles = articles.filter((a) => a.isStarred);
      }

      // 搜索
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        articles = articles.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            a.contentSnippet.toLowerCase().includes(query) ||
            a.author.toLowerCase().includes(query)
        );
      }

      set({ articles });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedArticle: async (article: Article | null) => {
    set({ selectedArticle: article });

    // 自动标记已读
    if (article && !article.isRead) {
      const settings = await db.settings.get('main');
      const autoMarkRead = settings?.autoMarkRead ?? true;
      if (autoMarkRead) {
        await get().markAsRead(article.id);
      }
    }
  },

  setFilter: (filter: FilterType) => {
    persistFilter(filter);
    set({ filter });
    get().loadArticles();
  },

  setSelectedFeedId: (feedId: string | null) => {
    set({ selectedFeedId: feedId, selectedArticle: null });
    get().loadArticles();
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().loadArticles();
  },

  markAsRead: async (articleId: string) => {
    await db.articles.update(articleId, {
      isRead: true,
      readAt: Date.now(),
    });

    // 更新 store 中的文章
    set((state) => ({
      articles: state.articles.map((a) =>
        a.id === articleId ? { ...a, isRead: true, readAt: Date.now() } : a
      ),
      selectedArticle:
        state.selectedArticle?.id === articleId
          ? { ...state.selectedArticle, isRead: true, readAt: Date.now() }
          : state.selectedArticle,
    }));

    // 更新 feed 的未读数
    const article = get().articles.find((a) => a.id === articleId);
    if (article) {
      const unreadArticles = await db.articles
        .where('feedId')
        .equals(article.feedId)
        .filter((a) => !a.isRead)
        .toArray();
      await db.feeds.update(article.feedId, { unreadCount: unreadArticles.length });
      await useFeedStore.getState().loadFeeds();
    }
  },

  markAsUnread: async (articleId: string) => {
    await db.articles.update(articleId, {
      isRead: false,
      readAt: null,
    });

    set((state) => ({
      articles: state.articles.map((a) =>
        a.id === articleId ? { ...a, isRead: false, readAt: null } : a
      ),
      selectedArticle:
        state.selectedArticle?.id === articleId
          ? { ...state.selectedArticle, isRead: false, readAt: null }
          : state.selectedArticle,
    }));

    const article = get().articles.find((a) => a.id === articleId);
    if (article) {
      const unreadArticles = await db.articles
        .where('feedId')
        .equals(article.feedId)
        .filter((a) => !a.isRead)
        .toArray();
      await db.feeds.update(article.feedId, { unreadCount: unreadArticles.length });
      await useFeedStore.getState().loadFeeds();
    }
  },

  toggleStarred: async (articleId: string) => {
    const article = get().articles.find((a) => a.id === articleId);
    if (!article) return;

    const isStarred = !article.isStarred;
    const starredAt = isStarred ? Date.now() : null;

    await db.articles.update(articleId, { isStarred, starredAt });

    set((state) => ({
      articles: state.articles.map((a) =>
        a.id === articleId ? { ...a, isStarred, starredAt } : a
      ),
      selectedArticle:
        state.selectedArticle?.id === articleId
          ? { ...state.selectedArticle, isStarred, starredAt }
          : state.selectedArticle,
    }));
  },

  markAllAsRead: async () => {
    const { articles, selectedFeedId } = get();
    const articlesToMark = selectedFeedId
      ? articles.filter((a) => a.feedId === selectedFeedId && !a.isRead)
      : articles.filter((a) => !a.isRead);

    const now = Date.now();
    await Promise.all(
      articlesToMark.map((a) =>
        db.articles.update(a.id, { isRead: true, readAt: now })
      )
    );

    // 更新 feed 未读数
    if (selectedFeedId) {
      await db.feeds.update(selectedFeedId, { unreadCount: 0 });
    } else {
      const feeds = await db.feeds.toArray();
      for (const feed of feeds) {
        await db.feeds.update(feed.id, { unreadCount: 0 });
      }
    }

    await useFeedStore.getState().loadFeeds();
    await get().loadArticles();
  },

  markFeedAsRead: async (feedId: string) => {
    const articles = await db.articles
      .where('feedId')
      .equals(feedId)
      .filter((a) => !a.isRead)
      .toArray();

    for (const article of articles) {
      await db.articles.update(article.id, { isRead: true, readAt: Date.now() });
    }

    await db.feeds.update(feedId, { unreadCount: 0 });
    await useFeedStore.getState().loadFeeds();
    await get().loadArticles();
  },
}));
