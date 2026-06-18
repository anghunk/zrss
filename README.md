# ZRSS

把 RSS 重新变成一件轻松的事。

ZRSS 是一款现代浏览器 RSS 阅读器：自动发现订阅源，集中管理信息流，用 AI 快速提炼重点，并把数据留在你自己的浏览器里。

![](https://github.com/user-attachments/assets/a8f1ab98-769b-48b7-8edf-4ac94fa1030c)

## 亮点

- 一键订阅 RSS / Atom / JSON Feed，自动检测当前页面订阅源
- 清爽阅读体验：未读、星标、全文搜索、文件夹分组一应俱全
- AI 摘要与全文翻译，长文先看重点
- 支持 OPML 导入导出、WebDAV 备份恢复，多设备迁移更省心
- 暗色模式，本地存储，适合长期整理自己的信息源

## 快速开始

```bash
npm install
npm run dev
```

在 Chrome 中打开 `chrome://extensions/`，启用开发者模式，加载 `.output/chrome-mv3`。

## 打包

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

WXT、React 19、Tailwind CSS、Zustand、Dexie.js

## LICENSE

[Apache-2.0](./LICENSE)
