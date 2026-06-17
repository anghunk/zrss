# ZRSS

一个简洁的浏览器扩展 RSS 阅读器，基于 WXT、React 和 IndexedDB 构建。

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

## 权限

- `alarms`: 定时刷新订阅源
- `activeTab` + `scripting`: 在用户打开弹窗时检测当前页面的 RSS 链接
- `<all_urls>`: 请求用户订阅的 Feed、WebDAV 地址和自定义 AI 接口

已避免使用未使用的 `storage` 权限，并移除长期 `tabs` 权限。

## 技术栈

- WXT
- React 19
- Tailwind CSS
- Zustand
- Dexie.js

## License

MIT
