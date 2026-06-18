import { useEffect, useState } from 'react';
import { Rss, Loader2, Plus, ExternalLink, Check, Trash2 } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { detectFeedsInTab, type DetectedFeed } from '@/lib/rss-detector';
import { db } from '@/lib/db';
import { deleteFeed } from '@/lib/feed-fetcher';
import { requestFetchFeeds } from '@/lib/feed-refresh';

type Status = 'loading' | 'found' | 'empty' | 'error';

export function PopupApp() {
  const [status, setStatus] = useState<Status>('loading');
  const [feeds, setFeeds] = useState<DetectedFeed[]>([]);
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    void requestFetchFeeds();
    detect();
  }, []);

  async function detect() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) {
        setStatus('empty');
        return;
      }

      const detected = await detectFeedsInTab(tab.id, tab.url);
      if (detected.length > 0) {
        setFeeds(detected);
        // 检查哪些已订阅
        const urls = new Set<string>();
        for (const feed of detected) {
          const existing = await db.feeds.where('url').equals(feed.url).first();
          if (existing) urls.add(feed.url);
        }
        setSubscribedUrls(urls);
        setStatus('found');
      } else {
        setFeeds([]);
        setSubscribedUrls(new Set());
        setStatus('empty');
      }
    } catch (err) {
      console.error('[ZRSS popup] detect failed:', err);
      setErrorMsg(err instanceof Error ? err.message : '检测失败');
      setStatus('error');
    }
  }

  /**
   * 跳转到扩展阅读器，打开添加订阅对话框并预填 URL。
   */
  async function handleSubscribe(feed: DetectedFeed) {
    setSubscribing(feed.url);
    try {
      const addParam = encodeURIComponent(feed.url);
      const targetUrl = `${browser.runtime.getURL('/reader.html')}#/subscriptions?add=${addParam}`;
      await browser.tabs.create({ url: targetUrl });
      window.close();
    } finally {
      setSubscribing(null);
    }
  }

  /**
   * 取消订阅并级联删除该订阅源下的文章。
   */
  async function handleUnsubscribe(feed: DetectedFeed) {
    try {
      const existing = await db.feeds.where('url').equals(feed.url).first();
      if (existing) {
        await deleteFeed(existing.id);
        // 更新已订阅列表
        setSubscribedUrls((prev) => {
          const next = new Set(prev);
          next.delete(feed.url);
          return next;
        });
      }
    } catch (err) {
      console.error('[ZRSS popup] unsubscribe failed:', err);
    }
  }

  /**
   * 打开阅读器首页。
   */
  async function openReader() {
    const readerUrl = browser.runtime.getURL('/reader.html');
    await browser.tabs.create({ url: readerUrl });
    window.close();
  }

  return (
    <div className="w-72 bg-background p-3 text-foreground">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <img src={logoImg} alt="ZRSS" className="h-5 w-5" />
        <span className="font-semibold text-sm">ZRSS</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          当前页面 RSS
        </span>
      </div>

      {/* 顶部操作 */}
      <div className="flex gap-2 mb-3">
        <button
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
          onClick={openReader}
        >
          <ExternalLink className="h-3 w-3" />
          打开阅读器
        </button>
        <button
          className="inline-flex items-center justify-center rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
          onClick={detect}
          disabled={status === 'loading'}
        >
          <Loader2 className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 检测中的状态 */}
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">正在检测页面 RSS…</span>
        </div>
      )}

      {/* 检测到 feeds */}
      {status === 'found' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {feeds.map((feed) => {
            const isBusy = subscribing === feed.url;
            const isSubscribed = subscribedUrls.has(feed.url);
            const typeLabel =
              feed.type === 'rss' ? 'RSS' :
              feed.type === 'atom' ? 'Atom' :
              feed.type === 'json' ? 'JSON' : 'Feed';
            return (
              <div
                key={feed.url}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <Rss className="h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">
                    {feed.title || '未命名订阅'}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {feed.url}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                  {typeLabel}
                </span>
                {isSubscribed ? (
                  <div className="shrink-0 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <button
                      className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleUnsubscribe(feed)}
                      title="取消订阅"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    onClick={() => handleSubscribe(feed)}
                    disabled={!!subscribing}
                  >
                    {isBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    订阅
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 没有检测到 */}
      {status === 'empty' && (
        <div className="rounded-md border border-dashed px-3 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            当前页面没有检测到 RSS 订阅。
          </p>
        </div>
      )}

      {/* 出错 */}
      {status === 'error' && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-4 text-center">
          <p className="text-xs text-destructive">
            检测失败：{errorMsg || '未知错误'}
          </p>
        </div>
      )}
    </div>
  );
}
