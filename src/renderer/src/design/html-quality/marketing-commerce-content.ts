import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import { BRAND_NAV_CLASS_RE, CONCRETE_CONVERSION_CLOSE_CONTEXT_RE, CONCRETE_FAQ_DETAIL_RE, CONCRETE_FAQ_QUESTION_RE, CONCRETE_FEATURE_DETAIL_RE, CONCRETE_PRICING_PLAN_DETAIL_RE, CONCRETE_TESTIMONIAL_CONTEXT_RE, CONVERSION_CLOSE_CLASS_RE, CONVERSION_CLOSE_TEXT_RE, DESIGN_ITEM_CARD_CLASS_RE, FAQ_QUESTION_RE, FAQ_SECTION_RE, FEATURE_DETAIL_RE, FEATURE_ITEM_CLASS_RE, FEATURE_SECTION_RE, GENERIC_CONVERSION_CLOSE_COPY_RE, GENERIC_CONVERSION_CLOSE_HEADING_RE, GENERIC_FAQ_ANSWER_RE, GENERIC_FAQ_QUESTION_RE, GENERIC_FEATURE_DETAIL_RE, GENERIC_FEATURE_TITLE_RE, GENERIC_PRICING_PLAN_ACTION_RE, GENERIC_PRICING_PLAN_DETAIL_RE, GENERIC_SITE_FOOTER_LABEL_RE, GENERIC_TESTIMONIAL_COPY_RE, LEAD_FORM_SIGNAL_RE, MARKETING_FEATURE_SURFACE_RE, PRICING_ACTION_RE, PRICING_CADENCE_RE, PRICING_FEATURE_RE, PRICING_PLAN_CLASS_RE, PRICING_PRICE_GLOBAL_RE, PRICING_PRICE_RE, PRICING_RECOMMENDATION_RE, PRICING_SURFACE_RE, SITE_FOOTER_CLASS_RE, SITE_FOOTER_TEXT_RE, STRONG_CONVERSION_CLOSE_TEXT_RE, TESTIMONIAL_ATTRIBUTION_RE, textContent } from './patterns'
import { attributeValue, attributeValues, hasStaticPrimaryAction, isDeadHrefTarget, normalizedClassText, pairedTagMatches, staticHeadingTexts, tagMatches } from './interaction-and-accessibility'
import { controlLabel, normalizedActionLabel } from './controls-forms-and-dialogs'
import { contentForDataRealism, hasBrandLandingScreenSignal, hasTestimonialAttribution, hasTopLevelHeading, testimonialBlocks } from './product-and-hero-content'
import { navigationBlocks, normalizedHeadingText, portfolioSurfaceSignal, topLevelHeadingTexts } from './navigation-workflow-and-color'

export function testimonialQuoteTexts(block: string): string[] {
  const quotes = ['blockquote', 'q']
    .flatMap((tagName) => pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner)))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length >= 16)
  if (quotes.length > 0) return quotes
  return pairedTagMatches(block, 'p')
    .map(({ inner }) => textContent(inner).replace(/\s+/g, ' ').trim())
    .filter((text) => text.length >= 24 && (!TESTIMONIAL_ATTRIBUTION_RE.test(text) || GENERIC_TESTIMONIAL_COPY_RE.test(text)))
}

export function genericTestimonialCopyText(text: string): boolean {
  const normalized = contentForDataRealism(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return (
    normalized.length >= 16 &&
    normalized.length <= 260 &&
    GENERIC_TESTIMONIAL_COPY_RE.test(normalized) &&
    !CONCRETE_TESTIMONIAL_CONTEXT_RE.test(normalized)
  )
}

export function genericTestimonialCopyTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText)) return []
  return testimonialBlocks(html)
    .filter(hasTestimonialAttribution)
    .filter((block) => testimonialQuoteTexts(block).some(genericTestimonialCopyText))
    .slice(0, 4)
}

export function marketingFeatureSurfaceSignal(html: string, visibleText: string): boolean {
  const headings = [...topLevelHeadingTexts(html), ...staticHeadingTexts(html)].join(' ')
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  const signal = `${visibleText} ${headings} ${metadata}`
  return (
    hasBrandLandingScreenSignal(html, visibleText) &&
    MARKETING_FEATURE_SURFACE_RE.test(signal) &&
    !portfolioSurfaceSignal(html, visibleText) &&
    !pricingSurfaceSignal(html, visibleText)
  )
}

export function featureItemCount(markup: string): number {
  const structuredItems = ['article', 'li']
    .flatMap((tagName) => pairedTagMatches(markup, tagName))
    .filter(({ inner }) => contentForDataRealism(textContent(inner)).length >= 36).length
  const explicitItems = ['article', 'li', 'div']
    .flatMap((tagName) => pairedTagMatches(markup, tagName))
    .filter(({ tag, inner }) => {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      return FEATURE_ITEM_CLASS_RE.test(metadata) && contentForDataRealism(textContent(inner)).length >= 28
    }).length
  return Math.max(structuredItems, explicitItems)
}

export function hasFeatureAnatomy(html: string): boolean {
  const featureSections = pairedTagMatches(html, 'section')
  return featureSections.some(({ tag, inner }) => {
    const sectionText = textContent(inner)
    const sectionMetadata = [
      ...attributeValues(tag, 'class'),
      ...attributeValues(tag, 'id'),
      ...attributeValues(tag, 'aria-label'),
      ...attributeValues(tag, 'title')
    ].join(' ').replace(/[-_]/g, ' ')
    const sectionSignal = FEATURE_SECTION_RE.test(sectionText) || FEATURE_SECTION_RE.test(sectionMetadata)
    return sectionSignal && featureItemCount(inner) >= 2 && FEATURE_DETAIL_RE.test(sectionText)
  })
}

export function hasWeakFeatureAnatomy(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    marketingFeatureSurfaceSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    !hasFeatureAnatomy(html)
  )
}

export function featureCardBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'section')) {
    const metadata = [
      ...attributeValues(tag, 'class'),
      ...attributeValues(tag, 'id'),
      ...attributeValues(tag, 'aria-label'),
      ...attributeValues(tag, 'title')
    ].join(' ').replace(/[-_]/g, ' ')
    const sectionText = textContent(inner)
    if (!FEATURE_SECTION_RE.test(`${metadata} ${sectionText}`)) continue
    for (const tagName of ['article', 'li', 'div']) {
      for (const match of pairedTagMatches(inner, tagName)) {
        const cardMetadata = [
          ...attributeValues(match.tag, 'class'),
          ...attributeValues(match.tag, 'id'),
          ...attributeValues(match.tag, 'aria-label'),
          ...attributeValues(match.tag, 'title')
        ].join(' ').replace(/[-_]/g, ' ')
        const cardText = contentForDataRealism(textContent(match.inner))
        if (tagName !== 'div' || FEATURE_ITEM_CLASS_RE.test(cardMetadata)) {
          if (cardText.length >= 28) blocks.push(`${match.tag}${match.inner}`)
        }
      }
    }
  }
  return blocks
}

export function genericFeatureCardDetail(block: string): boolean {
  const heading = staticHeadingTexts(block)[0] ?? ''
  const text = contentForDataRealism(textContent(block))
  const normalizedHeading = heading
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const genericTitle = GENERIC_FEATURE_TITLE_RE.test(normalizedHeading)
  const genericCopy = GENERIC_FEATURE_DETAIL_RE.test(text)
  const concreteDetail = CONCRETE_FEATURE_DETAIL_RE.test(text)
  return (genericTitle || genericCopy) && !concreteDetail
}

export function genericFeatureCardDetailTags(html: string, visibleText: string): string[] {
  if (!marketingFeatureSurfaceSignal(html, visibleText) || !hasFeatureAnatomy(html)) return []
  const blocks = featureCardBlocks(html)
  if (blocks.length < 2) return []
  return blocks.filter(genericFeatureCardDetail).slice(0, 4)
}

export function normalizedCardCopy(text: string): string {
  return contentForDataRealism(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$€£¥%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function duplicatedDesignCardCopyTexts(html: string): string[] {
  const counts = new Map<string, number>()
  for (const tagName of ['article', 'li', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      if (!DESIGN_ITEM_CARD_CLASS_RE.test(metadata)) continue
      const copy = normalizedCardCopy(textContent(inner))
      if (copy.length < 36 || copy.length > 360 || copy.split(' ').length < 6) continue
      counts.set(copy, (counts.get(copy) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([copy]) => copy)
}

export function pricingSurfaceSignal(html: string, visibleText: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  const content = `${visibleText} ${metadata}`
  return hasBrandLandingScreenSignal(html, visibleText) && PRICING_SURFACE_RE.test(content) && PRICING_PRICE_RE.test(content)
}

export function pricingPlanCount(html: string, visibleText: string): number {
  const classPlans = ['section', 'article', 'div', 'li']
    .flatMap((tagName) => tagMatches(html, tagName))
    .filter((tag) => PRICING_PLAN_CLASS_RE.test(normalizedClassText(tag))).length
  const priceValues = visibleText.match(PRICING_PRICE_GLOBAL_RE)?.length ?? 0
  return Math.max(classPlans, priceValues)
}

export function hasPricingStructure(html: string, visibleText: string): boolean {
  if (pricingPlanCount(html, visibleText) < 2) return false
  const detailCount = [
    PRICING_RECOMMENDATION_RE.test(visibleText) || PRICING_RECOMMENDATION_RE.test(html),
    PRICING_CADENCE_RE.test(visibleText),
    PRICING_FEATURE_RE.test(visibleText),
    PRICING_ACTION_RE.test(textContent(html))
  ].filter(Boolean).length
  return detailCount >= 2
}

export function hasWeakPricingStructure(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && pricingSurfaceSignal(html, visibleText) && !hasPricingStructure(html, visibleText)
}

export function pricingPlanBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const tagName of ['article', 'li', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const text = textContent(inner)
      if (PRICING_PLAN_CLASS_RE.test(metadata) && PRICING_PRICE_RE.test(text)) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function genericPricingPlanDetail(block: string): boolean {
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC_PRICING_PLAN_DETAIL_RE.test(text) && !CONCRETE_PRICING_PLAN_DETAIL_RE.test(text)
}

export function genericPricingPlanDetailTags(html: string, visibleText: string): string[] {
  if (!pricingSurfaceSignal(html, visibleText) || !hasPricingStructure(html, visibleText)) return []
  const blocks = pricingPlanBlocks(html)
  if (blocks.length < 2) return []
  return blocks.filter(genericPricingPlanDetail).slice(0, 4)
}

export function pricingPlanActionLabels(block: string): string[] {
  const labels = [
    ...pairedTagMatches(block, 'button').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...tagMatches(block, 'input').map((tag) => {
      const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
      if (!['button', 'submit'].includes(type)) return ''
      return controlLabel(tag)
    })
  ]
  return labels.map(normalizedActionLabel).filter(Boolean)
}

export function genericPricingPlanActionLabel(text: string): boolean {
  const normalized = normalizedActionLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_PRICING_PLAN_ACTION_RE.test(normalized)
}

export function genericPricingPlanActionLabelTags(html: string, visibleText: string): string[] {
  if (!pricingSurfaceSignal(html, visibleText) || !hasPricingStructure(html, visibleText)) return []
  const blocks = pricingPlanBlocks(html)
  if (blocks.length < 2) return []
  const genericLabels = blocks.flatMap(pricingPlanActionLabels).filter(genericPricingPlanActionLabel)
  const repeated = new Set(
    Array.from(
      genericLabels.reduce((counts, label) => {
        const normalized = label.toLowerCase()
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
        return counts
      }, new Map<string, number>())
    )
      .filter(([, count]) => count >= 2)
      .map(([label]) => label)
  )
  if (repeated.size === 0) return []
  return blocks.filter((block) => pricingPlanActionLabels(block).some((label) => repeated.has(label.toLowerCase())))
}

export function hasConversionClose(html: string, visibleText: string): boolean {
  const lowerHtml = html.toLowerCase()
  const closeStart = Math.max(0, Math.floor(lowerHtml.length * 0.55))
  const closeMarkup = lowerHtml.slice(closeStart)
  const closeText = textContent(closeMarkup)
  if (/<footer\b/i.test(html) && CONVERSION_CLOSE_TEXT_RE.test(textContent(pairedTagMatches(html, 'footer').map(({ inner }) => inner).join(' ')))) {
    return true
  }
  if (STRONG_CONVERSION_CLOSE_TEXT_RE.test(closeText)) return true
  if (/<form\b/i.test(closeMarkup) && /\b(email|name|company|message|demo|contact|signup|subscribe|waitlist)\b/i.test(closeText)) return true
  const metadata = [
    ...attributeValues(closeMarkup, 'class'),
    ...attributeValues(closeMarkup, 'id'),
    ...attributeValues(closeMarkup, 'aria-label'),
    ...attributeValues(closeMarkup, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  return CONVERSION_CLOSE_CLASS_RE.test(metadata)
}

export function hasWeakConversionClose(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && hasBrandLandingScreenSignal(html, visibleText) && !hasConversionClose(html, visibleText)
}

export function conversionCloseBlocks(html: string): string[] {
  const closeStart = Math.max(0, Math.floor(html.length * 0.55))
  const closeMarkup = html.slice(closeStart)
  const blocks: string[] = []
  for (const tagName of ['footer', 'section', 'aside', 'div', 'form']) {
    for (const { tag, inner } of pairedTagMatches(closeMarkup, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const text = textContent(inner)
      const closeLike =
        tagName === 'footer' ||
        CONVERSION_CLOSE_CLASS_RE.test(metadata) ||
        CONVERSION_CLOSE_TEXT_RE.test(text) ||
        (tagName === 'form' && LEAD_FORM_SIGNAL_RE.test(text))
      if (closeLike && text.length >= 24) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function genericConversionCloseBlock(block: string): boolean {
  const headings = staticHeadingTexts(block)
    .map(normalizedHeadingText)
    .filter(Boolean)
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  const genericHeading = headings.some((heading) => GENERIC_CONVERSION_CLOSE_HEADING_RE.test(heading))
  const genericCopy = GENERIC_CONVERSION_CLOSE_COPY_RE.test(text)
  return (genericHeading || genericCopy) && !CONCRETE_CONVERSION_CLOSE_CONTEXT_RE.test(text)
}

export function genericConversionCloseTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText) || !hasConversionClose(html, visibleText)) return []
  return conversionCloseBlocks(html).filter(genericConversionCloseBlock).slice(0, 4)
}

export function faqBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const tagName of ['section', 'article', 'div', 'details']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const headings = [
        ...staticHeadingTexts(inner),
        ...pairedTagMatches(inner, 'summary').map(({ inner: summary }) => textContent(summary))
      ].join(' ')
      if (FAQ_SECTION_RE.test(metadata) || FAQ_SECTION_RE.test(headings)) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function faqQuestionCount(markup: string): number {
  return faqQuestionTexts(markup).length
}

export function faqQuestionTexts(markup: string): string[] {
  const questionTexts = [
    ...['h3', 'h4', 'summary', 'dt', 'button'].flatMap((tagName) =>
      pairedTagMatches(markup, tagName).map(({ inner }) => textContent(inner))
    ),
    ...(textContent(markup).match(/[^.!?。！？]*\?/g) ?? [])
  ]
  return Array.from(new Set(
    questionTexts
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter((text) => FAQ_QUESTION_RE.test(text))
  ))
}

export function faqAnswerCount(markup: string): number {
  return ['p', 'dd', 'li']
    .flatMap((tagName) => pairedTagMatches(markup, tagName))
    .map(({ inner }) => contentForDataRealism(textContent(inner)))
    .filter((text) => text.length >= 28 && !FAQ_QUESTION_RE.test(text)).length
}

export function hasFaqAnatomy(markup: string): boolean {
  return faqQuestionCount(markup) >= 2 && faqAnswerCount(markup) >= 2
}

export function faqAnswerTexts(markup: string): string[] {
  return ['p', 'dd', 'li']
    .flatMap((tagName) => pairedTagMatches(markup, tagName))
    .map(({ inner }) => contentForDataRealism(textContent(inner)))
    .filter((text) => text.length >= 18 && !FAQ_QUESTION_RE.test(text))
}

export function genericFaqAnswer(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  return normalized.length >= 18 && GENERIC_FAQ_ANSWER_RE.test(normalized) && !CONCRETE_FAQ_DETAIL_RE.test(normalized)
}

export function genericFaqAnswerTags(html: string): string[] {
  return faqBlocks(html).filter((block) => hasFaqAnatomy(block) && faqAnswerTexts(block).filter(genericFaqAnswer).length >= 2)
}

export function genericFaqQuestion(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  return normalized.length >= 8 && normalized.length <= 80 && GENERIC_FAQ_QUESTION_RE.test(normalized)
}

export function concreteFaqQuestion(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  return normalized.length > 0 && CONCRETE_FAQ_QUESTION_RE.test(normalized)
}

export function genericFaqQuestionTags(html: string): string[] {
  return faqBlocks(html).filter((block) => {
    if (!hasFaqAnatomy(block)) return false
    const questions = faqQuestionTexts(block)
    if (questions.length < 2) return false
    const genericCount = questions.filter(genericFaqQuestion).length
    const concreteCount = questions.filter(concreteFaqQuestion).length
    return concreteCount === 0 && genericCount >= Math.ceil(questions.length * 0.67)
  })
}

export function hasWeakFaqAnatomy(html: string, visibleText: string): boolean {
  const blocks = faqBlocks(html)
  return hasBrandLandingScreenSignal(html, visibleText) && blocks.length > 0 && blocks.some((block) => !hasFaqAnatomy(block))
}

export function hasSiteFooter(html: string): boolean {
  const footers = pairedTagMatches(html, 'footer')
  if (footers.length === 0) return false
  return footers.some(({ tag, inner }) => {
    const footerHtml = `${tag}${inner}`
    const visibleFooterText = textContent(inner)
    const validLinks = tagMatches(inner, 'a')
      .filter((linkTag) => !isDeadHrefTarget(attributeValue(linkTag, 'href'), html))
      .length
    const metadata = [
      ...attributeValues(footerHtml, 'class'),
      ...attributeValues(footerHtml, 'id'),
      ...attributeValues(footerHtml, 'aria-label'),
      ...attributeValues(footerHtml, 'title')
    ].join(' ').replace(/[-_]/g, ' ')
    return validLinks >= 2 || SITE_FOOTER_TEXT_RE.test(visibleFooterText) || SITE_FOOTER_CLASS_RE.test(metadata)
  })
}

export function hasWeakSiteFooter(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    !hasSiteFooter(html)
  )
}

export function siteFooterBlocks(html: string): string[] {
  return pairedTagMatches(html, 'footer').map(({ tag, inner }) => `${tag}${inner}`)
}

export function genericSiteFooterLabel(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 32 && GENERIC_SITE_FOOTER_LABEL_RE.test(normalized)
}

export function genericSiteFooterDetail(block: string): boolean {
  const text = textContent(block)
  if (SITE_FOOTER_TEXT_RE.test(text)) return false
  const labels = [
    ...['h2', 'h3', 'h4', 'strong', 'b'].flatMap((tagName) =>
      pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner))
    ),
    ...pairedTagMatches(block, 'a').map(({ inner }) => textContent(inner))
  ]
  return labels.filter(genericSiteFooterLabel).length >= 2
}

export function genericSiteFooterDetailTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText) || !hasSiteFooter(html)) return []
  return siteFooterBlocks(html).filter(genericSiteFooterDetail).slice(0, 4)
}

export function hasBrandNavigation(html: string): boolean {
  const blocks = [
    ...pairedTagMatches(html, 'header').map(({ tag, inner }) => `${tag}${inner}`),
    ...navigationBlocks(html)
  ]
  return blocks.some((block) => {
    const validLinks = tagMatches(block, 'a')
      .filter((tag) => !isDeadHrefTarget(attributeValue(tag, 'href'), html))
      .length
    if (validLinks >= 2) return true
    const metadata = [
      ...attributeValues(block, 'class'),
      ...attributeValues(block, 'id'),
      ...attributeValues(block, 'aria-label'),
      ...attributeValues(block, 'title')
    ].join(' ').replace(/[-_]/g, ' ')
    return BRAND_NAV_CLASS_RE.test(metadata) && validLinks >= 1
  })
}
