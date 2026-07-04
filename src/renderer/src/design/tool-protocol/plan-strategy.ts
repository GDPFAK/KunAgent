import type { DesignContext } from '../design-context'

export type PlanCounts = {
  objectCount: number
  frameCount: number
  htmlFrameCount: number
  runningAppFrameCount: number
  directionCount: number
  tokenCount: number
  componentCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  unresolvedNoteCount: number
  journalEntryCount: number
}

export type DesignPlanMode =
  | 'whiteboard'
  | 'screen-generation'
  | 'direction-comparison'
  | 'quality-repair'
  | 'systemization'
  | 'code-roundtrip'
  | 'handoff'

export type DesignPlanAction = {
  toolId: string
  reason: string
  inputHint: string
  expectedOutput: string
}

export type DesignPlanStrategy = {
  mode: DesignPlanMode
  focus: string
  nextTools: string[]
  actions: DesignPlanAction[]
  risks: string[]
}

function targetLabel(ctx: DesignContext | undefined): string {
  return ctx?.designTarget === 'app' ? 'mobile app' : 'responsive web'
}

function action(
  toolId: string,
  reason: string,
  inputHint: string,
  expectedOutput: string
): DesignPlanAction {
  return { toolId, reason, inputHint, expectedOutput }
}

function strategy(
  mode: DesignPlanMode,
  focus: string,
  actions: DesignPlanAction[],
  risks: string[] = []
): DesignPlanStrategy {
  return {
    mode,
    focus,
    nextTools: actions.map((item) => item.toolId),
    actions,
    risks
  }
}

export function buildDesignPlanStrategy(
  counts: PlanCounts,
  designContext?: DesignContext
): DesignPlanStrategy {
  const target = targetLabel(designContext)
  if (counts.htmlFrameCount === 0 && counts.frameCount === 0) {
    return strategy(
      'whiteboard',
      `Start a ${target} design board from prompt into comparable screen directions.`,
      [
        action(
          'design.generate_directions',
          'No screen frames exist yet; generate multiple options before committing to one.',
          `prompt + designTarget=${designContext?.designTarget ?? 'web'} + direction count`,
          'Direction frames with linked HTML artifacts and DESIGN.md notes'
        ),
        action(
          'design.system',
          'Seed reusable tokens/components early so generated screens share a visual language.',
          'brand color, tone, density, font style, and any preset constraints',
          'Design system tokens and reusable component definitions'
        ),
        action(
          'design.generate_screen',
          'Create a focused first screen once the direction or product goal is clear.',
          'selected direction, target screen name, prompt, and device target',
          'One graph-backed HTML screen frame ready for critique'
        )
      ],
      ['No existing screen context; first output should be treated as exploratory.']
    )
  }

  if (counts.htmlFrameCount === 0) {
    return strategy(
      'screen-generation',
      'Convert whiteboard frames and layout sketches into linked HTML screen artifacts.',
      [
        action(
          'design.generate_screen',
          'Canvas frames exist but are not linked to HTML artifacts yet.',
          'selected frame ids, screen title, prompt, and target device',
          'Linked HTML frame(s) with writable artifact paths'
        ),
        action(
          'design.system',
          'Extract tokens from the sketch before broadening screen work.',
          'selected frame styles and recurring UI patterns',
          'Token/component baseline for later generated screens'
        ),
        action(
          'design.critique',
          'Check the converted screen for layout, accessibility, and handoff readiness.',
          'newly created screen frame ids',
          'Repairable findings attached as agent notes'
        )
      ]
    )
  }

  if (counts.directionCount < 2 && counts.htmlFrameCount < 3) {
    return strategy(
      'direction-comparison',
      'Create enough alternatives to compare visual and product direction.',
      [
        action(
          'design.generate_directions',
          'Only one or no named direction exists; comparison needs at least two alternatives.',
          'same product brief plus 2-4 named direction constraints',
          'Multiple direction frames with rationale-ready artifacts'
        ),
        action(
          'design.critique',
          'Score each direction before choosing what to refine.',
          'direction frame ids and quality criteria',
          'Findings and readiness signals per direction'
        ),
        action(
          'design.system',
          'Normalize tokens/components across alternatives for fair comparison.',
          'all direction frames or the accepted direction frame',
          'Shared tokens, components, variants, and lint results'
        )
      ],
      ['Direction comparison is weak until at least two alternatives exist.']
    )
  }

  if (counts.unresolvedNoteCount > 0) {
    return strategy(
      'quality-repair',
      'Resolve critique notes before exporting or implementing.',
      [
        action(
          'design.repair',
          'There are unresolved agent notes from critique or review.',
          'unresolved note target ids and preferred repair scope',
          'Focused shape operations with resolved notes'
        ),
        action(
          'design.critique',
          'Re-check repaired frames to avoid carrying defects into handoff.',
          'repaired frame ids',
          'Fresh validation findings and remaining risks'
        ),
        action(
          'design.export',
          'Export a handoff only after the repair pass is clean enough.',
          'accepted artifact ids and export format',
          'DESIGN.md or code/Penpot handoff payload'
        )
      ]
    )
  }

  if (counts.tokenCount === 0 || counts.componentCount === 0) {
    return strategy(
      'systemization',
      'Build the design system layer before code handoff.',
      [
        action(
          'design.system',
          'Screens exist but tokens or reusable components are missing.',
          'representative frames, brand rules, and repeated UI patterns',
          'Semantic tokens, components, variants, and lint findings'
        ),
        action(
          'design.critique',
          'Validate that the system is applied consistently.',
          'systemized screen ids',
          'Token/component usage findings'
        ),
        action(
          'design.export',
          'Publish DESIGN.md once the system baseline exists.',
          'project graph and accepted screen ids',
          'Stitch/Penpot-compatible handoff package'
        )
      ],
      ['Implementation will drift if screens remain one-off styling.']
    )
  }

  if (counts.staleBindingCount + counts.missingBindingCount > 0 || counts.activeBindingCount === 0) {
    return strategy(
      'code-roundtrip',
      'Prepare Onlook-style code binding before implementation.',
      [
        action(
          'design.bind_code',
          'Code bindings are missing or stale for the current design graph.',
          'running app frames, DOM/source snapshot, route paths, and selected screen ids',
          'Active code bindings plus stale/missing binding report'
        ),
        action(
          'design.critique',
          'Check code readiness after bindings are refreshed.',
          'bound screen and component ids',
          'Implementation blockers and repairable notes'
        ),
        action(
          'design.export',
          'Create a stable handoff while code binding catches up.',
          'bound artifacts and DESIGN.md format',
          'Code handoff payload with graph and design notes'
        )
      ]
    )
  }

  return strategy(
    'handoff',
    'Design graph is ready for export or implementation.',
    [
      action(
        'design.critique',
        'Run one final quality gate before handoff.',
        'accepted screen ids and design-system lint rules',
        'Final findings or clean validation'
      ),
      action(
        'design.export',
        'Package the design for Penpot, DESIGN.md, or code handoff.',
        'accepted artifacts, graph, system, and desired export target',
        'Handoff payload and artifact references'
      ),
      action(
        'design.implement',
        'Active code bindings exist; design operations can be translated to code requests.',
        'latest operation journal and active code bindings',
        'Grouped code change requests or written source updates'
      )
    ]
  )
}
