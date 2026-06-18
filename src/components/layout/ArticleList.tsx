import { useState } from 'react';
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TooltipIconButton } from '@/components/common/TooltipIconButton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import { CheckCheck, Circle, RefreshCw, Star } from 'lucide-react';
import type { Article } from '@/types';

export function ArticleList() {
  const {
    articles,
    selectedArticle,
    selectedFeedId,
    setSelectedArticle,
    markFeedAsRead,
    loadArticles,
  } = useArticleStore();
  const { feeds, loading, refreshFeed } = useFeedStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [markFeedConfirmOpen, setMarkFeedConfirmOpen] = useState(false);

  const feedMap = new Map(feeds.map((f) => [f.id, f]));
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId);

  /**
   * 刷新当前订阅源，并在完成后重新加载文章列表。
   */
  const handleRefreshSelectedFeed = async () => {
    if (!selectedFeed) return;

    const result = await refreshFeed(selectedFeed.id);
    await loadArticles();

    if (result.error) {
      showNotification({
        type: 'error',
        message: `刷新「${selectedFeed.title}」失败：${result.error}`,
      });
      return;
    }

    showNotification({
      type: 'success',
      message:
        result.newArticles > 0
          ? `「${selectedFeed.title}」新增 ${result.newArticles} 篇文章`
          : `「${selectedFeed.title}」暂无新文章`,
    });
  };

  /**
   * 将当前订阅源下的所有文章设为已读。
   */
  const handleMarkSelectedFeedAsRead = async () => {
    if (!selectedFeed) return;

    await markFeedAsRead(selectedFeed.id);
    showNotification({
      type: 'success',
      message: `「${selectedFeed.title}」已全部标记为已读`,
    });
  };

  return (
    <div className="flex h-full w-full flex-col">
      {selectedFeed && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b bg-background px-3">
          <div className="min-w-0 text-sm font-medium">
            <span className="block truncate">{selectedFeed.title}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            <TooltipIconButton
              onClick={handleRefreshSelectedFeed}
              disabled={loading}
              ariaLabel={loading ? '正在刷新本订阅源' : '刷新本订阅源'}
              tooltip={loading ? '正在刷新本订阅源' : '刷新本订阅源'}
              tooltipAlign="end"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </TooltipIconButton>
            <TooltipIconButton
              onClick={() => setMarkFeedConfirmOpen(true)}
              disabled={selectedFeed.unreadCount === 0}
              ariaLabel="将本订阅源文章全部设为已读"
              tooltip="将本订阅源文章全部设为已读"
              tooltipAlign="end"
            >
              <CheckCheck className="h-4 w-4" />
            </TooltipIconButton>
          </div>
        </div>
      )}

      {articles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg font-medium">暂无文章</p>
            <p className="mt-1 text-sm">添加订阅开始阅读</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 w-full">
          <div className="w-full divide-y overflow-hidden">
            {articles.map((article) => {
              const feed = feedMap.get(article.feedId);
              const isSelected = selectedArticle?.id === article.id;

              return (
                <ArticleCard
                  key={article.id}
                  article={article}
                  feedTitle={feed?.title || '未知来源'}
                  feedFavicon={feed?.favicon}
                  selected={isSelected}
                  onClick={() => setSelectedArticle(article)}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}

      <ConfirmDialog
        open={markFeedConfirmOpen}
        onOpenChange={setMarkFeedConfirmOpen}
        title="标记本订阅源已读"
        description={`确定将「${selectedFeed?.title || ''}」的所有文章标记为已读吗？`}
        confirmText="全部已读"
        variant="destructive"
        onConfirm={handleMarkSelectedFeedAsRead}
      />
    </div>
  );
}

function ArticleCard({
  article,
  feedTitle,
  feedFavicon,
  selected,
  onClick,
}: {
  article: Article;
  feedTitle: string;
  feedFavicon?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'flex cursor-pointer flex-col gap-1 px-4 py-3 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/50',
        article.isRead && 'opacity-60'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Read indicator */}
        <div className="mt-2 shrink-0">
          {!article.isRead ? (
            <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
          ) : (
            <Circle className="h-2 w-2 text-transparent" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm leading-snug line-clamp-2 font-normal text-foreground">
            {article.title}
          </h3>

          {/* Snippet */}
          {article.contentSnippet && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {article.contentSnippet}
            </p>
          )}

          {/* Meta */}
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {feedFavicon ? (
                <img src={feedFavicon} alt="" className="h-3 w-3 rounded-sm" />
              ) : null}
              <span className="truncate max-w-[100px]">{feedTitle}</span>
            </div>
            <span>·</span>
            <span>{formatDate(article.publishedAt)}</span>
            {article.isStarred && (
              <>
                <span>·</span>
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
