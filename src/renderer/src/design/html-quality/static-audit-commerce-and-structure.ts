import type { DesignHtmlQualityAuditInput, DesignHtmlQualityFinding } from './types'
import type { DesignHtmlQualityStaticAuditContext } from './static-audit-types'
import { ACTIONABLE_RECORD_TEXT_RE, AI_GRADIENT_COLOR_RE, BODY_TEXT_SELECTOR_RE, BRAND_IDENTITY_CLASS_RE, BRAND_LANDING_SCREEN_RE, BRAND_NAME_LIKE_RE, BRAND_NAV_CLASS_RE, BREADCRUMB_CONTAINER_RE, CHART_CONTAINER_CLASS_RE, CHART_MARK_CLASS_RE, COLOR_LITERAL_RE, CONCRETE_CONVERSION_CLOSE_CONTEXT_RE, CONCRETE_DATA_PATTERNS, CONCRETE_FAQ_DETAIL_RE, CONCRETE_FAQ_QUESTION_RE, CONCRETE_FEATURE_DETAIL_RE, CONCRETE_METRIC_SPECIFICITY_RE, CONCRETE_PRICING_PLAN_DETAIL_RE, CONCRETE_TESTIMONIAL_CONTEXT_RE, CONVERSION_CLOSE_CLASS_RE, CONVERSION_CLOSE_TEXT_RE, CREAM_BACKGROUND_RE, CSS_CUSTOM_PROPERTY_RE, CSS_RULE_BLOCK_RE, DECORATIVE_VISUAL_ANCHOR_RE, DESIGN_ITEM_CARD_CLASS_RE, DESTRUCTIVE_ACTION_LABEL_RE, DESTRUCTIVE_SAFETY_MARKUP_RE, DESTRUCTIVE_TONE_MARKUP_RE, DIALOG_CLOSE_LABEL_RE, DIALOG_CONTAINER_CLASS_RE, EMOJI_RE, FAQ_QUESTION_RE, FAQ_SECTION_RE, FEATURE_DETAIL_RE, FEATURE_ITEM_CLASS_RE, FEATURE_SECTION_RE, FEEDBACK_MESSAGE_CLASS_RE, FEEDBACK_MESSAGE_CONTEXT_RE, FIXED_DESKTOP_FRAME_RE, FLUID_MEDIA_RULE_RE, FORM_FIELD_AFFORDANCE_RE, GENERIC_ACTION_LABEL_RE, GENERIC_BRAND_IDENTITY_LABEL_RE, GENERIC_BREADCRUMB_LABEL_RE, GENERIC_CHART_LABEL_RE, GENERIC_CONVERSION_CLOSE_COPY_RE, GENERIC_CONVERSION_CLOSE_HEADING_RE, GENERIC_DIALOG_TITLE_RE, GENERIC_DOCUMENT_TITLE_RE, GENERIC_FAQ_ANSWER_RE, GENERIC_FAQ_QUESTION_RE, GENERIC_FEATURE_DETAIL_RE, GENERIC_FEATURE_TITLE_RE, GENERIC_FEEDBACK_MESSAGE_RE, GENERIC_FORM_FIELD_LABEL_RE, GENERIC_IMAGE_ALT_RE, GENERIC_METRIC_LABEL_RE, GENERIC_PAGE_HEADING_RE, GENERIC_PORTFOLIO_PROJECT_RE, GENERIC_PRICING_PLAN_ACTION_RE, GENERIC_PRICING_PLAN_DETAIL_RE, GENERIC_PRODUCT_NAV_LABEL_RE, GENERIC_RECORD_ACTION_LABEL_RE, GENERIC_RECORD_DISCOVERY_LABEL_RE, GENERIC_RECORD_ITEM_LABEL_RE, GENERIC_RECORD_TABLE_COLUMN_LABEL_RE, GENERIC_RECOVERABLE_STATE_COPY_RE, GENERIC_SECTION_HEADING_RE, GENERIC_SETTINGS_CONTROL_LABEL_RE, GENERIC_SITE_FOOTER_LABEL_RE, GENERIC_TAB_LABEL_RE, GENERIC_TESTIMONIAL_COPY_RE, GENERIC_TRUST_PROOF_LABEL_RE, GENERIC_VANITY_METRIC_RE, GENERIC_WORKFLOW_STEP_LABEL_RE, GLOBAL_BOX_SIZING_RE, HEADING_SELECTOR_RE, HERO_VIEWPORT_LOCK_RE, LEAD_FORM_ERROR_RE, LEAD_FORM_LOADING_RE, LEAD_FORM_SIGNAL_RE, LEAD_FORM_SUCCESS_RE, MARKETING_FEATURE_SURFACE_RE, META_PAGE_HEADING_RE, METRIC_CONTAINER_CLASS_RE, METRIC_CONTEXT_RE, NEGATIVE_LETTER_SPACING_RE, PLACEHOLDER_RE, PORTFOLIO_BUILDER_RE, PORTFOLIO_DETAIL_ACTION_RE, PORTFOLIO_ENTRY_CLASS_RE, PORTFOLIO_OUTCOME_RE, PORTFOLIO_SURFACE_RE, PRICING_ACTION_RE, PRICING_CADENCE_RE, PRICING_FEATURE_RE, PRICING_PLAN_CLASS_RE, PRICING_PRICE_GLOBAL_RE, PRICING_PRICE_RE, PRICING_RECOMMENDATION_RE, PRICING_SURFACE_RE, PRODUCT_APP_CHROME_CLASS_RE, PRODUCT_APP_SCREEN_RE, PRODUCT_NAV_DOMAIN_LABEL_RE, PROTOTYPE_NAV_HASH_PREFIX, PSEUDO_LIST_CONTAINER_CLASS_RE, PSEUDO_LIST_ITEM_CLASS_RE, RECORD_DISCOVERY_CONTROL_RE, RECORD_DISCOVERY_MARKUP_RE, RECOVERABLE_STATE_CONTEXT_RE, RECOVERABLE_STATE_HEADING_RE, RECOVERABLE_STATE_TEXT_RE, SETTINGS_CONTROL_SURFACE_RE, SITE_FOOTER_CLASS_RE, SITE_FOOTER_TEXT_RE, SPACING_DECLARATION_RE, SPACING_TOKEN_RE, SPECIFIC_BREADCRUMB_LABEL_RE, SPECIFIC_CHART_LABEL_RE, SPECIFIC_DIALOG_TITLE_RE, SPECIFIC_FORM_FIELD_LABEL_RE, SPECIFIC_METRIC_LABEL_RE, SPECIFIC_RECORD_ACTION_LABEL_RE, SPECIFIC_RECORD_DISCOVERY_LABEL_RE, SPECIFIC_RECORD_ITEM_LABEL_RE, SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE, SPECIFIC_SETTINGS_CONTROL_LABEL_RE, SPECIFIC_TAB_LABEL_RE, SPECIFIC_WORKFLOW_STEP_LABEL_RE, STATE_LAUNDRY_LIST_RE, STATE_MODULE_CLASS_RE, STATUS_AFFORDANCE_ATTRIBUTE_RE, STATUS_AFFORDANCE_CLASS_RE, STATUS_AFFORDANCE_STYLE_RE, STATUS_VALUE_ONLY_RE, STRONG_BRAND_LANDING_SCREEN_RE, STRONG_CONVERSION_CLOSE_TEXT_RE, TAB_CONTAINER_CLASS_RE, TESTIMONIAL_ATTRIBUTION_RE, TESTIMONIAL_CLASS_RE, TRUST_PROOF_CLASS_RE, TRUST_PROOF_TEXT_RE, UNBOUNDED_VIEWPORT_FONT_RE, VAGUE_TEMPLATE_COPY_PATTERNS, VANITY_METRIC_CONTAINER_RE, VIEWPORT_LOCK_RE, VISUAL_ANCHOR_CLASS_RE, VISUAL_ANCHOR_STYLE_RE, VISUAL_MEDIA_TAG_RE, WORKFLOW_STEP_CONTAINER_CLASS_RE, WORKFLOW_STEP_ITEM_CLASS_RE, WORKFLOW_STEP_STATE_RE, actionableRecordCount, attributeValue, attributeValues, breadcrumbBlocks, breadcrumbLabels, buildDesignHtmlQualityRepairPrompt, chartLabelTexts, chartLikeBlocks, chartMarkCount, clearDesignRuntimeQualityFindings, colorLiteralCount, concreteDataSignalCount, concreteFaqQuestion, contentForDataRealism, controlLabel, conversionCloseBlocks, countEmoji, countPatternHits, cssPaletteColors, deadAnchorTags, declarationValue, decodePrototypePathSegment, decorativeVisualAnchorTags, designQualityRepairDirective, destructiveActionControlTags, dialogTitleTexts, documentTitleText, duplicatedDesignCardCopyTexts, extractPrototypeHashRouteTarget, faqAnswerCount, faqAnswerTexts, faqBlocks, faqQuestionCount, faqQuestionTexts, featureCardBlocks, featureItemCount, firstScreenActionDescriptors, firstTopLevelHeadingIndex, fontSizePx, fontWeightValue, formFieldLabels, formFieldTags, formSignalText, formatDesignHtmlQualityFindings, fuzzyPrototypeSlugMatch, genericBreadcrumbLabel, genericBreadcrumbLabelBlocks, genericChartLabel, genericChartLabelTags, genericConversionCloseBlock, genericConversionCloseTags, genericDialogTitle, genericDialogTitleTags, genericFaqAnswer, genericFaqAnswerTags, genericFaqQuestion, genericFaqQuestionTags, genericFeatureCardDetail, genericFeatureCardDetailTags, genericFeedbackMessageCopy, genericFeedbackMessageCopyTags, genericFormFieldLabel, genericFormFieldLabelTags, genericImageAltTags, genericMetricCardLabel, genericMetricCardLabelTags, genericPortfolioProjectDetail, genericPortfolioProjectDetailTags, genericPricingPlanActionLabel, genericPricingPlanActionLabelTags, genericPricingPlanDetail, genericPricingPlanDetailTags, genericProductNavLabel, genericProductNavigationBlocks, genericRecordActionLabel, genericRecordActionLabelTags, genericRecordDiscoveryControlTags, genericRecordDiscoveryLabel, genericRecordItemLabel, genericRecordItemLabelScope, genericRecordItemLabelTags, genericRecordTableColumnLabel, genericRecordTableColumnTags, genericRecoverableStateCopy, genericRecoverableStateCopyTags, genericSectionHeadingTags, genericSettingsControlLabel, genericSettingsControlLabelTags, genericSiteFooterDetail, genericSiteFooterDetailTags, genericSiteFooterLabel, genericTabLabel, genericTabLabelTags, genericTestimonialCopyTags, genericTestimonialCopyText, genericTrustProofLabel, genericTrustProofTags, genericVanityMetricTags, genericVanityMetricText, genericWorkflowStepLabel, genericWorkflowStepLabelTags, getDesignRuntimeQualityFindings, hasActionableRecordText, hasAny, hasAssociatedLabel, hasBrandIdentity, hasBrandLandingScreenSignal, hasBrandNavigation, hasBreadcrumbContainerMetadata, hasCardLikeClass, hasCardLikeSelector, hasCenterEverythingLayout, hasChartContainerClass, hasChartDataContext, hasChartMarkClass, hasConcretePreviewDetail, hasConcreteVisualAnchorDetail, hasControlAccessibleName, hasConversionClose, hasDestructiveSafetyMarkup, hasDestructiveToneMarkup, hasDialogAccessibleName, hasDialogCloseAction, hasDialogContainerClass, hasDialogSemantics, hasFaqAnatomy, hasFeatureAnatomy, hasFeedbackMessageSignal, hasFirstScreenSupportContent, hasFixedDesktopFrame, hasFormFeedbackScript, hasFormFieldAffordance, hasGenericActionCopy, hasGenericPurpleBlueGradient, hasHashTarget, hasInteractionStateAffordance, hasInteractiveControls, hasLeadFormResponseStates, hasLocalModuleHeading, hasMetricContainerClass, hasMetricContext, hasMetricValue, hasMissingLayoutReset, hasModuleAccessibleName, hasMultiItemPrototypeNavigationWithoutCurrentState, hasNavigationCurrentState, hasNavigationLandmark, hasOneNotePalette, hasOverRoundedCardStyling, hasPortfolioProjectStructure, hasPricingStructure, hasPrimaryVisualAnchor, hasProductAppChrome, hasProductAppScreenSignal, hasPseudoListContainerClass, hasPseudoListItemClass, hasRecordAction, hasRecoverableStateClass, hasRecoverableStateSignal, hasScriptedInteraction, hasSemanticRecordStructure, hasSettingsControlSurface, hasSiblingPrototypeNavigation, hasSiteFooter, hasStateLaundryList, hasStateRecoveryAction, hasStaticLeadFormSignal, hasStaticPrimaryAction, hasStatusAffordanceMarkup, hasStatusAffordanceTag, hasTabContainerClass, hasTestimonialAttribution, hasTopLevelHeading, hasTrustProof, hasUsefulAnchorTarget, hasVisualAnchorClass, hasWeakBrandIdentity, hasWeakBrandNavigation, hasWeakColorSystem, hasWeakContentDepth, hasWeakConversionClose, hasWeakDataRealism, hasWeakFaqAnatomy, hasWeakFeatureAnatomy, hasWeakHeroViewportComposition, hasWeakPortfolioStructure, hasWeakPricingStructure, hasWeakProductAppShell, hasWeakProductPreviewDetail, hasWeakSecondaryActionPath, hasWeakSiteFooter, hasWeakSpacingSystem, hasWeakTestimonialAttribution, hasWeakTrustProof, hasWeakTypeHierarchy, hasWeakTypographyConstraints, hasWeakVisualAnchor, hasWorkflowStepContainerClass, hasWorkflowStepState, hueDistance, imageAccessibleText, inertFormTags, inlinePrototypeNavigationTargets, isBrandIdentityText, isDeadHrefTarget, isDecorativeImage, isDestructiveActionLabel, isGenericActionLabel, isGenericDocumentTitle, isGenericPageHeading, isGenericSectionHeading, isMetaPageHeading, isPageLikePrototypeTargetPath, isPrototypeBackInlineHandler, isSkippableInput, isWrappedByLabel, labelTextForInputId, largestHueClusterCount, leadFormTags, linkedSiblingPrototypeTargetCount, listItemRecordTexts, marketingFeatureSurfaceSignal, matchingSiblingScreensForPrototypeTarget, meaningfulContentModuleCount, mergeDesignHtmlQualityFindings, metricCardBlocks, metricCardLabel, missingImageAltTags, missingImageSourceTags, navigationBlocks, nestedCardLikeTags, normalizeHue, normalizePath, normalizePrototypeRouteSlug, normalizePrototypeTarget, normalizeQualityCode, normalizeRuntimeQualityFindings, normalizedActionLabel, normalizedBreadcrumbLabel, normalizedCardCopy, normalizedChartLabel, normalizedClassText, normalizedFeedbackMessageText, normalizedFormFieldLabel, normalizedHeadingText, normalizedMetricLabel, normalizedProductNavLabel, normalizedRecordDiscoveryLabel, normalizedRecordItemLabel, normalizedRecordTableColumnLabel, normalizedSettingsControlLabel, normalizedTrustProofLabel, normalizedVanityMetricText, normalizedWorkflowStepLabel, onclickAttributeValues, onsubmitAttributeValues, pairedTagMatches, parseCssColor, parseHexColor, parseHslColor, parseHslPercent, parseHueToken, parseRgbChannel, parseRgbColor, portfolioEntryCount, portfolioProjectBlocks, portfolioSurfaceSignal, pricingPlanActionLabels, pricingPlanBlocks, pricingPlanCount, pricingSurfaceSignal, primaryButtonLabels, productAppMetricCount, productAppModuleSignalCount, productNavigationLabels, prototypeExactTargetsForScreen, prototypeRouteSlugCandidates, prototypeRouteSlugsForScreen, prototypeTargetAttributeValues, prototypeTargetFromInlineHandler, prototypeTitleTokens, pseudoListContainerTags, pushFinding, radiusPx, recordActionLabels, recordDiscoveryControlArea, recordDiscoveryControlLabels, recordDiscoveryControlMarkup, recordItemBlocks, recordItemTitleLabels, rgbToHsl, runtimeQualityFindings, sectionHeadingTexts, setDesignRuntimeQualityFindings, settingsControlCount, settingsControlLabels, severityRank, shouldAutoRepairDesignHtmlFinding, siteFooterBlocks, spacingValueTokens, specificBreadcrumbLabel, specificChartLabel, specificDialogTitle, specificFeedbackMessageCopy, specificFormFieldLabel, specificProductNavLabel, specificRecordActionLabel, specificRecordDiscoveryLabel, specificRecordItemLabel, specificRecordTableColumnLabel, specificSettingsControlLabel, specificTabLabel, specificWorkflowStepLabel, stateLaundryListCount, staticHeadingTexts, statusValueLabel, stripHtmlComments, styleContent, summarizeDesignHtmlQualityDetails, summarizeDesignHtmlQualityStatus, tabControlCount, tabControlLabels, tableDataRowTexts, tableHeaderLabels, tagMatches, testimonialBlocks, testimonialQuoteTexts, textContent, textForElementId, topLevelHeadingTexts, unlabeledFieldTags, unnamedContentSectionTags, unnamedIconOnlyControlTags, visualAnchorBlocks, weakChartStructureTags, weakDestructiveActionSafetyTags, weakDialogAffordanceTags, weakFormAffordanceTags, weakLeadFormResponseTags, weakMetricContextTags, weakRecordActionTags, weakRecordDiscoveryControlTags, weakStateRecoveryActionTags, weakStatusAffordanceTags, weakTabCurrentStateTags, weakTableStructureTags, weakWorkflowStepStateTags, workflowStepItemCount, workflowStepLabels } from './helper-index'

export function auditCommerceAndStructureQuality(
  input: DesignHtmlQualityAuditInput,
  ctx: DesignHtmlQualityStaticAuditContext,
  findings: DesignHtmlQualityFinding[]
): void {
  const { normalized, styles, lower, visibleText } = ctx
    if (CREAM_BACKGROUND_RE.test(styles)) {
      pushFinding(findings, {
        code: 'default-cream-background',
        severity: 'warning',
        message: 'The page uses a default cream/beige/sand background pattern.',
        suggestion: 'Choose a surface color that fits the product identity instead of the common AI default warm canvas.'
      })
    }
    if (hasWeakColorSystem(styles)) {
      pushFinding(findings, {
        code: 'weak-color-system',
        severity: 'warning',
        message: 'The page uses many hard-coded colors without reusable palette tokens.',
        suggestion: 'Define reusable CSS custom properties for neutral, surface, text, border, and accent roles, then use those tokens consistently across modules.'
      })
    }
    if (hasOneNotePalette(styles)) {
      pushFinding(findings, {
        code: 'one-note-palette',
        severity: 'warning',
        message: 'The palette is dominated by variations of a single hue family.',
        suggestion: 'Keep the brand color intentional, but add neutral surfaces plus at least one distinct supporting accent or semantic color so the page has richer hierarchy.'
      })
    }
    if (hasWeakSpacingSystem(styles)) {
      pushFinding(findings, {
        code: 'weak-spacing-system',
        severity: 'warning',
        message: 'The page repeats the same default spacing value across most layout rules.',
        suggestion: 'Create a small spacing scale with reusable tokens and vary section, group, and control spacing so the layout has real rhythm instead of 16px everywhere.'
      })
    }
    if (hasOverRoundedCardStyling(styles)) {
      pushFinding(findings, {
        code: 'over-rounded-card-styling',
        severity: 'warning',
        message: 'Card or panel containers use oversized rounded corners.',
        suggestion: 'Use a restrained radius scale for product surfaces, usually around 6-8px for cards and panels, reserving larger radii for intentionally pill-shaped controls or media.'
      })
    }
    if (nestedCardLikeTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'nested-card-layout',
        severity: 'warning',
        message: 'The page appears to put card-like containers inside other cards.',
        suggestion: 'Flatten nested cards into clear sections, grids, rows, or tables; keep cards as sibling repeated items instead of card-in-card shells.'
      })
    }
    const weakTables = weakTableStructureTags(normalized)
    if (weakTables.length > 0) {
      pushFinding(findings, {
        code: 'weak-table-structure',
        severity: 'warning',
        message: 'Some data tables have no headers or accessible table context.',
        suggestion: 'Add table headers, scope attributes, captions, or aria labels so data modules are readable and implementation-ready.'
      })
    }
    if (weakRecordActionTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-record-actions',
        severity: 'warning',
        message: 'A record table or list shows actionable business items without row, bulk, or detail actions.',
        suggestion: 'Add clear record affordances such as row actions, checkboxes with bulk actions, detail links, approve/retry/assign buttons, or contextual menus.'
      })
    }
    if (genericRecordItemLabelTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-record-item-labels',
        severity: 'warning',
        message: 'A record list or card group uses generic item titles.',
        suggestion: 'Replace Item 1, Task 2, Record A, or Customer B-only item titles with concrete customers, invoices, tickets, renewals, owners, dates, amounts, or workflow context.'
      })
    }
    if (genericRecordActionLabelTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-record-action-labels',
        severity: 'warning',
        message: 'A record table or list uses generic row action labels.',
        suggestion: 'Replace View, Details, More, or Open-only record actions with task-specific labels such as Review renewal, Assign owner, Retry sync, Approve invoice, or Resolve ticket.'
      })
    }
    if (genericRecordTableColumnTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-record-table-columns',
        severity: 'warning',
        message: 'A record table uses generic template column labels.',
        suggestion: 'Replace Name, Status, Date, or Action-only columns with domain-specific fields such as account, invoice, renewal, amount, due date, risk, owner, SLA, or workflow stage.'
      })
    }
    if (weakRecordDiscoveryControlTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-record-discovery-controls',
        severity: 'warning',
        message: 'A dense record table or list has no search, filter, sort, pagination, or view controls.',
        suggestion: 'Add record discovery controls such as search, status/date filters, sortable columns, pagination, saved views, or segmented tabs.'
      })
    }
    if (genericRecordDiscoveryControlTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-record-discovery-controls',
        severity: 'warning',
        message: 'A dense record table or list uses generic search, filter, or view controls.',
        suggestion: 'Replace Search, Filter, or All statuses-only controls with object-specific search labels, domain filters, saved views, sort labels, or pagination copy.'
      })
    }
    if (weakMetricContextTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-metric-context',
        severity: 'warning',
        message: 'Several KPI or metric cards show values without timeframe, delta, target, or trend context.',
        suggestion: 'Add comparison context such as timeframe, previous-period delta, target/goal, trend direction, or benchmark notes for each key metric.'
      })
    }
    if (genericMetricCardLabelTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-metric-card-labels',
        severity: 'warning',
        message: 'Several KPI or metric cards use generic dashboard labels.',
        suggestion: 'Replace Revenue, Users, Growth, or Tasks-only scorecards with metrics that name the business object, workflow, period, owner, SLA, risk, or target.'
      })
    }
    if (weakChartStructureTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-chart-structure',
        severity: 'warning',
        message: 'A chart-like visualization has bars/marks but no clear data labels, caption, legend, or accessible chart context.',
        suggestion: 'Add a chart title or caption, axis or legend labels, visible values, and accessible SVG title/desc or aria labels tied to concrete data.'
      })
    }
    if (genericChartLabelTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-chart-labels',
        severity: 'warning',
        message: 'A chart-like visualization uses generic chart labels.',
        suggestion: 'Replace Chart, Data, Growth, or Series 1-only labels with the business metric, object, period, comparison, or segment shown.'
      })
    }
    if (pseudoListContainerTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-list-structure',
        severity: 'warning',
        message: 'A repeated record/list module is built from generic containers without list, table, or row semantics.',
        suggestion: 'Use ul/li, ol/li, table rows, role=list/listitem, or role=row semantics for queues, timelines, feeds, and repeated record groups.'
      })
    }
    if (weakStatusAffordanceTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-status-affordance',
        severity: 'warning',
        message: 'Repeated status values render as plain text instead of semantic visual states.',
        suggestion: 'Render statuses as labeled badges, chips, or state tags with semantic tone, accessible labels, and clear contrast.'
      })
    }
    if (unnamedContentSectionTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'unnamed-content-section',
        severity: 'warning',
        message: 'A meaningful content module has no visible heading or accessible section name.',
        suggestion: 'Add concise section headings, legends, aria-label, or aria-labelledby for major panels, lists, forms, asides, and status modules.'
      })
    }
    if (countEmoji(visibleText) >= 3) {
      pushFinding(findings, {
        code: 'emoji-iconography',
        severity: 'warning',
        message: 'The visible design uses several emoji, likely as icon placeholders.',
        suggestion: 'Replace emoji icons with text labels, CSS-drawn marks, inline SVG, or a consistent icon system.'
      })
    }
    if (!/@media\b/i.test(normalized) && !/\bclamp\(/i.test(normalized)) {
      pushFinding(findings, {
        code: 'weak-responsive-rules',
        severity: 'warning',
        message: 'No media query or clamp() responsive sizing was found.',
        suggestion: 'Add explicit mobile/tablet/desktop behavior so the design does not collapse at different canvas sizes.'
      })
    }
}
