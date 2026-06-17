# DeepSeek GUI - Agent 工作指南

## 0. Language Rules (/init activated, permanently enforced)
1. **I18N mode**: Reply language should match the user's language. Reply in Chinese when the user writes in Chinese, reply in English when the user writes in English.
2. **Code/identifier exception**: Programming language keywords, function/class names, open source project names, common abbreviations (API/SDK/CLI/CI/etc.), and in-code identifiers always remain in English.
3. **Code comments**: Use the language that matches the code audience. Use English comments for international projects, Chinese comments for Chinese team projects.
4. **Error messages/guidance text**: Follow the target audience's language. End-user-facing copy must match the UI language.
5. **Reply structure**:
   - Start with a conclusion summary
   - Expand details in bullet points
 - Add notes/action steps as needed
   - Use Markdown formatting; code block comments explain logic

## 0.2 Command Reference
- **`/init`**: Reload all AGENTS.md rules, reset session context constraints.
- **`/review`**: Review uncommitted changes, commits, branches, or PRs; extract repeated workflows from recent work into reusable skills.
- **`/distill`**: Set explicit stop-condition goals, run continuously until the evaluation mechanism determines the goal is met, then auto-clear the goal.

## 1. 项目概览

DeepSeek GUI 是基于 **Electron + React + Tailwind CSS** 的桌面应用，唯一 Agent 运行时为仓库自带的 **Kun**（`kun/` 目录）。三个主入口（Code、Write、连接手机）统一走 Kun HTTP/SSE 边界。

**关键架构路径**：
```
Renderer (React) → KunRuntimeProvider → preload → main (LocalHttpRuntimeAdapter) → kun serve → AgentLoop
```

## 2. 核心命令（必读顺序）

```bash
# 依赖安装（首次或 kun 代码变更后）
npm install

# 开发模式（先编译 kun，再启动 electron-vite dev）
npm run dev

# 类型检查（PR 前必须通过）
npm run typecheck

# 运行测试
npm test

# 构建（PR 前必须通过）
npm run build

# 打包（按平台）
npm run dist:mac   # macOS (.dmg + .zip)
npm run dist:win   # Windows (.exe)
npm run dist:linux # Linux (.AppImage)
```

**Kun 单独开发**（`kun/` 目录下）：
```bash
npm run build       # 编译 kun（tsc -p tsconfig.build.json）
npm run typecheck   # 类型检查（tsc --noEmit -p tsconfig.json）
npm run test        # vitest
npm run dev         # watch 模式编译
npm run serve       # 启动 HTTP 服务
```

**验证顺序**：`npm run typecheck` → `npm test` → `npm run build`

## 3. 仓库结构

```
src/
  main/           Electron 主进程（IPC、Kun 进程管理、设置、更新）
  preload/        Electron preload 脚本
  renderer/       React 前端（agent UI、组件、store、i18n、write 模式）
  shared/         主进程与渲染进程共享类型和工具函数
kun/
  src/
    adapters/     DeepSeek 模型客户端、本地工具宿主、存储适配器
    attachments/  附件处理
    cache/        LRU/TTL 缓存与 immutable prefix
    cli/          CLI 入口（serve、run、chat、exec）
    config/       配置加载
    contracts/    Zod schema 与 HTTP/SSE 合约类型
    delegation/   子 agent 委派
    domain/       线程、回合、事件、审批、用量实体
    loop/         Cache-first agent loop
    memory/       跨会话记忆
    ports/        接口定义（ModelClient、ToolHost、Store 等）
    prompt/       Prompt 构建
    review/       代码审查
    server/       HTTP 路由与 SSE
    services/     线程/回合编排服务
    shared/       共享工具
    skills/       Skill 运行时
    telemetry/    用量、缓存、成本统计
```

## 4. 运行时约束（必须遵守）

- **唯一运行时是 Kun**。禁止新增第二套运行时、运行时切换器、运行时诊断面板。
- Code、Write、连接手机三个入口统一走 Kun HTTP/SSE 边界。连接手机在代码内部仍沿用 `claw` 命名。

### 允许的扩展路径

1. 在 `kun/src/contracts/` 中新增协议字段
2. 在 `kun/src/loop/`、`kun/src/services/` 或 `kun/src/ports/` / `kun/src/adapters/` 下新增端口与适配器
3. 在 `kun/src/server/routes/` 下新增 HTTP 接口
4. 在 `src/renderer/src/agent/kun-runtime.ts` 与 `kun-mapper.ts` 中完成端点与事件映射
5. 仅在 `agents.kun` 下新增设置项

### 禁止路径

- 不要新增 `AgentSwitcher`、`ConnectionStatusBar`、`RuntimeDiagnosticsDialog`
- 不要恢复 CodeWhale/Reasonix 适配器、进程管理、RPC 桥、更新器
- 不要新增打开运行时控制面板的 `/usage` 或 `/runtime` 斜杠命令

### 旧数据兼容

旧持久化 key 仅在 settings 迁移时只读使用：
- `agentProvider: codewhale | reasonix | deepseek-runtime` 映射为 `kun`
- 保存后的 settings 仅保留 `agents.kun`

## 5. 开发约定

- **分支策略**：日常开发用 `develop`，发布用 `master`。PR 提交到 `develop`，审核后由维护者合入 `master`。CI 仅对 `develop→master` 的合并触发全平台发布。
- **TypeScript 严格模式**：`tsconfig.web.json`（前端）和 `tsconfig.node.json`（主进程）均开启 `strict: true`
- **路径别名**：`@renderer/*` → `src/renderer/src/*`，`@shared/*` → `src/shared/*`，`@kun` → `kun/src`
- **测试框架**：Vitest，根目录 `src/**/*.test.ts`，kun 目录 `kun/tests/**/*.test.ts` 和 `kun/src/**/*.test.ts`
- **UI 样式**：Tailwind CSS（`tailwind.config.js`），暗色模式通过 `[data-theme="dark"]`，颜色基于 `--ds-*` CSS 变量
- **国际化**：i18next + react-i18next，语言文件在 `src/renderer/src/locales/{zh,en}/`
- **状态管理**：Zustand（`src/renderer/src/store/`）
- **代码编辑器**：CodeMirror 6（Write 模式）
- **ESLint** 配置宽松：`no-unused-vars`、`no-require-imports` 均为 off

## 6. 常见陷阱

- `npm run dev` 会先执行 `build:kun`（编译 kun），不要跳过这步
- `postinstall` 脚本（`scripts/postinstall.cjs`）自动执行 `ensure-kun-install.cjs` + `kun build`
- kun 的 `dist/` 目录是构建产物（gitignored），如遇 kun 相关报错先检查是否有编译产物
- Electron 打包使用 `electron-builder@26.8.1`，配置在 `electron-builder.config.cjs`
- macOS 签名需要 P12 证书和 Apple API Key，CI 自动处理，本地开发可跳过（identity 设为 null）
- 更新通道通过 `DEEPSEEK_GUI_UPDATE_CHANNEL` 环境变量控制：`stable` 或 `frontier`

## 7. PR 前检查清单

```bash
npm run typecheck   # 必须通过
npm test            # 必须通过
npm run build       # 必须通过
npm run lint        # 推荐通过
```

- 影响界面的改动请附上视频或 GIF
- 影响项目逻辑的改动请附上对应单元测试
- 影响使用方式的改动请同步更新 `README.md` 和 `README.en.md`
- 对照 `.github/pull_request_template.md` 填写 PR 描述

## 8. 重要文档

| 文档 | 内容 |
|------|------|
| `docs/kun-architecture.md` | Kun 架构、HTTP/SSE 合约、旧 agent 拆除说明 |
| `docs/kun-cache-optimization.md` | 缓存优化、token economy、MCP search |
| `docs/kun-contributing.md` | Kun 贡献指南、设计模式 |
| `kun/README.md` | Kun CLI、env、data dir、HTTP API |
| `docs/DEVELOPMENT.zh-CN.md` | 本地开发与协作流程 |
| `docs/CONTRIBUTING.zh-CN.md` | 贡献说明 |
| `docs/TECH_STACK.md` | 完整技术栈与版本清单 |
