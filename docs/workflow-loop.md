# Loop 循环节点 —— 让 agent 自己转圈，而不是你按回车

> 适用于「创建loop / Workflows」里的 **Loop（循环）节点**。
> 实现在 [`src/main/workflow-runtime.ts`](../src/main/workflow-runtime.ts)（`executeNode` 的 `case 'loop'`），配置归一化在 [`src/shared/app-settings-workflow.ts`](../src/shared/app-settings-workflow.ts)，测试在 [`src/main/workflow-runtime.nodes.test.ts`](../src/main/workflow-runtime.nodes.test.ts)。

---

## 先理清三个容易混的名字

| 名字 | 是什么 |
| --- | --- |
| **创建loop（Create Loop）** | **一整个工作流**本身。产品里一个工作流就叫一个「创建loop」。 |
| **Loop（循环）节点** | 工作流里的**一个节点**，把另一个「创建loop」当成**循环体反复执行**。本文讲的就是它。 |
| **运行创建loop（子工作流）节点** | 把另一个「创建loop」**只跑一次**（不循环、不反馈）。 |

一句话区分：**子工作流 = 跑一次；Loop 节点 = 反复跑 + 把结果折回去（或对一组元素各跑一遍）。**

---

## 核心思想：循环驱动 agent，而不是人驱动 agent

传统的对话式 agent 是这样的：

```
你打字 → agent 回答 → 你读 → 你决定下一步 → 你再打字 → …
```

注意循环在哪儿：**循环在「你」身上**。每一轮都靠你坐在那儿、读完结果、按回车把它推到下一轮。agent 只是被你一次次手动喂的那只手。

Loop 节点把这件事**反过来**。你不再一轮一轮地催，而是**一次性声明三件事**：

1. **每轮要干的活（目标）** —— 循环体，本身是一个完整的「创建loop」，里面可以有 AI 节点、条件判断、HTTP、代码等任意节点。
2. **每轮的输出怎么喂回下一轮** —— 上一轮 output 自动变成下一轮 input。
3. **什么时候算完** —— 一个停止条件，外加 `maxIterations` 作为兜底硬顶。

声明完，循环就**自己转**：agent 在「干活 → 看结果 → 再干活」的圈里自走，不需要你在每一轮按回车。

> **一句话：你设目标 + 每轮的活 + 何时算完，剩下交给循环。**

这正是把你本来要**手动重复输入**的那些催促——“再试一次”“现在把 lint 错误修了”“一直跑到测试过”——**一次写成规则，让它无人值守地跑**。这也是整个功能为什么叫「创建loop」：核心赌注就是，agent 工作的未来形态是**声明一个循环（目标 + 循环体 + 停止条件）**，而不是守着聊天框一轮一轮地敲。

### 为什么"迭代"才是 agent 真正的形状

- 单次 prompt → 单次回答，是**问答**。
- 把输出折回输入、直到收敛，是**迭代**。

agent 真正干活时几乎都是迭代：草稿 → 自审 → 改稿；跑 → 报错 → 修；调工具 → 不满足 → 再调。Loop 节点把"迭代"变成画布上的**一等公民**——而且因为循环体是一个完整工作流，**"一轮"可以任意复杂**，不是只重复一个节点。

---

## 两种循环形态

Loop 节点有两个 `mode`，对应两种完全不同的迭代意图。

### 1. 条件循环（Condition / loop-agent）—— 反复打磨直到达标

意图：**“一直干到目标满足”**。每一轮把循环体的输出当作下一轮的输入，满足停止条件就停；否则一直到 `maxIterations` 兜底停。

- **停止条件**：`leftExpr` / `operator` / `rightValue` / `caseSensitive`，复用 condition 节点那一套判断。默认是 `json.done` `equals` `true`。
- **反馈**：上一轮 `output` → 下一轮 `payload`，所以循环体能在上一轮基础上继续推进。
- **输出**：循环体最后一轮的 json，外加两个元字段——
  - `_iterations`：实际跑了几轮；
  - `_done`：`true` = 停止条件达成；`false` = 没达成、是被 `maxIterations` 兜底截停的。
- **节点 message**：`looped N (done)` 或 `looped N (max)`。

这就是 **loop-agent**：像一个人不断 refine 直到自己满意，只是把"满意"交给停止条件来判定，把"再来一轮"交给循环来推动。

> 例：**研究循环**。循环体 = 一个 AI 节点（读资料、补充结论、自评是否够了），停止条件 = `json.enough == true`，`maxIterations = 6`。agent 自己读、自己判断够不够、不够就再来一轮，够了或到 6 轮就停。

### 2. 遍历数组（For each）—— 同样的活，对每个元素干一遍

意图：**“对列表里每个元素，各跑一遍循环体”**。这是**批处理**，不是打磨——元素之间互不反馈。

- **数组来源**：`arraySource` 表达式；留空则用上游 `payload.json`（要求是数组）。
- **执行方式**：`sequential`（一个接一个）/ `parallel`（同时跑，`concurrency` 并发 1–8）。**并行也保证输出顺序与输入一致。**
- **出错策略**：`continueOnError`
  - 打开：某个元素出错就把它记成 `{ error: "..." }`、跳过、继续跑其余元素（**韧性**）；
  - 关闭（默认）：一旦有元素出错，立即中止、整个 Loop 节点报错（**fail-fast**）。
- **输出**：每个元素结果组成的数组。**节点 message**：`foreach 成功数/总数`（并行时带 `(parallel)`）。

> 例：对 50 个文件**各跑一遍** “AI 总结”，`parallel`、`concurrency = 4`、`continueOnError = on`，最后拿到 50 条结果（出错的那条是 `{error}`）。

---

## 循环体里能用的变量：`$loop`

循环体里**任意节点**都能用 `{{ }}` 插值引用当前这一轮的上下文：

| 变量 | 含义 |
| --- | --- |
| `{{$loop.index}}` | 当前轮 / 当前元素的下标（从 0 开始） |
| `{{$loop.item}}` | 当前元素（foreach）；条件循环里是**上一轮输出的 json** |
| `{{$loop.total}}` | 总数（foreach = 数组长度；条件循环 = `maxIterations`） |

---

## 护栏：给 agent 自走的自由，但永远留一个硬顶

能自己转圈的 agent，也最容易跑飞——死循环、无限递归、烧钱。所以 Loop **一定带边界**：

- **`maxIterations`**：每个 Loop 自己的轮数上限（默认 10，封顶 **100**）。条件循环没达成条件时，它就是最后的刹车。
- **嵌套深度 ≤ 5**：Loop / 子工作流套娃最多 5 层，超了直接报错，防递归爆栈。
- **整轮看门狗 + 节点数上限**：单次运行有最大时长和最大节点执行次数（200）兜底，卡死也能被截停。
- **`continueOnError`**：foreach 里在「韧性」和「fail-fast」之间选一个。

> 理念：**放手让 agent 转，但它跨不过那个硬顶**——所以放手是安全的。自由和边界不是矛盾，边界正是让你敢给自由的前提。

---

## 什么时候用 / 不用

**适合用 Loop：**
- 打磨到达标：草稿 → 自审 → 改稿，直到够好。
- 重试到成功：跑到测试通过 / 跑到产出合法 JSON。
- 收敛：反复调某个工具，直到结果满足条件。
- 批处理：对每行 / 每文件 / 每元素各跑一遍（foreach）。

**不适合用 Loop：**
- 只需要跑别的工作流一次 → 用 **运行创建loop（子工作流）** 节点，别用 Loop。
- 一条直线、无反馈的固定步骤 → 直接把节点串起来就行。

---

## 配置项速查

| 字段 | 作用 |
| --- | --- |
| `workflowId` | 循环体：要反复跑的那个「创建loop」 |
| `mode` | `condition`（条件循环 / loop-agent）或 `foreach`（遍历数组） |
| `maxIterations` | 轮数上限（1–100，默认 10） |
| `leftExpr` / `operator` / `rightValue` / `caseSensitive` | **condition** 模式的停止条件 |
| `arraySource` | **foreach** 的数组来源表达式（留空 = 上游 `payload.json`） |
| `execution` | **foreach**：`sequential` / `parallel` |
| `concurrency` | **foreach** 并行时的并发数（1–8，默认 4） |
| `continueOnError` | **foreach**：某元素出错时跳过并记为 `error`，否则 fail-fast |

---

## 进阶：把 loop 接到 agent 钩子上

一个「创建loop」还能被绑到 **code 模式 agent 的钩子**上做反应式自动化（如"写完代码自动 review"）。这时 loop 由 agent 的行为触发，而不是你手动跑。注意**防递归**：某个触发器的 loop 正在跑时，它自身（含其 AI 节点）引发的工具调用不会再次触发钩子，避免无限自激。详见设置里的「钩子触发器」。

---

## 相关代码

- 执行引擎：[`src/main/workflow-runtime.ts`](../src/main/workflow-runtime.ts) —— `executeNode` 的 `case 'loop'`，复用 `runGraph` + `evaluateCondition` + 深度守卫。
- 配置与归一化：[`src/shared/app-settings-workflow.ts`](../src/shared/app-settings-workflow.ts)、类型在 [`src/shared/app-settings-types.ts`](../src/shared/app-settings-types.ts)（`WorkflowLoopConfigV1`）。
- 测试：[`src/main/workflow-runtime.nodes.test.ts`](../src/main/workflow-runtime.nodes.test.ts) —— 覆盖条件循环、foreach 顺序/并行、`continueOnError`、`maxIterations` 兜底。
