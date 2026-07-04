import type { WorkbenchRightPanelProps } from './WorkbenchRightPanel'

export type WorkbenchRightPanelSharedProps = WorkbenchRightPanelProps['design']['shared']

export function buildWorkbenchRightPanelSharedProps(
  props: WorkbenchRightPanelSharedProps
): WorkbenchRightPanelSharedProps {
  return props
}
