import { useEffect } from 'react';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { useUIStore } from '@/stores/uiStore';
import { Sidebar } from './Sidebar';
import { ArticleList } from './ArticleList';
import { ArticleDetail } from './ArticleDetail';
import { TopBar } from './TopBar';
import { AddFeedDialog } from '@/components/feeds/AddFeedDialog';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { SubscriptionsPage } from '@/components/feeds/SubscriptionsPage';
import { NotificationCenter } from '@/components/common/NotificationCenter';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { loadFeeds, loadFolders } = useFeedStore();
  const { loadArticles, filter, selectedFeedId, setSelectedFeedId } = useArticleStore();
  const { initializeTheme, sidebarCollapsed, currentPage } = useUIStore();

  // 初始化
  useEffect(() => {
    const init = async () => {
      await initializeTheme();
      await Promise.all([loadFeeds(), loadFolders()]);
      await loadArticles();
    };
    init();
  }, []);

  // 当筛选变化时重新加载文章
  useEffect(() => {
    loadArticles();
  }, [filter, loadArticles]);

  // 离开阅读页时清除订阅源筛选，避免侧边栏在管理类页面残留订阅源选中态。
  useEffect(() => {
    if (currentPage !== 'reader' && selectedFeedId !== null) {
      setSelectedFeedId(null);
    }
  }, [currentPage, selectedFeedId, setSelectedFeedId]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧订阅源列表 — 始终可见 */}
        <div
          className={cn(
            'h-full transition-all duration-200 ease-in-out',
            sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-60'
          )}
        >
          <Sidebar />
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-hidden">
          {currentPage === 'reader' && (
            <div className="flex h-full overflow-hidden">
              <div className="h-full w-80 shrink-0 overflow-hidden border-r">
                <ArticleList />
              </div>
              <div className="h-full flex-1 overflow-hidden">
                <ArticleDetail />
              </div>
            </div>
          )}
          {currentPage === 'settings' && <SettingsPage />}
          {currentPage === 'subscriptions' && <SubscriptionsPage />}
        </div>
      </div>
      <AddFeedDialog />
      <NotificationCenter />
    </div>
  );
}
