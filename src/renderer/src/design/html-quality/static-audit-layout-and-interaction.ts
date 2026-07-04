import type { DesignHtmlQualityAuditInput, DesignHtmlQualityFinding } from './types'
import type { DesignHtmlQualityStaticAuditContext } from './static-audit-types'
import { ACTIONABLE_RECORD_TEXT_RE, AI_GRADIENT_COLOR_RE, BODY_TEXT_SELECTOR_RE, BRAND_IDENTITY_CLASS_RE, BRAND_LANDING_SCREEN_RE, BRAND_NAME_LIKE_RE, BRAND_NAV_CLASS_RE, BREADCRUMB_CONTAINER_RE, CHART_CONTAINER_CLASS_RE, CHART_MARK_CLASS_RE, COLOR_LITERAL_RE, CONCRETE_CONVERSION_CLOSE_CONTEXT_RE, CONCRETE_DATA_PATTERNS, CONCRETE_FAQ_DETAIL_RE, CONCRETE_FAQ_QUESTION_RE, CONCRETE_FEATURE_DETAIL_RE, CONCRETE_METRIC_SPECIFICITY_RE, CONCRETE_PRICING_PLAN_DETAIL_RE, CONCRETE_TESTIMONIAL_CONTEXT_RE, CONVERSION_CLOSE_CLASS_RE, CONVERSION_CLOSE_TEXT_RE, CREAM_BACKGROUND_RE, CSS_CUSTOM_PROPERTY_RE, CSS_RULE_BLOCK_RE, DECORATIVE_VISUAL_ANCHOR_RE, DESIGN_ITEM_CARD_CLASS_RE, DESTRUCTIVE_ACTION_LABEL_RE, DESTRUCTIVE_SAFETY_MARKUP_RE, DESTRUCTIVE_TONE_MARKUP_RE, DIALOG_CLOSE_LABEL_RE, DIALOG_CONTAINER_CLASS_RE, EMOJI_RE, FAQ_QUESTION_RE, FAQ_SECTION_RE, FEATURE_DETAIL_RE, FEATURE_ITEM_CLASS_RE, FEATURE_SECTION_RE, FEEDBACK_MESSAGE_CLASS_RE, FEEDBACK_MESSAGE_CONTEXT_RE, FIXED_DESKTOP_FRAME_RE, FLUID_MEDIA_RULE_RE, FORM_FIELD_AFFORDANCE_RE, GENERIC_ACTION_LABEL_RE, GENERIC_BRAND_IDENTITY_LABEL_RE, GENERIC_BREADCRUMB_LABEL_RE, GENERIC_CHART_LABEL_RE, GENERIC_CONVERSION_CLOSE_COPY_RE, GENERIC_CONVERSION_CLOSE_HEADING_RE, GENERIC_DIALOG_TITLE_RE, GENERIC_DOCUMENT_TITLE_RE, GENERIC_FAQ_ANSWER_RE, GENERIC_FAQ_QUESTION_RE, GENERIC_FEATURE_DETAIL_RE, GENERIC_FEATURE_TITLE_RE, GENERIC_FEEDBACK_MESSAGE_RE, GENERIC_FORM_FIELD_LABEL_RE, GENERIC_IMAGE_ALT_RE, GENERIC_METRIC_LABEL_RE, GENERIC_PAGE_HEADING_RE, GENERIC_PORTFOLIO_PROJECT_RE, GENERIC_PRICING_PLAN_ACTION_RE, GENERIC_PRICING_PLAN_DETAIL_RE, GENERIC_PRODUCT_NAV_LABEL_RE, GENERIC_RECORD_ACTION_LABEL_RE, GENERIC_RECORD_DISCOVERY_LABEL_RE, GENERIC_RECORD_ITEM_LABEL_RE, GENERIC_RECORD_TABLE_COLUMN_LABEL_RE, GENERIC_RECOVERABLE_STATE_COPY_RE, GENERIC_SECTION_HEADING_RE, GENERIC_SETTINGS_CONTROL_LABEL_RE, GENERIC_SITE_FOOTER_LABEL_RE, GENERIC_TAB_LABEL_RE, GENERIC_TESTIMONIAL_COPY_RE, GENERIC_TRUST_PROOF_LABEL_RE, GENERIC_VANITY_METRIC_RE, GENERIC_WORKFLOW_STEP_LABEL_RE, GLOBAL_BOX_SIZING_RE, HEADING_SELECTOR_RE, HERO_VIEWPORT_LOCK_RE, LEAD_FORM_ERROR_RE, LEAD_FORM_LOADING_RE, LEAD_FORM_SIGNAL_RE, LEAD_FORM_SUCCESS_RE, MARKETING_FEATURE_SURFACE_RE, META_PAGE_HEADING_RE, METRIC_CONTAINER_CLASS_RE, METRIC_CONTEXT_RE, NEGATIVE_LETTER_SPACING_RE, PLACEHOLDER_RE, PORTFOLIO_BUILDER_RE, PORTFOLIO_DETAIL_ACTION_RE, PORTFOLIO_ENTRY_CLASS_RE, PORTFOLIO_OUTCOME_RE, PORTFOLIO_SURFACE_RE, PRICING_ACTION_RE, PRICING_CADENCE_RE, PRICING_FEATURE_RE, PRICING_PLAN_CLASS_RE, PRICING_PRICE_GLOBAL_RE, PRICING_PRICE_RE, PRICING_RECOMMENDATION_RE, PRICING_SURFACE_RE, PRODUCT_APP_CHROME_CLASS_RE, PRODUCT_APP_SCREEN_RE, PRODUCT_NAV_DOMAIN_LABEL_RE, PROTOTYPE_NAV_HASH_PREFIX, PSEUDO_LIST_CONTAINER_CLASS_RE, PSEUDO_LIST_ITEM_CLASS_RE, RECORD_DISCOVERY_CONTROL_RE, RECORD_DISCOVERY_MARKUP_RE, RECOVERABLE_STATE_CONTEXT_RE, RECOVERABLE_STATE_HEADING_RE, RECOVERABLE_STATE_TEXT_RE, SETTINGS_CONTROL_SURFACE_RE, SITE_FOOTER_CLASS_RE, SITE_FOOTER_TEXT_RE, SPACING_DECLARATION_RE, SPACING_TOKEN_RE, SPECIFIC_BREADCRUMB_LABEL_RE, SPECIFIC_CHART_LABEL_RE, SPECIFIC_DIALOG_TITLE_RE, SPECIFIC_FORM_FIELD_LABEL_RE, SPECIFIC_METRIC_LABEL_RE, SPECIFIC_RECORD_ACTION_LABEL_RE, SPECIFIC_RECORD_DISCOVERY_LABEL_RE, SPECIFIC_RECORD_ITEM_LABEL_RE, SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE, SPECIFIC_SETTINGS_CONTROL_LABEL_RE, SPECIFIC_TAB_LABEL_RE, SPECIFIC_WORKFLOW_STEP_LABEL_RE, STATE_LAUNDRY_LIST_RE, STATE_MODULE_CLASS_RE, STATUS_AFFORDANCE_ATTRIBUTE_RE, STATUS_AFFORDANCE_CLASS_RE, STATUS_AFFORDANCE_STYLE_RE, STATUS_VALUE_ONLY_RE, STRONG_BRAND_LANDING_SCREEN_RE, STRONG_CONVERSION_CLOSE_TEXT_RE, TAB_CONTAINER_CLASS_RE, TESTIMONIAL_ATTRIBUTION_RE, TESTIMONIAL_CLASS_RE, TRUST_PROOF_CLASS_RE, TRUST_PROOF_TEXT_RE, UNBOUNDED_VIEWPORT_FONT_RE, VAGUE_TEMPLATE_COPY_PATTERNS, VANITY_METRIC_CONTAINER_RE, VIEWPORT_LOCK_RE, VISUAL_ANCHOR_CLASS_RE, VISUAL_ANCHOR_STYLE_RE, VISUAL_MEDIA_TAG_RE, WORKFLOW_STEP_CONTAINER_CLASS_RE, WORKFLOW_STEP_ITEM_CLASS_RE, WORKFLOW_STEP_STATE_RE, actionableRecordCount, attributeValue, attributeValues, breadcrumbBlocks, breadcrumbLabels, buildDesignHtmlQualityRepairPrompt, chartLabelTexts, chartLikeBlocks, chartMarkCount, clearDesignRuntimeQualityFindings, colorLiteralCount, concreteDataSignalCount, concreteFaqQuestion, contentForDataRealism, controlLabel, conversionCloseBlocks, countEmoji, countPatternHits, cssPaletteColors, deadAnchorTags, declarationValue, decodePrototypePathSegment, decorativeVisualAnchorTags, designQualityRepairDirective, destructiveActionControlTags, dialogTitleTexts, documentTitleText, duplicatedDesignCardCopyTexts, extractPrototypeHashRouteTarget, faqAnswerCount, faqAnswerTexts, faqBlocks, faqQuestionCount, faqQuestionTexts, featureCardBlocks, featureItemCount, firstScreenActionDescriptors, firstTopLevelHeadingIndex, fontSizePx, fontWeightValue, formFieldLabels, formFieldTags, formSignalText, formatDesignHtmlQualityFindings, fuzzyPrototypeSlugMatch, genericBreadcrumbLabel, genericBreadcrumbLabelBlocks, genericChartLabel, genericChartLabelTags, genericConversionCloseBlock, genericConversionCloseTags, genericDialogTitle, genericDialogTitleTags, genericFaqAnswer, genericFaqAnswerTags, genericFaqQuestion, genericFaqQuestionTags, genericFeatureCardDetail, genericFeatureCardDetailTags, genericFeedbackMessageCopy, genericFeedbackMessageCopyTags, genericFormFieldLabel, genericFormFieldLabelTags, genericImageAltTags, genericMetricCardLabel, genericMetricCardLabelTags, genericPortfolioProjectDetail, genericPortfolioProjectDetailTags, genericPricingPlanActionLabel, genericPricingPlanActionLabelTags, genericPricingPlanDetail, genericPricingPlanDetailTags, genericProductNavLabel, genericProductNavigationBlocks, genericRecordActionLabel, genericRecordActionLabelTags, genericRecordDiscoveryControlTags, genericRecordDiscoveryLabel, genericRecordItemLabel, genericRecordItemLabelScope, genericRecordItemLabelTags, genericRecordTableColumnLabel, genericRecordTableColumnTags, genericRecoverableStateCopy, genericRecoverableStateCopyTags, genericSectionHeadingTags, genericSettingsControlLabel, genericSettingsControlLabelTags, genericSiteFooterDetail, genericSiteFooterDetailTags, genericSiteFooterLabel, genericTabLabel, genericTabLabelTags, genericTestimonialCopyTags, genericTestimonialCopyText, genericTrustProofLabel, genericTrustProofTags, genericVanityMetricTags, genericVanityMetricText, genericWorkflowStepLabel, genericWorkflowStepLabelTags, getDesignRuntimeQualityFindings, hasActionableRecordText, hasAny, hasAssociatedLabel, hasBrandIdentity, hasBrandLandingScreenSignal, hasBrandNavigation, hasBreadcrumbContainerMetadata, hasCardLikeClass, hasCardLikeSelector, hasCenterEverythingLayout, hasChartContainerClass, hasChartDataContext, hasChartMarkClass, hasConcretePreviewDetail, hasConcreteVisualAnchorDetail, hasControlAccessibleName, hasConversionClose, hasDestructiveSafetyMarkup, hasDestructiveToneMarkup, hasDialogAccessibleName, hasDialogCloseAction, hasDialogContainerClass, hasDialogSemantics, hasFaqAnatomy, hasFeatureAnatomy, hasFeedbackMessageSignal, hasFirstScreenSupportContent, hasFixedDesktopFrame, hasFormFeedbackScript, hasFormFieldAffordance, hasGenericActionCopy, hasGenericPurpleBlueGradient, hasHashTarget, hasInteractionStateAffordance, hasInteractiveControls, hasLeadFormResponseStates, hasLocalModuleHeading, hasMetricContainerClass, hasMetricContext, hasMetricValue, hasMissingLayoutReset, hasModuleAccessibleName, hasMultiItemPrototypeNavigationWithoutCurrentState, hasNavigationCurrentState, hasNavigationLandmark, hasOneNotePalette, hasOverRoundedCardStyling, hasPortfolioProjectStructure, hasPricingStructure, hasPrimaryVisualAnchor, hasProductAppChrome, hasProductAppScreenSignal, hasPseudoListContainerClass, hasPseudoListItemClass, hasRecordAction, hasRecoverableStateClass, hasRecoverableStateSignal, hasScriptedInteraction, hasSemanticRecordStructure, hasSettingsControlSurface, hasSiblingPrototypeNavigation, hasSiteFooter, hasStateLaundryList, hasStateRecoveryAction, hasStaticLeadFormSignal, hasStaticPrimaryAction, hasStatusAffordanceMarkup, hasStatusAffordanceTag, hasTabContainerClass, hasTestimonialAttribution, hasTopLevelHeading, hasTrustProof, hasUsefulAnchorTarget, hasVisualAnchorClass, hasWeakBrandIdentity, hasWeakBrandNavigation, hasWeakColorSystem, hasWeakContentDepth, hasWeakConversionClose, hasWeakDataRealism, hasWeakFaqAnatomy, hasWeakFeatureAnatomy, hasWeakHeroViewportComposition, hasWeakPortfolioStructure, hasWeakPricingStructure, hasWeakProductAppShell, hasWeakProductPreviewDetail, hasWeakSecondaryActionPath, hasWeakSiteFooter, hasWeakSpacingSystem, hasWeakTestimonialAttribution, hasWeakTrustProof, hasWeakTypeHierarchy, hasWeakTypographyConstraints, hasWeakVisualAnchor, hasWorkflowStepContainerClass, hasWorkflowStepState, hueDistance, imageAccessibleText, inertFormTags, inlinePrototypeNavigationTargets, isBrandIdentityText, isDeadHrefTarget, isDecorativeImage, isDestructiveActionLabel, isGenericActionLabel, isGenericDocumentTitle, isGenericPageHeading, isGenericSectionHeading, isMetaPageHeading, isPageLikePrototypeTargetPath, isPrototypeBackInlineHandler, isSkippableInput, isWrappedByLabel, labelTextForInputId, largestHueClusterCount, leadFormTags, linkedSiblingPrototypeTargetCount, listItemRecordTexts, marketingFeatureSurfaceSignal, matchingSiblingScreensForPrototypeTarget, meaningfulContentModuleCount, mergeDesignHtmlQualityFindings, metricCardBlocks, metricCardLabel, missingImageAltTags, missingImageSourceTags, navigationBlocks, nestedCardLikeTags, normalizeHue, normalizePath, normalizePrototypeRouteSlug, normalizePrototypeTarget, normalizeQualityCode, normalizeRuntimeQualityFindings, normalizedActionLabel, normalizedBreadcrumbLabel, normalizedCardCopy, normalizedChartLabel, normalizedClassText, normalizedFeedbackMessageText, normalizedFormFieldLabel, normalizedHeadingText, normalizedMetricLabel, normalizedProductNavLabel, normalizedRecordDiscoveryLabel, normalizedRecordItemLabel, normalizedRecordTableColumnLabel, normalizedSettingsControlLabel, normalizedTrustProofLabel, normalizedVanityMetricText, normalizedWorkflowStepLabel, onclickAttributeValues, onsubmitAttributeValues, pairedTagMatches, parseCssColor, parseHexColor, parseHslColor, parseHslPercent, parseHueToken, parseRgbChannel, parseRgbColor, portfolioEntryCount, portfolioProjectBlocks, portfolioSurfaceSignal, pricingPlanActionLabels, pricingPlanBlocks, pricingPlanCount, pricingSurfaceSignal, primaryButtonLabels, productAppMetricCount, productAppModuleSignalCount, productNavigationLabels, prototypeExactTargetsForScreen, prototypeRouteSlugCandidates, prototypeRouteSlugsForScreen, prototypeTargetAttributeValues, prototypeTargetFromInlineHandler, prototypeTitleTokens, pseudoListContainerTags, pushFinding, radiusPx, recordActionLabels, recordDiscoveryControlArea, recordDiscoveryControlLabels, recordDiscoveryControlMarkup, recordItemBlocks, recordItemTitleLabels, rgbToHsl, runtimeQualityFindings, sectionHeadingTexts, setDesignRuntimeQualityFindings, settingsControlCount, settingsControlLabels, severityRank, shouldAutoRepairDesignHtmlFinding, siteFooterBlocks, spacingValueTokens, specificBreadcrumbLabel, specificChartLabel, specificDialogTitle, specificFeedbackMessageCopy, specificFormFieldLabel, specificProductNavLabel, specificRecordActionLabel, specificRecordDiscoveryLabel, specificRecordItemLabel, specificRecordTableColumnLabel, specificSettingsControlLabel, specificTabLabel, specificWorkflowStepLabel, stateLaundryListCount, staticHeadingTexts, statusValueLabel, stripHtmlComments, styleContent, summarizeDesignHtmlQualityDetails, summarizeDesignHtmlQualityStatus, tabControlCount, tabControlLabels, tableDataRowTexts, tableHeaderLabels, tagMatches, testimonialBlocks, testimonialQuoteTexts, textContent, textForElementId, topLevelHeadingTexts, unlabeledFieldTags, unnamedContentSectionTags, unnamedIconOnlyControlTags, visualAnchorBlocks, weakChartStructureTags, weakDestructiveActionSafetyTags, weakDialogAffordanceTags, weakFormAffordanceTags, weakLeadFormResponseTags, weakMetricContextTags, weakRecordActionTags, weakRecordDiscoveryControlTags, weakStateRecoveryActionTags, weakStatusAffordanceTags, weakTabCurrentStateTags, weakTableStructureTags, weakWorkflowStepStateTags, workflowStepItemCount, workflowStepLabels } from './helper-index'

export function auditLayoutAndInteractionQuality(
  input: DesignHtmlQualityAuditInput,
  ctx: DesignHtmlQualityStaticAuditContext,
  findings: DesignHtmlQualityFinding[]
): void {
  const { normalized, styles, lower, visibleText } = ctx
    if (hasFixedDesktopFrame(styles)) {
      pushFinding(findings, {
        code: 'fixed-desktop-frame',
        severity: 'warning',
        message: 'The page appears locked to a fixed desktop canvas.',
        suggestion: 'Replace hard-coded desktop width/min-width values and height:100vh overflow locks with fluid max-widths, wrapping grids, and responsive section heights.'
      })
    }
    if (hasMissingLayoutReset(normalized, styles)) {
      pushFinding(findings, {
        code: 'missing-layout-reset',
        severity: 'warning',
        message: 'The page uses visual media without a resilient layout reset.',
        suggestion: 'Add global box-sizing, fluid media rules, and min-width:0 constraints so images, embeds, and grid/flex children do not overflow responsive previews.'
      })
    }
    if (hasWeakTypographyConstraints(styles)) {
      pushFinding(findings, {
        code: 'weak-typography-constraints',
        severity: 'warning',
        message: 'The page uses typography constraints that can break across viewport sizes.',
        suggestion: 'Replace unbounded viewport-based font sizes with bounded type scales and keep letter spacing at 0 or positive values so headings remain readable.'
      })
    }
    if (hasWeakTypeHierarchy(normalized, styles)) {
      pushFinding(findings, {
        code: 'weak-type-hierarchy',
        severity: 'warning',
        message: 'The page title and body text have too little typographic hierarchy.',
        suggestion: 'Create a bounded type scale with a visibly larger or heavier H1/H2, readable body text, and clear metadata/caption sizing.'
      })
    }
    const hasMotion = /\b(animation|transition)\s*:/i.test(normalized) || /@keyframes\b/i.test(normalized)
    if (hasMotion && !/prefers-reduced-motion/i.test(normalized)) {
      pushFinding(findings, {
        code: 'missing-reduced-motion',
        severity: 'warning',
        message: 'The artifact uses motion but has no prefers-reduced-motion fallback.',
        suggestion: 'Add a reduced-motion media query that disables or simplifies animation and transition effects.'
      })
    }
    if (!/:(focus|focus-visible|focus-within)\b/i.test(normalized)) {
      pushFinding(findings, {
        code: 'missing-focus-states',
        severity: 'warning',
        message: 'No focus or focus-visible styling was found.',
        suggestion: 'Add clear keyboard focus states for links, buttons, inputs, and interactive controls.'
      })
    }
    if (hasInteractiveControls(normalized) && !hasInteractionStateAffordance(normalized)) {
      pushFinding(findings, {
        code: 'missing-interaction-states',
        severity: 'warning',
        message: 'Interactive controls lack hover, active, disabled, pressed, expanded, or selected state affordances.',
        suggestion: 'Add hover/active styles and at least one relevant state such as disabled, aria-pressed, aria-expanded, selected, or data-state feedback for controls.'
      })
    }
    if (!hasStaticPrimaryAction(normalized)) {
      pushFinding(findings, {
        code: 'missing-primary-action',
        severity: 'warning',
        message: 'No obvious interactive primary action was found.',
        suggestion: 'Add a clear primary action and any relevant secondary action for the page goal.'
      })
    }
    if (hasGenericActionCopy(normalized)) {
      pushFinding(findings, {
        code: 'generic-action-copy',
        severity: 'warning',
        message: 'The primary action labels are too generic to communicate the user task.',
        suggestion: 'Rewrite CTAs around the exact task, object, or outcome, such as "Approve invoice", "Compare plans", or "Retry sync".'
      })
    }
    if (weakDestructiveActionSafetyTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-destructive-action-safety',
        severity: 'warning',
        message: 'A destructive action lacks clear danger treatment, confirmation, or undo/recovery feedback.',
        suggestion: 'Style destructive actions with a danger tone and provide confirmation, undo toast, recovery copy, or an explicit irreversible-warning pattern.'
      })
    }
    if (weakDialogAffordanceTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-dialog-affordance',
        severity: 'warning',
        message: 'A dialog, modal, drawer, or popover lacks dialog semantics, an accessible title, or a close/cancel path.',
        suggestion: 'Add role="dialog" or native <dialog>, aria-modal/labeling, a visible heading, and Close/Cancel/Dismiss controls.'
      })
    }
    if (genericDialogTitleTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-dialog-title',
        severity: 'warning',
        message: 'A dialog, modal, drawer, or popover uses a generic title.',
        suggestion: 'Replace Details, Confirmation, or Warning-only dialog titles with titles that name the object, action, consequence, or workflow.'
      })
    }
    if (hasTopLevelHeading(normalized) && hasStaticPrimaryAction(normalized) && !hasFirstScreenSupportContent(normalized)) {
      pushFinding(findings, {
        code: 'weak-first-screen-hierarchy',
        severity: 'warning',
        message: 'The first screen has a page title and action but no supporting content near the goal.',
        suggestion: 'Add concise supporting copy, concrete data, or a small content module near the H1 so the page communicates value before secondary details.'
      })
    }
    if (!hasTopLevelHeading(normalized)) {
      pushFinding(findings, {
        code: 'missing-page-heading',
        severity: 'warning',
        message: 'No top-level H1 or aria-level=1 heading was found.',
        suggestion: 'Add a specific H1/page title that states the screen purpose before secondary sections or dense content.'
      })
    } else if (topLevelHeadingTexts(normalized).some(isGenericPageHeading)) {
      pushFinding(findings, {
        code: 'generic-page-heading',
        severity: 'warning',
        message: 'The top-level page heading is too generic to communicate the screen goal.',
        suggestion: 'Replace generic headings like "Dashboard" or "Overview" with a specific user outcome, workflow, or product area.'
      })
    }
    if (hasTopLevelHeading(normalized) && topLevelHeadingTexts(normalized).some(isMetaPageHeading)) {
      pushFinding(findings, {
        code: 'meta-page-heading',
        severity: 'warning',
        message: 'The top-level page heading reads like a prompt or page type instead of a real product title.',
        suggestion: 'Rewrite the H1 as the brand/product/person name or a literal offer/category, and move page-type context into supporting copy if needed.'
      })
    }
    if (genericSectionHeadingTags(normalized, visibleText).length >= 2) {
      pushFinding(findings, {
        code: 'generic-section-heading',
        severity: 'warning',
        message: 'Several marketing section headings are generic template labels.',
        suggestion: 'Replace bare headings like Features, Benefits, or Testimonials with product-specific headings that name the workflow, audience, proof, or outcome.'
      })
    }
    const deadLinks = deadAnchorTags(normalized)
    if (deadLinks.length > 0) {
      pushFinding(findings, {
        code: 'dead-link-targets',
        severity: 'warning',
        message: 'Some anchors use empty, "#", missing, or javascript-only href targets.',
        suggestion: 'Replace dead anchors with real prototype hrefs, valid section anchors, Back/Previous controls that call history.back(), or semantic buttons with local feedback.'
      })
    }
    if (
      hasInteractiveControls(normalized) &&
      !hasUsefulAnchorTarget(normalized) &&
      !hasScriptedInteraction(normalized) &&
      !/<form\b/i.test(normalized)
    ) {
      pushFinding(findings, {
        code: 'missing-interaction-behavior',
        severity: 'warning',
        message: 'The page has interactive-looking controls but no detectable link, form, or scripted behavior.',
        suggestion: 'Wire primary controls to a prototype link, form feedback, expanded panel, filter state, toast, or other visible interaction.'
      })
    }
    const unlabeledFields = unlabeledFieldTags(normalized)
    if (unlabeledFields.length > 0) {
      pushFinding(findings, {
        code: 'missing-form-labels',
        severity: 'warning',
        message: 'Some form fields have no associated label or accessible name.',
        suggestion: 'Add visible labels or aria-label/aria-labelledby for every input, select, and textarea; do not rely on placeholders alone.'
      })
    }
    if (weakFormAffordanceTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-form-affordance',
        severity: 'warning',
        message: 'A multi-field form lacks helper, required, optional, validation, or feedback affordances.',
        suggestion: 'Add required/optional markers, helper text, aria-describedby, error/success messages, or inline validation states so the form feels implementation-ready.'
      })
    }
}
