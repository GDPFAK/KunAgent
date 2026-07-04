import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import { DESTRUCTIVE_ACTION_LABEL_RE, DESTRUCTIVE_SAFETY_MARKUP_RE, DESTRUCTIVE_TONE_MARKUP_RE, DIALOG_CLOSE_LABEL_RE, DIALOG_CONTAINER_CLASS_RE, FORM_FIELD_AFFORDANCE_RE, GENERIC_ACTION_LABEL_RE, GENERIC_DIALOG_TITLE_RE, GENERIC_FORM_FIELD_LABEL_RE, GENERIC_IMAGE_ALT_RE, GENERIC_SETTINGS_CONTROL_LABEL_RE, LEAD_FORM_ERROR_RE, LEAD_FORM_LOADING_RE, LEAD_FORM_SIGNAL_RE, LEAD_FORM_SUCCESS_RE, SETTINGS_CONTROL_SURFACE_RE, SPECIFIC_CHART_LABEL_RE, SPECIFIC_DIALOG_TITLE_RE, SPECIFIC_FORM_FIELD_LABEL_RE, SPECIFIC_SETTINGS_CONTROL_LABEL_RE, textContent } from './patterns'
import { attributeValue, attributeValues, hasFormFeedbackScript, isDeadHrefTarget, isSkippableInput, normalizedClassText, pairedTagMatches, tagMatches } from './interaction-and-accessibility'
import { chartLabelTexts, chartLikeBlocks, genericChartLabel, hasChartDataContext, normalizedChartLabel } from './records-and-charts'
import { concreteDataSignalCount, contentForDataRealism, hasBrandLandingScreenSignal, hasProductAppScreenSignal, productAppModuleSignalCount } from './product-and-hero-content'
import { normalizedHeadingText } from './navigation-workflow-and-color'

export function specificChartLabel(text: string): boolean {
  const normalized = normalizedChartLabel(text)
  return (
    normalized.length > 0 &&
    normalized.length <= 96 &&
    (SPECIFIC_CHART_LABEL_RE.test(normalized) || concreteDataSignalCount(normalized) > 0)
  )
}

export function genericChartLabelTags(html: string): string[] {
  return chartLikeBlocks(html)
    .filter(({ tag, inner }) => hasChartDataContext(tag, inner))
    .filter(({ tag, inner }) => {
      const labels = chartLabelTexts(tag, inner)
      if (labels.length === 0) return false
      const genericCount = labels.filter(genericChartLabel).length
      const specificCount = labels.filter(specificChartLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    .map(({ tag }) => tag)
}

export function weakTableStructureTags(html: string): string[] {
  return pairedTagMatches(html, 'table')
    .filter(({ tag, inner }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') {
        return false
      }
      if (!/<t[dh]\b|<tr\b/i.test(inner)) return false
      return !(
        /<th\b/i.test(inner) ||
        /\bscope\s*=/i.test(inner) ||
        /<caption\b/i.test(inner) ||
        attributeValue(tag, 'aria-label') ||
        attributeValue(tag, 'aria-labelledby')
      )
    })
    .map(({ tag }) => tag)
}

export function controlLabel(tag: string, inner = ''): string {
  return (
    textContent(inner) ||
    attributeValue(tag, 'aria-label') ||
    attributeValue(tag, 'title') ||
    attributeValue(tag, 'value') ||
    ''
  ).trim()
}

export function primaryButtonLabels(html: string): string[] {
  const labels = pairedTagMatches(html, 'button')
    .map(({ tag, inner }) => controlLabel(tag, inner))
    .filter(Boolean)

  for (const tag of tagMatches(html, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (type === 'button' || type === 'submit') {
      const label = controlLabel(tag)
      if (label) labels.push(label)
    }
  }

  for (const { tag, inner } of pairedTagMatches(html, 'a')) {
    if ((attributeValue(tag, 'role') ?? '').toLowerCase() === 'button') {
      const label = controlLabel(tag, inner)
      if (label) labels.push(label)
    }
  }
  return labels
}

export function isGenericActionLabel(label: string): boolean {
  return GENERIC_ACTION_LABEL_RE.test(
    label
      .replace(/\s+/g, ' ')
      .replace(/[.!?。！？]+$/g, '')
      .trim()
  )
}

export function hasGenericActionCopy(html: string): boolean {
  const labels = primaryButtonLabels(html)
  return labels.length > 0 && labels.every(isGenericActionLabel)
}

export function normalizedActionLabel(label: string): string {
  return label
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
}

export function isDestructiveActionLabel(label: string): boolean {
  return DESTRUCTIVE_ACTION_LABEL_RE.test(normalizedActionLabel(label))
}

export function hasDestructiveToneMarkup(html: string): boolean {
  if (DESTRUCTIVE_TONE_MARKUP_RE.test(html)) return true
  return /#(?:b91c1c|dc2626|ef4444|991b1b)\b|\b(?:red|crimson|firebrick)\b/i.test(html)
}

export function hasDestructiveSafetyMarkup(html: string): boolean {
  return DESTRUCTIVE_SAFETY_MARKUP_RE.test(html)
}

export function destructiveActionControlTags(html: string): string[] {
  const controls = [
    ...pairedTagMatches(html, 'button')
      .filter(({ tag }) => !/\bdisabled\b/i.test(tag))
      .filter(({ tag, inner }) => isDestructiveActionLabel(controlLabel(tag, inner)))
      .map(({ tag }) => tag),
    ...pairedTagMatches(html, 'a')
      .filter(({ tag, inner }) => isDestructiveActionLabel(controlLabel(tag, inner)))
      .map(({ tag }) => tag)
  ]

  for (const tag of tagMatches(html, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (!['button', 'submit'].includes(type) || /\bdisabled\b/i.test(tag)) continue
    if (isDestructiveActionLabel(controlLabel(tag))) controls.push(tag)
  }

  return controls
}

export function weakDestructiveActionSafetyTags(html: string): string[] {
  const controls = destructiveActionControlTags(html)
  if (controls.length === 0) return []
  if (hasDestructiveToneMarkup(html) && hasDestructiveSafetyMarkup(html)) return []
  return controls
}

export function hasDialogContainerClass(tag: string): boolean {
  return DIALOG_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

export function hasDialogSemantics(tag: string, tagName: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  return tagName === 'dialog' || role === 'dialog' || role === 'alertdialog' || (attributeValue(tag, 'aria-modal') ?? '').toLowerCase() === 'true'
}

export function hasDialogAccessibleName(tag: string, inner: string): boolean {
  return Boolean(attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) || hasLocalModuleHeading(inner)
}

export function hasDialogCloseAction(inner: string): boolean {
  const controls = [
    ...pairedTagMatches(inner, 'button').map(({ tag, inner: controlInner }) => controlLabel(tag, controlInner)),
    ...pairedTagMatches(inner, 'a').map(({ tag, inner: controlInner }) => controlLabel(tag, controlInner))
  ]
  for (const tag of tagMatches(inner, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (['button', 'submit', 'reset'].includes(type)) controls.push(controlLabel(tag))
  }
  return controls.some((label) => DIALOG_CLOSE_LABEL_RE.test(normalizedActionLabel(label)))
}

export function weakDialogAffordanceTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['dialog', 'div', 'section', 'aside', 'article']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const dialogLike = hasDialogSemantics(tag, tagName) || hasDialogContainerClass(tag)
      if (!dialogLike) continue
      if (!hasDialogSemantics(tag, tagName) || !hasDialogAccessibleName(tag, inner) || !hasDialogCloseAction(inner)) weak.push(tag)
    }
  }
  return weak
}

export function textForElementId(html: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<([a-z0-9-]+)\\b[^>]*\\bid\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i')
  return textContent(re.exec(html)?.[2] ?? '')
}

export function dialogTitleTexts(html: string, tag: string, inner: string): string[] {
  const titles = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? ''
  ]
  const labelledBy = attributeValue(tag, 'aria-labelledby') ?? ''
  for (const id of labelledBy.split(/\s+/).map((item) => item.trim()).filter(Boolean)) {
    titles.push(textForElementId(html, id))
  }
  for (const tagName of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    titles.push(...pairedTagMatches(inner, tagName).map(({ inner: headingInner }) => textContent(headingInner)))
  }
  return Array.from(new Set(titles.map(normalizedHeadingText).filter(Boolean)))
}

export function genericDialogTitle(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_DIALOG_TITLE_RE.test(normalized)
}

export function specificDialogTitle(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 72 && SPECIFIC_DIALOG_TITLE_RE.test(normalized)
}

export function genericDialogTitleTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['dialog', 'div', 'section', 'aside', 'article']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasDialogSemantics(tag, tagName) || !hasDialogAccessibleName(tag, inner) || !hasDialogCloseAction(inner)) continue
      const titles = dialogTitleTexts(html, tag, inner)
      if (titles.length > 0 && titles.some(genericDialogTitle) && !titles.some(specificDialogTitle)) weak.push(tag)
    }
  }
  return weak
}

export function isDecorativeImage(tag: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  return role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true'
}

export function missingImageSourceTags(html: string): string[] {
  return tagMatches(html, 'img').filter((tag) => {
    const src = attributeValue(tag, 'src') ?? ''
    return isDeadHrefTarget(src)
  })
}

export function missingImageAltTags(html: string): string[] {
  return tagMatches(html, 'img').filter((tag) => {
    if (isDecorativeImage(tag)) return false
    return (
      attributeValue(tag, 'alt') === undefined &&
      !attributeValue(tag, 'aria-label') &&
      !attributeValue(tag, 'aria-labelledby') &&
      !attributeValue(tag, 'title')
    )
  })
}

export function imageAccessibleText(tag: string): string {
  const alt = attributeValue(tag, 'alt')
  if (alt !== undefined) return alt.trim()
  return (
    attributeValue(tag, 'aria-label') ??
    attributeValue(tag, 'title') ??
    ''
  ).trim()
}

export function genericImageAltTags(html: string): string[] {
  return tagMatches(html, 'img').filter((tag) => {
    if (isDecorativeImage(tag)) return false
    const label = imageAccessibleText(tag)
      .replace(/\s+/g, ' ')
      .trim()
    return label.length > 0 && label.length <= 48 && GENERIC_IMAGE_ALT_RE.test(label)
  })
}

export function inertFormTags(html: string): string[] {
  if (hasFormFeedbackScript(html)) return []
  if (tagMatches(html, 'button').some((tag) => attributeValue(tag, 'formaction'))) return []
  if (tagMatches(html, 'input').some((tag) => attributeValue(tag, 'formaction'))) return []
  const prototypeSubmitAttrs = ['data-href', 'data-prototype-href', 'data-prototype-target', 'data-target']
  if (tagMatches(html, 'button').some((tag) => prototypeSubmitAttrs.some((name) => attributeValue(tag, name)))) return []
  if (tagMatches(html, 'input').some((tag) => prototypeSubmitAttrs.some((name) => attributeValue(tag, name)))) return []
  return tagMatches(html, 'form').filter((tag) => {
    const action = attributeValue(tag, 'action')
    if (action && !isDeadHrefTarget(action)) return false
    if (prototypeSubmitAttrs.some((name) => attributeValue(tag, name))) return false
    return !attributeValue(tag, 'onsubmit')
  })
}

export function formFieldTags(html: string): string[] {
  return [
    ...tagMatches(html, 'input').filter((tag) => !isSkippableInput(tag)),
    ...tagMatches(html, 'select'),
    ...tagMatches(html, 'textarea')
  ]
}

export function hasFormFieldAffordance(html: string): boolean {
  return FORM_FIELD_AFFORDANCE_RE.test(html) || /<(small|output)\b/i.test(html)
}

export function weakFormAffordanceTags(html: string): string[] {
  return pairedTagMatches(html, 'form')
    .filter(({ tag, inner }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') {
        return false
      }
      return formFieldTags(inner).length >= 2 && !hasFormFieldAffordance(`${tag} ${inner}`)
    })
    .map(({ tag }) => tag)
}

export function formSignalText(tag: string, inner: string): string {
  const metadata = [
    attributeValue(tag, 'class') ?? '',
    attributeValue(tag, 'id') ?? '',
    attributeValue(tag, 'action') ?? '',
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...attributeValues(inner, 'name'),
    ...attributeValues(inner, 'type'),
    ...attributeValues(inner, 'placeholder'),
    ...attributeValues(inner, 'aria-label'),
    ...attributeValues(inner, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  return `${textContent(inner)} ${metadata}`
}

export function hasStaticLeadFormSignal(html: string, visibleText: string, tag: string, inner: string): boolean {
  return hasBrandLandingScreenSignal(html, visibleText) && LEAD_FORM_SIGNAL_RE.test(formSignalText(tag, inner))
}

export function leadFormTags(html: string, visibleText: string): string[] {
  if (!hasBrandLandingScreenSignal(html, visibleText)) return []
  return pairedTagMatches(html, 'form')
    .filter(({ tag, inner }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') {
        return false
      }
      if (formFieldTags(inner).length === 0) return false
      return hasStaticLeadFormSignal(html, visibleText, tag, inner)
    })
    .map(({ tag }) => tag)
}

export function normalizedFormFieldLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/\b(?:required|optional)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formFieldLabels(inner: string): string[] {
  const labels = pairedTagMatches(inner, 'label').map(({ inner: labelInner }) => textContent(labelInner))
  for (const tag of formFieldTags(inner)) {
    labels.push(
      attributeValue(tag, 'aria-label') ?? '',
      attributeValue(tag, 'title') ?? '',
      attributeValue(tag, 'placeholder') ?? '',
      (attributeValue(tag, 'name') ?? '').replace(/[-_]/g, ' ')
    )
  }
  return Array.from(new Set(labels.map(normalizedFormFieldLabel).filter(Boolean)))
}

export function genericFormFieldLabel(text: string): boolean {
  const normalized = normalizedFormFieldLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_FORM_FIELD_LABEL_RE.test(normalized)
}

export function specificFormFieldLabel(text: string): boolean {
  const normalized = normalizedFormFieldLabel(text)
  return normalized.length > 0 && normalized.length <= 64 && SPECIFIC_FORM_FIELD_LABEL_RE.test(normalized)
}

export function genericFormFieldLabelTags(html: string, visibleText: string): string[] {
  const productAppLike = hasProductAppScreenSignal(html, visibleText) && productAppModuleSignalCount(html) >= 2
  return pairedTagMatches(html, 'form')
    .filter(({ tag, inner }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') {
        return false
      }
      if (formFieldTags(inner).length < 2) return false
      if (!productAppLike && !hasStaticLeadFormSignal(html, visibleText, tag, inner)) return false
      const labels = formFieldLabels(inner)
      if (labels.length < 3) return false
      const genericCount = labels.filter(genericFormFieldLabel).length
      const specificCount = labels.filter(specificFormFieldLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    .map(({ tag }) => tag)
}

export function normalizedSettingsControlLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/%+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function labelTextForInputId(html: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i')
  return textContent(re.exec(html)?.[1] ?? '')
}

export function settingsControlLabels(inner: string): string[] {
  const labels: string[] = []
  for (const tag of tagMatches(inner, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (!['checkbox', 'radio'].includes(type)) continue
    const id = attributeValue(tag, 'id') ?? ''
    labels.push(
      id ? labelTextForInputId(inner, id) : '',
      attributeValue(tag, 'aria-label') ?? '',
      attributeValue(tag, 'title') ?? '',
      (attributeValue(tag, 'name') ?? '').replace(/[-_]/g, ' ')
    )
  }
  for (const { tag, inner: labelInner } of pairedTagMatches(inner, 'label')) {
    if (/<input\b[^>]*\btype\s*=\s*["'](?:checkbox|radio)["']/i.test(labelInner)) labels.push(textContent(labelInner))
  }
  for (const { tag, inner: controlInner } of pairedTagMatches(inner, 'button')) {
    if (/\baria-pressed\s*=/i.test(tag) || /\brole\s*=\s*["'](?:checkbox|radio|switch)["']/i.test(tag)) labels.push(controlLabel(tag, controlInner))
  }
  const roleControlRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["'](?:checkbox|radio|switch)["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleControlRe.exec(inner))) labels.push(controlLabel(match[1] ?? '', match[3] ?? ''))
  return Array.from(new Set(labels.map(normalizedSettingsControlLabel).filter(Boolean)))
}

export function settingsControlCount(inner: string): number {
  return (
    tagMatches(inner, 'input').filter((tag) => ['checkbox', 'radio'].includes((attributeValue(tag, 'type') ?? '').toLowerCase())).length +
    tagMatches(inner, 'button').filter((tag) => /\baria-pressed\s*=|\brole\s*=\s*["'](?:checkbox|radio|switch)["']/i.test(tag)).length +
    (inner.match(/\brole\s*=\s*["'](?:checkbox|radio|switch)["']/gi)?.length ?? 0)
  )
}

export function genericSettingsControlLabel(text: string): boolean {
  const normalized = normalizedSettingsControlLabel(text)
  return normalized.length > 0 && normalized.length <= 48 && GENERIC_SETTINGS_CONTROL_LABEL_RE.test(normalized)
}

export function specificSettingsControlLabel(text: string): boolean {
  const normalized = normalizedSettingsControlLabel(text)
  return normalized.length > 0 && normalized.length <= 96 && SPECIFIC_SETTINGS_CONTROL_LABEL_RE.test(normalized)
}

export function hasSettingsControlSurface(tag: string, inner: string): boolean {
  const metadata = [
    attributeValue(tag, 'class') ?? '',
    attributeValue(tag, 'id') ?? '',
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    textContent(inner)
  ].join(' ').replace(/[-_]/g, ' ')
  return SETTINGS_CONTROL_SURFACE_RE.test(metadata)
}

export function genericSettingsControlLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) && !SETTINGS_CONTROL_SURFACE_RE.test(visibleText)) return []
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'form', 'fieldset', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasSettingsControlSurface(tag, inner) || settingsControlCount(inner) < 3) continue
      const labels = settingsControlLabels(inner)
      if (labels.length < 3) continue
      const genericCount = labels.filter(genericSettingsControlLabel).length
      const specificCount = labels.filter(specificSettingsControlLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

export function hasLeadFormResponseStates(html: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'role'),
    ...attributeValues(html, 'aria-live'),
    ...attributeValues(html, 'aria-busy'),
    ...attributeValues(html, 'aria-invalid'),
    ...attributeValues(html, 'data-state'),
    ...attributeValues(html, 'data-status')
  ].join(' ').replace(/[-_]/g, ' ')
  const signal = `${textContent(html)} ${metadata}`
  return LEAD_FORM_SUCCESS_RE.test(signal) && LEAD_FORM_ERROR_RE.test(signal) && LEAD_FORM_LOADING_RE.test(signal)
}

export function weakLeadFormResponseTags(html: string, visibleText: string): string[] {
  const forms = leadFormTags(html, visibleText)
  if (forms.length === 0 || hasLeadFormResponseStates(html)) return []
  return forms
}

export function hasLocalModuleHeading(inner: string): boolean {
  return /<h[1-6]\b/i.test(inner) || /\brole\s*=\s*["']heading["']/i.test(inner) || /<legend\b/i.test(inner)
}

export function hasModuleAccessibleName(tag: string, inner: string): boolean {
  return (
    Boolean(attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) ||
    hasLocalModuleHeading(inner)
  )
}

export function unnamedContentSectionTags(html: string): string[] {
  const tags: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'form']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (hasModuleAccessibleName(tag, inner)) continue
      const moduleText = contentForDataRealism(textContent(inner))
      const hasMeaningfulStructure = /<(table|ul|ol|li|button|input|select|textarea|article|aside)\b/i.test(inner)
      if (moduleText.length >= 80 || hasMeaningfulStructure) tags.push(tag)
    }
  }
  return tags
}
