import type { DesignHtmlQualityAuditInput, DesignHtmlQualityFinding } from './types'
import type { DesignHtmlQualityStaticAuditContext } from './static-audit-types'
import { ACTIONABLE_RECORD_TEXT_RE, AI_GRADIENT_COLOR_RE, BODY_TEXT_SELECTOR_RE, BRAND_IDENTITY_CLASS_RE, BRAND_LANDING_SCREEN_RE, BRAND_NAME_LIKE_RE, BRAND_NAV_CLASS_RE, BREADCRUMB_CONTAINER_RE, CHART_CONTAINER_CLASS_RE, CHART_MARK_CLASS_RE, COLOR_LITERAL_RE, CONCRETE_CONVERSION_CLOSE_CONTEXT_RE, CONCRETE_DATA_PATTERNS, CONCRETE_FAQ_DETAIL_RE, CONCRETE_FAQ_QUESTION_RE, CONCRETE_FEATURE_DETAIL_RE, CONCRETE_METRIC_SPECIFICITY_RE, CONCRETE_PRICING_PLAN_DETAIL_RE, CONCRETE_TESTIMONIAL_CONTEXT_RE, CONVERSION_CLOSE_CLASS_RE, CONVERSION_CLOSE_TEXT_RE, CREAM_BACKGROUND_RE, CSS_CUSTOM_PROPERTY_RE, CSS_RULE_BLOCK_RE, DECORATIVE_VISUAL_ANCHOR_RE, DESIGN_ITEM_CARD_CLASS_RE, DESTRUCTIVE_ACTION_LABEL_RE, DESTRUCTIVE_SAFETY_MARKUP_RE, DESTRUCTIVE_TONE_MARKUP_RE, DIALOG_CLOSE_LABEL_RE, DIALOG_CONTAINER_CLASS_RE, EMOJI_RE, FAQ_QUESTION_RE, FAQ_SECTION_RE, FEATURE_DETAIL_RE, FEATURE_ITEM_CLASS_RE, FEATURE_SECTION_RE, FEEDBACK_MESSAGE_CLASS_RE, FEEDBACK_MESSAGE_CONTEXT_RE, FIXED_DESKTOP_FRAME_RE, FLUID_MEDIA_RULE_RE, FORM_FIELD_AFFORDANCE_RE, GENERIC_ACTION_LABEL_RE, GENERIC_BRAND_IDENTITY_LABEL_RE, GENERIC_BREADCRUMB_LABEL_RE, GENERIC_CHART_LABEL_RE, GENERIC_CONVERSION_CLOSE_COPY_RE, GENERIC_CONVERSION_CLOSE_HEADING_RE, GENERIC_DIALOG_TITLE_RE, GENERIC_DOCUMENT_TITLE_RE, GENERIC_FAQ_ANSWER_RE, GENERIC_FAQ_QUESTION_RE, GENERIC_FEATURE_DETAIL_RE, GENERIC_FEATURE_TITLE_RE, GENERIC_FEEDBACK_MESSAGE_RE, GENERIC_FORM_FIELD_LABEL_RE, GENERIC_IMAGE_ALT_RE, GENERIC_METRIC_LABEL_RE, GENERIC_PAGE_HEADING_RE, GENERIC_PORTFOLIO_PROJECT_RE, GENERIC_PRICING_PLAN_ACTION_RE, GENERIC_PRICING_PLAN_DETAIL_RE, GENERIC_PRODUCT_NAV_LABEL_RE, GENERIC_RECORD_ACTION_LABEL_RE, GENERIC_RECORD_DISCOVERY_LABEL_RE, GENERIC_RECORD_ITEM_LABEL_RE, GENERIC_RECORD_TABLE_COLUMN_LABEL_RE, GENERIC_RECOVERABLE_STATE_COPY_RE, GENERIC_SECTION_HEADING_RE, GENERIC_SETTINGS_CONTROL_LABEL_RE, GENERIC_SITE_FOOTER_LABEL_RE, GENERIC_TAB_LABEL_RE, GENERIC_TESTIMONIAL_COPY_RE, GENERIC_TRUST_PROOF_LABEL_RE, GENERIC_VANITY_METRIC_RE, GENERIC_WORKFLOW_STEP_LABEL_RE, GLOBAL_BOX_SIZING_RE, HEADING_SELECTOR_RE, HERO_VIEWPORT_LOCK_RE, LEAD_FORM_ERROR_RE, LEAD_FORM_LOADING_RE, LEAD_FORM_SIGNAL_RE, LEAD_FORM_SUCCESS_RE, MARKETING_FEATURE_SURFACE_RE, META_PAGE_HEADING_RE, METRIC_CONTAINER_CLASS_RE, METRIC_CONTEXT_RE, NEGATIVE_LETTER_SPACING_RE, PLACEHOLDER_RE, PORTFOLIO_BUILDER_RE, PORTFOLIO_DETAIL_ACTION_RE, PORTFOLIO_ENTRY_CLASS_RE, PORTFOLIO_OUTCOME_RE, PORTFOLIO_SURFACE_RE, PRICING_ACTION_RE, PRICING_CADENCE_RE, PRICING_FEATURE_RE, PRICING_PLAN_CLASS_RE, PRICING_PRICE_GLOBAL_RE, PRICING_PRICE_RE, PRICING_RECOMMENDATION_RE, PRICING_SURFACE_RE, PRODUCT_APP_CHROME_CLASS_RE, PRODUCT_APP_SCREEN_RE, PRODUCT_NAV_DOMAIN_LABEL_RE, PROTOTYPE_NAV_HASH_PREFIX, PSEUDO_LIST_CONTAINER_CLASS_RE, PSEUDO_LIST_ITEM_CLASS_RE, RECORD_DISCOVERY_CONTROL_RE, RECORD_DISCOVERY_MARKUP_RE, RECOVERABLE_STATE_CONTEXT_RE, RECOVERABLE_STATE_HEADING_RE, RECOVERABLE_STATE_TEXT_RE, SETTINGS_CONTROL_SURFACE_RE, SITE_FOOTER_CLASS_RE, SITE_FOOTER_TEXT_RE, SPACING_DECLARATION_RE, SPACING_TOKEN_RE, SPECIFIC_BREADCRUMB_LABEL_RE, SPECIFIC_CHART_LABEL_RE, SPECIFIC_DIALOG_TITLE_RE, SPECIFIC_FORM_FIELD_LABEL_RE, SPECIFIC_METRIC_LABEL_RE, SPECIFIC_RECORD_ACTION_LABEL_RE, SPECIFIC_RECORD_DISCOVERY_LABEL_RE, SPECIFIC_RECORD_ITEM_LABEL_RE, SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE, SPECIFIC_SETTINGS_CONTROL_LABEL_RE, SPECIFIC_TAB_LABEL_RE, SPECIFIC_WORKFLOW_STEP_LABEL_RE, STATE_LAUNDRY_LIST_RE, STATE_MODULE_CLASS_RE, STATUS_AFFORDANCE_ATTRIBUTE_RE, STATUS_AFFORDANCE_CLASS_RE, STATUS_AFFORDANCE_STYLE_RE, STATUS_VALUE_ONLY_RE, STRONG_BRAND_LANDING_SCREEN_RE, STRONG_CONVERSION_CLOSE_TEXT_RE, TAB_CONTAINER_CLASS_RE, TESTIMONIAL_ATTRIBUTION_RE, TESTIMONIAL_CLASS_RE, TRUST_PROOF_CLASS_RE, TRUST_PROOF_TEXT_RE, UNBOUNDED_VIEWPORT_FONT_RE, VAGUE_TEMPLATE_COPY_PATTERNS, VANITY_METRIC_CONTAINER_RE, VIEWPORT_LOCK_RE, VISUAL_ANCHOR_CLASS_RE, VISUAL_ANCHOR_STYLE_RE, VISUAL_MEDIA_TAG_RE, WORKFLOW_STEP_CONTAINER_CLASS_RE, WORKFLOW_STEP_ITEM_CLASS_RE, WORKFLOW_STEP_STATE_RE, actionableRecordCount, attributeValue, attributeValues, breadcrumbBlocks, breadcrumbLabels, buildDesignHtmlQualityRepairPrompt, chartLabelTexts, chartLikeBlocks, chartMarkCount, clearDesignRuntimeQualityFindings, colorLiteralCount, concreteDataSignalCount, concreteFaqQuestion, contentForDataRealism, controlLabel, conversionCloseBlocks, countEmoji, countPatternHits, cssPaletteColors, deadAnchorTags, declarationValue, decodePrototypePathSegment, decorativeVisualAnchorTags, designQualityRepairDirective, destructiveActionControlTags, dialogTitleTexts, documentTitleText, duplicatedDesignCardCopyTexts, extractPrototypeHashRouteTarget, faqAnswerCount, faqAnswerTexts, faqBlocks, faqQuestionCount, faqQuestionTexts, featureCardBlocks, featureItemCount, firstScreenActionDescriptors, firstTopLevelHeadingIndex, fontSizePx, fontWeightValue, formFieldLabels, formFieldTags, formSignalText, formatDesignHtmlQualityFindings, fuzzyPrototypeSlugMatch, genericBreadcrumbLabel, genericBreadcrumbLabelBlocks, genericChartLabel, genericChartLabelTags, genericConversionCloseBlock, genericConversionCloseTags, genericDialogTitle, genericDialogTitleTags, genericFaqAnswer, genericFaqAnswerTags, genericFaqQuestion, genericFaqQuestionTags, genericFeatureCardDetail, genericFeatureCardDetailTags, genericFeedbackMessageCopy, genericFeedbackMessageCopyTags, genericFormFieldLabel, genericFormFieldLabelTags, genericImageAltTags, genericMetricCardLabel, genericMetricCardLabelTags, genericPortfolioProjectDetail, genericPortfolioProjectDetailTags, genericPricingPlanActionLabel, genericPricingPlanActionLabelTags, genericPricingPlanDetail, genericPricingPlanDetailTags, genericProductNavLabel, genericProductNavigationBlocks, genericRecordActionLabel, genericRecordActionLabelTags, genericRecordDiscoveryControlTags, genericRecordDiscoveryLabel, genericRecordItemLabel, genericRecordItemLabelScope, genericRecordItemLabelTags, genericRecordTableColumnLabel, genericRecordTableColumnTags, genericRecoverableStateCopy, genericRecoverableStateCopyTags, genericSectionHeadingTags, genericSettingsControlLabel, genericSettingsControlLabelTags, genericSiteFooterDetail, genericSiteFooterDetailTags, genericSiteFooterLabel, genericTabLabel, genericTabLabelTags, genericTestimonialCopyTags, genericTestimonialCopyText, genericTrustProofLabel, genericTrustProofTags, genericVanityMetricTags, genericVanityMetricText, genericWorkflowStepLabel, genericWorkflowStepLabelTags, getDesignRuntimeQualityFindings, hasActionableRecordText, hasAny, hasAssociatedLabel, hasBrandIdentity, hasBrandLandingScreenSignal, hasBrandNavigation, hasBreadcrumbContainerMetadata, hasCardLikeClass, hasCardLikeSelector, hasCenterEverythingLayout, hasChartContainerClass, hasChartDataContext, hasChartMarkClass, hasConcretePreviewDetail, hasConcreteVisualAnchorDetail, hasControlAccessibleName, hasConversionClose, hasDestructiveSafetyMarkup, hasDestructiveToneMarkup, hasDialogAccessibleName, hasDialogCloseAction, hasDialogContainerClass, hasDialogSemantics, hasFaqAnatomy, hasFeatureAnatomy, hasFeedbackMessageSignal, hasFirstScreenSupportContent, hasFixedDesktopFrame, hasFormFeedbackScript, hasFormFieldAffordance, hasGenericActionCopy, hasGenericPurpleBlueGradient, hasHashTarget, hasInteractionStateAffordance, hasInteractiveControls, hasLeadFormResponseStates, hasLocalModuleHeading, hasMetricContainerClass, hasMetricContext, hasMetricValue, hasMissingLayoutReset, hasModuleAccessibleName, hasMultiItemPrototypeNavigationWithoutCurrentState, hasNavigationCurrentState, hasNavigationLandmark, hasOneNotePalette, hasOverRoundedCardStyling, hasPortfolioProjectStructure, hasPricingStructure, hasPrimaryVisualAnchor, hasProductAppChrome, hasProductAppScreenSignal, hasPseudoListContainerClass, hasPseudoListItemClass, hasRecordAction, hasRecoverableStateClass, hasRecoverableStateSignal, hasScriptedInteraction, hasSemanticRecordStructure, hasSettingsControlSurface, hasSiblingPrototypeNavigation, hasSiteFooter, hasStateLaundryList, hasStateRecoveryAction, hasStaticLeadFormSignal, hasStaticPrimaryAction, hasStatusAffordanceMarkup, hasStatusAffordanceTag, hasTabContainerClass, hasTestimonialAttribution, hasTopLevelHeading, hasTrustProof, hasUsefulAnchorTarget, hasVisualAnchorClass, hasWeakBrandIdentity, hasWeakBrandNavigation, hasWeakColorSystem, hasWeakContentDepth, hasWeakConversionClose, hasWeakDataRealism, hasWeakFaqAnatomy, hasWeakFeatureAnatomy, hasWeakHeroViewportComposition, hasWeakPortfolioStructure, hasWeakPricingStructure, hasWeakProductAppShell, hasWeakProductPreviewDetail, hasWeakSecondaryActionPath, hasWeakSiteFooter, hasWeakSpacingSystem, hasWeakTestimonialAttribution, hasWeakTrustProof, hasWeakTypeHierarchy, hasWeakTypographyConstraints, hasWeakVisualAnchor, hasWorkflowStepContainerClass, hasWorkflowStepState, hueDistance, imageAccessibleText, inertFormTags, inlinePrototypeNavigationTargets, isBrandIdentityText, isDeadHrefTarget, isDecorativeImage, isDestructiveActionLabel, isGenericActionLabel, isGenericDocumentTitle, isGenericPageHeading, isGenericSectionHeading, isMetaPageHeading, isPageLikePrototypeTargetPath, isPrototypeBackInlineHandler, isSkippableInput, isWrappedByLabel, labelTextForInputId, largestHueClusterCount, leadFormTags, linkedSiblingPrototypeTargetCount, listItemRecordTexts, marketingFeatureSurfaceSignal, matchingSiblingScreensForPrototypeTarget, meaningfulContentModuleCount, mergeDesignHtmlQualityFindings, metricCardBlocks, metricCardLabel, missingImageAltTags, missingImageSourceTags, navigationBlocks, nestedCardLikeTags, normalizeHue, normalizePath, normalizePrototypeRouteSlug, normalizePrototypeTarget, normalizeQualityCode, normalizeRuntimeQualityFindings, normalizedActionLabel, normalizedBreadcrumbLabel, normalizedCardCopy, normalizedChartLabel, normalizedClassText, normalizedFeedbackMessageText, normalizedFormFieldLabel, normalizedHeadingText, normalizedMetricLabel, normalizedProductNavLabel, normalizedRecordDiscoveryLabel, normalizedRecordItemLabel, normalizedRecordTableColumnLabel, normalizedSettingsControlLabel, normalizedTrustProofLabel, normalizedVanityMetricText, normalizedWorkflowStepLabel, onclickAttributeValues, onsubmitAttributeValues, pairedTagMatches, parseCssColor, parseHexColor, parseHslColor, parseHslPercent, parseHueToken, parseRgbChannel, parseRgbColor, portfolioEntryCount, portfolioProjectBlocks, portfolioSurfaceSignal, pricingPlanActionLabels, pricingPlanBlocks, pricingPlanCount, pricingSurfaceSignal, primaryButtonLabels, productAppMetricCount, productAppModuleSignalCount, productNavigationLabels, prototypeExactTargetsForScreen, prototypeRouteSlugCandidates, prototypeRouteSlugsForScreen, prototypeTargetAttributeValues, prototypeTargetFromInlineHandler, prototypeTitleTokens, pseudoListContainerTags, pushFinding, radiusPx, recordActionLabels, recordDiscoveryControlArea, recordDiscoveryControlLabels, recordDiscoveryControlMarkup, recordItemBlocks, recordItemTitleLabels, rgbToHsl, runtimeQualityFindings, sectionHeadingTexts, setDesignRuntimeQualityFindings, settingsControlCount, settingsControlLabels, severityRank, shouldAutoRepairDesignHtmlFinding, siteFooterBlocks, spacingValueTokens, specificBreadcrumbLabel, specificChartLabel, specificDialogTitle, specificFeedbackMessageCopy, specificFormFieldLabel, specificProductNavLabel, specificRecordActionLabel, specificRecordDiscoveryLabel, specificRecordItemLabel, specificRecordTableColumnLabel, specificSettingsControlLabel, specificTabLabel, specificWorkflowStepLabel, stateLaundryListCount, staticHeadingTexts, statusValueLabel, stripHtmlComments, styleContent, summarizeDesignHtmlQualityDetails, summarizeDesignHtmlQualityStatus, tabControlCount, tabControlLabels, tableDataRowTexts, tableHeaderLabels, tagMatches, testimonialBlocks, testimonialQuoteTexts, textContent, textForElementId, topLevelHeadingTexts, unlabeledFieldTags, unnamedContentSectionTags, unnamedIconOnlyControlTags, visualAnchorBlocks, weakChartStructureTags, weakDestructiveActionSafetyTags, weakDialogAffordanceTags, weakFormAffordanceTags, weakLeadFormResponseTags, weakMetricContextTags, weakRecordActionTags, weakRecordDiscoveryControlTags, weakStateRecoveryActionTags, weakStatusAffordanceTags, weakTabCurrentStateTags, weakTableStructureTags, weakWorkflowStepStateTags, workflowStepItemCount, workflowStepLabels } from './helper-index'

export function auditAccessibilityAndPrototypeQuality(
  input: DesignHtmlQualityAuditInput,
  ctx: DesignHtmlQualityStaticAuditContext,
  findings: DesignHtmlQualityFinding[]
): void {
  const { normalized, styles, lower, visibleText } = ctx
    if (weakLeadFormResponseTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'weak-lead-form-response',
        severity: 'warning',
        message: 'A marketing lead form lacks visible loading, success, and error feedback states.',
        suggestion: 'Add submitting/loading, success/confirmation, and error/validation feedback states for contact, demo, signup, waitlist, or newsletter forms.'
      })
    }
    if (genericFormFieldLabelTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-form-field-labels',
        severity: 'warning',
        message: 'A lead or product form uses generic field labels.',
        suggestion: 'Replace Name, Email, Message, or Details-only fields with labels tied to the requested business information, use case, timeline, budget, volume, or workflow.'
      })
    }
    if (genericSettingsControlLabelTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-settings-control-labels',
        severity: 'warning',
        message: 'A settings, permissions, or preferences control group uses generic labels.',
        suggestion: 'Replace Option 1, Enable, Notifications, or Setting-only toggles with labels that name the controlled object, effect, audience, or workflow.'
      })
    }
    const unnamedIconControls = unnamedIconOnlyControlTags(normalized)
    if (unnamedIconControls.length > 0) {
      pushFinding(findings, {
        code: 'unnamed-icon-controls',
        severity: 'warning',
        message: 'Some icon-only buttons or links have no accessible name.',
        suggestion: 'Add visible text, screen-reader-only text, aria-label, aria-labelledby, or title for every icon-only control.'
      })
    }
    const missingImageSources = missingImageSourceTags(normalized)
    if (missingImageSources.length > 0) {
      pushFinding(findings, {
        code: 'missing-image-source',
        severity: 'warning',
        message: 'Some image elements have empty, "#", or javascript-only sources.',
        suggestion: 'Use real workspace-relative image paths, embedded data URLs, or replace missing images with designed CSS/SVG placeholders that carry meaningful labels.'
      })
    }
    const missingImageAlts = missingImageAltTags(normalized)
    if (missingImageAlts.length > 0) {
      pushFinding(findings, {
        code: 'missing-image-alt',
        severity: 'warning',
        message: 'Some non-decorative images have no accessible description.',
        suggestion: 'Add meaningful alt text or mark purely decorative images with alt="", aria-hidden="true", or role="presentation".'
      })
    }
    const genericImageAlts = genericImageAltTags(normalized)
    if (genericImageAlts.length > 0) {
      pushFinding(findings, {
        code: 'generic-image-alt',
        severity: 'warning',
        message: 'Some image descriptions are generic and do not describe the actual content.',
        suggestion: 'Replace generic alt text such as Image, Screenshot, or Product preview with the product, person, place, screen, or content shown.'
      })
    }
    const inertForms = inertFormTags(normalized)
    if (inertForms.length > 0) {
      pushFinding(findings, {
        code: 'inert-form-submission',
        severity: 'warning',
        message: 'Some forms have no detectable submit destination or local feedback.',
        suggestion: 'Add a real action/formaction, data-prototype-target/data-href, onsubmit handler, or scripted prototype feedback such as validation, loading, success, error, or toast states.'
      })
    }
    if (!hasSiblingPrototypeNavigation(normalized, input.siblingScreens)) {
      pushFinding(findings, {
        code: 'missing-prototype-navigation',
        severity: 'warning',
        message: 'This multi-screen project page does not link to any sibling screen.',
        suggestion: 'Add clickable prototype routes for relevant nav items, tabs, cards, or CTAs using `<a href>`, `data-href`, `data-prototype-href`, or `data-prototype-target` with the provided hrefs or exact screen titles; use history.back() only for Back/Previous controls.'
      })
    }
    if ((input.siblingScreens?.length ?? 0) >= 2 && linkedSiblingPrototypeTargetCount(normalized, input.siblingScreens) < 2) {
      pushFinding(findings, {
        code: 'weak-prototype-navigation-coverage',
        severity: 'warning',
        message: 'This multi-screen project page links to only one sibling screen.',
        suggestion: 'Add prototype links to multiple relevant sibling pages in the nav, tabs, breadcrumbs, cards, or primary/secondary actions using `<a href>`, `data-href`, `data-prototype-href`, or `data-prototype-target` so the project can be browsed as a connected prototype.'
      })
    }
    if ((input.siblingScreens?.length ?? 0) > 0 && !hasNavigationLandmark(normalized)) {
      pushFinding(findings, {
        code: 'missing-navigation-landmark',
        severity: 'warning',
        message: 'This multi-screen project page has no navigation landmark.',
        suggestion: 'Add a consistent nav, tabs, breadcrumb, or page switcher with real prototype routes to related screens.'
      })
    }
    if ((input.siblingScreens?.length ?? 0) > 0 && hasMultiItemPrototypeNavigationWithoutCurrentState(normalized)) {
      pushFinding(findings, {
        code: 'missing-navigation-current-state',
        severity: 'warning',
        message: 'This multi-screen navigation has no visible or accessible current-page state.',
        suggestion: 'Mark the current page, tab, or breadcrumb with aria-current, aria-selected, data-state="active", or a visible active/current style.'
      })
    }
    if (weakTabCurrentStateTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-tab-current-state',
        severity: 'warning',
        message: 'A tab, segmented control, or view switcher has no visible or accessible selected state.',
        suggestion: 'Mark the active tab with aria-selected, aria-current, data-state="active", or a visible active/current/selected style.'
      })
    }
    if (genericTabLabelTags(normalized, visibleText).length > 0) {
      pushFinding(findings, {
        code: 'generic-tab-labels',
        severity: 'warning',
        message: 'A tab, segmented control, or view switcher uses generic tab labels.',
        suggestion: 'Replace Overview, Details, Settings, or Tab 1 labels with domain-specific views, queues, objects, or workflow stages.'
      })
    }
    if (weakWorkflowStepStateTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'weak-workflow-step-state',
        severity: 'warning',
        message: 'A multi-step workflow, stepper, timeline, or process has no current, completed, or upcoming step state.',
        suggestion: 'Mark workflow steps with current/completed/upcoming state using aria-current, data-state/status, progressbar values, or visible active/completed/pending styling.'
      })
    }
    if (genericWorkflowStepLabelTags(normalized).length > 0) {
      pushFinding(findings, {
        code: 'generic-workflow-step-labels',
        severity: 'warning',
        message: 'A multi-step workflow, stepper, timeline, or process uses generic step labels.',
        suggestion: 'Replace Step 1, Step 2, or Phase 3 labels with domain-specific actions, milestones, objects, or decisions in the flow.'
      })
    }
    if (!hasAny(lower, [/\bempty\b/, /\bloading\b/, /\berror\b/, /\bdisabled\b/, /\bskeleton\b/, /\boffline\b/, /aria-busy/])) {
      pushFinding(findings, {
        code: 'missing-ui-states',
        severity: 'info',
        message: 'The artifact does not mention common product states such as empty, loading, error, disabled, or offline.',
        suggestion: 'Represent the states that matter for this screen, visually or as compact inline modules.'
      })
    }
    if (!/<(main|header|nav|section|article|footer)\b/i.test(normalized)) {
      pushFinding(findings, {
        code: 'weak-semantic-structure',
        severity: 'info',
        message: 'The document lacks common semantic layout elements.',
        suggestion: 'Use semantic regions such as header, nav, main, section, article, and footer.'
      })
    }
    const notes = (input.designNotes ?? '').trim()
    if (notes) {
      const notesLower = notes.toLowerCase()
      if (!hasAny(notesLower, [/\bstate/, /\bempty\b/, /\bloading\b/, /\berror\b/, /\bdisabled\b/])) {
        pushFinding(findings, {
          code: 'notes-missing-states',
          severity: 'info',
          message: 'DESIGN.md does not describe key UI states.',
          suggestion: 'Update DESIGN.md with the page states and how they should be implemented.'
        })
      }
      if (!hasAny(notesLower, [/\b(?:page|screen|view|surface)\s+role\b/, /\bpurpose\b/, /\bgoal\b/, /\baudience\b/, /\bprimary action\b/, /\buser intent\b/, /\bworkflow\b/])) {
        pushFinding(findings, {
          code: 'notes-missing-page-role',
          severity: 'info',
          message: 'DESIGN.md does not describe the page role or user goal.',
          suggestion: 'Update DESIGN.md with the page/screen role, target user, primary goal, and primary action.'
        })
      }
      if (!hasAny(notesLower, [/\bresponsive\b/, /\bmobile\b/, /\btablet\b/, /\bdesktop\b/, /\bbreakpoint\b/])) {
        pushFinding(findings, {
          code: 'notes-missing-responsive',
          severity: 'info',
          message: 'DESIGN.md does not describe responsive behavior.',
          suggestion: 'Update DESIGN.md with the intended mobile, tablet, and desktop behavior.'
        })
      }
      if (!hasAny(notesLower, [/\binteraction/, /\bprototype\b/, /\bnavigation\b/, /\bcta\b/, /\blink\b/, /\bhover\b/, /\bfocus\b/, /\bexpand\b/, /\bfilter\b/, /\bsubmit\b/, /\btoast\b/])) {
        pushFinding(findings, {
          code: 'notes-missing-interactions',
          severity: 'info',
          message: 'DESIGN.md does not describe key interactions or prototype behavior.',
          suggestion: 'Update DESIGN.md with primary/secondary actions, navigation links, local feedback, and any hover/focus/disabled behavior.'
        })
      }
      if (!hasAny(notesLower, [/\btoken/, /\bcomponent/, /\bpalette\b/, /\bcolor\b/, /\btypography\b/, /\bspacing\b/, /\bradius\b/, /\bshadow\b/])) {
        pushFinding(findings, {
          code: 'notes-missing-tokens',
          severity: 'info',
          message: 'DESIGN.md does not mention the tokens or components used.',
          suggestion: 'Update DESIGN.md with the palette, typography, spacing/radius decisions, and reusable components that implementation should preserve.'
        })
      }
      if (!hasAny(notesLower, [/\bimplementation\b/, /\bhandoff\b/, /\bbuild\b/, /\bdeveloper\b/, /\bengineering\b/, /\bassets?\b/, /\bdata\b/, /\bcontent\b/, /\bbehavior\b/, /\bcomponent contract\b/])) {
        pushFinding(findings, {
          code: 'notes-missing-implementation-notes',
          severity: 'info',
          message: 'DESIGN.md does not include implementation or handoff notes.',
          suggestion: 'Update DESIGN.md with implementation notes such as component structure, assets, data assumptions, and behavior details.'
        })
      }
    }
}
