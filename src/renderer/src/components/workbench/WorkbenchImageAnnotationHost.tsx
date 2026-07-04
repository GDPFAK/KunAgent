import type { ReactElement } from 'react'
import {
  WorkbenchImageAnnotationOverlay,
  type WorkbenchImageAnnotationOverlayProps
} from '../design/canvas/WorkbenchImageAnnotationOverlay'

export type WorkbenchImageAnnotationHostProps = WorkbenchImageAnnotationOverlayProps

export function WorkbenchImageAnnotationHost(props: WorkbenchImageAnnotationHostProps): ReactElement {
  return <WorkbenchImageAnnotationOverlay {...props} />
}
