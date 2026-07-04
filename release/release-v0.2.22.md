# Kun v0.2.22

这一版是 v0.2.21 之后的一次产品能力大更新。主线是全新的 Design 模式：Kun 现在不只是能写代码和长文，也能在独立设计工作区里生成方向、操作画布、编辑界面、预览原型，并把设计结果继续带回代码实现流程。同时，这一版补强了 Codex/Claude 订阅供应商、图片生成、记忆导入导出、文件预览、运行时安全和聊天稳定性。

### Design 模式与画布

- 新增 Design 模式，提供独立的设计工作区、Design AI Rail、右侧设计面板和完整设置入口。
- 新增 Figma 风格 SVG 画布与无限画布体验，支持缩放、平移、网格、选择、拖拽、旋转、对齐、吸附、图层、属性面板和迷你地图。
- 新增画布基础图形能力，包括 frame、rect、ellipse、line、text、group、image 等节点，以及更完整的 shape operation 协议。
- Design Agent 现在可以通过 ShapeOps 实时操作画布，并在操作失败时获得错误反馈，用于下一步自我修正。
- 新增 HTML Frame 设计预览，支持交互开关、webview 原生缩放、尺寸测量、内容裁剪、滚动条处理和生成中的占位状态。
- 新增画布文本编辑能力，可以结合上下文直接编辑 HTML 元素文本。
- 新增图片标注编辑器、图片属性面板和 agent drawings 区域，让图片素材、标注和设计说明更容易进入同一个工作流。

### 设计生成、原型与代码联动

- 新增 foundation-first 设计生成流程，优先建立设计系统、品牌色、字体、token 和屏幕结构，再生成具体页面。
- 设计上下文可以从 token 中自动推导未设置的品牌色和字体，并把提取出的设计 token 带入后续 HTML / screen 生成回合。
- 新增设计方向管理、方向对比、生成队列和多屏生成能力；聊天繁忙时，屏幕生成可以等待而不额外消耗队列。
- 新增原型播放器、原型路由、表单提交捕获和导航状态管理，并支持原型视口切换。
- 新增设计引用进入代码 composer 的能力，设计稿、图片、token 和上下文可以更自然地带入代码实现。
- 新增 in-page implement assistant panel、设计到代码同步检查、代码绑定候选和 roundtrip 操作，为从设计落到代码打基础。
- 新增设计文档持久化、artifact 版本摘要、线程绑定、线程标题管理和文档目录中的设计聊天记录保存。

### 图片生成与多模态体验

- 新增隐式 AI 图片槽，画布中的图片占位可以更自然地触发图片生成。
- 选中的画布图片可以作为 `generate_image` 的参考图，选图编辑会正确路由到图片生成流程，而不是误触发新增屏幕。
- 图片生成工具支持更多质量选项，并允许视觉模型查看自己生成的图片用于自审。
- 对不支持 reference edit 的 provider 会明确报错，避免静默失败。
- 改进图片预览尺寸、附件处理和 standalone image asset prompt，让图片相关工作流更稳定。

### 模型、运行时与工具链

- 新增 Codex 订阅作为模型供应商，可通过 ChatGPT/Codex 登录使用 Codex Responses 模型与对应图片生成能力。
- 新增 Claude Pro/Max 订阅登录，支持 Anthropic OAuth；OAuth token 交换会走用户配置的代理。
- 修复 Codex 登录端口被占用时的 fallback 行为，并补齐 Codex Responses 图片生成处理。
- 新增工具输出限制设置，便于控制 Agent 工具结果进入上下文的规模。
- 子 AgentLoop 请求会注入 `AGENTS.md` 指令，子任务更容易继承当前仓库的工作约束。
- 虚拟工具目录会按回合冻结，减少动态工具列表变化对模型调用的影响。
- 新增运行时 package audit 和供应链审计能力，提升 runtime 依赖检查与发布治理能力。
- 加固 managed Kun runtime 设置，避免敏感配置被不安全地传递或持久化。
- 修复 nvm 环境下 MCP stdio server 的 `npx` 路径解析问题。

### 记忆、聊天与工作区

- 记忆支持 Markdown 导入和导出，便于迁移、备份和整理长期记忆。
- 修复记忆记录确认与恢复流程，让 memory actions 更可靠。
- 新增助手回复导出能力。
- 新增数学表达式渲染支持，技术讨论和公式内容的可读性更好。
- 文件预览现在使用线程所属 workspace，避免多项目或切换线程后预览到错误路径。
- 修复流式消息重订阅时重复追加文本的问题。
- 修复 settled text 更新后 Streamdown 未正确重挂载的问题。
- 应用会更好地保留当前模型、设计状态和 provider 预设模型编辑。

### 设置、文案与可维护性

- 简化 Design 设置项，并补充图片生成质量、工具输出限制等配置入口。
- 更新中英文文案，覆盖 Design 模式、画布工具、设计助手、设置项和插件能力说明。
- 大幅拆分 Workbench 与 Design 相关模块，新增覆盖画布、HTML 质量检查、设计线程、原型播放器、ShapeOps、设置和运行时的测试。
- 修复 Windows 测试稳定性、typecheck 与 timeline 相关回归测试，让发版验证更稳。

### 升级说明

- 从 `v0.2.21` 升级可直接通过 GUI 更新。
- Design 模式是本版最大的新增能力。已有 Code、Write、Connect 工作流不需要迁移；Design 工作区会使用新的设计文档、画布和 artifact 持久化结构。
- 如果你想使用 Codex 订阅模型，请在 provider 设置中选择 Codex 供应商并完成 ChatGPT/Codex 登录。
- 如果你使用 Claude Pro/Max 登录，请在 provider 设置中完成新的 Anthropic OAuth 登录流程；代理配置会继续生效。
- 如果你依赖 MCP stdio server，并且本机通过 nvm 管理 Node.js，这一版会改善 `npx` 解析和启动稳定性。
- 记忆导入导出采用 Markdown 格式，导入前建议先导出现有记忆作为备份。

### 完整变更

https://github.com/KunAgent/Kun/compare/v0.2.21...v0.2.22

### 总结

v0.2.22 是 Kun 从代码助手继续扩展到产品创作工作台的一步：Design 模式把画布、原型、图片、设计系统和代码实现连在了一起；Codex/Claude 订阅供应商与运行时细节则继续补上登录、工具、记忆、预览和稳定性。这个版本的重点不是单个按钮，而是让“想法 -> 设计 -> 原型 -> 代码”的路径真正开始在 Kun 里闭环。
