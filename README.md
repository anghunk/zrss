# ZRSS

界面简洁的现代 RSS 阅读器（浏览器扩展）。

<img width="1392" height="954" alt="image" src="https://github.com/user-attachments/assets/bd282f96-9de8-4a63-96ab-a95dfb8e8310" />

## 功能

- 订阅 RSS / Atom / JSON Feed
- 自动刷新、未读管理、星标收藏和全文搜索
- 文件夹分组、OPML 导入导出
- 文章详情阅读、AI 摘要和全文翻译
- 暗色模式、WebDAV 备份与恢复

## 开发

```bash
npm install --include=dev
npm run dev
```

在 Chrome 中打开 `chrome://extensions/`，启用开发者模式，加载 `.output/chrome-mv3`。

## 构建

```bash
npm run build
npm run zip
```

Firefox:

```bash
npm run build:firefox
npm run zip:firefox
```

## 技术栈

- WXT
- React 19
- Tailwind CSS
- Zustand
- Dexie.js

## LICENSE

[Apache-2.0](./LICENSE)
