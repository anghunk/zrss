import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TooltipIconButton } from '@/components/common/TooltipIconButton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import { CheckCheck, Circle, RefreshCw, Star } from 'lucide-react';
import type { Article, FilterType } from '@/types';

const ALL_ARTICLES_VIEW_KEY = '__all__';
const STARRED_ARTICLES_VIEW_KEY = '__starred__';
const ARTICLE_VIEW_KEY_SEPARATOR = '::';
const ARTICLE_FILTER_ORDER: FilterType[] = ['all', 'unread', 'starred'];
const ARTICLE_LIST_EXIT_MS = 140;
const ARTICLE_LIST_ENTER_MS = 180;
const ARTICLE_PAGE_SIZE = 20;
const ARTICLE_LOAD_MORE_ROOT_MARGIN = '160px';

type ArticleListTransitionStage = 'idle' | 'leaving' | 'entering';
type ArticleListTransitionDirection = 'forward' | 'backward';

/**
 * 生成文章列表视图键，用于识别订阅源或筛选条件切换。
 */
function getArticleViewKey(selectedFeedId: string | null, filter: FilterType) {
  return `${selectedFeedId ?? ALL_ARTICLES_VIEW_KEY}${ARTICLE_VIEW_KEY_SEPARATOR}${filter}`;
}

/**
 * 从文章列表视图键中解析订阅源与筛选条件。
 */
function parseArticleViewKey(viewKey: string) {
  const [sourceKey, filter = 'all'] = viewKey.split(ARTICLE_VIEW_KEY_SEPARATOR);

  return {
    sourceKey,
    filter: filter as FilterType,
  };
}

/**
 * 获取订阅源视图键在侧边栏阅读区中的相对位置。
 */
function getArticleSourcePosition(sourceKey: string, feedOrder: string[]) {
  const index = feedOrder.indexOf(sourceKey);
  return index === -1 ? feedOrder.length : index;
}

/**
 * 获取筛选条件在顶部标签中的相对位置。
 */
function getArticleFilterPosition(filter: FilterType) {
  const index = ARTICLE_FILTER_ORDER.indexOf(filter);
  return index === -1 ? 0 : index;
}

/**
 * 根据订阅源顺序和顶部筛选顺序判断列表切换动画方向。
 */
function getArticleListTransitionDirection(
  previousViewKey: string,
  nextViewKey: string,
  feedOrder: string[]
): ArticleListTransitionDirection {
  const previousView = parseArticleViewKey(previousViewKey);
  const nextView = parseArticleViewKey(nextViewKey);
  const previousSourcePosition = getArticleSourcePosition(
    previousView.sourceKey,
    feedOrder
  );
  const nextSourcePosition = getArticleSourcePosition(nextView.sourceKey, feedOrder);

  if (nextSourcePosition !== previousSourcePosition) {
    return nextSourcePosition >= previousSourcePosition ? 'forward' : 'backward';
  }

  return getArticleFilterPosition(nextView.filter) >=
    getArticleFilterPosition(previousView.filter)
    ? 'forward'
    : 'backward';
}

/**
 * 渲染文章列表，并在切换订阅源时展示横向渐变过渡。
 */
export function ArticleList() {
  const {
    articles,
    loading,
    selectedArticle,
    selectedFeedId,
    filter,
    setSelectedArticle,
    markFeedAsRead,
    loadArticles,
  } = useArticleStore();
  const { feeds, refreshingFeedIds, refreshFeed } = useFeedStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [markFeedConfirmOpen, setMarkFeedConfirmOpen] = useState(false);
  const [displayedArticles, setDisplayedArticles] = useState<Article[]>(articles);
  const [transitionStage, setTransitionStage] =
    useState<ArticleListTransitionStage>('idle');
  const [transitionDirection, setTransitionDirection] =
    useState<ArticleListTransitionDirection>('forward');
  const [transitionReadyToSwap, setTransitionReadyToSwap] = useState(false);
  const [visibleArticleCount, setVisibleArticleCount] = useState(ARTICLE_PAGE_SIZE);

  const feedMap = new Map(feeds.map((f) => [f.id, f]));
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId);
  const isRefreshingSelectedFeed = selectedFeed
    ? refreshingFeedIds.includes(selectedFeed.id)
    : false;
  const articleViewKey = getArticleViewKey(selectedFeedId, filter);
  const feedOrder = useMemo(
    () => [
      STARRED_ARTICLES_VIEW_KEY,
      ALL_ARTICLES_VIEW_KEY,
      ...feeds.map((feed) => feed.id),
    ],
    [feeds]
  );
  const latestArticlesRef = useRef(articles);
  const previousViewKeyRef = useRef(articleViewKey);
  const pendingViewKeyRef = useRef(articleViewKey);
  const exitTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const visibleArticles = useMemo(
    () => displayedArticles.slice(0, visibleArticleCount),
    [displayedArticles, visibleArticleCount]
  );
  const hasMoreArticles = visibleArticleCount < displayedArticles.length;

  /**
   * 追加下一批文章卡片的渲染数量。
   */
  const loadMoreArticles = useCallback(() => {
    setVisibleArticleCount((count) =>
      Math.min(count + ARTICLE_PAGE_SIZE, displayedArticles.length)
    );
  }, [displayedArticles.length]);

  /**
   * 将文章列表滚动位置重置到顶部。
   */
  const scrollArticleListToTop = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    );
    viewport?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    latestArticlesRef.current = articles;
  }, [articles]);

  useEffect(() => {
    const previousViewKey = previousViewKeyRef.current;

    if (previousViewKey === articleViewKey) return;

    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);

    pendingViewKeyRef.current = articleViewKey;
    previousViewKeyRef.current = articleViewKey;
    scrollArticleListToTop();
    setTransitionReadyToSwap(false);
    setTransitionDirection(
      getArticleListTransitionDirection(previousViewKey, articleViewKey, feedOrder)
    );
    setTransitionStage('leaving');

    exitTimerRef.current = window.setTimeout(() => {
      setTransitionReadyToSwap(true);
    }, ARTICLE_LIST_EXIT_MS);
  }, [articleViewKey, feedOrder, scrollArticleListToTop]);

  useEffect(() => {
    if (!transitionReadyToSwap || loading || pendingViewKeyRef.current !== articleViewKey) {
      return;
    }

    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);

    setDisplayedArticles(latestArticlesRef.current);
    setVisibleArticleCount(ARTICLE_PAGE_SIZE);
    requestAnimationFrame(scrollArticleListToTop);
    setTransitionReadyToSwap(false);
    setTransitionStage('entering');

    enterTimerRef.current = window.setTimeout(() => {
      if (pendingViewKeyRef.current === articleViewKey) {
        setTransitionStage('idle');
      }
    }, ARTICLE_LIST_ENTER_MS);
  }, [articleViewKey, articles, loading, scrollArticleListToTop, transitionReadyToSwap]);

  useEffect(() => {
    if (transitionStage !== 'idle' || pendingViewKeyRef.current !== articleViewKey) {
      return;
    }

    setDisplayedArticles(articles);
    setVisibleArticleCount((count) =>
      Math.min(Math.max(count, ARTICLE_PAGE_SIZE), articles.length)
    );
  }, [articleViewKey, articles, transitionStage]);

  useEffect(() => {
    if (!hasMoreArticles || transitionStage !== 'idle') return;

    const sentinel = loadMoreSentinelRef.current;
    const scrollRoot = sentinel?.closest('[data-radix-scroll-area-viewport]');
    if (!sentinel || !scrollRoot) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreArticles();
        }
      },
      {
        root: scrollRoot,
        rootMargin: ARTICLE_LOAD_MORE_ROOT_MARGIN,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreArticles, loadMoreArticles, transitionStage, visibleArticles.length]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
    };
  }, []);

  const transitionClassName = cn(
    'article-list-transition-layer',
    transitionStage !== 'idle' && 'article-list-transition-active',
    transitionStage === 'leaving' &&
      (transitionDirection === 'forward'
        ? 'article-list-transition-leave-forward'
        : 'article-list-transition-leave-backward'),
    transitionStage === 'entering' &&
      (transitionDirection === 'forward'
        ? 'article-list-transition-enter-forward'
        : 'article-list-transition-enter-backward')
  );

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
              disabled={isRefreshingSelectedFeed}
              ariaLabel={isRefreshingSelectedFeed ? '正在刷新本订阅源' : '刷新本订阅源'}
              tooltip={isRefreshingSelectedFeed ? '正在刷新本订阅源' : '刷新本订阅源'}
              tooltipAlign="end"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshingSelectedFeed && 'animate-spin')} />
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className={transitionClassName}>
          {displayedArticles.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">暂无文章</p>
                <p className="mt-1 text-sm">添加订阅开始阅读</p>
              </div>
            </div>
          ) : (
            <ScrollArea ref={scrollAreaRef} className="h-full w-full">
              <div className="w-full divide-y overflow-hidden">
                {visibleArticles.map((article) => {
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
                {hasMoreArticles && (
                  <div
                    ref={loadMoreSentinelRef}
                    className="h-10 border-t border-transparent"
                    aria-hidden="true"
                  />
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

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

/**
 * 渲染单篇文章在列表中的摘要卡片。
 */
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
        'flex cursor-pointer flex-col gap-1 pl-3 pr-4 py-3 transition-colors',
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
          <h3 className="text-base leading-snug line-clamp-2 font-normal text-foreground">
            {article.title}
          </h3>

          {/* Snippet */}
          {article.contentSnippet && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
              {article.contentSnippet}
            </p>
          )}

          {/* Meta */}
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
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
