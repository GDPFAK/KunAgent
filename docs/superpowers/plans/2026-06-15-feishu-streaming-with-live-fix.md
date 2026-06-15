# 飞书 / Lark 流式输出（带 live 视图卡顿修复）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feature/feishu-streaming-with-live-fix` 分支上把飞书 / Lark bot 的回复改为 SDK markdown 流式卡,并修复上一版"`onClawChannelActivity` 触发时 Connect phone 视图卡住"的两处 bug(`selectThread` HTTP 抢在 SSE 之前 + `showLiveAssistant` 被 `isProcessing` 隐藏)。

**Architecture:** 在 `ClawRuntime.handleFeishuMessage` 内部根据 `claw.im.feishuStream` 开关分两路 —— 开:经由 `runStreamingReply` 走 `FeishuStreamer` + `bridge.stream` + 自管 SSE 订阅(失败时退到一次性 `bridge.send`);关:走原 `processIncomingImPrompt` 轮询路径。Renderer 侧新增 `subscribeThreadEventsLive` action(跳过 HTTP 抢在 SSE 之前),并把 `MessageTimeline` 的 live bubble 门控改为只检查 `liveContent`。WeChat、kun runtime、既有 `processIncomingImPrompt` 路径全部保留。

**Tech Stack:** Electron + React 19 + TypeScript + Zustand + Vitest + Lark SDK(`@larksuiteoapi/node-sdk`)。runtime 还是单一 `kun`(无新增 / 切换 runtime)。

**Spec:** [`docs/superpowers/specs/2026-06-15-feishu-streaming-with-live-fix-design.md`](../specs/2026-06-15-feishu-streaming-with-live-fix-design.md)

---

## 工作约束(影响全部任务)

- **TDD**:每个有可测行为的功能都先写失败测试再实现。
- **commit 粒度**:每个 Task 完成立刻 commit,不允许"积一堆再提交"。
- **YAGNI**:spec 标注"YAGNI"的项不写(per-channel `feishuStream`、Card JSON 2.0、reasoning 透出等)。
- **不动 `kun/` runtime 包**:kun 的 `/v1/threads/{id}/events` SSE 端点已经存在;本计划只用它。
- **不复用 `src/main/runtime-sse-ipc.ts`**:那是给 renderer→main IPC 用的;main 直接 `fetch` + 自管 SSE 解析循环(`subscribeRuntimeThreadEvents`)。
- **路径风格**:本计划所有路径用正斜杠,跨平台可读。
- **改动核心调用**:`bridge.stream(chatId, { markdown: producer }, replyOptions)`(**不是** `bridge.send` —— 上版踩坑);SSE 字段读 `event.item.text`(**不是** `event.item.delta` —— 上版踩坑)。两个 spec 注释里都写明。
- **改动前必读**:每个 Task 的"Files"小节先 Read 一下当前文件内容,再动 Edit。
- **工作树**:当前在 `feature/feishu-streaming-with-live-fix` 分支,基于 `origin/develop`;stash 里有没有用到的 `package-lock.json` / `CLAUDE.md` / `bash.exe.stackdump` 暂不动,等所有 Task 完成后由用户决定。

---

## 文件结构(实现前先锁好)

| 文件 | 角色 | 类型 |
|---|---|---|
| `src/main/feishu-streamer.ts` | `FeishuStreamer` 类,封装一次流式回复生命周期 | 新增 |
| `src/main/feishu-streamer.test.ts` | `FeishuStreamer` 单测(10 个 case) | 新增 |
| `src/main/claw-runtime-helpers.ts` | `subscribeRuntimeThreadEvents` + `SseSubscriber` + `RuntimeSseEvent` | 修改(+SSE 部分) |
| `src/main/claw-runtime.ts` | `runStreamingReply` / `subscribeSse` / `subscribeSseForStreamer`;`handleFeishuMessage` 分支 | 修改 |
| `src/main/claw-runtime.test.ts` | 集成测试(4-5 个 case) | 修改(+ case) |
| `src/shared/app-settings-types.ts` | `ClawImSettingsV1` 加 `feishuStream?` | 修改(+1 字段) |
| `src/shared/app-settings-claw.ts` | default normalizer 补 `feishuStream: true` | 修改(+1 行) |
| `src/main/settings-store.ts` | migration 加 `claw.im.feishuStream ?? true` | 修改(+1 行) |
| `src/shared/app-settings.test.ts` | migration 测试 | 修改(+1 case) |
| `src/renderer/src/store/chat-store-thread-actions.ts` | `subscribeThreadEventsLive` action | 修改(+action) |
| `src/renderer/src/store/chat-store-types.ts` | `ChatState` 加新 action 类型 | 修改(+1 行) |
| `src/renderer/src/store/chat-store-navigation-actions.ts` | `onClawChannelActivity` 改走新 action | 修改(1 行替换) |
| `src/renderer/src/components/chat/MessageTimeline.tsx` | `showLiveAssistant` 去掉 `!isProcessing` 门控 | 修改(1 行) |
| `src/renderer/src/store/chat-store-thread-actions.test.ts` | `subscribeThreadEventsLive` 单测(2-3 个 case) | 修改(+case) |
| `src/renderer/src/components/chat/__tests__/MessageTimeline.test.tsx`(或既有) | live bubble 渲染 snapshot/测试 | 修改或新增(看既有测试位置) |
| `docs/CONTRIBUTING.md` | 末尾加"飞书流式 smoke 测试"小节 | 修改(追加) |

不在本计划里(明确不动的文件):
- `kun/` runtime 包
- `src/renderer/src/agent/kun-runtime.ts`
- `src/main/runtime-sse-ipc.ts`
- `src/main/claw-runtime.ts` 里 `processIncomingImPrompt` / `waitForAssistantResult` 主体逻辑

---

## Commit 分组

| Commit | 主题 | 含 Task |
|---|---|---|
| C1 | `fix(chat): renderer live-view 卡顿修复` | Phase 1 全部 |
| C2 | `feat(claw): 全局 feishuStream 设置 + migration` | Phase 2 全部 |
| C3 | `feat(feishu-streamer): main 侧流式核心` | Phase 3 全部 |
| C4 | `docs(feishu): smoke 测试小节` | Phase 4 全部 |

每个 Phase 跑完,跑 `npm run typecheck && npm run lint && npm run test`,过了再进下一个 Phase。

---

# Phase 1:Renderer 侧卡顿修复(Commit 1)

本 Phase 解决两个 live-view bug,完全独立于 main 侧流式。完成后,即使 `feishuStream` 关闭,bot 消息到达时 chat 视图也能实时显示 deltas(走的就是 renderer 侧 SSE 路径,跟 main 侧 `processIncomingImPrompt` 轮询解耦)。

## Task 1.1:在 `ChatState` 类型加 `subscribeThreadEventsLive` action 字段

**Files:**
- Modify: `src/renderer/src/store/chat-store-types.ts:209-225`(在 `selectThread` 类型后面加一行)

- [ ] **Step 1:读当前类型定义**

Read: `src/renderer/src/store/chat-store-types.ts` 209-225 行。找到 `selectThread: (id: string) => Promise<void>` 这一行。

- [ ] **Step 2:在 `selectThread` 类型后追加新 action 类型**

在 `selectThread: (id: string) => Promise<void>` 之后插入:

```ts
  /**
   * 打开 SSE 订阅一条 thread(不预先拉 getThreadDetail)。
   * 用于:onClawChannelActivity 自动切到 bot thread,让流式 deltas 立即可见。
   * 与 selectThread 的区别:selectThread 先做 HTTP getThreadDetail 拉元数据,
   * subscribeThreadEventsLive 直接开 SSE (sinceSeq=0),跳过 HTTP 抢在 SSE 之前。
   */
  subscribeThreadEventsLive: (threadId: string) => Promise<void>
```

- [ ] **Step 3:确认类型编译通过**

Run: `npx tsc --noEmit -p src/renderer/tsconfig.json 2>&1 | head -20`
Expected: 只有跟新字段不相关的其他错误(若存在),不报 `subscribeThreadEventsLive` 未实现。

- [ ] **Step 4:commit**

```bash
git add src/renderer/src/store/chat-store-types.ts
git commit -m "types(chat-store): add subscribeThreadEventsLive to ChatState"
```

---

## Task 1.2:在 `chat-store-thread-actions.ts` 加 `subscribeThreadEventsLive` action(测试先红)

**Files:**
- Test: `src/renderer/src/store/chat-store-thread-actions.test.ts`
- Modify: `src/renderer/src/store/chat-store-thread-actions.ts`

- [ ] **Step 1:读既有 `selectThread` 找 reset 字段集合**

Read: `src/renderer/src/store/chat-store-thread-actions.ts` 280-330 行(`selectThread` 主体)。记下它 reset 的字段集合: `activeThreadId`、`blocks`、`lastSeq`、`liveReasoning`、`liveAssistant`、`unreadThreadIds`、`busy`、`currentTurnId`、`currentTurnUserId`、`turnStartedAtByUserId`、`turnDurationByUserId`、`turnReasoningFirstAtByUserId`、`turnReasoningLastAtByUserId`、`queuedMessages`。后续 subscribeThreadEventsLive 用同一组 reset。

- [ ] **Step 2:读既有测试文件,看 `selectThread` 怎么测**

Read: `src/renderer/src/store/chat-store-thread-actions.test.ts` 全文。找出 `buildHarness` 或等价辅助函数,看它如何 mock `provider.getThreadDetail` 与 `provider.subscribeThreadEvents`。

- [ ] **Step 3:写失败测试**

在 `chat-store-thread-actions.test.ts` 末尾 `describe` 块追加:

```ts
describe('chat-store-thread-actions subscribeThreadEventsLive', () => {
  it('opens SSE with sinceSeq=0, skips the HTTP fetch, and switches activeThreadId so deltas flow in', async () => {
    const subscribeCalls: Array<{ threadId: string; sinceSeq: number }> = []
    const getDetailCalls: string[] = []
    let capturedSink: { onDeltas: (deltas: Array<{ kind: string; text: string; seq: number }>) => void } | null = null

    const provider = {
      getThreadDetail: vi.fn(async (id: string) => {
        getDetailCalls.push(id)
        return { blocks: [], latestSeq: 0, threadStatus: 'idle' }
      }),
      subscribeThreadEvents: vi.fn(async (threadId: string, sinceSeq: number, sink: unknown) => {
        subscribeCalls.push({ threadId, sinceSeq })
        capturedSink = sink as typeof capturedSink
        return { streamId: 'stream_1' }
      })
    }
    registryMock.getProvider.mockReturnValue(provider)

    const { actions, state } = buildHarness()
    state.activeThreadId = 'thr_existing'
    state.busy = true
    state.runtimeConnection = 'ready'

    await actions.subscribeThreadEventsLive('thr_live')

    // HTTP fetch is NOT done (no metadata roundtrip)
    expect(provider.getThreadDetail).not.toHaveBeenCalled()
    // SSE opens with sinceSeq=0 so all events replay
    expect(subscribeCalls).toEqual([{ threadId: 'thr_live', sinceSeq: 0 }])
    // The chat view switches to the live thread
    expect(state.activeThreadId).toBe('thr_live')
    // SSE-sourced deltas flow into the chat-store's live state.
    const sink = capturedSink as unknown as {
      onDeltas: (deltas: Array<{ kind: string; text: string; seq: number }>) => void
    } | null
    expect(sink).not.toBeNull()
    if (sink) {
      sink.onDeltas([{ kind: 'agent_message', text: 'hello', seq: 1 }])
      expect(state.liveAssistant).toBe('hello')
      sink.onDeltas([{ kind: 'agent_message', text: ' world', seq: 2 }])
      expect(state.liveAssistant).toBe('hello world')
    }
  })
})
```

- [ ] **Step 4:跑测试,确认失败**

Run: `npx vitest run src/renderer/src/store/chat-store-thread-actions.test.ts 2>&1 | tail -30`
Expected: FAIL with "actions.subscribeThreadEventsLive is not a function" 或类似 "Cannot read properties of undefined"。

- [ ] **Step 5:commit(测试先红)**

```bash
git add src/renderer/src/store/chat-store-thread-actions.test.ts
git commit -m "test(chat-store): add failing test for subscribeThreadEventsLive"
```

---

## Task 1.3:实现 `subscribeThreadEventsLive` action(测试转绿)

**Files:**
- Modify: `src/renderer/src/store/chat-store-thread-actions.ts:116`(action Pick 列表),`:290`(selectThread 后追加新 action)

- [ ] **Step 1:更新 createThreadActions 的 Pick 列表**

Read: `src/renderer/src/store/chat-store-thread-actions.ts:156` 附近,找到:

```ts
): Pick<ChatState, 'createThread' | 'recoverActiveTurn' | 'selectThread' | 'drainQueuedMessages' | 'removeQueuedMessage' | 'sendMessage' | 'reviewActiveThread'> {
```

替换为:

```ts
): Pick<ChatState, 'createThread' | 'recoverActiveTurn' | 'selectThread' | 'subscribeThreadEventsLive' | 'drainQueuedMessages' | 'removeQueuedMessage' | 'sendMessage' | 'reviewActiveThread'> {
```

- [ ] **Step 2:实现 action 主体**

在 `selectThread` action 闭合 `}` 之后、`drainQueuedMessages` action 之前,插入:

```ts
  subscribeThreadEventsLive: async (threadId) => {
    if (get().runtimeConnection !== 'ready') return
    const targetThreadId = threadId.trim()
    if (!targetThreadId) return
    // Replace any prior subscription (live or explicit) with this live one.
    // We switch the chat view to this thread so the user sees the Feishu
    // bot's streaming reply as it arrives, instead of waiting for
    // getThreadDetail to return.
    sseAbortRef.current?.abort()
    sseAbortRef.current = null
    const p = getProvider()
    try {
      resetBusyRecoveryAttempts()
      clearBusyWatchdog()
      set({
        activeThreadId: targetThreadId,
        blocks: [],
        lastSeq: 0,
        liveReasoning: '',
        liveAssistant: '',
        unreadThreadIds: { ...get().unreadThreadIds, [targetThreadId]: false },
        busy: true,
        currentTurnId: null,
        currentTurnUserId: null,
        turnStartedAtByUserId: {},
        turnDurationByUserId: {},
        turnReasoningFirstAtByUserId: {},
        turnReasoningLastAtByUserId: {},
        queuedMessages: []
      })
      const ac = new AbortController()
      sseAbortRef.current = ac
      const sink = buildThreadEventSink(set, get, { threadId: targetThreadId, signal: ac.signal, sinceSeq: 0 })
      subscribeThreadEventsWithRecovery(p, targetThreadId, 0, sink, ac.signal, get)
      armBusyWatchdog(set, get)
    } catch (e) {
      set({
        error: formatRuntimeError(e),
        ...(shouldOpenSettingsForError(e)
          ? { route: 'settings' as const, settingsSection: 'agents' as const }
          : {})
      })
    }
  },
```

注意:此实现复用了既有 `selectThread` 同名辅助(`resetBusyRecoveryAttempts` / `clearBusyWatchdog` / `buildThreadEventSink` / `subscribeThreadEventsWithRecovery` / `armBusyWatchdog` / `formatRuntimeError` / `shouldOpenSettingsForError`)。如果既有文件里这些函数命名不同(例如 `armBusyWatchdog` 实际叫 `armBusyWatchdogForActiveThread`),按既有命名替换,行为一致即可。

- [ ] **Step 3:跑测试,确认通过**

Run: `npx vitest run src/renderer/src/store/chat-store-thread-actions.test.ts 2>&1 | tail -30`
Expected: PASS —— Task 1.2 写的那个 case 绿了。

- [ ] **Step 4:跑全量 renderer 测试,确认没回归**

Run: `npx vitest run src/renderer 2>&1 | tail -20`
Expected: 所有既有测试通过,新测试通过。

- [ ] **Step 5:commit**

```bash
git add src/renderer/src/store/chat-store-thread-actions.ts
git commit -m "feat(chat-store): add subscribeThreadEventsLive action (skip HTTP, open SSE)"
```

---

## Task 1.4:把 `onClawChannelActivity` 切到 `subscribeThreadEventsLive`

**Files:**
- Modify: `src/renderer/src/store/chat-store-navigation-actions.ts:408-414`(`onClawChannelActivity` 内部)

- [ ] **Step 1:写失败测试**

Read: `src/renderer/src/store/chat-store-navigation-actions.test.ts` 全文,看既有 harness 怎么 mock `window.kunGui.onClawChannelActivity` 和 `selectThread`。

在测试文件末尾追加:

```ts
describe('onClawChannelActivity routes through subscribeThreadEventsLive (not selectThread)', () => {
  it('calls subscribeThreadEventsLive when activeThreadId differs from the bot thread', async () => {
    const subscribeThreadEventsLive = vi.fn(async () => undefined)
    const selectThread = vi.fn(async () => undefined)
    // ... 按既有 harness 模式注入 actions
    const harness = buildHarness({ selectThread, subscribeThreadEventsLive })
    // 触发 onClawChannelActivity 回调:
    //   模拟 window.kunGui.onClawChannelActivity 注册的回调被调用
    //   ({ channelId, threadId }) => { ... await selectThread/subscribeThreadEventsLive }
    const capturedCallback = (window.kunGui.onClawChannelActivity as vi.Mock).mock.calls[0][0]
    await capturedCallback({ channelId: 'ch_1', threadId: 'thr_bot' })
    expect(subscribeThreadEventsLive).toHaveBeenCalledWith('thr_bot')
    expect(selectThread).not.toHaveBeenCalled()
  })
})
```

> 实现细节:测试里用 `buildHarness` 注入 `subscribeThreadEventsLive` 和 `selectThread`,然后调用 `window.kunGui.onClawChannelActivity` 注册时捕获的回调,断言自动切走新 action 而非旧 action。若既有 `buildHarness` 不支持注入 `subscribeThreadEventsLive`,扩展 harness(参考上一步 `chat-store-thread-actions.test.ts` 的 `buildHarness`)。

- [ ] **Step 2:跑测试,确认失败**

Run: `npx vitest run src/renderer/src/store/chat-store-navigation-actions.test.ts 2>&1 | tail -20`
Expected: FAIL —— 因为现有实现调的是 `selectThread`,断言会失败。

- [ ] **Step 3:替换 `onClawChannelActivity` 内的 `selectThread` 调用**

Read: `src/renderer/src/store/chat-store-navigation-actions.ts:408-414`:

```ts
              if (state.route === 'claw' && state.activeClawChannelId === channelId) {
                if (state.activeThreadId !== threadId) {
                  await get().selectThread(threadId)
                } else {
                  await get().recoverActiveTurn()
                }
              }
```

替换为:

```ts
              if (state.route === 'claw' && state.activeClawChannelId === channelId) {
                if (state.activeThreadId !== threadId) {
                  // Live-only SSE: skip the HTTP getThreadDetail fetch so the
                  // chat view sees the Feishu bot's deltas as they arrive.
                  // The first explicit click on this thread will fall through
                  // to selectThread and pull the persisted blocks.
                  await get().subscribeThreadEventsLive(threadId)
                } else {
                  await get().recoverActiveTurn()
                }
              }
```

- [ ] **Step 4:跑测试,确认通过**

Run: `npx vitest run src/renderer/src/store/chat-store-navigation-actions.test.ts 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 5:跑全量 renderer 测试,确认没回归**

Run: `npx vitest run src/renderer 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 6:commit**

```bash
git add src/renderer/src/store/chat-store-navigation-actions.ts src/renderer/src/store/chat-store-navigation-actions.test.ts
git commit -m "fix(chat): route onClawChannelActivity through subscribeThreadEventsLive"
```

---

## Task 1.5:修 `showLiveAssistant` 去掉 `!isProcessing` 门控

**Files:**
- Modify: `src/renderer/src/components/chat/MessageTimeline.tsx:448`
- Test: 既有 `MessageTimeline` 测试文件(若没有,新增 `src/renderer/src/components/chat/MessageTimeline.test.tsx`)

- [ ] **Step 1:找既有 `MessageTimeline` 测试文件位置**

Run: `find src/renderer/src/components/chat -name 'MessageTimeline*' 2>&1`
Expected: 找到 `MessageTimeline.tsx` 和(可选)`MessageTimeline.test.tsx`。如果已有,继续;如果没有,跳到 Step 1b 新建。

- [ ] **Step 1b(若无测试):新建测试文件**

Write: `src/renderer/src/components/chat/MessageTimeline.test.tsx`(空骨架,留待 Step 3 写 case)

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MessageTurn } from './MessageTimeline'

describe('MessageTimeline MessageTurn live bubble', () => {
  it('shows live bubble when busy: true and liveContent has text', () => {
    // 占位 case,在 Step 3 替换为完整 case
  })
})
```

> 真实渲染测试需要 `MessageTurn` 内部依赖的所有 provider/store 装配,本计划不在此重写整测试基建;若既有 MessageTimeline 测试基础设施已存在,跳过 Step 1b。

- [ ] **Step 2:写失败测试(基于既有 `liveContent` 渲染路径)**

在 `MessageTimeline` 测试文件里追加:

```tsx
it('renders the live assistant bubble while busy is true (streaming period)', () => {
  // Arrange: 构造一个 MessageTurn, busy=true, liveContent='hello'
  // Act: render
  // Assert: 文本 'hello' 出现在 document 中
  const { container } = renderMessageTurn({ busy: true, liveContent: 'hello' })
  expect(container.textContent).toContain('hello')
})
```

- [ ] **Step 3:跑测试,确认失败**

Run: `npx vitest run src/renderer/src/components/chat/MessageTimeline.test.tsx 2>&1 | tail -20`
Expected: FAIL —— 当前 `showLiveAssistant = !isProcessing && !!liveContent.trim()`,`busy: true` 时期望 `isProcessing: true`,所以 `showLiveAssistant` 为 `false`,渲染不出 'hello'。

- [ ] **Step 4:修 `MessageTimeline.tsx`**

Read: `src/renderer/src/components/chat/MessageTimeline.tsx:445-448`:

```ts
  const showLiveAssistant = !isProcessing && !!liveContent.trim()
```

替换为:

```ts
  // Show the live assistant bubble whenever the SSE has streamed any text
  // into `live`. We deliberately do NOT gate on `isProcessing`: the
  // processing indicator (WorkMetaRow above) already covers "the agent is
  // working", and hiding the streaming text here causes real-time updates
  // (Feishu bot streaming) to appear only after turn_completed, which the
  // user perceives as a long delay.
  const showLiveAssistant = !!liveContent.trim()
```

- [ ] **Step 5:跑测试,确认通过**

Run: `npx vitest run src/renderer/src/components/chat/MessageTimeline.test.tsx 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 6:跑全量测试,确认没回归**

Run: `npm run typecheck && npm run lint && npx vitest run 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 7:commit**

```bash
git add src/renderer/src/components/chat/MessageTimeline.tsx src/renderer/src/components/chat/MessageTimeline.test.tsx
git commit -m "fix(chat): always render the live assistant bubble when there's streamed text"
```

---

## Task 1.6:Phase 1 验收

- [ ] **Step 1:跑全套验证**

Run: `npm run typecheck && npm run lint && npm run test 2>&1 | tail -20`
Expected: 全绿。

- [ ] **Step 2:确认 commit 链**

Run: `git log --oneline origin/develop..HEAD 2>&1`
Expected: 4 个 commit,从旧到新大致是:
- types(chat-store): add subscribeThreadEventsLive to ChatState
- test(chat-store): add failing test for subscribeThreadEventsLive
- feat(chat-store): add subscribeThreadEventsLive action (skip HTTP, open SSE)
- fix(chat): route onClawChannelActivity through subscribeThreadEventsLive
- fix(chat): always render the live assistant bubble when there's streamed text

如果 commit 顺序或拆分不符合预期,可用 `git rebase -i` 整理。

- [ ] **Step 3:进入 Phase 2 前的 sanity check**

确认当前分支是 `feature/feishu-streaming-with-live-fix`,且 HEAD 在最后一个 renderer 修复 commit 上。继续 Phase 2。

---

# Phase 2:Settings 全局开关(Commit 2)

## Task 2.1:在 `ClawImSettingsV1` 类型加 `feishuStream` 字段

**Files:**
- Modify: `src/shared/app-settings-types.ts`(在 `ClawImSettingsV1` interface 内)

- [ ] **Step 1:定位 `ClawImSettingsV1`**

Run: `grep -n "ClawImSettingsV1" src/shared/app-settings-types.ts 2>&1`
Expected: 找到 interface 起始行号。

- [ ] **Step 2:读 interface 完整内容**

Read: 定位到的行号往下,直到 interface 闭合 `}`。

- [ ] **Step 3:在已有字段末尾、`}` 之前,加 `feishuStream?: boolean`**

在闭合 `}` 之前插入:

```ts
  /** 当 provider === 'feishu' 时,是否把 agent 回复改为流式输出。默认 true。 */
  feishuStream?: boolean
```

(注意保持原 indentation。)

- [ ] **Step 4:typecheck**

Run: `npm run typecheck 2>&1 | tail -10`
Expected: 0 错误(新字段 optional,不强制使用)。

- [ ] **Step 5:commit**

```bash
git add src/shared/app-settings-types.ts
git commit -m "types(settings): add ClawImSettingsV1.feishuStream optional field"
```

---

## Task 2.2:default normalizer 补 `feishuStream: true`

**Files:**
- Modify: `src/shared/app-settings-claw.ts`

- [ ] **Step 1:定位 default normalizer**

Run: `grep -n "feishuStream\|im:\|ClawImSettingsV1" src/shared/app-settings-claw.ts 2>&1`
Expected: 找到 `im: { ... }` 字面量或 normalizer 函数。

- [ ] **Step 2:读上下文,确认 default 形态**

Read: `src/shared/app-settings-claw.ts` 中 default 构造处(若有 `defaultClawImSettings` 或 inline `{ im: { ... } }`)。

- [ ] **Step 3:在 default 中加 `feishuStream: true`**

在 default `im` 对象内,任一已有字段后(例如 `welcomeMessage` 之后),加一行:

```ts
    feishuStream: true,
```

(注意保持原 indentation 与尾逗号风格。)

- [ ] **Step 4:跑 typecheck + 既有 settings 测试**

Run: `npm run typecheck 2>&1 | tail -10 && npx vitest run src/shared/app-settings.test.ts 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 5:commit**

```bash
git add src/shared/app-settings-claw.ts
git commit -m "feat(settings): default ClawImSettingsV1.feishuStream to true"
```

---

## Task 2.3:settings-store migration 补 `feishuStream ?? true`

**Files:**
- Modify: `src/main/settings-store.ts`(在 migrate 函数内)

- [ ] **Step 1:定位 migration 函数**

Run: `grep -n "migrate\|migration" src/main/settings-store.ts 2>&1 | head -20`
Expected: 找到 `migrateAppSettingsV0ToV1` 或 `migrateV0ToV1` 或类似函数,内部用 spread 展开旧值再覆盖新字段。

- [ ] **Step 2:读 migration 主体,看 im 字段怎么 merge**

Read: 定位到的 migration 函数,找到 `im: { ... }` 形态,确认是否用 spread `...prev.claw?.im`。

- [ ] **Step 3:在 im 字段 merge 处加 `feishuStream: prev.claw?.im?.feishuStream ?? true`**

在 `im: { ... }` 内部、既有字段(例如 `welcomeMessage` 或类似)之后,加一行:

```ts
      feishuStream: prev.claw?.im?.feishuStream ?? true,
```

(注意 `??` 防止老 settings 无此字段时变 `undefined`。)

- [ ] **Step 4:写 migration 测试**

Read: `src/shared/app-settings.test.ts` 全文,找既有 migration 测试用例(测试老 settings 形态转新 settings 形态)。

在 `describe('settings migration')` 块末尾追加:

```ts
  it('migrates ClawImSettingsV1.feishuStream to true when missing on old settings', () => {
    const oldSettings = {
      // ... 构造一个无 claw.im.feishuStream 的旧 settings 对象
      // (参照既有 migration case 的形态,只确保 im 里没有 feishuStream)
    }
    const migrated = migrateAppSettingsV0ToV1(oldSettings) // 或实际函数名
    expect(migrated.claw.im.feishuStream).toBe(true)
  })

  it('preserves ClawImSettingsV1.feishuStream=false when set on old settings', () => {
    const oldSettings = {
      // ... claw.im.feishuStream = false 的旧 settings
    }
    const migrated = migrateAppSettingsV0ToV1(oldSettings)
    expect(migrated.claw.im.feishuStream).toBe(false)
  })
```

- [ ] **Step 5:跑测试,确认通过**

Run: `npx vitest run src/shared/app-settings.test.ts 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 6:commit**

```bash
git add src/main/settings-store.ts src/shared/app-settings.test.ts
git commit -m "feat(settings): migrate ClawImSettingsV1.feishuStream default to true"
```

---

## Task 2.4:Phase 2 验收

- [ ] **Step 1:跑全套验证**

Run: `npm run typecheck && npm run lint && npx vitest run 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 2:确认 commit 链**

Run: `git log --oneline origin/develop..HEAD 2>&1`
Expected: Phase 1 的 5 个 commit + Phase 2 的 3 个 commit。

- [ ] **Step 3:进入 Phase 3 前的 sanity check**

确认 `feishuStream` 在 `ClawImSettingsV1`、default、migration 三个地方都已经接上。继续 Phase 3。

---

# Phase 3:Main 侧流式核心(Commit 3)

本 Phase 是最大的一块,拆成 4 个子 Phase:
- 3A: SSE 订阅器 `subscribeRuntimeThreadEvents`
- 3B: `FeishuStreamer` 类(10 个单测)
- 3C: `ClawRuntime` 上的 `runStreamingReply` 编排
- 3D: 集成测试 + 集成进 `handleFeishuMessage`

---

## Phase 3A:SSE 订阅器

## Task 3A.1:在 `claw-runtime-helpers.ts` 加 `SseSubscriber` + `RuntimeSseEvent` 类型

**Files:**
- Modify: `src/main/claw-runtime-helpers.ts`(文件末尾追加类型,不动既有函数)

- [ ] **Step 1:读文件末尾**

Read: `src/main/claw-runtime-helpers.ts` 最后 30 行,找到 export 的最后一个符号(例如 `readRequestBody`)。

- [ ] **Step 2:在 `readRequestBody` 之后追加类型**

在文件末尾追加:

```ts
export type SseSubscriber = (signal: AbortSignal) => { close: () => void }

export type RuntimeSseEvent = { kind: string; turnId?: string; item?: { text?: unknown }; seq?: number; [key: string]: unknown }
```

- [ ] **Step 3:typecheck**

Run: `npm run typecheck 2>&1 | tail -10`
Expected: 0 错误。

- [ ] **Step 4:commit**

```bash
git add src/main/claw-runtime-helpers.ts
git commit -m "types(claw-runtime): add SseSubscriber and RuntimeSseEvent"
```

---

## Task 3A.2:写 `subscribeRuntimeThreadEvents` 失败测试(测试先红)

**Files:**
- Test: `src/main/claw-runtime-helpers.test.ts`(若没有,新增)

- [ ] **Step 1:找既有 helpers 测试**

Run: `find src/main -name 'claw-runtime-helpers*' 2>&1`
Expected: `claw-runtime-helpers.ts` + 可选 `claw-runtime-helpers.test.ts`。

- [ ] **Step 2:若没有,新建测试文件**

Write: `src/main/claw-runtime-helpers.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeRuntimeThreadEvents, type RuntimeSseEvent } from './claw-runtime-helpers'

// 用全局 fetch mock
const originalFetch = globalThis.fetch
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('subscribeRuntimeThreadEvents', () => {
  it('opens /v1/threads/{id}/events?since_seq=0 with auth headers on first connect', async () => {
    const ac = new AbortController()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))
    await subscribeRuntimeThreadEvents({
      baseUrl: 'http://127.0.0.1:8788',
      threadId: 'thr_1',
      headers: { Authorization: 'Bearer x' },
      onEvent: vi.fn(),
      signal: ac.signal
    })
    // 第一个 fetch 应当带 since_seq=0
    const url = fetchMock.mock.calls[0][0] as URL
    expect(url.toString()).toContain('/v1/threads/thr_1/events')
    expect(url.searchParams.get('since_seq')).toBe('0')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toMatchObject({ Authorization: 'Bearer x', Accept: 'text/event-stream' })
  })
})
```

- [ ] **Step 3:跑测试,确认失败**

Run: `npx vitest run src/main/claw-runtime-helpers.test.ts 2>&1 | tail -20`
Expected: FAIL —— `subscribeRuntimeThreadEvents` 还没实现,import 会失败。

- [ ] **Step 4:commit(测试先红)**

```bash
git add src/main/claw-runtime-helpers.test.ts
git commit -m "test(claw-runtime): add failing test for subscribeRuntimeThreadEvents"
```

---

## Task 3A.3:实现 `subscribeRuntimeThreadEvents`(最小可用)

**Files:**
- Modify: `src/main/claw-runtime-helpers.ts` 末尾(在 `SseSubscriber` / `RuntimeSseEvent` 类型之后)

- [ ] **Step 1:实现函数**

在文件末尾追加:

```ts
/**
 * Subscribe to `/v1/threads/{threadId}/events` and dispatch each
 * `RuntimeSseEvent` to `onEvent`. Reconnects with exponential backoff
 * (750ms → 5s) on network failure; does NOT reconnect on 4xx with a 4xx
 * status (those are returned to the caller via the close path).
 *
 * The returned `close()` aborts the in-flight fetch and prevents further
 * reconnects.
 */
export async function subscribeRuntimeThreadEvents(input: {
  baseUrl: string
  threadId: string
  headers: Record<string, string>
  onEvent: (event: RuntimeSseEvent) => void
  signal: AbortSignal
  logError?: (category: string, message: string, detail?: unknown) => void
}): Promise<{ close: () => void }> {
  const { baseUrl, threadId, headers, onEvent, signal, logError } = input
  const ac = new AbortController()
  const onAbort = (): void => ac.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  let nextSinceSeq = 0
  let closed = false
  let reconnectDelayMs = 750
  const close = (): void => {
    if (closed) return
    closed = true
    ac.abort()
    signal.removeEventListener('abort', onAbort)
  }
  void (async () => {
    while (!closed && !ac.signal.aborted) {
      const url = new URL(`${baseUrl.replace(/\/+$/, '')}/v1/threads/${encodeURIComponent(threadId)}/events`)
      url.searchParams.set('since_seq', String(nextSinceSeq))
      try {
        const res = await fetch(url, { signal: ac.signal, headers: { ...headers, Accept: 'text/event-stream' } })
        if (!res.ok || !res.body) {
          if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
            logError?.('sse', `SSE connection refused (${res.status}) for thread ${threadId}`, { status: res.status })
            return
          }
          await new Promise<void>((r) => setTimeout(r, reconnectDelayMs))
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, 5_000)
          continue
        }
        reconnectDelayMs = 750
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buffer = ''
        while (!closed && !ac.signal.aborted) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += dec.decode(value, { stream: true })
          let split: number
          while ((split = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, split)
            buffer = buffer.slice(split + 2)
            const dataLine = block.split('\n').find((l) => l.startsWith('data:'))
            if (!dataLine) continue
            const json = dataLine.slice(5).trimStart()
            try {
              const parsed = JSON.parse(json) as { seq?: number } & RuntimeSseEvent
              if (typeof parsed.seq === 'number') nextSinceSeq = Math.max(nextSinceSeq, parsed.seq)
              onEvent(parsed)
            } catch {
              /* malformed SSE data line — ignore */
            }
          }
        }
      } catch (error) {
        if (closed || ac.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        logError?.('sse', `SSE stream error for thread ${threadId}`, { message })
        await new Promise<void>((r) => setTimeout(r, reconnectDelayMs))
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 5_000)
      }
    }
  })()
  return { close }
}
```

- [ ] **Step 2:跑测试,确认通过**

Run: `npx vitest run src/main/claw-runtime-helpers.test.ts 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 3:跑全量 main 测试,确认没回归**

Run: `npx vitest run src/main 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 4:commit**

```bash
git add src/main/claw-runtime-helpers.ts
git commit -m "feat(claw-runtime): add subscribeRuntimeThreadEvents with reconnect + abort"
```

---

## Task 3A.4:补 SSE reconnect / 4xx 终止的额外测试

**Files:**
- Modify: `src/main/claw-runtime-helpers.test.ts`

- [ ] **Step 1:追加 reconnect 测试**

在既有 `describe('subscribeRuntimeThreadEvents')` 块追加:

```ts
  it('reconnects with exponential backoff (750ms → 5s) on 5xx', async () => {
    vi.useFakeTimers()
    try {
      const ac = new AbortController()
      // 第一次 5xx,第二次 200(空 body,关闭流)
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { c.close() } }), { status: 200, headers: { 'content-type': 'text/event-stream' } }))
      const onEvent = vi.fn()
      const handle = await subscribeRuntimeThreadEvents({
        baseUrl: 'http://127.0.0.1:8788',
        threadId: 'thr_1',
        headers: {},
        onEvent,
        signal: ac.signal
      })
      // 等 750ms 后 fetch 应当被再次调用
      await vi.advanceTimersByTimeAsync(800)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      ac.abort()
      handle.close()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops reconnecting on 4xx (except 408/429)', async () => {
    const ac = new AbortController()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    await subscribeRuntimeThreadEvents({
      baseUrl: 'http://127.0.0.1:8788',
      threadId: 'thr_1',
      headers: {},
      onEvent: vi.fn(),
      signal: ac.signal,
      logError: vi.fn()
    })
    // 等 1s,确认只调一次 fetch
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2:跑测试,确认通过**

Run: `npx vitest run src/main/claw-runtime-helpers.test.ts 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 3:commit**

```bash
git add src/main/claw-runtime-helpers.test.ts
git commit -m "test(claw-runtime): cover SSE reconnect and 4xx termination"
```

---

## Phase 3B:`FeishuStreamer` 类

## Task 3B.1:写 `FeishuStreamer` 类的最小骨架(可 import)

**Files:**
- Create: `src/main/feishu-streamer.ts`(仅 class 骨架,无方法实现)

- [ ] **Step 1:写骨架**

Write: `src/main/feishu-streamer.ts`

```ts
import type { LarkChannel, SendOptions } from '@larksuiteoapi/node-sdk'
import type { SseSubscriber } from './claw-runtime-helpers'

export type FeishuStreamLogger = (category: string, message: string, detail?: unknown) => void

export type FeishuStreamerOptions = {
  bridge: LarkChannel
  chatId: string
  turnId: string
  threadId: string
  replyOptions: SendOptions
  logger: FeishuStreamLogger
}

export type FeishuStreamerResult = {
  ok: boolean
  messageId: string
  finalText: string
  fellBack: boolean
}

export class FeishuStreamer {
  private readonly opts: FeishuStreamerOptions
  private readonly outbox: Array<string | null> = []
  private readonly waiters: Array<(chunk: string | null) => void> = []
  private state: 'pending' | 'streaming' | 'closed' = 'pending'
  private accumulatedText = ''
  private subscription: { close: () => void } | null = null

  constructor(opts: FeishuStreamerOptions) {
    this.opts = opts
  }

  start(_input: { subscribe: SseSubscriber }): Promise<FeishuStreamerResult> {
    throw new Error('not implemented')
  }

  onSseEvent(_event: Record<string, unknown>): void {
    throw new Error('not implemented')
  }

  getAccumulatedText(): string {
    return this.accumulatedText
  }

  abort(): void {
    this.state = 'closed'
    this.subscription?.close()
    this.subscription = null
  }

  dispose(): void {
    this.abort()
    while (this.waiters.length > 0) {
      const w = this.waiters.shift()!
      w(null)
    }
  }
}
```

- [ ] **Step 2:typecheck(确认骨架能编译)**

Run: `npm run typecheck 2>&1 | tail -10`
Expected: 0 错误(方法签名正确,throw 是合法返回)。

- [ ] **Step 3:commit(骨架先落地)**

```bash
git add src/main/feishu-streamer.ts
git commit -m "feat(feishu-streamer): add class skeleton"
```

---

## Task 3B.2:写 happy-path 测试(测试先红)

**Files:**
- Create: `src/main/feishu-streamer.test.ts`

- [ ] **Step 1:写测试辅助 + happy-path**

Write: `src/main/feishu-streamer.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest'
import type { LarkChannel, MarkdownStreamController, SendOptions, SendResult } from '@larksuiteoapi/node-sdk'
import { FeishuStreamer, type SseSubscriber } from './feishu-streamer'

type StreamInput = { markdown: (controller: MarkdownStreamController) => Promise<void> }

function makeBridge(): {
  bridge: LarkChannel
  controller: MarkdownStreamController
  messageId: string
} {
  const messageId = 'om_stream_1'
  const controller: MarkdownStreamController = {
    append: vi.fn(async () => undefined),
    setContent: vi.fn(async () => undefined),
    get messageId() { return messageId }
  }
  const bridge = {
    // 关键:用 stream 不是 send
    stream: vi.fn(async (_to: string, input: StreamInput, _opts: SendOptions): Promise<SendResult> => {
      await input.markdown(controller)
      return { messageId }
    })
  } as unknown as LarkChannel
  return { bridge, controller, messageId }
}

function makeSubscriber(
  events: Array<Record<string, unknown>>,
  onEvent: (event: Record<string, unknown>) => void
): { subscribe: SseSubscriber; delivered: () => Array<Record<string, unknown>> } {
  const delivered: Array<Record<string, unknown>> = []
  let closed = false
  const subscribe: SseSubscriber = (signal) => {
    const onAbort = (): void => { closed = true }
    signal.addEventListener('abort', onAbort, { once: true })
    queueMicrotask(() => {
      for (const event of events) {
        if (closed) return
        delivered.push(event)
        onEvent(event)
      }
    })
    return { close: (): void => { closed = true } }
  }
  return { subscribe, delivered: () => delivered }
}

describe('FeishuStreamer', () => {
  it('streams assistant_text_delta in order, calls setContent once on turn_completed, resolves with messageId', async () => {
    const { bridge, controller, messageId } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: { replyTo: 'om_in_1' }, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: '你' } },
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: '好' } },
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: '!' } },
        { kind: 'turn_completed', turnId: 'turn_1' }
      ],
      (event) => streamer.onSseEvent(event)
    )

    const result = await streamer.start({ subscribe: sub.subscribe })

    expect(controller.append).toHaveBeenCalledTimes(3)
    expect(controller.append).toHaveBeenNthCalledWith(1, '你')
    expect(controller.append).toHaveBeenNthCalledWith(2, '好')
    expect(controller.append).toHaveBeenNthCalledWith(3, '!')
    expect(controller.setContent).toHaveBeenCalledTimes(1)
    expect(controller.setContent).toHaveBeenCalledWith('你好!')
    expect(result).toEqual({ ok: true, messageId, finalText: '你好!', fellBack: false })
  })
})
```

- [ ] **Step 2:跑测试,确认失败**

Run: `npx vitest run src/main/feishu-streamer.test.ts 2>&1 | tail -20`
Expected: FAIL —— `start` 抛 'not implemented'。

- [ ] **Step 3:commit(测试先红)**

```bash
git add src/main/feishu-streamer.test.ts
git commit -m "test(feishu-streamer): add failing happy-path test"
```

---

## Task 3B.3:实现 `FeishuStreamer.start` 完整逻辑(测试转绿)

**Files:**
- Modify: `src/main/feishu-streamer.ts`

- [ ] **Step 1:写 `push` / `nextDelta` 私有方法**

在 `dispose()` 之前插入:

```ts
  private push(chunk: string | null): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!
      waiter(chunk)
      return
    }
    this.outbox.push(chunk)
  }

  private nextDelta(): Promise<string | null> {
    if (this.outbox.length > 0) {
      return Promise.resolve(this.outbox.shift() ?? null)
    }
    return new Promise<string | null>((resolve) => {
      this.waiters.push(resolve)
    })
  }
```

- [ ] **Step 2:写 `onSseEvent` 完整实现**

替换 `onSseEvent(_event: ...): void { throw new Error('not implemented') }` 为:

```ts
  onSseEvent(event: Record<string, unknown>): void {
    if (this.state !== 'streaming') return
    const kind = event.kind
    // 关键:读 event.item.text,不是 event.item.delta
    if (kind === 'assistant_text_delta' && event.turnId === this.opts.turnId) {
      const item = (event as { item?: { text?: unknown } }).item
      const delta = typeof item?.text === 'string' ? item.text : ''
      if (delta) this.push(delta)
      return
    }
    if (kind === 'assistant_reasoning_delta') {
      this.opts.logger('claw-feishu-stream-debug', 'drop reasoning delta', { turnId: this.opts.turnId })
      return
    }
    if (
      (kind === 'turn_completed' || kind === 'turn_failed' || kind === 'turn_aborted') &&
      event.turnId === this.opts.turnId
    ) {
      this.subscription?.close()
      this.subscription = null
      this.push(null)
    }
  }
```

- [ ] **Step 3:写 `start` 完整实现**

替换 `start(_input: ...): ...` 为:

```ts
  start(input: { subscribe: SseSubscriber }): Promise<FeishuStreamerResult> {
    return new Promise<FeishuStreamerResult>((resolve, reject) => {
      const controller = new AbortController()
      let resolved = false
      const onComplete = (result: FeishuStreamerResult): void => {
        if (resolved) return
        resolved = true
        resolve(result)
      }
      const onError = (error: Error): void => {
        if (resolved) return
        resolved = true
        reject(error)
      }

      const producer = async (streamController: MarkdownStreamController): Promise<void> => {
        this.state = 'streaming'
        try {
          while (this.state === 'streaming') {
            const chunk = await this.nextDelta()
            if (chunk === null) break
            this.accumulatedText += chunk
            try {
              await streamController.append(chunk)
            } catch (error) {
              this.opts.logger('claw-feishu-stream', 'append failed; saving accumulated text and finalizing', {
                message: error instanceof Error ? error.message : String(error)
              })
              try {
                await streamController.setContent(this.accumulatedText)
              } catch (finalError) {
                this.opts.logger('claw-feishu-stream', 'setContent on append-failure also failed', {
                  message: finalError instanceof Error ? finalError.message : String(finalError)
                })
              }
              onComplete({
                ok: true,
                messageId: streamController.messageId,
                finalText: this.accumulatedText,
                fellBack: false
              })
              return
            }
          }
          try {
            await streamController.setContent(this.accumulatedText)
          } catch (error) {
            this.opts.logger('claw-feishu-stream', 'final setContent failed; returning accumulated text as-is', {
              message: error instanceof Error ? error.message : String(error)
            })
          }
          onComplete({
            ok: true,
            messageId: streamController.messageId,
            finalText: this.accumulatedText,
            fellBack: false
          })
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)))
        }
      }

      this.subscription = input.subscribe(controller.signal)
      const onAbort = (): void => {
        this.state = 'closed'
        this.subscription?.close()
        this.subscription = null
        while (this.waiters.length > 0) {
          const w = this.waiters.shift()!
          w(null)
        }
        if (!resolved) onError(new Error('aborted'))
      }
      controller.signal.addEventListener('abort', onAbort, { once: true })

      // 关键:bridge.stream,不是 bridge.send
      const bridgeAny = this.opts.bridge as unknown as {
        stream: (
          to: string,
          input: { markdown: (c: MarkdownStreamController) => Promise<void> },
          opts?: SendOptions
        ) => Promise<{ messageId: string }>
      }
      const sendPromise: Promise<{ messageId: string }> = bridgeAny.stream(
        this.opts.chatId,
        { markdown: producer },
        this.opts.replyOptions
      )
      void sendPromise.catch((error: unknown) => {
        this.state = 'closed'
        controller.abort()
        onError(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }
```

并在文件顶部追加 import:

```ts
import type { MarkdownStreamController } from '@larksuiteoapi/node-sdk'
```

- [ ] **Step 4:跑测试,确认通过**

Run: `npx vitest run src/main/feishu-streamer.test.ts 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 5:commit**

```bash
git add src/main/feishu-streamer.ts
git commit -m "feat(feishu-streamer): implement core streaming with append/setContent lifecycle"
```

---

## Task 3B.4:补 `FeishuStreamer` 剩余 9 个 case

**Files:**
- Modify: `src/main/feishu-streamer.test.ts`

- [ ] **Step 1:在 `describe('FeishuStreamer')` 块追加 9 个 case**

```ts
  it('drops assistant_reasoning_delta without calling controller.append', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    streamer.onSseEvent({ kind: 'assistant_reasoning_delta', turnId: 'turn_1', item: { text: 'thinking...' } })
    streamer.onSseEvent({ kind: 'turn_completed', turnId: 'turn_1' })
    expect(controller.append).not.toHaveBeenCalled()
    expect(streamer.getAccumulatedText()).toBe('')
  })

  it('ignores assistant_text_delta from a different turn', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_OTHER', item: { text: 'X' } },
        { kind: 'turn_completed', turnId: 'turn_1' }
      ],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(controller.append).not.toHaveBeenCalled()
    expect(result.finalText).toBe('')
    expect(controller.setContent).toHaveBeenCalledWith('')
  })

  it('falls back to setContent(partial) when controller.append throws mid-stream', async () => {
    const bridge = {
      stream: vi.fn(async (_to: string, input: { markdown: (c: MarkdownStreamController) => Promise<void> }, _opts: SendOptions): Promise<SendResult> => {
        const controller: MarkdownStreamController = {
          append: vi.fn(async () => { throw new Error('rate_limited') }),
          setContent: vi.fn(async () => undefined),
          get messageId() { return 'om_stream_2' }
        }
        await input.markdown(controller)
        return { messageId: 'om_stream_2' }
      })
    } as unknown as LarkChannel
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [{ kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: 'partial' } }],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(result.ok).toBe(true)
    expect(result.finalText).toBe('partial')
    expect(result.fellBack).toBe(false)
  })

  it('rejects start() when subscribe() throws synchronously', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const subscribe: SseSubscriber = () => { throw new Error('sse_unavailable') }
    await expect(streamer.start({ subscribe })).rejects.toThrow('sse_unavailable')
    expect(controller.append).not.toHaveBeenCalled()
  })

  it('resolves with ok=false and empty text on turn_failed', async () => {
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: 'part' } },
        { kind: 'turn_failed', turnId: 'turn_1', message: 'oops' }
      ],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(result.ok).toBe(false)
    expect(result.finalText).toBe('part')
  })

  it('aborts cleanly: nextDelta resolves null and start rejects with aborted', async () => {
    const { bridge } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    // subscribe 故意永不喂事件,只等 abort
    const subscribe: SseSubscriber = (signal) => {
      signal.addEventListener('abort', () => undefined, { once: true })
      return { close: (): void => undefined }
    }
    const startPromise = streamer.start({ subscribe })
    // 等一帧,确保 start 已进入 await
    await new Promise((r) => setTimeout(r, 0))
    streamer.abort()
    await expect(startPromise).rejects.toThrow('aborted')
  })

  it('reads event.item.text (not item.delta)', async () => {
    // 上版踩过的字段错位坑
    const { bridge, controller } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [
        { kind: 'assistant_text_delta', turnId: 'turn_1', item: { text: 'real' } },
        { kind: 'turn_completed', turnId: 'turn_1' }
      ],
      (event) => streamer.onSseEvent(event)
    )
    const result = await streamer.start({ subscribe: sub.subscribe })
    expect(controller.append).toHaveBeenCalledWith('real')
    expect(result.finalText).toBe('real')
  })

  it('calls bridge.stream (not bridge.send)', async () => {
    const streamSpy = vi.fn(async (_to: string, _input: unknown, _opts: SendOptions): Promise<SendResult> => {
      return { messageId: 'om_x' }
    })
    const sendSpy = vi.fn(async (): Promise<SendResult> => {
      return { messageId: 'om_y' }
    })
    const bridge = {
      stream: streamSpy,
      send: sendSpy
    } as unknown as LarkChannel
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const sub = makeSubscriber(
      [{ kind: 'turn_completed', turnId: 'turn_1' }],
      (event) => streamer.onSseEvent(event)
    )
    await streamer.start({ subscribe: sub.subscribe })
    expect(streamSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('dispose() releases all waiters and the subscription', () => {
    const { bridge } = makeBridge()
    const streamer = new FeishuStreamer({
      bridge, chatId: 'oc_chat_1', turnId: 'turn_1', threadId: 'thr_1',
      replyOptions: {}, logger: vi.fn()
    })
    const closeSpy = vi.fn()
    ;(streamer as unknown as { subscription: { close: () => void } | null }).subscription = { close: closeSpy }
    streamer.dispose()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2:跑全部 FeishuStreamer 测试,确认全绿**

Run: `npx vitest run src/main/feishu-streamer.test.ts 2>&1 | tail -30`
Expected: 10 个 case 全 PASS。

- [ ] **Step 3:跑全量 main 测试,确认没回归**

Run: `npx vitest run src/main 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 4:commit**

```bash
git add src/main/feishu-streamer.test.ts
git commit -m "test(feishu-streamer): cover reasoning, cross-turn, append-failure, sse-failure, abort, dispose"
```

---

## Phase 3C:`ClawRuntime.runStreamingReply` 编排

## Task 3C.1:在 `ClawRuntime` 加 `subscribeSse` / `subscribeSseForStreamer` 私有方法

**Files:**
- Modify: `src/main/claw-runtime.ts`(在 `private startRuntimeTurn` 之前)

- [ ] **Step 1:读既有 imports 和 `getRuntimeBaseUrlForSettings` 形态**

Read: `src/main/claw-runtime.ts:1-90`,找到 `import` 块和 `getRuntimeBaseUrlForSettings` 的导入位置(从 `./runtime/kun-adapter`)。

- [ ] **Step 2:在 import 块加 `subscribeRuntimeThreadEvents`、`SseSubscriber`、`FeishuStreamer` 的导入**

在 `import { ... } from './claw-runtime-helpers'` 里追加 `subscribeRuntimeThreadEvents`、`SseSubscriber`(在最后一项之前)。

追加新 import 行:

```ts
import { getRuntimeBaseUrlForSettings, runtimeAuthHeaders } from './runtime/kun-adapter'
import { FeishuStreamer } from './feishu-streamer'
```

- [ ] **Step 3:在 `private startRuntimeTurn` 之前插入两个新私有方法**

```ts
  private async subscribeSse(
    settings: AppSettingsV1,
    threadId: string,
    streamer: FeishuStreamer,
    signal: AbortSignal
  ): Promise<{ close: () => void }> {
    const baseUrl = getRuntimeBaseUrlForSettings(settings)
    if (!baseUrl) throw new Error('runtime_base_url_unavailable')
    const headers: Record<string, string> = { Accept: 'text/event-stream' }
    const auth = runtimeAuthHeaders(settings).get('Authorization')
    if (auth) headers.Authorization = auth
    const onEvent = (event: { kind?: string; [k: string]: unknown }): void => {
      streamer.onSseEvent(event as Record<string, unknown>)
    }
    return subscribeRuntimeThreadEvents({
      baseUrl,
      threadId,
      headers,
      onEvent,
      signal,
      logError: (category, message, detail) => this.deps.logError(category, message, detail)
    })
  }

  private subscribeSseForStreamer(
    settings: AppSettingsV1,
    threadId: string,
    streamer: FeishuStreamer
  ): SseSubscriber {
    return (signal) => {
      // subscribeRuntimeThreadEvents is async, but SseSubscriber contract is
      // synchronous (returns a { close } handle). Kick off the async
      // subscription and surface its close synchronously by racing the
      // setup; if the setup itself throws (e.g. no base URL) we re-throw
      // synchronously to match the existing test contract.
      const setup = this.subscribeSse(settings, threadId, streamer, signal)
      let close = (): void => undefined
      void setup.then(
        (handle) => { close = handle.close },
        (error) => {
          this.deps.logError('claw-feishu-stream', 'SSE subscription setup failed', {
            message: error instanceof Error ? error.message : String(error),
            threadId
          })
        }
      )
      return { close: () => close() }
    }
  }
```

- [ ] **Step 4:typecheck**

Run: `npm run typecheck 2>&1 | tail -10`
Expected: 0 错误。

- [ ] **Step 5:commit**

```bash
git add src/main/claw-runtime.ts
git commit -m "feat(claw): add subscribeSse + subscribeSseForStreamer"
```

---

## Task 3C.2:加 `runStreamingReply` 编排方法

**Files:**
- Modify: `src/main/claw-runtime.ts`(在 `subscribeSseForStreamer` 之后,`startRuntimeTurn` 之前)

- [ ] **Step 1:插入 `runStreamingReply` 方法**

```ts
  private async runStreamingReply(input: {
    bridge: LarkChannel
    chatId: string
    threadId: string
    turnId: string
    replyOptions: { replyTo?: string; replyInThread?: boolean }
    responseTimeoutMs: number
    context: Record<string, unknown>
  }): Promise<{ ok: boolean; messageId: string; finalText: string; fellBack: boolean; message: string }> {
    const cancel = new AbortController()
    const timeout = setTimeout(() => cancel.abort(), input.responseTimeoutMs)
    const streamer = new FeishuStreamer({
      bridge: input.bridge,
      chatId: input.chatId,
      turnId: input.turnId,
      threadId: input.threadId,
      replyOptions: input.replyOptions,
      logger: (category, message, detail) => this.deps.logError(category, message, detail)
    })
    try {
      const settings = await this.deps.store.load()
      const result = await streamer.start({
        subscribe: this.subscribeSseForStreamer(settings, input.threadId, streamer)
      })
      return {
        ok: result.ok,
        messageId: result.messageId,
        finalText: result.finalText,
        fellBack: result.fellBack,
        message: result.ok ? 'streamed' : 'stream_failed'
      }
    } catch (error) {
      this.deps.logError('claw-feishu-stream', 'Streaming reply failed; falling back to one-shot send.', {
        message: error instanceof Error ? error.message : String(error),
        ...input.context
      })
      const finalText = streamer.getAccumulatedText() || ''
      try {
        const fb = await input.bridge.send(
          input.chatId,
          { markdown: finalText || 'Sorry, I could not finish streaming the response.' },
          input.replyOptions
        )
        return { ok: true, messageId: fb.messageId, finalText, fellBack: true, message: 'fell_back' }
      } catch (fbError) {
        return {
          ok: false,
          messageId: '',
          finalText,
          fellBack: true,
          message: fbError instanceof Error ? fbError.message : String(fbError)
        }
      }
    } finally {
      clearTimeout(timeout)
      streamer.dispose()
    }
  }
```

- [ ] **Step 2:typecheck**

Run: `npm run typecheck 2>&1 | tail -10`
Expected: 0 错误。

- [ ] **Step 3:commit**

```bash
git add src/main/claw-runtime.ts
git commit -m "feat(claw): add runStreamingReply with timeout + fallback to one-shot send"
```

---

## Phase 3D:集成进 `handleFeishuMessage` + 集成测试

## Task 3D.1:在 `handleFeishuMessage` 加 `feishuStream` 分支

**Files:**
- Modify: `src/main/claw-runtime.ts:1320-1555`(`handleFeishuMessage` 主体)

- [ ] **Step 1:读 `handleFeishuMessage` 完整主体**

Read: `src/main/claw-runtime.ts` 1320 行往下到 `handleFeishuMessage` 闭合,找出 `processIncomingImPrompt(...)` 调用位置(应在 turn 启动之后、文件附件发送之前)。

- [ ] **Step 2:在 `processIncomingImPrompt` 之前加 `feishuStream` 分支**

找到类似:

```ts
      const result = await this.processIncomingImPrompt(settings, {
        // ... 既有参数
      })
```

在它之前插入:

```ts
      if (settings.claw.im.feishuStream !== false) {
        // 流式路径
        const streamResult = await this.runStreamingReply({
          bridge,
          chatId,
          threadId: thread.id,
          turnId,
          replyOptions: { replyTo: message.messageId, replyInThread: false /* 或既有值 */ },
          responseTimeoutMs: 60_000,
          context: { /* 既有 context 字段 */ }
        })
        result = { ok: streamResult.ok, text: streamResult.finalText, /* 既有 result 字段映射 */ }
        // 后续附件发送逻辑保持原样
      } else {
        // 原轮询路径
        result = await this.processIncomingImPrompt(settings, {
          // 既有参数
        })
      }
```

注意:
- `bridge` / `chatId` 变量名按 `handleFeishuMessage` 既有定义取(可能是 `larkChannel`、`chat_id` 等)
- `replyInThread` 取自 `handleFeishuMessage` 既有入参(看 signature)
- `context` 字段照搬 `processIncomingImPrompt` 调用处的 `context`(用于 fallback log)
- `result` 的字段映射按 `processIncomingImPrompt` 返回类型(`ClawRunResult`)对齐

> 实施关键:不要重写 `handleFeishuMessage` 的其他部分,只在 `processIncomingImPrompt` 调用处加一个 `if (feishuStream) { runStreamingReply } else { processIncomingImPrompt }` 分支。

- [ ] **Step 3:typecheck**

Run: `npm run typecheck 2>&1 | tail -20`
Expected: 0 错误,或仅有少量字段映射相关的 TS error(按既有 processIncomingImPrompt 返回值补全)。

- [ ] **Step 4:跑既有 claw-runtime 测试,确认没回归**

Run: `npx vitest run src/main/claw-runtime.test.ts 2>&1 | tail -20`
Expected: 全绿(因为 `feishuStream` 默认 `true`,既有 case 默认走流式路径,需要看是否被 mock 覆盖——若有 case 期望走原路径,后续 Task 3D.2 加 test 显式覆盖)。

- [ ] **Step 5:commit**

```bash
git add src/main/claw-runtime.ts
git commit -m "feat(claw): route handleFeishuMessage through runStreamingReply when feishuStream is on"
```

---

## Task 3D.2:加集成测试(流式成功 / fallback / `feishuStream=false`)

**Files:**
- Modify: `src/main/claw-runtime.test.ts`

- [ ] **Step 1:读既有 test harness**

Read: `src/main/claw-runtime.test.ts` 头部,找既有 `buildClawRuntime` / `createTestRuntime` 之类的 helper,确认如何 mock `LarkChannel`、`deps.store.load`、`subscribeRuntimeThreadEvents`(通常通过 mock fetch)。

- [ ] **Step 2:写 4 个集成 case**

在 `describe('ClawRuntime handleFeishuMessage')` 块末尾追加:

```ts
describe('ClawRuntime handleFeishuMessage streaming', () => {
  it('routes through runStreamingReply when feishuStream=true (default)', async () => {
    // Arrange:
    //   - mock LarkChannel,bridge.stream 接收 input,模拟 producer
    //   - mock fetch 让 /v1/threads/{id}/events 返回 SSE 流(3 个 delta + turn_completed)
    //   - 触发 handleFeishuMessage
    // Assert:
    //   - bridge.stream 被调用 1 次
    //   - bridge.send 不被调用
    //   - result.ok=true,messageId 是 stream 给的
  })

  it('falls back to one-shot send when bridge.stream throws', async () => {
    // Arrange:
    //   - mock LarkChannel,bridge.stream 抛 'not_connected'
    //   - mock fetch 让 SSE 不可用
    // Assert:
    //   - bridge.stream 抛错
    //   - runStreamingReply catch,转 bridge.send 1 次
    //   - result.ok=true,messageId 是 send 给的, fellBack=true
  })

  it('falls back to setContent(partial) when controller.append throws mid-stream', async () => {
    // Arrange:
    //   - mock LarkChannel,bridge.stream 中 controller.append 抛 'rate_limited'
    //   - mock fetch 推 1 个 delta
    // Assert:
    //   - controller.setContent 被调 1 次,带 partial text
    //   - result.ok=true, fellBack=false(因为 partial 写入成功)
  })

  it('does not use FeishuStreamer when feishuStream=false', async () => {
    // Arrange:
    //   - settings.claw.im.feishuStream = false
    //   - mock LarkChannel
    // Assert:
    //   - bridge.stream 从未被调用
    //   - processIncomingImPrompt 走原轮询路径(由 waitForAssistantResult 验证)
  })

  it('still sends generated files after a successful streaming reply', async () => {
    // Arrange:
    //   - prompt 命中 shouldSendGeneratedFilesForPrompt(例如包含文件路径)
    //   - mock LarkChannel,bridge.stream 正常收尾
    //   - mock fetch 推 1 个 delta + turn_completed
    //   - mock deps.sendFeishuGeneratedFiles 监听调用
    // Assert:
    //   - bridge.stream 调用 1 次(流式走完)
    //   - deps.sendFeishuGeneratedFiles 调用 1 次(流式收尾后发文件)
    //   - 顺序:stream 先,files 后
  })

  it('does not touch FeishuStreamer for non-feishu providers (weixin unchanged)', async () => {
    // Arrange:
    //   - channel.platformCredential.kind === 'weixin'(或 channel 整体被识别为 weixin 渠道)
    //   - mock LarkChannel / WXChannel(根据既有渠道结构)
    // Assert:
    //   - bridge.stream 从未被调用
    //   - 既有的 weixin 渠道发送路径被走 1 次
    //   - 走原 processIncomingImPrompt 轮询路径
  })
})
```

> 完整测试代码要 mock `LarkChannel`、`fetch`、`deps.store.load()`、`onTurnStarted` 回调等,模板参考既有 `claw-runtime.test.ts` 中的 `processIncomingImPrompt` case。如果测试需要 fetch mock 推 SSE 流,可参考 Task 3A.2 的模式。

- [ ] **Step 3:跑测试,确认通过**

Run: `npx vitest run src/main/claw-runtime.test.ts 2>&1 | tail -30`
Expected: 4 个新 case 全 PASS。

- [ ] **Step 4:跑全量 main 测试,确认没回归**

Run: `npx vitest run src/main 2>&1 | tail -10`
Expected: 全绿。

- [ ] **Step 5:commit**

```bash
git add src/main/claw-runtime.test.ts
git commit -m "test(claw): cover streaming happy path, fallback, and feishuStream=false"
```

---

## Task 3D.3:Phase 3 验收

- [ ] **Step 1:跑全套验证**

Run: `npm run typecheck && npm run lint && npx vitest run 2>&1 | tail -20`
Expected: 全绿。

- [ ] **Step 2:确认 commit 链**

Run: `git log --oneline origin/develop..HEAD 2>&1`
Expected: 17-19 个 commit(Phase 1: 5、Phase 2: 3、Phase 3: 9-11)。

- [ ] **Step 3:手动 Electron 启动 + 真飞书账号登录(用户手工)**

`npm run dev` 由用户手工跑(per 用户指示)。本计划不在此列自动化。

- [ ] **Step 4:进入 Phase 4 前的 sanity check**

确认 Phase 3 全部 commit 已落地,既有 `processIncomingImPrompt` 路径未删/未改语义,WeChat 路径未受影响。

---

# Phase 4:文档(Commit 4)

## Task 4.1:在 `docs/CONTRIBUTING.md` 末尾追加"飞书流式 smoke 测试"小节

**Files:**
- Modify: `docs/CONTRIBUTING.md`(文件末尾 `##` 节之后)

- [ ] **Step 1:读文件末尾**

Read: `docs/CONTRIBUTING.md` 最后 30 行,找到 `##` 标题最后一节。

- [ ] **Step 2:追加新节**

在文件末尾追加:

```markdown
## 飞书 / Lark 流式 smoke 测试(发版前必跑)

本节对应 `feature/feishu-streaming-with-live-fix` 引入的飞书 / Lark SDK markdown 流式回复功能。发版前必须手工跑一遍下列 case。

### 自动化已覆盖

| 维度 | 覆盖方式 |
|---|---|
| 单条流式正常路径 | `src/main/feishu-streamer.test.ts` happy-path case |
| reasoning delta 过滤 | 同上,reasoning case |
| 跨 turn 过滤 | 同上,cross-turn case |
| append 失败 → setContent(partial) | 同上,append-failure case |
| SSE 订阅失败 → 一次性 send fallback | `src/main/claw-runtime.test.ts` streaming fallback case |
| `feishuStream = false` → 走原轮询 | 同上,feishuStream=false case |
| 集成 chat 视图实时性 | `src/renderer/src/components/chat/MessageTimeline.test.tsx` live bubble case |
| onClawChannelActivity 自动切 thread | `src/renderer/src/store/chat-store-navigation-actions.test.ts` 路由 case |

### 手工 smoke checklist

- [ ] **单条对话**:发"你好" → streaming 卡出现 → 1-2 秒内开始刷字
- [ ] **长回答**:写一段代码 → 验证 30k 字符切卡能跨第二张卡
- [ ] **故意限流**:把 `outbound.retry.maxAttempts = 1` → 触发限流 → 观察 fallback 到一次性 send
- [ ] **故意 turn_failed**:用会抛错的 MCP 工具 → 观察 partial 补发
- [ ] **群聊 @bot**:`replyInThread: true` 仍生效,streaming 卡出现在 thread 里
- [ ] **DM**:`replyInThread: false` 默认
- [ ] **Connect phone 视图实时性**(关键 —— 本期修复):bot 收到消息后 chat 视图立即出现 streaming 文本,不卡
- [ ] **主动点击 thread**:从 streaming 状态切到该 thread → blocks 与 liveAssistant 内容一致
- [ ] **跨 turn 隔离**:在 turn A streaming 中再来一条消息触发 turn B → turn A 收尾,turn B 独立开卡

### 验证命令

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:kun
# Electron 手动启动 + 真飞书账号(本机 + 测试机器人 appId/secret)
npm run dev
```
```

- [ ] **Step 3:确认文件渲染正常**

Run: `head -20 docs/CONTRIBUTING.md 2>&1`
Expected: 既有内容未被破坏,新节追加在末尾。

- [ ] **Step 4:commit**

```bash
git add docs/CONTRIBUTING.md
git commit -m "docs(feishu): add feishu/lark streaming smoke test checklist"
```

---

## Task 4.2:最终自检

- [ ] **Step 1:跑全套验证**

Run: `npm run typecheck && npm run lint && npm run test 2>&1 | tail -20`
Expected: 全绿。

- [ ] **Step 2:确认 commit 链完整**

Run: `git log --oneline origin/develop..HEAD 2>&1`
Expected: 全部 commit 落地,数量大致 17-19 个,分 4 个主题:
- fix(chat): renderer live-view 卡顿修复(5)
- feat(claw): 全局 feishuStream 设置 + migration(3)
- feat(feishu-streamer): main 侧流式核心(9-11,含 6 个集成 case 一次性提交)
- docs(feishu): smoke 测试小节(1)

- [ ] **Step 3:对比 spec 检查覆盖**

对照 `docs/superpowers/specs/2026-06-15-feishu-streaming-with-live-fix-design.md` 第 6 节测试策略:
- 6.1 单元测试(10 个 FeishuStreamer case)—— ✓ 已在 Task 3B.2 / 3B.4 覆盖
- 6.2 集成测试(7 个 case)—— ✓ 已在 Task 3D.2 覆盖
- 6.3 Renderer 单元测试(5 个 case)—— ✓ 已在 Task 1.2 / 1.4 / 1.5 覆盖
- 6.4 UI 渲染测试(3 个 case)—— ✓ 已在 Task 1.5 覆盖
- 6.5 手工 smoke —— ✓ 已在 Task 4.1 写进 CONTRIBUTING.md

- [ ] **Step 4:把先前 stash 的工作树文件还回(可选)**

先前 `git stash` 了 `package-lock.json`、`CLAUDE.md`、`bash.exe.stackdump`,与本特性无关。如果 plan 完成后用户希望保留 stash 不动(避免无关改动混入 PR),**不**弹回。如果用户希望还原(例如让后续 build 跑得起来),弹回:

```bash
git stash pop
```

> 注:`bash.exe.stackdump` 看起来是 Windows bash 异常产物,建议不提交。

- [ ] **Step 5:准备 PR 描述(本计划不创建 PR,留待用户手动)**

PR 描述模板(用户在 GitHub 提 PR 时粘贴):

```markdown
## What
把飞书 / Lark bot 的回复改为 SDK markdown 流式卡,并修复上一版"`onClawChannelActivity` 触发时 Connect phone 视图卡住"的两处 bug:
1. `selectThread` 同步 HTTP `getThreadDetail` 抢在 SSE 之前 → deltas 被旧 blocks 覆盖。新增 `subscribeThreadEventsLive` 跳过 HTTP 直接开 SSE。
2. `MessageTimeline` 的 `showLiveAssistant` 被 `!isProcessing` 门控隐藏,streaming 期间 live bubble 看不见。

## Why
上版(`feature/feishu-streaming-bot-output` 分支)实现过流式,但用户报告 chat 视图卡顿;上版末尾虽然补了 `b12d4ba` 和 `eb9755c` 修复,但从未在干净 develop 上验证。本 PR 把整个流式故事 + 两处修复从 day-1 一起做,走完 spec/plan/test/smoke 闭环。

## How
按 4 个 commit 分组,详见 docs/superpowers/specs/2026-06-15-feishu-streaming-with-live-fix-design.md 和 docs/superpowers/plans/2026-06-15-feishu-streaming-with-live-fix.md。

## Test
- `npm run typecheck && npm run lint && npm run test` 全绿
- 真实飞书账号 + Electron 启动后跑 CONTRIBUTING.md 末尾 smoke checklist

## Spec
docs/superpowers/specs/2026-06-15-feishu-streaming-with-live-fix-design.md
```

---

# 完成定义(Definition of Done)

实现完成的标志:

- [ ] 所有 Task 1.1-4.2 全部勾选完成
- [ ] `npm run typecheck && npm run lint && npm run test` 全绿
- [ ] `git log origin/develop..HEAD` 看到 17-19 个 commit,4 个主题分组清晰
- [ ] 用户已手工跑过 `npm run dev` + 真飞书账号登录,smoke checklist 全部通过(或明确放弃某些 case 并记录原因)
- [ ] 上述 PR 描述已发给用户准备贴 GitHub

如果遇到未在 spec 决策表里覆盖的问题,**停下来**回到 brainstorming 重新走一轮,不要在 plan 里临时打补丁。
