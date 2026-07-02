import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_EDITOR_BACK_BUTTON_CLASS,
  WORKFLOW_EDITOR_HEADER_CLASS,
  WORKFLOW_EDITOR_HEADER_SIDEBAR_COLLAPSED_CLASS,
  WORKFLOW_EDITOR_SIDEBAR_CLASS
} from './WorkflowEditorView'

describe('WorkflowEditorView', () => {
  it('keeps back navigation in the sidebar and reserves titlebar space only when collapsed', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const css = await readFile(new URL('../../styles/workflow-canvas.css', import.meta.url), 'utf8')
    const source = await readFile(new URL('./WorkflowEditorView.tsx', import.meta.url), 'utf8')

    expect(WORKFLOW_EDITOR_HEADER_CLASS).toContain('workflow-editor-header')
    expect(WORKFLOW_EDITOR_HEADER_CLASS).toContain('ds-drag')
    expect(WORKFLOW_EDITOR_HEADER_CLASS).not.toContain('py-')
    expect(WORKFLOW_EDITOR_SIDEBAR_CLASS).toContain('workflow-editor-sidebar')
    expect(WORKFLOW_EDITOR_SIDEBAR_CLASS).toContain('ds-drag')
    expect(WORKFLOW_EDITOR_BACK_BUTTON_CLASS).toContain('ds-no-drag')
    expect(css).toContain('.workflow-editor-header')
    expect(css).toContain('height: 4rem')
    expect(css).toContain(":root[data-platform='darwin'] .workflow-editor-header")
    expect(css).toContain('padding-top: 1rem')
    expect(css).toContain('padding-bottom: 0.5rem')
    expect(css).toContain(`:root[data-platform='darwin'] .${WORKFLOW_EDITOR_HEADER_SIDEBAR_COLLAPSED_CLASS}`)
    expect(css).toContain('var(--ds-collapsed-sidebar-titlebar-extra-inset)')
    expect(source).toContain('className={WORKFLOW_EDITOR_SIDEBAR_CLASS}')
    expect(source).toContain('className={WORKFLOW_EDITOR_BACK_BUTTON_CLASS}')
    expect(source.indexOf('className={WORKFLOW_EDITOR_SIDEBAR_CLASS}')).toBeLessThan(
      source.indexOf('className={`${WORKFLOW_EDITOR_HEADER_CLASS}')
    )
  })
})
