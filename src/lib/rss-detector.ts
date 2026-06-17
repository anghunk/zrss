// 在当前页面中扫描 <link rel="alternate"> 发现 RSS/Atom/JSON Feed。
// 如果页面没有声明，再尝试一些常见的 feed 路径作为兜底。

export interface DetectedFeed {
  url: string;
  title: string;
  type: 'rss' | 'atom' | 'json' | 'unknown';
}

// 注入到页面执行的脚本。必须是一个独立函数，无法访问外部作用域。
function detectLinksInPage(): DetectedFeed[] {
  const mimeToType: Record<string, DetectedFeed['type']> = {
    'application/rss+xml': 'rss',
    'application/atom+xml': 'atom',
    'application/feed+json': 'json',
    'application/xml': 'unknown',
    'text/xml': 'unknown',
  };

  const seen = new Set<string>();
  const results: DetectedFeed[] = [];

  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]');
  links.forEach((link) => {
    const type = (link.getAttribute('type') || '').toLowerCase();
    const href = link.href;
    if (!href || seen.has(href)) return;
    const feedType = mimeToType[type];
    if (!feedType) return;
    seen.add(href);
    results.push({
      url: href,
      title: link.getAttribute('title') || '',
      type: feedType,
    });
  });

  return results;
}

// 尝试若干常见 feed 路径，用 HEAD 请求判断是否存在。
async function probeCommonPaths(pageUrl: string): Promise<DetectedFeed[]> {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }

  // 只探测 http(s)
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return [];

  // 常见的 feed 路径
  const candidates = [
    '/feed',
    '/feed/',
    '/rss',
    '/rss/',
    '/rss.xml',
    '/feed.xml',
    '/atom.xml',
    '/index.xml',
    '/feeds/posts/default',
    '/?feed=rss2',
    '/?feed=atom',
    '/feed/rss',
    '/feed/atom',
  ];

  const origin = base.origin;
  const results: DetectedFeed[] = [];

  // 并发探测，限制数量
  const tasks = candidates.map(async (path) => {
    const target = new URL(path, origin).toString();
    try {
      const res = await fetch(target, { method: 'HEAD', redirect: 'follow' });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      // 判断是否为 feed 类型
      const isFeed =
        contentType.includes('application/rss+xml') ||
        contentType.includes('application/atom+xml') ||
        contentType.includes('application/feed+json') ||
        contentType.includes('application/xml') ||
        contentType.includes('text/xml');
      if (!isFeed) return null;

      let type: DetectedFeed['type'] = 'unknown';
      if (contentType.includes('rss')) type = 'rss';
      else if (contentType.includes('atom')) type = 'atom';
      else if (contentType.includes('feed+json')) type = 'json';

      return { url: target, title: '', type } as DetectedFeed;
    } catch {
      return null;
    }
  });

  const settled = await Promise.all(tasks);
  for (const r of settled) {
    if (r) results.push(r);
  }

  return results;
}

export async function detectFeedsInTab(tabId: number): Promise<DetectedFeed[]> {
  // 通过 content script 在页面内扫描 <link rel="alternate">
  let fromPage: DetectedFeed[] = [];
  try {
    const injections = await browser.scripting.executeScript({
      target: { tabId },
      func: detectLinksInPage,
    });
    for (const r of injections || []) {
      if (Array.isArray(r.result)) {
        fromPage = fromPage.concat(r.result as DetectedFeed[]);
      }
    }
  } catch (err) {
    // 某些页面（chrome://、扩展页等）无法注入脚本，直接忽略
    console.warn('[ZRSS] detectFeedsInTab inject failed:', err);
  }

  if (fromPage.length > 0) {
    return dedupe(fromPage);
  }

  // 兜底：探测常见路径
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.url) {
      const probed = await probeCommonPaths(tab.url);
      if (probed.length > 0) return dedupe(probed);
    }
  } catch {
    // ignore
  }

  return [];
}

function dedupe(feeds: DetectedFeed[]): DetectedFeed[] {
  const seen = new Set<string>();
  const out: DetectedFeed[] = [];
  for (const f of feeds) {
    const key = f.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
