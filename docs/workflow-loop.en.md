# The Loop node — let the agent go around the loop, so you don't press Enter

> Covers the **Loop node** inside the "Create Loop / Workflows" feature.
> Implemented in [`src/main/workflow-runtime.ts`](../src/main/workflow-runtime.ts) (`executeNode`, `case 'loop'`); config normalization in [`src/shared/app-settings-workflow.ts`](../src/shared/app-settings-workflow.ts); tests in [`src/main/workflow-runtime.nodes.test.ts`](../src/main/workflow-runtime.nodes.test.ts).

---

## Three names that are easy to confuse

| Name | What it is |
| --- | --- |
| **Create Loop** | A **whole workflow**. In the product, one workflow is called a "Create Loop". |
| **Loop node** | **One node** inside a workflow that takes another Create Loop and **runs it repeatedly as a loop body**. This doc is about this node. |
| **Run Create Loop (subworkflow) node** | Runs another Create Loop **exactly once** — no looping, no feedback. |

The one-line distinction: **subworkflow = run once; Loop node = run repeatedly + feed the result back (or run once per item in a list).**

---

## The core idea: the loop drives the agent, not the human

A conventional chat-style agent works like this:

```
you type → agent answers → you read → you decide the next step → you type again → …
```

Notice where the loop lives: **the loop is you.** Every round is driven by you sitting there, reading the result, and pressing Enter to push it into the next round. The agent is just the hand you feed, one round at a time.

The Loop node **inverts** that. Instead of nudging it round by round, you **declare three things once**:

1. **The work to do each round (the goal)** — the loop body, which is itself a full Create Loop and can contain AI nodes, conditions, HTTP, code, any node.
2. **How each round's output feeds the next** — the previous `output` automatically becomes the next round's `input`.
3. **When it's done** — a stop condition, plus `maxIterations` as a hard ceiling.

Once declared, the loop **runs itself**: the agent moves through "do work → look at the result → do more work" on its own, without you pressing Enter each round.

> **In one sentence: you set the goal, the per-round work, and when it's done — the loop handles the rest.**

This is exactly how you turn the nudges you'd otherwise **retype by hand** — "try again", "now fix the lint errors", "keep going until the tests pass" — into a rule **written once and run unattended**. It's also why the whole feature is called "Create Loop": the bet is that the future shape of agent work is **declaring a loop (goal + body + stop condition)**, not babysitting a chat box round by round.

### Why "iteration" is the real shape of agent work

- A single prompt → a single answer is **Q&A**.
- Feeding output back into input until it converges is **iteration**.

Real agent work is almost always iterative: draft → self-review → revise; run → error → fix; call a tool → not good enough → call again. The Loop node makes iteration a **first-class citizen** on the canvas — and because the body is a full workflow, **a "round" can be arbitrarily complex**, not just one repeated node.

---

## Two shapes of looping

The Loop node has two `mode`s, for two very different intents.

### 1. Condition (loop-agent) — refine until it's good enough

Intent: **"keep working until the goal is met."** Each round feeds the body's output into the next round's input; stop when the condition holds, otherwise stop at `maxIterations`.

- **Stop condition**: `leftExpr` / `operator` / `rightValue` / `caseSensitive`, reusing the condition-node operators. Default is `json.done` `equals` `true`.
- **Feedback**: previous `output` → next `payload`, so the body builds on the last round.
- **Output**: the body's last-round json, plus two meta fields —
  - `_iterations`: how many rounds actually ran;
  - `_done`: `true` = the stop condition was met; `false` = it wasn't, and `maxIterations` cut it off.
- **Node message**: `looped N (done)` or `looped N (max)`.

This is the **loop-agent**: like a person who keeps refining until satisfied — except "satisfied" is judged by the stop condition and "one more round" is driven by the loop.

> Example: a **research loop**. Body = an AI node (read sources, add findings, self-assess whether it's enough); stop condition = `json.enough == true`; `maxIterations = 6`. The agent reads, judges whether it has enough, loops again if not, and stops when it's enough or hits 6 rounds.

### 2. For each — the same work, once per item

Intent: **"run the body once for every item in a list."** This is **batch processing**, not refinement — items don't feed each other.

- **Array source**: the `arraySource` expression; empty uses the upstream `payload.json` (must be an array).
- **Execution**: `sequential` (one at a time) / `parallel` (concurrent, `concurrency` 1–8). **Parallel still preserves output order.**
- **Error policy**: `continueOnError`
  - on: a failing item is recorded as `{ error: "..." }`, skipped, and the rest keep running (**resilience**);
  - off (default): the first failing item aborts the whole Loop node (**fail-fast**).
- **Output**: an array of per-item results. **Node message**: `foreach <succeeded>/<total>` (with `(parallel)` when parallel).

> Example: run "AI summary" **once per file** over 50 files — `parallel`, `concurrency = 4`, `continueOnError = on` — and get 50 results back (failed ones are `{error}`).

---

## Variables the body can read: `$loop`

Any node in the body can reference the current round's context via `{{ }}` interpolation:

| Variable | Meaning |
| --- | --- |
| `{{$loop.index}}` | Index of the current round / item (0-based) |
| `{{$loop.item}}` | The current item (foreach); in condition mode, the **previous round's output json** |
| `{{$loop.total}}` | Total count (foreach = array length; condition = `maxIterations`) |

---

## Guardrails: give the agent freedom to run, but always leave a hard ceiling

An agent that can go around on its own is also the easiest to run away — infinite loops, runaway recursion, runaway cost. So a Loop **always has bounds**:

- **`maxIterations`**: each Loop's own round cap (default 10, capped at **100**). For condition mode that never meets its condition, this is the final brake.
- **Nesting depth ≤ 5**: Loop / subworkflow nesting is capped at 5 levels; deeper throws, preventing runaway recursion.
- **Run watchdog + node-count cap**: a single run has a max duration and a max node-execution count (200) as a backstop, so even a stuck run gets cut off.
- **`continueOnError`**: pick resilience vs fail-fast for foreach.

> Principle: **let the agent run, but it can't cross the ceiling** — which is exactly what makes letting it run safe. Freedom and bounds aren't in tension; the bound is what lets you grant the freedom.

---

## When to use it / when not to

**Use a Loop for:**
- Refine until good: draft → self-review → revise, until good enough.
- Retry until success: run until tests pass / until valid JSON is produced.
- Convergence: call a tool repeatedly until the result satisfies a condition.
- Batch: run once per row / file / item (foreach).

**Don't use a Loop for:**
- Running another workflow just once → use the **Run Create Loop (subworkflow)** node instead.
- A straight, feedback-free sequence of steps → just wire the nodes together.

---

## Config reference

| Field | Purpose |
| --- | --- |
| `workflowId` | The loop body: the Create Loop to run repeatedly |
| `mode` | `condition` (loop-agent) or `foreach` (iterate an array) |
| `maxIterations` | Round cap (1–100, default 10) |
| `leftExpr` / `operator` / `rightValue` / `caseSensitive` | Stop condition for **condition** mode |
| `arraySource` | Array source expression for **foreach** (empty = upstream `payload.json`) |
| `execution` | **foreach**: `sequential` / `parallel` |
| `concurrency` | **foreach** parallel concurrency (1–8, default 4) |
| `continueOnError` | **foreach**: skip a failing item as `error` instead of fail-fast |

---

## Advanced: binding a loop to agent hooks

A Create Loop can also be bound to a **code-mode agent's hooks** for reactive automation (e.g. "review after every edit"). The loop is then triggered by the agent's behavior rather than run by hand. Note the **recursion guard**: while a trigger's loop is running, the tool calls it causes (including its AI nodes) won't re-fire hooks, so it can't loop forever. See "Hook triggers" in Settings.

---

## Related code

- Execution engine: [`src/main/workflow-runtime.ts`](../src/main/workflow-runtime.ts) — `executeNode`, `case 'loop'`, reusing `runGraph` + `evaluateCondition` + the depth guard.
- Config & normalization: [`src/shared/app-settings-workflow.ts`](../src/shared/app-settings-workflow.ts); types in [`src/shared/app-settings-types.ts`](../src/shared/app-settings-types.ts) (`WorkflowLoopConfigV1`).
- Tests: [`src/main/workflow-runtime.nodes.test.ts`](../src/main/workflow-runtime.nodes.test.ts) — covers condition mode, foreach sequential/parallel, `continueOnError`, and the `maxIterations` cap.
