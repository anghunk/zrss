import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppPage } from '@/stores/uiStore';

// 从 hash 中提取 ?add=<url> 参数。
// 支持的格式：
//   #/subscriptions?add=ENCODED_URL
//   #subscriptions?add=ENCODED_URL
function parseAddParamFromHash(): { page: AppPage | null; addUrl: string | null } {
  const raw = window.location.hash.slice(1); // 去掉 #
  if (!raw) return { page: null, addUrl: null };

  const [path, query] = raw.split('?');
  if (!query) return { page: null, addUrl: null };

  const params = new URLSearchParams(query);
  const addUrl = params.get('add');
  if (!addUrl) return { page: null, addUrl: null };

  // 推断页面
  let page: AppPage | null = null;
  const normalized = path.replace(/^\//, '');
  if (normalized === 'subscriptions') page = 'subscriptions';
  else if (normalized === 'settings') page = 'settings';
  else if (normalized === 'reader' || normalized === '') page = 'reader';

  return { page, addUrl };
}

export function App() {
  const { loadFeeds } = useFeedStore();
  const { loadArticles } = useArticleStore();
  const { openAddFeedWithUrl, setPage } = useUIStore();

  // 处理来自 popup 的 ?add= 参数：打开对话框并预填 URL
  useEffect(() => {
    const { page, addUrl } = parseAddParamFromHash();
    if (addUrl) {
      if (page) setPage(page);
      openAddFeedWithUrl(addUrl);
      // 清理 hash，避免刷新后重复触发
      const cleanHash = page ? `#/${page}` : '';
      if (cleanHash) {
        window.location.hash = cleanHash;
      } else {
        history.replaceState(
          '',
          document.title,
          window.location.pathname + window.location.search
        );
      }
    }
  }, []);

  // 监听来自 background 的消息
  useEffect(() => {
    const handler = (message: any) => {
      if (message.type === 'FEEDS_UPDATED') {
        // 重新加载数据
        loadFeeds();
        loadArticles();
      }
    };

    browser.runtime.onMessage.addListener(handler);
    return () => {
      browser.runtime.onMessage.removeListener(handler);
    };
  }, []);

  return <AppLayout />;
}
