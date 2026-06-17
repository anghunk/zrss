# ZRSS - RSS 阅读器

一个现代化的浏览器扩展 RSS 阅读器，基于 wxt.dev 框架开发，支持 Chrome、Firefox、Edge 等主流浏览器。

## ✨ 功能特性

### 核心功能
- **订阅管理**: 添加、编辑、删除 RSS/Atom 订阅源
- **智能抓取**: 后台定时自动刷新（默认 15 分钟）
- **三栏布局**: 左侧订阅列表、中间文章列表、右侧文章详情
- **已读/未读**: 
  - 打开文章自动标记已读（可配置）
  - 手动标记已读/未读
  - 批量标记全部已读
- **星标收藏**: 收藏重要文章
- **搜索过滤**: 全文搜索 + 筛选（全部/未读/星标）
- **分组管理**: 创建文件夹组织订阅源

### 数据同步
- **本地存储**: IndexedDB（通过 Dexie.js）
- **WebDAV 同步**: 支持备份和恢复订阅数据
- **Google Sync**: 跨设备同步（开发中）

### 用户体验
- **暗色模式**: 支持浅色/深色/跟随系统
- **键盘快捷键**: 
  - `j` / `k`: 上下导航文章
  - `r`: 标记已读/未读
  - `s`: 切换星标
  - `o`: 打开原文链接
- **响应式设计**: 适配不同屏幕尺寸

## 🚀 快速开始

### 开发模式

```bash
# 安装依赖
npm install --include=dev

# 启动开发服务器
npm run dev

# Firefox 开发模式
npm run dev:firefox
```

在 Chrome 中加载扩展：
1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `.output/chrome-mv3` 目录

### 构建生产版本

```bash
# Chrome 构建
npm run build

# Firefox 构建
npm run build:firefox

# 打包为 zip
npm run zip
```

## 📁 项目结构

```
zrss/
├── src/
│   ├── entrypoints/
│   │   ├── newtab/          # 新标签页（主界面）
│   │   ├── popup/           # 扩展弹出窗口
│   │   └── background/      # Service Worker（后台抓取）
│   ├── components/
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── layout/          # 布局组件（Sidebar, ArticleList 等）
│   │   ├── feeds/           # 订阅源相关组件
│   │   └── common/          # 通用组件
│   ├── stores/              # Zustand 状态管理
│   ├── lib/                 # 核心库（db, rss-parser, feed-fetcher）
│   ├── hooks/               # 自定义 hooks
│   ├── types/               # TypeScript 类型定义
│   └── utils/               # 工具函数
├── public/                  # 静态资源（图标）
└── .output/                 # 构建输出
```

## 🛠️ 技术栈

- **Extension Framework**: [wxt.dev](https://wxt.dev)
- **UI**: React 18 + shadcn/ui + Tailwind CSS
- **State**: Zustand
- **Database**: Dexie.js (IndexedDB)
- **Icons**: Lucide React
- **Date**: date-fns

## 📊 数据模型

### Feed（订阅源）
- `id`: 唯一标识
- `url`: RSS 链接
- `title`: 显示名称
- `folderId`: 分组 ID
- `unreadCount`: 未读数缓存

### Article（文章）
- `id`: 唯一标识（hash）
- `feedId`: 所属订阅源
- `guid`: RSS 原始 guid（去重用）
- `title`: 标题
- `content`: HTML 正文
- `isRead`: 是否已读
- `isStarred`: 是否星标
- `publishedAt`: 发布时间

### Settings（设置）
- `refreshInterval`: 刷新间隔（分钟）
- `autoMarkRead`: 自动标记已读
- `maxArticlesPerFeed`: 每源最大文章数
- `theme`: 主题（light/dark/system）

## 🎯 已读/未读策略

### 状态定义
- **未读**: `isRead = false`（默认状态）
- **已读**: `isRead = true, readAt = timestamp`
- **星标**: `isStarred = true`

### 标记触发点
1. **打开文章**: 自动标记已读（可关闭）
2. **手动标记**: 点击标记按钮
3. **批量标记**: "Mark All as Read"
4. **数据清理**: 超出上限的旧已读文章自动删除（星标文章保留）

## 🔧 配置说明

### wxt.config.ts
```typescript
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'ZRSS',
    permissions: ['storage', 'alarms', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
});
```

### 后台抓取逻辑
- 使用 `browser.alarms` API 定时触发
- 遍历所有 feeds，逐个 fetch + parse
- 对比 guid 去重，仅插入新文章
- 通过 messaging 通知新标签页更新

## 📝 TODO

- [x] 基础框架搭建
- [x] RSS/Atom 解析器
- [x] 三栏布局
- [x] 订阅管理
- [x] 已读/未读逻辑
- [x] 星标收藏
- [x] 搜索过滤
- [x] 暗色模式
- [ ] 键盘快捷键实现
- [ ] OPML 导入/导出
- [ ] WebDAV 同步完整实现
- [ ] Google Sync 同步
- [ ] 更多图标和样式优化

## 🐛 已知问题

- 某些 RSS 源可能因为 CORS 限制无法抓取
- 图标为占位图，需要替换为正式设计

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
