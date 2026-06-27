# AGENTS.md

## 项目结构

- `src/entrypoints/background/`：扩展后台逻辑与定时刷新入口。
- `src/entrypoints/popup/`：浏览器扩展 popup 入口。
- `src/entrypoints/reader/`：主阅读器页面入口。
- `src/components/`：React UI 组件；`ui/` 放基础组件，`layout/`、`feeds/`、`settings/`、`ai/` 放业务组件。
- `src/stores/`：Zustand 状态管理；跨组件状态优先放这里。
- `src/lib/`：RSS、数据库、同步、AI、favicon 等业务逻辑。
- `src/types/`：共享类型定义；新增跨模块类型优先放这里。
- `src/assets/main.css` 与 `tailwind.config.ts`：全局样式、主题变量与 Tailwind 配置。
- `public/`：扩展图标等静态资源。
- `.output/`、`.wxt/`、`node_modules/` 是生成物或依赖目录，不作为源码修改目标。

## 运行命令

- 安装依赖：`npm install`
- Chrome 开发：`npm run dev`
- Firefox 开发：`npm run dev:firefox`
- Chrome 构建：`npm run build`
- Firefox 构建：`npm run build:firefox`
- Chrome 打包：`npm run zip`
- Firefox 打包：`npm run zip:firefox`
- WXT 准备类型与配置：`npm run prepare`

## 测试命令

- 当前项目没有配置 `npm test`、lint 或 typecheck 脚本。
- 代码改动完成后至少运行：`npm run build`
- Firefox 相关改动同时运行：`npm run build:firefox`
- 涉及扩展权限、后台任务、popup、reader 页面联动时，构建后在浏览器中加载 `.output/chrome-mv3` 做手动验证。

## 代码风格

- 使用 TypeScript、React 函数组件和 Hooks；组件文件使用 `.tsx`，纯逻辑文件使用 `.ts`。
- 使用 `@/` 路径别名引用 `src` 内模块，避免深层相对路径。
- UI 优先复用 `src/components/ui/`、Radix UI、lucide-react 和现有组件，不重复造基础控件。
- 样式使用 Tailwind class；条件 class 使用 `cn`，不要拼接复杂字符串。
- 全局状态使用 Zustand store；持久化数据使用 `src/lib/db.ts` 中的 Dexie 数据库封装。
- 新增方法、事件、函数、接口时尽量补充简洁的 JSDoc 注释，说明用途、参数或副作用。
- 用户可见文案优先使用中文；代码标识、第三方 API 名称和错误对象保持英文。
- 处理文章 HTML、外部 RSS 内容、URL、AI 返回内容时，必须考虑不可信输入和 XSS 风险，优先复用现有 sanitize、parser、fetcher 工具。

## 禁止事项

- 不要提交或手动修改 `.output/`、`.wxt/`、`node_modules/` 等生成目录。
- 不要在没有新增、删除依赖时修改 `package-lock.json`。
- 不要把 AI API Key、WebDAV 密码、token、cookie 写入代码、日志或示例配置。
- 不要无理由扩大 `wxt.config.ts` 里的扩展权限和 `host_permissions`。
- 不要绕过 `src/lib/db.ts` 直接散落 IndexedDB 访问逻辑。
- 不要在 UI 中直接使用未经清洗的 RSS HTML 或 AI 输出。
- 不要用新的状态库、UI 库、请求库替换现有方案，除非任务明确要求且理由充分。
- 不要把大量业务逻辑塞进组件渲染函数；应下沉到 store、lib 或独立 helper。

## 完成标准

- 相关功能在 Chrome 构建下通过 `npm run build`。
- 改动 Firefox 专属或浏览器兼容逻辑时，通过 `npm run build:firefox`。
- popup、reader、background、数据库或同步逻辑有改动时，说明已手动验证的关键路径。
- 新增或变更用户可见行为时，同步更新必要的 README 或界面文案。
- 新增数据字段时，检查 `src/types/`、Dexie schema、默认设置、旧数据迁移是否一致。
- 变更 AI、WebDAV、RSS 抓取或解析逻辑时，覆盖失败、超时、空数据和无权限场景。

## Review 标准

- 优先检查扩展权限是否被不必要扩大。
- 优先检查外部内容渲染、HTML 清洗、URL 处理和 secret 泄露风险。
- 检查后台刷新、popup 与 reader 消息通信是否有竞态、重复触发或 Service Worker 未激活问题。
- 检查 Dexie schema、数据迁移和默认值是否兼容旧用户数据。
- 检查异步请求是否处理失败路径，避免无限 loading、静默丢数据或未捕获异常。
- 检查 UI 是否复用现有组件、状态是否放在合适 store、样式是否符合当前 Tailwind/Radix 风格。
- 如果无法运行构建或手测，必须在回复中明确说明原因和剩余风险。
