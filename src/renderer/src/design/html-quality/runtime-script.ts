import { PROTOTYPE_NAV_HASH_PREFIX } from './helper-index'
import { DESIGN_RUNTIME_QUALITY_AUDIT_SCRIPT_PREAMBLE } from './runtime-script-preamble'
import { DESIGN_RUNTIME_QUALITY_AUDIT_DOM_HELPERS } from './runtime-script-dom-helpers'
import { DESIGN_RUNTIME_QUALITY_AUDIT_INTERACTION_RULES } from './runtime-script-interaction-rules'
import { DESIGN_RUNTIME_QUALITY_AUDIT_CONTENT_RULES } from './runtime-script-content-rules'
import { DESIGN_RUNTIME_QUALITY_AUDIT_LAYOUT_RULES } from './runtime-script-layout-rules'
import { DESIGN_RUNTIME_QUALITY_AUDIT_VISUAL_RULES } from './runtime-script-visual-rules'

const runtimeSegment1 = [DESIGN_RUNTIME_QUALITY_AUDIT_SCRIPT_PREAMBLE].join('')
const runtimeSegment2 = [DESIGN_RUNTIME_QUALITY_AUDIT_DOM_HELPERS, DESIGN_RUNTIME_QUALITY_AUDIT_INTERACTION_RULES, DESIGN_RUNTIME_QUALITY_AUDIT_CONTENT_RULES, DESIGN_RUNTIME_QUALITY_AUDIT_LAYOUT_RULES, DESIGN_RUNTIME_QUALITY_AUDIT_VISUAL_RULES].join('')

export function buildDesignRuntimeQualityAuditScript(): string {
  const script = [runtimeSegment1, PROTOTYPE_NAV_HASH_PREFIX, runtimeSegment2].join('')
  return `(() => {
    try {
      return (${script})
    } catch {
      return []
    }
  })()`
}
