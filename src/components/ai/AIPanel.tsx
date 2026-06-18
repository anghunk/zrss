import { useState, useEffect, useRef } from 'react';
import type { Article } from '@/types';
import type { AIProviderConfig } from '@/types/ai';
import { getSettings, getAICache, setAICache } from '@/lib/db';
import { chatStream, AIError } from '@/lib/ai/client';
import { buildSummaryPrompt, buildTranslatePrompt } from '@/lib/ai/prompts';
import { Button } from '@/components/ui/button';
import { Sparkles, Languages, RefreshCw, RotateCcw, Lightbulb } from 'lucide-react';

interface SummaryData {
  tldr: string;
  keyPoints: string[];
}

interface AIPanelProps {
  article: Article;
  onTranslate: (translation: string) => void;
  translation: string | null;
  setTranslation: (translation: string | null) => void;
  /** 是否展示 AI 面板内容，隐藏时仍保留内部缓存和自动摘要逻辑。 */
  visible?: boolean;
  /** 外部触发 AI 分析的计数器，每次变化时尝试生成摘要。 */
  analysisRequestKey?: number;
  /** AI 配置可用性变化时通知父组件，用于控制工具栏入口显示。 */
  onAvailabilityChange?: (available: boolean) => void;
  /** 摘要内容可用性变化时通知父组件，用于决定是否默认展开面板。 */
  onSummaryAvailabilityChange?: (available: boolean) => void;
}

// 解析摘要 JSON，失败时返回 null
function parseSummary(raw: string): SummaryData | null {
  try {
    // 尝试直接解析
    const data = JSON.parse(raw);
    if (data.tldr && Array.isArray(data.keyPoints)) {
      return data as SummaryData;
    }
  } catch {
    // 尝试从 markdown 代码块中提取 JSON
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        if (data.tldr && Array.isArray(data.keyPoints)) {
          return data as SummaryData;
        }
      } catch {
        // ignore
      }
    }
    // 尝试提取 JSON 部分
    const jsonMatch = raw.match(/\{[\s\S]*"tldr"[\s\S]*"keyPoints"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        if (data.tldr && Array.isArray(data.keyPoints)) {
          return data as SummaryData;
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function AIPanel({
  article,
  onTranslate,
  translation,
  setTranslation,
  visible = true,
  analysisRequestKey = 0,
  onAvailabilityChange,
  onSummaryAvailabilityChange,
}: AIPanelProps) {
  const [summaryRaw, setSummaryRaw] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AIProviderConfig | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载 AI 配置
  useEffect(() => {
    const loadConfig = async () => {
      const settings = await getSettings();

      setAiEnabled(settings.aiEnabled);
      setAutoSummarize(settings.aiAutoSummarize);

      if (settings.activeProviderId) {
        const config = settings.aiProviders[settings.activeProviderId];
        setAiConfig(config || null);
      } else {
        setAiConfig(null);
      }
    };
    loadConfig();
  }, []);

  /**
   * 将 AI 功能是否可用同步给父组件。
   */
  useEffect(() => {
    onAvailabilityChange?.(Boolean(aiEnabled && aiConfig));
  }, [aiEnabled, aiConfig, onAvailabilityChange]);

  /**
   * 将当前文章是否已有摘要同步给父组件。
   */
  useEffect(() => {
    onSummaryAvailabilityChange?.(Boolean(summaryRaw || summary));
  }, [summaryRaw, summary, onSummaryAvailabilityChange]);

  // 当文章变化时，取消正在进行的请求并从缓存加载
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSummaryRaw(null);
    setSummary(null);
    setTranslation(null);
    setError(null);

    // 自动从缓存加载摘要；开启自动摘要时自动触发生成
    if (aiEnabled && aiConfig) {
      getAICache(article.id, 'summary').then((cached) => {
        if (cached) {
          setSummaryRaw(cached.result);
          const parsed = parseSummary(cached.result);
          if (parsed) {
            setSummary(parsed);
          }
        } else if (autoSummarize) {
          generateSummary(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, setTranslation, aiEnabled, aiConfig, autoSummarize]);

  // 生成摘要
  const generateSummary = async (forceRefresh = false) => {
    if (!aiEnabled || !aiConfig) return;

    // 检查缓存
    if (!forceRefresh) {
      const cached = await getAICache(article.id, 'summary');
      if (cached) {
        setSummaryRaw(cached.result);
        const parsed = parseSummary(cached.result);
        if (parsed) {
          setSummary(parsed);
        }
        return;
      }
    }

    setSummaryLoading(true);
    setSummaryRaw(null);
    setSummary(null);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const prompt = buildSummaryPrompt(article.title, article.content);
      let fullResponse = '';

      await chatStream(
        [{ role: 'user', content: prompt }],
        aiConfig,
        (chunk) => {
          fullResponse += chunk;
          setSummaryRaw(fullResponse);
          // 尝试实时解析（可能在流式过程中就形成有效 JSON）
          const parsed = parseSummary(fullResponse);
          if (parsed) {
            setSummary(parsed);
          }
        },
        abortController.signal
      );

      // 最终解析
      const parsed = parseSummary(fullResponse);
      if (parsed) {
        setSummary(parsed);
      }

      // 保存到缓存
      await setAICache(article.id, 'summary', fullResponse, aiConfig.currentModel);
    } catch (err) {
      if (err instanceof AIError && err.code !== 'aborted') {
        setError(err.message);
      }
    } finally {
      setSummaryLoading(false);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  // 翻译文章
  const translateArticle = async () => {
    if (!aiEnabled || !aiConfig) return;

    // 如果已有翻译，切换显示
    if (translation) {
      return;
    }

    // 检查缓存
    const cached = await getAICache(article.id, 'translate');
    if (cached) {
      setTranslation(cached.result);
      onTranslate(cached.result);
      return;
    }

    setTranslateLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const prompt = buildTranslatePrompt(article.content);
      let fullResponse = '';

      await chatStream(
        [{ role: 'user', content: prompt }],
        aiConfig,
        (chunk) => {
          fullResponse += chunk;
        },
        abortController.signal
      );

      setTranslation(fullResponse);
      onTranslate(fullResponse);

      // 保存到缓存
      await setAICache(article.id, 'translate', fullResponse, aiConfig.currentModel);
    } catch (err) {
      if (err instanceof AIError && err.code !== 'aborted') {
        setError(err.message);
      }
    } finally {
      setTranslateLoading(false);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  /**
   * 从详情页工具栏打开 AI 面板时，自动开始生成摘要。
   */
  useEffect(() => {
    if (
      !visible ||
      analysisRequestKey === 0 ||
      summaryRaw ||
      summaryLoading ||
      translateLoading
    ) {
      return;
    }

    generateSummary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisRequestKey, visible]);

  // 如果 AI 功能未启用或没有配置，不显示面板
  if (!aiEnabled || !aiConfig) {
    return null;
  }

  if (!visible) {
    return null;
  }

  // 检测是否为外文（简单判断：包含非中文字符比例较高）
  const isForeign = /[\u4e00-\u9fa5]/.test(article.title)
    ? false
    : /[a-zA-Z]{3,}/.test(article.title);

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI 分析</span>
        </div>

        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {/* 摘要按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateSummary(true)}
            disabled={summaryLoading || translateLoading}
            className="gap-1"
          >
            {summaryLoading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                生成中...
              </>
            ) : summary ? (
              <>
                <RotateCcw className="h-3 w-3" />
                重新摘要
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                生成摘要
              </>
            )}
          </Button>

          {/* 翻译按钮（仅外文显示） */}
          {isForeign && (
            <Button
              variant="outline"
              size="sm"
              onClick={translateArticle}
              disabled={translateLoading || summaryLoading}
              className="gap-1"
            >
              {translateLoading ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  翻译中...
                </>
              ) : translation ? (
                <>
                  <Languages className="h-3 w-3" />
                  已翻译
                </>
              ) : (
                <>
                  <Languages className="h-3 w-3" />
                  翻译全文
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* 摘要显示 */}
      {summaryRaw && !summary && (
        <div className="mt-3 p-3 rounded-lg bg-background border text-sm">
          <div className="whitespace-pre-wrap text-muted-foreground">{summaryRaw}</div>
        </div>
      )}

      {summary && (
        <div className="mt-3 p-3 rounded-lg bg-background border space-y-3">
          {/* TL;DR */}
          <div className="flex gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Lightbulb className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm leading-relaxed">{summary.tldr}</p>
            </div>
          </div>

          {/* 要点 */}
          {summary.keyPoints.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">要点</div>
              <ul className="space-y-1.5">
                {summary.keyPoints.map((point, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                      {index + 1}
                    </span>
                    <span className="flex-1 leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
