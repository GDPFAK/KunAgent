# DeepSeek GUI 技术栈

## 核心框架

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 桌面容器 | Electron | 34.2.0 | 跨平台桌面应用 |
| UI 框架 | React | 19.0.0 | 渲染进程 UI |
| 类型系统 | TypeScript | 5.8.2 | 全项目严格模式 |
| 构建工具 | electron-vite | 3.1.0 | 主进程/渲染进程/preload 统一构建 |
| 打包发布 | electron-builder | 26.8.1 | macOS/Windows/Linux 安装包 |

## Kun 运行时

| 技术 | 版本 | 用途 |
|------|------|------|
| Zod | 4.4.3 | HTTP/SSE 合约 schema 验证 |
| @modelcontextprotocol/sdk | 1.29.0 | MCP 协议客户端 |
| better-sqlite3 | 12.10.0 | 线程/事件/用量持久化 |
| diff | 8.0.4 | 文件变更 diff |

Kun 为独立 TypeScript 包（`kun/`），使用 `tsc` 编译，产出 ESM + 类型声明。

## UI 与样式

| 技术 | 版本 | 用途 |
|------|------|------|
| Tailwind CSS | 3.4.17 | Utility-first CSS |
| PostCSS | 8.5.3 | CSS 处理管线 |
| Autoprefixer | 10.4.21 | 浏览器前缀兼容 |
| lucide-react | 0.544.0 | 图标库 |

暗色模式通过 `darkMode: ['selector', '[data-theme="dark"]']` 实现，颜色系统基于 CSS 自定义属性（`--ds-*`）。

## 代码编辑与 Markdown

| 技术 | 版本 | 用途 |
|------|------|------|
| CodeMirror 6 | @codemirror/* | Write 模式代码/Markdown 编辑器 |
| react-markdown | 10.1.0 | Markdown 渲染 |
| remark-gfm | 4.0.1 | GitHub Flavored Markdown 支持 |
| rehype-harden | 1.1.8 | HTML 净化 |
| shiki | 3.23.0 | 语法高亮 |
| streamdown | 2.5.0 | 流式 Markdown 渲染 |

## 状态管理与国际化

| 技术 | 版本 | 用途 |
|------|------|------|
| Zustand | 5.0.3 | 轻量状态管理 |
| i18next | 25.4.2 | 国际化框架 |
| react-i18next | 15.7.4 | React i18n 绑定 |

语言文件位于 `src/renderer/src/locales/{en,zh}/`，命名空间为 `common` 和 `settings`。

## IM 与集成

| 技术 | 版本 | 用途 |
|------|------|------|
| @larksuiteoapi/node-sdk | 1.64.0 | 飞书 / Lark 接入 |
| @tencent-weixin/openclaw-weixin | 2.4.3 | 微信接入 |
| openclaw | 本地 shim | IM 抽象层 |
| qrcode.react | 4.2.0 | 二维码生成（扫码绑定） |

## 存储与导出

| 技术 | 版本 | 用途 |
|------|------|------|
| electron-store | 10.1.0 | GUI 设置持久化 |
| better-sqlite3 | 12.10.0 | Kun 数据持久化 |
| @aws-sdk/client-s3 | 3.1049.0 | R2/S3 发布资源上传 |
| html-to-docx | 1.8.0 | Write 模式文档导出 |

## 开发与测试

| 技术 | 版本 | 用途 |
|------|------|------|
| Vite | 6.2.0 | 构建引擎 |
| Vitest | 4.1.7 | 单元测试 |
| ESLint | 10.4.0 | 代码规范 |
| typescript-eslint | 8.59.4 | TS 规则 |
| eslint-plugin-react-hooks | 7.1.1 | React Hooks 规则 |

测试配置：
- 根目录：`vitest.config.ts`，匹配 `src/**/*.test.ts`
- Kun：`kun/vitest.config.ts`，匹配 `kun/tests/**/*.test.ts` 和 `kun/src/**/*.test.ts`
- 路径别名：`@renderer`、`@shared`（根），`@kun`（kun）

## 路径别名

| 别名 | 解析路径 | 作用域 |
|------|----------|--------|
| `@renderer/*` | `src/renderer/src/*` | 渲染进程 |
| `@shared/*` | `src/shared/*` | 主进程/渲染进程共享 |
| `@kun` | `kun/src` | Kun 运行时 |

## 构建产物

```
out/              electron-vite 构建产物（main/preload/renderer）
kun/dist/         Kun ESM + 类型声明（gitignored）
dist/             打包输出（.dmg/.exe/.AppImage）
```
