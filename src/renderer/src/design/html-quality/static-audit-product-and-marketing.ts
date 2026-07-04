import type { DesignHtmlQualityAuditInput, DesignHtmlQualityFinding } from './types'
import type { DesignHtmlQualityStaticAuditContext } from './static-audit-types'
import { ACTIONABLE_RECORD_TEXT_RE, AI_GRADIENT_COLOR_RE, BODY_TEXT_SELECTOR_RE, BRAND_IDENTITY_CLASS_RE, BRAND_LANDING_SCREEN_RE, BRAND_NAME_LIKE_RE, BRAND_NAV_CLASS_RE, BREADCRUMB_CONTAINER_RE, CHART_CONTAINER_CLASS_RE, CHART_MARK_CLASS_RE, COLOR_LITERAL_RE, CONCRETE_CONVERSION_CLOSE_CONTEXT_RE, CONCRETE_DATA_PATTERNS, CONCRETE_FAQ_DETAIL_RE, CONCRETE_FAQ_QUESTION_RE, CONCRETE_FEATURE_DETAIL_RE, CONCRETE_METRIC_SPECIFICITY_RE, CONCRETE_PRICING_PLAN_DETAIL_RE, CONCRETE_TESTIMONIAL_CONTEXT_RE, CONVERSION_CLOSE_CLASS_RE, CONVERSION_CLOSE_TEXT_RE, CREAM_BACKGROUND_RE, CSS_CUSTOM_PROPERTY_RE, CSS_RULE_BLOCK_RE, DECORATIVE_VISUAL_ANCHOR_RE, DESIGN_ITEM_CARD_CLASS_RE, DESTRUCTIVE_ACTION_LABEL_RE, DESTRUCTIVE_SAFETY_MARKUP_RE, DESTRUCTIVE_TONE_MARKUP_RE, DIALOG_CLOSE_LABEL_RE, DIALOG_CONTAINER_CLASS_RE, EMOJI_RE, FAQ_QUESTION_RE, FAQ_SECTION_RE, FEATURE_DETAIL_RE, FEATURE_ITEM_CLASS_RE, FEATURE_SECTION_RE, FEEDBACK_MESSAGE_CLASS_RE, FEEDBACK_MESSAGE_CONTEXT_RE, FIXED_DESKTOP_FRAME_RE, FLUID_MEDIA_RULE_RE, FORM_FIELD_AFFORDANCE_RE, GENERIC_ACTION_LABEL_RE, GENERIC_BRAND_IDENTITY_LABEL_RE, GENERIC_BREADCRUMB_LABEL_RE, GENERIC_CHART_LABEL_RE, GENERIC_CONVERSION_CLOSE_COPY_RE, GENERIC_CONVERSION_CLOSE_HEADING_RE, GENERIC_DIALOG_TITLE_RE, GENERIC_DOCUMENT_TITLE_RE, GENERIC_FAQ_ANSWER_RE, GENERIC_FAQ_QUESTION_RE, GENERIC_FEATURE_DETAIL_RE, GENERIC_FEATURE_TITLE_RE, GENERIC_FEEDBACK_MESSAGE_RE, GENERIC_FORM_FIELD_LABEL_RE, GENERIC_IMAGE_ALT_RE, GENERIC_METRIC_LABEL_RE, GENERIC_PAGE_HEADING_RE, GENERIC_PORTFOLIO_PROJECT_RE, GENERIC_PRICING_PLAN_ACTION_RE, GENERIC_PRICING_PLAN_DETAIL_RE, GENERIC_PRODUCT_NAV_LABEL_RE, GENERIC_RECORD_ACTION_LABEL_RE, GENERIC_RECORD_DISCOVERY_LABEL_RE, GENERIC_RECORD_ITEM_LABEL_RE, GENERIC_RECORD_TABLE_COLUMN_LABEL_RE, GENERIC_RECOVERABLE_STATE_COPY_RE, GENERIC_SECTION_HEADING_RE, GENERIC_SETTINGS_CONTROL_LABEL_RE, GENERIC_SITE_FOOTER_LABEL_RE, GENERIC_TAB_LABEL_RE, GENERIC_TESTIMONIAL_COPY_RE, GENERIC_TRUST_PROOF_LABEL_RE, GENERIC_VANITY_METRIC_RE, GENERIC_WORKFLOW_STEP_LABEL_RE, GLOBAL_BOX_SIZING_RE, HEADING_SELECTOR_RE, HERO_VIEWPORT_LOCK_RE, LEAD_FORM_ERROR_RE, LEAD_FORM_LOADING_RE, LEAD_FORM_SIGNAL_RE, LEAD_FORM_SUCCESS_RE, MARKETING_FEATURE_SURFACE_RE, META_PAGE_HEADING_RE, METRIC_CONTAINER_CLASS_RE, METRIC_CONTEXT_RE, NEGATIVE_LETTER_SPACING_RE, PLACEHOLDER_RE, PORTFOLIO_BUILDER_RE, PORTFOLIO_DETAIL_ACTION_RE, PORTFOLIO_ENTRY_CLASS_RE, PORTFOLIO_OUTCOME_RE, PORTFOLIO_SURFACE_RE, PRICING_ACTION_RE, PRICING_CADENCE_RE, PRICING_FEATURE_RE, PRICING_PLAN_CLASS_RE, PRICING_PRICE_GLOBAL_RE, PRICING_PRICE_RE, PRICING_RECOMMENDATION_RE, PRICING_SURFACE_RE, PRODUCT_APP_CHROME_CLASS_RE, PRODUCT_APP_SCREEN_RE, PRODUCT_NAV_DOMAIN_LABEL_RE, PROTOTYPE_NAV_HASH_PREFIX, PSEUDO_LIST_CONTAINER_CLASS_RE, PSEUDO_LIST_ITEM_CLASS_RE, RECORD_DISCOVERY_CONTROL_RE, RECORD_DISCOVERY_MARKUP_RE, RECOVERABLE_STATE_CONTEXT_RE, RECOVERABLE_STATE_HEADING_RE, RECOVERABLE_STATE_TEXT_RE, SETTINGS_CONTROL_SURFACE_RE, SITE_FOOTER_CLASS_RE, SITE_FOOTER_TEXT_RE, SPACING_DECLARATION_RE, SPACING_TOKEN_RE, SPECIFIC_BREADCRUMB_LABEL_RE, SPECIFIC_CHART_LABEL_RE, SPECIFIC_DIALOG_TITLE_RE, SPECIFIC_FORM_FIELD_LABEL_RE, SPECIFIC_METRIC_LABEL_RE, SPECIFIC_RECORD_ACTION_LABEL_RE, SPECIFIC_RECORD_DISCOVERY_LABEL_RE, SPECIFIC_RECORD_ITEM_LABEL_RE, SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE, SPECIFIC_SETTINGS_CONTROL_LABEL_RE, SPECIFIC_TAB_LABEL_RE, SPECIFIC_WORKFLOW_STEP_LABEL_RE, STATE_LAUNDRY_LIST_RE, STATE_MODULE_CLASS_RE, STATUS_AFFORDANCE_ATTRIBUTE_RE, STATUS_AFFORDANCE_CLASS_RE, STATUS_AFFORDANCE_STYLE_RE, STATUS_VALUE_ONLY_RE, STRONG_BRAND_LANDING_SCREEN_RE, STRONG_CONVERSION_CLOSE_TEXT_RE, TAB_CONTAINER_CLASS_RE, TESTIMONIAL_ATTRIBUTION_RE, TESTIMONIAL_CLASS_RE, TRUST_PROOF_CLASS_RE, TRUST_PROOF_TEXT_RE, UNBOUNDED_VIEWPORT_FONT_RE, VAGUE_TEMPLATE_COPY_PATTERNS, VANITY_METRIC_CONTAINER_RE, VIEWPORT_LOCK_RE, VISUAL_ANCHOR_CLASS_RE, VISUAL_ANCHOR_STYLE_RE, VISUAL_MEDIA_TAG_RE, WORKFLOW_STEP_CONTAINER_CLASS_RE, WORKFLOW_STEP_ITEM_CLASS_RE, WORKFLOW_STEP_STATE_RE, actionableRecordCount, attributeValue, attributeValues, breadcrumbBlocks, breadcrumbLabels, buildDesignHtmlQualityRepairPrompt, chartLabelTexts, chartLikeBlocks, chartMarkCount, clearDesignRuntimeQualityFindings, colorLiteralCount, concreteDataSignalCount, concreteFaqQuestion, contentForDataRealism, controlLabel, conversionCloseBlocks, countEmoji, countPatternHits, cssPaletteColors, deadAnchorTags, declarationValue, decodePrototypePathSegment, decorativeVisualAnchorTags, designQualityRepairDirective, destructiveActionControlTags, dialogTitleTexts, documentTitleText, duplicatedDesignCardCopyTexts, extractPrototypeHashRouteTarget, faqAnswerCount, faqAnswerTexts, faqBlocks, faqQuestionCount, faqQuestionTexts, featureCardBlocks, featureItemCount, firstScreenActionDescriptors, firstTopLevelHeadingIndex, fontSizePx, fontWeightValue, formFieldLabels, formFieldTags, formSignalText, formatDesignHtmlQualityFindings, fuzzyPrototypeSlugMatch, genericBreadcrumbLabel, genericBreadcrumbLabelBlocks, genericChartLabel, genericChartLabelTags, genericConversionCloseBlock, genericConversionCloseTags, genericDialogTitle, genericDialogTitleTags, genericFaqAnswer, genericFaqAnswerTags, genericFaqQuestion, genericFaqQuestionTags, genericFeatureCardDetail, genericFeatureCardDetailTags, genericFeedbackMessageCopy, genericFeedbackMessageCopyTags, genericFormFieldLabel, genericFormFieldLabelTags, genericImageAltTags, genericMetricCardLabel, genericMetricCardLabelTags, genericPortfolioProjectDetail, genericPortfolioProjectDetailTags, genericPricingPlanActionLabel, genericPricingPlanActionLabelTags, genericPricingPlanDetail, genericPricingPlanDetailTags, genericProductNavLabel, genericProductNavigationBlocks, genericRecordActionLabel, genericRecordActionLabelTags, genericRecordDiscoveryControlTags, genericRecordDiscoveryLabel, genericRecordItemLabel, genericRecordItemLabelScope, genericRecordItemLabelTags, genericRecordTableColumnLabel, genericRecordTableColumnTags, genericRecoverableStateCopy, genericRecoverableStateCopyTags, genericSectionHeadingTags, genericSettingsControlLabel, genericSettingsControlLabelTags, genericSiteFooterDetail, genericSiteFooterDetailTags, genericSiteFooterLabel, genericTabLabel, genericTabLabelTags, genericTestimonialCopyTags, genericTestimonialCopyText, genericTrustProofLabel, genericTrustProofTags, genericVanityMetricTags, genericVanityMetricText, genericWorkflowStepLabel, genericWorkflowStepLabelTags, getDesignRuntimeQualityFindings, hasActionableRecordText, hasAny, hasAssociatedLabel, hasBrandIdentity, hasBrandLandingScreenSignal, hasBrandNavigation, hasBreadcrumbContainerMetadata, hasCardLikeClass, hasCardLikeSelector, hasCenterEverythingLayout, hasChartContainerClass, hasChartDataContext, hasChartMarkClass, hasConcretePreviewDetail, hasConcreteVisualAnchorDetail, hasControlAccessibleName, hasConversionClose, hasDestructiveSafetyMarkup, hasDestructiveToneMarkup, hasDialogAccessibleName, hasDialogCloseAction, hasDialogContainerClass, hasDialogSemantics, hasFaqAnatomy, hasFeatureAnatomy, hasFeedbackMessageSignal, hasFirstScreenSupportContent, hasFixedDesktopFrame, hasFormFeedbackScript, hasFormFieldAffordance, hasGenericActionCopy, hasGenericPurpleBlueGradient, hasHashTarget, hasInteractionStateAffordance, hasInteractiveControls, hasLeadFormResponseStates, hasLocalModuleHeading, hasMetricContainerClass, hasMetricContext, hasMetricValue, hasMissingLayoutReset, hasModuleAccessibleName, hasMultiItemPrototypeNavigationWithoutCurrentState, hasNavigationCurrentState, hasNavigationLandmark, hasOneNotePalette, hasOverRoundedCardStyling, hasPortfolioProjectStructure, hasPricingStructure, hasPrimaryVisualAnchor, hasProductAppChrome, hasProductAppScreenSignal, hasPseudoListContainerClass, hasPseudoListItemClass, hasRecordAction, hasRecoverableStateClass, hasRecoverableStateSignal, hasScriptedInteraction, hasSemanticRecordStructure, hasSettingsControlSurface, hasSiblingPrototypeNavigation, hasSiteFooter, hasStateLaundryList, hasStateRecoveryAction, hasStaticLeadFormSignal, hasStaticPrimaryAction, hasStatusAffordanceMarkup, hasStatusAffordanceTag, hasTabContainerClass, hasTestimonialAttribution, hasTopLevelHeading, hasTrustProof, hasUsefulAnchorTarget, hasVisualAnchorClass, hasWeakBrandIdentity, hasWeakBrandNavigation, hasWeakColorSystem, hasWeakContentDepth, hasWeakConversionClose, hasWeakDataRealism, hasWeakFaqAnatomy, hasWeakFeatureAnatomy, hasWeakHeroViewportComposition, hasWeakPortfolioStructure, hasWeakPricingStructure, hasWeakProductAppShell, hasWeakProductPreviewDetail, hasWeakSecondaryActionPath, hasWeakSiteFooter, hasWeakSpacingSystem, hasWeakTestimonialAttribution, hasWeakTrustProof, hasWeakTypeHierarchy, hasWeakTypographyConstraints, hasWeakVisualAnchor, hasWorkflowStepContainerClass, hasWorkflowStepState, hueDistance, imageAccessibleText, inertFormTags, inlinePrototypeNavigationTargets, isBrandIdentityText, isDeadHrefTarget, isDecorativeImage, isDestructiveActionLabel, isGenericActionLabel, isGenericDocumentTitle, isGenericPageHeading, isGenericSectionHeading, isMetaPageHeading, isPageLikePrototypeTargetPath, isPrototypeBackInlineHandler, isSkippableInput, isWrappedByLabel, labelTextForInputId, largestHueClusterCount, leadFormTags, linkedSiblingPrototypeTargetCount, listItemRecordTexts, marketingFeatureSurfaceSignal, matchingSiblingScreensForPrototypeTarget, meaningfulContentModuleCount, mergeDesignHtmlQualityFindings, metricCardBlocks, metricCardLabel, missingImageAltTags, missingImageSourceTags, navigationBlocks, nestedCardLikeTags, normalizeHue, normalizePath, normalizePrototypeRouteSlug, normalizePrototypeTarget, normalizeQualityCode, normalizeRuntimeQualityFindings, normalizedActionLabel, normalizedBreadcrumbLabel, normalizedCardCopy, normalizedChartLabel, normalizedClassText, normalizedFeedbackMessageText, normalizedFormFieldLabel, normalizedHeadingText, normalizedMetricLabel, normalizedProductNavLabel, normalizedRecordDiscoveryLabel, normalizedRecordItemLabel, normalizedRecordTableColumnLabel, normalizedSettingsControlLabel, normalizedTrustProofLabel, normalizedVanityMetricText, normalizedWorkflowStepLabel, onclickAttributeValues, onsubmitAttributeValues, pairedTagMatches, parseCssColor, parseHexColor, parseHslColor, parseHslPercent, parseHueToken, parseRgbChannel, parseRgbColor, portfolioEntryCount, portfolioProjectBlocks, portfolioSurfaceSignal, pricingPlanActionLabels, pricingPlanBlocks, pricingPlanCount, pricingSurfaceSignal, primaryButtonLabels, productAppMetricCount, productAppModuleSignalCount, productNavigationLabels, prototypeExactTargetsForScreen, prototypeRouteSlugCandidates, prototypeRouteSlugsForScreen, prototypeTargetAttributeValues, prototypeTargetFromInlineHandler, prototypeTitleTokens, pseudoListContainerTags, pushFinding, radiusPx, recordActionLabels, recordDiscoveryControlArea, recordDiscoveryControlLabels, recordDiscoveryControlMarkup, recordItemBlocks, recordItemTitleLabels, rgbToHsl, runtimeQualityFindings, sectionHeadingTexts, setDesignRuntimeQualityFindings, settingsControlCount, settingsControlLabels, severityRank, shouldAutoRepairDesignHtmlFinding, siteFooterBlocks, spacingValueTokens, specificBreadcrumbLabel, specificChartLabel, specificDialogTitle, specificFeedbackMessageCopy, specificFormFieldLabel, specificProductNavLabel, specificRecordActionLabel, specificRecordDiscoveryLabel, specificRecordItemLabel, specificRecordTableColumnLabel, specificSettingsControlLabel, specificTabLabel, specificWorkflowStepLabel, stateLaundryListCount, staticHeadingTexts, statusValueLabel, stripHtmlComments, styleContent, summarizeDesignHtmlQualityDetails, summarizeDesignHtmlQualityStatus, tabControlCount, tabControlLabels, tableDataRowTexts, tableHeaderLabels, tagMatches, testimonialBlocks, testimonialQuoteTexts, textContent, textForElementId, topLevelHeadingTexts, unlabeledFieldTags, unnamedContentSectionTags, unnamedIconOnlyControlTags, visualAnchorBlocks, weakChartStructureTags, weakDestructiveActionSafetyTags, weakDialogAffordanceTags, weakFormAffordanceTags, weakLeadFormResponseTags, weakMetricContextTags, weakRecordActionTags, weakRecordDiscoveryControlTags, weakStateRecoveryActionTags, weakStatusAffordanceTags, weakTabCurrentStateTags, weakTableStructureTags, weakWorkflowStepStateTags, workflowStepItemCount, workflowStepLabels } from './helper-index'

export function auditProductAndMarketingQuality(
  input: DesignHtmlQualityAuditInput,
  ctx: DesignHtmlQualityStaticAuditContext,
  findings: DesignHtmlQualityFinding[]
): void {
  const { normalized, styles, lower, visibleText } = ctx
    if (hasWeakHeroViewportComposition(normalized, styles, visibleText)) {
      pushFinding(findings, {
        code: 'weak-hero-viewport-composition',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page uses a full-height hero that hides the next section.',
        suggestion: 'Reduce hero min-height, adjust spacing, or add a visible next-section peek so the first viewport hints at more content below.'
      })
    }
    if (hasWeakTrustProof(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-trust-proof',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page has no concrete trust proof.',
        suggestion: 'Add customer logos, testimonials, ratings, case-study metrics, press mentions, or security/compliance badges with realistic names and numbers.'
      })
    }
    if (genericTrustProofTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-trust-proof',
        severity: 'warning',
        message: 'A trust proof, logo, customer, or press module uses generic placeholder labels.',
        suggestion: 'Replace generic proof labels such as Logo 1, Company A, or Client B with realistic customer names, publication names, certification badges, ratings, or outcome metrics.'
      })
    }
    if (genericVanityMetricTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-vanity-metrics',
        severity: 'warning',
        message: 'A proof, impact, or metrics module uses generic vanity statistics.',
        suggestion: 'Replace broad stats like 99% satisfaction, 10x faster, 1M+ users, or 24/7 support with sourced customer metrics, timeframes, benchmarks, or case-study outcomes.'
      })
    }
    if (hasWeakTestimonialAttribution(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-testimonial-attribution',
        severity: 'warning',
        message: 'A testimonial or customer quote lacks credible attribution.',
        suggestion: 'Add a named person or company, role/source, and concrete outcome context to each testimonial or customer quote.'
      })
    }
    if (genericTestimonialCopyTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-testimonial-copy',
        severity: 'warning',
        message: 'A testimonial or customer quote uses generic praise without concrete outcome context.',
        suggestion: 'Replace vague praise such as Amazing product or Highly recommend with a workflow, metric, timeframe, or case-study result.'
      })
    }
    if (hasWeakFeatureAnatomy(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-feature-anatomy',
        severity: 'warning',
        message: 'This landing, brand, product, feature, or marketing page has no concrete feature or benefit anatomy.',
        suggestion: 'Add feature, benefit, capability, or use-case sections with named product capabilities, user outcomes, and product-specific details.'
      })
    }
    if (genericFeatureCardDetailTags(normalized, visibleText).length >= 2) {
      pushFinding(findings, {
        code: 'generic-feature-card-detail',
        severity: 'warning',
        message: 'Several feature or benefit cards use generic capability copy.',
        suggestion: 'Replace broad cards such as Automation, Analytics, or Security with named product capabilities tied to concrete objects, workflows, user outcomes, or measurable details.'
      })
    }
    if (hasWeakPricingStructure(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-pricing-structure',
        severity: 'warning',
        message: 'This pricing or plans page lacks a complete pricing comparison structure.',
        suggestion: 'Add distinct plan cards or a comparison table with prices, billing cadence, a recommended plan, feature differences, and plan-specific CTAs.'
      })
    }
    if (genericPricingPlanDetailTags(normalized, visibleText).length >= 2) {
      pushFinding(findings, {
        code: 'generic-pricing-plan-detail',
        severity: 'warning',
        message: 'Several pricing plan cards use generic filler instead of concrete plan differences.',
        suggestion: 'Replace filler such as All core features, Everything you need, or Priority support with concrete limits, plan-specific capabilities, audiences, service levels, or upgrade reasons.'
      })
    }
    if (genericPricingPlanActionLabelTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-pricing-plan-action-labels',
        severity: 'warning',
        message: 'Several pricing plan cards repeat the same generic action label.',
        suggestion: 'Replace repeated Choose plan, Get started, or Start trial actions with plan-specific CTAs such as Start studio trial, Upgrade to agency launch, or Talk to enterprise sales.'
      })
    }
    if (duplicatedDesignCardCopyTexts(normalized).length > 0) {
      pushFinding(findings, {
        code: 'duplicated-card-copy',
        severity: 'warning',
        message: 'Repeated feature, pricing, proof, project, or testimonial cards reuse the same copy.',
        suggestion: 'Give each repeated card a distinct title, concrete detail, data point, outcome, or audience-specific reason to exist.'
      })
    }
    if (hasWeakConversionClose(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-conversion-close',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page has no final conversion or next-step section near the end.',
        suggestion: 'Add a closing CTA/footer, FAQ, contact/demo/signup form, calendar/contact route, or next-step section so the page has a complete conversion path.'
      })
    }
    if (genericConversionCloseTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-conversion-close',
        severity: 'warning',
        message: 'The final conversion or next-step section uses generic closing copy.',
        suggestion: 'Replace vague closes such as Ready to get started with a specific outcome, timeframe, next deliverable, or domain-specific CTA.'
      })
    }
    if (hasWeakFaqAnatomy(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-faq-anatomy',
        severity: 'warning',
        message: 'An FAQ or frequently asked questions section is too thin to handle real customer objections.',
        suggestion: 'Add multiple concrete question/answer items covering objections such as pricing, migration, support, security, setup, or timeline.'
      })
    }
    if (genericFaqQuestionTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-faq-questions',
        severity: 'warning',
        message: 'An FAQ or frequently asked questions section uses generic template questions.',
        suggestion: 'Replace questions such as What is this, How does it work, or Who is this for with concrete objections about pricing, migration, setup time, security, support, integrations, or plan limits.'
      })
    }
    if (genericFaqAnswerTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-faq-answers',
        severity: 'warning',
        message: 'An FAQ or frequently asked questions section uses generic, evasive answers.',
        suggestion: 'Replace vague answers such as Contact us, Learn more, or Our team can help with concrete objection-handling details about pricing, migration, security, support, setup, timelines, or integrations.'
      })
    }
    if (hasWeakSiteFooter(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-site-footer',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page has no complete site footer.',
        suggestion: 'Add a real footer with brand/contact details, secondary links, social/legal links, copyright, support, newsletter, or status information.'
      })
    }
    if (genericSiteFooterDetailTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-site-footer-detail',
        severity: 'warning',
        message: 'The site footer uses generic template columns without concrete footer details.',
        suggestion: 'Replace Product, Company, or Resources-only footer columns with brand/contact details, legal/status/social/help links, copyright, or product-specific routes.'
      })
    }
    if (countPatternHits(visibleText, VAGUE_TEMPLATE_COPY_PATTERNS) >= 2) {
      pushFinding(findings, {
        code: 'vague-template-copy',
        severity: 'warning',
        message: 'The visible copy leans on generic template/marketing phrases instead of product-specific content.',
        suggestion: 'Replace vague claims with concrete user tasks, domain nouns, real data points, names, prices, dates, or outcome-specific microcopy.'
      })
    }
    if (hasGenericPurpleBlueGradient(normalized)) {
      pushFinding(findings, {
        code: 'generic-ai-gradient',
        severity: 'warning',
        message: 'The page appears to use a generic purple/blue AI-style gradient.',
        suggestion: 'Replace it with a product-specific palette, neutral ramp, and purposeful accent color.'
      })
    }
    if (hasCenterEverythingLayout(styles)) {
      pushFinding(findings, {
        code: 'center-everything-layout',
        severity: 'warning',
        message: 'The page appears to center every major block in a template-like layout.',
        suggestion: 'Introduce real information architecture with aligned sections, split content, grids, tables, or lists instead of centering every block.'
      })
    }
}
