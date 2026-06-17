import { db } from './db';
import { nanoid } from 'nanoid';
import type { Feed, Folder } from '@/types';

// 导出为 OPML 格式
export async function exportToOPML(): Promise<string> {
  const feeds = await db.feeds.toArray();
  const folders = await db.folders.toArray();

  const feedsByFolder = feeds.reduce(
    (acc, feed) => {
      const key = feed.folderId || '__root__';
      if (!acc[key]) acc[key] = [];
      acc[key].push(feed);
      return acc;
    },
    {} as Record<string, Feed[]>
  );

  const escapeXml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>ZRSS Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
`;

  // 导出没有分组的 feeds
  const rootFeeds = feedsByFolder['__root__'] || [];
  rootFeeds.forEach((feed) => {
    opml += `    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl)}" />\n`;
  });

  // 导出分组和 feeds
  folders.forEach((folder) => {
    const folderFeeds = feedsByFolder[folder.id] || [];
    opml += `    <outline text="${escapeXml(folder.name)}">\n`;
    folderFeeds.forEach((feed) => {
      opml += `      <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl)}" />\n`;
    });
    opml += `    </outline>\n`;
  });

  opml += `  </body>
</opml>`;

  return opml;
}

// 从 OPML 导入
export async function importFromOPML(opmlText: string): Promise<{ added: number; errors: string[] }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opmlText, 'text/xml');

  const added: string[] = [];
  const errors: string[] = [];

  // 解析 outlines
  const outlines = doc.querySelectorAll('body > outline');

  const processOutline = async (outline: Element, folderId: string | null = null) => {
    const xmlUrl = outline.getAttribute('xmlUrl');
    const title = outline.getAttribute('text') || outline.getAttribute('title') || '';

    if (xmlUrl) {
      // 这是一个 feed
      try {
        // 检查是否已存在
        const existing = await db.feeds.where('url').equals(xmlUrl).first();
        if (existing) {
          console.log(`Feed already exists: ${xmlUrl}`);
          return;
        }

        const now = Date.now();
        const feedId = nanoid();

        const feed: Feed = {
          id: feedId,
          url: xmlUrl,
          title: title || xmlUrl,
          description: outline.getAttribute('description') || '',
          siteUrl: outline.getAttribute('htmlUrl') || '',
          // 优先采用 OPML 中声明的 iconUrl; 其余在下次刷新时由 fetchFeed 解析
          favicon: outline.getAttribute('iconUrl') || '',
          folderId,
          sortOrder: await db.feeds.count(),
          lastFetchedAt: 0,
          unreadCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        await db.feeds.add(feed);
        added.push(feed.title);
      } catch (err) {
        errors.push(`Failed to add ${title}: ${err}`);
      }
    } else {
      // 这是一个文件夹
      const folderName = title;
      if (folderName) {
        const folder: Folder = {
          id: nanoid(),
          name: folderName,
          sortOrder: await db.folders.count(),
          createdAt: Date.now(),
        };

        // 检查是否已存在同名文件夹
        const existingFolder = await db.folders.where('name').equals(folderName).first();
        if (existingFolder) {
          await processChildren(outline, existingFolder.id);
        } else {
          await db.folders.add(folder);
          await processChildren(outline, folder.id);
        }
      }
    }
  };

  const processChildren = async (parent: Element, folderId: string | null) => {
    const children = parent.querySelectorAll(':scope > outline');
    for (const child of Array.from(children)) {
      await processOutline(child, folderId);
    }
  };

  for (const outline of Array.from(outlines)) {
    await processOutline(outline);
  }

  return { added: added.length, errors };
}
