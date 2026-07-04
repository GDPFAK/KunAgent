import type { DesignHtmlQualityAuditInput, DesignHtmlQualityFinding } from './types'
import type { DesignHtmlQualityStaticAuditContext } from './static-audit-types'
import { ACTIONABLE_RECORD_TEXT_RE, AI_GRADIENT_COLOR_RE, BODY_TEXT_SELECTOR_RE, BRAND_IDENTITY_CLASS_RE, BRAND_LANDING_SCREEN_RE, BRAND_NAME_LIKE_RE, BRAND_NAV_CLASS_RE, BREADCRUMB_CONTAINER_RE, CHART_CONTAINER_CLASS_RE, CHART_MARK_CLASS_RE, COLOR_LITERAL_RE, CONCRETE_CONVERSION_CLOSE_CONTEXT_RE, CONCRETE_DATA_PATTERNS, CONCRETE_FAQ_DETAIL_RE, CONCRETE_FAQ_QUESTION_RE, CONCRETE_FEATURE_DETAIL_RE, CONCRETE_METRIC_SPECIFICITY_RE, CONCRETE_PRICING_PLAN_DETAIL_RE, CONCRETE_TESTIMONIAL_CONTEXT_RE, CONVERSION_CLOSE_CLASS_RE, CONVERSION_CLOSE_TEXT_RE, CREAM_BACKGROUND_RE, CSS_CUSTOM_PROPERTY_RE, CSS_RULE_BLOCK_RE, DECORATIVE_VISUAL_ANCHOR_RE, DESIGN_ITEM_CARD_CLASS_RE, DESTRUCTIVE_ACTION_LABEL_RE, DESTRUCTIVE_SAFETY_MARKUP_RE, DESTRUCTIVE_TONE_MARKUP_RE, DIALOG_CLOSE_LABEL_RE, DIALOG_CONTAINER_CLASS_RE, EMOJI_RE, FAQ_QUESTION_RE, FAQ_SECTION_RE, FEATURE_DETAIL_RE, FEATURE_ITEM_CLASS_RE, FEATURE_SECTION_RE, FEEDBACK_MESSAGE_CLASS_RE, FEEDBACK_MESSAGE_CONTEXT_RE, FIXED_DESKTOP_FRAME_RE, FLUID_MEDIA_RULE_RE, FORM_FIELD_AFFORDANCE_RE, GENERIC_ACTION_LABEL_RE, GENERIC_BRAND_IDENTITY_LABEL_RE, GENERIC_BREADCRUMB_LABEL_RE, GENERIC_CHART_LABEL_RE, GENERIC_CONVERSION_CLOSE_COPY_RE, GENERIC_CONVERSION_CLOSE_HEADING_RE, GENERIC_DIALOG_TITLE_RE, GENERIC_DOCUMENT_TITLE_RE, GENERIC_FAQ_ANSWER_RE, GENERIC_FAQ_QUESTION_RE, GENERIC_FEATURE_DETAIL_RE, GENERIC_FEATURE_TITLE_RE, GENERIC_FEEDBACK_MESSAGE_RE, GENERIC_FORM_FIELD_LABEL_RE, GENERIC_IMAGE_ALT_RE, GENERIC_METRIC_LABEL_RE, GENERIC_PAGE_HEADING_RE, GENERIC_PORTFOLIO_PROJECT_RE, GENERIC_PRICING_PLAN_ACTION_RE, GENERIC_PRICING_PLAN_DETAIL_RE, GENERIC_PRODUCT_NAV_LABEL_RE, GENERIC_RECORD_ACTION_LABEL_RE, GENERIC_RECORD_DISCOVERY_LABEL_RE, GENERIC_RECORD_ITEM_LABEL_RE, GENERIC_RECORD_TABLE_COLUMN_LABEL_RE, GENERIC_RECOVERABLE_STATE_COPY_RE, GENERIC_SECTION_HEADING_RE, GENERIC_SETTINGS_CONTROL_LABEL_RE, GENERIC_SITE_FOOTER_LABEL_RE, GENERIC_TAB_LABEL_RE, GENERIC_TESTIMONIAL_COPY_RE, GENERIC_TRUST_PROOF_LABEL_RE, GENERIC_VANITY_METRIC_RE, GENERIC_WORKFLOW_STEP_LABEL_RE, GLOBAL_BOX_SIZING_RE, HEADING_SELECTOR_RE, HERO_VIEWPORT_LOCK_RE, LEAD_FORM_ERROR_RE, LEAD_FORM_LOADING_RE, LEAD_FORM_SIGNAL_RE, LEAD_FORM_SUCCESS_RE, MARKETING_FEATURE_SURFACE_RE, META_PAGE_HEADING_RE, METRIC_CONTAINER_CLASS_RE, METRIC_CONTEXT_RE, NEGATIVE_LETTER_SPACING_RE, PLACEHOLDER_RE, PORTFOLIO_BUILDER_RE, PORTFOLIO_DETAIL_ACTION_RE, PORTFOLIO_ENTRY_CLASS_RE, PORTFOLIO_OUTCOME_RE, PORTFOLIO_SURFACE_RE, PRICING_ACTION_RE, PRICING_CADENCE_RE, PRICING_FEATURE_RE, PRICING_PLAN_CLASS_RE, PRICING_PRICE_GLOBAL_RE, PRICING_PRICE_RE, PRICING_RECOMMENDATION_RE, PRICING_SURFACE_RE, PRODUCT_APP_CHROME_CLASS_RE, PRODUCT_APP_SCREEN_RE, PRODUCT_NAV_DOMAIN_LABEL_RE, PROTOTYPE_NAV_HASH_PREFIX, PSEUDO_LIST_CONTAINER_CLASS_RE, PSEUDO_LIST_ITEM_CLASS_RE, RECORD_DISCOVERY_CONTROL_RE, RECORD_DISCOVERY_MARKUP_RE, RECOVERABLE_STATE_CONTEXT_RE, RECOVERABLE_STATE_HEADING_RE, RECOVERABLE_STATE_TEXT_RE, SETTINGS_CONTROL_SURFACE_RE, SITE_FOOTER_CLASS_RE, SITE_FOOTER_TEXT_RE, SPACING_DECLARATION_RE, SPACING_TOKEN_RE, SPECIFIC_BREADCRUMB_LABEL_RE, SPECIFIC_CHART_LABEL_RE, SPECIFIC_DIALOG_TITLE_RE, SPECIFIC_FORM_FIELD_LABEL_RE, SPECIFIC_METRIC_LABEL_RE, SPECIFIC_RECORD_ACTION_LABEL_RE, SPECIFIC_RECORD_DISCOVERY_LABEL_RE, SPECIFIC_RECORD_ITEM_LABEL_RE, SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE, SPECIFIC_SETTINGS_CONTROL_LABEL_RE, SPECIFIC_TAB_LABEL_RE, SPECIFIC_WORKFLOW_STEP_LABEL_RE, STATE_LAUNDRY_LIST_RE, STATE_MODULE_CLASS_RE, STATUS_AFFORDANCE_ATTRIBUTE_RE, STATUS_AFFORDANCE_CLASS_RE, STATUS_AFFORDANCE_STYLE_RE, STATUS_VALUE_ONLY_RE, STRONG_BRAND_LANDING_SCREEN_RE, STRONG_CONVERSION_CLOSE_TEXT_RE, TAB_CONTAINER_CLASS_RE, TESTIMONIAL_ATTRIBUTION_RE, TESTIMONIAL_CLASS_RE, TRUST_PROOF_CLASS_RE, TRUST_PROOF_TEXT_RE, UNBOUNDED_VIEWPORT_FONT_RE, VAGUE_TEMPLATE_COPY_PATTERNS, VANITY_METRIC_CONTAINER_RE, VIEWPORT_LOCK_RE, VISUAL_ANCHOR_CLASS_RE, VISUAL_ANCHOR_STYLE_RE, VISUAL_MEDIA_TAG_RE, WORKFLOW_STEP_CONTAINER_CLASS_RE, WORKFLOW_STEP_ITEM_CLASS_RE, WORKFLOW_STEP_STATE_RE, actionableRecordCount, attributeValue, attributeValues, breadcrumbBlocks, breadcrumbLabels, buildDesignHtmlQualityRepairPrompt, chartLabelTexts, chartLikeBlocks, chartMarkCount, clearDesignRuntimeQualityFindings, colorLiteralCount, concreteDataSignalCount, concreteFaqQuestion, contentForDataRealism, controlLabel, conversionCloseBlocks, countEmoji, countPatternHits, cssPaletteColors, deadAnchorTags, declarationValue, decodePrototypePathSegment, decorativeVisualAnchorTags, designQualityRepairDirective, destructiveActionControlTags, dialogTitleTexts, documentTitleText, duplicatedDesignCardCopyTexts, extractPrototypeHashRouteTarget, faqAnswerCount, faqAnswerTexts, faqBlocks, faqQuestionCount, faqQuestionTexts, featureCardBlocks, featureItemCount, firstScreenActionDescriptors, firstTopLevelHeadingIndex, fontSizePx, fontWeightValue, formFieldLabels, formFieldTags, formSignalText, formatDesignHtmlQualityFindings, fuzzyPrototypeSlugMatch, genericBreadcrumbLabel, genericBreadcrumbLabelBlocks, genericChartLabel, genericChartLabelTags, genericConversionCloseBlock, genericConversionCloseTags, genericDialogTitle, genericDialogTitleTags, genericFaqAnswer, genericFaqAnswerTags, genericFaqQuestion, genericFaqQuestionTags, genericFeatureCardDetail, genericFeatureCardDetailTags, genericFeedbackMessageCopy, genericFeedbackMessageCopyTags, genericFormFieldLabel, genericFormFieldLabelTags, genericImageAltTags, genericMetricCardLabel, genericMetricCardLabelTags, genericPortfolioProjectDetail, genericPortfolioProjectDetailTags, genericPricingPlanActionLabel, genericPricingPlanActionLabelTags, genericPricingPlanDetail, genericPricingPlanDetailTags, genericProductNavLabel, genericProductNavigationBlocks, genericRecordActionLabel, genericRecordActionLabelTags, genericRecordDiscoveryControlTags, genericRecordDiscoveryLabel, genericRecordItemLabel, genericRecordItemLabelScope, genericRecordItemLabelTags, genericRecordTableColumnLabel, genericRecordTableColumnTags, genericRecoverableStateCopy, genericRecoverableStateCopyTags, genericSectionHeadingTags, genericSettingsControlLabel, genericSettingsControlLabelTags, genericSiteFooterDetail, genericSiteFooterDetailTags, genericSiteFooterLabel, genericTabLabel, genericTabLabelTags, genericTestimonialCopyTags, genericTestimonialCopyText, genericTrustProofLabel, genericTrustProofTags, genericVanityMetricTags, genericVanityMetricText, genericWorkflowStepLabel, genericWorkflowStepLabelTags, getDesignRuntimeQualityFindings, hasActionableRecordText, hasAny, hasAssociatedLabel, hasBrandIdentity, hasBrandLandingScreenSignal, hasBrandNavigation, hasBreadcrumbContainerMetadata, hasCardLikeClass, hasCardLikeSelector, hasCenterEverythingLayout, hasChartContainerClass, hasChartDataContext, hasChartMarkClass, hasConcretePreviewDetail, hasConcreteVisualAnchorDetail, hasControlAccessibleName, hasConversionClose, hasDestructiveSafetyMarkup, hasDestructiveToneMarkup, hasDialogAccessibleName, hasDialogCloseAction, hasDialogContainerClass, hasDialogSemantics, hasFaqAnatomy, hasFeatureAnatomy, hasFeedbackMessageSignal, hasFirstScreenSupportContent, hasFixedDesktopFrame, hasFormFeedbackScript, hasFormFieldAffordance, hasGenericActionCopy, hasGenericPurpleBlueGradient, hasHashTarget, hasInteractionStateAffordance, hasInteractiveControls, hasLeadFormResponseStates, hasLocalModuleHeading, hasMetricContainerClass, hasMetricContext, hasMetricValue, hasMissingLayoutReset, hasModuleAccessibleName, hasMultiItemPrototypeNavigationWithoutCurrentState, hasNavigationCurrentState, hasNavigationLandmark, hasOneNotePalette, hasOverRoundedCardStyling, hasPortfolioProjectStructure, hasPricingStructure, hasPrimaryVisualAnchor, hasProductAppChrome, hasProductAppScreenSignal, hasPseudoListContainerClass, hasPseudoListItemClass, hasRecordAction, hasRecoverableStateClass, hasRecoverableStateSignal, hasScriptedInteraction, hasSemanticRecordStructure, hasSettingsControlSurface, hasSiblingPrototypeNavigation, hasSiteFooter, hasStateLaundryList, hasStateRecoveryAction, hasStaticLeadFormSignal, hasStaticPrimaryAction, hasStatusAffordanceMarkup, hasStatusAffordanceTag, hasTabContainerClass, hasTestimonialAttribution, hasTopLevelHeading, hasTrustProof, hasUsefulAnchorTarget, hasVisualAnchorClass, hasWeakBrandIdentity, hasWeakBrandNavigation, hasWeakColorSystem, hasWeakContentDepth, hasWeakConversionClose, hasWeakDataRealism, hasWeakFaqAnatomy, hasWeakFeatureAnatomy, hasWeakHeroViewportComposition, hasWeakPortfolioStructure, hasWeakPricingStructure, hasWeakProductAppShell, hasWeakProductPreviewDetail, hasWeakSecondaryActionPath, hasWeakSiteFooter, hasWeakSpacingSystem, hasWeakTestimonialAttribution, hasWeakTrustProof, hasWeakTypeHierarchy, hasWeakTypographyConstraints, hasWeakVisualAnchor, hasWorkflowStepContainerClass, hasWorkflowStepState, hueDistance, imageAccessibleText, inertFormTags, inlinePrototypeNavigationTargets, isBrandIdentityText, isDeadHrefTarget, isDecorativeImage, isDestructiveActionLabel, isGenericActionLabel, isGenericDocumentTitle, isGenericPageHeading, isGenericSectionHeading, isMetaPageHeading, isPageLikePrototypeTargetPath, isPrototypeBackInlineHandler, isSkippableInput, isWrappedByLabel, labelTextForInputId, largestHueClusterCount, leadFormTags, linkedSiblingPrototypeTargetCount, listItemRecordTexts, marketingFeatureSurfaceSignal, matchingSiblingScreensForPrototypeTarget, meaningfulContentModuleCount, mergeDesignHtmlQualityFindings, metricCardBlocks, metricCardLabel, missingImageAltTags, missingImageSourceTags, navigationBlocks, nestedCardLikeTags, normalizeHue, normalizePath, normalizePrototypeRouteSlug, normalizePrototypeTarget, normalizeQualityCode, normalizeRuntimeQualityFindings, normalizedActionLabel, normalizedBreadcrumbLabel, normalizedCardCopy, normalizedChartLabel, normalizedClassText, normalizedFeedbackMessageText, normalizedFormFieldLabel, normalizedHeadingText, normalizedMetricLabel, normalizedProductNavLabel, normalizedRecordDiscoveryLabel, normalizedRecordItemLabel, normalizedRecordTableColumnLabel, normalizedSettingsControlLabel, normalizedTrustProofLabel, normalizedVanityMetricText, normalizedWorkflowStepLabel, onclickAttributeValues, onsubmitAttributeValues, pairedTagMatches, parseCssColor, parseHexColor, parseHslColor, parseHslPercent, parseHueToken, parseRgbChannel, parseRgbColor, portfolioEntryCount, portfolioProjectBlocks, portfolioSurfaceSignal, pricingPlanActionLabels, pricingPlanBlocks, pricingPlanCount, pricingSurfaceSignal, primaryButtonLabels, productAppMetricCount, productAppModuleSignalCount, productNavigationLabels, prototypeExactTargetsForScreen, prototypeRouteSlugCandidates, prototypeRouteSlugsForScreen, prototypeTargetAttributeValues, prototypeTargetFromInlineHandler, prototypeTitleTokens, pseudoListContainerTags, pushFinding, radiusPx, recordActionLabels, recordDiscoveryControlArea, recordDiscoveryControlLabels, recordDiscoveryControlMarkup, recordItemBlocks, recordItemTitleLabels, rgbToHsl, runtimeQualityFindings, sectionHeadingTexts, setDesignRuntimeQualityFindings, settingsControlCount, settingsControlLabels, severityRank, shouldAutoRepairDesignHtmlFinding, siteFooterBlocks, spacingValueTokens, specificBreadcrumbLabel, specificChartLabel, specificDialogTitle, specificFeedbackMessageCopy, specificFormFieldLabel, specificProductNavLabel, specificRecordActionLabel, specificRecordDiscoveryLabel, specificRecordItemLabel, specificRecordTableColumnLabel, specificSettingsControlLabel, specificTabLabel, specificWorkflowStepLabel, stateLaundryListCount, staticHeadingTexts, statusValueLabel, stripHtmlComments, styleContent, summarizeDesignHtmlQualityDetails, summarizeDesignHtmlQualityStatus, tabControlCount, tabControlLabels, tableDataRowTexts, tableHeaderLabels, tagMatches, testimonialBlocks, testimonialQuoteTexts, textContent, textForElementId, topLevelHeadingTexts, unlabeledFieldTags, unnamedContentSectionTags, unnamedIconOnlyControlTags, visualAnchorBlocks, weakChartStructureTags, weakDestructiveActionSafetyTags, weakDialogAffordanceTags, weakFormAffordanceTags, weakLeadFormResponseTags, weakMetricContextTags, weakRecordActionTags, weakRecordDiscoveryControlTags, weakStateRecoveryActionTags, weakStatusAffordanceTags, weakTabCurrentStateTags, weakTableStructureTags, weakWorkflowStepStateTags, workflowStepItemCount, workflowStepLabels } from './helper-index'

export function auditDocumentAndStateQuality(
  input: DesignHtmlQualityAuditInput,
  ctx: DesignHtmlQualityStaticAuditContext,
  findings: DesignHtmlQualityFinding[]
): void {
  const { normalized, styles, lower, visibleText } = ctx
    if (!/<html[\s>]/i.test(normalized) || !/<\/html>\s*$/i.test(normalized.trim())) {
      pushFinding(findings, {
        code: 'incomplete-document',
        severity: 'critical',
        message: 'The artifact does not look like a complete standalone HTML document ending in </html>.',
        suggestion: 'Rewrite or finish the document so the saved file is complete, raw HTML.'
      })
    }
    const title = documentTitleText(normalized)
    if (!title) {
      pushFinding(findings, {
        code: 'missing-document-title',
        severity: 'warning',
        message: 'The HTML document has no meaningful <title>.',
        suggestion: 'Add a concise document title that names the product, brand, screen, or offer for browser tabs and handoff.'
      })
    } else if (isGenericDocumentTitle(title)) {
      pushFinding(findings, {
        code: 'generic-document-title',
        severity: 'warning',
        message: 'The HTML document title is generic or prompt-like.',
        suggestion: 'Replace the document title with a specific product, brand, screen, or offer name instead of Draft, Untitled, or page-type copy.'
      })
    }
    if (!/<meta[^>]+name=["']viewport["']/i.test(normalized)) {
      pushFinding(findings, {
        code: 'missing-viewport',
        severity: 'critical',
        message: 'The document is missing a viewport meta tag.',
        suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'
      })
    }
    if (PLACEHOLDER_RE.test(visibleText)) {
      pushFinding(findings, {
        code: 'placeholder-content',
        severity: 'warning',
        message: 'The visible copy still contains placeholder or generic sample content.',
        suggestion: 'Replace placeholders with plausible domain-specific data, labels, names, and microcopy.'
      })
    }
    if (hasTopLevelHeading(normalized) && hasStaticPrimaryAction(normalized) && hasWeakDataRealism(visibleText)) {
      pushFinding(findings, {
        code: 'weak-data-realism',
        severity: 'warning',
        message: 'The visible content lacks concrete domain data.',
        suggestion: 'Add realistic names, metrics, dates, prices, IDs, statuses, or records so the design reads as a real product screen.'
      })
    }
    if (hasStateLaundryList(visibleText)) {
      pushFinding(findings, {
        code: 'state-laundry-list',
        severity: 'warning',
        message: 'The visible copy lists state names instead of designing the states.',
        suggestion: 'Replace state-name lists with actual compact modules, banners, disabled controls, skeleton rows, empty illustrations, retry/error panels, or toast feedback.'
      })
    }
    if (weakStateRecoveryActionTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-state-recovery-action',
        severity: 'warning',
        message: 'A recoverable empty, error, offline, or permission state has no clear next action.',
        suggestion: 'Add a visible recovery action such as Retry, Clear filters, Import records, Connect source, Request access, or Contact support.'
      })
    }
    if (genericRecoverableStateCopyTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-recoverable-state-copy',
        severity: 'warning',
        message: 'A recoverable empty, error, offline, or permission state uses generic copy.',
        suggestion: 'Replace No data, Nothing here, or Something went wrong copy with the missing object, likely cause, domain-specific next step, and recovery action.'
      })
    }
    if (genericFeedbackMessageCopyTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-feedback-message-copy',
        severity: 'warning',
        message: 'A toast, alert, banner, or inline feedback message uses generic copy.',
        suggestion: 'Replace Success, Saved, Error, or Failed-only feedback with the object, action result, and next step or recovery path.'
      })
    }
    if (hasTopLevelHeading(normalized) && hasStaticPrimaryAction(normalized) && hasWeakContentDepth(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-content-depth',
        severity: 'warning',
        message: 'The page has too few meaningful content modules beyond the headline and primary action.',
        suggestion: 'Add at least two product-relevant modules such as a data table, record list, form, state panel, proof section, timeline, or settings group.'
      })
    }
    if (hasWeakProductAppShell(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-app-shell',
        severity: 'warning',
        message: 'This app-like screen has product modules but no visible product shell, navigation, or workspace chrome.',
        suggestion: 'Add product chrome such as a top bar, sidebar, nav rail, breadcrumbs, search, user/status area, or workspace switcher around the work surface.'
      })
    }
    if (genericProductNavigationBlocks(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-product-navigation',
        severity: 'warning',
        message: 'The product navigation uses generic dashboard template labels.',
        suggestion: 'Replace Dashboard, Analytics, Reports, or Settings-only navigation with domain-specific product areas, objects, queues, workflows, or saved views.'
      })
    }
    if (genericBreadcrumbLabelBlocks(normalized, visibleText, (input.siblingScreens?.length ?? 0) > 0).length > 0) {
      pushFinding(findings, {
        code: 'generic-breadcrumb-labels',
        severity: 'warning',
        message: 'A breadcrumb or page path uses generic template labels.',
        suggestion: 'Replace Home, Dashboard, Details, or Page 1-only trails with product areas, objects, record names, IDs, or workflow stages.'
      })
    }
    if (hasWeakBrandNavigation(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-brand-navigation',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page has no branded header or section navigation.',
        suggestion: 'Add a branded header/nav with logo or wordmark, links to key sections, and a visible primary action.'
      })
    }
    if (hasWeakBrandIdentity(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-brand-identity',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page has navigation but no visible brand or product identity.',
        suggestion: 'Add a visible wordmark, logo, product name, or named creator/place in the header or first viewport so the page feels specific.'
      })
    }
    if (hasWeakSecondaryActionPath(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-secondary-action-path',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing first screen has no clear secondary action path.',
        suggestion: 'Pair the primary CTA with a distinct secondary action such as View demo, See features, Read case study, Compare plans, or Contact sales.'
      })
    }
    if (hasWeakPortfolioStructure(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-portfolio-structure',
        severity: 'warning',
        message: 'This portfolio or case-study page lacks concrete project entries and outcome details.',
        suggestion: 'Add real project/case-study cards with client, role/category, timeline or year, visual, outcome metric, and detail CTAs.'
      })
    }
    if (genericPortfolioProjectDetailTags(normalized, visibleText).length >= 2) {
      pushFinding(findings, {
        code: 'generic-portfolio-project-detail',
        severity: 'warning',
        message: 'Several portfolio or case-study entries use placeholder project or client labels.',
        suggestion: 'Replace Project One, Client A, or Case Study placeholders with realistic project names, client names, roles, timelines, visuals, and outcome metrics.'
      })
    }
    if (hasWeakVisualAnchor(normalized, styles, visibleText)) {
      pushFinding(findings, {
        code: 'weak-visual-anchor',
        severity: 'warning',
        message: 'This brand, landing, portfolio, pricing, or marketing page has no strong visual anchor.',
        suggestion: 'Add a real product preview, screenshot, image, gallery, media-led hero, or clearly designed mockup that shows the product or offer.'
      })
    }
    if (hasWeakProductPreviewDetail(normalized, visibleText)) {
      pushFinding(findings, {
        code: 'weak-product-preview-detail',
        severity: 'warning',
        message: 'A product preview, mockup, or media panel is only an empty framed shell.',
        suggestion: 'Fill previews with real media or concrete UI/data details such as dashboard rows, metrics, statuses, screenshots, or labeled controls.'
      })
    }
    if (decorativeVisualAnchorTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'decorative-visual-anchor',
        severity: 'warning',
        message: 'A primary visual anchor is only abstract decoration.',
        suggestion: 'Replace abstract blobs, orbs, gradients, or decorative SVG shapes with a product screenshot, media asset, gallery image, or concrete UI mockup with real labels and data.'
      })
    }
}
