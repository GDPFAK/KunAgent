# Design mode (设计模式)

Design mode is the third top-level workspace mode, alongside **code** (`chat`) and
**write**. It is an AI design workstation: you describe a UI, an agent produces a
single-file interactive artifact, a live canvas renders it, and you iterate — with
a first-class, two-way bridge to the coding agent that ships it.

> Implementation history lives in [`DESIGN_MODE_PLAN.md`](../DESIGN_MODE_PLAN.md)
> (the original plan) and the `feat(design): …` commits on `feature/design-mode`.

---

## 1. What it is

The loop:

1. Describe a design in the right pane (with a design-context form: brand color,
   tone, design-system preset, structured tokens).
2. The design agent writes **one self-contained HTML document** to a reserved path
   under `.kun-design/`.
3. The center **canvas** live-renders it (a `<webview>`, refreshed as the agent
   writes).
4. Iterate in place — each turn snapshots a new version.
5. Hand the approved design to the coding agent ("Implement in code"), which
   publishes a shared design system and opens a fresh code thread.

Positioning: this is the only one of the surveyed tools where design lives **inside
the coding-agent IDE** with an organic design↔code loop (see §11).

---

## 2. Architecture

Design mode renders inside `Workbench`, exactly like write mode — `AppShell` only
forks `settings` vs `Workbench`, so no shell change was needed.

- **Route**: `AppRoute` gains `'design'`; `openDesign` / `ensureDesignThreadForWorkspace`
  / `createDesignThread` mirror the write-mode navigation actions
  (`chat-store-navigation-actions.ts`). The design thread is tracked in a thin
  registry (`design/design-thread-registry.ts`).
- **Tabs**: `WorkspaceModeTabs` renders three buttons (code / write / design).
- **Three panes** (`components/design/`):
  - `DesignSidebar` — mode tabs + artifact list (per-kind icons, version count,
    implement / delete / rename, provenance + drift badges) + "New design" / "New
    canvas".
  - `DesignCanvas` — the live canvas: preview / code (shiki-highlighted) / live
    (the real running app from code mode) views, viewport switch, device frame,
    light/dark background, export, reload. Early-returns `DesignGraphView` for
    `graph` artifacts.
  - `DesignAgentPanel` — the composer + a collapsible design-context form
    (brand-color picker, tone chips, design-system preset) + iterate/new/busy hint.
- **Store**: `design/design-workspace-store.ts` (thin zustand store) holds artifacts,
  active id, canvas/viewport state, the design context, settings-driven knobs, the
  error banner, and the design-system hash. It is the single owner of artifact
  mutations + on-disk persistence.

### File map

```
src/renderer/src/design/
  design-types.ts               DesignArtifact, DesignArtifactKind ('html'|'graph'),
                                DesignCanvasView, viewports, createDesignArtifactId
  design-context.ts             DesignContext, presets, craft baseline,
                                formatDesignContextLines / formatDesignSystemMarkdown,
                                hashDesignSystem
  design-turn-prompt.ts         buildDesignTurnPrompt / buildDesignFromCodePrompt /
                                buildDesignImageNodePrompt
  design-implement-prompt.ts    buildImplementDesignPrompt (design → code)
  design-graph.ts               node-canvas doc model + topo sort
  design-graph-run.ts           runDesignNode (node → agent turn → await output)
  design-artifact-persistence.ts  meta.json sidecars + reconstruct-from-disk
  design-workspace-store.ts     the store
src/renderer/src/components/design/
  DesignWorkspaceView / DesignSidebar / DesignCanvas / DesignAgentPanel / DesignGraphView
```

---

## 3. Artifact model & durability

A `DesignArtifact` = `{ id, kind, title, relativePath, createdAt, updatedAt,
versions[], implementedAt?, implementedThreadId?, implementedDesignSystemHash? }`.

- **On disk**: each artifact is a directory `.kun-design/<id>/`:
  - HTML artifacts: `v1.html`, `v2.html`, … (the latest is the current document).
  - Graph artifacts: `graph.json` (+ `<nodeId>.html` / `<nodeId>.png` node outputs).
  - `meta.json` — a sidecar mirroring the artifact's metadata.
- **Durability**: the artifact list used to be in-memory only and was lost on reload.
  Now every mutation (`upsert` / `addVersion` / `markImplemented` / `rename`) writes
  `meta.json`, and on load `rehydrateArtifacts()` rebuilds the list from
  `window.kunGui.listWorkspaceDirectory('.kun-design')` — reading each `meta.json`,
  falling back to reconstructing from the on-disk files when a sidecar is missing.
  `removeArtifact` deletes the whole dir (`deleteWorkspaceEntry`) and a
  session-scoped `removedArtifactIds` guard stops a not-yet-flushed delete from
  resurfacing on the next mount.

---

## 4. The design loop

- `buildDesignTurnPrompt` produces the turn: write ONE standalone HTML document to
  the exact reserved path, build it incrementally (small skeleton then `edit` calls,
  every payload < ~4000 chars), finish with `</html>`. The design context + the craft
  baseline (§10) are appended.
- **Live canvas**: `DesignCanvas` watches the artifact file (`startWriteWorkspaceFileWatch`,
  with a retry while the file does not yet exist) and reloads the webview (not remount)
  once a complete document exists. The webview is used (not `srcdoc`/`blob`) because the
  parent CSP kills inline-script iframes; `authorizeWritePrototype` allow-lists the
  `file://` URL.
- **Iterate-in-place**: when an artifact is active, the next turn passes its current
  version as `basePath` ("read it first, apply ONLY the changes") instead of starting
  fresh; a new version is appended.

---

## 5. Design ↔ code integration (the moat)

This is what makes design mode "organic", not isolated:

1. **Implement in code** (`implementDesignInCode`) — publishes the shared design system
   to `.kun-design/DESIGN_SYSTEM.md`, builds an implement prompt, opens a **fresh code
   thread**, dispatches the turn, and records provenance (`markImplemented`).
2. **Shared design system** — `DESIGN_SYSTEM.md` is the single source of truth both the
   design agent and the code agent read; the design context is injected into both.
3. **Reverse-design** (`sendDesignFromCode`) — turn an existing UI file into an
   iterable HTML mockup (the inverse of implement), closing the round trip. Exposed
   from the file-preview panel ("Redesign").
4. **Requirement → design** (`exploreSddRequirementInDesign`) — a bridge from the SDD
   requirement flow into the design canvas.
5. **Unified preview** — the canvas `live` view shows the real running app served by
   code mode's dev server, so the design canvas and the real product share one surface.
6. **Bidirectional drift** — provenance is two-way:
   - **Design drift** (`updatedAt > implementedAt`) → ⟳ badge ("re-implement").
   - **Code drift** — `implementDesignInCode` snapshots a hash of the published
     `DESIGN_SYSTEM.md` onto the artifact; on load the store re-reads `DESIGN_SYSTEM.md`
     and compares, so an artifact implemented against an **older** shared design system
     shows a ⚠ badge. ✓ = in sync.

---

## 6. Node canvas (graph artifacts)

A `graph` artifact is a small design pipeline on a React Flow canvas
(`DesignGraphView`), persisted as `graph.json`.

- **Node kinds**:
  - `prompt` — carries text / context.
  - `design` — generates an HTML artifact at `.kun-design/<graphId>/<nodeId>.html`.
  - `image` — generates an image at `.kun-design/<graphId>/<nodeId>.png` (multimodal).
- **Execution engine** (`runDesignNode` + `runGraph`): **Run** topologically orders the
  nodes (Kahn; cycles are rejected), then runs each `design`/`image` node **in order** —
  collecting upstream nodes' text along incoming edges, dispatching one agent turn, and
  awaiting that node's output before the next. HTML nodes poll the file until it ends in
  `</html>`; image nodes poll the directory until the `.png` appears. Per-node status is
  live (running / done / error); design outputs preview inline (a docked webview panel),
  image outputs render inline (`readWorkspaceImage` → `<img>`).
- Minimap + grid background; hover-delete on nodes; empty-graph hint.

---

## 7. Settings

Design settings are a full slice (`AppSettingsV1.design`, `DesignSettingsV1`, ~20
fields: workspace root, brand/tone/preset, tokens (radius/density/font), model /
provider / reasoning effort, generation prompt, implement stack hint, inject-into-code,
publish-design-system, canvas defaults, live refresh, device frame, …). Rendered as a
multi-card settings tab.

> **Landmine — adding a design settings field touches 9 places** or settings-sync
> infinite-loops: `DesignSettingsV1` + the patch type, `defaultDesignSettings` /
> `normalizeDesignSettings` / `mergeDesignSettings`, the `.strict()`
> `designSettingsPatchSchema` (in `app-ipc-schemas.ts`), `index.ts applySettingsPatch`,
> `settings-utils.ts mergeSettings/coerceRendererSettings`, the store
> `loadDesignSettings`, and the UI. The `.strict()` belongs on the design sub-schema,
> not the top-level envelope.

---

## 8. Export

`design:export-prototype` (main IPC, mirrors `write:export`) exports the current
prototype to a standalone **HTML** file or a **PDF** (rendered via a hidden
`BrowserWindow` + `printToPDF`, reusing the write-mode pipeline), through a native save
dialog that defaults to the artifact title. Buttons live on the canvas toolbar.

---

## 9. Built-in "design system & craft" skill

`src/main/skill-bundled.ts` seeds a built-in skill into `~/.kun/skills/design-system/`
on first launch (idempotent marker, mirrors `ensureBundledUiPlugins`). Its `SKILL.md`
carries design-system-first thinking and the anti-AI-slop craft baseline, so the agent
auto-gets design guidance (triggers on design prompts, or via `load_skill`). Honors
deletion; appears after the next runtime restart.

---

## 10. Design context, tokens & craft

- **Design context** = brand color, tone, design-system preset, structured tokens
  (radius / density / font), free-form guidelines. It is injected into the design turn,
  the implement turn, and the reverse-design turn.
- **14 presets** (shadcn / radix / material / iOS / fluent / ant / chakra / carbon /
  polaris / bootstrap / geist / brutalism / editorial / none).
- **Craft baseline** (`DESIGN_CRAFT_LINES`) — an anti-AI-slop rubric appended to every
  generation prompt: avoid cream/sand backgrounds, purple→blue gradients, bounce easing,
  nested cards, low-contrast gray-on-tint; verify contrast; provide a
  `prefers-reduced-motion` fallback; use a real type scale and one spacing scale.

---

## 11. Positioning vs reference projects

| Capability | Design mode | AI-CanvasPro | open-design | penpot |
|---|---|---|---|---|
| Paradigm | design mode **inside** a coding-agent IDE | multimodal generative node canvas | agent-native design app | vector design platform |
| Artifact | single-file HTML | text/image/video/audio/3D | web/mobile/decks/video | vector SVG/components |
| **Design ↔ code** | **strong, in-IDE loop** | none | hand-off to code agents | MCP + design-as-code |
| Design system / tokens | presets + structured tokens + `DESIGN_SYSTEM.md` | none | 150 `DESIGN.md` systems | first-class design tokens |
| Export | HTML / PDF | local save | HTML/PDF/PPTX/MP4 | SVG/CSS/HTML/JSON |
| Node canvas | prompt/design/image + run engine | mature (7 node types) | automation | none |
| Collaboration / MCP | — / deferred (§13) | — | parallel sessions | realtime / MCP |

The deliberate **moat** is design↔code; the deliberate **non-goals** are penpot's
vector editor and realtime collaboration (heavy, off the agent-native thesis).

---

## 12. Extension seams

The discriminated unions are designed so later phases **add a case**, never rewrite:
`DesignArtifactKind` (`'html' | 'graph'` — penpot is a future member),
`DesignCanvasView` (`'preview' | 'code' | 'live'`), `DesignGraphNodeKind`
(`'prompt' | 'design' | 'image'`). The canvas renderer and the turn builder branch on
these.

---

## 13. Deferred: MCP exposure (the plan)

Exposing design artifacts to agents over MCP is fully mapped but intentionally not
shipped — it touches `main/index.ts`'s startup child-process gating in ~6 sites (the
most startup-critical file) and cannot be verified without a packaged run. The plan:

1. Add read-only `/design/internal/list` + `/design/internal/read` to
   `ScheduleRuntime.handleInternalRequest` (`schedule-runtime.ts`); resolve the
   workspace server-side via `settings.write.activeWorkspaceRoot`; reuse the existing
   bearer-token auth.
2. Add `src/main/design-artifacts-mcp-server.ts` (mirror `claw-schedule-mcp-server.ts`)
   — a stdio MCP server proxying to those endpoints, registering `design_list_artifacts`
   / `design_read_artifact`.
3. Add `design-artifacts-mcp-node-entry.ts`; handle the launch flag in `main/index.ts`
   (generalize `runningClawScheduleMcpServer`'s 6 gate sites).
4. Inject the server into the Kun config in `kun-process.ts` (mirror
   `buildGuiScheduleKunMcpServer`), and package the entry via `package.json`.

---

## 14. Runtime-only behaviors to verify

Typecheck/lint/unit tests cover the code shape, not these (need a real `npm run dev`):

- Artifact rehydration (list survives reload), PDF export (hidden-window `printToPDF`).
- Node-canvas execution (sequential agent turns, live status), image nodes (the agent
  must land the generated image at the node path — `generate_image` writes to
  `.deepseekgui-images/` by default, so the node prompt asks it to copy to the reserved
  path; if it doesn't, the node shows an error rather than breaking).
- The built-in design skill activating (appears after a runtime restart).
- The code-drift ⚠ badge appearing after the shared design system changes.
