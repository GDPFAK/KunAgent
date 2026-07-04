const STRONG_IMAGE_ASSET_RE =
  /\b(logo|logomark|brand mark|icon|illustration|mascot|sticker)\b|图标|标志|标识|品牌标识|插画|吉祥物|贴纸/i

const IMAGE_ASSET_RE =
  /\b(image|picture|photo|asset|poster)\b|图片|生图|生成[^\n。！？.!?]{0,12}图|素材|海报|头像/i

const SCREEN_DESIGN_RE =
  /\b(page|screen|website|webpage|landing page|dashboard|prototype|mockup)\b|页面|界面|网页|网站|原型|设计稿|看板/i

const HARD_SCREEN_DESIGN_RE =
  /\b(page|screen|landing page|dashboard|prototype|mockup)\b|页面|界面|原型|设计稿|看板/i

/**
 * Empty design boards normally route a broad brief into the multi-page design
 * pipeline. Strong image-asset briefs (logo/icon/illustration/etc.) should stay
 * on the canvas lane so the agent calls generate_image and places a reusable
 * picture on the whiteboard instead of creating an HTML screen.
 */
export function looksLikeStandaloneImageAssetPrompt(text: string): boolean {
  const prompt = text.trim()
  if (!prompt) return false
  if (HARD_SCREEN_DESIGN_RE.test(prompt)) return false
  if (STRONG_IMAGE_ASSET_RE.test(prompt)) return true
  return IMAGE_ASSET_RE.test(prompt) && !SCREEN_DESIGN_RE.test(prompt)
}
