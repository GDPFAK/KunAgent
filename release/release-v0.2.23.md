# Kun v0.2.23

这一版是 v0.2.22 之后的一次维护发布。重点是让更新后的用户能打开对应版本的 release note，让每次对话和 Review 更准确地使用用户当前选择的 provider，并收紧 packaged app 中 Kun runtime 启动和 Whisper 资源打包的边界。首次设置、记忆导出、Design 画布显示和 HTML 质量检查也补了一批稳定性细节。

### 更新说明与首次设置

- 更新完成后的“查看更新日志”现在会直接打开当前版本的 release note，而不是只进入 release 目录。
- 默认更新日志入口切换到 KunAgent/Kun 的 GitHub release 文档；自定义 `KUN_CHANGELOG_URL` 支持 `{version}` 占位，方便私有部署或镜像站点指向对应版本文档。
- 首次设置保存时只提交实际变更的 settings patch，避免把旧的顶层 `instructions` 等遗留字段带进 `settings:set`，减少设置迁移期的保存失败。
- 补充版本化 changelog URL、首次设置 settings patch 和 schema 解析相关测试，让首次启动和更新后的提示路径更可靠。

### 模型选择与 Review 路由

- 对话 turn 和 Review 请求会携带 `providerId`，运行时可以按每次发送时的 composer provider 选择来路由，而不是只看线程默认 provider。
- Claude/Codex 等订阅式或多 provider 场景下，每回合的模型选择会更贴近用户当前选择；Review 也会使用同一个 provider/model 组合。
- Renderer 与 Kun runtime 的 turn/review 合约补齐 provider 字段，运行时持久化 turn 记录时也会保留该信息。
- 移除发送前强行改写 runtime provider 的旧路径，降低一次发送影响全局 provider 设置的风险。

### Runtime 启动与打包资源

- 拆出并测试 `shouldRunKunServeAsElectronChild`，明确只有 macOS 开发环境且开启 computer-use 时才使用 Electron 子进程路径。
- packaged `.app` 会继续使用 Node helper 启动 `kun serve`，避免把 `serve-entry.js` 交给主 GUI 可执行体后误启动 GUI 的问题。
- Whisper runner 的非目标平台/架构资源改为 after-pack 阶段裁剪，打包流程不会再直接删除源资源目录里的其他架构文件。
- 打包后只保留当前平台架构对应的 Whisper 资源和许可证，减少安装包体积并降低跨架构资源混入的风险。

### 细节修复

- 记忆 Markdown 导出会先替换控制字符再清理文件名，避免非法字符影响保存路径。
- Design canvas 操作 chip 在本地化 key 缺失时会显示可读 fallback，不再把 untranslated key 暴露给用户。
- HTML 质量检查的若干正则更稳，对正负数、hero selector、具体业务指标等判断更准确。
- 相关单元测试补上了 localStorage stub、运行时 resolver、turn service、renderer runtime 和 settings patch 覆盖。

### 升级说明

- 从 `v0.2.22` 升级可直接通过 GUI 更新。
- 如果你配置了 `KUN_CHANGELOG_URL` / `DEEPSEEK_GUI_CHANGELOG_URL`，可以使用 `{version}` 占位，例如 `https://example.com/release/release-{version}.md`。
- 本版没有设置迁移要求；首次设置、provider 选择和 Review 路由会沿用已有配置。

### 完整变更

https://github.com/KunAgent/Kun/compare/v0.2.22...v0.2.23

### 总结

v0.2.23 是一次发版链路和运行时边界的打磨：更新后用户能看到正确版本的说明，模型和 provider 选择更少被线程默认值带偏，packaged app 启动 Kun runtime 与裁剪 Whisper 资源也更稳。它不抢 v0.2.22 的 Design 大版本风头，但会让这条版本线跑得更顺。
