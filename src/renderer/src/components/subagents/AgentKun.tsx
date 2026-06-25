import type { ReactElement } from 'react'
import kunClip from '../../../../asset/img/kun_clip.png'
import kunSearch from '../../../../asset/img/kun_search.png'
import kunLaptop from '../../../../asset/img/kun_laptop.png'
import kunMagic from '../../../../asset/img/kun_magic.png'
import kunCheer from '../../../../asset/img/kun_cheer.png'
import kunHeadset from '../../../../asset/img/kun_headset.png'
import kunWrench from '../../../../asset/img/kun_wrench.png'
import kunRest from '../../../../asset/img/kun_rest.png'

/**
 * Animated kun mascot avatar. Each role id maps to a distinct real kun PNG pose
 * with a per-role CSS animation (float / sway / breathe / bob). Disabled rows
 * render the resting kun in grayscale.
 *
 * Pose map:
 *   design-reviewer            → kun_clip    (写字板·审查,  bob)
 *   over-engineering-reviewer  → kun_search  (放大镜·审视,  float)
 *   code-review                → kun_laptop  (笔记本·看代码, breathe)
 *   compaction                 → kun_magic   (魔法棒·压缩,  sway)
 *   title                      → kun_cheer   (庆祝·命名,    bob)
 *   summary                    → kun_headset (耳麦·复述,    float)
 *   custom / fallback          → kun_wrench  (工具·自定义,  breathe)
 *   disabled                   → kun_rest    (抱枕睡, grayscale, no motion)
 */

type Anim = 'float' | 'sway' | 'breathe' | 'bob'

const STYLE_ID = 'ds-agent-kun-style'
const STYLE = `
@keyframes dsKunFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes dsKunSway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes dsKunBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes dsKunBob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-2.5px) rotate(3deg)}}
.ds-agent-kun{display:inline-flex;align-items:center;justify-content:center}
.ds-agent-kun img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(31,45,64,.14))}
.ds-agent-kun.is-disabled img{filter:grayscale(1) opacity(.7)}
.ds-agent-kun-float img{animation:dsKunFloat 2.4s ease-in-out infinite}
.ds-agent-kun-sway img{animation:dsKunSway 2.1s ease-in-out infinite;transform-origin:50% 90%}
.ds-agent-kun-breathe img{animation:dsKunBreathe 3s ease-in-out infinite}
.ds-agent-kun-bob img{animation:dsKunBob 2.7s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ds-agent-kun img{animation:none!important}}
`

function ensureStyle(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = STYLE
  document.head.appendChild(el)
}

const POSE: Record<string, { src: string; anim: Anim }> = {
  general: { src: kunLaptop, anim: 'breathe' },
  explore: { src: kunSearch, anim: 'float' },
  'design-reviewer': { src: kunClip, anim: 'bob' },
  'over-engineering-reviewer': { src: kunWrench, anim: 'sway' },
  'code-review': { src: kunClip, anim: 'breathe' },
  compaction: { src: kunMagic, anim: 'sway' },
  title: { src: kunCheer, anim: 'bob' },
  summary: { src: kunHeadset, anim: 'float' }
}

const FALLBACK: { src: string; anim: Anim } = { src: kunWrench, anim: 'breathe' }

/**
 * @param id      role id (drives the pose); unknown ids → fallback (custom kun)
 * @param disabled when true, renders resting kun in grayscale with no motion
 * @param className sizing wrapper class (e.g. "h-10 w-10")
 */
export function AgentKun({
  id,
  disabled = false,
  className
}: {
  id: string
  /** Retained for API compatibility with old callers; unused (PNGs are fixed). */
  color?: string
  disabled?: boolean
  className?: string
}): ReactElement {
  ensureStyle()
  if (disabled) {
    return (
      <span className={`ds-agent-kun is-disabled ${className ?? ''}`}>
        <img src={kunRest} alt="" aria-hidden="true" />
      </span>
    )
  }
  const pose = POSE[id] ?? FALLBACK
  return (
    <span className={`ds-agent-kun ds-agent-kun-${pose.anim} ${className ?? ''}`}>
      <img src={pose.src} alt="" aria-hidden="true" />
    </span>
  )
}
