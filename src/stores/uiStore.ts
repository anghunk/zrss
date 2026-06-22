import { create } from 'zustand';
import type { Settings } from '@/types';
import { getSettings, saveSettings } from '@/lib/db';

export type AppPage = 'reader' | 'settings' | 'subscriptions';

// 从 URL hash 解析页面
function getPageFromHash(): AppPage {
  const hash = window.location.hash.slice(1); // 移除 #
  if (hash === '/settings' || hash === 'settings') return 'settings';
  if (hash === '/subscriptions' || hash === 'subscriptions') return 'subscriptions';
  return 'reader';
}

// 更新 URL hash
function setHashForPage(page: AppPage) {
  const hash = page === 'reader' ? '' : `#/${page}`;
  if (window.location.hash !== hash) {
    if (hash) {
      window.location.hash = hash;
    } else {
      // 清除 hash
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  }
}

interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  settings: Settings | null;
  addFeedOpen: boolean;
  prefillUrl: string; // 预填到「添加订阅」对话框的 URL
  addFeedFolderId: string | null; // 添加订阅时默认放入的分组
  currentPage: AppPage;

  // Actions
  initializeTheme: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  toggleSidebar: () => void;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  setAddFeedOpen: (open: boolean) => void;
  setPrefillUrl: (url: string) => void;
  setAddFeedFolderId: (folderId: string | null) => void;
  openAddFeedWithUrl: (url: string, folderId?: string | null) => void; // 打开对话框并预填 URL
  setPage: (page: AppPage) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'system',
  sidebarCollapsed: false,
  settings: null,
  addFeedOpen: false,
  prefillUrl: '',
  addFeedFolderId: null,
  currentPage: getPageFromHash(),

  initializeTheme: async () => {
    const settings = await getSettings();
    const theme = settings.theme;
    set({ theme, settings });

    // 应用主题
    applyTheme(theme);
  },

  setTheme: async (theme) => {
    await saveSettings({ theme });
    set({ theme });
    applyTheme(theme);
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  loadSettings: async () => {
    const settings = await getSettings();
    set({ settings });
  },

  updateSettings: async (updates) => {
    const settings = await saveSettings(updates);
    set({ settings });
    if ('refreshInterval' in updates) {
      try {
        await browser.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          payload: { refreshInterval: settings.refreshInterval },
        });
      } catch {
        // 后台 Service Worker 暂未激活时忽略，下一次启动会读取最新设置。
      }
    }
  },

  setAddFeedOpen: (open) => set({ addFeedOpen: open }),
  setPrefillUrl: (url) => set({ prefillUrl: url }),
  setAddFeedFolderId: (folderId) => set({ addFeedFolderId: folderId }),
  openAddFeedWithUrl: (url, folderId = null) =>
    set({ prefillUrl: url, addFeedFolderId: folderId, addFeedOpen: true }),
  setPage: (page) => {
    setHashForPage(page);
    set({ currentPage: page });
  },
}));

// 监听 hash 变化（浏览器前进/后退按钮）
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const page = getPageFromHash();
    if (useUIStore.getState().currentPage !== page) {
      useUIStore.setState({ currentPage: page });
    }
  });
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

// 监听系统主题变化
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { theme } = useUIStore.getState();
    if (theme === 'system') {
      document.documentElement.classList.toggle('dark', e.matches);
    }
  });
}
