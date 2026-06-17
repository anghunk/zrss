import type { ParsedFeed, ParsedFeedItem } from '@/types';
import { extractSnippet } from '@/utils/sanitize';

// 解析 RSS/Atom feed
export function parseFeed(xmlText: string): ParsedFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // 检查解析错误
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  // 判断是 RSS 还是 Atom
  const isAtom = doc.documentElement.tagName.toLowerCase() === 'feed';

  if (isAtom) {
    return parseAtom(doc);
  } else {
    return parseRSS(doc);
  }
}

// 解析 RSS 2.0
function parseRSS(doc: Document): ParsedFeed {
  const channel = doc.getElementsByTagName('channel')[0];
  if (!channel) {
    throw new Error('Invalid RSS: no channel element found');
  }

  const title = getTagText(channel, 'title') || 'Untitled Feed';
  const description = getTagText(channel, 'description') || '';
  const link = getTagText(channel, 'link') || '';
  // RSS 2.0: <channel><image><url>
  const image = getTagText(channel, 'image > url') || '';

  const items: ParsedFeedItem[] = [];
  const itemElements = Array.from(channel.getElementsByTagName('item'));

  itemElements.forEach((item) => {
    const guid = getTagText(item, 'guid') || getTagText(item, 'link') || '';
    const itemTitle = getTagText(item, 'title') || 'Untitled';
    const itemLink = getTagText(item, 'link') || '';
    const content = getTagText(item, 'content:encoded') ||
                    getTagText(item, 'description') || '';
    const author = getTagText(item, 'author') ||
                   getTagText(item, 'dc:creator') || '';

    // 解析日期
    const pubDateStr = getTagText(item, 'pubDate') ||
                       getTagText(item, 'dc:date') || '';
    const publishedAt = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();

    if (guid) {
      items.push({
        guid,
        title: decodeHtml(itemTitle),
        link: itemLink,
        content,
        contentSnippet: extractSnippet(content),
        author: decodeHtml(author),
        publishedAt: isNaN(publishedAt) ? Date.now() : publishedAt,
      });
    }
  });

  return {
    title: decodeHtml(title),
    description: decodeHtml(description),
    link,
    image,
    items,
  };
}

// 解析 Atom
function parseAtom(doc: Document): ParsedFeed {
  const title = getTagText(doc.documentElement, 'title') || 'Untitled Feed';
  const subtitle = getTagText(doc.documentElement, 'subtitle') || '';

  // 获取链接 - 按 localName 查找 link 标签
  const feedLink = findAtomLink(doc.documentElement);

  // Atom: <logo> 优先, 其次 <icon>
  const image =
    getTagText(doc.documentElement, 'logo') ||
    getTagText(doc.documentElement, 'icon') || '';

  const items: ParsedFeedItem[] = [];
  const entries = doc.getElementsByTagName('entry');

  Array.from(entries).forEach((entry) => {
    const guid = getTagText(entry, 'id') || '';
    const entryTitle = getTagText(entry, 'title') || 'Untitled';

    // Atom 链接
    const entryLink = findAtomLink(entry);

    // 内容
    const content = getTagText(entry, 'content') ||
                    getTagText(entry, 'summary') || '';
    const author = getTagText(entry, 'author > name') || '';

    // 日期
    const dateStr = getTagText(entry, 'updated') ||
                    getTagText(entry, 'published') || '';
    const publishedAt = dateStr ? new Date(dateStr).getTime() : Date.now();

    if (guid) {
      items.push({
        guid,
        title: decodeHtml(entryTitle),
        link: entryLink,
        content,
        contentSnippet: extractSnippet(content),
        author: decodeHtml(author),
        publishedAt: isNaN(publishedAt) ? Date.now() : publishedAt,
      });
    }
  });

  return {
    title: decodeHtml(title),
    description: decodeHtml(subtitle),
    link: feedLink,
    image,
    items,
  };
}

// 获取标签文本内容
function getTagText(parent: Element | Document, selector: string): string {
  const root = parent instanceof Document ? parent.documentElement : parent;
  if (!root) return '';

  // 处理后代选择器，如 'author > name'
  const parts = selector.split(' > ');

  let current: Element | null = root;
  for (const part of parts) {
    if (!current) return '';
    current = findChildByLocalName(current, part);
  }

  return current?.textContent?.trim() || '';
}

// 按 localName 查找第一个直接子元素，跳过命名空间前缀
function findChildByLocalName(parent: Element, localName: string): Element | null {
  // 如果 localName 带命名空间前缀（如 content:encoded），只取最后一段
  const name = localName.includes(':') ? localName.split(':').pop()! : localName;

  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === name) {
      return children[i];
    }
  }
  return null;
}

// 查找 Atom link 标签的 href 属性
function findAtomLink(parent: Element): string {
  const links = parent.getElementsByTagName('link');
  // 优先查找 rel="alternate" 的链接
  for (let i = 0; i < links.length; i++) {
    const rel = links[i].getAttribute('rel');
    if (rel === 'alternate' || !rel) {
      return links[i].getAttribute('href') || '';
    }
  }
  // 如果没找到，返回第一个 link 的 href
  return links.length > 0 ? links[0].getAttribute('href') || '' : '';
}

// 解码 HTML 实体
function decodeHtml(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
