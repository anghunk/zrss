import { useState, useEffect, useMemo } from 'react';
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { TooltipIconButton } from '@/components/common/TooltipIconButton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date';
import {
  CheckCircle,
  Circle,
  ExternalLink,
  FileText,
  Languages,
  Sparkles,
  Star,
} from 'lucide-react';
import { AIPanel } from '@/components/ai/AIPanel';
import { detectLanguage, extractTextForDetection } from '@/lib/ai/detect-language';
import { sanitizeHtml } from '@/utils/sanitize';

type ArticleViewMode = 'rss' | 'original';

interface OriginalArticleFrameProps {
  /** 文章 ID，用于在切换文章时重建原网页视图。 */
  articleId: string;
  /** iframe 的可访问标题。 */
  title: string;
  /** 原文链接。 */
  url: string;
}

/**
 * 渲染当前选中文章的阅读详情区域。
 */
export function ArticleDetail() {
  const { selectedArticle, toggleStarred, markAsRead, markAsUnread } = useArticleStore();
  const { feeds } = useFeedStore();

  const [translation, setTranslation] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [lang, setLang] = useState<'zh' | 'ja' | 'ko' | 'other'>('other');
  const [viewMode, setViewMode] = useState<ArticleViewMode>('rss');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiAvailable, setAIAvailable] = useState(false);
  const [analysisRequestKey, setAnalysisRequestKey] = useState(0);
  const [summaryAvailable, setSummaryAvailable] = useState(false);

  /**
   * 文章切换时重置翻译和阅读模式状态。
   */
  useEffect(() => {
    setTranslation(null);
    setShowTranslation(false);
    setViewMode('rss');
    setShowAIPanel(false);
    setAnalysisRequestKey(0);
    setSummaryAvailable(false);
    if (selectedArticle) {
      const text = extractTextForDetection(selectedArticle.content);
      setLang(detectLanguage(text));
    }
  }, [selectedArticle?.id]);

  const isForeign = lang !== 'zh';
  const hasTranslation = translation !== null;

  /**
   * 有摘要缓存的文章默认展开 AI 面板，但之后仍由顶部按钮自由切换。
   */
  useEffect(() => {
    if (summaryAvailable) {
      setShowAIPanel(true);
    }
  }, [summaryAvailable]);

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
  const isOriginalView = viewMode === 'original' && Boolean(article.link);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-11">
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
          {aiAvailable && !isOriginalView && (
            <TooltipIconButton
              className={showAIPanel && 'bg-accent text-accent-foreground'}
              onClick={() => {
                const nextVisible = !showAIPanel;
                setShowAIPanel(nextVisible);
                if (nextVisible) {
                  setAnalysisRequestKey((key) => key + 1);
                }
              }}
              ariaLabel={showAIPanel ? '收起 AI 分析' : 'AI 分析'}
              tooltip={showAIPanel ? '收起 AI 分析' : 'AI 分析'}
            >
              <Sparkles className="h-4 w-4" />
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
              className={isOriginalView && 'bg-accent text-accent-foreground'}
              onClick={() => setViewMode(isOriginalView ? 'rss' : 'original')}
              ariaLabel={isOriginalView ? '取消查看原网址' : '查看原网址'}
              tooltip={isOriginalView ? '取消查看原网址' : '查看原网址'}
            >
              <FileText className="h-4 w-4" />
            </TooltipIconButton>
          )}
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

      {isOriginalView ? (
        <div className="flex min-h-0 flex-1 flex-col border-t">
          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-6 py-2">
            <div className="min-w-0 text-xs text-muted-foreground">
              <span className="mr-1">原网址</span>
              <span className="select-text break-all">{article.link}</span>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 bg-background">
            <OriginalArticleFrame
              articleId={article.id}
              title={article.title}
              url={article.link}
            />
            <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
              如果网页空白或排版异常，通常是站点限制脚本或内嵌展示；可从右上角菜单选择“在浏览器打开”。
            </div>
          </div>
        </div>
      ) : (
        /* Content */
        <div className="flex-1 overflow-y-auto px-6 py-4 pb-20 select-text">
          {/* AI 面板 */}
          <AIPanel
            article={article}
            onTranslate={(html) => {
              setTranslation(html);
              setShowTranslation(true);
            }}
            translation={translation}
            setTranslation={setTranslation}
            visible={showAIPanel}
            analysisRequestKey={analysisRequestKey}
            onAvailabilityChange={setAIAvailable}
            onSummaryAvailabilityChange={setSummaryAvailable}
          />

          <article
            key={article.id}
            className="article-detail-enter prose prose-sm dark:prose-invert max-w-none"
          >
            <h1 className="text-2xl font-bold leading-tight mb-2">{article.title}</h1>
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
      )}
    </div>
  );
}

/**
 * 在详情页内展示原网址内容，优先抓取 HTML 后用 srcDoc 渲染，失败时回退到直接 iframe。
 */
function OriginalArticleFrame({ articleId, title, url }: OriginalArticleFrameProps) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * 切换文章或原文链接时重新获取原网页 HTML。
   */
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    /**
     * 通过扩展页面的跨域权限获取原网页 HTML。
     */
    async function loadOriginalHtml() {
      setLoading(true);
      setLoadError(null);
      setSrcDoc(null);

      try {
        const response = await fetch(url, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        if (contentType && !contentType.includes('html') && !contentType.includes('text/')) {
          throw new Error('原网址返回的不是 HTML 内容');
        }

        const html = await response.text();
        if (!cancelled) {
          setSrcDoc(buildOriginalArticleSrcDoc(html, response.url || url));
        }
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          console.warn('[ZRSS] load original article failed:', error);
          setLoadError('无法获取原网页内容，正在尝试直接加载原网址。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOriginalHtml();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [articleId, url]);

  return (
    <>
      <iframe
        key={`${articleId}:${url}:${srcDoc ? 'srcdoc' : 'direct'}`}
        src={srcDoc ? undefined : url}
        srcDoc={srcDoc ?? undefined}
        title={`原网页: ${title}`}
        className="h-full w-full border-0 bg-background"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts"
      />
      {(loading || loadError) && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          {loading ? '正在获取原网页内容…' : loadError}
        </div>
      )}
    </>
  );
}

/**
 * 为原网页 HTML 注入 base 标签，让相对路径资源可以在 srcDoc 中正常解析。
 */
function buildOriginalArticleSrcDoc(html: string, url: string) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cspMetas = doc.querySelectorAll(
      'meta[http-equiv="content-security-policy" i]'
    );

    cspMetas.forEach((meta) => meta.remove());

    const base = doc.createElement('base');
    base.href = url;

    const existingBase = doc.head.querySelector('base');
    if (existingBase) {
      existingBase.replaceWith(base);
    } else {
      doc.head.prepend(base);
    }

    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  } catch {
    return `<!doctype html>\n<base href="${url}">\n${html}`;
  }
}
