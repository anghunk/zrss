import { useState, useEffect, useMemo } from 'react';
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { TooltipIconButton } from '@/components/common/TooltipIconButton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import { Star, ExternalLink, CheckCircle, Circle, Languages } from 'lucide-react';
import { AIPanel } from '@/components/ai/AIPanel';
import { detectLanguage, extractTextForDetection } from '@/lib/ai/detect-language';
import { sanitizeHtml } from '@/utils/sanitize';

export function ArticleDetail() {
  const { selectedArticle, toggleStarred, markAsRead, markAsUnread } = useArticleStore();
  const { feeds } = useFeedStore();

  const [translation, setTranslation] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [lang, setLang] = useState<'zh' | 'ja' | 'ko' | 'other'>('other');

  // 文章切换时重置翻译状态
  useEffect(() => {
    setTranslation(null);
    setShowTranslation(false);
    if (selectedArticle) {
      const text = extractTextForDetection(selectedArticle.content);
      setLang(detectLanguage(text));
    }
  }, [selectedArticle?.id]);

  const isForeign = lang !== 'zh';
  const hasTranslation = translation !== null;

  const displayContent = useMemo(() => {
    if (!selectedArticle) return '';
    return sanitizeHtml(
      showTranslation && translation ? translation : selectedArticle.content
    );
  }, [selectedArticle, showTranslation, translation]);

  if (!selectedArticle) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">选择文章开始阅读</p>
        </div>
      </div>
    );
  }

  const feed = feeds.find((f) => f.id === selectedArticle.feedId);
  const article = selectedArticle;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {feed?.favicon && (
            <img src={feed.favicon} alt="" className="h-4 w-4 rounded-sm" />
          )}
          <span>{feed?.title || '未知来源'}</span>
          <span>·</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 翻译切换按钮 (仅外文且有翻译时显示) */}
          {isForeign && hasTranslation && (
            <TooltipIconButton
              className={showTranslation && 'bg-accent text-accent-foreground'}
              onClick={() => setShowTranslation(!showTranslation)}
              ariaLabel={showTranslation ? '显示原文' : '显示译文'}
              tooltip={showTranslation ? '显示原文' : '显示译文'}
            >
              <Languages className="h-4 w-4" />
            </TooltipIconButton>
          )}
          <TooltipIconButton
            onClick={() => toggleStarred(article.id)}
            ariaLabel={article.isStarred ? '取消星标' : '添加星标'}
            tooltip={article.isStarred ? '取消星标' : '添加星标'}
          >
            <Star
              className={cn(
                'h-4 w-4',
                article.isStarred && 'fill-amber-500 text-amber-500'
              )}
            />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={() =>
              article.isRead ? markAsUnread(article.id) : markAsRead(article.id)
            }
            ariaLabel={article.isRead ? '标记为未读' : '标记为已读'}
            tooltip={article.isRead ? '标记为未读' : '标记为已读'}
          >
            {article.isRead ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </TooltipIconButton>
          {article.link && (
            <TooltipIconButton
              onClick={() => window.open(article.link, '_blank')}
              ariaLabel="打开原文"
              tooltip="打开原文"
            >
              <ExternalLink className="h-4 w-4" />
            </TooltipIconButton>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 select-text">
        {/* AI 面板 */}
        <AIPanel
          article={article}
          onTranslate={(html) => {
            setTranslation(html);
            setShowTranslation(true);
          }}
          translation={translation}
          setTranslation={setTranslation}
        />

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1 className="text-xl font-bold leading-tight mb-2">{article.title}</h1>
          {article.author && (
            <p className="text-sm text-muted-foreground mb-4 not-prose">
              作者: {article.author}
            </p>
          )}
          <div
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
        </article>
      </div>
    </div>
  );
}
