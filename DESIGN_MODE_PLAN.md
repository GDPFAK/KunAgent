# Design mode (设计模式) — implementation plan

**Branch:** `feature/design-mode` · **Base:** `develop` · **Created:** 2026-06-19
**Goal:** add a third top-level workspace mode `design`, after `chat`(code) and `write`.

MVP = an AI design workspace mirroring the Write-mode skeleton, three-pane:
- **Left** `DesignSidebar` — design artifacts (generated HTML/SVG) + version snapshots
- **Center** `DesignCanvas` — webview live-render of the current artifact; top bar = viewport switch (mobile/tablet/desktop) + Preview/Code toggle (penpot-style inspect)
- **Right** `DesignAgentPanel` — design agent chat + design-context form (brandColor / tone / design-system preset)

Loop: describe in right pane → agent writes a single-file HTML artifact → center webview live-refreshes → iterate → versions accumulate on the left.

**Hybrid roadmap (decided):** ship HTML-artifact MVP now; layer in P2 node-canvas (AI-CanvasPro style) and P3 penpot later as *new discriminated-union variants*, not rewrites.

> Reference: the sibling `finance-mode` worktree (`feature/finance-mode-m1-m2`) is another mode added the same way — cross-check its diff for any newer convention than write mode.

---

## 0. Grounding summary (verified against the real code)

- **Route union** `src/renderer/src/store/chat-store-types.ts:98`: `AppRoute = 'chat' | 'write' | 'settings' | 'plugins' | 'claw' | 'schedule'`. `SettingsRouteSection` = lines 82–97.
- **Mode tabs** `src/renderer/src/components/chat/WorkspaceModeTabs.tsx` hardcoded to 2 buttons; props `{ activeView: 'chat'|'write'|'claw'|'schedule'; onCodeOpen; onWriteOpen }`.
- **Route actions split across two files; later spread wins.** `chat-store.ts` spreads `createAppActions` (189) *before* `createNavigationActions` (219), so `openWrite` in `chat-store-navigation-actions.ts:147` overrides the dead one in `chat-store-app-actions.ts:149`. `openSchedule`/`openClaw` (plain `set({ route })`) live in `chat-store-app-actions.ts:166-173`. `ChatState` method decls at `chat-store-types.ts:194-203`.
- **Workbench routing** = one ternary chain in `Workbench.tsx`: sidebar choice 2390-2428 (`route === 'write' ? <WriteSidebar/> : <Sidebar/>`), main-panel chain 2444-2480 (`plugins ? … : schedule ? … : write ? <WriteWorkspaceView/> + {renderRightPanel()} : chat`), `renderRightPanel()` 2194-2243 gates `WriteAssistantPanel` on `route === 'write' && writeAssistantOpen`. Mode helpers `openCodeMode`/`openWriteMode` 2082-2090.
- **AppShell** `AppShell.tsx:60` only forks `settings` vs `Workbench` — **no change needed** (design renders inside Workbench, like write).
- **Agent turn dispatch (reuse path):** prototype turn = `SddDraftEditorView` `onPrototypeTurn` → `sendSddPrototypeTurn` (`Workbench.tsx:1590-1664`) → `sendMessage(prompt, 'agent', { displayText, model, providerId, attachmentIds })`. `sendWritePrompt` (`Workbench.tsx:1139`) uses `ensureWriteThreadForWorkspace` then the same `sendMessage`.
- **Live HTML render** = `src/renderer/src/write/html-embed-dom.ts`: `window.kunGui.authorizeWritePrototype({ path, workspaceRoot })` (also allow-lists path for the `will-attach-webview` guard) → `<webview src=fileUrl partition="kun-proto" webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes">`. IPC: `src/main/services/prototype-embed-registry.ts` + `src/main/index.ts` + `register-app-ipc-handlers.ts` + `preload/index.ts`. **DesignCanvas reuses `authorizeWritePrototype`.**
- **Generation prompt** `src/renderer/src/sdd/sdd-prototype-prompt.ts` (`buildSddPrototypeTurnPrompt`) embeds `WRITE_PROTOTYPE_DEFAULT_PROMPT` + `WRITE_PROTOTYPE_MAX_TEXT_CHARS` from `src/shared/write-prototype.ts`; single-file-HTML / incremental-write / <4000-char-per-tool-call contract.
- **Design context** `SddDesignContext` is in `src/renderer/src/sdd/sdd-draft-store.ts:12` (NOT in `sdd-design-context.ts`, which holds `SDD_DESIGN_TONE_OPTIONS` + `formatSddDesignContextLines`).
- **Design-quality hook** `kun/src/hooks/builtins/design-quality-hook.ts` fires on `PostToolUse` for any frontend path (`isFrontendPath`) — **zero wiring needed**; design artifacts are `.html`, so `design_quality_review` blocks fold automatically.
- **Settings end-to-end (the landmine) — five places:**
  1. Type `AppSettingsV1` `app-settings-types.ts:853`.
  2. Defaults `src/main/settings-store.ts:195-223` `defaultSettings()` + `buildMergedSettings` 228-245.
  3. Normalize `src/shared/app-settings-normalize.ts:32` `normalizeAppSettings`, line 92 `write: normalizeWriteSettings(...)`.
  4. **Strict patch schema** `src/main/ipc/app-ipc-schemas.ts:721-744` `settingsPatchObjectSchema = z.object({ … }).strict()` — unknown top-level key is rejected by `.strict()`, triggering save→reject→resave loop.
  5. `sanitizeKunConfigSections` `src/main/kun-process.ts:979-994` — Kun-runtime config only; **MVP design slice is GUI-only → NOT needed here** (but required in 1-4). See R5.
- **Tests that break** if `design` is a *required* `AppSettingsV1` field: literals at `src/shared/app-settings.test.ts:44-66` and `src/main/ipc/app-ipc-schemas.test.ts:135-183` (Step B6).

---

## A. Types / route plumbing

**A1.** `src/renderer/src/store/chat-store-types.ts:98` → `'chat' | 'write' | 'design' | 'settings' | 'plugins' | 'claw' | 'schedule'`. Add `'design'` to `SettingsRouteSection` (82-97). Add decl near 195: `openDesign: () => void`.

**A2. (create) `src/renderer/src/design/design-types.ts`** — home of the "layer on later" seams (mirror `write-workspace-store-types.ts:7-9`):
```ts
export type DesignArtifactKind = 'html'              // P2: | 'graph'   P3: | 'penpot'
export type DesignCanvasView   = 'preview' | 'code'  // P2: | 'graph'   P3: | 'penpot'
export type DesignViewport     = 'mobile' | 'tablet' | 'desktop'

export type DesignArtifact = {
  id: string
  kind: DesignArtifactKind        // discriminant
  relativePath: string            // workspace-relative single-file HTML
  title: string
  createdAt: string
  versions: DesignArtifactVersion[]
}
export type DesignArtifactVersion = {
  id: string; relativePath: string; createdAt: string; summary: string
}
```
> **Seam:** future node-canvas artifact = `kind: 'graph'` (nodes/edges payload); penpot = `kind: 'penpot'` (file id). Every consumer switches on `artifact.kind` / `canvas.view`, so P2/P3 = an added `case`, no existing case rewritten.

---

## B. Settings slice end-to-end (all five touchpoints + tests)

**B1.** `src/shared/app-settings-types.ts` (after ~533):
```ts
export type DesignSystemPreset = 'none' | 'shadcn' | 'material' | 'ios' | 'fluent'
export type DesignSettingsV1 = {
  defaultWorkspaceRoot: string
  brandColor: string
  tone: string[]
  designSystemPreset: DesignSystemPreset   // the field DesignContext ADDS over SddDesignContext
}
export type DesignSettingsPatchV1 = Partial<DesignSettingsV1>
```
Add `design: DesignSettingsV1` to `AppSettingsV1` (`:853`, after `schedule`).

**B2. (create) `src/shared/app-settings-design.ts`** (mirror `app-settings-claw.ts`): `defaultDesignSettings()`, `normalizeDesignSettings()` (clamp tone length, validate preset enum, trim brandColor), `mergeDesignSettings()`. Add `export * from './app-settings-design'` to barrel `src/shared/app-settings.ts`.

**B3.** `src/main/settings-store.ts`: `defaultSettings()` (222) add `design: defaultDesignSettings()`; `buildMergedSettings` (241) add `design: mergeDesignSettings(defaults.design, migrated.design)`; import from `@shared/app-settings`.

**B4.** `src/shared/app-settings-normalize.ts`: import `normalizeDesignSettings`; add `design?: DesignSettingsPatchV1` to the `maybeSettings` cast (41-44); add `design: normalizeDesignSettings(maybeSettings.design)` to the return (after 94).

**B5. (mandatory — or infinite sync loop)** `src/main/ipc/app-ipc-schemas.ts`: before 721 add
```ts
const designSettingsPatchSchema = z.object({
  defaultWorkspaceRoot: defaultPathSchema,
  brandColor: z.string().trim().max(32).optional(),
  tone: z.array(trimmedString(32)).max(12).optional(),
  designSystemPreset: z.enum(['none','shadcn','material','ios','fluent']).optional(),
}).strict()
```
and inside `settingsPatchObjectSchema` (736-738) add `design: designSettingsPatchSchema.optional(),`.

**B6.** Fix test literals: `src/shared/app-settings.test.ts:44-66` add `design: defaultDesignSettings()`; `src/main/ipc/app-ipc-schemas.test.ts` add a `design: {...}` assertion (135-183). Add a code comment that `sanitizeKunConfigSections` is intentionally NOT touched (GUI-only slice).

**B7. (before ship; deferrable past empty-mode milestone)** Settings UI: (create) `src/renderer/src/components/settings-section-design.tsx` (mirror `settings-section-write.tsx:62`) with brandColor / tone chips / preset select. `SettingsView.tsx`: add `'design'` to `SettingsCategory` (62); `settingsSection === 'design'` → `setCategory('design')` (mirror 257-258); render `{category === 'design' ? <DesignSettingsSection/> : null}` (~990); include `design` in the save block (778/793).

---

## C. Store + thread registry

**C1. (create) `src/renderer/src/design/design-workspace-store{,-types}.ts`** (mirror `write-workspace-store.ts`, much thinner). State: `{ workspaceRoot, artifacts, activeArtifactId, canvasView, viewport, agentPanelOpen, assistantModel, assistantProviderId, designContext, settingsLoading, settingsError, fileError }`. Actions: `setCanvasView, setViewport, setActiveArtifact, addArtifact, addVersion, setAgentPanelOpen, updateDesignContext, loadDesignSettings, resetWorkspace`. Persist `canvasView`/`viewport`/`agentPanelOpen` via `../lib/browser-storage` (copy key-constant pattern from `write-workspace-store-helpers.ts`). **Do NOT** port autosave/diff-review/inline-completion — design store edits no text buffer; the agent writes the file and the canvas reloads.

**C2. (create) `src/renderer/src/design/design-context.ts`**: `DesignContext = SddDesignContext + designSystemPreset?`. `DESIGN_TONE_OPTIONS` (copy `SDD_DESIGN_TONE_OPTIONS`). `formatDesignContextLines(ctx)` = copy `formatSddDesignContextLines` + append `- Design system: …` when preset !== 'none'.

**C3. (create) `src/renderer/src/design/design-thread-registry.ts`** (copy `write-thread-registry.ts`; key `kun.design.threadRegistry.v1`, title `'Design Assistant'`, fns `isDesignThreadId`/`markDesignThread`/`hydrateDesignThreadRegistry`/`activeDesignThreadForWorkspace`). **MVP may stub to one fixed thread** (R3) but keep the file's surface so D/E wiring doesn't change later.

---

## D. UI components + canvas webview (`src/renderer/src/components/design/`)

**D1. `DesignWorkspaceView.tsx`** — layout host (mirror `WriteWorkspaceView.tsx` skeleton: `{ leftSidebarCollapsed, onToggleLeftSidebar, input, setInput, onSubmitPrompt?, onOpenAgentSettings? }`), much thinner. Owns empty-state (no workspace → `pickWorkspaceDirectory`, cf. `WriteWorkspaceView.pickWriteWorkspace` 634-648), top bar (viewport switch + Preview/Code toggle), mounts `DesignCanvas`.

**D2. `DesignCanvas.tsx`** — switch on `canvasView`:
- `'preview'`: render via `html-embed-dom.ts`. **Recommend** inlining `authorizeWritePrototype` → `<webview partition="kun-proto">` (copy `html-embed-dom.ts:64-87,138-158`) for a borderless full-bleed canvas. Apply viewport as max-width wrapper (mobile 390 / tablet 768 / desktop 100%).
- `'code'`: `window.kunGui.readWorkspaceFile` → read-only source (CodeMirror viewer or `<pre>` for MVP).
- **Seam:** future `case 'graph'` / `case 'penpot'` slot here.

**D3. `DesignSidebar.tsx`** — left pane (mirror `WriteSidebar.tsx` shell, add `onDesignOpen`). Body: list `artifacts`; under active artifact list its `versions` (click → load snapshot). New-artifact button.

**D4. `DesignAgentPanel.tsx`** — right pane (mirror `WriteAssistantPanel.tsx` prop surface: `input/setInput/mode/setMode/busy/runtimeConnection/activeThreadId/blocks/liveReasoning/liveAssistant/composerModel/onSend/onCollapse`). Add a design-context form above the composer bound to `designContext` (brandColor input, tone chips, preset select).

---

## E. Agent turn / generation wiring

**E1. (create) `src/renderer/src/design/design-turn-prompt.ts`** (generalize `sdd-prototype-prompt.ts`):
```ts
export type DesignTurnTarget = 'html'   // P2 | 'graph'   P3 | 'penpot'
export type DesignTurnOptions = {
  target: DesignTurnTarget; mode: 'text' | 'image'; text?: string
  artifactRelativePath: string; workspaceRoot: string
  customPrompt?: string; designContext?: DesignContext
}
export function buildDesignTurnPrompt(o: DesignTurnOptions): string { /* switch(o.target){case 'html': …} */ }
```
Copy `buildSddPrototypeTurnPrompt` (24-56) verbatim EXCEPT: drop SDD-requirement framing ("design a single-file HTML artifact"), keep the four Hard rules, call `formatDesignContextLines` (C2). Keep `WRITE_PROTOTYPE_*` imports from `@shared/write-prototype`. **Seam:** wrap per-target body in `switch (o.target)`.

**E2.** In `Workbench.tsx` add `sendDesignTurn` next to `sendSddPrototypeTurn` (1590): ensure design thread (`ensureDesignThreadForWorkspace`), open design agent panel, `return sendMessage(prompt, 'agent', { displayText, model, providerId })` with `useDesignWorkspaceStore.getState().assistantModel`. Image-mode optional (reuse `uploadSddImagesAsAttachments`/`readWorkspaceImage` 1620-1644). Pass `sendDesignTurn` into `DesignAgentPanel.onSend` (or `DesignWorkspaceView.onSubmitPrompt`, like `sendWritePrompt` at 2474).

**E3.** After a turn, when the file exists at `artifactRelativePath`, call `addArtifact`/`addVersion`. **Decision R2:** reserved-path dir `<workspaceRoot>/.kun-design/<artifactId>/v<N>.html` (parallels SDD `unitProtoDir` `SddDraftEditorView.tsx:798-812`). Agent is told the exact path (E1); canvas authorizes/polls it (D2); versions are per-turn snapshot copies.

---

## F. i18n + tab UI + store action + Workbench branches

**F1.** `locales/en/common.json` + `locales/zh/common.json`: add `"design"` (en `"Design"`, zh `"设计"`) next to `code`/`write` (37-38); add design UI strings (`designStudio`, `designNoArtifact`, `designViewport*`, `designView*`, `designContext*`, `designSystemPreset`) following the `writeStudio` block (1106-1112).

**F2.** `WorkspaceModeTabs.tsx`: add `'design'` to `activeView` union (6) + `onDesignOpen` prop; render a 3rd `<button>` (icon `Palette`/`LayoutTemplate`), wired like write (49-59); update `aria-label` (35). **Propagate `onDesignOpen`** to every tabs/sidebar render: `Sidebar` + `WriteSidebar` shared shell props (Workbench 2394-2395, 2424-2425) and the new `DesignSidebar`.

**F3.** `chat-store-app-actions.ts`: add `openDesign: () => { set({ route: 'design' }) }` next to `openSchedule` (171-173); add `'openDesign'` to the `Pick<ChatState, …>` return union (36-50) and the return object.

**F4.** `Workbench.tsx`:
- import `openDesign` (selector block ~342/399); add `openDesignMode = () => { setConnectPhoneSidebarOpen(false); openDesign() }` next to `openWriteMode` (2087).
- Sidebar branch (2390-2428): `route === 'design' ? <DesignSidebar onDesignOpen={openDesignMode}/> : route === 'write' ? <WriteSidebar/> : <Sidebar/>`; pass `onDesignOpen` to all three.
- Main-panel chain (2444-2480): add `route === 'design' ? (<><DesignWorkspaceView onSubmitPrompt={sendDesignTurn}/> {renderRightPanel()}</>) :` parallel to the write branch (2465).
- `renderRightPanel` (2194-2243): add `route === 'design' && designAgentPanelOpen ? <DesignAgentPanel/> :` as first arm (mirror write). Subscribe `designAgentPanelOpen` (cf. `writeAssistantOpen` 460).
- Audit `route === 'write'` guards for composer model/attachments (935, 938, 1867, 1928-1946, 2108) and add `route === 'design'` companions where design should behave like the write agent.

---

## G. Build / verify checkpoints

- **G1 (empty mode renders):** after A1, F1-F4 with STUB components + minimal store → `npm run typecheck`; launch app, click Design → route switches, sidebar swaps, center placeholder, no console errors, **settings still save** (watch for repeated "Refusing to write invalid GUI-managed Kun config" `kun-process.ts:496` = a missing B touchpoint).
- **G2 (settings):** after B1-B6 → settings tests pass; toggle a design setting, reload, value persists.
- **G3 (canvas):** after D2 → hand-place a `.html` under the reserved dir; webview authorizes + renders, viewport resizes, Preview/Code toggles.
- **G4 (agent):** after E1-E3 → run a design turn; agent writes reserved HTML, canvas live-refreshes, version row appears, `design_quality_review` shows in the turn (proves zero-wiring reuse).

---

## Discriminated-union seams (how P2/P3 slot in)

```ts
DesignArtifactKind = 'html'              // P2: | 'graph'   P3: | 'penpot'
DesignCanvasView   = 'preview' | 'code'  // P2: | 'graph'   P3: | 'penpot'
DesignTurnTarget   = 'html'              // P2: | 'graph'   P3: | 'penpot'
```
- **P2 (node canvas):** add `'graph'`; new `case 'graph'` in DesignCanvas view-switch (node editor), `buildDesignTurnPrompt` target-switch (graph-JSON contract), sidebar version renderer; `DesignArtifact` gains `graph?` payload. No `'html'` case changes.
- **P3 (penpot):** add `'penpot'`; `case 'penpot'` mounts the penpot embed/MCP; turn builder targets penpot format. Same additive pattern.

---

## Risks / decisions to confirm

- **R1 — `openWrite` defined twice; which to mirror?** Resolved: plain `set({ route })` (app-actions, like `openSchedule`) — the override-winner only adds write-thread hydration, which design defers (R3). *Confirm no design-thread hydration needed on entry.*
- **R2 — artifact persistence location.** Proposed: `<workspaceRoot>/.kun-design/<id>/v<N>.html` (parallels SDD `unitProtoDir`). Alt: reuse the write file-tree as ordinary files. *Genuine decision — no existing design-artifact dir convention found. Changes D2 + E3.*
- **R3 — thread-registry depth for MVP.** Write registry is ~320 lines. MVP can ship one fixed design thread per workspace and still dispatch via `sendMessage`. *Confirm; full registry is a fast-follow.*
- **R4 — own workspace root vs share write's?** Plan gives `design.defaultWorkspaceRoot` but store can fall back to chat `workspaceRoot` (cf. `sendWritePrompt` `writeState.workspaceRoot || workspaceRoot` 1149). *Confirm independent vs shared.*
- **R5 — `sanitizeKunConfigSections`.** MVP correctly skips it (GUI-only). If a design setting must reach the Kun runtime later, it must thread through `sanitizeKunConfigSections` + the Kun config schema or be silently dropped.
- **R6 — Workbench is write-aware in ~8 spots** (935, 938, 1867, 1928, 1942, 2108, 2206, 2465). Each needs a `route === 'design'` companion — missing one = behavior bug (wrong model / missing panel), not a build break.
- **R7 — webview guard naming.** `authorizeWritePrototype` is write-named; verify `prototype-embed-registry.ts` doesn't hard-scope authorized paths to the write workspace (rejecting `.kun-design/`). If it does, widen it or add `authorizeDesignArtifact`. *Verify before G3.*

---

## Minimal verify path (route before agent/canvas)

1. A1 + F1 (just `"design"` label) + F2 (3rd tab + prop propagation) + F3 + F4 with STUB `DesignSidebar`/`DesignWorkspaceView`/`DesignAgentPanel` (one-line placeholders) + minimal `design-workspace-store.ts` (`agentPanelOpen` + `canvasView` only).
2. Settings B1-B6 (required — empty slice OK, B7 deferred).
3. `tsc` typecheck → fix any missed prop in F2/F4.
4. Launch, click **Design**: route flips, placeholders render, Code/Write still work, **no** repeated invalid-Kun-config writes. Proves routing + settings wired before any canvas/agent code.
