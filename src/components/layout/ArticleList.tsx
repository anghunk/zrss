import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import { Circle, Star, ExternalLink } from 'lucide-react';
import type { Article } from '@/types';

export function ArticleList() {
  const { articles, selectedArticle, setSelectedArticle } = useArticleStore();
  const { feeds } = useFeedStore();

  const feedMap = new Map(feeds.map((f) => [f.id, f]));

  if (articles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">暂无文章</p>
          <p className="mt-1 text-sm">添加订阅开始阅读</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
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
