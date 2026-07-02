import { DESIGN_RESIZE_RESPONSIVE_LINES } from './design-context'

export type DesignHtmlQualitySeverity = 'critical' | 'warning' | 'info'

export type DesignHtmlQualityFinding = {
  code: string
  severity: DesignHtmlQualitySeverity
  message: string
  suggestion: string
}

export type DesignRuntimeQualityPayload = {
  artifactId: string
  artifactRelativePath: string
  shapeId?: string
  findings: DesignHtmlQualityFinding[]
}

export type DesignHtmlQualityStatus =
  | { kind: 'checking'; label: string; title: string; count: 0 }
  | { kind: 'passed'; label: string; title: string; count: 0 }
  | { kind: 'warning'; label: string; title: string; count: number }
  | { kind: 'critical'; label: string; title: string; count: number }

export type DesignHtmlQualityDetails = {
  heading: string
  body: string
  rows: DesignHtmlQualityFinding[]
  overflowCount: number
}

export type DesignHtmlQualityAuditSibling = {
  name?: string
  htmlPath: string
  prototypeHref?: string
}

export type DesignHtmlQualityAuditInput = {
  html: string
  designNotes?: string
  siblingScreens?: DesignHtmlQualityAuditSibling[]
}

type ParsedCssColor = {
  h: number
  s: number
  l: number
}

const PLACEHOLDER_RE =
  /\b(lorem ipsum|placeholder|todo|tbd|sample data|example (card|title|user|company|product)|card title|feature [0-9]+|item [0-9]+|user name|your company|product name)\b/i
const GENERIC_IMAGE_ALT_RE =
  /^(?:app )?(?:image|photo|picture|graphic|illustration|screenshot|screen shot|preview|mockup|hero image|hero visual|product image|product screenshot|product preview|dashboard screenshot|customer photo|team photo|placeholder image)$/i
const GENERIC_DOCUMENT_TITLE_RE =
  /^(?:untitled|draft|new page|page|website|site|homepage|home page|landing page|marketing site|brand site|portfolio|pricing page|plans page|product page|demo|test|preview)$/i
const AI_GRADIENT_COLOR_RE =
  /#(?:4f46e5|6366f1|7c3aed|8b5cf6|9333ea|a855f7|2563eb|3b82f6)\b|\b(?:purple|violet|indigo|blue)\b/gi
const CREAM_BACKGROUND_RE =
  /(body|html|\.app|\.page|\.container|main)\s*{[^}]*background(?:-color)?\s*:\s*(#(fff7ed|fffbeb|fdf6e3|faf7f0|f8f4ed|f5efe6|f4eadc)|rgb\(\s*(24[0-9]|25[0-5])\s*,\s*(23[0-9]|24[0-9]|25[0-5])\s*,\s*(21[0-9]|22[0-9]|23[0-9])\s*\)|\b(cream|beige|sand|linen|papayawhip|oldlace|antiquewhite)\b)/i
const COLOR_LITERAL_RE =
  /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi
const CSS_CUSTOM_PROPERTY_RE =
  /--[a-z0-9-]+\s*:/i
const GLOBAL_BOX_SIZING_RE =
  /(?:^|[}\s>])(?:\*|html|body|:root|:where\([^)]*\))[^{]{0,160}{[^}]*\bbox-sizing\s*:\s*(?:border-box|inherit)\b/i
const FLUID_MEDIA_RULE_RE =
  /\b(?:img|picture|video|canvas|svg|iframe)\b[^{]{0,160}{[^}]*(?:max-width\s*:\s*100%|width\s*:\s*100%)/i
const VISUAL_MEDIA_TAG_RE =
  /<(?:img|picture|video|iframe|canvas)\b/i
const SPACING_DECLARATION_RE =
  /\b(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*([^;{}]+)/gi
const SPACING_TOKEN_RE =
  /--(?:space|spacing|gap|pad|margin)[a-z0-9-]*\s*:/i
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu
const VAGUE_TEMPLATE_COPY_PATTERNS = [
  /\btransform (your|the) (workflow|business|team|experience)\b/i,
  /\bunleash (your|the)? ?(creative )?potential\b/i,
  /\b(all[- ]in[- ]one|one[- ]stop) (platform|solution|toolkit|workspace)\b/i,
  /\b(powerful|innovative|cutting[- ]edge) (platform|solution|tools|experience)\b/i,
  /\bseamless (experience|workflow|collaboration|integration)\b/i,
  /\bdesigned for modern teams\b/i,
  /\belevate your (business|brand|workflow|experience)\b/i,
  /\bstreamline (your|the) (workflow|operations|process)\b/i,
  /\bboost (productivity|efficiency|growth)\b/i,
  /\beverything you need\b/i,
  /\brevolutioni[sz]e (your|the) (workflow|business|industry|experience)\b/i,
  /\bnext[- ]generation (platform|solution|experience|tools)\b/i
] as const
const GENERIC_PAGE_HEADING_RE =
  /^(welcome|dashboard|overview|home|settings|profile|analytics|reports?|projects?|tasks?|messages?|help( center)?|admin|workspace|landing page|main page|get started|welcome back)$/i
const GENERIC_SECTION_HEADING_RE =
  /^(?:about(?: us)?|benefits?|capabilit(?:y|ies)|case stud(?:y|ies)|customers?|faq|features?|frequently asked questions|how it works|our (?:services|work)|pricing|plans?|reviews?|services?|solutions?|testimonials?|what we do|why choose us)$/i
const META_PAGE_HEADING_RE =
  /\b(?:(?:landing|marketing|brand|portfolio|pricing|plans?|product|home(?:page)?|case[- ]stud(?:y|ies)|features?)\s+(?:page|site|website)|(?:page|site|website))\s+(?:for|about|to)\b/i
const GENERIC_ACTION_LABEL_RE =
  /^(start|get started|start now|learn more|submit|continue|next|explore|open|view|click here|try now|sign up|join|begin|go)$/i
const PRODUCT_APP_SCREEN_RE =
  /\b(?:admin|analytics|approval queue|approvals?|billing|calendar|console|crm|dashboard|invoices?|kanban|messages?|orders?|portal|projects?|queue|records?|reports?|settings|tickets?|tasks?|workspace|workbench)\b/i
const PRODUCT_APP_CHROME_CLASS_RE =
  /\b(?:app[- ]shell|shell|sidebar|side[- ]nav|sidenav|nav[- ]rail|rail|topbar|top[- ]bar|navbar|nav[- ]bar|global[- ]nav|workspace[- ]nav|breadcrumbs?|command[- ]bar|utility[- ]bar)\b/i
const GENERIC_PRODUCT_NAV_LABEL_RE =
  /^(?:activity|admin|analytics|calendar|dashboard|help|home|insights?|messages?|notifications?|overview|profile|projects?|reports?|settings|tasks?|team|users?|workspace)$/i
const PRODUCT_NAV_DOMAIN_LABEL_RE =
  /\b(?:account|approval|asset|booking|campaign|case|claim|client|contract|crew|customer|deployment|dispatch|handoff|incident|inventory|invoice|job|lead|member|order|patient|payment|payout|policy|proposal|record|release|renewal|request|risk|route|shipment|shift|supplier|ticket|vendor|warehouse)\b/i
const BREADCRUMB_CONTAINER_RE =
  /\b(?:breadcrumb|breadcrumbs|crumbs?|page trail|page path|path nav|path navigation)\b/i
const GENERIC_BREADCRUMB_LABEL_RE =
  /^(?:activity|admin|analytics|dashboard|details?|home|items?|overview|page\s*\d+|profile|projects?|records?|reports?|settings|summary|tasks?|workspace)$/i
const SPECIFIC_BREADCRUMB_LABEL_RE =
  /\b(?:account|approval|asset|billing|case|claim|client|contract|crew|customer|deployment|dispatch|handoff|incident|inventory|invoice|job|lead|member|order|patient|payment|payout|policy|proposal|record|release|renewal|request|risk|route|shipment|shift|sla|supplier|ticket|vendor|warehouse|workspace)\b/i
const BRAND_LANDING_SCREEN_RE =
  /\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing|plans|features|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i
const STRONG_BRAND_LANDING_SCREEN_RE =
  /\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing page|plans page|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i
const BRAND_NAV_CLASS_RE =
  /\b(?:brand|logo|wordmark|site[- ]nav|marketing[- ]nav|navbar|nav[- ]bar|masthead)\b/i
const BRAND_IDENTITY_CLASS_RE =
  /\b(?:brand|brand[- ]mark|brand[- ]identity|logo|logotype|wordmark|site[- ]title|product[- ]name|masthead)\b/i
const GENERIC_BRAND_IDENTITY_LABEL_RE =
  /^(?:home|features?|pricing|plans?|customers?|clients?|testimonials?|case stud(?:y|ies)|work|portfolio|about|contact|blog|docs|login|sign in|sign up|book a demo|start free trial|learn more|view demo|see work|compare plans|contact sales|demo|faq|support|proof)$/i
const BRAND_NAME_LIKE_RE =
  /\b[A-Z][A-Za-z0-9&'.-]*(?:[A-Z][a-z0-9&'.-]+)+\b|\b[A-Z][A-Za-z0-9&'.-]+\s+(?:Studio|Labs|Works|Cloud|AI|HQ|OS|Desk|Flow|Suite|Hub|Health|Finance|Bank|Systems|Group|Co|Inc|LLC|Ltd)\b/
const VISUAL_ANCHOR_CLASS_RE =
  /\b(?:hero[- ]visual|hero[- ]media|product[- ](?:shot|preview|mockup)|screenshot|device[- ]mockup|browser[- ]mockup|phone[- ]mockup|visual[- ]anchor|media[- ]panel|image[- ]panel|gallery|preview[- ]panel|demo[- ]preview)\b/i
const VISUAL_ANCHOR_STYLE_RE =
  /\bbackground(?:-image)?\s*:\s*(?:url\(|image-set\()/i
const DECORATIVE_VISUAL_ANCHOR_RE =
  /\b(?:abstract|ambient|blob|blobs|bokeh|decorative|glow|gradient|halo|mesh|orb|orbs|shape|shapes|sparkle|sphere|swoosh|wave)\b/i
const TRUST_PROOF_TEXT_RE =
  /\b(?:trusted by|used by|loved by|chosen by|customers?|clients?|teams?|companies?|reviews?|ratings?|stars?|testimonial|case stud(?:y|ies)|customer stor(?:y|ies)|featured in|as seen in|press|security|compliance|soc\s?2|gdpr|hipaa|iso\s?27001|uptime|sla|roi|saved|increased|reduced|nps|g2|capterra|product hunt|fortune\s?500)\b/i
const TRUST_PROOF_CLASS_RE =
  /\b(?:logo[- ]cloud|logos?|trust|proof|social[- ]proof|testimonial|review|rating|stars?|case[- ]stud(?:y|ies)|customer[- ]stor(?:y|ies)|press|security|compliance|badge|badges|certification)\b/i
const GENERIC_TRUST_PROOF_LABEL_RE =
  /^(?:logo|logo\s*\d+|customer\s+logo|press\s+logo|company\s+[a-z0-9]+|client\s+[a-z0-9]+|customer\s+[a-z0-9]+|brand\s+[a-z0-9]+|partner\s+[a-z0-9]+|testimonial|quote|review|case\s+study|proof)$/i
const VANITY_METRIC_CONTAINER_RE =
  /\b(?:impact|kpi|metric|metrics|numbers|outcomes?|proof|results?|roi|social[- ]proof|stat|stats|traction|trust)\b/i
const GENERIC_VANITY_METRIC_RE =
  /\b(?:99|100(?:\.0+)?)\s?%\s*(?:customer\s+)?(?:accuracy|approval|happy|satisfaction|success|uptime)\b|\b(?:2|3|4|5|10)x\s+(?:better|conversion|faster|growth|more|output|productivity|roi)\b|\b(?:10k|100k|500k|1m)\+?\s+(?:customers?|downloads|members?|teams?|users?)\b|\b24\/7\s+(?:availability|coverage|service|support)\b|\b(?:zero|0)\s+(?:downtime|friction|hassle|setup)\b/i
const CONCRETE_METRIC_SPECIFICITY_RE =
  /\b(?:after|baseline|benchmark|before|case study|cohort|goal|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|last|measured|pilot|previous|prior|q[1-4]|reported|surveyed|target|this (?:week|month|quarter|year)|trial|versus|vs|yoy|mom)\b/i
const TESTIMONIAL_CLASS_RE =
  /\b(?:testimonial|review|quote|customer[- ]stor(?:y|ies)|client[- ]stor(?:y|ies)|social[- ]proof)\b/i
const TESTIMONIAL_ATTRIBUTION_RE =
  /\b(?:by|from|at|role|title|founder|ceo|cto|cmo|vp|director|manager|lead|head of|customer|client|team|company)\b|[+\-]?\d[\d,.]*\s?%|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|\b[A-Z][A-Za-z0-9&.-]+\s+(?:Studio|Labs|Inc|LLC|Ltd|Co|Group|Systems|Health|Finance|Bank|Agency)\b/
const GENERIC_TESTIMONIAL_COPY_RE =
  /\b(?:amazing product|awesome product|best (?:decision|experience|product|tool)|changed everything|couldn'?t be happier|game[- ]changer|highly recommend|incredible|love (?:it|this|the product)|made our lives easier|perfect for our team|saved us so much time|so easy to use|transformed our workflow|would recommend)\b/i
const CONCRETE_TESTIMONIAL_CONTEXT_RE =
  /\b(?:after|approval|before|case[- ]stud(?:y|ies)|conversion|dashboard|days?|dispatch|handoff|hours?|implementation|inquir(?:y|ies)|invoice|launch|migration|months?|onboarding|orders?|pilot|portfolio|project|q[1-4]|records?|renewal|revenue|route|sla|sync|tickets?|timeline|trial|users?|weeks?)\b|[+\-]?\d[\d,.]*\s?(?:%|x|arr|days?|hours?|months?|orders?|pages?|projects?|records?|tickets?|users?|weeks?)?\b|[$€£¥]\s*\d/i
const MARKETING_FEATURE_SURFACE_RE =
  /\b(?:landing page|marketing site|brand site|homepage|home page|features?|product page|website|waitlist|book a demo|start free trial)\b/i
const FEATURE_SECTION_RE =
  /\b(?:features?|benefits?|capabilit(?:y|ies)|use[- ]cases?|solutions?|workflow|how it works|what you can do|why teams choose|product details?|core tools?)\b/i
const FEATURE_ITEM_CLASS_RE =
  /\b(?:feature[- ]card|feature[- ]item|benefit[- ]card|benefit[- ]item|capability|use[- ]case|workflow[- ]card|solution[- ]card|tool[- ]card|module[- ]card)\b/i
const FEATURE_DETAIL_RE =
  /\b(?:automate|automation|analy[sz]e|analytics|approve|approval|collaborate|collaboration|custom|dashboard|editor|export|gallery|handoff|import|insights?|integrations?|launch|manage|permissions?|publish|routing|schedule|sync|templates?|track|workflow)\b/i
const GENERIC_FEATURE_TITLE_RE =
  /^(?:ai\s+)?(?:automation|analytics|collaboration|security|customization|dashboard|efficiency|growth|insights?|integrations?|productivity|reporting|simplicity|speed|support|templates?|visibility|workflow)$/i
const GENERIC_FEATURE_DETAIL_RE =
  /\b(?:advanced|built for modern teams|easy to use|everything in one place|flexible|intuitive|modern|move faster|powerful|robust|save time|scale with confidence|seamless|smart|streamline (?:your|the) workflow|work smarter)\b/i
const CONCRETE_FEATURE_DETAIL_RE =
  /\b(?:account|approval|asset|booking|branch|campaign|case|crew|customer|dashboard|dispatch|handoff|invoice|job|launch|lead|order|payment|portfolio|project|queue|record|renewal|request|route|shift|sla|studio|supplier|ticket|vendor|workspace)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|days?|hours?|users?|projects?|orders?|tickets?|records?|pages?)\b/i
const DESIGN_ITEM_CARD_CLASS_RE =
  /\b(?:card|tile|feature|benefit|capability|use case|pricing|price card|plan|tier|testimonial|review|quote|case study|project card|portfolio item|module card)\b/i
const PORTFOLIO_SURFACE_RE =
  /\b(?:case stud(?:y|ies)|portfolio(?: page| site| gallery)?|selected work|work showcase|client work|project portfolio)\b/i
const PORTFOLIO_BUILDER_RE =
  /\b(?:builder|platform|software|tool|template|cms|generator)\b/i
const PORTFOLIO_ENTRY_CLASS_RE =
  /\b(?:case[- ]study|project[- ]card|work[- ]card|portfolio[- ]item|client[- ]story|selected[- ]work|project[- ]tile|project[- ]entry)\b/i
const PORTFOLIO_OUTCOME_RE =
  /\b(?:client|role|year|timeline|launched|scope|industry|deliverables|result|outcome|increased|reduced|saved|grew|conversion|qualified inquiries|revenue)\b|[+\-]?\d[\d,.]*\s?%/i
const PORTFOLIO_DETAIL_ACTION_RE =
  /\b(?:view case study|read case study|view project|see project|open project|view work|read story|explore project)\b/i
const GENERIC_PORTFOLIO_PROJECT_RE =
  /\b(?:project\s+(?:one|two|three|[0-9]+|alpha|beta|gamma)|case\s+study\s+(?:one|two|three|[0-9]+)|selected\s+work\s+(?:one|two|three|[0-9]+)|(?:client|customer|brand|company)\s+(?:[a-z]|[0-9]+))\b/i
const PRICING_SURFACE_RE =
  /\b(?:pricing|plans?|packages?|tiers?|subscription|billing|monthly|annual|yearly|starter|pro|team|business|enterprise)\b/i
const PRICING_PRICE_RE =
  /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/i
const PRICING_PRICE_GLOBAL_RE =
  /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/gi
const PRICING_PLAN_CLASS_RE =
  /\b(?:pricing[- ]card|price[- ]card|plan|tier|package|subscription[- ]card)\b/i
const PRICING_RECOMMENDATION_RE =
  /\b(?:popular|recommended|best value|best for|most chosen|featured|most popular|team favorite)\b/i
const PRICING_CADENCE_RE =
  /\b(?:\/\s*(?:mo|month|yr|year)|per\s+(?:month|year|seat|user)|monthly|annual|yearly|billing|billed|save\s+\d+%)\b/i
const PRICING_FEATURE_RE =
  /\b(?:includes?|included|unlimited|up to|users?|seats?|projects?|storage|support|workspaces?|everything in|feature|features|api|sso|audit log)\b/i
const PRICING_ACTION_RE =
  /\b(?:choose plan|select plan|start trial|start free trial|buy now|upgrade|contact sales|get started with|talk to sales)\b/i
const GENERIC_PRICING_PLAN_ACTION_RE =
  /^(?:buy now|choose plan|choose this plan|get started|get started now|select plan|select this plan|start now|start trial|start free trial|subscribe|try now|upgrade)$/i
const GENERIC_PRICING_PLAN_DETAIL_RE =
  /\b(?:all (?:core )?features|everything you need|basic features|advanced features|premium features|standard support|priority support|premium support|custom support|best for (?:individuals|teams|businesses|growth)|great for (?:individuals|teams|businesses|growth)|perfect for (?:individuals|teams|businesses|growth)|grow faster|scale with confidence|contact us for details)\b/i
const CONCRETE_PRICING_PLAN_DETAIL_RE =
  /\b(?:up to\s+)?\d[\d,.]*\s?(?:users?|seats?|projects?|pages?|workspaces?|gb|mb|credits?|requests?|records?|exports?|integrations?|domains?|forms?|submissions?|hours?)\b|\bunlimited\s+(?:users?|seats?|projects?|pages?|workspaces?|exports?|integrations?)\b|\b(?:api|audit log|client workspaces?|compliance|custom domain|dedicated manager|email support|gallery analytics|gdpr|hipaa|implementation|launch support|migration|onboarding|permissions?|roles?|sandbox|sla|soc\s?2|sso|storage|white label)\b/i
const CONVERSION_CLOSE_TEXT_RE =
  /\b(?:faq|frequently asked|questions|ready to|start now|start free trial|book a demo|schedule a demo|request demo|get started|contact us|talk to sales|join waitlist|sign up|subscribe|request access|contact sales|next step|final step|still have questions)\b/i
const STRONG_CONVERSION_CLOSE_TEXT_RE =
  /\b(?:faq|frequently asked|questions|ready to|schedule a demo|request demo|contact us|join waitlist|sign up|subscribe|request access|next step|final step|still have questions)\b/i
const CONVERSION_CLOSE_CLASS_RE =
  /\b(?:final[- ]cta|bottom[- ]cta|closing[- ]cta|conversion|contact|demo[- ]form|signup[- ]form|lead[- ]form|waitlist|faq|questions|footer[- ]cta|next[- ]step)\b/i
const GENERIC_CONVERSION_CLOSE_HEADING_RE =
  /^(?:get started today|let'?s get started|ready(?: to)?(?: get started| start| begin| grow| scale| take the next step| transform your workflow| unlock your potential)?|start your journey|take the next step)$/i
const GENERIC_CONVERSION_CLOSE_COPY_RE =
  /\b(?:discover what (?:we|our|the) (?:platform|product|solution) can do|don'?t wait|join thousands|our team can help|see what (?:we|our|the) (?:platform|product|solution) can do|start (?:today|now)|take the next step|unlock your potential|we'?re here to help)\b/i
const CONCRETE_CONVERSION_CLOSE_CONTEXT_RE =
  /\b(?:audit|checklist|demo|dispatch|handoff|implementation|inquir(?:y|ies)|launch|migration|onboarding|portfolio|pricing|proposal|quote|review|route|schedule|setup|trial|within)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|hours?|months?|projects?|weeks?)\b/i
const FAQ_SECTION_RE =
  /\b(?:faq|frequently asked questions|frequently asked|question answers?|q and a|q&a)\b/i
const FAQ_QUESTION_RE =
  /\?|^(?:can|do|does|how|what|when|where|who|why|will|is|are|should|which)\b/i
const GENERIC_FAQ_QUESTION_RE =
  /^(?:can i (?:get started|try it|use it)|do you offer support|how does (?:it|this|the (?:platform|product|service|solution)) work|is (?:it|this) (?:easy|easy to use|right for me)|what (?:do i get|is (?:it|this|the (?:platform|product|service|solution)))|who is (?:it|this) for|why choose (?:us|this))\??$/i
const CONCRETE_FAQ_QUESTION_RE =
  /\b(?:api|audit|billing|cancel|compliance|data|demo|export|gdpr|hipaa|implementation|import|integrations?|migrat(?:e|ion)|onboarding|permissions?|pricing|refund|retention|security|setup|sla|soc\s?2|sso|support|timeline|training|trial|uptime|users?)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|weeks?|months?|hours?|users?|seats?|projects?|pages?|records?)\b/i
const GENERIC_FAQ_ANSWER_RE =
  /^(?:yes|no|it depends|contact (?:us|sales|support)|reach out|get in touch|learn more|coming soon|we support this|we can help|our team can help|our team will help|this is available|all plans include this|available on all plans)\b/i
const CONCRETE_FAQ_DETAIL_RE =
  /\b(?:api|audit|billing|cancel|compliance|data|demo|export|gdpr|hipaa|implementation|import|integration|migration|onboarding|permission|pricing|refund|retention|security|setup|sla|soc\s?2|sso|support|timeline|training|trial|uptime|users?)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|weeks?|months?|hours?|users?|seats?|projects?|pages?|records?)\b/i
const SITE_FOOTER_TEXT_RE =
  /\b(?:privacy|terms|copyright|all rights reserved|contact|support|email|linkedin|twitter|x\.com|instagram|github|dribbble|behance|address|newsletter|status|security|legal)\b/i
const SITE_FOOTER_CLASS_RE =
  /\b(?:site[- ]footer|footer[- ]nav|footer[- ]links|legal|social[- ]links|contact[- ]links|footer[- ]brand|copyright)\b/i
const GENERIC_SITE_FOOTER_LABEL_RE =
  /^(?:about(?: us)?|company|explore|follow(?: us)?|links|more|navigation|pages|product|products|quick links|resources|social|solutions)$/i
const LEAD_FORM_SIGNAL_RE =
  /\b(?:book a demo|schedule a demo|request demo|contact|contact sales|talk to sales|signup|sign up|subscribe|newsletter|waitlist|request access|early access|join|email|company|message)\b/i
const LEAD_FORM_SUCCESS_RE =
  /\b(?:submitted|sent|thank you|thanks|confirmation|confirmed|request received|message received|demo booked|you'?re on the list|we'?ll be in touch|check your inbox|success[- ]message|form[- ]success|toast[- ]success)\b/i
const LEAD_FORM_ERROR_RE =
  /\b(?:error|invalid|validation|required fields?|please enter|missing|try again|failed|could not|aria-invalid|role\s*=\s*["']alert["']|error[- ]message|form[- ]error|toast[- ]error)\b/i
const LEAD_FORM_LOADING_RE =
  /\b(?:loading|submitting|sending|please wait|aria-busy|spinner|progress)\b/i
const HERO_VIEWPORT_LOCK_RE =
  /(?:^|}|,|\s)(?:[#.]?[a-z0-9_-]*hero[a-z0-9_-]*|section\s*[:.#\[][^{,]*)[^{]*{[^}]*\b(?:min-height|height)\s*:\s*(?:100|9[5-9])(?:dvh|vh)\b/i
const FIXED_DESKTOP_FRAME_RE =
  /(?:^|[;{]\s*)(?:width|min-width)\s*:\s*(?:1[1-9]\d{2}|[2-9]\d{3})px\b/i
const VIEWPORT_LOCK_RE =
  /(?:^|[;{]\s*)height\s*:\s*100(?:dvh|vh)\b[\s\S]{0,160}(?:^|[;{]\s*)overflow\s*:\s*hidden\b|(?:^|[;{]\s*)overflow\s*:\s*hidden\b[\s\S]{0,160}(?:^|[;{]\s*)height\s*:\s*100(?:dvh|vh)\b/i
const UNBOUNDED_VIEWPORT_FONT_RE =
  /(?:^|[;{]\s*)font-size\s*:\s*(?!\s*clamp\()[^;{}]*\b\d*\.?\d+\s*(?:vw|vh|vmin|vmax)\b/i
const NEGATIVE_LETTER_SPACING_RE =
  /(?:^|[;{]\s*)letter-spacing\s*:\s*-\d*\.?\d+(?:px|em|rem|ch|%)?\b/i
const CSS_RULE_BLOCK_RE =
  /([^{}@]+){([^{}]*)}/g
const HEADING_SELECTOR_RE =
  /(^|[,\s>+~])(?:h[1-3]|\.[a-z0-9-]*(?:heading|headline|title)[a-z0-9-]*|\[role\s*=\s*["']heading["']\])/i
const BODY_TEXT_SELECTOR_RE =
  /(^|[,\s>+~])(?:body|p|li|td|th|label|button|a|\.[a-z0-9-]*(?:body|caption|copy|meta|muted|text)[a-z0-9-]*)/i
const CHART_CONTAINER_CLASS_RE =
  /\b(?:analytics|bars?|chart|graph|plot|sparkline|trend|visuali[sz]ation|viz)\b/i
const CHART_MARK_CLASS_RE =
  /\b(?:area|bar|dot|line|marker|point|segment|series|slice|spark)\b/i
const GENERIC_CHART_LABEL_RE =
  /^(?:analytics|chart|comparison|data|dataset\s*\d+|growth|insights?|metric|metrics|performance|progress|report|series\s*\d+|trend|value|values?)$/i
const SPECIFIC_CHART_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|arr|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|mrr|order|orders|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces|q[1-4]|week|month|quarter|year)\b/i
const METRIC_CONTAINER_CLASS_RE =
  /\b(?:kpi|metric|stat|summary|scorecard|insight|number-card|value-card)\b/i
const METRIC_CONTEXT_RE =
  /\b(?:vs|versus|from|since|last|previous|prior|target|goal|benchmark|trend|delta|change|increase|decrease|up|down|won|lost|this week|this month|this quarter|today|yesterday|q[1-4]|mom|yoy|week over week|month over month|year over year)\b|[+\-]\s?\d[\d,.]*\s?%|[↑↓]/i
const GENERIC_METRIC_LABEL_RE =
  /^(?:activity|conversion(?: rate)?|cycle time|engagement|growth|performance|pipeline|productivity|progress|revenue|sales|tasks?|usage|users?)$/i
const SPECIFIC_METRIC_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|arr|assignee|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|mrr|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i
const FORM_FIELD_AFFORDANCE_RE =
  /\b(required|optional|helper|hint|error|invalid|success|validation|aria-describedby|aria-invalid|aria-required|pattern|minlength|maxlength|role\s*=\s*["']alert["'])\b/i
const GENERIC_FORM_FIELD_LABEL_RE =
  /^(?:company(?: name)?|details?|email(?: address)?|enter text|full name|message|name|notes?|phone(?: number)?|select option|subject|text|title|type|your email|your message|your name)$/i
const SPECIFIC_FORM_FIELD_LABEL_RE =
  /\b(?:account|approval|billing|budget|company domain|crew|demo|dispatch|handoff|implementation|invoice|launch|migration|order|renewal|request|role|route|sla|team size|timeline|use case|volume|work email|workspace)\b/i
const SETTINGS_CONTROL_SURFACE_RE =
  /\b(?:access|alerts?|configuration|controls?|integrations?|notifications?|permissions?|preferences?|privacy|security|settings?|workspace)\b/i
const GENERIC_SETTINGS_CONTROL_LABEL_RE =
  /^(?:alerts?|auto|automatic|checkbox|email(?: alerts?| notifications?)?|enabled?|feature\s*\d*|notifications?|off|on|option\s*\d+|push|security|setting\s*\d*|sms|toggle\s*\d+|updates?)$/i
const SPECIFIC_SETTINGS_CONTROL_LABEL_RE =
  /\b(?:account|approval|billing|case|customer|dispatch|escalat(?:e|ion)|handoff|incident|invoice|lead|order|owner|overdue|renewal|request|risk|route|salesforce|sla|supplier|sync|ticket|vendor|workspace)\b/i
const PSEUDO_LIST_CONTAINER_CLASS_RE =
  /\b(?:activity|accounts?|cards?|customers?|feed|invoices?|list|messages?|notifications?|orders?|queue|records?|rows?|tasks?|timeline)\b/i
const PSEUDO_LIST_ITEM_CLASS_RE =
  /\b(?:account|card|customer|entry|event|invoice|item|message|notification|order|record|row|task|timeline-item)\b/i
const ACTIONABLE_RECORD_TEXT_RE =
  /\b(?:account|approval|approve|assignment|case|customer|file|invoice|lead|message|order|payment|record|renewal|request|review|supplier|task|ticket|vendor|approved|pending|overdue|blocked|at risk|delayed|failed|needs review)\b/i
const GENERIC_RECORD_ITEM_LABEL_RE =
  /^(?:(?:account|card|case|customer|entry|item|message|notification|order|project|record|request|task|ticket)\s*(?:#?\d+|[a-z]|one|two|three|four|five)?|(?:item|record|task)\s*[a-z])$/i
const SPECIFIC_RECORD_ITEM_LABEL_RE =
  /\b(?:account|approval|arr|billing|case|claim|client|contract|customer|handoff|incident|invoice|lead|mrr|order|owner|patient|payment|proposal|record|renewal|request|risk|route|salesforce|shipment|sla|supplier|sync|ticket|vendor|workspace)\b/i
const GENERIC_RECORD_ACTION_LABEL_RE =
  /^(?:action|actions|details?|edit|go|manage|more|open|select|view|view details?|view item|view record)$/i
const SPECIFIC_RECORD_ACTION_LABEL_RE =
  /\b(?:account|approve|assign|audit|billing|case|customer|dispatch|escalate|handoff|invoice|lead|order|owner|pay|payment|proposal|renewal|request|resolve|retry|review|risk|route|schedule|sla|supplier|sync|ticket|triage|vendor|workspace)\b/i
const RECORD_DISCOVERY_CONTROL_RE =
  /\b(?:search|filter|sort|group by|view|segmented|tab|pagination|page\s+\d|rows per page|showing\s+\d|next|previous|date range|status filter)\b/i
const RECORD_DISCOVERY_MARKUP_RE =
  /\b(?:aria-sort|role\s*=\s*["'](?:tab|tablist|search)["']|type\s*=\s*["']search["']|data-(?:filter|sort|view|page)|class\s*=\s*["'][^"']*(?:search|filter|sort|pagination|pager|tabs?|segmented|toolbar)|placeholder\s*=\s*["'][^"']*(?:search|filter))/i
const GENERIC_RECORD_DISCOVERY_LABEL_RE =
  /^(?:all|all items|all records|all statuses|date range|filter|filter status|search|search items|search records|sort|sort by|status|view|view all)$/i
const SPECIFIC_RECORD_DISCOVERY_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|assignee|assignees|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i
const GENERIC_RECORD_TABLE_COLUMN_LABEL_RE =
  /^(?:action|actions|amount|date|details?|id|name|owner|priority|progress|status|time|title|type|value)$/i
const SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE =
  /\b(?:account|approval|arr|balance|billing|case|claim|client|contract|customer|due|handoff|incident|invoice|lead|mrr|order|patient|payout|policy|proposal|record|renewal|request|risk|route|shipment|shift|sla|supplier|ticket|vendor|workspace)\b/i
const DESTRUCTIVE_ACTION_LABEL_RE =
  /^(?:delete|remove|archive|discard|revoke|disconnect|deactivate|disable|suspend|erase|reset|close\s+(?:account|workspace)|cancel\s+(?:subscription|plan|account|membership|renewal|invoice|order))\b/i
const DESTRUCTIVE_TONE_MARKUP_RE =
  /\b(?:danger|destructive|critical|warning|error|negative|delete|remove|revoke|disconnect|deactivate|archive)\b/i
const DESTRUCTIVE_SAFETY_MARKUP_RE =
  /\b(?:confirm|confirmation|undo|restore|recover|toast|dialog|modal|are you sure|permanent|irreversible|cannot be undone|role\s*=\s*["']dialog["']|aria-modal|data-confirm)\b/i
const DIALOG_CONTAINER_CLASS_RE =
  /\b(?:modal|dialog|drawer|sheet|popover|confirmation|confirm-panel|side-panel)\b/i
const DIALOG_CLOSE_LABEL_RE =
  /^(?:close|cancel|dismiss|done|back|never mind|go back)$/i
const GENERIC_DIALOG_TITLE_RE =
  /^(?:are you sure|confirm|confirmation|details?|edit|information|modal|settings|warning)$/i
const SPECIFIC_DIALOG_TITLE_RE =
  /\b(?:access|account|approval|billing|case|client|customer|delete|dispatch|handoff|incident|invoice|order|payment|renewal|request|risk|route|sla|supplier|ticket|vendor|workspace)\b/i
const TAB_CONTAINER_CLASS_RE =
  /\b(?:tablist|tabs?|tab-list|segmented|segmented-control|segment-control|view-switcher|mode-switcher)\b/i
const GENERIC_TAB_LABEL_RE =
  /^(?:activity|all|details?|general|history|items?|overview|settings|summary|tab\s*\d+|view\s*\d+|option\s*\d+)$/i
const SPECIFIC_TAB_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|task|tasks|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i
const WORKFLOW_STEP_CONTAINER_CLASS_RE =
  /\b(?:stepper|steps?|workflow|wizard|progress|timeline|process|journey|onboarding|checkout|approval-flow)\b/i
const WORKFLOW_STEP_ITEM_CLASS_RE =
  /\b(?:step|stage|milestone|phase|checkpoint|timeline-item)\b/i
const WORKFLOW_STEP_STATE_RE =
  /\b(?:aria-current|aria-selected|aria-checked|data-state\s*=\s*["'](?:active|current|complete|completed|done|upcoming|pending)["']|data-status\s*=|class\s*=\s*["'][^"']*\b(?:active|current|complete|completed|done|upcoming|pending|is-active|is-current|is-complete|is-completed|is-done)\b|role\s*=\s*["']progressbar["']|aria-valuenow)\b/i
const GENERIC_WORKFLOW_STEP_LABEL_RE =
  /^(?:step|step\s*\d+|stage\s*\d+|phase\s*\d+|milestone\s*\d+|checkpoint\s*\d+|\d+[.)]?)$/i
const SPECIFIC_WORKFLOW_STEP_LABEL_RE =
  /\b(?:account|approval|assign|billing|brief|checkout|connect|confirm|deploy|discover|draft|handoff|import|intake|invoice|launch|map|onboard|order|pay|payment|publish|renewal|request|review|route|schedule|setup|ship|submit|sync|triage|verify)\b/i
const CONCRETE_DATA_PATTERNS = [
  /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b/i,
  /\b\d[\d,.]*\s?(?:%|k|m|b|ms|sec|secs|min|mins|hr|hrs|hour|hours|day|days|week|weeks|users?|members?|tasks?|orders?|tickets?|invoices?|files?|gb|mb)\b/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\bq[1-4]\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i,
  /\b[A-Z]{2,}[-_#]?\d{2,}\b|\b(?:invoice|order|ticket|case|id|ref|build)\s*#?\s*[A-Z0-9-]{3,}\b/i,
  /\b(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready)\b/i,
  /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/,
  /\b[A-Z][A-Za-z0-9&.-]+\s+(?:Inc|LLC|Ltd|Labs|Finance|Bank|Studio|Clinic|Health|Systems|Group|Co)\b/
] as const
const STATE_LAUNDRY_LIST_RE =
  /\b(?:loading|empty|error|disabled|offline|permission|success|hover|focus|skeleton)\s+states?\b/gi
const STATUS_VALUE_ONLY_RE =
  /^(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready|success|warning|error|critical|paused|complete|completed|rejected|canceled|cancelled|open|closed|resolved|in progress|on track|needs review|not started)$/i
const STATUS_AFFORDANCE_CLASS_RE =
  /\b(?:status|badge|chip|pill|tag|state|tone|success|warning|danger|error|risk|critical|positive|negative|neutral|info|approved|pending|overdue|blocked|failed|active|inactive)\b/i
const STATUS_AFFORDANCE_ATTRIBUTE_RE =
  /\b(?:data-(?:state|status|tone|variant|color)|aria-label|aria-labelledby|title)\s*=/i
const STATUS_AFFORDANCE_STYLE_RE =
  /\b(?:background(?:-color)?|border(?:-[a-z]+)?|font-weight)\s*:/i
const RECOVERABLE_STATE_TEXT_RE =
  /\b(?:no (?:[a-z]+ )?(?:data|results|items|records|invoices|tasks|messages|files|matches)|nothing found|empty (?:queue|state|list|inbox)|error|failed|failure|offline|disconnected|permission denied|access denied|unauthorized|unavailable|unable to|could not load|cannot load|sync failed|expired)\b/i
const RECOVERABLE_STATE_HEADING_RE =
  /^(?:no (?:[a-z]+ )?(?:data|results|items|records|invoices|tasks|messages|files|matches)|nothing found|empty|error|failed|failure|offline|disconnected|permission|access denied|sync failed|retry failed|unable to|could not|cannot load|expired)/i
const STATE_MODULE_CLASS_RE =
  /\b(?:empty|error|failure|failed|offline|permission|alert|notice|banner|state|status|retry)\b/i
const GENERIC_RECOVERABLE_STATE_COPY_RE =
  /\b(?:no data|no items|nothing (?:here|to show)|nothing found|empty state|something went wrong|try again later|failed to load|unable to load|could not load|error occurred)\b/i
const RECOVERABLE_STATE_CONTEXT_RE =
  /\b(?:account|approval|assignee|asset|billing|case|claim|client|contract|customer|deployment|dispatch|filter|handoff|import|incident|integration|inventory|invoice|lead|order|owner|patient|payment|payout|policy|proposal|record|renewal|request|risk|route|salesforce|shipment|shift|sla|supplier|sync|ticket|vendor|workspace)\b/i
const FEEDBACK_MESSAGE_CLASS_RE =
  /\b(?:alert|banner|feedback|inline message|message|notification|notice|snackbar|status message|toast)\b/i
const GENERIC_FEEDBACK_MESSAGE_RE =
  /^(?:changes saved|completed|done|error|failed|failure|info|operation complete|request sent|saved|sent|submitted|success|successfully saved|try again|updated|warning)$/i
const FEEDBACK_MESSAGE_CONTEXT_RE =
  /\b(?:account|approval|assignee|billing|case|claim|client|connect|customer|dispatch|filter|handoff|import|incident|integration|invoice|lead|order|owner|payment|proposal|record|renewal|request|retry|risk|route|salesforce|sync|ticket|vendor|workspace)\b/i
const AUTO_REPAIR_WARNING_CODES = new Set([
  'broken-images',
  'center-everything-layout',
  'clipped-text',
  'dead-link-targets',
  'dead-links',
  'decorative-visual-anchor',
  'duplicated-card-copy',
  'fixed-desktop-frame',
  'generic-action-copy',
  'generic-conversion-close',
  'generic-document-title',
  'generic-dialog-title',
  'generic-faq-answers',
  'generic-faq-questions',
  'generic-breadcrumb-labels',
  'generic-chart-labels',
  'generic-feature-card-detail',
  'generic-form-field-labels',
  'generic-image-alt',
  'generic-feedback-message-copy',
  'generic-page-heading',
  'generic-portfolio-project-detail',
  'generic-pricing-plan-detail',
  'generic-pricing-plan-action-labels',
  'generic-product-navigation',
  'generic-recoverable-state-copy',
  'generic-record-action-labels',
  'generic-record-item-labels',
  'generic-record-table-columns',
  'generic-record-discovery-controls',
  'generic-settings-control-labels',
  'generic-metric-card-labels',
  'generic-section-heading',
  'generic-site-footer-detail',
  'generic-tab-labels',
  'generic-testimonial-copy',
  'generic-trust-proof',
  'generic-vanity-metrics',
  'generic-workflow-step-labels',
  'horizontal-overflow',
  'inert-form-submission',
  'low-contrast-text',
  'meta-page-heading',
  'missing-focus-states',
  'missing-form-labels',
  'missing-document-title',
  'missing-interaction-states',
  'missing-image-alt',
  'missing-image-source',
  'missing-layout-reset',
  'missing-navigation-landmark',
  'missing-navigation-current-state',
  'missing-page-heading',
  'missing-primary-action',
  'missing-prototype-navigation',
  'weak-destructive-action-safety',
  'weak-dialog-affordance',
  'nested-card-layout',
  'over-rounded-card-styling',
  'overlapping-text',
  'placeholder-content',
  'weak-prototype-navigation-coverage',
  'one-note-palette',
  'small-tap-targets',
  'state-laundry-list',
  'unnamed-content-section',
  'unnamed-icon-controls',
  'unlabeled-fields',
  'vague-template-copy',
  'wide-text-measure',
  'weak-app-shell',
  'weak-brand-identity',
  'weak-brand-navigation',
  'weak-content-depth',
  'weak-portfolio-structure',
  'weak-visual-anchor',
  'weak-chart-structure',
  'weak-conversion-close',
  'weak-site-footer',
  'weak-color-system',
  'weak-data-realism',
  'weak-faq-anatomy',
  'weak-feature-anatomy',
  'weak-first-screen-hierarchy',
  'weak-form-affordance',
  'weak-hero-viewport-composition',
  'weak-list-structure',
  'weak-lead-form-response',
  'weak-metric-context',
  'weak-product-preview-detail',
  'weak-record-actions',
  'weak-record-discovery-controls',
  'weak-secondary-action-path',
  'weak-spacing-system',
  'weak-state-recovery-action',
  'weak-status-affordance',
  'weak-tab-current-state',
  'weak-testimonial-attribution',
  'weak-trust-proof',
  'weak-workflow-step-state',
  'weak-table-structure',
  'weak-type-hierarchy',
  'weak-typography-constraints',
  'weak-page-heading',
  'weak-pricing-structure',
  'weak-primary-action'
])

function normalizeQualityCode(code: string): string {
  return code.trim().replace(/^runtime-/, '')
}

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, ' ')
}

function styleContent(html: string): string {
  return stripHtmlComments(html)
    .match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)
    ?.join('\n') ?? ''
}

function textContent(html: string): string {
  return stripHtmlComments(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function documentTitleText(html: string): string {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(stripHtmlComments(html))
  return textContent(titleMatch?.[1] ?? '')
}

function isGenericDocumentTitle(title: string): boolean {
  const normalized = title
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC_DOCUMENT_TITLE_RE.test(normalized) || PLACEHOLDER_RE.test(normalized) || META_PAGE_HEADING_RE.test(normalized)
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

function countPatternHits(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)
}

function pushFinding(
  findings: DesignHtmlQualityFinding[],
  finding: DesignHtmlQualityFinding
): void {
  if (!findings.some((item) => item.code === finding.code)) findings.push(finding)
}

function normalizePath(path: string): string {
  return path.trim().replaceAll('\\', '/')
}

function normalizePrototypeTarget(target: string): string {
  return normalizePath(target)
    .replace(/[?#].*$/, '')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
}

function attributeValues(html: string, name: string): string[] {
  const values: string[] = []
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const value = match[1]?.trim()
    if (value) values.push(value)
  }
  return values
}

function tagMatches(html: string, tagName: string): string[] {
  const tags: string[] = []
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) tags.push(match[0])
  return tags
}

function pairedTagMatches(html: string, tagName: string): Array<{ tag: string; inner: string }> {
  const tags: Array<{ tag: string; inner: string }> = []
  const re = new RegExp(`(<${tagName}\\b[^>]*>)([\\s\\S]*?)<\\/${tagName}>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) tags.push({ tag: match[1] ?? '', inner: match[2] ?? '' })
  return tags
}

function attributeValue(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  return re.exec(tag)?.[1]?.trim()
}

function hasHashTarget(html: string, hash: string): boolean {
  const id = hash.replace(/^#/, '').trim()
  if (!id) return false
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b(id|name)\\s*=\\s*["']${escaped}["']`, 'i').test(html)
}

function isDeadHrefTarget(target: string | undefined, html?: string): boolean {
  const raw = (target ?? '').trim()
  const lower = raw.toLowerCase()
  if (!raw || raw === '#') return true
  if (/^javascript\s*:/i.test(raw)) return true
  if (lower === 'void(0)' || lower === 'javascript:void(0)' || lower === 'javascript:;') return true
  if (raw.startsWith('#')) return html ? !hasHashTarget(html, raw) : false
  return false
}

function deadAnchorTags(html: string): string[] {
  return tagMatches(html, 'a').filter((tag) => isDeadHrefTarget(attributeValue(tag, 'href'), html))
}

function hasUsefulAnchorTarget(html: string): boolean {
  return tagMatches(html, 'a').some((tag) => !isDeadHrefTarget(attributeValue(tag, 'href'), html))
}

function hasScriptedInteraction(html: string): boolean {
  return (
    /\son(click|change|input|submit|keydown|keyup|pointerdown|mousedown)\s*=/i.test(html) ||
    /<script\b[\s\S]*?\b(addEventListener|onclick|onchange|onsubmit|classList|aria-expanded|aria-pressed|preventDefault)\b[\s\S]*?<\/script>/i.test(html)
  )
}

function hasFormFeedbackScript(html: string): boolean {
  return (
    /\sonsubmit\s*=/i.test(html) ||
    /<script\b[\s\S]*?\b(submit|onsubmit|preventDefault|FormData|classList|toast|alert|aria-busy)\b[\s\S]*?<\/script>/i.test(html)
  )
}

function hasInteractiveControls(html: string): boolean {
  return /<(button|input|select|textarea)\b/i.test(html) || /\brole=["'](button|switch|tab|checkbox|radio|link)["']/i.test(html)
}

function hasStaticPrimaryAction(html: string): boolean {
  return /<(button|a|input|select|textarea)\b/i.test(html) || /\brole=["']button["']/i.test(html)
}

function hasInteractionStateAffordance(html: string): boolean {
  return (
    /:(hover|active)\b/i.test(html) ||
    /\[(aria-pressed|aria-expanded|aria-selected|aria-disabled|data-state|disabled)\]/i.test(html) ||
    /\b(aria-pressed|aria-expanded|aria-selected|aria-disabled|data-state|disabled)\s*=/i.test(html)
  )
}

function isSkippableInput(tag: string): boolean {
  const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
  return ['hidden', 'button', 'submit', 'reset', 'image'].includes(type)
}

function isWrappedByLabel(html: string, tag: string): boolean {
  const index = html.indexOf(tag)
  if (index < 0) return false
  const before = html.slice(0, index)
  const open = before.lastIndexOf('<label')
  const close = before.lastIndexOf('</label')
  return open > close && html.indexOf('</label>', index) > index
}

function hasAssociatedLabel(html: string, tag: string): boolean {
  if (attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) {
    return true
  }
  const id = attributeValue(tag, 'id')
  if (id) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escaped}["']`, 'i').test(html)) return true
  }
  return isWrappedByLabel(html, tag)
}

function unlabeledFieldTags(html: string): string[] {
  const fields = [
    ...tagMatches(html, 'input').filter((tag) => !isSkippableInput(tag)),
    ...tagMatches(html, 'select'),
    ...tagMatches(html, 'textarea')
  ]
  return fields.filter((tag) => !hasAssociatedLabel(html, tag))
}

function hasControlAccessibleName(tag: string, inner: string): boolean {
  if (attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) {
    return true
  }
  if (textContent(inner)) return true
  return ['alt', 'title', 'aria-label', 'aria-labelledby'].some((name) => attributeValues(inner, name).length > 0)
}

function unnamedIconOnlyControlTags(html: string): string[] {
  const controls = [...pairedTagMatches(html, 'button'), ...pairedTagMatches(html, 'a')]
  return controls
    .filter(({ tag, inner }) => !hasControlAccessibleName(tag, inner))
    .map(({ tag }) => tag)
}

function hasCardLikeClass(tag: string): boolean {
  const className = attributeValue(tag, 'class') ?? ''
  return className
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => /^(card|panel|surface|tile)$/.test(token) || /-(card|panel|surface|tile)$/.test(token))
}

function normalizedClassText(tag: string): string {
  return (attributeValue(tag, 'class') ?? '').replace(/[-_]/g, ' ').toLowerCase()
}

function statusValueLabel(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？:]+$/g, '')
    .trim()
  return normalized.length <= 32 && STATUS_VALUE_ONLY_RE.test(normalized)
}

function hasStatusAffordanceMarkup(markup: string): boolean {
  if (!markup) return false
  if (STATUS_AFFORDANCE_ATTRIBUTE_RE.test(markup)) return true
  if (STATUS_AFFORDANCE_STYLE_RE.test(markup)) return true
  const classValues = attributeValues(markup, 'class')
    .join(' ')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
  return STATUS_AFFORDANCE_CLASS_RE.test(classValues)
}

function hasStatusAffordanceTag(tag: string, inner: string): boolean {
  return hasStatusAffordanceMarkup(tag) || hasStatusAffordanceMarkup(inner)
}

function weakStatusAffordanceTags(html: string): string[] {
  const weak = ['td', 'li', 'span', 'div']
    .flatMap((tagName) => pairedTagMatches(html, tagName).map((match) => ({ ...match, tagName })))
    .filter(({ tag, inner, tagName }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') {
        return false
      }
      if ((tagName === 'td' || tagName === 'li') && /<(?:span|div|strong|em|b|i)\b/i.test(inner)) return false
      return statusValueLabel(textContent(inner)) && !hasStatusAffordanceTag(tag, inner)
    })
    .map(({ tag }) => tag)
  return weak.length >= 2 ? weak : []
}

function hasRecoverableStateClass(tag: string): boolean {
  return STATE_MODULE_CLASS_RE.test(normalizedClassText(tag))
}

function staticHeadingTexts(inner: string): string[] {
  const headings: string[] = []
  for (const tagName of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    headings.push(...pairedTagMatches(inner, tagName).map(({ inner: heading }) => textContent(heading)))
  }
  return headings.map((heading) => heading.trim()).filter(Boolean)
}

function hasRecoverableStateSignal(tag: string, inner: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  if (['alert', 'status'].includes(role) || attributeValue(tag, 'aria-live')) return RECOVERABLE_STATE_TEXT_RE.test(textContent(inner))
  if (hasRecoverableStateClass(tag) && RECOVERABLE_STATE_TEXT_RE.test(textContent(inner))) return true
  return staticHeadingTexts(inner).some((heading) => RECOVERABLE_STATE_HEADING_RE.test(heading))
}

function hasStateRecoveryAction(inner: string): boolean {
  if (tagMatches(inner, 'button').some((tag) => !/\bdisabled\b/i.test(tag))) return true
  if (tagMatches(inner, 'input').some((tag) => {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    return ['button', 'submit'].includes(type) && !/\bdisabled\b/i.test(tag)
  })) return true
  if (tagMatches(inner, 'a').some((tag) => !isDeadHrefTarget(attributeValue(tag, 'href'), inner))) return true
  return /\brole\s*=\s*["'](?:button|link)["']/i.test(inner)
}

function genericRecoverableStateCopy(block: string): boolean {
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  return (
    GENERIC_RECOVERABLE_STATE_COPY_RE.test(text) &&
    !RECOVERABLE_STATE_CONTEXT_RE.test(text) &&
    concreteDataSignalCount(text) < 2
  )
}

function genericRecoverableStateCopyTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if ((attributeValue(tag, 'aria-busy') ?? '').toLowerCase() === 'true') continue
      const block = `${tag}${inner}`
      if (!hasRecoverableStateSignal(tag, inner) || !hasStateRecoveryAction(inner)) continue
      if (genericRecoverableStateCopy(block)) weak.push(tag)
    }
  }
  return weak
}

function hasFeedbackMessageSignal(tag: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  if (['alert', 'status'].includes(role) || attributeValue(tag, 'aria-live')) return true
  const metadata = [
    attributeValue(tag, 'class') ?? '',
    attributeValue(tag, 'id') ?? '',
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? ''
  ].join(' ').replace(/[-_]/g, ' ')
  return FEEDBACK_MESSAGE_CLASS_RE.test(metadata)
}

function normalizedFeedbackMessageText(text: string): string {
  return text
    .replace(/\b(?:loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？:]+$/g, '')
    .trim()
}

function genericFeedbackMessageCopy(text: string): boolean {
  const normalized = normalizedFeedbackMessageText(text)
  return normalized.length > 0 && normalized.length <= 64 && GENERIC_FEEDBACK_MESSAGE_RE.test(normalized)
}

function specificFeedbackMessageCopy(text: string): boolean {
  const normalized = normalizedFeedbackMessageText(text)
  return FEEDBACK_MESSAGE_CONTEXT_RE.test(normalized) || concreteDataSignalCount(normalized) > 0
}

function genericFeedbackMessageCopyTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div', 'p', 'span', 'output']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasFeedbackMessageSignal(tag)) continue
      const text = textContent(inner)
      if (genericFeedbackMessageCopy(text) && !specificFeedbackMessageCopy(text)) weak.push(tag)
    }
  }
  return weak
}

function weakStateRecoveryActionTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if ((attributeValue(tag, 'aria-busy') ?? '').toLowerCase() === 'true') continue
      if (!hasRecoverableStateSignal(tag, inner)) continue
      if (!hasStateRecoveryAction(inner)) weak.push(tag)
    }
  }
  return weak
}

function hasRecordAction(inner: string): boolean {
  if (tagMatches(inner, 'button').some((tag) => !/\bdisabled\b/i.test(tag))) return true
  if (tagMatches(inner, 'input').some((tag) => {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    return ['button', 'checkbox', 'radio', 'submit'].includes(type) && !/\bdisabled\b/i.test(tag)
  })) return true
  if (tagMatches(inner, 'select').length > 0) return true
  if (tagMatches(inner, 'a').some((tag) => !isDeadHrefTarget(attributeValue(tag, 'href'), inner))) return true
  return /\brole\s*=\s*["'](?:button|checkbox|link|menuitem|radio)["']/i.test(inner)
}

function hasActionableRecordText(text: string): boolean {
  const normalized = contentForDataRealism(text)
  return ACTIONABLE_RECORD_TEXT_RE.test(normalized) && concreteDataSignalCount(normalized) >= 2
}

function tableDataRowTexts(inner: string): string[] {
  return pairedTagMatches(inner, 'tr')
    .filter(({ inner: rowInner }) => /<td\b/i.test(rowInner))
    .map(({ inner: rowInner }) => textContent(rowInner))
    .filter((text) => text.length >= 16)
}

function normalizedRecordTableColumnLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tableHeaderLabels(inner: string): string[] {
  const labels = pairedTagMatches(inner, 'th')
    .map(({ tag, inner: headerInner }) => controlLabel(tag, headerInner))
    .map(normalizedRecordTableColumnLabel)
    .filter(Boolean)
  return Array.from(new Set(labels))
}

function genericRecordTableColumnLabel(text: string): boolean {
  const normalized = normalizedRecordTableColumnLabel(text)
  return normalized.length > 0 && normalized.length <= 32 && GENERIC_RECORD_TABLE_COLUMN_LABEL_RE.test(normalized)
}

function specificRecordTableColumnLabel(text: string): boolean {
  const normalized = normalizedRecordTableColumnLabel(text)
  return normalized.length > 0 && normalized.length <= 48 && SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE.test(normalized)
}

function listItemRecordTexts(inner: string): string[] {
  return pairedTagMatches(inner, 'li')
    .map(({ inner: itemInner }) => textContent(itemInner))
    .filter((text) => text.length >= 24)
}

function normalizedRecordItemLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/#.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function recordItemTitleLabels(tag: string, inner: string): string[] {
  const labels = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...['h2', 'h3', 'h4', 'h5', 'h6'].flatMap((tagName) =>
      pairedTagMatches(inner, tagName).map(({ tag: headingTag, inner: headingInner }) => controlLabel(headingTag, headingInner))
    )
  ]
  return Array.from(new Set(labels.map(normalizedRecordItemLabel).filter(Boolean)))
}

function genericRecordItemLabel(text: string): boolean {
  const normalized = normalizedRecordItemLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_RECORD_ITEM_LABEL_RE.test(normalized)
}

function specificRecordItemLabel(text: string): boolean {
  const normalized = normalizedRecordItemLabel(text)
  return (
    normalized.length > 0 &&
    normalized.length <= 96 &&
    (SPECIFIC_RECORD_ITEM_LABEL_RE.test(normalized) || concreteDataSignalCount(normalized) > 0)
  )
}

function recordItemBlocks(inner: string): Array<{ tag: string; inner: string }> {
  return ['li', 'article', 'section', 'div']
    .flatMap((tagName) => pairedTagMatches(inner, tagName))
    .filter(({ tag }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') return false
      return tag.toLowerCase().startsWith('<li') || tag.toLowerCase().startsWith('<article') || hasPseudoListItemClass(tag) || hasCardLikeClass(tag)
    })
}

function genericRecordItemLabelScope(inner: string): boolean {
  const recordItems = recordItemBlocks(inner).filter(({ inner: itemInner }) => hasActionableRecordText(textContent(itemInner)))
  if (recordItems.length < 3) return false
  const labels = recordItems.flatMap(({ tag, inner: itemInner }) => recordItemTitleLabels(tag, itemInner))
  if (labels.length < 3) return false
  const genericCount = labels.filter(genericRecordItemLabel).length
  const specificCount = labels.filter(specificRecordItemLabel).length
  return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
}

function genericRecordItemLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2) return []
  const weak: string[] = []
  for (const tagName of ['ul', 'ol', 'section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (genericRecordItemLabelScope(inner)) weak.push(tag)
    }
  }
  return weak
}

function weakRecordActionTags(html: string): string[] {
  const weak: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'table')) {
    const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
    if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
    const rows = tableDataRowTexts(inner).filter(hasActionableRecordText)
    if (rows.length >= 2 && !hasRecordAction(inner)) weak.push(tag)
  }
  for (const tagName of ['ul', 'ol']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const items = listItemRecordTexts(inner).filter(hasActionableRecordText)
      if (items.length >= 2 && !hasRecordAction(inner)) weak.push(tag)
    }
  }
  return weak
}

function recordActionLabels(inner: string): string[] {
  const labels = [
    ...pairedTagMatches(inner, 'button').map(({ tag, inner: labelInner }) => controlLabel(tag, labelInner)),
    ...pairedTagMatches(inner, 'a').map(({ tag, inner: labelInner }) => {
      if (isDeadHrefTarget(attributeValue(tag, 'href'), inner)) return ''
      return controlLabel(tag, labelInner)
    }),
    ...tagMatches(inner, 'input').map((tag) => {
      const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
      if (!['button', 'submit'].includes(type)) return ''
      return controlLabel(tag)
    }),
    ...tagMatches(inner, 'select').map((tag) => (
      attributeValue(tag, 'aria-label') ??
      attributeValue(tag, 'title') ??
      attributeValue(tag, 'name') ??
      ''
    ))
  ]
  const roleControlRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["'](?:button|link|menuitem)["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleControlRe.exec(inner))) {
    labels.push(controlLabel(match[1] ?? '', match[3] ?? ''))
  }
  return labels.map(normalizedActionLabel).filter(Boolean)
}

function genericRecordActionLabel(text: string): boolean {
  const normalized = normalizedActionLabel(text)
  return normalized.length > 0 && normalized.length <= 36 && GENERIC_RECORD_ACTION_LABEL_RE.test(normalized)
}

function specificRecordActionLabel(text: string): boolean {
  const normalized = normalizedActionLabel(text)
  return normalized.length > 0 && normalized.length <= 64 && SPECIFIC_RECORD_ACTION_LABEL_RE.test(normalized)
}

function genericRecordActionLabelTags(html: string): string[] {
  const weak: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'table')) {
    const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
    if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
    const actionableRows = pairedTagMatches(inner, 'tr').filter(({ inner: rowInner }) => /<td\b/i.test(rowInner) && hasActionableRecordText(textContent(rowInner)))
    if (actionableRows.length < 2 || !hasRecordAction(inner)) continue
    const labels = actionableRows.flatMap(({ inner: rowInner }) => recordActionLabels(rowInner))
    if (labels.length < 2) continue
    const genericCount = labels.filter(genericRecordActionLabel).length
    const specificCount = labels.filter(specificRecordActionLabel).length
    if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
  }
  for (const tagName of ['ul', 'ol']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const actionableItems = pairedTagMatches(inner, 'li').filter(({ inner: itemInner }) => hasActionableRecordText(textContent(itemInner)))
      if (actionableItems.length < 2 || !hasRecordAction(inner)) continue
      const labels = actionableItems.flatMap(({ inner: itemInner }) => recordActionLabels(itemInner))
      if (labels.length < 2) continue
      const genericCount = labels.filter(genericRecordActionLabel).length
      const specificCount = labels.filter(specificRecordActionLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

function genericRecordTableColumnTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2) return []
  return pairedTagMatches(html, 'table')
    .filter(({ tag, inner }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') return false
      const rows = tableDataRowTexts(inner).filter(hasActionableRecordText)
      if (rows.length < 2) return false
      const labels = tableHeaderLabels(inner)
      if (labels.length < 3) return false
      const genericCount = labels.filter(genericRecordTableColumnLabel).length
      const specificCount = labels.filter(specificRecordTableColumnLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    .map(({ tag }) => tag)
}

function recordDiscoveryControlMarkup(html: string): boolean {
  return RECORD_DISCOVERY_MARKUP_RE.test(html) || RECORD_DISCOVERY_CONTROL_RE.test(textContent(html))
}

function recordDiscoveryControlArea(markup: string): string {
  return markup
    .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
    .replace(/<(?:ul|ol)\b[\s\S]*?<\/(?:ul|ol)>/gi, ' ')
}

function normalizedRecordDiscoveryLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function genericRecordDiscoveryLabel(text: string): boolean {
  const normalized = normalizedRecordDiscoveryLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_RECORD_DISCOVERY_LABEL_RE.test(normalized)
}

function specificRecordDiscoveryLabel(text: string): boolean {
  const normalized = normalizedRecordDiscoveryLabel(text)
  return normalized.length > 0 && normalized.length <= 60 && SPECIFIC_RECORD_DISCOVERY_LABEL_RE.test(normalized)
}

function recordDiscoveryControlLabels(markup: string): string[] {
  const area = recordDiscoveryControlArea(markup)
  const labels = [
    ...pairedTagMatches(area, 'label').map(({ inner }) => textContent(inner)),
    ...pairedTagMatches(area, 'button').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(area, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(area, 'option').map(({ inner }) => textContent(inner))
  ]
  for (const tagName of ['input', 'select']) {
    for (const tag of tagMatches(area, tagName)) {
      labels.push(
        attributeValue(tag, 'aria-label') ?? '',
        attributeValue(tag, 'title') ?? '',
        attributeValue(tag, 'placeholder') ?? ''
      )
    }
  }
  return Array.from(new Set(labels.map(normalizedRecordDiscoveryLabel).filter(Boolean)))
}

function genericRecordDiscoveryControlTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['main', 'section', 'article', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (actionableRecordCount(inner) < 4 || !recordDiscoveryControlMarkup(inner)) continue
      const labels = recordDiscoveryControlLabels(inner)
      const candidates = labels.filter((label) =>
        RECORD_DISCOVERY_CONTROL_RE.test(label) ||
        genericRecordDiscoveryLabel(label) ||
        specificRecordDiscoveryLabel(label)
      )
      if (candidates.length < 2) continue
      const genericCount = candidates.filter(genericRecordDiscoveryLabel).length
      const specificCount = candidates.filter(specificRecordDiscoveryLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(candidates.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

function actionableRecordCount(inner: string): number {
  const tableRows = pairedTagMatches(inner, 'table')
    .flatMap(({ inner: tableInner }) => tableDataRowTexts(tableInner))
    .filter(hasActionableRecordText)
  const listItems = ['ul', 'ol']
    .flatMap((tagName) => pairedTagMatches(inner, tagName))
    .flatMap(({ inner: listInner }) => listItemRecordTexts(listInner))
    .filter(hasActionableRecordText)
  return tableRows.length + listItems.length
}

function weakRecordDiscoveryControlTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['main', 'section', 'article', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (actionableRecordCount(inner) >= 4 && !recordDiscoveryControlMarkup(inner)) weak.push(tag)
    }
  }
  return weak
}

function hasMetricContainerClass(tag: string): boolean {
  return METRIC_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

function hasMetricValue(text: string): boolean {
  return /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|k|m|b|arr|mrr|usd|eur|gbp|cny|rmb|users?|members?|tasks?|orders?|tickets?|invoices?|files?|days?|hrs?|hours?)\b|\b\d{2,}(?:\.\d+)?\b/i.test(
    text
  )
}

function hasMetricContext(text: string): boolean {
  return METRIC_CONTEXT_RE.test(text)
}

function metricCardBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const tagName of ['section', 'article', 'div', 'li']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasMetricContainerClass(tag)) continue
      const text = textContent(inner)
      if (text.length <= 180 && hasMetricValue(text)) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

function metricCardLabel(block: string): string {
  const localHeading = staticHeadingTexts(block)[0]
  if (localHeading) return localHeading
  const label = ['span', 'small', 'p']
    .flatMap((tagName) => pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner)))
    .find((text) => text.length > 0 && text.length <= 64)
  return label ?? ''
}

function normalizedMetricLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/%+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function genericMetricCardLabel(block: string): boolean {
  const label = normalizedMetricLabel(metricCardLabel(block))
    .replace(/\b(?:today|this|last|previous|prior|current|q[1-4]|month|week|quarter|year|daily|weekly|monthly|annual|yearly)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const text = normalizedMetricLabel(textContent(block))
  return label.length > 0 && label.length <= 40 && GENERIC_METRIC_LABEL_RE.test(label) && !SPECIFIC_METRIC_LABEL_RE.test(text)
}

function genericMetricCardLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2) return []
  const blocks = metricCardBlocks(html)
  if (blocks.length < 3) return []
  const weak = blocks.filter(genericMetricCardLabel)
  return weak.length >= 3 ? weak.slice(0, 4) : []
}

function weakMetricContextTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'div', 'li']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasMetricContainerClass(tag)) continue
      const text = textContent(inner)
      if (text.length > 180 || !hasMetricValue(text)) continue
      if (!hasMetricContext(`${text} ${tag}`)) weak.push(tag)
    }
  }
  return weak.length >= 3 ? weak : []
}

function hasPseudoListContainerClass(tag: string): boolean {
  return PSEUDO_LIST_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

function hasPseudoListItemClass(tag: string): boolean {
  return PSEUDO_LIST_ITEM_CLASS_RE.test(normalizedClassText(tag))
}

function hasChartContainerClass(tag: string): boolean {
  return CHART_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

function hasChartMarkClass(tag: string): boolean {
  return CHART_MARK_CLASS_RE.test(normalizedClassText(tag))
}

function nestedCardLikeTags(html: string): string[] {
  const nested: string[] = []
  for (const tagName of ['div', 'section', 'article', 'li', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      if (!hasCardLikeClass(tag)) continue
      const hasNestedCard = ['div', 'section', 'article', 'li', 'aside'].some((innerTagName) =>
        tagMatches(inner, innerTagName).some(hasCardLikeClass)
      )
      if (hasNestedCard) nested.push(tag)
    }
  }
  return nested
}

function hasSemanticRecordStructure(html: string): boolean {
  return (
    /<(ul|ol|table)\b/i.test(html) ||
    /<(li|tr)\b/i.test(html) ||
    /\brole\s*=\s*["'](?:feed|grid|list|listbox|listitem|row|table)["']/i.test(html)
  )
}

function pseudoListContainerTags(html: string): string[] {
  const containers: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      if (hasSemanticRecordStructure(inner)) continue
      const repeatedItems = ['div', 'article', 'section']
        .flatMap((innerTagName) => tagMatches(inner, innerTagName))
        .filter((innerTag) => hasPseudoListItemClass(innerTag) || hasCardLikeClass(innerTag))
      if (repeatedItems.length < 3) continue
      if (hasPseudoListContainerClass(tag) || repeatedItems.filter(hasPseudoListItemClass).length >= 3) containers.push(tag)
    }
  }
  return containers
}

function chartMarkCount(inner: string): number {
  return ['div', 'span', 'i', 'b', 'rect', 'circle', 'path'].reduce(
    (count, tagName) => count + tagMatches(inner, tagName).filter(hasChartMarkClass).length,
    0
  )
}

function hasChartDataContext(tag: string, inner: string): boolean {
  if (/<(figcaption|title|desc|text)\b/i.test(inner)) return true
  if (/\b(data-value|aria-valuenow|aria-valuetext)\s*=/i.test(inner)) return true
  const labels = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'aria-labelledby') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...attributeValues(inner, 'aria-label'),
    ...attributeValues(inner, 'title')
  ].join(' ')
  return concreteDataSignalCount(`${textContent(inner)} ${labels}`) >= 2
}

function weakChartStructureTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'figure', 'div', 'svg']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const markCount = chartMarkCount(inner)
      const chartLike =
        hasChartContainerClass(tag) ||
        (tagName === 'svg' && hasChartContainerClass(tag)) ||
        markCount >= 3 ||
        /\brole\s*=\s*["']img["']/i.test(tag) && hasChartContainerClass(tag)
      if (!chartLike || markCount < 3) continue
      if (!hasChartDataContext(tag, inner)) weak.push(tag)
    }
  }
  return weak
}

function chartLikeBlocks(html: string): Array<{ tag: string; inner: string }> {
  const blocks: Array<{ tag: string; inner: string }> = []
  for (const tagName of ['section', 'article', 'aside', 'figure', 'div', 'svg']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const markCount = chartMarkCount(inner)
      const chartLike =
        hasChartContainerClass(tag) ||
        (tagName === 'svg' && hasChartContainerClass(tag)) ||
        markCount >= 3 ||
        /\brole\s*=\s*["']img["']/i.test(tag) && hasChartContainerClass(tag)
      if (chartLike && markCount >= 3) blocks.push({ tag, inner })
    }
  }
  return blocks
}

function normalizedChartLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/%$€£¥#.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function chartLabelTexts(tag: string, inner: string): string[] {
  const labels = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...attributeValues(inner, 'aria-label'),
    ...attributeValues(inner, 'title')
  ]
  for (const tagName of ['h2', 'h3', 'h4', 'figcaption', 'title', 'desc', 'legend', 'text']) {
    labels.push(...pairedTagMatches(inner, tagName).map(({ inner: labelInner }) => textContent(labelInner)))
  }
  return Array.from(new Set(labels.map(normalizedChartLabel).filter(Boolean)))
}

function genericChartLabel(text: string): boolean {
  const normalized = normalizedChartLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_CHART_LABEL_RE.test(normalized)
}

function specificChartLabel(text: string): boolean {
  const normalized = normalizedChartLabel(text)
  return (
    normalized.length > 0 &&
    normalized.length <= 96 &&
    (SPECIFIC_CHART_LABEL_RE.test(normalized) || concreteDataSignalCount(normalized) > 0)
  )
}

function genericChartLabelTags(html: string): string[] {
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

function weakTableStructureTags(html: string): string[] {
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

function controlLabel(tag: string, inner = ''): string {
  return (
    textContent(inner) ||
    attributeValue(tag, 'aria-label') ||
    attributeValue(tag, 'title') ||
    attributeValue(tag, 'value') ||
    ''
  ).trim()
}

function primaryButtonLabels(html: string): string[] {
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

function isGenericActionLabel(label: string): boolean {
  return GENERIC_ACTION_LABEL_RE.test(
    label
      .replace(/\s+/g, ' ')
      .replace(/[.!?。！？]+$/g, '')
      .trim()
  )
}

function hasGenericActionCopy(html: string): boolean {
  const labels = primaryButtonLabels(html)
  return labels.length > 0 && labels.every(isGenericActionLabel)
}

function normalizedActionLabel(label: string): string {
  return label
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
}

function isDestructiveActionLabel(label: string): boolean {
  return DESTRUCTIVE_ACTION_LABEL_RE.test(normalizedActionLabel(label))
}

function hasDestructiveToneMarkup(html: string): boolean {
  if (DESTRUCTIVE_TONE_MARKUP_RE.test(html)) return true
  return /#(?:b91c1c|dc2626|ef4444|991b1b)\b|\b(?:red|crimson|firebrick)\b/i.test(html)
}

function hasDestructiveSafetyMarkup(html: string): boolean {
  return DESTRUCTIVE_SAFETY_MARKUP_RE.test(html)
}

function destructiveActionControlTags(html: string): string[] {
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

function weakDestructiveActionSafetyTags(html: string): string[] {
  const controls = destructiveActionControlTags(html)
  if (controls.length === 0) return []
  if (hasDestructiveToneMarkup(html) && hasDestructiveSafetyMarkup(html)) return []
  return controls
}

function hasDialogContainerClass(tag: string): boolean {
  return DIALOG_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

function hasDialogSemantics(tag: string, tagName: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  return tagName === 'dialog' || role === 'dialog' || role === 'alertdialog' || (attributeValue(tag, 'aria-modal') ?? '').toLowerCase() === 'true'
}

function hasDialogAccessibleName(tag: string, inner: string): boolean {
  return Boolean(attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) || hasLocalModuleHeading(inner)
}

function hasDialogCloseAction(inner: string): boolean {
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

function weakDialogAffordanceTags(html: string): string[] {
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

function textForElementId(html: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<([a-z0-9-]+)\\b[^>]*\\bid\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i')
  return textContent(re.exec(html)?.[2] ?? '')
}

function dialogTitleTexts(html: string, tag: string, inner: string): string[] {
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

function genericDialogTitle(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_DIALOG_TITLE_RE.test(normalized)
}

function specificDialogTitle(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 72 && SPECIFIC_DIALOG_TITLE_RE.test(normalized)
}

function genericDialogTitleTags(html: string): string[] {
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

function isDecorativeImage(tag: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  return role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true'
}

function missingImageSourceTags(html: string): string[] {
  return tagMatches(html, 'img').filter((tag) => {
    const src = attributeValue(tag, 'src') ?? ''
    return isDeadHrefTarget(src)
  })
}

function missingImageAltTags(html: string): string[] {
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

function imageAccessibleText(tag: string): string {
  const alt = attributeValue(tag, 'alt')
  if (alt !== undefined) return alt.trim()
  return (
    attributeValue(tag, 'aria-label') ??
    attributeValue(tag, 'title') ??
    ''
  ).trim()
}

function genericImageAltTags(html: string): string[] {
  return tagMatches(html, 'img').filter((tag) => {
    if (isDecorativeImage(tag)) return false
    const label = imageAccessibleText(tag)
      .replace(/\s+/g, ' ')
      .trim()
    return label.length > 0 && label.length <= 48 && GENERIC_IMAGE_ALT_RE.test(label)
  })
}

function inertFormTags(html: string): string[] {
  if (hasFormFeedbackScript(html)) return []
  if (tagMatches(html, 'button').some((tag) => attributeValue(tag, 'formaction'))) return []
  if (tagMatches(html, 'input').some((tag) => attributeValue(tag, 'formaction'))) return []
  return tagMatches(html, 'form').filter((tag) => {
    const action = attributeValue(tag, 'action')
    if (action && !isDeadHrefTarget(action)) return false
    return !attributeValue(tag, 'onsubmit')
  })
}

function formFieldTags(html: string): string[] {
  return [
    ...tagMatches(html, 'input').filter((tag) => !isSkippableInput(tag)),
    ...tagMatches(html, 'select'),
    ...tagMatches(html, 'textarea')
  ]
}

function hasFormFieldAffordance(html: string): boolean {
  return FORM_FIELD_AFFORDANCE_RE.test(html) || /<(small|output)\b/i.test(html)
}

function weakFormAffordanceTags(html: string): string[] {
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

function formSignalText(tag: string, inner: string): string {
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

function hasStaticLeadFormSignal(html: string, visibleText: string, tag: string, inner: string): boolean {
  return hasBrandLandingScreenSignal(html, visibleText) && LEAD_FORM_SIGNAL_RE.test(formSignalText(tag, inner))
}

function leadFormTags(html: string, visibleText: string): string[] {
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

function normalizedFormFieldLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/\b(?:required|optional)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formFieldLabels(inner: string): string[] {
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

function genericFormFieldLabel(text: string): boolean {
  const normalized = normalizedFormFieldLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_FORM_FIELD_LABEL_RE.test(normalized)
}

function specificFormFieldLabel(text: string): boolean {
  const normalized = normalizedFormFieldLabel(text)
  return normalized.length > 0 && normalized.length <= 64 && SPECIFIC_FORM_FIELD_LABEL_RE.test(normalized)
}

function genericFormFieldLabelTags(html: string, visibleText: string): string[] {
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

function normalizedSettingsControlLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/%+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelTextForInputId(html: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i')
  return textContent(re.exec(html)?.[1] ?? '')
}

function settingsControlLabels(inner: string): string[] {
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

function settingsControlCount(inner: string): number {
  return (
    tagMatches(inner, 'input').filter((tag) => ['checkbox', 'radio'].includes((attributeValue(tag, 'type') ?? '').toLowerCase())).length +
    tagMatches(inner, 'button').filter((tag) => /\baria-pressed\s*=|\brole\s*=\s*["'](?:checkbox|radio|switch)["']/i.test(tag)).length +
    (inner.match(/\brole\s*=\s*["'](?:checkbox|radio|switch)["']/gi)?.length ?? 0)
  )
}

function genericSettingsControlLabel(text: string): boolean {
  const normalized = normalizedSettingsControlLabel(text)
  return normalized.length > 0 && normalized.length <= 48 && GENERIC_SETTINGS_CONTROL_LABEL_RE.test(normalized)
}

function specificSettingsControlLabel(text: string): boolean {
  const normalized = normalizedSettingsControlLabel(text)
  return normalized.length > 0 && normalized.length <= 96 && SPECIFIC_SETTINGS_CONTROL_LABEL_RE.test(normalized)
}

function hasSettingsControlSurface(tag: string, inner: string): boolean {
  const metadata = [
    attributeValue(tag, 'class') ?? '',
    attributeValue(tag, 'id') ?? '',
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    textContent(inner)
  ].join(' ').replace(/[-_]/g, ' ')
  return SETTINGS_CONTROL_SURFACE_RE.test(metadata)
}

function genericSettingsControlLabelTags(html: string, visibleText: string): string[] {
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

function hasLeadFormResponseStates(html: string): boolean {
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

function weakLeadFormResponseTags(html: string, visibleText: string): string[] {
  const forms = leadFormTags(html, visibleText)
  if (forms.length === 0 || hasLeadFormResponseStates(html)) return []
  return forms
}

function hasLocalModuleHeading(inner: string): boolean {
  return /<h[1-6]\b/i.test(inner) || /\brole\s*=\s*["']heading["']/i.test(inner) || /<legend\b/i.test(inner)
}

function hasModuleAccessibleName(tag: string, inner: string): boolean {
  return (
    Boolean(attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) ||
    hasLocalModuleHeading(inner)
  )
}

function unnamedContentSectionTags(html: string): string[] {
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

function hasTopLevelHeading(html: string): boolean {
  if (/<h1\b/i.test(html)) return true
  const roleHeadings = html.match(/<[^>]+\brole\s*=\s*["']heading["'][^>]*>/gi) ?? []
  return roleHeadings.some((tag) => attributeValue(tag, 'aria-level') === '1')
}

function firstTopLevelHeadingIndex(html: string): number {
  const indices = [
    /<h1\b/i.exec(html)?.index ?? -1,
    /<[^>]+\brole\s*=\s*["']heading["'][^>]*\baria-level\s*=\s*["']1["'][^>]*>/i.exec(html)?.index ?? -1,
    /<[^>]+\baria-level\s*=\s*["']1["'][^>]*\brole\s*=\s*["']heading["'][^>]*>/i.exec(html)?.index ?? -1
  ].filter((index) => index >= 0)
  return indices.length > 0 ? Math.min(...indices) : -1
}

function hasFirstScreenSupportContent(html: string): boolean {
  const headingIndex = firstTopLevelHeadingIndex(html)
  if (headingIndex < 0) return true
  const lead = html
    .slice(headingIndex, headingIndex + 2800)
    .replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<button\b[\s\S]*?<\/button>/gi, ' ')
    .replace(/<a\b[\s\S]*?<\/a>/gi, ' ')
    .replace(/<(label|option)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(input|select|textarea)\b[\s\S]*?(?:<\/\1>|>)/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  const supportText = textContent(lead)
    .replace(/\b(loading|empty|error|disabled|success|hover|focus) state\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /[.!?。！？]/.test(supportText) ? supportText.length >= 36 : supportText.length >= 48
}

function firstScreenActionDescriptors(html: string): string[] {
  const headingIndex = firstTopLevelHeadingIndex(html)
  const lead = headingIndex >= 0 ? html.slice(headingIndex, headingIndex + 3000) : html.slice(0, 3000)
  const descriptors: string[] = []
  for (const { tag, inner } of pairedTagMatches(lead, 'button')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (type === 'reset' || /\bdisabled\b/i.test(tag)) continue
    descriptors.push(controlLabel(tag, inner))
  }
  for (const tag of tagMatches(lead, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (!['button', 'submit'].includes(type) || /\bdisabled\b/i.test(tag)) continue
    descriptors.push(controlLabel(tag))
  }
  for (const { tag, inner } of pairedTagMatches(lead, 'a')) {
    const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
    const target = attributeValue(tag, 'href')
    if (role !== 'button' && isDeadHrefTarget(target, html)) continue
    descriptors.push(controlLabel(tag, inner) || target || '')
  }
  return Array.from(new Set(descriptors.map(normalizedActionLabel).filter(Boolean)))
}

function hasWeakSecondaryActionPath(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    firstScreenActionDescriptors(html).length < 2
  )
}

function contentForDataRealism(text: string): string {
  return text
    .replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function concreteDataSignalCount(text: string): number {
  const content = contentForDataRealism(text)
  return CONCRETE_DATA_PATTERNS.reduce((count, pattern) => count + (pattern.test(content) ? 1 : 0), 0)
}

function hasWeakDataRealism(text: string): boolean {
  const content = contentForDataRealism(text)
  return content.length >= 120 && concreteDataSignalCount(content) < 2
}

function stateLaundryListCount(text: string): number {
  return text.match(STATE_LAUNDRY_LIST_RE)?.length ?? 0
}

function hasStateLaundryList(text: string): boolean {
  return stateLaundryListCount(text) >= 3
}

function meaningfulContentModuleCount(html: string): number {
  const moduleTags = ['section', 'article', 'aside', 'form', 'table', 'ul', 'ol']
  let count = 0
  for (const tagName of moduleTags) {
    for (const { inner } of pairedTagMatches(html, tagName)) {
      const moduleText = contentForDataRealism(textContent(inner))
      const hasStructuredChildren = /<(table|form|li|tr|article|aside)\b/i.test(inner)
      if (moduleText.length >= 36 || hasStructuredChildren) count += 1
    }
  }

  const taggedSectionRe = /<([a-z0-9-]+)\b[^>]*\bdata-ds-section\s*=\s*["'][^"']+["'][^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = taggedSectionRe.exec(html))) {
    const moduleText = contentForDataRealism(textContent(match[2] ?? ''))
    if (moduleText.length >= 36) count += 1
  }
  return count
}

function hasWeakContentDepth(html: string, visibleText: string): boolean {
  return contentForDataRealism(visibleText).length >= 140 && meaningfulContentModuleCount(html) < 2
}

function hasProductAppScreenSignal(html: string, visibleText: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'role')
  ].join(' ')
  return PRODUCT_APP_SCREEN_RE.test(`${visibleText} ${metadata}`)
}

function productAppMetricCount(html: string): number {
  return ['section', 'article', 'div', 'li']
    .flatMap((tagName) => tagMatches(html, tagName))
    .filter(hasMetricContainerClass).length
}

function productAppModuleSignalCount(html: string): number {
  let count = 0
  if (meaningfulContentModuleCount(html) >= 2) count += 1
  if (/<(?:table|form)\b/i.test(html)) count += 1
  if (formFieldTags(html).length >= 2) count += 1
  if (actionableRecordCount(html) >= 2) count += 1
  if (productAppMetricCount(html) >= 2) count += 1
  if (tagMatches(html, 'button').length + pairedTagMatches(html, 'a').length >= 4) count += 1
  return count
}

function hasProductAppChrome(html: string): boolean {
  if (/<(?:nav|aside)\b/i.test(html)) return true
  if (/\brole\s*=\s*["'](?:navigation|complementary)["']/i.test(html)) return true
  return PRODUCT_APP_CHROME_CLASS_RE.test(attributeValues(html, 'class').join(' ').replace(/[-_]/g, ' '))
}

function hasWeakProductAppShell(html: string, visibleText: string): boolean {
  return hasProductAppScreenSignal(html, visibleText) && productAppModuleSignalCount(html) >= 2 && !hasProductAppChrome(html)
}

function normalizedProductNavLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function genericProductNavLabel(text: string): boolean {
  const normalized = normalizedProductNavLabel(text)
  return normalized.length > 0 && normalized.length <= 32 && GENERIC_PRODUCT_NAV_LABEL_RE.test(normalized)
}

function specificProductNavLabel(text: string): boolean {
  const normalized = normalizedProductNavLabel(text)
  return normalized.length > 0 && normalized.length <= 48 && PRODUCT_NAV_DOMAIN_LABEL_RE.test(normalized)
}

function productNavigationLabels(block: string): string[] {
  const labels = [
    ...pairedTagMatches(block, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'button').map(({ tag, inner }) => controlLabel(tag, inner))
  ]
  return Array.from(new Set(labels.map(normalizedProductNavLabel).filter(Boolean)))
}

function hasBreadcrumbContainerMetadata(markup: string): boolean {
  const metadata = [
    ...attributeValues(markup, 'class'),
    ...attributeValues(markup, 'id'),
    ...attributeValues(markup, 'aria-label'),
    ...attributeValues(markup, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  return BREADCRUMB_CONTAINER_RE.test(metadata)
}

function genericProductNavigationBlocks(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2 || !hasProductAppChrome(html)) return []
  return navigationBlocks(html).filter((block) => {
    if (hasBreadcrumbContainerMetadata(block)) return false
    const labels = productNavigationLabels(block)
    if (labels.length < 3) return false
    const genericCount = labels.filter(genericProductNavLabel).length
    const specificCount = labels.filter(specificProductNavLabel).length
    return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
  })
}

function breadcrumbBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'nav')) {
    const metadata = [
      attributeValue(tag, 'class') ?? '',
      attributeValue(tag, 'id') ?? '',
      attributeValue(tag, 'aria-label') ?? '',
      attributeValue(tag, 'title') ?? ''
    ].join(' ').replace(/[-_]/g, ' ')
    if (BREADCRUMB_CONTAINER_RE.test(metadata)) blocks.push(`${tag}${inner}`)
  }
  const roleNavigationRe =
    /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']navigation["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleNavigationRe.exec(html))) {
    const tag = match[1] ?? ''
    const inner = match[3] ?? ''
    const metadata = [
      attributeValue(tag, 'class') ?? '',
      attributeValue(tag, 'id') ?? '',
      attributeValue(tag, 'aria-label') ?? '',
      attributeValue(tag, 'title') ?? ''
    ].join(' ').replace(/[-_]/g, ' ')
    if (BREADCRUMB_CONTAINER_RE.test(metadata)) blocks.push(`${tag}${inner}`)
  }
  for (const tagName of ['ol', 'ul', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        attributeValue(tag, 'class') ?? '',
        attributeValue(tag, 'id') ?? '',
        attributeValue(tag, 'aria-label') ?? '',
        attributeValue(tag, 'title') ?? ''
      ].join(' ').replace(/[-_]/g, ' ')
      if (BREADCRUMB_CONTAINER_RE.test(metadata)) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

function normalizedBreadcrumbLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/#-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function breadcrumbLabels(block: string): string[] {
  const labels = [
    ...pairedTagMatches(block, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'button').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'span').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'li').map(({ inner }) => textContent(inner))
  ]
  if (labels.length < 3) labels.push(...textContent(block).split(/\s*(?:\/|>|›|»|→)\s*/))
  return Array.from(new Set(labels.map(normalizedBreadcrumbLabel).filter(Boolean)))
}

function genericBreadcrumbLabel(text: string): boolean {
  const normalized = normalizedBreadcrumbLabel(text)
  return normalized.length > 0 && normalized.length <= 36 && GENERIC_BREADCRUMB_LABEL_RE.test(normalized)
}

function specificBreadcrumbLabel(text: string): boolean {
  const normalized = normalizedBreadcrumbLabel(text)
  return (
    normalized.length > 0 &&
    normalized.length <= 72 &&
    (SPECIFIC_BREADCRUMB_LABEL_RE.test(normalized) || concreteDataSignalCount(normalized) > 0)
  )
}

function genericBreadcrumbLabelBlocks(html: string, visibleText: string, prototypeLike = false): string[] {
  if (!prototypeLike && !hasProductAppScreenSignal(html, visibleText) && !hasProductAppChrome(html)) return []
  return breadcrumbBlocks(html).filter((block) => {
    const labels = breadcrumbLabels(block)
    if (labels.length < 3) return false
    const genericCount = labels.filter(genericBreadcrumbLabel).length
    const specificCount = labels.filter(specificBreadcrumbLabel).length
    return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
  })
}

function hasBrandLandingScreenSignal(html: string, visibleText: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ')
  const content = `${visibleText} ${metadata}`
  if (STRONG_BRAND_LANDING_SCREEN_RE.test(content)) return true
  return BRAND_LANDING_SCREEN_RE.test(content) && !hasProductAppScreenSignal(html, visibleText)
}

function hasVisualAnchorClass(html: string): boolean {
  return VISUAL_ANCHOR_CLASS_RE.test(attributeValues(html, 'class').join(' ').replace(/[-_]/g, ' '))
}

function hasPrimaryVisualAnchor(html: string, styles: string): boolean {
  if (/<(?:img|picture|video|iframe|canvas)\b/i.test(html)) return true
  if (VISUAL_ANCHOR_STYLE_RE.test(styles)) return true
  return hasVisualAnchorClass(html)
}

function hasWeakVisualAnchor(html: string, styles: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && hasBrandLandingScreenSignal(html, visibleText) && !hasPrimaryVisualAnchor(html, styles)
}

function visualAnchorBlocks(html: string): Array<{ tag: string; inner: string }> {
  return ['figure', 'section', 'article', 'div', 'aside']
    .flatMap((tagName) => pairedTagMatches(html, tagName))
    .filter(({ tag }) => {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      return VISUAL_ANCHOR_CLASS_RE.test(metadata)
    })
}

function hasConcretePreviewDetail(markup: string): boolean {
  if (/<(?:img|picture|video|iframe|canvas|svg)\b/i.test(markup)) return true
  const text = contentForDataRealism(textContent(markup))
  const hasUiStructure = /<(?:table|ul|ol|li|button|input|select|textarea)\b|\brole\s*=\s*["'](?:row|grid|list|listitem|progressbar|status)["']/i.test(markup)
  const hasConcreteData = concreteDataSignalCount(text) > 0
  return text.length >= 70 && hasUiStructure && hasConcreteData
}

function hasConcreteVisualAnchorDetail(markup: string): boolean {
  if (/<(?:img|picture|video|iframe|canvas)\b/i.test(markup)) return true
  if (VISUAL_ANCHOR_STYLE_RE.test(markup)) return true
  const text = contentForDataRealism(textContent(markup))
  const hasUiStructure = /<(?:table|ul|ol|li|button|input|select|textarea)\b|\brole\s*=\s*["'](?:row|grid|list|listitem|progressbar|status)["']/i.test(markup)
  const hasProductLabel = /\b(?:account|analytics|approval|browser|calendar|chart|customer|dashboard|dispatch|gallery|invoice|kanban|map|metric|order|pipeline|preview|project|record|report|row|screen|status|task|ticket|timeline|workflow)\b/i.test(text)
  const hasConcreteData = concreteDataSignalCount(text) > 0
  return (text.length >= 40 && hasConcreteData) || (text.length >= 64 && hasUiStructure && hasProductLabel)
}

function decorativeVisualAnchorTags(html: string): string[] {
  const weak: string[] = []
  for (const { tag, inner } of visualAnchorBlocks(html)) {
    const markup = `${tag}${inner}`
    const metadata = [
      ...attributeValues(markup, 'class'),
      ...attributeValues(markup, 'id'),
      ...attributeValues(markup, 'aria-label'),
      ...attributeValues(markup, 'title')
    ].join(' ').replace(/[-_]/g, ' ')
    if (!DECORATIVE_VISUAL_ANCHOR_RE.test(`${metadata} ${textContent(inner).slice(0, 160)}`)) continue
    if (!hasConcreteVisualAnchorDetail(markup)) weak.push(tag)
  }
  return weak
}

function hasWeakProductPreviewDetail(html: string, visibleText: string): boolean {
  const blocks = visualAnchorBlocks(html)
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    blocks.length > 0 &&
    blocks.some(({ tag, inner }) => !hasConcretePreviewDetail(`${tag}${inner}`))
  )
}

function hasWeakHeroViewportComposition(html: string, styles: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    meaningfulContentModuleCount(html) >= 2 &&
    HERO_VIEWPORT_LOCK_RE.test(styles)
  )
}

function hasTrustProof(html: string, visibleText: string): boolean {
  if (/<blockquote\b/i.test(html)) return true
  if (TRUST_PROOF_TEXT_RE.test(visibleText)) return true
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title'),
    ...attributeValues(html, 'alt')
  ].join(' ').replace(/[-_]/g, ' ')
  return TRUST_PROOF_CLASS_RE.test(metadata)
}

function hasWeakTrustProof(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && hasBrandLandingScreenSignal(html, visibleText) && !hasTrustProof(html, visibleText)
}

function normalizedTrustProofLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function genericTrustProofLabel(text: string): boolean {
  const normalized = normalizedTrustProofLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_TRUST_PROOF_LABEL_RE.test(normalized)
}

function genericTrustProofTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'div', 'ul', 'ol', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const headings = staticHeadingTexts(inner).join(' ')
      if (!TRUST_PROOF_CLASS_RE.test(`${metadata} ${headings}`) && !TRUST_PROOF_TEXT_RE.test(`${headings} ${textContent(inner)}`)) continue
      const labels = [
        ...['span', 'li', 'a', 'strong', 'b'].flatMap((labelTagName) =>
          pairedTagMatches(inner, labelTagName).map(({ inner: labelInner }) => textContent(labelInner))
        ),
        ...tagMatches(inner, 'img').map((imgTag) =>
          [attributeValue(imgTag, 'alt'), attributeValue(imgTag, 'aria-label'), attributeValue(imgTag, 'title')]
            .filter(Boolean)
            .join(' ')
        )
      ].map(normalizedTrustProofLabel).filter(Boolean)
      if (labels.filter(genericTrustProofLabel).length >= 2) weak.push(tag)
    }
  }
  return weak
}

function normalizedVanityMetricText(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}%+./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function genericVanityMetricText(text: string): boolean {
  const normalized = normalizedVanityMetricText(text)
  return (
    normalized.length >= 5 &&
    normalized.length <= 96 &&
    GENERIC_VANITY_METRIC_RE.test(normalized) &&
    !CONCRETE_METRIC_SPECIFICITY_RE.test(normalized)
  )
}

function genericVanityMetricTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'div', 'ul', 'ol', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const marker = `${metadata} ${staticHeadingTexts(inner).join(' ')} ${textContent(inner).slice(0, 220)}`
      if (!VANITY_METRIC_CONTAINER_RE.test(marker) && !TRUST_PROOF_CLASS_RE.test(marker) && !TRUST_PROOF_TEXT_RE.test(marker)) continue
      const labels = ['article', 'li', 'div', 'p', 'span', 'strong', 'b', 'h2', 'h3', 'small']
        .flatMap((labelTagName) => pairedTagMatches(inner, labelTagName).map(({ inner: labelInner }) => textContent(labelInner)))
        .map(normalizedVanityMetricText)
        .filter(Boolean)
      if (labels.filter(genericVanityMetricText).length >= 2) weak.push(tag)
    }
  }
  return weak
}

function testimonialBlocks(html: string): string[] {
  const blocks = pairedTagMatches(html, 'blockquote').map(({ tag, inner }) => `${tag}${inner}`)
  for (const tagName of ['section', 'article', 'div', 'li']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      if (TESTIMONIAL_CLASS_RE.test(metadata) && textContent(inner).length >= 32) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

function hasTestimonialAttribution(block: string): boolean {
  const text = textContent(block)
  const metadata = [
    ...attributeValues(block, 'class'),
    ...attributeValues(block, 'id'),
    ...attributeValues(block, 'aria-label'),
    ...attributeValues(block, 'title'),
    ...attributeValues(block, 'cite')
  ].join(' ').replace(/[-_]/g, ' ')
  return TESTIMONIAL_ATTRIBUTION_RE.test(`${text} ${metadata}`)
}

function hasWeakTestimonialAttribution(html: string, visibleText: string): boolean {
  const blocks = testimonialBlocks(html)
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    blocks.length > 0 &&
    blocks.some((block) => !hasTestimonialAttribution(block))
  )
}

function testimonialQuoteTexts(block: string): string[] {
  const quotes = ['blockquote', 'q']
    .flatMap((tagName) => pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner)))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length >= 16)
  if (quotes.length > 0) return quotes
  return pairedTagMatches(block, 'p')
    .map(({ inner }) => textContent(inner).replace(/\s+/g, ' ').trim())
    .filter((text) => text.length >= 24 && (!TESTIMONIAL_ATTRIBUTION_RE.test(text) || GENERIC_TESTIMONIAL_COPY_RE.test(text)))
}

function genericTestimonialCopyText(text: string): boolean {
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

function genericTestimonialCopyTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText)) return []
  return testimonialBlocks(html)
    .filter(hasTestimonialAttribution)
    .filter((block) => testimonialQuoteTexts(block).some(genericTestimonialCopyText))
    .slice(0, 4)
}

function marketingFeatureSurfaceSignal(html: string, visibleText: string): boolean {
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

function featureItemCount(markup: string): number {
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

function hasFeatureAnatomy(html: string): boolean {
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

function hasWeakFeatureAnatomy(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    marketingFeatureSurfaceSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    !hasFeatureAnatomy(html)
  )
}

function featureCardBlocks(html: string): string[] {
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

function genericFeatureCardDetail(block: string): boolean {
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

function genericFeatureCardDetailTags(html: string, visibleText: string): string[] {
  if (!marketingFeatureSurfaceSignal(html, visibleText) || !hasFeatureAnatomy(html)) return []
  const blocks = featureCardBlocks(html)
  if (blocks.length < 2) return []
  return blocks.filter(genericFeatureCardDetail).slice(0, 4)
}

function normalizedCardCopy(text: string): string {
  return contentForDataRealism(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$€£¥%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function duplicatedDesignCardCopyTexts(html: string): string[] {
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

function pricingSurfaceSignal(html: string, visibleText: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  const content = `${visibleText} ${metadata}`
  return hasBrandLandingScreenSignal(html, visibleText) && PRICING_SURFACE_RE.test(content) && PRICING_PRICE_RE.test(content)
}

function pricingPlanCount(html: string, visibleText: string): number {
  const classPlans = ['section', 'article', 'div', 'li']
    .flatMap((tagName) => tagMatches(html, tagName))
    .filter((tag) => PRICING_PLAN_CLASS_RE.test(normalizedClassText(tag))).length
  const priceValues = visibleText.match(PRICING_PRICE_GLOBAL_RE)?.length ?? 0
  return Math.max(classPlans, priceValues)
}

function hasPricingStructure(html: string, visibleText: string): boolean {
  if (pricingPlanCount(html, visibleText) < 2) return false
  const detailCount = [
    PRICING_RECOMMENDATION_RE.test(visibleText) || PRICING_RECOMMENDATION_RE.test(html),
    PRICING_CADENCE_RE.test(visibleText),
    PRICING_FEATURE_RE.test(visibleText),
    PRICING_ACTION_RE.test(textContent(html))
  ].filter(Boolean).length
  return detailCount >= 2
}

function hasWeakPricingStructure(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && pricingSurfaceSignal(html, visibleText) && !hasPricingStructure(html, visibleText)
}

function pricingPlanBlocks(html: string): string[] {
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

function genericPricingPlanDetail(block: string): boolean {
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC_PRICING_PLAN_DETAIL_RE.test(text) && !CONCRETE_PRICING_PLAN_DETAIL_RE.test(text)
}

function genericPricingPlanDetailTags(html: string, visibleText: string): string[] {
  if (!pricingSurfaceSignal(html, visibleText) || !hasPricingStructure(html, visibleText)) return []
  const blocks = pricingPlanBlocks(html)
  if (blocks.length < 2) return []
  return blocks.filter(genericPricingPlanDetail).slice(0, 4)
}

function pricingPlanActionLabels(block: string): string[] {
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

function genericPricingPlanActionLabel(text: string): boolean {
  const normalized = normalizedActionLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_PRICING_PLAN_ACTION_RE.test(normalized)
}

function genericPricingPlanActionLabelTags(html: string, visibleText: string): string[] {
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

function hasConversionClose(html: string, visibleText: string): boolean {
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

function hasWeakConversionClose(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && hasBrandLandingScreenSignal(html, visibleText) && !hasConversionClose(html, visibleText)
}

function conversionCloseBlocks(html: string): string[] {
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

function genericConversionCloseBlock(block: string): boolean {
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

function genericConversionCloseTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText) || !hasConversionClose(html, visibleText)) return []
  return conversionCloseBlocks(html).filter(genericConversionCloseBlock).slice(0, 4)
}

function faqBlocks(html: string): string[] {
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

function faqQuestionCount(markup: string): number {
  return faqQuestionTexts(markup).length
}

function faqQuestionTexts(markup: string): string[] {
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

function faqAnswerCount(markup: string): number {
  return ['p', 'dd', 'li']
    .flatMap((tagName) => pairedTagMatches(markup, tagName))
    .map(({ inner }) => contentForDataRealism(textContent(inner)))
    .filter((text) => text.length >= 28 && !FAQ_QUESTION_RE.test(text)).length
}

function hasFaqAnatomy(markup: string): boolean {
  return faqQuestionCount(markup) >= 2 && faqAnswerCount(markup) >= 2
}

function faqAnswerTexts(markup: string): string[] {
  return ['p', 'dd', 'li']
    .flatMap((tagName) => pairedTagMatches(markup, tagName))
    .map(({ inner }) => contentForDataRealism(textContent(inner)))
    .filter((text) => text.length >= 18 && !FAQ_QUESTION_RE.test(text))
}

function genericFaqAnswer(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  return normalized.length >= 18 && GENERIC_FAQ_ANSWER_RE.test(normalized) && !CONCRETE_FAQ_DETAIL_RE.test(normalized)
}

function genericFaqAnswerTags(html: string): string[] {
  return faqBlocks(html).filter((block) => hasFaqAnatomy(block) && faqAnswerTexts(block).filter(genericFaqAnswer).length >= 2)
}

function genericFaqQuestion(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  return normalized.length >= 8 && normalized.length <= 80 && GENERIC_FAQ_QUESTION_RE.test(normalized)
}

function concreteFaqQuestion(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  return normalized.length > 0 && CONCRETE_FAQ_QUESTION_RE.test(normalized)
}

function genericFaqQuestionTags(html: string): string[] {
  return faqBlocks(html).filter((block) => {
    if (!hasFaqAnatomy(block)) return false
    const questions = faqQuestionTexts(block)
    if (questions.length < 2) return false
    const genericCount = questions.filter(genericFaqQuestion).length
    const concreteCount = questions.filter(concreteFaqQuestion).length
    return concreteCount === 0 && genericCount >= Math.ceil(questions.length * 0.67)
  })
}

function hasWeakFaqAnatomy(html: string, visibleText: string): boolean {
  const blocks = faqBlocks(html)
  return hasBrandLandingScreenSignal(html, visibleText) && blocks.length > 0 && blocks.some((block) => !hasFaqAnatomy(block))
}

function hasSiteFooter(html: string): boolean {
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

function hasWeakSiteFooter(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    !hasSiteFooter(html)
  )
}

function siteFooterBlocks(html: string): string[] {
  return pairedTagMatches(html, 'footer').map(({ tag, inner }) => `${tag}${inner}`)
}

function genericSiteFooterLabel(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 32 && GENERIC_SITE_FOOTER_LABEL_RE.test(normalized)
}

function genericSiteFooterDetail(block: string): boolean {
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

function genericSiteFooterDetailTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText) || !hasSiteFooter(html)) return []
  return siteFooterBlocks(html).filter(genericSiteFooterDetail).slice(0, 4)
}

function hasBrandNavigation(html: string): boolean {
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

function isBrandIdentityText(text: string, allowSimpleName: boolean): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  if (normalized.length < 2 || normalized.length > 48) return false
  if (GENERIC_BRAND_IDENTITY_LABEL_RE.test(normalized)) return false
  if (BRAND_LANDING_SCREEN_RE.test(normalized)) return false
  if (BRAND_NAME_LIKE_RE.test(normalized)) return true
  return allowSimpleName && /^[A-Z][A-Za-z0-9&'.-]{2,24}(?:\s+[A-Z][A-Za-z0-9&'.-]{2,24}){0,2}$/.test(normalized)
}

function hasBrandIdentity(html: string): boolean {
  const blocks = [
    ...pairedTagMatches(html, 'header').map(({ tag, inner }) => `${tag}${inner}`),
    ...navigationBlocks(html)
  ]
  for (const block of blocks) {
    for (const tagName of ['a', 'span', 'strong', 'b', 'div']) {
      const items = pairedTagMatches(block, tagName)
      for (const { tag, inner } of items) {
        const metadata = [
          ...attributeValues(tag, 'class'),
          ...attributeValues(tag, 'id'),
          ...attributeValues(tag, 'aria-label'),
          ...attributeValues(tag, 'title')
        ].join(' ').replace(/[-_]/g, ' ')
        if (BRAND_IDENTITY_CLASS_RE.test(metadata) && isBrandIdentityText(textContent(inner), true)) return true
      }
    }
    for (const imgTag of tagMatches(block, 'img')) {
      const metadata = [
        ...attributeValues(imgTag, 'class'),
        ...attributeValues(imgTag, 'id'),
        ...attributeValues(imgTag, 'alt'),
        ...attributeValues(imgTag, 'aria-label'),
        ...attributeValues(imgTag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      if (BRAND_IDENTITY_CLASS_RE.test(metadata) && isBrandIdentityText(metadata, true)) return true
    }
    const firstNavLabel = ['a', 'button', 'span', 'strong', 'b']
      .flatMap((tagName) => pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner)))
      .find(Boolean)
    if (firstNavLabel && isBrandIdentityText(firstNavLabel, true)) return true
  }
  return topLevelHeadingTexts(html).some((heading) => isBrandIdentityText(heading, false))
}

function hasWeakBrandIdentity(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 180 &&
    hasBrandNavigation(html) &&
    !hasBrandIdentity(html)
  )
}

function hasWeakBrandNavigation(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 180 &&
    !hasBrandNavigation(html)
  )
}

function portfolioSurfaceSignal(html: string, visibleText: string): boolean {
  const headings = [...topLevelHeadingTexts(html), ...staticHeadingTexts(html)].join(' ')
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  const signal = `${headings} ${metadata}`
  if (!hasBrandLandingScreenSignal(html, visibleText) || !PORTFOLIO_SURFACE_RE.test(signal)) return false
  return !(/\bportfolio\b/i.test(signal) && PORTFOLIO_BUILDER_RE.test(signal))
}

function portfolioEntryCount(html: string): number {
  return ['section', 'article', 'div', 'li']
    .flatMap((tagName) => tagMatches(html, tagName))
    .filter((tag) => PORTFOLIO_ENTRY_CLASS_RE.test(normalizedClassText(tag))).length
}

function hasPortfolioProjectStructure(html: string, visibleText: string): boolean {
  return portfolioEntryCount(html) >= 2 && PORTFOLIO_OUTCOME_RE.test(visibleText) && PORTFOLIO_DETAIL_ACTION_RE.test(visibleText)
}

function hasWeakPortfolioStructure(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && portfolioSurfaceSignal(html, visibleText) && !hasPortfolioProjectStructure(html, visibleText)
}

function portfolioProjectBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const tagName of ['article', 'li', 'div', 'section']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const text = contentForDataRealism(textContent(inner))
      if (PORTFOLIO_ENTRY_CLASS_RE.test(metadata) && text.length >= 36) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

function genericPortfolioProjectDetail(block: string): boolean {
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC_PORTFOLIO_PROJECT_RE.test(text)
}

function genericPortfolioProjectDetailTags(html: string, visibleText: string): string[] {
  if (!portfolioSurfaceSignal(html, visibleText) || !hasPortfolioProjectStructure(html, visibleText)) return []
  const blocks = portfolioProjectBlocks(html)
  if (blocks.length < 2) return []
  return blocks.filter(genericPortfolioProjectDetail).slice(0, 4)
}

function topLevelHeadingTexts(html: string): string[] {
  const headings = pairedTagMatches(html, 'h1').map(({ inner }) => textContent(inner))
  const roleHeadingRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']heading["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleHeadingRe.exec(html))) {
    const tag = match[1] ?? ''
    if (attributeValue(tag, 'aria-level') === '1') headings.push(textContent(match[3] ?? ''))
  }
  return headings.map((text) => text.trim()).filter(Boolean)
}

function isGenericPageHeading(text: string): boolean {
  const normalized = text
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, '')
    .trim()
  return GENERIC_PAGE_HEADING_RE.test(normalized)
}

function isMetaPageHeading(text: string): boolean {
  const normalized = text
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return META_PAGE_HEADING_RE.test(normalized)
}

function normalizedHeadingText(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGenericSectionHeading(text: string): boolean {
  return GENERIC_SECTION_HEADING_RE.test(normalizedHeadingText(text))
}

function sectionHeadingTexts(html: string): string[] {
  const headings = ['h2', 'h3'].flatMap((tagName) =>
    pairedTagMatches(html, tagName).map(({ inner }) => textContent(inner))
  )
  const roleHeadingRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']heading["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleHeadingRe.exec(html))) {
    const tag = match[1] ?? ''
    const level = Number.parseInt(attributeValue(tag, 'aria-level') ?? '', 10)
    if (level === 2 || level === 3) headings.push(textContent(match[3] ?? ''))
  }
  return headings.map((text) => text.trim()).filter(Boolean)
}

function genericSectionHeadingTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText)) return []
  const genericHeadings = sectionHeadingTexts(html).filter(isGenericSectionHeading)
  return genericHeadings.length >= 2 ? genericHeadings.slice(0, 4) : []
}

function hasNavigationLandmark(html: string): boolean {
  return /<nav\b/i.test(html) || /\brole\s*=\s*["']navigation["']/i.test(html)
}

function navigationBlocks(html: string): string[] {
  const blocks = pairedTagMatches(html, 'nav').map(({ tag, inner }) => `${tag}${inner}`)
  const roleNavigationRe =
    /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']navigation["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleNavigationRe.exec(html))) blocks.push(`${match[1] ?? ''}${match[3] ?? ''}`)
  return blocks
}

function hasNavigationCurrentState(html: string): boolean {
  return (
    /\baria-current\s*=\s*["']?(?!false\b)[^"'\s>]+/i.test(html) ||
    /\baria-selected\s*=\s*["']true["']/i.test(html) ||
    /\bdata-state\s*=\s*["'](?:active|current|selected)["']/i.test(html) ||
    /\bclass\s*=\s*["'][^"']*\b(?:active|current|selected|is-active|is-current|is-selected)\b/i.test(html)
  )
}

function hasMultiItemPrototypeNavigationWithoutCurrentState(html: string): boolean {
  return navigationBlocks(html).some((block) => {
    const linkTargets = attributeValues(block, 'href').filter((target) => !isDeadHrefTarget(target, html))
    const prototypeTargets = [
      ...linkTargets.filter((target) => /\.html(?:[?#].*)?$/i.test(target) || target.includes('.html?')),
      ...attributeValues(block, 'data-prototype-target'),
      ...attributeValues(block, 'data-target')
    ]
    const roleTabs = tagMatches(block, 'button').filter((tag) => (attributeValue(tag, 'role') ?? '').toLowerCase() === 'tab')
    return prototypeTargets.length + roleTabs.length >= 2 && !hasNavigationCurrentState(block)
  })
}

function hasTabContainerClass(tag: string): boolean {
  return TAB_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

function tabControlCount(inner: string): number {
  const buttonsAndLinks = [...pairedTagMatches(inner, 'button'), ...pairedTagMatches(inner, 'a')]
    .filter(({ tag }) => (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() !== 'true')
    .length
  const radios = tagMatches(inner, 'input')
    .filter((tag) => (attributeValue(tag, 'type') ?? '').toLowerCase() === 'radio')
    .length
  const roleTabs = /role\s*=\s*["']tab["']/gi.exec(inner) ? (inner.match(/role\s*=\s*["']tab["']/gi)?.length ?? 0) : 0
  return Math.max(buttonsAndLinks + radios, roleTabs)
}

function tabControlLabels(inner: string): string[] {
  const labels = [
    ...pairedTagMatches(inner, 'button').map(({ tag, inner: buttonInner }) => controlLabel(tag, buttonInner)),
    ...pairedTagMatches(inner, 'a').map(({ tag, inner: anchorInner }) => controlLabel(tag, anchorInner)),
    ...['div', 'span', 'li'].flatMap((tagName) =>
      pairedTagMatches(inner, tagName)
        .filter(({ tag }) => (attributeValue(tag, 'role') ?? '').toLowerCase() === 'tab')
        .map(({ tag, inner: tabInner }) => controlLabel(tag, tabInner))
    )
  ]
  for (const tag of tagMatches(inner, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (type === 'radio') labels.push(controlLabel(tag))
  }
  return Array.from(new Set(labels.map(normalizedHeadingText).filter(Boolean)))
}

function genericTabLabel(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_TAB_LABEL_RE.test(normalized)
}

function specificTabLabel(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 48 && SPECIFIC_TAB_LABEL_RE.test(normalized)
}

function genericTabLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText)) return []
  const weak: string[] = []
  for (const tagName of ['div', 'section', 'nav', 'ul']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const tabLike = role === 'tablist' || hasTabContainerClass(tag)
      if (!tabLike || tabControlCount(inner) < 2 || !hasNavigationCurrentState(`${tag}${inner}`)) continue
      const labels = tabControlLabels(inner)
      if (labels.length < 2) continue
      const genericCount = labels.filter(genericTabLabel).length
      const specificCount = labels.filter(specificTabLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

function weakTabCurrentStateTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['div', 'section', 'nav', 'ul']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const tabLike = role === 'tablist' || hasTabContainerClass(tag)
      if (!tabLike || tabControlCount(inner) < 2) continue
      if (!hasNavigationCurrentState(`${tag}${inner}`)) weak.push(tag)
    }
  }
  return weak
}

function hasWorkflowStepContainerClass(tag: string): boolean {
  return WORKFLOW_STEP_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

function workflowStepItemCount(inner: string): number {
  const classItems = ['li', 'div', 'article', 'section']
    .flatMap((tagName) => tagMatches(inner, tagName))
    .filter((tag) => WORKFLOW_STEP_ITEM_CLASS_RE.test(normalizedClassText(tag))).length
  const listItems = tagMatches(inner, 'li').length
  const orderedText = textContent(inner)
  const numberedSteps = orderedText.match(/\b(?:step\s*)?\d+[.)]\s+[A-Z]/g)?.length ?? 0
  return Math.max(classItems, listItems, numberedSteps)
}

function normalizedWorkflowStepLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&.)/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function workflowStepLabels(inner: string): string[] {
  const labels = ['li', 'div', 'article', 'section']
    .flatMap((tagName) =>
      pairedTagMatches(inner, tagName)
        .filter(({ tag }) => tagName === 'li' || WORKFLOW_STEP_ITEM_CLASS_RE.test(normalizedClassText(tag)))
        .map(({ inner: itemInner }) => textContent(itemInner))
    )
    .map(normalizedWorkflowStepLabel)
    .filter((label) => label.length > 0 && label.length <= 64)
  return Array.from(new Set(labels))
}

function genericWorkflowStepLabel(text: string): boolean {
  const normalized = normalizedWorkflowStepLabel(text)
  return GENERIC_WORKFLOW_STEP_LABEL_RE.test(normalized)
}

function specificWorkflowStepLabel(text: string): boolean {
  const normalized = normalizedWorkflowStepLabel(text)
  return SPECIFIC_WORKFLOW_STEP_LABEL_RE.test(normalized)
}

function hasWorkflowStepState(markup: string): boolean {
  return WORKFLOW_STEP_STATE_RE.test(markup)
}

function genericWorkflowStepLabelTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['ol', 'ul', 'div', 'section', 'article', 'nav']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const workflowLike = hasWorkflowStepContainerClass(tag) || role === 'progressbar'
      if (!workflowLike || workflowStepItemCount(inner) < 3 || !hasWorkflowStepState(`${tag}${inner}`)) continue
      const labels = workflowStepLabels(inner)
      if (labels.length < 3) continue
      const genericCount = labels.filter(genericWorkflowStepLabel).length
      const specificCount = labels.filter(specificWorkflowStepLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

function weakWorkflowStepStateTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['ol', 'ul', 'div', 'section', 'article', 'nav']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const workflowLike = hasWorkflowStepContainerClass(tag) || role === 'progressbar'
      if (!workflowLike || workflowStepItemCount(inner) < 3) continue
      if (!hasWorkflowStepState(`${tag}${inner}`)) weak.push(tag)
    }
  }
  return weak
}

function hasGenericPurpleBlueGradient(html: string): boolean {
  const styles = styleContent(html)
  const gradients = styles.match(/(?:linear|radial|conic)-gradient\([^)]*\)/gi) ?? []
  return gradients.some((gradient) => {
    const hits = gradient.match(AI_GRADIENT_COLOR_RE) ?? []
    return hits.length >= 2
  })
}

function colorLiteralCount(styles: string): number {
  return new Set((styles.match(COLOR_LITERAL_RE) ?? []).map((color) => color.toLowerCase())).size
}

function hasWeakColorSystem(styles: string): boolean {
  return colorLiteralCount(styles) >= 8 && !CSS_CUSTOM_PROPERTY_RE.test(styles)
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(normalizeHue(a) - normalizeHue(b))
  return Math.min(distance, 360 - distance)
}

function rgbToHsl(r: number, g: number, b: number): ParsedCssColor {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h = 0
  if (max === red) h = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) h = (blue - red) / delta + 2
  else h = (red - green) / delta + 4
  return { h: normalizeHue(h * 60), s, l }
}

function parseHexColor(raw: string): ParsedCssColor | undefined {
  const hex = raw.trim().replace(/^#/, '')
  if (![3, 4, 6, 8].includes(hex.length)) return undefined
  const expanded = hex.length <= 4 ? hex.slice(0, 3).replace(/./g, (char) => char + char) : hex.slice(0, 6)
  const value = Number.parseInt(expanded, 16)
  if (!Number.isFinite(value)) return undefined
  return rgbToHsl((value >> 16) & 255, (value >> 8) & 255, value & 255)
}

function parseRgbChannel(raw: string): number | undefined {
  const value = raw.trim()
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(255, value.endsWith('%') ? (parsed / 100) * 255 : parsed))
}

function parseRgbColor(raw: string): ParsedCssColor | undefined {
  const match = /^rgba?\(([^)]+)\)$/i.exec(raw.trim())
  if (!match) return undefined
  const channels = match[1]
    ?.replace(/\/.*$/, ' ')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(parseRgbChannel)
  if (!channels || channels.length < 3 || channels.some((channel) => channel === undefined)) return undefined
  return rgbToHsl(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0)
}

function parseHueToken(raw: string): number | undefined {
  const match = /^([-+]?\d*\.?\d+)(deg|turn|rad|grad)?$/i.exec(raw.trim())
  if (!match) return undefined
  const value = Number.parseFloat(match[1] ?? '')
  if (!Number.isFinite(value)) return undefined
  const unit = (match[2] ?? 'deg').toLowerCase()
  if (unit === 'turn') return normalizeHue(value * 360)
  if (unit === 'rad') return normalizeHue((value * 180) / Math.PI)
  if (unit === 'grad') return normalizeHue(value * 0.9)
  return normalizeHue(value)
}

function parseHslPercent(raw: string): number | undefined {
  const value = raw.trim()
  if (!value.endsWith('%')) return undefined
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(1, parsed / 100))
}

function parseHslColor(raw: string): ParsedCssColor | undefined {
  const match = /^hsla?\(([^)]+)\)$/i.exec(raw.trim())
  if (!match) return undefined
  const parts = (match[1] ?? '')
    .replace(/\/.*$/, ' ')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const h = parseHueToken(parts[0] ?? '')
  const s = parseHslPercent(parts[1] ?? '')
  const l = parseHslPercent(parts[2] ?? '')
  if (h === undefined || s === undefined || l === undefined) return undefined
  return { h, s, l }
}

function parseCssColor(raw: string): ParsedCssColor | undefined {
  if (raw.startsWith('#')) return parseHexColor(raw)
  if (/^rgba?\(/i.test(raw)) return parseRgbColor(raw)
  if (/^hsla?\(/i.test(raw)) return parseHslColor(raw)
  return undefined
}

function cssPaletteColors(styles: string): ParsedCssColor[] {
  const unique = new Set((styles.match(COLOR_LITERAL_RE) ?? []).map((color) => color.toLowerCase()))
  return [...unique].map(parseCssColor).filter((color): color is ParsedCssColor => Boolean(color))
}

function largestHueClusterCount(colors: ParsedCssColor[], radius: number): number {
  return colors.reduce(
    (largest, color) => Math.max(largest, colors.filter((item) => hueDistance(item.h, color.h) <= radius).length),
    0
  )
}

function hasOneNotePalette(styles: string): boolean {
  const chromaticColors = cssPaletteColors(styles).filter((color) => color.s >= 0.18 && color.l >= 0.08 && color.l <= 0.95)
  if (chromaticColors.length < 5) return false
  const largestCluster = largestHueClusterCount(chromaticColors, 22)
  return largestCluster >= 5 && largestCluster / chromaticColors.length >= 0.78
}

function hasMissingLayoutReset(html: string, styles: string): boolean {
  return VISUAL_MEDIA_TAG_RE.test(html) && (!GLOBAL_BOX_SIZING_RE.test(styles) || !FLUID_MEDIA_RULE_RE.test(styles))
}

function spacingValueTokens(styles: string): string[] {
  const values: string[] = []
  let match: RegExpExecArray | null
  SPACING_DECLARATION_RE.lastIndex = 0
  while ((match = SPACING_DECLARATION_RE.exec(styles))) {
    const declaration = match[1] ?? ''
    if (/\b(var|calc|clamp|min|max|auto)\s*\(/i.test(declaration) || /\bauto\b/i.test(declaration)) continue
    const tokens = declaration.match(/\b\d*\.?\d+(?:px|rem)\b/gi) ?? []
    for (const token of tokens) {
      const normalized = token.toLowerCase()
      if (normalized !== '0px' && normalized !== '0rem') values.push(normalized)
    }
  }
  return values
}

function hasWeakSpacingSystem(styles: string): boolean {
  if (SPACING_TOKEN_RE.test(styles)) return false
  const values = spacingValueTokens(styles)
  if (values.length < 8) return false
  const defaultCount = values.filter((value) => value === '16px' || value === '1rem').length
  const uniqueCount = new Set(values).size
  return defaultCount >= 6 && defaultCount / values.length >= 0.65 && uniqueCount <= 3
}

function hasFixedDesktopFrame(styles: string): boolean {
  return FIXED_DESKTOP_FRAME_RE.test(styles) || VIEWPORT_LOCK_RE.test(styles)
}

function hasWeakTypographyConstraints(styles: string): boolean {
  return UNBOUNDED_VIEWPORT_FONT_RE.test(styles) || NEGATIVE_LETTER_SPACING_RE.test(styles)
}

function radiusPx(value: string | undefined): number | undefined {
  if (!value || /\b(var|calc|min|max|clamp)\s*\(/i.test(value)) return undefined
  const values = [...value.matchAll(/(\d*\.?\d+)\s*(px|rem|em)\b/gi)]
    .map((match) => {
      const amount = Number.parseFloat(match[1] ?? '')
      if (!Number.isFinite(amount)) return undefined
      const unit = (match[2] ?? '').toLowerCase()
      return unit === 'px' ? amount : amount * 16
    })
    .filter((amount): amount is number => amount !== undefined)
  return values.length > 0 ? Math.max(...values) : undefined
}

function hasCardLikeSelector(selector: string): boolean {
  return /(?:^|[.#\s>+~_-])(?:card|panel|surface|tile)(?:$|[.#\s>+~_-])/i.test(selector)
}

function hasOverRoundedCardStyling(styles: string): boolean {
  CSS_RULE_BLOCK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CSS_RULE_BLOCK_RE.exec(styles))) {
    const selector = match[1] ?? ''
    const block = match[2] ?? ''
    if (!hasCardLikeSelector(selector)) continue
    const radius = radiusPx(declarationValue(block, 'border-radius'))
    if (radius !== undefined && radius >= 18) return true
  }
  return false
}

function declarationValue(block: string, property: string): string | undefined {
  return new RegExp(`\\b${property}\\s*:\\s*([^;{}]+)`, 'i').exec(block)?.[1]?.trim()
}

function fontSizePx(value: string | undefined): number | undefined {
  if (!value || /\b(var|calc|min|max)\s*\(/i.test(value)) return undefined
  const matches = [...value.matchAll(/(-?\d*\.?\d+)\s*(px|rem|em)\b/gi)]
  if (matches.length === 0) return undefined
  const values = matches
    .map((match) => {
      const amount = Number.parseFloat(match[1] ?? '')
      if (!Number.isFinite(amount) || amount <= 0) return undefined
      const unit = (match[2] ?? '').toLowerCase()
      return unit === 'px' ? amount : amount * 16
    })
    .filter((amount): amount is number => amount !== undefined)
  return values.length > 0 ? Math.max(...values) : undefined
}

function fontWeightValue(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'bold') return 700
  if (normalized === 'normal') return 400
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function hasWeakTypeHierarchy(html: string, styles: string): boolean {
  if (!hasTopLevelHeading(html)) return false
  const headingSizes: number[] = []
  const bodySizes: number[] = []
  const headingWeights: number[] = []
  const bodyWeights: number[] = []
  CSS_RULE_BLOCK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CSS_RULE_BLOCK_RE.exec(styles))) {
    const selector = match[1] ?? ''
    const block = match[2] ?? ''
    const size = fontSizePx(declarationValue(block, 'font-size'))
    const weight = fontWeightValue(declarationValue(block, 'font-weight'))
    if (HEADING_SELECTOR_RE.test(selector)) {
      if (size !== undefined) headingSizes.push(size)
      if (weight !== undefined) headingWeights.push(weight)
    }
    if (BODY_TEXT_SELECTOR_RE.test(selector)) {
      if (size !== undefined) bodySizes.push(size)
      if (weight !== undefined) bodyWeights.push(weight)
    }
  }
  if (headingSizes.length === 0) return false
  const headingSize = Math.max(...headingSizes)
  const bodySize = bodySizes.length > 0 ? Math.max(...bodySizes) : 16
  const headingWeight = headingWeights.length > 0 ? Math.max(...headingWeights) : 700
  const bodyWeight = bodyWeights.length > 0 ? Math.max(...bodyWeights) : 400
  const ratio = headingSize / Math.max(bodySize, 1)
  const weakSize = headingSize < 22 && ratio < 1.35
  const weakWeight = headingWeight <= bodyWeight + 150
  return (ratio < 1.18 && weakWeight) || (weakSize && headingWeight < 750)
}

function hasCenterEverythingLayout(styles: string): boolean {
  const centeredTextBlocks =
    styles.match(/(?:body|main|\.hero|\.page|\.app|\.container|section)\s*{[^}]*text-align\s*:\s*center[^}]*}/gi) ?? []
  const centeredFlexBlocks =
    styles.match(
      /(?:body|main|\.hero|\.page|\.app|\.container|section)\s*{(?=[^}]*display\s*:\s*flex)(?=[^}]*justify-content\s*:\s*center)(?=[^}]*align-items\s*:\s*center)[^}]*}/gi
    ) ?? []
  return centeredTextBlocks.length >= 2 || (centeredTextBlocks.length >= 1 && centeredFlexBlocks.length >= 1)
}

function countEmoji(text: string): number {
  return [...text.matchAll(EMOJI_RE)].length
}

function hasSiblingPrototypeNavigation(
  html: string,
  siblingScreens: DesignHtmlQualityAuditSibling[] | undefined
): boolean {
  const expectedTargets = new Set(
    (siblingScreens ?? [])
      .flatMap((screen) => [screen.htmlPath, screen.prototypeHref ?? ''])
      .map(normalizePrototypeTarget)
      .filter(Boolean)
  )
  if (expectedTargets.size === 0) return true
  const explicitTargets = [
    ...attributeValues(html, 'href'),
    ...attributeValues(html, 'data-prototype-target'),
    ...attributeValues(html, 'data-target')
  ].map(normalizePrototypeTarget)
  if (explicitTargets.some((target) => expectedTargets.has(target))) return true
  const lower = normalizePath(html).toLowerCase()
  return [...expectedTargets].some((target) => target.length > 2 && lower.includes(target.toLowerCase()))
}

function linkedSiblingPrototypeTargetCount(
  html: string,
  siblingScreens: DesignHtmlQualityAuditSibling[] | undefined
): number {
  const expectedByScreen = (siblingScreens ?? [])
    .map((screen) => [screen.htmlPath, screen.prototypeHref ?? ''].map(normalizePrototypeTarget).filter(Boolean))
    .filter((targets) => targets.length > 0)
  if (expectedByScreen.length === 0) return 0
  const explicitTargets = [
    ...attributeValues(html, 'href'),
    ...attributeValues(html, 'data-prototype-target'),
    ...attributeValues(html, 'data-target')
  ].map(normalizePrototypeTarget)
  const lower = normalizePath(html).toLowerCase()
  return expectedByScreen.filter((targets) =>
    targets.some((target) => explicitTargets.includes(target) || (target.length > 2 && lower.includes(target.toLowerCase())))
  ).length
}

const runtimeQualityFindings = new Map<string, DesignHtmlQualityFinding[]>()

export function setDesignRuntimeQualityFindings(
  artifactRelativePath: string,
  findings: DesignHtmlQualityFinding[]
): void {
  const key = normalizePath(artifactRelativePath)
  if (!key) return
  runtimeQualityFindings.set(key, normalizeRuntimeQualityFindings(findings))
}

export function getDesignRuntimeQualityFindings(artifactRelativePath: string | undefined): DesignHtmlQualityFinding[] {
  const key = normalizePath(artifactRelativePath ?? '')
  if (!key) return []
  return runtimeQualityFindings.get(key)?.slice() ?? []
}

export function clearDesignRuntimeQualityFindings(artifactRelativePath: string): void {
  const key = normalizePath(artifactRelativePath)
  if (key) runtimeQualityFindings.delete(key)
}

export function shouldAutoRepairDesignHtmlFinding(finding: DesignHtmlQualityFinding | undefined): boolean {
  if (!finding) return false
  if (finding.severity === 'critical') return true
  if (finding.severity !== 'warning') return false
  return AUTO_REPAIR_WARNING_CODES.has(normalizeQualityCode(finding.code))
}

export function mergeDesignHtmlQualityFindings(
  ...groups: Array<DesignHtmlQualityFinding[] | undefined>
): DesignHtmlQualityFinding[] {
  const merged = new Map<string, DesignHtmlQualityFinding>()
  for (const group of groups) {
    for (const finding of normalizeRuntimeQualityFindings(group ?? [])) {
      const existing = merged.get(finding.code)
      if (!existing || severityRank(finding.severity) < severityRank(existing.severity)) {
        merged.set(finding.code, finding)
      }
    }
  }
  return [...merged.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

export function normalizeRuntimeQualityFindings(value: unknown): DesignHtmlQualityFinding[] {
  if (!Array.isArray(value)) return []
  const findings: DesignHtmlQualityFinding[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const code = typeof record.code === 'string' ? record.code.trim() : ''
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    const suggestion = typeof record.suggestion === 'string' ? record.suggestion.trim() : ''
    const severity =
      record.severity === 'critical' || record.severity === 'warning' || record.severity === 'info'
        ? record.severity
        : 'warning'
    if (!code || !message || !suggestion) continue
    findings.push({ code, severity, message, suggestion })
    if (findings.length >= 12) break
  }
  return findings
}

export function summarizeDesignHtmlQualityStatus(
  findings: DesignHtmlQualityFinding[] | undefined,
  checked: boolean
): DesignHtmlQualityStatus {
  if (!checked) {
    return {
      kind: 'checking',
      label: 'Quality check',
      title: 'Kun is checking the rendered design for layout and accessibility issues.',
      count: 0
    }
  }
  const items = normalizeRuntimeQualityFindings(findings ?? [])
  const autoRepairable = items.filter(shouldAutoRepairDesignHtmlFinding)
  if (autoRepairable.length > 0) {
    return {
      kind: 'critical',
      label: `Auto repair ${autoRepairable.length}`,
      title: autoRepairable.map((finding) => `${finding.code}: ${finding.message}`).join('\n'),
      count: autoRepairable.length
    }
  }
  const warnings = items.filter((finding) => finding.severity === 'warning')
  if (warnings.length > 0) {
    return {
      kind: 'warning',
      label: `Quality ${warnings.length}`,
      title: warnings.map((finding) => `${finding.code}: ${finding.message}`).join('\n'),
      count: warnings.length
    }
  }
  return {
    kind: 'passed',
    label: 'Quality OK',
    title: 'Rendered quality check passed.',
    count: 0
  }
}

export function summarizeDesignHtmlQualityDetails(
  findings: DesignHtmlQualityFinding[] | undefined,
  checked: boolean,
  limit = 5
): DesignHtmlQualityDetails {
  const maxRows = Math.max(0, Math.floor(limit))
  if (!checked) {
    return {
      heading: 'Quality check running',
      body: 'Checking the rendered preview for layout, contrast, and tap target issues.',
      rows: [],
      overflowCount: 0
    }
  }

  const items = mergeDesignHtmlQualityFindings(findings)
  if (items.length === 0) {
    return {
      heading: 'Quality OK',
      body: 'Rendered layout, contrast, tap targets, and overflow checks passed.',
      rows: [],
      overflowCount: 0
    }
  }

  const criticalCount = items.filter((finding) => finding.severity === 'critical').length
  const warningCount = items.filter((finding) => finding.severity === 'warning').length
  const infoCount = items.filter((finding) => finding.severity === 'info').length
  const countLabel = (count: number, singular: string): string =>
    singular === 'critical' ? `${count} critical` : `${count} ${singular}${count === 1 ? '' : 's'}`
  const counts = [
    criticalCount > 0 ? countLabel(criticalCount, 'critical') : '',
    warningCount > 0 ? countLabel(warningCount, 'warning') : '',
    infoCount > 0 ? countLabel(infoCount, 'note') : ''
  ].filter(Boolean)

  return {
    heading: criticalCount > 0 ? 'Needs auto repair' : warningCount > 0 ? 'Quality issues' : 'Quality notes',
    body: `${counts.join(', ')} found in the rendered preview.`,
    rows: items.slice(0, maxRows),
    overflowCount: Math.max(0, items.length - maxRows)
  }
}

export function buildDesignRuntimeQualityAuditScript(): string {
  return String.raw`(() => {
    const findings = []
    const push = (code, severity, message, suggestion) => {
      if (!findings.some((item) => item.code === code)) findings.push({ code, severity, message, suggestion })
    }
    if (/generating design preview/i.test(document.title || '') || /Kun is preparing a live preview/i.test(document.body?.innerText || '')) return []
    const pageText = (document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ').trim()
    const documentTitle = (document.querySelector('title')?.textContent || document.title || '').replace(/\s+/g, ' ').trim()
    const genericDocumentTitle = (title) => {
      const normalized = String(title || '')
        .replace(/&amp;/gi, '&')
        .replace(/[\s:|/\\-]+/g, ' ')
        .replace(/[^\p{L}\p{N}& ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return /^(?:untitled|draft|new page|page|website|site|homepage|home page|landing page|marketing site|brand site|portfolio|pricing page|plans page|product page|demo|test|preview)$/i.test(normalized) ||
        /\b(lorem ipsum|placeholder|todo|tbd|sample data|example (card|title|user|company|product)|card title|feature [0-9]+|item [0-9]+|user name|your company|product name)\b/i.test(normalized) ||
        /\b(?:(?:landing|marketing|brand|portfolio|pricing|plans?|product|home(?:page)?|case[- ]stud(?:y|ies)|features?)\s+(?:page|site|website)|(?:page|site|website))\s+(?:for|about|to)\b/i.test(normalized)
    }
    if (!documentTitle) {
      push('runtime-missing-document-title', 'warning', 'The HTML document has no meaningful <title>.', 'Add a concise document title that names the product, brand, screen, or offer for browser tabs and handoff.')
    } else if (genericDocumentTitle(documentTitle)) {
      push('runtime-generic-document-title', 'warning', 'The HTML document title is generic or prompt-like.', 'Replace the document title with a specific product, brand, screen, or offer name instead of Draft, Untitled, or page-type copy.')
    }
    const vagueCopyPatterns = [
      /\btransform (your|the) (workflow|business|team|experience)\b/i,
      /\bunleash (your|the)? ?(creative )?potential\b/i,
      /\b(all[- ]in[- ]one|one[- ]stop) (platform|solution|toolkit|workspace)\b/i,
      /\b(powerful|innovative|cutting[- ]edge) (platform|solution|tools|experience)\b/i,
      /\bseamless (experience|workflow|collaboration|integration)\b/i,
      /\bdesigned for modern teams\b/i,
      /\belevate your (business|brand|workflow|experience)\b/i,
      /\bstreamline (your|the) (workflow|operations|process)\b/i,
      /\bboost (productivity|efficiency|growth)\b/i,
      /\beverything you need\b/i,
      /\brevolutioni[sz]e (your|the) (workflow|business|industry|experience)\b/i,
      /\bnext[- ]generation (platform|solution|experience|tools)\b/i
    ]
    const vagueCopyHits = vagueCopyPatterns.filter((pattern) => pattern.test(pageText)).length
    if (vagueCopyHits >= 2) {
      push('runtime-vague-template-copy', 'warning', 'The visible page copy relies on generic template phrases.', 'Replace vague claims with domain-specific user tasks, concrete data, names, prices, dates, or outcome-focused microcopy.')
    }
    const rectFor = (el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    }
    const visible = (el) => {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
    }
    const textOf = (el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || el.placeholder || el.getAttribute('aria-label') || ''
      return (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()
    }
    const parseRgb = (value) => {
      const m = String(value || '').match(/rgba?\(([^)]+)\)/i)
      if (!m) return null
      const parts = m[1].split(',').map((part) => Number.parseFloat(part.trim()))
      if (parts.length < 3 || parts.some((n, i) => i < 3 && !Number.isFinite(n))) return null
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1 }
    }
    const linear = (channel) => {
      const c = Math.max(0, Math.min(255, channel)) / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    const luminance = (rgb) => 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
    const contrast = (fg, bg) => {
      const a = fg.a >= 0 ? fg.a : 1
      const blended = {
        r: fg.r * a + bg.r * (1 - a),
        g: fg.g * a + bg.g * (1 - a),
        b: fg.b * a + bg.b * (1 - a),
        a: 1
      }
      const l1 = luminance(blended)
      const l2 = luminance(bg)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const backgroundFor = (el) => {
      let current = el
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        const bg = parseRgb(getComputedStyle(current).backgroundColor)
        if (bg && bg.a > 0.01) return bg
        current = current.parentElement
      }
      return { r: 255, g: 255, b: 255, a: 1 }
    }
    const doc = document.documentElement
    const body = document.body
    const scrollWidth = Math.max(doc?.scrollWidth || 0, body?.scrollWidth || 0)
    if (scrollWidth > Math.ceil(innerWidth) + 6) {
      push('runtime-horizontal-overflow', 'critical', 'The rendered page is wider than the viewport.', 'Remove fixed-width wrappers or add responsive constraints so mobile/tablet previews do not scroll sideways.')
    }
    const numericStyle = (value) => {
      const parsed = Number.parseFloat(String(value || '0'))
      return Number.isFinite(parsed) ? parsed : 0
    }
    const viewportLocked = [doc, body].filter(Boolean).some((el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      const lockedOverflow = ['hidden', 'clip'].includes(style.overflow) || ['hidden', 'clip'].includes(style.overflowY)
      const fillsViewport = Math.abs(rect.height - innerHeight) <= 4 || Math.abs(numericStyle(style.height) - innerHeight) <= 4
      return lockedOverflow && fillsViewport && Math.max(doc?.scrollHeight || 0, body?.scrollHeight || 0) > innerHeight + 24
    })
    const fixedDesktopShells = innerWidth < 1000
      ? [...document.querySelectorAll('body > *, main, .app, .page, .container')]
        .filter(visible)
        .filter((el) => {
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return numericStyle(style.minWidth) >= 1100 || (numericStyle(style.width) >= 1100 && rect.width > innerWidth + 6)
        })
      : []
    if (viewportLocked || fixedDesktopShells.length > 0) {
      push('runtime-fixed-desktop-frame', 'warning', 'The rendered page appears locked to a desktop-sized canvas.', 'Replace fixed desktop widths or viewport-height overflow locks with fluid max-widths, wrapping grids, and responsive section heights.')
    }
    const interactive = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])')].filter(visible)
    const deadHref = (el) => {
      const raw = (el.getAttribute('href') || '').trim()
      if (!raw || raw === '#') return true
      if (/^javascript\s*:/i.test(raw)) return true
      if (raw.startsWith('#')) {
        const id = raw.slice(1)
        return !document.getElementById(id) && document.getElementsByName(id).length === 0
      }
      return false
    }
    const deadLinks = [...document.querySelectorAll('a')]
      .filter(visible)
      .filter(deadHref)
    if (deadLinks.length > 0) {
      push('runtime-dead-links', 'warning', deadLinks.length + ' visible link target(s) are empty, "#", or javascript-only.', 'Replace dead links with real prototype hrefs, valid section anchors, or buttons that implement local UI feedback.')
    }
    const prototypeNavigationsWithoutCurrent = [...document.querySelectorAll('nav,[role="navigation"]')]
      .filter(visible)
      .filter((nav) => {
        const prototypeLinks = [...nav.querySelectorAll('a,[data-prototype-target],[data-target],[role="tab"]')]
          .filter(visible)
          .filter((el) => {
            const role = (el.getAttribute('role') || '').toLowerCase()
            const href = (el.getAttribute('href') || '').trim()
            return role === 'tab' || el.hasAttribute('data-prototype-target') || el.hasAttribute('data-target') || /\.html(?:[?#].*)?$/i.test(href) || href.includes('.html?')
          })
        if (prototypeLinks.length < 2) return false
        return !nav.querySelector('[aria-current]:not([aria-current="false"]),[aria-selected="true"],[data-state="active"],[data-state="current"],[data-state="selected"],.active,.current,.selected,.is-active,.is-current,.is-selected')
      })
    if (prototypeNavigationsWithoutCurrent.length > 0) {
      push('runtime-missing-navigation-current-state', 'warning', prototypeNavigationsWithoutCurrent.length + ' multi-screen navigation group(s) have no current-page state.', 'Mark the current page, tab, or breadcrumb with aria-current, aria-selected, data-state="active", or a visible active/current style.')
    }
    const visibleImages = [...document.querySelectorAll('img')].filter(visible)
    const decorativeImage = (el) => {
      const role = (el.getAttribute('role') || '').toLowerCase()
      return role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true' || el.hasAttribute('alt')
    }
    const unnamedImages = visibleImages.filter((el) => {
      if (decorativeImage(el)) return false
      return !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title')
    })
    if (unnamedImages.length > 0) {
      push('runtime-missing-image-alt', 'warning', unnamedImages.length + ' visible image(s) have no alt text or accessible name.', 'Add meaningful alt text, aria-label/aria-labelledby, or mark decorative images with alt="", aria-hidden="true", or role="presentation".')
    }
    const imageAccessibleText = (el) => {
      const alt = el.getAttribute('alt')
      if (alt !== null) return alt.trim()
      return (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim()
    }
    const genericImageAlts = visibleImages.filter((el) => {
      const role = (el.getAttribute('role') || '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
      const label = imageAccessibleText(el).replace(/\s+/g, ' ').trim()
      return label.length > 0 &&
        label.length <= 48 &&
        /^(?:app )?(?:image|photo|picture|graphic|illustration|screenshot|screen shot|preview|mockup|hero image|hero visual|product image|product screenshot|product preview|dashboard screenshot|customer photo|team photo|placeholder image)$/i.test(label)
    })
    if (genericImageAlts.length > 0) {
      push('runtime-generic-image-alt', 'warning', genericImageAlts.length + ' visible image(s) use generic alt text or accessible names.', 'Replace generic labels such as Image, Screenshot, or Product preview with the product, person, place, screen, or content shown.')
    }
    const brokenImages = visibleImages.filter((el) => {
      const src = (el.getAttribute('src') || el.currentSrc || '').trim()
      if (!src || src === '#' || /^javascript\s*:/i.test(src)) return true
      return el.complete && (el.naturalWidth <= 0 || el.naturalHeight <= 0)
    })
    if (brokenImages.length > 0) {
      push('runtime-broken-images', 'warning', brokenImages.length + ' visible image(s) did not load.', 'Use valid workspace-relative image paths, embedded data URLs, or replace broken media with an intentional designed placeholder.')
    }
    const forms = [...document.querySelectorAll('form')].filter(visible)
    const pageScripts = [...document.querySelectorAll('script')].map((script) => script.textContent || '').join('\n')
    const hasFormScript = /\b(submit|onsubmit|preventDefault|FormData|classList|toast|alert|aria-busy)\b/i.test(pageScripts)
    const inertForms = forms.filter((form) => {
      const action = (form.getAttribute('action') || '').trim()
      if (action && action !== '#' && !/^javascript\s*:/i.test(action)) return false
      if (form.getAttribute('onsubmit')) return false
      if (hasFormScript) return false
      return !form.querySelector('button[formaction],input[formaction]')
    })
    if (inertForms.length > 0) {
      push('runtime-inert-form-submission', 'warning', inertForms.length + ' visible form(s) have no submit destination or local feedback.', 'Add action/formaction, an onsubmit handler, or visible prototype feedback for validation, loading, success, error, or toast states.')
    }
    const hasFieldLabel = (el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return true
      if ('labels' in el && el.labels && el.labels.length > 0) return true
      const id = el.getAttribute('id')
      return Boolean(id && [...document.querySelectorAll('label')].some((label) => label.getAttribute('for') === id))
    }
    const unlabeledFields = [...document.querySelectorAll('input,select,textarea')]
      .filter(visible)
      .filter((el) => {
        if (el instanceof HTMLInputElement && ['hidden', 'button', 'submit', 'reset', 'image'].includes((el.type || '').toLowerCase())) return false
        return !hasFieldLabel(el)
      })
    if (unlabeledFields.length > 0) {
      push('runtime-unlabeled-fields', 'warning', unlabeledFields.length + ' visible form field(s) have no label or accessible name.', 'Add visible labels or aria-label/aria-labelledby so generated forms are understandable and implementation-ready.')
    }
    const fieldControlsFor = (form) => [...form.querySelectorAll('input,select,textarea')]
      .filter(visible)
      .filter((el) => !(el instanceof HTMLInputElement && ['hidden', 'button', 'submit', 'reset', 'image'].includes((el.type || '').toLowerCase())))
    const formAffordance = (form) => {
      if (form.querySelector('[required],[aria-required],[aria-invalid],[aria-describedby],[pattern],[minlength],[maxlength],[role="alert"],small,output,[class*="help"],[class*="hint"],[class*="error"],[class*="success"],[class*="validation"]')) return true
      return /\b(required|optional|helper|hint|error|invalid|success|validation)\b/i.test(form.innerText || form.textContent || '')
    }
    const weakFormAffordances = forms.filter((form) => fieldControlsFor(form).length >= 2 && !formAffordance(form))
    if (weakFormAffordances.length > 0) {
      push('runtime-weak-form-affordance', 'warning', weakFormAffordances.length + ' multi-field form(s) lack helper, required, optional, validation, or feedback affordances.', 'Add required/optional markers, helper text, aria-describedby, error/success messages, or inline validation states so forms feel implementation-ready.')
    }
    const controlLikeElement = (tag, role, inputType) =>
      tag === 'button' ||
      tag === 'a' ||
      role === 'button' ||
      role === 'link' ||
      inputType === 'button' ||
      inputType === 'submit'
    const controlName = (el) => {
      const labelledBy = (el.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => {
          const labelled = id ? document.getElementById(id) : null
          return labelled ? (labelled.innerText || labelled.textContent || '') : ''
        })
        .join(' ')
      const direct = el.getAttribute('aria-label') || el.getAttribute('title') || labelledBy
      if (direct && direct.trim()) return direct.trim()
      if (el instanceof HTMLInputElement) return el.value || ''
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
    }
    const unnamedIconControls = interactive.filter((el) => {
      const tag = el.tagName.toLowerCase()
      const role = (el.getAttribute('role') || '').toLowerCase()
      const inputType = el instanceof HTMLInputElement ? (el.type || '').toLowerCase() : ''
      if (!controlLikeElement(tag, role, inputType) || controlName(el).length > 0) return false
      return Boolean(el.querySelector('svg,img,[class*="icon"],[aria-hidden="true"]')) || el.children.length > 0
    })
    if (unnamedIconControls.length > 0) {
      push('runtime-unnamed-icon-controls', 'warning', unnamedIconControls.length + ' visible icon-only control(s) have no accessible name.', 'Add visible text, screen-reader-only text, aria-label, aria-labelledby, or title so every icon button and link has a clear purpose.')
    }
    const dialogClassText = (el) => String(el.getAttribute('class') || '').replace(/[-_]/g, ' ').toLowerCase()
    const dialogLikeClass = (el) => /\b(?:modal|dialog|drawer|sheet|popover|confirmation|confirm panel|side panel)\b/i.test(dialogClassText(el))
    const dialogSemantics = (el) => {
      const tag = el.tagName.toLowerCase()
      const role = (el.getAttribute('role') || '').toLowerCase()
      return tag === 'dialog' || role === 'dialog' || role === 'alertdialog' || (el.getAttribute('aria-modal') || '').toLowerCase() === 'true'
    }
    const dialogAccessibleName = (el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return true
      return Boolean(el.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]'))
    }
    const dialogCloseAction = (el) => [...el.querySelectorAll('button,a,input,[role="button"],[role="link"]')]
      .filter(visible)
      .some((control) => /^(?:close|cancel|dismiss|done|back|never mind|go back)$/i.test(
        String(controlName(control) || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
      ))
    const weakDialogs = [...document.querySelectorAll('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"],.modal,.dialog,.drawer,.sheet,.popover,.confirmation,.confirm-panel,.side-panel')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!dialogSemantics(el) && !dialogLikeClass(el)) return false
        return !dialogSemantics(el) || !dialogAccessibleName(el) || !dialogCloseAction(el)
      })
    if (weakDialogs.length > 0) {
      push('runtime-weak-dialog-affordance', 'warning', weakDialogs.length + ' dialog, modal, drawer, or popover surface(s) lack dialog semantics, an accessible title, or a close/cancel path.', 'Use native <dialog> or role="dialog" with aria-modal/labeling, a visible heading, and Close/Cancel/Dismiss controls.')
    }
    const normalizedDialogTitle = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[\s:|/\\-]+/g, ' ')
      .replace(/[^\p{L}\p{N}& ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericDialogTitle = (text) => {
      const normalized = normalizedDialogTitle(text)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:are you sure|confirm|confirmation|details?|edit|information|modal|settings|warning)$/i.test(normalized)
    }
    const specificDialogTitle = (text) => {
      const normalized = normalizedDialogTitle(text)
      return normalized.length > 0 && normalized.length <= 72 && /\b(?:access|account|approval|billing|case|client|customer|delete|dispatch|handoff|incident|invoice|order|payment|renewal|request|risk|route|sla|supplier|ticket|vendor|workspace)\b/i.test(normalized)
    }
    const dialogTitleTexts = (el) => {
      const labelledBy = (el.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => {
          const labelled = id ? document.getElementById(id) : null
          return labelled ? (labelled.innerText || labelled.textContent || '') : ''
        })
      const titles = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        ...labelledBy,
        ...[...el.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].map(textOf)
      ]
      return [...new Set(titles.map(normalizedDialogTitle).filter(Boolean))]
    }
    const genericDialogTitleSurfaces = [...document.querySelectorAll('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"],.modal,.dialog,.drawer,.sheet,.popover,.confirmation,.confirm-panel,.side-panel')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!dialogSemantics(el) || !dialogAccessibleName(el) || !dialogCloseAction(el)) return false
        const titles = dialogTitleTexts(el)
        return titles.length > 0 && titles.some(genericDialogTitle) && !titles.some(specificDialogTitle)
      })
    if (genericDialogTitleSurfaces.length > 0) {
      push('runtime-generic-dialog-title', 'warning', genericDialogTitleSurfaces.length + ' dialog, modal, drawer, or popover surface(s) use generic titles.', 'Replace Details, Confirmation, or Warning-only dialog titles with titles that name the object, action, consequence, or workflow.')
    }
    const primaryActionCandidates = interactive.filter((el) => {
      const tag = el.tagName.toLowerCase()
      const role = (el.getAttribute('role') || '').toLowerCase()
      const inputType = el instanceof HTMLInputElement ? (el.type || '').toLowerCase() : ''
      if (!controlLikeElement(tag, role, inputType)) return false
      if (tag === 'a' && deadHref(el)) return false
      const text = textOf(el)
      if (text.length < 2) return false
      const r = el.getBoundingClientRect()
      if (r.top > Math.min(innerHeight * 0.9, 640) || r.bottom < 0) return false
      if (r.width < 64 || r.height < 32) return false
      const style = getComputedStyle(el)
      const bg = parseRgb(style.backgroundColor)
      const hasFill = Boolean(bg && bg.a > 0.05)
      const borderWidth = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0')
      return hasFill || borderWidth > 0 || r.width * r.height >= 3200
    })
    if (interactive.length > 0 && primaryActionCandidates.length === 0) {
      push('runtime-weak-primary-action', 'warning', 'No prominent primary action is visible in the first viewport.', 'Make the page goal actionable with a clear CTA button or link near the top of the screen.')
    }
    const genericActionLabel = (label) => /^(start|get started|start now|learn more|submit|continue|next|explore|open|view|click here|try now|sign up|join|begin|go)$/i.test(
      String(label || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
    )
    const buttonLikeLabels = interactive
      .filter((el) => {
        const tag = el.tagName.toLowerCase()
        const role = (el.getAttribute('role') || '').toLowerCase()
        const inputType = el instanceof HTMLInputElement ? (el.type || '').toLowerCase() : ''
        return tag === 'button' || role === 'button' || inputType === 'button' || inputType === 'submit'
      })
      .map(controlName)
      .filter((label) => label.length > 0)
    if (buttonLikeLabels.length > 0 && buttonLikeLabels.every(genericActionLabel)) {
      push('runtime-generic-action-copy', 'warning', 'The visible action labels are generic template CTAs.', 'Rewrite primary buttons around the exact user task, object, or outcome, such as "Approve invoice", "Compare plans", or "Retry sync".')
    }
    const destructiveActionLabel = (label) => /^(?:delete|remove|archive|discard|revoke|disconnect|deactivate|disable|suspend|erase|reset|close\s+(?:account|workspace)|cancel\s+(?:subscription|plan|account|membership|renewal|invoice|order))\b/i.test(
      String(label || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
    )
    const destructiveTone = (el) => {
      const marker = [
        el.getAttribute('class') || '',
        el.getAttribute('data-tone') || '',
        el.getAttribute('data-variant') || '',
        el.getAttribute('data-color') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || ''
      ].join(' ').replace(/[-_]/g, ' ')
      if (/\b(?:danger|destructive|critical|warning|error|negative|delete|remove|revoke|disconnect|deactivate|archive)\b/i.test(marker)) return true
      const style = getComputedStyle(el)
      return /rgb\(\s*(?:153|185|220|239)\s*,\s*(?:27|28|38|68)\s*,\s*(?:27|28|38|68)\s*\)|#(?:b91c1c|dc2626|ef4444|991b1b)\b|\b(?:red|crimson|firebrick)\b/i.test(
        [style.color, style.backgroundColor, style.borderTopColor].join(' ')
      )
    }
    const destructiveControls = interactive.filter((el) => {
      const tag = el.tagName.toLowerCase()
      const role = (el.getAttribute('role') || '').toLowerCase()
      const inputType = el instanceof HTMLInputElement ? (el.type || '').toLowerCase() : ''
      if (!controlLikeElement(tag, role, inputType)) return false
      if (el.hasAttribute('disabled') || (el.getAttribute('aria-disabled') || '').toLowerCase() === 'true') return false
      return destructiveActionLabel(controlName(el))
    })
    const hasDestructiveSafety = /\b(?:confirm|confirmation|undo|restore|recover|toast|dialog|modal|are you sure|permanent|irreversible|cannot be undone)\b/i.test(pageText) ||
      Boolean(document.querySelector('[role="dialog"],[aria-modal="true"],[data-confirm]')) ||
      /\bconfirm\s*\(/i.test(pageScripts)
    if (destructiveControls.length > 0 && (!destructiveControls.some(destructiveTone) || !hasDestructiveSafety)) {
      push('runtime-weak-destructive-action-safety', 'warning', destructiveControls.length + ' destructive action(s) lack clear danger treatment, confirmation, or undo feedback.', 'Use danger styling and provide a confirmation dialog, undo toast, recovery copy, or explicit irreversible-warning pattern for destructive actions.')
    }
    const weakTables = [...document.querySelectorAll('table')]
      .filter(visible)
      .filter((table) => {
        const role = (table.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (table.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!table.querySelector('td,th,tr')) return false
        return !table.querySelector('th,caption,[scope]') && !table.getAttribute('aria-label') && !table.getAttribute('aria-labelledby')
      })
    if (weakTables.length > 0) {
      push('runtime-weak-table-structure', 'warning', weakTables.length + ' visible data table(s) have no headers or accessible table context.', 'Add table headers, scope attributes, captions, or aria labels so data modules are readable, accessible, and implementation-ready.')
    }
    const classText = (el) => String(el.getAttribute('class') || '').replace(/[-_]/g, ' ').toLowerCase()
    const productAppSignal = () => {
      const metadata = [...document.querySelectorAll('[class],[id],[aria-label],[role]')]
        .slice(0, 200)
        .map((el) => [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('role') || ''
        ].join(' '))
        .join(' ')
      return /\b(?:admin|analytics|approval queue|approvals?|billing|calendar|console|crm|dashboard|invoices?|kanban|messages?|orders?|portal|projects?|queue|records?|reports?|settings|tickets?|tasks?|workspace|workbench)\b/i.test(pageText + ' ' + metadata)
    }
    const productAppChromeClass = (el) => /\b(?:app shell|shell|sidebar|side nav|sidenav|nav rail|rail|topbar|top bar|navbar|nav bar|global nav|workspace nav|breadcrumbs?|command bar|utility bar)\b/i.test(classText(el))
    const productAppChrome = () => [...document.querySelectorAll('nav,aside,[role="navigation"],[role="complementary"],[class]')]
      .filter(visible)
      .some((el) => {
        const tag = el.tagName.toLowerCase()
        const role = (el.getAttribute('role') || '').toLowerCase()
        return tag === 'nav' || tag === 'aside' || role === 'navigation' || role === 'complementary' || productAppChromeClass(el)
      })
    const productContentModuleCount = () => [...document.querySelectorAll('section,article,aside,form,table,ul,ol')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        return textOf(el).length >= 36 || Boolean(el.querySelector('table,form,li,tr,article,aside'))
      })
      .length
    const productAppModuleSignalCount = () => {
      let count = 0
      if (productContentModuleCount() >= 2) count += 1
      if ([...document.querySelectorAll('table,form')].filter(visible).length > 0) count += 1
      if ([...document.querySelectorAll('input,select,textarea')].filter(visible).length >= 2) count += 1
      if ([...document.querySelectorAll('section,article,div,li')].filter(visible).filter((el) => /\b(?:kpi|metric|stat|summary|scorecard|insight|number card|value card)\b/i.test(classText(el))).length >= 2) count += 1
      if (interactive.length >= 4) count += 1
      return count
    }
    if (productAppSignal() && productAppModuleSignalCount() >= 2 && !productAppChrome()) {
      push('runtime-weak-app-shell', 'warning', 'This app-like screen has product modules but no visible product shell, navigation, or workspace chrome.', 'Add product chrome such as a top bar, sidebar, nav rail, breadcrumbs, search, user/status area, or workspace switcher around the work surface.')
    }
    const normalizedProductNavLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericProductNavLabel = (text) => {
      const normalized = normalizedProductNavLabel(text)
      return normalized.length > 0 && normalized.length <= 32 && /^(?:activity|admin|analytics|calendar|dashboard|help|home|insights?|messages?|notifications?|overview|profile|projects?|reports?|settings|tasks?|team|users?|workspace)$/i.test(normalized)
    }
    const specificProductNavLabel = (text) => {
      const normalized = normalizedProductNavLabel(text)
      return normalized.length > 0 && normalized.length <= 48 && /\b(?:account|approval|asset|booking|campaign|case|claim|client|contract|crew|customer|deployment|dispatch|handoff|incident|inventory|invoice|job|lead|member|order|patient|payment|payout|policy|proposal|record|release|renewal|request|risk|route|shipment|shift|supplier|ticket|vendor|warehouse)\b/i.test(normalized)
    }
    const genericProductNavigation = () => productAppSignal() && productAppModuleSignalCount() >= 2 && productAppChrome() && [...document.querySelectorAll('nav,[role="navigation"]')]
      .filter(visible)
      .some((nav) => {
        const marker = [
          nav.getAttribute('class') || '',
          nav.getAttribute('id') || '',
          nav.getAttribute('aria-label') || '',
          nav.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' ')
        if (/\b(?:breadcrumb|breadcrumbs|crumbs?|page trail|page path|path nav|path navigation)\b/i.test(marker)) return false
        const labels = [...nav.querySelectorAll('a,button')]
          .filter(visible)
          .map(controlName)
          .map(normalizedProductNavLabel)
          .filter(Boolean)
        const uniqueLabels = [...new Set(labels)]
        if (uniqueLabels.length < 3) return false
        const genericCount = uniqueLabels.filter(genericProductNavLabel).length
        const specificCount = uniqueLabels.filter(specificProductNavLabel).length
        return specificCount === 0 && genericCount >= Math.ceil(uniqueLabels.length * 0.67)
      })
    if (genericProductNavigation()) {
      push('runtime-generic-product-navigation', 'warning', 'The product navigation uses generic dashboard template labels.', 'Replace Dashboard, Analytics, Reports, or Settings-only navigation with domain-specific product areas, objects, queues, workflows, or saved views.')
    }
    const breadcrumbContainer = (el) => {
      const metadata = [
        el.getAttribute('class') || '',
        el.getAttribute('id') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || ''
      ].join(' ').replace(/[-_]/g, ' ')
      return /\b(?:breadcrumb|breadcrumbs|crumbs?|page trail|page path|path nav|path navigation)\b/i.test(metadata)
    }
    const normalizedBreadcrumbLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/#-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const breadcrumbLabels = (block) => {
      const labels = [...block.querySelectorAll('a,button,span,li,[aria-current]')]
        .filter(visible)
        .map((el) => controlName(el) || textOf(el))
      if (labels.length < 3) labels.push(...textOf(block).split(/\s*(?:\/|>|›|»|→)\s*/))
      return [...new Set(labels.map(normalizedBreadcrumbLabel).filter(Boolean))]
    }
    const genericBreadcrumbLabel = (text) => {
      const normalized = normalizedBreadcrumbLabel(text)
      return normalized.length > 0 && normalized.length <= 36 && /^(?:activity|admin|analytics|dashboard|details?|home|items?|overview|page\s*\d+|profile|projects?|records?|reports?|settings|summary|tasks?|workspace)$/i.test(normalized)
    }
    const specificBreadcrumbLabel = (text) => {
      const normalized = normalizedBreadcrumbLabel(text)
      return normalized.length > 0 && normalized.length <= 72 && (
        /\b(?:account|approval|asset|billing|case|claim|client|contract|crew|customer|deployment|dispatch|handoff|incident|inventory|invoice|job|lead|member|order|patient|payment|payout|policy|proposal|record|release|renewal|request|risk|route|shipment|shift|sla|supplier|ticket|vendor|warehouse|workspace)\b/i.test(normalized) ||
        /\b[A-Z]{2,}[-_#]?\d{2,}\b|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/.test(normalized)
      )
    }
    const breadcrumbBlocks = [...document.querySelectorAll('nav,[role="navigation"],ol,ul,div')]
      .filter(visible)
      .filter(breadcrumbContainer)
    const genericBreadcrumbs = breadcrumbBlocks.filter((block) => {
      const labels = breadcrumbLabels(block)
      if (labels.length < 3) return false
      const genericCount = labels.filter(genericBreadcrumbLabel).length
      const specificCount = labels.filter(specificBreadcrumbLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    if (genericBreadcrumbs.length > 0) {
      push('runtime-generic-breadcrumb-labels', 'warning', 'A breadcrumb or page path uses generic template labels.', 'Replace Home, Dashboard, Details, or Page 1-only trails with product areas, objects, record names, IDs, or workflow stages.')
    }
    const brandLandingSignal = () => {
      const metadata = [...document.querySelectorAll('[class],[id],[aria-label],[title]')]
        .slice(0, 200)
        .map((el) => [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' '))
        .join(' ')
      const content = pageText + ' ' + metadata
      if (/\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing page|plans page|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i.test(content)) return true
      return /\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing|plans|features|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i.test(content) && !productAppSignal()
    }
    const firstScreenActionPathCount = () => {
      const limit = Math.min(innerHeight * 0.88, 720)
      const actions = interactive
        .filter((el) => {
          if (el.closest('nav,header,[role="navigation"]')) return false
          const tag = el.tagName.toLowerCase()
          const role = (el.getAttribute('role') || '').toLowerCase()
          const inputType = el instanceof HTMLInputElement ? (el.type || '').toLowerCase() : ''
          if (!controlLikeElement(tag, role, inputType)) return false
          if (tag === 'a' && deadHref(el)) return false
          const rect = el.getBoundingClientRect()
          return rect.top <= limit && rect.bottom > 0
        })
        .map(controlName)
        .map((label) => String(label || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim().toLowerCase())
        .filter(Boolean)
      return new Set(actions).size
    }
    if (brandLandingSignal() && primaryActionCandidates.length > 0 && pageText.length >= 220 && firstScreenActionPathCount() < 2) {
      push('runtime-weak-secondary-action-path', 'warning', 'This brand, landing, portfolio, pricing, or marketing first screen has no clear secondary action path.', 'Pair the primary CTA with a distinct secondary action such as View demo, See features, Read case study, Compare plans, or Contact sales.')
    }
    const leadFormSignal = (form) => {
      if (!brandLandingSignal() || fieldControlsFor(form).length === 0) return false
      const metadata = [
        form.getAttribute('class') || '',
        form.getAttribute('id') || '',
        form.getAttribute('action') || '',
        form.getAttribute('aria-label') || '',
        form.getAttribute('title') || '',
        ...[...form.querySelectorAll('[name],[type],[placeholder],[aria-label]')]
          .map((el) => [
            el.getAttribute('name') || '',
            el.getAttribute('type') || '',
            el.getAttribute('placeholder') || '',
            el.getAttribute('aria-label') || ''
          ].join(' '))
      ].join(' ').replace(/[-_]/g, ' ')
      return /\b(?:book a demo|schedule a demo|request demo|contact|contact sales|talk to sales|signup|sign up|subscribe|newsletter|waitlist|request access|early access|join|email|company|message)\b/i.test(textOf(form) + ' ' + metadata)
    }
    const leadFormResponseStates = () => {
      const metadata = [...document.querySelectorAll('[class],[id],[role],[aria-live],[aria-busy],[aria-invalid],[data-state],[data-status]')]
        .slice(0, 240)
        .map((el) => [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('role') || '',
          el.getAttribute('aria-live') || '',
          el.getAttribute('aria-busy') || '',
          el.getAttribute('aria-invalid') || '',
          el.getAttribute('data-state') || '',
          el.getAttribute('data-status') || ''
        ].join(' ').replace(/[-_]/g, ' '))
        .join(' ')
      const signal = pageText + ' ' + metadata
      return /\b(?:submitted|sent|thank you|thanks|confirmation|confirmed|request received|message received|demo booked|you'?re on the list|we'?ll be in touch|check your inbox|success[- ]message|form[- ]success|toast[- ]success)\b/i.test(signal) &&
        /\b(?:error|invalid|validation|required fields?|please enter|missing|try again|failed|could not|aria-invalid|role\s*=\s*["']alert["']|error[- ]message|form[- ]error|toast[- ]error)\b/i.test(signal) &&
        /\b(?:loading|submitting|sending|please wait|aria-busy|spinner|progress)\b/i.test(signal)
    }
    const leadForms = forms.filter(leadFormSignal)
    if (leadForms.length > 0 && !leadFormResponseStates()) {
      push('runtime-weak-lead-form-response', 'warning', leadForms.length + ' marketing lead form(s) lack visible loading, success, and error feedback states.', 'Add submitting/loading, success/confirmation, and error/validation feedback states for contact, demo, signup, waitlist, or newsletter forms.')
    }
    const normalizedFormFieldLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/\b(?:required|optional)\b/gi, ' ')
      .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericFormFieldLabel = (text) => {
      const normalized = normalizedFormFieldLabel(text)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:company(?: name)?|details?|email(?: address)?|enter text|full name|message|name|notes?|phone(?: number)?|select option|subject|text|title|type|your email|your message|your name)$/i.test(normalized)
    }
    const specificFormFieldLabel = (text) => {
      const normalized = normalizedFormFieldLabel(text)
      return normalized.length > 0 && normalized.length <= 64 && /\b(?:account|approval|billing|budget|company domain|crew|demo|dispatch|handoff|implementation|invoice|launch|migration|order|renewal|request|role|route|sla|team size|timeline|use case|volume|work email|workspace)\b/i.test(normalized)
    }
    const fieldLabelTexts = (field) => {
      const labelledBy = (field.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => {
          const labelled = id ? document.getElementById(id) : null
          return labelled ? (labelled.innerText || labelled.textContent || '') : ''
        })
        .join(' ')
      const labels = [
        labelledBy,
        field.getAttribute('aria-label') || '',
        field.getAttribute('title') || '',
        field.getAttribute('placeholder') || '',
        String(field.getAttribute('name') || '').replace(/[-_]/g, ' ')
      ]
      if ('labels' in field && field.labels) labels.push(...[...field.labels].map(textOf))
      return labels
    }
    const formFieldLabels = (form) => {
      const labels = [
        ...[...form.querySelectorAll('label')].map(textOf),
        ...fieldControlsFor(form).flatMap(fieldLabelTexts)
      ]
      return [...new Set(labels.map(normalizedFormFieldLabel).filter(Boolean))]
    }
    const genericFormFieldForms = forms.filter((form) => {
      if (fieldControlsFor(form).length < 2) return false
      if (!leadFormSignal(form) && !(productAppSignal() && productAppModuleSignalCount() >= 2)) return false
      const labels = formFieldLabels(form)
      if (labels.length < 3) return false
      const genericCount = labels.filter(genericFormFieldLabel).length
      const specificCount = labels.filter(specificFormFieldLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    if (genericFormFieldForms.length > 0) {
      push('runtime-generic-form-field-labels', 'warning', genericFormFieldForms.length + ' lead or product form(s) use generic field labels.', 'Replace Name, Email, Message, or Details-only fields with labels tied to the requested business information, use case, timeline, budget, volume, or workflow.')
    }
    const normalizedSettingsControlLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/%+-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const settingControlName = (control) => {
      const labelledBy = (control.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => {
          const labelled = id ? document.getElementById(id) : null
          return labelled ? (labelled.innerText || labelled.textContent || '') : ''
        })
        .join(' ')
      const labels = [
        labelledBy,
        control.getAttribute('aria-label') || '',
        control.getAttribute('title') || '',
        control instanceof HTMLInputElement ? String(control.name || '').replace(/[-_]/g, ' ') : ''
      ]
      if ('labels' in control && control.labels) labels.push(...[...control.labels].map(textOf))
      if (control.tagName.toLowerCase() === 'button') labels.push(controlName(control))
      return labels.map(normalizedSettingsControlLabel).find(Boolean) || ''
    }
    const settingControlsFor = (surface) => [...surface.querySelectorAll('input[type="checkbox"],input[type="radio"],button[aria-pressed],[role="checkbox"],[role="radio"],[role="switch"]')]
      .filter(visible)
      .filter((control) => !(control.hasAttribute('disabled') || (control.getAttribute('aria-disabled') || '').toLowerCase() === 'true'))
    const settingsControlSurface = (surface) => {
      const marker = [
        classText(surface),
        surface.getAttribute('id') || '',
        surface.getAttribute('aria-label') || '',
        surface.getAttribute('title') || '',
        textOf(surface)
      ].join(' ')
      return /\b(?:access|alerts?|configuration|controls?|integrations?|notifications?|permissions?|preferences?|privacy|security|settings?|workspace)\b/i.test(marker)
    }
    const genericSettingsControlLabel = (text) => {
      const normalized = normalizedSettingsControlLabel(text)
      return normalized.length > 0 && normalized.length <= 48 && /^(?:alerts?|auto|automatic|checkbox|email(?: alerts?| notifications?)?|enabled?|feature\s*\d*|notifications?|off|on|option\s*\d+|push|security|setting\s*\d*|sms|toggle\s*\d+|updates?)$/i.test(normalized)
    }
    const specificSettingsControlLabel = (text) => {
      const normalized = normalizedSettingsControlLabel(text)
      return normalized.length > 0 && normalized.length <= 96 && /\b(?:account|approval|billing|case|customer|dispatch|escalat(?:e|ion)|handoff|incident|invoice|lead|order|owner|overdue|renewal|request|risk|route|salesforce|sla|supplier|sync|ticket|vendor|workspace)\b/i.test(normalized)
    }
    const genericSettingsControlSurfaces = [...document.querySelectorAll('section,article,aside,form,fieldset,div')]
      .filter(visible)
      .filter((surface) => {
        const role = (surface.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (surface.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const controls = settingControlsFor(surface)
        if (controls.length < 3 || !settingsControlSurface(surface) || !productAppSignal()) return false
        const labels = [...new Set(controls.map(settingControlName).filter(Boolean))]
        if (labels.length < 3) return false
        const genericCount = labels.filter(genericSettingsControlLabel).length
        const specificCount = labels.filter(specificSettingsControlLabel).length
        return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
      })
    if (genericSettingsControlSurfaces.length > 0) {
      push('runtime-generic-settings-control-labels', 'warning', genericSettingsControlSurfaces.length + ' settings, permissions, or preferences control group(s) use generic labels.', 'Replace Option 1, Enable, Notifications, or Setting-only toggles with labels that name the controlled object, effect, audience, or workflow.')
    }
    const normalizedProofLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    const genericProofLabel = (text) => {
      const normalized = normalizedProofLabel(text)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:logo|logo\s*\d+|customer\s+logo|press\s+logo|company\s+[a-z0-9]+|client\s+[a-z0-9]+|customer\s+[a-z0-9]+|brand\s+[a-z0-9]+|partner\s+[a-z0-9]+|testimonial|quote|review|case\s+study|proof)$/i.test(normalized)
    }
    const genericTrustProof = () => [...document.querySelectorAll('section,div,ul,ol,aside')]
      .filter(visible)
      .some((block) => {
        const marker = [
          classText(block),
          block.getAttribute('id') || '',
          block.getAttribute('aria-label') || '',
          block.getAttribute('title') || '',
          textOf(block)
        ].join(' ')
        if (!/\b(?:trusted by|used by|loved by|chosen by|customers?|clients?|teams?|companies?|reviews?|ratings?|stars?|testimonial|case stud(?:y|ies)|customer stor(?:y|ies)|featured in|as seen in|press|security|compliance|logo cloud|logos?|trust|proof|social proof|badge|badges|certification)\b/i.test(marker)) return false
        const labels = [...block.querySelectorAll('span,li,a,strong,b,img')]
          .filter(visible)
          .map((el) => {
            if (el instanceof HTMLImageElement) return [el.alt, el.getAttribute('aria-label') || '', el.title || ''].filter(Boolean).join(' ')
            return textOf(el)
          })
          .map(normalizedProofLabel)
          .filter(Boolean)
        return labels.filter(genericProofLabel).length >= 2
      })
    if (genericTrustProof()) {
      push('runtime-generic-trust-proof', 'warning', 'A trust proof, logo, customer, or press module uses generic placeholder labels.', 'Replace generic proof labels such as Logo 1, Company A, or Client B with realistic customer names, publication names, certification badges, ratings, or outcome metrics.')
    }
    const normalizedMetricProof = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}%+./-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    const genericVanityMetric = (text) => {
      const normalized = normalizedMetricProof(text)
      return normalized.length >= 5 &&
        normalized.length <= 96 &&
        /\b(?:99|100(?:\.0+)?)\s?%\s*(?:customer\s+)?(?:accuracy|approval|happy|satisfaction|success|uptime)\b|\b(?:2|3|4|5|10)x\s+(?:better|conversion|faster|growth|more|output|productivity|roi)\b|\b(?:10k|100k|500k|1m)\+?\s+(?:customers?|downloads|members?|teams?|users?)\b|\b24\/7\s+(?:availability|coverage|service|support)\b|\b(?:zero|0)\s+(?:downtime|friction|hassle|setup)\b/i.test(normalized) &&
        !/\b(?:after|baseline|benchmark|before|case study|cohort|goal|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|last|measured|pilot|previous|prior|q[1-4]|reported|surveyed|target|this (?:week|month|quarter|year)|trial|versus|vs|yoy|mom)\b/i.test(normalized)
    }
    const genericVanityMetrics = () => [...document.querySelectorAll('section,article,div,ul,ol,aside')]
      .filter(visible)
      .some((block) => {
        const marker = [
          classText(block),
          block.getAttribute('id') || '',
          block.getAttribute('aria-label') || '',
          block.getAttribute('title') || '',
          textOf(block).slice(0, 240)
        ].join(' ')
        if (!/\b(?:impact|kpi|metric|metrics|numbers|outcomes?|proof|results?|roi|social proof|stat|stats|traction|trust|trusted by|used by|loved by|chosen by|customers?|clients?|teams?|companies?|reviews?|ratings?|stars?|testimonial|case stud(?:y|ies)|customer stor(?:y|ies)|featured in|as seen in|press)\b/i.test(marker)) return false
        const labels = [...block.querySelectorAll('article,li,div,p,span,strong,b,h2,h3,small')]
          .filter(visible)
          .map((el) => normalizedMetricProof(textOf(el)))
          .filter(Boolean)
        return labels.filter(genericVanityMetric).length >= 2
      })
    if (genericVanityMetrics()) {
      push('runtime-generic-vanity-metrics', 'warning', 'A proof, impact, or metrics module uses generic vanity statistics.', 'Replace broad stats like 99% satisfaction, 10x faster, 1M+ users, or 24/7 support with sourced customer metrics, timeframes, benchmarks, or case-study outcomes.')
    }
    const normalizedCardCopy = (text) => String(text || '')
      .replace(/\b(?:loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}$€£¥%]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const duplicatedDesignCardCopy = () => {
      const counts = new Map()
      ;[...document.querySelectorAll('article,li,div')]
        .filter(visible)
        .filter((el) => /\b(?:card|tile|feature|benefit|capability|use case|pricing|price card|plan|tier|testimonial|review|quote|case study|project card|portfolio item|module card)\b/i.test(classText(el)))
        .forEach((el) => {
          const copy = normalizedCardCopy(textOf(el))
          if (copy.length < 36 || copy.length > 360 || copy.split(' ').length < 6) return
          counts.set(copy, (counts.get(copy) || 0) + 1)
        })
      return [...counts.values()].some((count) => count >= 2)
    }
    if (duplicatedDesignCardCopy()) {
      push('runtime-duplicated-card-copy', 'warning', 'Repeated feature, pricing, proof, project, or testimonial cards reuse the same copy.', 'Give each repeated card a distinct title, concrete detail, data point, outcome, or audience-specific reason to exist.')
    }
    const elementMarker = (el) => [
      el.getAttribute('class') || '',
      el.getAttribute('id') || '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.getAttribute('alt') || ''
    ].join(' ').replace(/[-_]/g, ' ')
    const brandNavigation = () => [...document.querySelectorAll('header,nav,[role="navigation"]')]
      .filter(visible)
      .some((el) => {
        const validLinks = [...el.querySelectorAll('a')]
          .filter(visible)
          .filter((link) => !deadHref(link))
          .length
        if (validLinks >= 2) return true
        const metadata = [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' ')
        return /\b(?:brand|logo|wordmark|site nav|marketing nav|navbar|nav bar|masthead)\b/i.test(classText(el) + ' ' + metadata.replace(/[-_]/g, ' ')) && validLinks >= 1
      })
    const brandIdentityText = (text, allowSimpleName) => {
      const normalized = String(text || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
      if (normalized.length < 2 || normalized.length > 48) return false
      if (/^(?:home|features?|pricing|plans?|customers?|clients?|testimonials?|case stud(?:y|ies)|work|portfolio|about|contact|blog|docs|login|sign in|sign up|book a demo|start free trial|learn more|view demo|see work|compare plans|contact sales|demo|faq|support|proof)$/i.test(normalized)) return false
      if (/\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing|plans|features|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i.test(normalized)) return false
      if (/\b[A-Z][A-Za-z0-9&'.-]*(?:[A-Z][a-z0-9&'.-]+)+\b|\b[A-Z][A-Za-z0-9&'.-]+\s+(?:Studio|Labs|Works|Cloud|AI|HQ|OS|Desk|Flow|Suite|Hub|Health|Finance|Bank|Systems|Group|Co|Inc|LLC|Ltd)\b/.test(normalized)) return true
      return allowSimpleName && /^[A-Z][A-Za-z0-9&'.-]{2,24}(?:\s+[A-Z][A-Za-z0-9&'.-]{2,24}){0,2}$/.test(normalized)
    }
    const brandIdentity = () => {
      const blocks = [...document.querySelectorAll('header,nav,[role="navigation"]')].filter(visible)
      for (const block of blocks) {
        const brandedItems = [block, ...block.querySelectorAll('a,span,strong,b,div,img,svg,[class],[id],[aria-label],[title],[alt]')]
          .filter(visible)
          .filter((el) => /\b(?:brand|brand mark|brand identity|logo|logotype|wordmark|site title|product name|masthead)\b/i.test(elementMarker(el)))
        if (brandedItems.some((el) => brandIdentityText(textOf(el) || elementMarker(el), true))) return true
        const firstLabel = [...block.querySelectorAll('a,button,span,strong,b')]
          .filter(visible)
          .map(textOf)
          .find(Boolean)
        if (firstLabel && brandIdentityText(firstLabel, true)) return true
      }
      return [...document.querySelectorAll('h1,[role="heading"][aria-level="1"]')]
        .filter(visible)
        .some((el) => brandIdentityText(textOf(el), false))
    }
    const visualAnchorClass = (el) => /\b(?:hero visual|hero media|product (?:shot|preview|mockup)|screenshot|device mockup|browser mockup|phone mockup|visual anchor|media panel|image panel|gallery|preview panel|demo preview)\b/i.test(classText(el))
    const visualAnchor = () => {
      if (visibleImages.length > 0) return true
      if ([...document.querySelectorAll('picture,video,iframe,canvas')].filter(visible).length > 0) return true
      return [...document.querySelectorAll('[class],section,article,div')]
        .filter(visible)
        .some((el) => {
          const style = getComputedStyle(el)
          return visualAnchorClass(el) || /\burl\(|image-set\(/i.test(style.backgroundImage || '')
        })
    }
    const hasTopHeading = Boolean(document.querySelector('h1,[role="heading"][aria-level="1"]'))
    const heroViewportComposition = () => {
      const root = document.querySelector('main') || document.body
      const heroCandidates = [...root.querySelectorAll('section,header,[class*="hero"]')]
        .filter(visible)
        .filter((el) => {
          const rect = el.getBoundingClientRect()
          if (rect.bottom <= 0 || rect.top > Math.min(innerHeight * 0.28, 180)) return false
          return Boolean(el.querySelector('h1,[role="heading"][aria-level="1"]')) || /\bhero\b/i.test(classText(el))
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      const hero = heroCandidates[0]
      if (!hero) return false
      const heroRect = hero.getBoundingClientRect()
      const heroStyle = getComputedStyle(hero)
      const computedMinHeight = Number.parseFloat(heroStyle.minHeight || '0')
      const computedHeight = Number.parseFloat(heroStyle.height || '0')
      const lockedHeight =
        heroRect.height >= innerHeight * 0.88 ||
        computedMinHeight >= innerHeight * 0.88 ||
        computedHeight >= innerHeight * 0.88 ||
        /\b(?:100|9[5-9])(?:dvh|vh)\b/i.test([heroStyle.minHeight, heroStyle.height].join(' '))
      if (!lockedHeight) return false
      const nextSection = [...root.querySelectorAll('section,article,aside,form,footer')]
        .filter(visible)
        .filter((el) => el !== hero && !hero.contains(el) && textOf(el).length >= 24)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .find((el) => el.getBoundingClientRect().top > heroRect.top + 24)
      if (!nextSection) return false
      return nextSection.getBoundingClientRect().top >= innerHeight * 0.92
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && pageText.length >= 180 && !brandNavigation()) {
      push('runtime-weak-brand-navigation', 'warning', 'This brand, landing, portfolio, pricing, or marketing page has no branded header or section navigation.', 'Add a branded header/nav with logo or wordmark, links to key sections, and a visible primary action.')
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && pageText.length >= 180 && brandNavigation() && !brandIdentity()) {
      push('runtime-weak-brand-identity', 'warning', 'This brand, landing, portfolio, pricing, or marketing page has navigation but no visible brand or product identity.', 'Add a visible wordmark, logo, product name, or named creator/place in the header or first viewport so the page feels specific.')
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && pageText.length >= 220 && heroViewportComposition()) {
      push('runtime-weak-hero-viewport-composition', 'warning', 'This brand, landing, portfolio, pricing, or marketing page uses a full-height hero that hides the next section.', 'Reduce hero min-height, adjust spacing, or add a visible next-section peek so the first viewport hints at more content below.')
    }
    const portfolioSurfaceSignal = () => {
      const headingText = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
        .filter(visible)
        .map(textOf)
        .join(' ')
      const metadata = [...document.querySelectorAll('[class],[id],[aria-label],[title]')]
        .slice(0, 200)
        .map((el) => [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' '))
        .join(' ')
      const signal = headingText + ' ' + metadata
      if (!brandLandingSignal() || !/\b(?:case stud(?:y|ies)|portfolio(?: page| site| gallery)?|selected work|work showcase|client work|project portfolio)\b/i.test(signal)) return false
      return !(/\bportfolio\b/i.test(signal) && /\b(?:builder|platform|software|tool|template|cms|generator)\b/i.test(signal))
    }
    const portfolioProjectEntries = () => [...document.querySelectorAll('section,article,div,li')]
        .filter(visible)
        .filter((el) => /\b(?:case study|project card|work card|portfolio item|client story|selected work|project tile|project entry)\b/i.test(classText(el)))
        .filter((el) => textOf(el).length >= 36)
    const portfolioProjectStructure = () => {
      return portfolioProjectEntries().length >= 2 &&
        /\b(?:client|role|year|timeline|launched|scope|industry|deliverables|result|outcome|increased|reduced|saved|grew|conversion|qualified inquiries|revenue)\b|[+\-]?\d[\d,.]*\s?%/i.test(pageText) &&
        /\b(?:view case study|read case study|view project|see project|open project|view work|read story|explore project)\b/i.test(pageText)
    }
    const genericPortfolioProjectDetail = (el) => /\b(?:project\s+(?:one|two|three|[0-9]+|alpha|beta|gamma)|case\s+study\s+(?:one|two|three|[0-9]+)|selected\s+work\s+(?:one|two|three|[0-9]+)|(?:client|customer|brand|company)\s+(?:[a-z]|[0-9]+))\b/i.test(textOf(el))
    if (portfolioSurfaceSignal() && hasTopHeading && interactive.length > 0 && !portfolioProjectStructure()) {
      push('runtime-weak-portfolio-structure', 'warning', 'This portfolio or case-study page lacks concrete project entries and outcome details.', 'Add real project/case-study cards with client, role/category, timeline or year, visual, outcome metric, and detail CTAs.')
    }
    if (portfolioSurfaceSignal() && portfolioProjectStructure() && portfolioProjectEntries().filter(genericPortfolioProjectDetail).length >= 2) {
      push('runtime-generic-portfolio-project-detail', 'warning', 'Several portfolio or case-study entries use placeholder project or client labels.', 'Replace Project One, Client A, or Case Study placeholders with realistic project names, client names, roles, timelines, visuals, and outcome metrics.')
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && !visualAnchor()) {
      push('runtime-weak-visual-anchor', 'warning', 'This brand, landing, portfolio, pricing, or marketing page has no strong visual anchor.', 'Add a real product preview, screenshot, image, gallery, media-led hero, or clearly designed mockup that shows the product or offer.')
    }
    const previewDetail = (el) => {
      const hasMedia = [...el.querySelectorAll('img,picture,video,iframe,canvas,svg')]
        .some((media) => visible(media))
      if (hasMedia) return true
      const text = textOf(el).replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim()
      const hasUiStructure = Boolean(el.querySelector('table,ul,ol,li,button,input,select,textarea,[role="row"],[role="grid"],[role="list"],[role="listitem"],[role="progressbar"],[role="status"]'))
      const hasConcreteData = /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|k|m|b|users?|projects?|tasks?|orders?|tickets?|files?|days?|hrs?|hours?)\b|\b(?:approved|pending|overdue|blocked|submitted|active|at risk|delayed|synced|live|draft|ready)\b|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|\b[A-Z][A-Za-z0-9&.-]+\s+(?:Studio|Labs|Inc|LLC|Ltd|Co|Group|Systems|Health|Finance|Bank|Agency)\b/.test(text)
      return text.length >= 70 && hasUiStructure && hasConcreteData
    }
    const weakPreviewDetails = [...document.querySelectorAll('figure,section,article,div,aside')]
      .filter(visible)
      .filter((el) => visualAnchorClass(el))
      .filter((el) => !previewDetail(el))
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && weakPreviewDetails.length > 0) {
      push('runtime-weak-product-preview-detail', 'warning', weakPreviewDetails.length + ' product preview, mockup, or media panel surface(s) are empty framed shells.', 'Fill previews with real media or concrete UI/data details such as dashboard rows, metrics, statuses, screenshots, or labeled controls.')
    }
    const concreteVisualAnchorDetail = (el) => {
      const hasRealMedia = [...el.querySelectorAll('img,picture,video,iframe,canvas')]
        .some((media) => visible(media))
      if (hasRealMedia) return true
      const style = getComputedStyle(el)
      if (/\burl\(|image-set\(/i.test(style.backgroundImage || '')) return true
      const text = textOf(el).replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim()
      const hasUiStructure = Boolean(el.querySelector('table,ul,ol,li,button,input,select,textarea,[role="row"],[role="grid"],[role="list"],[role="listitem"],[role="progressbar"],[role="status"]'))
      const hasProductLabel = /\b(?:account|analytics|approval|browser|calendar|chart|customer|dashboard|dispatch|gallery|invoice|kanban|map|metric|order|pipeline|preview|project|record|report|row|screen|status|task|ticket|timeline|workflow)\b/i.test(text)
      const hasConcreteData = /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|k|m|b|users?|projects?|tasks?|orders?|tickets?|files?|days?|hrs?|hours?)\b|\b(?:approved|pending|overdue|blocked|submitted|active|at risk|delayed|synced|live|draft|ready)\b|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|\b[A-Z][A-Za-z0-9&.-]+\s+(?:Studio|Labs|Inc|LLC|Ltd|Co|Group|Systems|Health|Finance|Bank|Agency)\b/.test(text)
      return (text.length >= 40 && hasConcreteData) || (text.length >= 64 && hasUiStructure && hasProductLabel)
    }
    const decorativeVisualAnchors = [...document.querySelectorAll('figure,section,article,div,aside')]
      .filter(visible)
      .filter((el) => visualAnchorClass(el))
      .filter((el) => {
        const style = getComputedStyle(el)
        const marker = [
          classText(el),
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || '',
          style.backgroundImage || '',
          textOf(el).slice(0, 180)
        ].join(' ')
        return /\b(?:abstract|ambient|blob|blobs|bokeh|decorative|glow|gradient|halo|mesh|orb|orbs|shape|shapes|sparkle|sphere|swoosh|wave)\b/i.test(marker)
      })
      .filter((el) => !concreteVisualAnchorDetail(el))
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && decorativeVisualAnchors.length > 0) {
      push('runtime-decorative-visual-anchor', 'warning', 'A primary visual anchor is only abstract decoration.', 'Replace abstract blobs, orbs, gradients, or decorative SVG shapes with a product screenshot, media asset, gallery image, or concrete UI mockup with real labels and data.')
    }
    const trustProof = () => {
      if (document.querySelector('blockquote')) return true
      if (/\b(?:trusted by|used by|loved by|chosen by|customers?|clients?|teams?|companies?|reviews?|ratings?|stars?|testimonial|case stud(?:y|ies)|customer stor(?:y|ies)|featured in|as seen in|press|security|compliance|soc\s?2|gdpr|hipaa|iso\s?27001|uptime|sla|roi|saved|increased|reduced|nps|g2|capterra|product hunt|fortune\s?500)\b/i.test(pageText)) return true
      return [...document.querySelectorAll('[class],[id],[aria-label],[title],img[alt]')]
        .slice(0, 240)
        .some((el) => {
          const metadata = [
            el.getAttribute('class') || '',
            el.getAttribute('id') || '',
            el.getAttribute('aria-label') || '',
            el.getAttribute('title') || '',
            el.getAttribute('alt') || ''
          ].join(' ').replace(/[-_]/g, ' ')
          return /\b(?:logo cloud|logos?|trust|proof|social proof|testimonial|review|rating|stars?|case stud(?:y|ies)|customer stor(?:y|ies)|press|security|compliance|badge|badges|certification)\b/i.test(metadata)
        })
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && !trustProof()) {
      push('runtime-weak-trust-proof', 'warning', 'This brand, landing, portfolio, pricing, or marketing page has no concrete trust proof.', 'Add customer logos, testimonials, ratings, case-study metrics, press mentions, or security/compliance badges with realistic names and numbers.')
    }
    const testimonialBlocks = () => [...document.querySelectorAll('blockquote,section,article,div,li')]
      .filter(visible)
      .filter((el) => {
        if (el.tagName.toLowerCase() === 'blockquote') return textOf(el).length >= 24
        const marker = [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' ')
        return /\b(?:testimonial|review|quote|customer stor(?:y|ies)|client stor(?:y|ies)|social proof)\b/i.test(marker) && textOf(el).length >= 32
      })
    const testimonialAttribution = (el) => {
      const metadata = [
        el.getAttribute('class') || '',
        el.getAttribute('id') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        el.getAttribute('cite') || ''
      ].join(' ').replace(/[-_]/g, ' ')
      return /\b(?:by|from|at|role|title|founder|ceo|cto|cmo|vp|director|manager|lead|head of|customer|client|team|company)\b|[+\-]?\d[\d,.]*\s?%|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|\b[A-Z][A-Za-z0-9&.-]+\s+(?:Studio|Labs|Inc|LLC|Ltd|Co|Group|Systems|Health|Finance|Bank|Agency)\b/.test(textOf(el) + ' ' + metadata)
    }
    const weakTestimonials = testimonialBlocks().filter((el) => !testimonialAttribution(el))
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && weakTestimonials.length > 0) {
      push('runtime-weak-testimonial-attribution', 'warning', weakTestimonials.length + ' testimonial or customer quote block(s) lack credible attribution.', 'Add a named person or company, role/source, and concrete outcome context to each testimonial or customer quote.')
    }
    const testimonialAttributionText = (text) => /\b(?:by|from|at|role|title|founder|ceo|cto|cmo|vp|director|manager|lead|head of|customer|client|team|company)\b|[+\-]?\d[\d,.]*\s?%|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|\b[A-Z][A-Za-z0-9&.-]+\s+(?:Studio|Labs|Inc|LLC|Ltd|Co|Group|Systems|Health|Finance|Bank|Agency)\b/.test(text)
    const genericTestimonialPhrase = (text) => /\b(?:amazing product|awesome product|best (?:decision|experience|product|tool)|changed everything|couldn'?t be happier|game[- ]changer|highly recommend|incredible|love (?:it|this|the product)|made our lives easier|perfect for our team|saved us so much time|so easy to use|transformed our workflow|would recommend)\b/i.test(text)
    const testimonialQuoteTexts = (el) => {
      const quoteEls = el.matches('blockquote,q') ? [el] : [...el.querySelectorAll('blockquote,q')].filter(visible)
      const quotes = quoteEls.map(textOf).map((text) => text.replace(/\s+/g, ' ').trim()).filter((text) => text.length >= 16)
      if (quotes.length > 0) return quotes
      return [...el.querySelectorAll('p')]
        .filter(visible)
        .map(textOf)
        .map((text) => text.replace(/\s+/g, ' ').trim())
        .filter((text) => text.length >= 24 && (!testimonialAttributionText(text) || genericTestimonialPhrase(text)))
    }
    const genericTestimonialCopy = (text) => {
      const normalized = String(text || '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
      return normalized.length >= 16 &&
        normalized.length <= 260 &&
        genericTestimonialPhrase(normalized) &&
        !/\b(?:after|approval|before|case[- ]stud(?:y|ies)|conversion|dashboard|days?|dispatch|handoff|hours?|implementation|inquir(?:y|ies)|invoice|launch|migration|months?|onboarding|orders?|pilot|portfolio|project|q[1-4]|records?|renewal|revenue|route|sla|sync|tickets?|timeline|trial|users?|weeks?)\b|[+\-]?\d[\d,.]*\s?(?:%|x|arr|days?|hours?|months?|orders?|pages?|projects?|records?|tickets?|users?|weeks?)?\b|[$€£¥]\s*\d/i.test(normalized)
    }
    const genericTestimonials = testimonialBlocks()
      .filter(testimonialAttribution)
      .filter((el) => testimonialQuoteTexts(el).some(genericTestimonialCopy))
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && genericTestimonials.length > 0) {
      push('runtime-generic-testimonial-copy', 'warning', genericTestimonials.length + ' testimonial or customer quote block(s) use generic praise without concrete outcome context.', 'Replace vague praise such as Amazing product or Highly recommend with a workflow, metric, timeframe, or case-study result.')
    }
    const pricingSurfaceSignal = () => {
      const metadata = [...document.querySelectorAll('[class],[id],[aria-label],[title]')]
        .slice(0, 200)
        .map((el) => [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' '))
        .join(' ')
      const content = pageText + ' ' + metadata
      return brandLandingSignal() && /\b(?:pricing|plans?|packages?|tiers?|subscription|billing|monthly|annual|yearly|starter|pro|team|business|enterprise)\b/i.test(content) && /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/i.test(content)
    }
    const pricingPlanCount = () => {
      const classPlans = [...document.querySelectorAll('section,article,div,li')]
        .filter(visible)
        .filter((el) => /\b(?:pricing card|price card|plan|tier|package|subscription card)\b/i.test(classText(el)))
        .length
      const priceValues = (pageText.match(/[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/gi) || []).length
      return Math.max(classPlans, priceValues)
    }
    const pricingStructure = () => {
      if (pricingPlanCount() < 2) return false
      const detailCount = [
        /\b(?:popular|recommended|best value|best for|most chosen|featured|most popular|team favorite)\b/i.test(pageText),
        /\b(?:\/\s*(?:mo|month|yr|year)|per\s+(?:month|year|seat|user)|monthly|annual|yearly|billing|billed|save\s+\d+%)\b/i.test(pageText),
        /\b(?:includes?|included|unlimited|up to|users?|seats?|projects?|storage|support|workspaces?|everything in|feature|features|api|sso|audit log)\b/i.test(pageText),
        [...document.querySelectorAll('button,a,[role="button"],[role="link"]')]
          .filter(visible)
          .some((control) => /\b(?:choose plan|select plan|start trial|start free trial|buy now|upgrade|contact sales|get started with|talk to sales)\b/i.test(controlName(control)))
      ].filter(Boolean).length
      return detailCount >= 2
    }
    if (pricingSurfaceSignal() && hasTopHeading && interactive.length > 0 && !pricingStructure()) {
      push('runtime-weak-pricing-structure', 'warning', 'This pricing or plans page lacks a complete pricing comparison structure.', 'Add distinct plan cards or a comparison table with prices, billing cadence, a recommended plan, feature differences, and plan-specific CTAs.')
    }
    const pricingPlanCards = () => [...document.querySelectorAll('article,li,div')]
      .filter(visible)
      .filter((el) => /\b(?:pricing card|price card|plan|tier|package|subscription card)\b/i.test(classText(el)))
      .filter((el) => /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/i.test(textOf(el)))
    const genericPricingPlanDetail = (el) => {
      const text = textOf(el).replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim()
      return /\b(?:all (?:core )?features|everything you need|basic features|advanced features|premium features|standard support|priority support|premium support|custom support|best for (?:individuals|teams|businesses|growth)|great for (?:individuals|teams|businesses|growth)|perfect for (?:individuals|teams|businesses|growth)|grow faster|scale with confidence|contact us for details)\b/i.test(text) &&
        !/\b(?:up to\s+)?\d[\d,.]*\s?(?:users?|seats?|projects?|pages?|workspaces?|gb|mb|credits?|requests?|records?|exports?|integrations?|domains?|forms?|submissions?|hours?)\b|\bunlimited\s+(?:users?|seats?|projects?|pages?|workspaces?|exports?|integrations?)\b|\b(?:api|audit log|client workspaces?|compliance|custom domain|dedicated manager|email support|gallery analytics|gdpr|hipaa|implementation|launch support|migration|onboarding|permissions?|roles?|sandbox|sla|soc\s?2|sso|storage|white label)\b/i.test(text)
    }
    const genericPricingPlans = pricingPlanCards().filter(genericPricingPlanDetail)
    if (pricingSurfaceSignal() && pricingStructure() && genericPricingPlans.length >= 2) {
      push('runtime-generic-pricing-plan-detail', 'warning', 'Several pricing plan cards use generic filler instead of concrete plan differences.', 'Replace filler such as All core features, Everything you need, or Priority support with concrete limits, plan-specific capabilities, audiences, service levels, or upgrade reasons.')
    }
    const normalizedPricingPlanActionLabel = (label) => String(label || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
    const pricingPlanActionLabels = (el) => [...el.querySelectorAll('button,a,input,[role="button"],[role="link"]')]
      .filter(visible)
      .map((control) => {
        if (control instanceof HTMLInputElement) {
          const type = (control.type || '').toLowerCase()
          if (!['button', 'submit'].includes(type)) return ''
        }
        return controlName(control)
      })
      .map(normalizedPricingPlanActionLabel)
      .filter(Boolean)
    const genericPricingPlanActionLabel = (label) => {
      const normalized = normalizedPricingPlanActionLabel(label)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:buy now|choose plan|choose this plan|get started|get started now|select plan|select this plan|start now|start trial|start free trial|subscribe|try now|upgrade)$/i.test(normalized)
    }
    const pricingPlanActionLabelsAll = pricingPlanCards().flatMap(pricingPlanActionLabels).filter(genericPricingPlanActionLabel)
    const repeatedPricingPlanActions = new Set([...pricingPlanActionLabelsAll.reduce((counts, label) => {
      const normalized = label.toLowerCase()
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
      return counts
    }, new Map()).entries()].filter(([, count]) => count >= 2).map(([label]) => label))
    const genericPricingPlanActionCards = repeatedPricingPlanActions.size === 0
      ? []
      : pricingPlanCards().filter((card) => pricingPlanActionLabels(card).some((label) => repeatedPricingPlanActions.has(label.toLowerCase())))
    if (pricingSurfaceSignal() && pricingStructure() && genericPricingPlanActionCards.length > 0) {
      push('runtime-generic-pricing-plan-action-labels', 'warning', genericPricingPlanActionCards.length + ' pricing plan card(s) repeat the same generic action label.', 'Replace repeated Choose plan, Get started, or Start trial actions with plan-specific CTAs such as Start studio trial, Upgrade to agency launch, or Talk to enterprise sales.')
    }
    const marketingFeatureSurfaceSignal = () => {
      const headingText = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
        .filter(visible)
        .map(textOf)
        .join(' ')
      const metadata = [...document.querySelectorAll('[class],[id],[aria-label],[title]')]
        .slice(0, 200)
        .map((el) => [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' '))
        .join(' ')
      const signal = pageText + ' ' + headingText + ' ' + metadata
      return brandLandingSignal() &&
        /\b(?:landing page|marketing site|brand site|homepage|home page|features?|product page|website|waitlist|book a demo|start free trial)\b/i.test(signal) &&
        !portfolioSurfaceSignal() &&
        !pricingSurfaceSignal()
    }
    const featureSectionSignal = (el) => {
      const metadata = [
        el.getAttribute('class') || '',
        el.getAttribute('id') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || ''
      ].join(' ').replace(/[-_]/g, ' ')
      return /\b(?:features?|benefits?|capabilit(?:y|ies)|use[- ]cases?|solutions?|workflow|how it works|what you can do|why teams choose|product details?|core tools?)\b/i.test(textOf(el) + ' ' + metadata)
    }
    const featureItemClass = (el) => /\b(?:feature card|feature item|benefit card|benefit item|capability|use case|workflow card|solution card|tool card|module card)\b/i.test(classText(el))
    const featureDetail = (text) => /\b(?:automate|automation|analy[sz]e|analytics|approve|approval|collaborate|collaboration|custom|dashboard|editor|export|gallery|handoff|import|insights?|integrations?|launch|manage|permissions?|publish|routing|schedule|sync|templates?|track|workflow)\b/i.test(text)
    const featureAnatomy = () => [...document.querySelectorAll('section')]
      .filter(visible)
      .some((section) => {
        if (!featureSectionSignal(section)) return false
        const itemCount = [...section.querySelectorAll('article,li,div')]
          .filter(visible)
          .filter((item) => {
            const itemText = textOf(item)
            return (item.tagName.toLowerCase() === 'article' || item.tagName.toLowerCase() === 'li' || featureItemClass(item)) && itemText.length >= 28
          })
          .length
        return itemCount >= 2 && featureDetail(textOf(section))
      })
    if (marketingFeatureSurfaceSignal() && hasTopHeading && interactive.length > 0 && pageText.length >= 220 && !featureAnatomy()) {
      push('runtime-weak-feature-anatomy', 'warning', 'This landing, brand, product, feature, or marketing page has no concrete feature or benefit anatomy.', 'Add feature, benefit, capability, or use-case sections with named product capabilities, user outcomes, and product-specific details.')
    }
    const featureCards = () => [...document.querySelectorAll('section')]
      .filter(visible)
      .filter(featureSectionSignal)
      .flatMap((section) => [...section.querySelectorAll('article,li,div')]
        .filter(visible)
        .filter((item) => {
          const tagName = item.tagName.toLowerCase()
          return (tagName === 'article' || tagName === 'li' || featureItemClass(item)) && textOf(item).length >= 28
        }))
    const genericFeatureCardDetail = (el) => {
      const heading = textOf(el.querySelector('h2,h3,h4,strong,b') || el)
        .replace(/[^\p{L}\p{N} ]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const text = textOf(el).replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim()
      const genericTitle = /^(?:ai\s+)?(?:automation|analytics|collaboration|security|customization|dashboard|efficiency|growth|insights?|integrations?|productivity|reporting|simplicity|speed|support|templates?|visibility|workflow)$/i.test(heading)
      const genericCopy = /\b(?:advanced|built for modern teams|easy to use|everything in one place|flexible|intuitive|modern|move faster|powerful|robust|save time|scale with confidence|seamless|smart|streamline (?:your|the) workflow|work smarter)\b/i.test(text)
      const concreteDetail = /\b(?:account|approval|asset|booking|branch|campaign|case|crew|customer|dashboard|dispatch|handoff|invoice|job|launch|lead|order|payment|portfolio|project|queue|record|renewal|request|route|shift|sla|studio|supplier|ticket|vendor|workspace)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|days?|hours?|users?|projects?|orders?|tickets?|records?|pages?)\b/i.test(text)
      return (genericTitle || genericCopy) && !concreteDetail
    }
    const genericFeatureCards = featureCards().filter(genericFeatureCardDetail)
    if (marketingFeatureSurfaceSignal() && featureAnatomy() && genericFeatureCards.length >= 2) {
      push('runtime-generic-feature-card-detail', 'warning', 'Several feature or benefit cards use generic capability copy.', 'Replace broad cards such as Automation, Analytics, or Security with named product capabilities tied to concrete objects, workflows, user outcomes, or measurable details.')
    }
    const conversionCloseElements = () => {
      const bodyElements = [...document.body.querySelectorAll('header,main,section,article,aside,footer,form,div')]
        .filter(visible)
      return bodyElements.slice(Math.max(0, Math.floor(bodyElements.length * 0.55)))
    }
    const conversionClose = () => {
      const closeElements = conversionCloseElements()
      const closeText = closeElements.map(textOf).join(' ')
      const footerText = [...document.querySelectorAll('footer')].filter(visible).map(textOf).join(' ')
      const textSignal = /\b(?:faq|frequently asked|questions|ready to|start now|start free trial|book a demo|schedule a demo|request demo|get started|contact us|talk to sales|join waitlist|sign up|subscribe|request access|contact sales|next step|final step|still have questions)\b/i
      const strongTextSignal = /\b(?:faq|frequently asked|questions|ready to|schedule a demo|request demo|contact us|join waitlist|sign up|subscribe|request access|next step|final step|still have questions)\b/i
      if (strongTextSignal.test(closeText) || textSignal.test(footerText)) return true
      if (closeElements.some((el) => {
        if (el.tagName.toLowerCase() !== 'form' && !el.querySelector('form')) return false
        return /\b(email|name|company|message|demo|contact|signup|subscribe|waitlist)\b/i.test(textOf(el))
      })) return true
      return closeElements.some((el) => /\b(?:final cta|bottom cta|closing cta|conversion|contact|demo form|signup form|lead form|waitlist|faq|questions|footer cta|next step)\b/i.test(classText(el)))
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && !conversionClose()) {
      push('runtime-weak-conversion-close', 'warning', 'This brand, landing, portfolio, pricing, or marketing page has no final conversion or next-step section near the end.', 'Add a closing CTA/footer, FAQ, contact/demo/signup form, calendar/contact route, or next-step section so the page has a complete conversion path.')
    }
    const genericConversionClose = () => {
      const closeBlocks = conversionCloseElements()
        .filter((el) => {
          const metadata = [
            el.getAttribute('class') || '',
            el.getAttribute('id') || '',
            el.getAttribute('aria-label') || '',
            el.getAttribute('title') || ''
          ].join(' ').replace(/[-_]/g, ' ')
          const text = textOf(el)
          return el.tagName.toLowerCase() === 'footer' ||
            /\b(?:final cta|bottom cta|closing cta|conversion|contact|demo form|signup form|lead form|waitlist|faq|questions|footer cta|next step)\b/i.test(metadata) ||
            /\b(?:ready to|get started|start now|start today|take the next step|contact us|sign up|join waitlist)\b/i.test(text)
        })
      return closeBlocks.some((el) => {
        const text = textOf(el).replace(/\s+/g, ' ').trim()
        const headings = [...el.querySelectorAll('h1,h2,h3,[role="heading"]')]
          .filter(visible)
          .map(textOf)
          .map((heading) => heading.replace(/&amp;/gi, '&').replace(/[\s:|/\\-]+/g, ' ').replace(/[^\p{L}\p{N}& ]/gu, ' ').replace(/\s+/g, ' ').trim())
        const genericHeading = headings.some((heading) => /^(?:get started today|let'?s get started|ready(?: to)?(?: get started| start| begin| grow| scale| take the next step| transform your workflow| unlock your potential)?|start your journey|take the next step)$/i.test(heading))
        const genericCopy = /\b(?:discover what (?:we|our|the) (?:platform|product|solution) can do|don'?t wait|join thousands|our team can help|see what (?:we|our|the) (?:platform|product|solution) can do|start (?:today|now)|take the next step|unlock your potential|we'?re here to help)\b/i.test(text)
        const concreteClose = /\b(?:audit|checklist|demo|dispatch|handoff|implementation|inquir(?:y|ies)|launch|migration|onboarding|portfolio|pricing|proposal|quote|review|route|schedule|setup|trial|within)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|hours?|months?|projects?|weeks?)\b/i.test(text)
        return (genericHeading || genericCopy) && !concreteClose
      })
    }
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && conversionClose() && genericConversionClose()) {
      push('runtime-generic-conversion-close', 'warning', 'The final conversion or next-step section uses generic closing copy.', 'Replace vague closes such as Ready to get started with a specific outcome, timeframe, next deliverable, or domain-specific CTA.')
    }
    const faqBlocks = () => [...document.querySelectorAll('section,article,div,details')]
      .filter(visible)
      .filter((el) => {
        const metadata = [
          el.getAttribute('class') || '',
          el.getAttribute('id') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' ')
        const headingText = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6,summary')]
          .filter(visible)
          .map(textOf)
          .join(' ')
        return /\b(?:faq|frequently asked questions|frequently asked|question answers?|q and a|q&a)\b/i.test(metadata + ' ' + headingText)
      })
    const faqQuestionCount = (el) => {
      const questionTexts = [
        ...[...el.querySelectorAll('h3,h4,summary,dt,button')]
          .filter(visible)
          .map(textOf),
        ...((textOf(el).match(/[^.!?。！？]*\?/g)) || [])
      ]
      return questionTexts.filter((text) => /\?|^(?:can|do|does|how|what|when|where|who|why|will|is|are|should|which)\b/i.test(String(text || '').trim())).length
    }
    const faqAnswerCount = (el) => [...el.querySelectorAll('p,dd,li')]
      .filter(visible)
      .map(textOf)
      .map((text) => text.replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= 28 && !/\?|^(?:can|do|does|how|what|when|where|who|why|will|is|are|should|which)\b/i.test(text)).length
    const weakFaqs = faqBlocks().filter((el) => faqQuestionCount(el) < 2 || faqAnswerCount(el) < 2)
    if (brandLandingSignal() && weakFaqs.length > 0) {
      push('runtime-weak-faq-anatomy', 'warning', weakFaqs.length + ' FAQ or frequently asked questions section(s) are too thin to handle real customer objections.', 'Add multiple concrete question/answer items covering objections such as pricing, migration, support, security, setup, or timeline.')
    }
    const faqQuestionTexts = (el) => {
      const questionTexts = [
        ...[...el.querySelectorAll('h3,h4,summary,dt,button')]
          .filter(visible)
          .map(textOf),
        ...((textOf(el).match(/[^.!?。！？]*\?/g)) || [])
      ]
      return [...new Set(questionTexts
        .map((text) => String(text || '').replace(/\s+/g, ' ').trim())
        .filter((text) => /\?|^(?:can|do|does|how|what|when|where|who|why|will|is|are|should|which)\b/i.test(text)))]
    }
    const genericFaqQuestion = (text) => {
      const normalized = String(text || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
      return normalized.length >= 8 && normalized.length <= 80 &&
        /^(?:can i (?:get started|try it|use it)|do you offer support|how does (?:it|this|the (?:platform|product|service|solution)) work|is (?:it|this) (?:easy|easy to use|right for me)|what (?:do i get|is (?:it|this|the (?:platform|product|service|solution)))|who is (?:it|this) for|why choose (?:us|this))\??$/i.test(normalized)
    }
    const concreteFaqQuestion = (text) => {
      const normalized = String(text || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
      return /\b(?:api|audit|billing|cancel|compliance|data|demo|export|gdpr|hipaa|implementation|import|integrations?|migrat(?:e|ion)|onboarding|permissions?|pricing|refund|retention|security|setup|sla|soc\s?2|sso|support|timeline|training|trial|uptime|users?)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|weeks?|months?|hours?|users?|seats?|projects?|pages?|records?)\b/i.test(normalized)
    }
    const genericFaqQuestionBlocks = faqBlocks().filter((el) => {
      if (faqQuestionCount(el) < 2 || faqAnswerCount(el) < 2) return false
      const questions = faqQuestionTexts(el)
      if (questions.length < 2) return false
      const genericCount = questions.filter(genericFaqQuestion).length
      const concreteCount = questions.filter(concreteFaqQuestion).length
      return concreteCount === 0 && genericCount >= Math.ceil(questions.length * 0.67)
    })
    if (brandLandingSignal() && genericFaqQuestionBlocks.length > 0) {
      push('runtime-generic-faq-questions', 'warning', genericFaqQuestionBlocks.length + ' FAQ or frequently asked questions section(s) use generic template questions.', 'Replace questions such as What is this, How does it work, or Who is this for with concrete objections about pricing, migration, setup time, security, support, integrations, or plan limits.')
    }
    const faqAnswerTexts = (el) => [...el.querySelectorAll('p,dd,li')]
      .filter(visible)
      .map(textOf)
      .map((text) => text.replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= 18 && !/\?|^(?:can|do|does|how|what|when|where|who|why|will|is|are|should|which)\b/i.test(text))
    const genericFaqAnswer = (text) => {
      const normalized = String(text || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim()
      return normalized.length >= 18 &&
        /^(?:yes|no|it depends|contact (?:us|sales|support)|reach out|get in touch|learn more|coming soon|we support this|we can help|our team can help|our team will help|this is available|all plans include this|available on all plans)\b/i.test(normalized) &&
        !/\b(?:api|audit|billing|cancel|compliance|data|demo|export|gdpr|hipaa|implementation|import|integration|migration|onboarding|permission|pricing|refund|retention|security|setup|sla|soc\s?2|sso|support|timeline|training|trial|uptime|users?)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|weeks?|months?|hours?|users?|seats?|projects?|pages?|records?)\b/i.test(normalized)
    }
    const genericFaqs = faqBlocks().filter((el) => faqQuestionCount(el) >= 2 && faqAnswerCount(el) >= 2 && faqAnswerTexts(el).filter(genericFaqAnswer).length >= 2)
    if (brandLandingSignal() && genericFaqs.length > 0) {
      push('runtime-generic-faq-answers', 'warning', genericFaqs.length + ' FAQ or frequently asked questions section(s) use generic, evasive answers.', 'Replace vague answers such as Contact us, Learn more, or Our team can help with concrete objection-handling details about pricing, migration, security, support, setup, timelines, or integrations.')
    }
    const siteFooter = () => [...document.querySelectorAll('footer')]
      .filter(visible)
      .some((footer) => {
        const validLinks = [...footer.querySelectorAll('a')]
          .filter(visible)
          .filter((link) => !deadHref(link))
          .length
        const metadata = [
          footer.getAttribute('class') || '',
          footer.getAttribute('id') || '',
          footer.getAttribute('aria-label') || '',
          footer.getAttribute('title') || ''
        ].join(' ').replace(/[-_]/g, ' ')
        return validLinks >= 2 ||
          /\b(?:privacy|terms|copyright|all rights reserved|contact|support|email|linkedin|twitter|x\.com|instagram|github|dribbble|behance|address|newsletter|status|security|legal)\b/i.test(textOf(footer)) ||
          /\b(?:site footer|footer nav|footer links|legal|social links|contact links|footer brand|copyright)\b/i.test(classText(footer) + ' ' + metadata)
      })
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && pageText.length >= 220 && !siteFooter()) {
      push('runtime-weak-site-footer', 'warning', 'This brand, landing, portfolio, pricing, or marketing page has no complete site footer.', 'Add a real footer with brand/contact details, secondary links, social/legal links, copyright, support, newsletter, or status information.')
    }
    const genericSiteFooterDetail = () => [...document.querySelectorAll('footer')]
      .filter(visible)
      .some((footer) => {
        const text = textOf(footer)
        if (/\b(?:privacy|terms|copyright|all rights reserved|contact|support|email|linkedin|twitter|x\.com|instagram|github|dribbble|behance|address|newsletter|status|security|legal)\b/i.test(text)) return false
        const labels = [...footer.querySelectorAll('h2,h3,h4,strong,b,a')]
          .filter(visible)
          .map(textOf)
          .map((label) => label.replace(/&amp;/gi, '&').replace(/[\s:|/\\-]+/g, ' ').replace(/[^\p{L}\p{N}& ]/gu, ' ').replace(/\s+/g, ' ').trim())
          .filter((label) => label.length > 0 && label.length <= 32)
        return labels.filter((label) => /^(?:about(?: us)?|company|explore|follow(?: us)?|links|more|navigation|pages|product|products|quick links|resources|social|solutions)$/i.test(label)).length >= 2
      })
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && siteFooter() && genericSiteFooterDetail()) {
      push('runtime-generic-site-footer-detail', 'warning', 'The site footer uses generic template columns without concrete footer details.', 'Replace Product, Company, or Resources-only footer columns with brand/contact details, legal/status/social/help links, copyright, or product-specific routes.')
    }
    const tabContainerClass = (el) => /\b(?:tablist|tabs?|tab list|segmented|segmented control|segment control|view switcher|mode switcher)\b/i.test(classText(el))
    const tabCurrentState = (el) => {
      const selectedSelector = '[aria-current]:not([aria-current="false"]),[aria-selected="true"],[data-state="active"],[data-state="current"],[data-state="selected"],.active,.current,.selected,.is-active,.is-current,.is-selected'
      return el.matches(selectedSelector) || Boolean(el.querySelector(selectedSelector))
    }
    const tabControlCount = (el) => [...el.querySelectorAll('button,a,input,[role="tab"]')]
      .filter(visible)
      .filter((control) => {
        const role = (control.getAttribute('role') || '').toLowerCase()
        const tag = control.tagName.toLowerCase()
        const inputType = control instanceof HTMLInputElement ? (control.type || '').toLowerCase() : ''
        return role === 'tab' || tag === 'button' || tag === 'a' || inputType === 'radio'
      })
      .length
    const weakTabGroups = [...document.querySelectorAll('div,section,nav,ul,[role="tablist"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        return (role === 'tablist' || tabContainerClass(el)) && tabControlCount(el) >= 2 && !tabCurrentState(el)
      })
    if (weakTabGroups.length > 0) {
      push('runtime-weak-tab-current-state', 'warning', weakTabGroups.length + ' tab, segmented control, or view switcher group(s) have no selected/current state.', 'Mark the active tab with aria-selected, aria-current, data-state="active", or a visible active/current/selected style.')
    }
    const normalizedTabLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[\s:|/\\-]+/g, ' ')
      .replace(/[^\p{L}\p{N}& ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericTabLabel = (text) => {
      const normalized = normalizedTabLabel(text)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:activity|all|details?|general|history|items?|overview|settings|summary|tab\s*\d+|view\s*\d+|option\s*\d+)$/i.test(normalized)
    }
    const specificTabLabel = (text) => {
      const normalized = normalizedTabLabel(text)
      return normalized.length > 0 && normalized.length <= 48 && /\b(?:account|accounts|approval|approvals|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|task|tasks|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i.test(normalized)
    }
    const tabControlLabels = (el) => [...el.querySelectorAll('button,a,input,[role="tab"]')]
      .filter(visible)
      .filter((control) => {
        const role = (control.getAttribute('role') || '').toLowerCase()
        const tag = control.tagName.toLowerCase()
        const inputType = control instanceof HTMLInputElement ? (control.type || '').toLowerCase() : ''
        return role === 'tab' || tag === 'button' || tag === 'a' || inputType === 'radio'
      })
      .map(controlName)
      .map(normalizedTabLabel)
      .filter(Boolean)
    const genericTabGroups = [...document.querySelectorAll('div,section,nav,ul,[role="tablist"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!(role === 'tablist' || tabContainerClass(el)) || tabControlCount(el) < 2 || !tabCurrentState(el)) return false
        const labels = [...new Set(tabControlLabels(el))]
        if (labels.length < 2) return false
        const genericCount = labels.filter(genericTabLabel).length
        const specificCount = labels.filter(specificTabLabel).length
        return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
      })
    if (productAppSignal() && genericTabGroups.length > 0) {
      push('runtime-generic-tab-labels', 'warning', 'A tab, segmented control, or view switcher uses generic tab labels.', 'Replace Overview, Details, Settings, or Tab 1 labels with domain-specific views, queues, objects, or workflow stages.')
    }
    const workflowStepContainerClass = (el) => /\b(?:stepper|steps?|workflow|wizard|progress|timeline|process|journey|onboarding|checkout|approval flow)\b/i.test(classText(el))
    const workflowStepItemClass = (el) => /\b(?:step|stage|milestone|phase|checkpoint|timeline item)\b/i.test(classText(el))
    const workflowStepState = (el) => {
      const selectedSelector = '[aria-current]:not([aria-current="false"]),[aria-selected="true"],[aria-checked="true"],[data-state="active"],[data-state="current"],[data-state="complete"],[data-state="completed"],[data-state="done"],[data-state="upcoming"],[data-state="pending"],[data-status],.active,.current,.complete,.completed,.done,.upcoming,.pending,.is-active,.is-current,.is-complete,.is-completed,.is-done,[role="progressbar"][aria-valuenow]'
      return el.matches(selectedSelector) || Boolean(el.querySelector(selectedSelector))
    }
    const workflowStepCount = (el) => {
      const classItems = [...el.querySelectorAll('li,div,article,section')]
        .filter(visible)
        .filter(workflowStepItemClass)
        .length
      const listItems = [...el.querySelectorAll('li')].filter(visible).length
      const numbered = (textOf(el).match(/\b(?:step\s*)?\d+[.)]\s+[A-Z]/g) || []).length
      return Math.max(classItems, listItems, numbered)
    }
    const weakWorkflowSteps = [...document.querySelectorAll('ol,ul,div,section,article,nav,[role="progressbar"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        return (role === 'progressbar' || workflowStepContainerClass(el)) && workflowStepCount(el) >= 3 && !workflowStepState(el)
      })
    if (weakWorkflowSteps.length > 0) {
      push('runtime-weak-workflow-step-state', 'warning', weakWorkflowSteps.length + ' workflow, stepper, timeline, or process group(s) have no current, completed, or upcoming step state.', 'Mark workflow steps with current/completed/upcoming state using aria-current, data-state/status, progressbar values, or visible active/completed/pending styling.')
    }
    const normalizedWorkflowStepLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&.)/-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericWorkflowStepLabel = (text) => /^(?:step|step\s*\d+|stage\s*\d+|phase\s*\d+|milestone\s*\d+|checkpoint\s*\d+|\d+[.)]?)$/i.test(normalizedWorkflowStepLabel(text))
    const specificWorkflowStepLabel = (text) => /\b(?:account|approval|assign|billing|brief|checkout|connect|confirm|deploy|discover|draft|handoff|import|intake|invoice|launch|map|onboard|order|pay|payment|publish|renewal|request|review|route|schedule|setup|ship|submit|sync|triage|verify)\b/i.test(normalizedWorkflowStepLabel(text))
    const workflowStepLabels = (el) => [...el.querySelectorAll('li,div,article,section')]
      .filter(visible)
      .filter((item) => item.tagName.toLowerCase() === 'li' || workflowStepItemClass(item))
      .map(textOf)
      .map(normalizedWorkflowStepLabel)
      .filter((label) => label.length > 0 && label.length <= 64)
    const genericWorkflowSteps = [...document.querySelectorAll('ol,ul,div,section,article,nav,[role="progressbar"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!(role === 'progressbar' || workflowStepContainerClass(el)) || workflowStepCount(el) < 3 || !workflowStepState(el)) return false
        const labels = [...new Set(workflowStepLabels(el))]
        if (labels.length < 3) return false
        const genericCount = labels.filter(genericWorkflowStepLabel).length
        const specificCount = labels.filter(specificWorkflowStepLabel).length
        return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
      })
    if (genericWorkflowSteps.length > 0) {
      push('runtime-generic-workflow-step-labels', 'warning', 'A multi-step workflow, stepper, timeline, or process uses generic step labels.', 'Replace Step 1, Step 2, or Phase 3 labels with domain-specific actions, milestones, objects, or decisions in the flow.')
    }
    const metricContainerClass = (el) => /\b(?:kpi|metric|stat|summary|scorecard|insight|number card|value card)\b/i.test(classText(el))
    const metricValue = (value) => /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|k|m|b|arr|mrr|usd|eur|gbp|cny|rmb|users?|members?|tasks?|orders?|tickets?|invoices?|files?|days?|hrs?|hours?)\b|\b\d{2,}(?:\.\d+)?\b/i.test(String(value || ''))
    const metricContext = (value) => /\b(?:vs|versus|from|since|last|previous|prior|target|goal|benchmark|trend|delta|change|increase|decrease|up|down|won|lost|this week|this month|this quarter|today|yesterday|q[1-4]|mom|yoy|week over week|month over month|year over year)\b|[+\-]\s?\d[\d,.]*\s?%|[↑↓]/i.test(String(value || ''))
    const metricCardLabel = (el) => {
      const heading = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter(visible).map(textOf).find(Boolean)
      if (heading) return heading
      return [...el.querySelectorAll('span,small,p')].filter(visible).map(textOf).find((text) => text.length > 0 && text.length <= 64) || ''
    }
    const normalizedMetricLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/%+-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericMetricLabel = (value) => {
      const label = normalizedMetricLabel(value)
        .replace(/\b(?:today|this|last|previous|prior|current|q[1-4]|month|week|quarter|year|daily|weekly|monthly|annual|yearly)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return label.length > 0 && label.length <= 40 && /^(?:activity|conversion(?: rate)?|cycle time|engagement|growth|performance|pipeline|productivity|progress|revenue|sales|tasks?|usage|users?)$/i.test(label)
    }
    const specificMetricText = (value) => /\b(?:account|accounts|approval|approvals|arr|assignee|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|mrr|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i.test(String(value || ''))
    const metricCards = [...document.querySelectorAll('section,article,div,li')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const text = textOf(el)
        return metricContainerClass(el) && text.length <= 180 && metricValue(text)
      })
    const genericMetricCards = metricCards.filter((el) => genericMetricLabel(metricCardLabel(el)) && !specificMetricText(textOf(el)))
    if (productAppSignal() && productAppModuleSignalCount() >= 2 && genericMetricCards.length >= 3) {
      push('runtime-generic-metric-card-labels', 'warning', 'Several KPI or metric cards use generic dashboard labels.', 'Replace Revenue, Users, Growth, or Tasks-only scorecards with metrics that name the business object, workflow, period, owner, SLA, risk, or target.')
    }
    const weakMetricCards = [...document.querySelectorAll('section,article,div,li')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!metricContainerClass(el)) return false
        const text = textOf(el)
        return text.length <= 180 && metricValue(text) && !metricContext(text + ' ' + classText(el))
      })
    if (weakMetricCards.length >= 3) {
      push('runtime-weak-metric-context', 'warning', weakMetricCards.length + ' KPI or metric card(s) show values without timeframe, delta, target, or trend context.', 'Add previous-period deltas, timeframe labels, target/goal comparisons, trend direction, or benchmark notes for key metrics.')
    }
    const recoverableStateText = (value) => /\b(?:no (?:[a-z]+ )?(?:data|results|items|records|invoices|tasks|messages|files|matches)|nothing found|empty (?:queue|state|list|inbox)|error|failed|failure|offline|disconnected|permission denied|access denied|unauthorized|unavailable|unable to|could not load|cannot load|sync failed|expired)\b/i.test(String(value || ''))
    const recoverableStateHeading = (value) => /^(?:no (?:[a-z]+ )?(?:data|results|items|records|invoices|tasks|messages|files|matches)|nothing found|empty|error|failed|failure|offline|disconnected|permission|access denied|sync failed|retry failed|unable to|could not|cannot load|expired)/i.test(String(value || '').replace(/\s+/g, ' ').trim())
    const recoverableStateClass = (el) => /\b(?:empty|error|failure|failed|offline|permission|alert|notice|banner|state|status|retry)\b/i.test(classText(el))
    const recoverableStateSignal = (el) => {
      const role = (el.getAttribute('role') || '').toLowerCase()
      const moduleText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
      if (el.getAttribute('aria-busy') === 'true') return false
      if ((role === 'alert' || role === 'status' || el.hasAttribute('aria-live')) && recoverableStateText(moduleText)) return true
      if (recoverableStateClass(el) && recoverableStateText(moduleText)) return true
      return [...el.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')]
        .some((heading) => recoverableStateHeading(textOf(heading)))
    }
    const hasRecoveryAction = (el) => [...el.querySelectorAll('button,a,input,[role="button"],[role="link"]')]
      .filter(visible)
      .some((control) => {
        if (control.hasAttribute('disabled') || (control.getAttribute('aria-disabled') || '').toLowerCase() === 'true') return false
        if (control.tagName.toLowerCase() === 'a' && deadHref(control)) return false
        return controlName(control).length >= 2
      })
    const weakRecoverableStates = [...document.querySelectorAll('section,article,aside,div,[role="alert"],[role="status"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        return recoverableStateSignal(el) && !hasRecoveryAction(el)
      })
    if (weakRecoverableStates.length > 0) {
      push('runtime-weak-state-recovery-action', 'warning', weakRecoverableStates.length + ' recoverable state module(s) have no visible next action.', 'Add a clear recovery action such as Retry, Clear filters, Import records, Connect source, Request access, or Contact support so empty/error/offline states are actionable.')
    }
    const actionableRecordText = (value) => /\b(?:account|approval|approve|assignment|case|customer|file|invoice|lead|message|order|payment|record|renewal|request|review|supplier|task|ticket|vendor|approved|pending|overdue|blocked|at risk|delayed|failed|needs review)\b/i.test(String(value || ''))
    const recordDataPatterns = [
      /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b/i,
      /\b\d[\d,.]*\s?(?:%|k|m|b|ms|sec|secs|min|mins|hr|hrs|hour|hours|day|days|week|weeks|users?|members?|tasks?|orders?|tickets?|invoices?|files?|gb|mb)\b/i,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\bq[1-4]\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i,
      /\b[A-Z]{2,}[-_#]?\d{2,}\b|\b(?:invoice|order|ticket|case|id|ref|build)\s*#?\s*[A-Z0-9-]{3,}\b/i,
      /\b(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready|needs review)\b/i,
      /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/,
      /\b[A-Z][A-Za-z0-9&.-]+\s+(?:Inc|LLC|Ltd|Labs|Finance|Bank|Studio|Clinic|Health|Systems|Group|Co)\b/
    ]
    const actionableRecordSignal = (value) => {
      const text = String(value || '').replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim()
      return actionableRecordText(text) && recordDataPatterns.filter((pattern) => pattern.test(text)).length >= 2
    }
    const genericRecoverableStateCopy = [...document.querySelectorAll('section,article,aside,div,[role="alert"],[role="status"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!recoverableStateSignal(el) || !hasRecoveryAction(el)) return false
        const text = textOf(el).replace(/\b(?:loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ').replace(/\s+/g, ' ').trim()
        return /\b(?:no data|no items|nothing (?:here|to show)|nothing found|empty state|something went wrong|try again later|failed to load|unable to load|could not load|error occurred)\b/i.test(text) &&
          !/\b(?:account|approval|assignee|asset|billing|case|claim|client|contract|customer|deployment|dispatch|filter|handoff|import|incident|integration|inventory|invoice|lead|order|owner|patient|payment|payout|policy|proposal|record|renewal|request|risk|route|salesforce|shipment|shift|sla|supplier|sync|ticket|vendor|workspace)\b/i.test(text) &&
          recordDataPatterns.filter((pattern) => pattern.test(text)).length < 2
      })
    if (genericRecoverableStateCopy.length > 0) {
      push('runtime-generic-recoverable-state-copy', 'warning', 'A recoverable empty, error, offline, or permission state uses generic copy.', 'Replace No data, Nothing here, or Something went wrong copy with the missing object, likely cause, domain-specific next step, and recovery action.')
    }
    const feedbackMessageSignal = (el) => {
      const role = (el.getAttribute('role') || '').toLowerCase()
      if (role === 'alert' || role === 'status' || el.hasAttribute('aria-live')) return true
      return /\b(?:alert|banner|feedback|inline message|message|notification|notice|snackbar|status message|toast)\b/i.test(classText(el))
    }
    const normalizedFeedbackMessageText = (value) => String(value || '')
      .replace(/\b(?:loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[.!?。！？:]+$/g, '')
      .trim()
    const genericFeedbackMessageCopy = (value) => {
      const text = normalizedFeedbackMessageText(value)
      return text.length > 0 && text.length <= 64 && /^(?:changes saved|completed|done|error|failed|failure|info|operation complete|request sent|saved|sent|submitted|success|successfully saved|try again|updated|warning)$/i.test(text)
    }
    const specificFeedbackMessageCopy = (value) => {
      const text = normalizedFeedbackMessageText(value)
      return /\b(?:account|approval|assignee|billing|case|claim|client|connect|customer|dispatch|filter|handoff|import|incident|integration|invoice|lead|order|owner|payment|proposal|record|renewal|request|retry|risk|route|salesforce|sync|ticket|vendor|workspace)\b/i.test(text) ||
        recordDataPatterns.filter((pattern) => pattern.test(text)).length > 0
    }
    const genericFeedbackMessages = [...document.querySelectorAll('section,article,aside,div,p,span,output,[role="alert"],[role="status"],[aria-live]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!feedbackMessageSignal(el)) return false
        const text = textOf(el)
        return genericFeedbackMessageCopy(text) && !specificFeedbackMessageCopy(text)
      })
    if (genericFeedbackMessages.length > 0) {
      push('runtime-generic-feedback-message-copy', 'warning', 'A toast, alert, banner, or inline feedback message uses generic copy.', 'Replace Success, Saved, Error, or Failed-only feedback with the object, action result, and next step or recovery path.')
    }
    const hasRecordAction = (el) => [...el.querySelectorAll('button,a,input,select,[role="button"],[role="checkbox"],[role="link"],[role="menuitem"],[role="radio"]')]
      .filter(visible)
      .some((control) => {
        if (control.hasAttribute('disabled') || (control.getAttribute('aria-disabled') || '').toLowerCase() === 'true') return false
        const tag = control.tagName.toLowerCase()
        if (tag === 'a' && deadHref(control)) return false
        if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes((control.type || '').toLowerCase())) return true
        if (tag === 'select') return true
        return controlName(control).length >= 2
      })
    const weakRecordTables = [...document.querySelectorAll('table')]
      .filter(visible)
      .filter((table) => {
        const role = (table.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (table.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const rows = [...table.querySelectorAll('tr')]
          .filter(visible)
          .filter((row) => row.querySelector('td'))
          .filter((row) => actionableRecordSignal(textOf(row)))
        return rows.length >= 2 && !hasRecordAction(table)
      })
    const weakRecordLists = [...document.querySelectorAll('ul,ol,[role="list"]')]
      .filter(visible)
      .filter((list) => {
        const role = (list.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (list.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const items = [...list.querySelectorAll('li,[role="listitem"]')]
          .filter(visible)
          .filter((item) => actionableRecordSignal(textOf(item)))
        return items.length >= 2 && !hasRecordAction(list)
      })
    if (weakRecordTables.length + weakRecordLists.length > 0) {
      push('runtime-weak-record-actions', 'warning', (weakRecordTables.length + weakRecordLists.length) + ' record module(s) show actionable business items without row, bulk, or detail actions.', 'Add row actions, checkboxes with bulk actions, detail links, approve/retry/assign buttons, or contextual menus so record-heavy screens are usable.')
    }
    const normalizedRecordActionLabel = (label) => String(label || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[.!?。！？:]+$/g, '')
      .trim()
    const recordActionLabels = (scope) => [...scope.querySelectorAll('button,a,input,select,[role="button"],[role="link"],[role="menuitem"]')]
      .filter(visible)
      .flatMap((control) => {
        if (control.hasAttribute('disabled') || (control.getAttribute('aria-disabled') || '').toLowerCase() === 'true') return []
        const tag = control.tagName.toLowerCase()
        if (tag === 'a' && deadHref(control)) return []
        if (control instanceof HTMLInputElement) {
          const type = (control.type || '').toLowerCase()
          if (!['button', 'submit'].includes(type)) return []
        }
        if (tag === 'select') return [control.getAttribute('aria-label') || control.getAttribute('title') || control.getAttribute('name') || '']
        return [controlName(control)]
      })
      .map(normalizedRecordActionLabel)
      .filter(Boolean)
    const genericRecordActionLabel = (label) => {
      const normalized = normalizedRecordActionLabel(label)
      return normalized.length > 0 && normalized.length <= 36 && /^(?:action|actions|details?|edit|go|manage|more|open|select|view|view details?|view item|view record)$/i.test(normalized)
    }
    const specificRecordActionLabel = (label) => {
      const normalized = normalizedRecordActionLabel(label)
      return normalized.length > 0 && normalized.length <= 64 && /\b(?:account|approve|assign|audit|billing|case|customer|dispatch|escalate|handoff|invoice|lead|order|owner|pay|payment|proposal|renewal|request|resolve|retry|review|risk|route|schedule|sla|supplier|sync|ticket|triage|vendor|workspace)\b/i.test(normalized)
    }
    const genericRecordActionScope = (items) => {
      if (items.length < 2) return false
      const labels = items.flatMap(recordActionLabels)
      if (labels.length < 2) return false
      const genericCount = labels.filter(genericRecordActionLabel).length
      const specificCount = labels.filter(specificRecordActionLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    }
    const genericRecordActionTables = [...document.querySelectorAll('table')]
      .filter(visible)
      .filter((table) => {
        const role = (table.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (table.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const rows = [...table.querySelectorAll('tr')]
          .filter(visible)
          .filter((row) => row.querySelector('td'))
          .filter((row) => actionableRecordSignal(textOf(row)))
        return genericRecordActionScope(rows)
      })
    const genericRecordActionLists = [...document.querySelectorAll('ul,ol,[role="list"]')]
      .filter(visible)
      .filter((list) => {
        const role = (list.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (list.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const items = [...list.querySelectorAll('li,[role="listitem"]')]
          .filter(visible)
          .filter((item) => actionableRecordSignal(textOf(item)))
        return genericRecordActionScope(items)
      })
    if (genericRecordActionTables.length + genericRecordActionLists.length > 0) {
      push('runtime-generic-record-action-labels', 'warning', (genericRecordActionTables.length + genericRecordActionLists.length) + ' record module(s) use generic row action labels.', 'Replace View, Details, More, or Open-only record actions with task-specific labels such as Review renewal, Assign owner, Retry sync, Approve invoice, or Resolve ticket.')
    }
    const normalizedRecordItemLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/#.-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const recordItemTitleLabels = (item) => {
      const labels = [
        item.getAttribute('aria-label') || '',
        item.getAttribute('title') || '',
        ...[...item.querySelectorAll('h2,h3,h4,h5,h6,[role="heading"]')].filter(visible).map(textOf)
      ]
      return [...new Set(labels.map(normalizedRecordItemLabel).filter(Boolean))]
    }
    const genericRecordItemLabel = (label) => {
      const normalized = normalizedRecordItemLabel(label)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:(?:account|card|case|customer|entry|item|message|notification|order|project|record|request|task|ticket)\s*(?:#?\d+|[a-z]|one|two|three|four|five)?|(?:item|record|task)\s*[a-z])$/i.test(normalized)
    }
    const specificRecordItemLabel = (label) => {
      const normalized = normalizedRecordItemLabel(label)
      return normalized.length > 0 && normalized.length <= 96 && (/\b(?:account|approval|arr|billing|case|claim|client|contract|customer|handoff|incident|invoice|lead|mrr|order|owner|patient|payment|proposal|record|renewal|request|risk|route|salesforce|shipment|sla|supplier|sync|ticket|vendor|workspace)\b/i.test(normalized) || recordDataPatterns.filter((pattern) => pattern.test(normalized)).length > 0)
    }
    const recordItemCandidate = (item) => {
      const tag = item.tagName.toLowerCase()
      const role = (item.getAttribute('role') || '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (item.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
      return tag === 'li' || role === 'listitem' || tag === 'article' || /\b(?:account|card|customer|entry|event|invoice|item|message|notification|order|record|row|task|ticket|timeline item)\b/i.test(classText(item))
    }
    const genericRecordItemScope = (scope) => {
      const items = [...scope.querySelectorAll('li,[role="listitem"],article,section,div')]
        .filter(visible)
        .filter(recordItemCandidate)
        .filter((item) => actionableRecordSignal(textOf(item)))
      if (items.length < 3) return false
      const labels = [...new Set(items.flatMap(recordItemTitleLabels))]
      if (labels.length < 3) return false
      const genericCount = labels.filter(genericRecordItemLabel).length
      const specificCount = labels.filter(specificRecordItemLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    }
    const genericRecordItemGroups = [...document.querySelectorAll('ul,ol,[role="list"],section,article,aside,div')]
      .filter(visible)
      .filter((scope) => {
        if (!productAppSignal() || productAppModuleSignalCount() < 2) return false
        const role = (scope.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (scope.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        return genericRecordItemScope(scope)
      })
    if (genericRecordItemGroups.length > 0) {
      push('runtime-generic-record-item-labels', 'warning', genericRecordItemGroups.length + ' record list or card group(s) use generic item titles.', 'Replace Item 1, Task 2, Record A, or Customer B-only item titles with concrete customers, invoices, tickets, renewals, owners, dates, amounts, or workflow context.')
    }
    const normalizedRecordTableColumnLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericRecordTableColumnLabel = (text) => {
      const normalized = normalizedRecordTableColumnLabel(text)
      return normalized.length > 0 && normalized.length <= 32 && /^(?:action|actions|amount|date|details?|id|name|owner|priority|progress|status|time|title|type|value)$/i.test(normalized)
    }
    const specificRecordTableColumnLabel = (text) => {
      const normalized = normalizedRecordTableColumnLabel(text)
      return normalized.length > 0 && normalized.length <= 48 && /\b(?:account|approval|arr|balance|billing|case|claim|client|contract|customer|due|handoff|incident|invoice|lead|mrr|order|patient|payout|policy|proposal|record|renewal|request|risk|route|shipment|shift|sla|supplier|ticket|vendor|workspace)\b/i.test(normalized)
    }
    const genericRecordTableColumns = [...document.querySelectorAll('table')]
      .filter(visible)
      .filter((table) => {
        if (!productAppSignal() || productAppModuleSignalCount() < 2) return false
        const role = (table.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (table.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const rows = [...table.querySelectorAll('tr')]
          .filter(visible)
          .filter((row) => row.querySelector('td'))
          .filter((row) => actionableRecordSignal(textOf(row)))
        if (rows.length < 2) return false
        const labels = [...new Set([...table.querySelectorAll('th')]
          .filter(visible)
          .map(textOf)
          .map(normalizedRecordTableColumnLabel)
          .filter(Boolean))]
        if (labels.length < 3) return false
        const genericCount = labels.filter(genericRecordTableColumnLabel).length
        const specificCount = labels.filter(specificRecordTableColumnLabel).length
        return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
      })
    if (genericRecordTableColumns.length > 0) {
      push('runtime-generic-record-table-columns', 'warning', 'A record table uses generic template column labels.', 'Replace Name, Status, Date, or Action-only columns with domain-specific fields such as account, invoice, renewal, amount, due date, risk, owner, SLA, or workflow stage.')
    }
    const recordDiscoveryLabel = (el) => [
      controlName(el),
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.getAttribute('placeholder') || '',
      String(el.getAttribute('class') || '').replace(/[-_]/g, ' '),
      el.getAttribute('data-filter') || '',
      el.getAttribute('data-sort') || '',
      el.getAttribute('data-view') || '',
      el.getAttribute('data-page') || ''
    ].join(' ')
    const hasRecordDiscoveryControl = (scope) => {
      if (scope.querySelector('[aria-sort],[data-filter],[data-sort],[data-view],[data-page],[role="tab"],[role="tablist"],[role="search"]')) return true
      const scopeText = (scope.innerText || scope.textContent || '').replace(/\s+/g, ' ').trim()
      if (/\b(?:showing\s+\d|page\s+\d|rows per page|next|previous)\b/i.test(scopeText)) return true
      return [...scope.querySelectorAll('input,select,button,a,[role="button"],[role="link"]')]
        .filter(visible)
        .some((control) => {
          if (control instanceof HTMLInputElement && (control.type || '').toLowerCase() === 'search') return true
          if (control.tagName.toLowerCase() === 'select') return true
          return /\b(?:search|filter|sort|group by|view|pagination|page|next|previous|date range|status)\b/i.test(recordDiscoveryLabel(control))
        })
    }
    const recordScopeFor = (el) => el.closest('section,article,aside,main') || el
    const weakRecordDiscoveryTables = [...document.querySelectorAll('table')]
      .filter(visible)
      .filter((table) => {
        const rows = [...table.querySelectorAll('tr')]
          .filter(visible)
          .filter((row) => row.querySelector('td'))
          .filter((row) => actionableRecordSignal(textOf(row)))
        return rows.length >= 4 && !hasRecordDiscoveryControl(recordScopeFor(table))
      })
    const weakRecordDiscoveryLists = [...document.querySelectorAll('ul,ol,[role="list"]')]
      .filter(visible)
      .filter((list) => {
        const items = [...list.querySelectorAll('li,[role="listitem"]')]
          .filter(visible)
          .filter((item) => actionableRecordSignal(textOf(item)))
        return items.length >= 4 && !hasRecordDiscoveryControl(recordScopeFor(list))
      })
    if (weakRecordDiscoveryTables.length + weakRecordDiscoveryLists.length > 0) {
      push('runtime-weak-record-discovery-controls', 'warning', (weakRecordDiscoveryTables.length + weakRecordDiscoveryLists.length) + ' dense record module(s) have no search, filter, sort, pagination, or view controls.', 'Add search, status/date filters, sortable columns, pagination, saved views, or segmented tabs so users can navigate larger record sets.')
    }
    const normalizedRecordDiscoveryLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericRecordDiscoveryLabel = (text) => {
      const normalized = normalizedRecordDiscoveryLabel(text)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:all|all items|all records|all statuses|date range|filter|filter status|search|search items|search records|sort|sort by|status|view|view all)$/i.test(normalized)
    }
    const specificRecordDiscoveryLabel = (text) => {
      const normalized = normalizedRecordDiscoveryLabel(text)
      return normalized.length > 0 && normalized.length <= 60 && /\b(?:account|accounts|approval|approvals|assignee|assignees|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i.test(normalized)
    }
    const recordDiscoveryControlLabels = (scope) => [...scope.querySelectorAll('label,input,select,button,a,option,[role="button"],[role="link"],[role="tab"]')]
      .filter(visible)
      .filter((el) => !el.closest('table,tbody,thead,tfoot,tr,ul,ol,[role="grid"],[role="list"],[role="row"],[role="listitem"]'))
      .flatMap((el) => [
        controlName(el),
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        el.getAttribute('placeholder') || '',
        el.getAttribute('data-filter') || '',
        el.getAttribute('data-sort') || '',
        el.getAttribute('data-view') || '',
        el.getAttribute('data-page') || ''
      ])
      .map(normalizedRecordDiscoveryLabel)
      .filter(Boolean)
    const genericRecordDiscoveryScope = (scope) => {
      if (!hasRecordDiscoveryControl(scope)) return false
      const labels = [...new Set(recordDiscoveryControlLabels(scope))]
      const candidates = labels.filter((label) =>
        /\b(?:search|filter|sort|group by|view|segmented|tab|pagination|page\s+\d|rows per page|showing\s+\d|next|previous|date range|status filter)\b/i.test(label) ||
        genericRecordDiscoveryLabel(label) ||
        specificRecordDiscoveryLabel(label)
      )
      if (candidates.length < 2) return false
      const genericCount = candidates.filter(genericRecordDiscoveryLabel).length
      const specificCount = candidates.filter(specificRecordDiscoveryLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(candidates.length * 0.67)
    }
    const denseRecordScopes = [...new Set([
      ...[...document.querySelectorAll('table')]
        .filter(visible)
        .filter((table) => [...table.querySelectorAll('tr')]
          .filter(visible)
          .filter((row) => row.querySelector('td'))
          .filter((row) => actionableRecordSignal(textOf(row))).length >= 4)
        .map(recordScopeFor),
      ...[...document.querySelectorAll('ul,ol,[role="list"]')]
        .filter(visible)
        .filter((list) => [...list.querySelectorAll('li,[role="listitem"]')]
          .filter(visible)
          .filter((item) => actionableRecordSignal(textOf(item))).length >= 4)
        .map(recordScopeFor)
    ])]
    if (denseRecordScopes.filter(genericRecordDiscoveryScope).length > 0) {
      push('runtime-generic-record-discovery-controls', 'warning', 'A dense record table or list uses generic search, filter, or view controls.', 'Replace Search, Filter, or All statuses-only controls with object-specific search labels, domain filters, saved views, sort labels, or pagination copy.')
    }
    const statusValueLabel = (value) => {
      const normalized = String(value || '').replace(/\s+/g, ' ').replace(/[.!?。！？:]+$/g, '').trim()
      return normalized.length <= 32 && /^(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready|success|warning|error|critical|paused|complete|completed|rejected|canceled|cancelled|open|closed|resolved|in progress|on track|needs review|not started)$/i.test(normalized)
    }
    const statusAffordanceClass = (el) => /\b(?:status|badge|chip|pill|tag|state|tone|success|warning|danger|error|risk|critical|positive|negative|neutral|info|approved|pending|overdue|blocked|failed|active|inactive)\b/i.test(classText(el))
    const hasStatusAffordance = (el) => {
      if (statusAffordanceClass(el)) return true
      if (el.hasAttribute('data-state') || el.hasAttribute('data-status') || el.hasAttribute('data-tone') || el.hasAttribute('data-variant') || el.hasAttribute('data-color')) return true
      const style = getComputedStyle(el)
      const bg = parseRgb(style.backgroundColor)
      const borderWidth =
        Number.parseFloat(style.borderTopWidth || '0') +
        Number.parseFloat(style.borderRightWidth || '0') +
        Number.parseFloat(style.borderBottomWidth || '0') +
        Number.parseFloat(style.borderLeftWidth || '0')
      const weight = style.fontWeight === 'bold' ? 700 : Number.parseFloat(style.fontWeight || '400')
      return Boolean(bg && bg.a > 0.05) || borderWidth > 0 || (Number.isFinite(weight) && weight >= 600)
    }
    const weakStatusAffordances = [...document.querySelectorAll('td,li,span,div,[role="status"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (!statusValueLabel(textOf(el))) return false
        if ([...el.children].some((child) => visible(child) && statusValueLabel(textOf(child)))) return false
        if (hasStatusAffordance(el)) return false
        return ![...el.children].some((child) => statusValueLabel(textOf(child)) && hasStatusAffordance(child))
      })
    if (weakStatusAffordances.length >= 2) {
      push('runtime-weak-status-affordance', 'warning', weakStatusAffordances.length + ' repeated status value(s) render as plain text.', 'Render statuses as labeled badges, chips, or state tags with semantic color, accessible labels, and enough contrast instead of leaving critical states as raw table/list text.')
    }
    const chartContainerClass = (el) => /\b(?:analytics|bars?|chart|graph|plot|sparkline|trend|visuali[sz]ation|viz)\b/i.test(classText(el))
    const chartMarkClass = (el) => /\b(?:area|bar|dot|line|marker|point|segment|series|slice|spark)\b/i.test(classText(el))
    const chartDataPatterns = [
      /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b/i,
      /\b\d[\d,.]*\s?(?:%|k|m|b|ms|sec|secs|min|mins|hr|hrs|day|days|users?|orders?|tickets?|invoices?|gb|mb)\b/i,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\bq[1-4]\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i,
      /\b(?:approved|pending|overdue|blocked|paid|unpaid|active|at risk|delayed|failed|synced|live|draft|ready)\b/i
    ]
    const chartDataContext = (el) => {
      if (el.querySelector('figcaption,title,desc,text')) return true
      if (el.querySelector('[data-value],[aria-valuenow],[aria-valuetext]')) return true
      const labels = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('aria-labelledby') || '',
        el.getAttribute('title') || '',
        ...[...el.querySelectorAll('[aria-label],[title]')].map((item) => (item.getAttribute('aria-label') || item.getAttribute('title') || ''))
      ].join(' ')
      const scopedText = ((el.innerText || el.textContent || '') + ' ' + labels)
        .replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return chartDataPatterns.filter((pattern) => pattern.test(scopedText)).length >= 2
    }
    const weakCharts = [...document.querySelectorAll('section,article,aside,figure,div,svg,[role="img"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const marks = [...el.querySelectorAll('div,span,i,b,rect,circle,path')].filter((item) => chartMarkClass(item) && visible(item))
        const chartLike = chartContainerClass(el) || marks.length >= 3
        return chartLike && marks.length >= 3 && !chartDataContext(el)
      })
    if (weakCharts.length > 0) {
      push('runtime-weak-chart-structure', 'warning', weakCharts.length + ' chart-like visualization(s) have marks but no clear data labels, caption, legend, or accessible chart context.', 'Add a chart title or caption, axis or legend labels, visible values, and accessible SVG title/desc or aria labels tied to concrete data.')
    }
    const normalizedChartLabel = (text) => String(text || '')
      .replace(/&amp;/gi, '&')
      .replace(/[^\p{L}\p{N}&/%$€£¥#.-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const genericChartLabel = (text) => {
      const normalized = normalizedChartLabel(text)
      return normalized.length > 0 && normalized.length <= 40 && /^(?:analytics|chart|comparison|data|dataset\s*\d+|growth|insights?|metric|metrics|performance|progress|report|series\s*\d+|trend|value|values?)$/i.test(normalized)
    }
    const specificChartLabel = (text) => {
      const normalized = normalizedChartLabel(text)
      return normalized.length > 0 && normalized.length <= 96 && (
        /\b(?:account|accounts|approval|approvals|arr|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|mrr|order|orders|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces|q[1-4]|week|month|quarter|year)\b/i.test(normalized) ||
        chartDataPatterns.some((pattern) => pattern.test(normalized))
      )
    }
    const chartLabelTexts = (el) => {
      const labels = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        ...[...el.querySelectorAll('[aria-label],[title]')].map((item) => item.getAttribute('aria-label') || item.getAttribute('title') || ''),
        ...[...el.querySelectorAll('h2,h3,h4,figcaption,title,desc,legend,text')].map(textOf)
      ]
      return [...new Set(labels.map(normalizedChartLabel).filter(Boolean))]
    }
    const chartLikeBlocks = [...document.querySelectorAll('section,article,aside,figure,div,svg,[role="img"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        const marks = [...el.querySelectorAll('div,span,i,b,rect,circle,path')].filter((item) => chartMarkClass(item) && visible(item))
        return (chartContainerClass(el) || marks.length >= 3) && marks.length >= 3 && chartDataContext(el)
      })
    const genericCharts = chartLikeBlocks.filter((el) => {
      const labels = chartLabelTexts(el)
      if (labels.length === 0) return false
      const genericCount = labels.filter(genericChartLabel).length
      const specificCount = labels.filter(specificChartLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    if (genericCharts.length > 0) {
      push('runtime-generic-chart-labels', 'warning', genericCharts.length + ' chart-like visualization(s) use generic chart labels.', 'Replace Chart, Data, Growth, or Series 1-only labels with the business metric, object, period, comparison, or segment shown.')
    }
    const pseudoListContainerClass = (el) => /\b(?:activity|accounts?|cards?|customers?|feed|invoices?|list|messages?|notifications?|orders?|queue|records?|rows?|tasks?|timeline)\b/i.test(classText(el))
    const pseudoListItemClass = (el) => /\b(?:account|card|customer|entry|event|invoice|item|message|notification|order|record|row|task|timeline item)\b/i.test(classText(el))
    const hasSemanticRecordStructure = (el) => Boolean(el.querySelector('ul,ol,table,li,tr,[role="feed"],[role="grid"],[role="list"],[role="listbox"],[role="listitem"],[role="row"],[role="table"]'))
    const pseudoListContainers = [...document.querySelectorAll('section,article,aside,div')]
      .filter(visible)
      .filter((el) => {
        if (hasSemanticRecordStructure(el)) return false
        const repeatedItems = [...el.children].filter(visible).filter((child) => {
          const tag = child.tagName.toLowerCase()
          return ['div', 'article', 'section'].includes(tag) && pseudoListItemClass(child)
        })
        return repeatedItems.length >= 3 && (pseudoListContainerClass(el) || repeatedItems.length >= 3)
      })
    if (pseudoListContainers.length > 0) {
      push('runtime-weak-list-structure', 'warning', pseudoListContainers.length + ' repeated record/list module(s) use generic containers without list, table, or row semantics.', 'Use ul/li, ol/li, table rows, role=list/listitem, or role=row semantics for queues, timelines, feeds, and repeated record groups.')
    }
    const tinyTargets = interactive.filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width < 40 || r.height < 40
    })
    if (tinyTargets.length > 0) {
      push('runtime-small-tap-targets', 'warning', tinyTargets.length + ' interactive target(s) render below 40px in width or height.', 'Increase padding/min-height for touch targets and keep icon-only controls at least 40x40px.')
    }
    const textCandidates = [...document.querySelectorAll('h1,h2,h3,h4,p,a,button,label,li,td,th,input,textarea,select,[role="button"],[role="link"],[aria-label]')]
      .filter(visible)
      .map((el) => ({ el, text: textOf(el), rect: rectFor(el), style: getComputedStyle(el) }))
      .filter((item) => item.text.length > 0 && item.rect.width > 4 && item.rect.height > 4)
      .slice(0, 120)
    const styleText = [...document.querySelectorAll('style')].map((style) => style.textContent || '').join('\n')
    const visibleVisualMedia = [
      ...visibleImages,
      ...[...document.querySelectorAll('picture,video,iframe,canvas')].filter(visible)
    ]
    const hasGlobalBoxSizing = /(?:^|[}\s])(?:\*|html|body|:root|:where\([^)]*\))[^{]{0,160}{[^}]*\bbox-sizing\s*:\s*(?:border-box|inherit)\b/i.test(styleText)
    const hasFluidMediaRule = /\b(?:img|picture|video|canvas|svg|iframe)\b[^{]{0,160}{[^}]*(?:max-width\s*:\s*100%|width\s*:\s*100%)/i.test(styleText)
    if (visibleVisualMedia.length > 0 && (!hasGlobalBoxSizing || !hasFluidMediaRule)) {
      push('runtime-missing-layout-reset', 'warning', 'The rendered page uses visual media without a resilient layout reset.', 'Add global box-sizing, fluid media rules, and min-width:0 constraints so images, embeds, and grid/flex children do not overflow responsive previews.')
    }
    const hasInteractionStateAffordance = /:(hover|active)\b/i.test(styleText) ||
      /\[(aria-pressed|aria-expanded|aria-selected|aria-disabled|data-state|disabled)\]/i.test(styleText) ||
      document.querySelector('[aria-pressed],[aria-expanded],[aria-selected],[aria-disabled],[data-state],[disabled]')
    if (interactive.length > 0 && !hasInteractionStateAffordance) {
      push('runtime-missing-interaction-states', 'warning', 'Interactive controls have no visible hover, active, disabled, pressed, expanded, or selected state affordance.', 'Add hover/active styles and at least one relevant state such as disabled, aria-pressed, aria-expanded, selected, or data-state feedback for controls.')
    }
    const colorLiteralValues = [...new Set((styleText.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || []).map((color) => color.toLowerCase()))]
    const colorLiteralCount = colorLiteralValues.length
    if (colorLiteralCount >= 8 && !/--[a-z0-9-]+\s*:/i.test(styleText)) {
      push('runtime-weak-color-system', 'warning', 'The rendered page uses many hard-coded colors without palette tokens.', 'Define reusable CSS custom properties for neutral, surface, text, border, and accent roles, then use those tokens consistently across modules.')
    }
    const normalizeHue = (value) => ((value % 360) + 360) % 360
    const hueDistance = (a, b) => {
      const distance = Math.abs(normalizeHue(a) - normalizeHue(b))
      return Math.min(distance, 360 - distance)
    }
    const rgbToHsl = (r, g, b) => {
      const red = r / 255
      const green = g / 255
      const blue = b / 255
      const max = Math.max(red, green, blue)
      const min = Math.min(red, green, blue)
      const l = (max + min) / 2
      if (max === min) return { h: 0, s: 0, l }
      const delta = max - min
      const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
      let h = 0
      if (max === red) h = (green - blue) / delta + (green < blue ? 6 : 0)
      else if (max === green) h = (blue - red) / delta + 2
      else h = (red - green) / delta + 4
      return { h: normalizeHue(h * 60), s, l }
    }
    const parseCssColor = (raw) => {
      const color = String(raw || '').trim().toLowerCase()
      if (color.startsWith('#')) {
        const hex = color.slice(1)
        if (![3, 4, 6, 8].includes(hex.length)) return null
        const expanded = hex.length <= 4 ? hex.slice(0, 3).replace(/./g, (char) => char + char) : hex.slice(0, 6)
        const value = Number.parseInt(expanded, 16)
        if (!Number.isFinite(value)) return null
        return rgbToHsl((value >> 16) & 255, (value >> 8) & 255, value & 255)
      }
      if (/^rgba?\(/i.test(color)) {
        const match = /^rgba?\(([^)]+)\)$/i.exec(color)
        const channels = (match?.[1] || '').replace(/\/.*$/, ' ').split(/[,\s]+/).filter(Boolean).slice(0, 3).map((part) => {
          const parsed = Number.parseFloat(part)
          if (!Number.isFinite(parsed)) return null
          return Math.max(0, Math.min(255, part.trim().endsWith('%') ? (parsed / 100) * 255 : parsed))
        })
        if (channels.length < 3 || channels.some((channel) => channel === null)) return null
        return rgbToHsl(channels[0], channels[1], channels[2])
      }
      if (/^hsla?\(/i.test(color)) {
        const match = /^hsla?\(([^)]+)\)$/i.exec(color)
        const parts = (match?.[1] || '').replace(/\/.*$/, ' ').split(/[,\s]+/).filter(Boolean)
        const hueMatch = /^([-+]?\d*\.?\d+)(deg|turn|rad|grad)?$/i.exec(parts[0] || '')
        const s = parts[1]?.endsWith('%') ? Number.parseFloat(parts[1]) / 100 : Number.NaN
        const l = parts[2]?.endsWith('%') ? Number.parseFloat(parts[2]) / 100 : Number.NaN
        if (!hueMatch || !Number.isFinite(s) || !Number.isFinite(l)) return null
        const hueValue = Number.parseFloat(hueMatch[1])
        const unit = (hueMatch[2] || 'deg').toLowerCase()
        const h = unit === 'turn' ? hueValue * 360 : unit === 'rad' ? (hueValue * 180) / Math.PI : unit === 'grad' ? hueValue * 0.9 : hueValue
        return { h: normalizeHue(h), s: Math.max(0, Math.min(1, s)), l: Math.max(0, Math.min(1, l)) }
      }
      return null
    }
    const chromaticColors = colorLiteralValues
      .map(parseCssColor)
      .filter(Boolean)
      .filter((color) => color.s >= 0.18 && color.l >= 0.08 && color.l <= 0.95)
    const largestHueCluster = chromaticColors.reduce((largest, color) => {
      const count = chromaticColors.filter((item) => hueDistance(item.h, color.h) <= 22).length
      return Math.max(largest, count)
    }, 0)
    if (chromaticColors.length >= 5 && largestHueCluster >= 5 && largestHueCluster / chromaticColors.length >= 0.78) {
      push('runtime-one-note-palette', 'warning', 'The rendered palette is dominated by variations of a single hue family.', 'Keep the brand color intentional, but add neutral surfaces plus at least one distinct supporting accent or semantic color so the page has richer hierarchy.')
    }
    const spacingValues = []
    const spacingRe = /\b(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*([^;{}]+)/gi
    let spacingMatch
    while ((spacingMatch = spacingRe.exec(styleText))) {
      const declaration = spacingMatch[1] || ''
      if (/\b(var|calc|clamp|min|max|auto)\s*\(/i.test(declaration) || /\bauto\b/i.test(declaration)) continue
      const tokens = declaration.match(/\b\d*\.?\d+(?:px|rem)\b/gi) || []
      for (const token of tokens) {
        const normalized = token.toLowerCase()
        if (normalized !== '0px' && normalized !== '0rem') spacingValues.push(normalized)
      }
    }
    const defaultSpacingCount = spacingValues.filter((value) => value === '16px' || value === '1rem').length
    const hasSpacingTokens = /--(?:space|spacing|gap|pad|margin)[a-z0-9-]*\s*:/i.test(styleText)
    if (!hasSpacingTokens && spacingValues.length >= 8 && defaultSpacingCount >= 6 && defaultSpacingCount / spacingValues.length >= 0.65 && new Set(spacingValues).size <= 3) {
      push('runtime-weak-spacing-system', 'warning', 'The rendered page repeats the same default spacing value across most layout rules.', 'Create a small spacing scale with reusable tokens and vary section, group, and control spacing so the layout has real rhythm instead of 16px everywhere.')
    }
    const unboundedViewportFont = /(?:^|[;{]\s*)font-size\s*:\s*(?!\s*clamp\()[^;{}]*\b\d*\.?\d+\s*(?:vw|vh|vmin|vmax)\b/i.test(styleText)
    const negativeLetterSpacing = textCandidates.some((item) => Number.parseFloat(item.style.letterSpacing || '0') < 0)
    if (unboundedViewportFont || negativeLetterSpacing) {
      push('runtime-weak-typography-constraints', 'warning', 'The rendered page uses unstable typography constraints.', 'Replace unbounded viewport-based font sizes with bounded type scales and keep letter spacing at 0 or positive values so headings remain readable across viewports.')
    }
    const semanticHeadingText = textCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      const ariaLevel = Number.parseInt(item.el.getAttribute('aria-level') || '0', 10)
      return /^h[1-2]$/.test(tag) || (role === 'heading' && (!Number.isFinite(ariaLevel) || ariaLevel <= 2))
    })
    const bodyTypographyText = textCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      return ['p', 'li', 'td', 'th', 'label', 'a', 'button'].includes(tag)
    })
    if (semanticHeadingText.length > 0 && bodyTypographyText.length >= 3) {
      const headingFontSize = Math.max(...semanticHeadingText.map((item) => Number.parseFloat(item.style.fontSize || '16')).filter(Number.isFinite))
      const headingFontWeight = Math.max(...semanticHeadingText.map((item) => Number.parseFloat(item.style.fontWeight || '700')).filter(Number.isFinite))
      const bodyFontSizes = bodyTypographyText.map((item) => Number.parseFloat(item.style.fontSize || '16')).filter(Number.isFinite).sort((a, b) => a - b)
      const bodyFontWeights = bodyTypographyText.map((item) => Number.parseFloat(item.style.fontWeight || '400')).filter(Number.isFinite).sort((a, b) => a - b)
      const bodyFontSize = bodyFontSizes[Math.floor(bodyFontSizes.length / 2)] || 16
      const bodyFontWeight = bodyFontWeights[Math.floor(bodyFontWeights.length / 2)] || 400
      const typeRatio = headingFontSize / Math.max(bodyFontSize, 1)
      const weakSize = headingFontSize < 22 && typeRatio < 1.35
      const weakWeight = headingFontWeight <= bodyFontWeight + 150
      if ((typeRatio < 1.18 && weakWeight) || (weakSize && headingFontWeight < 750)) {
        push('runtime-weak-type-hierarchy', 'warning', 'The rendered page title and body text have too little typographic hierarchy.', 'Create a bounded type scale with a visibly larger or heavier H1/H2, readable body text, and clear metadata/caption sizing.')
      }
    }
    const wideTextMeasureBlocks = textCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      if (!['p', 'li', 'dd', 'blockquote'].includes(tag) && role !== 'note') return false
      if (item.text.length < 90) return false
      const fontSize = Number.parseFloat(item.style.fontSize || '16') || 16
      const measure = item.rect.width / Math.max(fontSize, 1)
      return item.rect.width >= Math.min(innerWidth * 0.62, 680) && measure > 78
    })
    if (wideTextMeasureBlocks.length > 0) {
      push('runtime-wide-text-measure', 'warning', wideTextMeasureBlocks.length + ' long text block(s) span too wide for comfortable reading.', 'Constrain prose and supporting copy with max-width or grid columns around 60-72ch, while keeping data tables and controls in appropriately wider layouts.')
    }
    const centeredTextCount = textCandidates.filter((item) => item.style.textAlign === 'center').length
    const centeredBigContainers = [document.body, document.querySelector('main'), document.querySelector('.hero'), document.querySelector('.page'), document.querySelector('.app')]
      .filter(Boolean)
      .filter((el) => {
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return rect.width >= innerWidth * 0.72 && style.display === 'flex' && style.justifyContent === 'center' && style.alignItems === 'center'
      })
    if (textCandidates.length >= 5 && centeredTextCount / textCandidates.length >= 0.7 && centeredBigContainers.length > 0) {
      push('runtime-center-everything-layout', 'warning', 'Most visible content is centered in a single template-like layout.', 'Introduce a real information architecture with aligned sections, split content, grids, tables, or lists instead of centering every block.')
    }
    if (textCandidates.reduce((sum, item) => sum + item.text.length, 0) < 80) {
      push('runtime-thin-content', 'info', 'The rendered page has very little visible text/content.', 'Add realistic product copy, labels, state descriptions, and concrete data so the screen feels finished.')
    }
    const concreteDataPatterns = [
      /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b/i,
      /\b\d[\d,.]*\s?(?:%|k|m|b|ms|sec|secs|min|mins|hr|hrs|hour|hours|day|days|week|weeks|users?|members?|tasks?|orders?|tickets?|invoices?|files?|gb|mb)\b/i,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\bq[1-4]\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i,
      /\b[A-Z]{2,}[-_#]?\d{2,}\b|\b(?:invoice|order|ticket|case|id|ref|build)\s*#?\s*[A-Z0-9-]{3,}\b/i,
      /\b(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready)\b/i,
      /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/,
      /\b[A-Z][A-Za-z0-9&.-]+\s+(?:Inc|LLC|Ltd|Labs|Finance|Bank|Studio|Clinic|Health|Systems|Group|Co)\b/
    ]
    const dataRealismText = pageText
      .replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const concreteDataSignals = concreteDataPatterns.filter((pattern) => pattern.test(dataRealismText)).length
    if (dataRealismText.length >= 120 && concreteDataSignals < 2) {
      push('runtime-weak-data-realism', 'warning', 'The rendered page has little concrete domain data.', 'Add realistic names, metrics, dates, prices, IDs, statuses, or records so the screen feels like a real product rather than a wireframe.')
    }
    const stateLaundryListMatches = pageText.match(/\b(?:loading|empty|error|disabled|offline|permission|success|hover|focus|skeleton)\s+states?\b/gi) || []
    if (stateLaundryListMatches.length >= 3) {
      push('runtime-state-laundry-list', 'warning', 'The rendered page lists state names instead of designing those states.', 'Replace state-name lists with actual compact modules, banners, disabled controls, skeleton rows, empty illustrations, retry/error panels, or toast feedback.')
    }
    const contentModules = [...document.querySelectorAll('section,article,aside,form,table,ul,ol,[data-ds-section],[role="region"],[role="list"]')]
      .filter(visible)
      .filter((el) => {
        const moduleText = (el.innerText || el.textContent || '')
          .replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        return moduleText.length >= 40 || Boolean(el.querySelector('table,form,li,tr,article,aside,[role="row"],[role="listitem"]'))
      })
    const unnamedContentSections = [...document.querySelectorAll('section,article,aside,form,[role="region"]')]
      .filter(visible)
      .filter((el) => {
        const role = (el.getAttribute('role') || '').toLowerCase()
        if (role === 'presentation' || role === 'none' || (el.getAttribute('aria-hidden') || '').toLowerCase() === 'true') return false
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return false
        if (el.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"],legend')) return false
        const moduleText = (el.innerText || el.textContent || '')
          .replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const hasMeaningfulStructure = Boolean(el.querySelector('table,ul,ol,li,button,input,select,textarea,article,aside,[role="row"],[role="listitem"]'))
        return moduleText.length >= 80 || hasMeaningfulStructure
      })
    if (unnamedContentSections.length > 0) {
      push('runtime-unnamed-content-section', 'warning', unnamedContentSections.length + ' meaningful content module(s) have no visible heading or accessible section name.', 'Add concise section headings, legends, aria-label, or aria-labelledby for major panels, lists, forms, asides, and status modules.')
    }
    const headingCandidates = textCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      const ariaLevel = Number.parseInt(item.el.getAttribute('aria-level') || '0', 10)
      const fontSize = Number.parseFloat(item.style.fontSize || '16')
      const weight = Number.parseFloat(item.style.fontWeight || '400')
      const topLimit = Math.min(innerHeight * 0.7, 520)
      if (item.rect.top > topLimit || item.rect.bottom < 0) return false
      if (item.text.length < 4) return false
      if (/^h[1-2]$/.test(tag)) return true
      if (role === 'heading' && (!Number.isFinite(ariaLevel) || ariaLevel <= 2)) return true
      return fontSize >= 22 && weight >= 600 && item.rect.width >= 120
    })
    if (textCandidates.length > 0 && headingCandidates.length === 0) {
      push('runtime-weak-page-heading', 'warning', 'No clear page title or goal is visible near the top of the preview.', 'Add a prominent H1/H2 or equivalent heading that states the screen purpose before the user reaches detailed content.')
    }
    const genericHeadingText = (text) => {
      const normalized = String(text || '')
        .replace(/&amp;/gi, '&')
        .replace(/[\s:|/\\-]+/g, ' ')
        .replace(/[^\p{L}\p{N}& ]/gu, '')
        .trim()
      return /^(welcome|dashboard|overview|home|settings|profile|analytics|reports?|projects?|tasks?|messages?|help( center)?|admin|workspace|landing page|main page|get started|welcome back)$/i.test(normalized)
    }
    const metaHeadingText = (text) => {
      const normalized = String(text || '')
        .replace(/&amp;/gi, '&')
        .replace(/[\s:|/\\-]+/g, ' ')
        .replace(/[^\p{L}\p{N}& ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return /\b(?:(?:landing|marketing|brand|portfolio|pricing|plans?|product|home(?:page)?|case[- ]stud(?:y|ies)|features?)\s+(?:page|site|website)|(?:page|site|website))\s+(?:for|about|to)\b/i.test(normalized)
    }
    const genericSectionHeadingText = (text) => {
      const normalized = String(text || '')
        .replace(/&amp;/gi, '&')
        .replace(/[\s:|/\\-]+/g, ' ')
        .replace(/[^\p{L}\p{N}& ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return /^(?:about(?: us)?|benefits?|capabilit(?:y|ies)|case stud(?:y|ies)|customers?|faq|features?|frequently asked questions|how it works|our (?:services|work)|pricing|plans?|reviews?|services?|solutions?|testimonials?|what we do|why choose us)$/i.test(normalized)
    }
    const genericPageHeadings = headingCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      const ariaLevel = Number.parseInt(item.el.getAttribute('aria-level') || '0', 10)
      const topLevel = tag === 'h1' || (role === 'heading' && ariaLevel === 1)
      return topLevel && genericHeadingText(item.text)
    })
    if (genericPageHeadings.length > 0) {
      push('runtime-generic-page-heading', 'warning', 'The visible page heading is generic and does not state the screen goal.', 'Rewrite the H1/page title around a specific user outcome, workflow, product area, or concrete object.')
    }
    const metaPageHeadings = headingCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      const ariaLevel = Number.parseInt(item.el.getAttribute('aria-level') || '0', 10)
      const topLevel = tag === 'h1' || (role === 'heading' && ariaLevel === 1)
      return topLevel && metaHeadingText(item.text)
    })
    if (metaPageHeadings.length > 0) {
      push('runtime-meta-page-heading', 'warning', 'The visible page heading reads like a prompt or page type instead of a real product title.', 'Rewrite the H1 as the brand/product/person name or a literal offer/category, and move page-type context into supporting copy if needed.')
    }
    const genericSectionHeadings = textCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      const ariaLevel = Number.parseInt(item.el.getAttribute('aria-level') || '0', 10)
      const sectionLevel = tag === 'h2' || tag === 'h3' || (role === 'heading' && (ariaLevel === 2 || ariaLevel === 3))
      if (!sectionLevel || item.el.closest('header,nav,footer')) return false
      return genericSectionHeadingText(item.text)
    })
    if (brandLandingSignal() && hasTopHeading && interactive.length > 0 && genericSectionHeadings.length >= 2) {
      push('runtime-generic-section-heading', 'warning', 'Several marketing section headings are generic template labels.', 'Replace bare headings like Features, Benefits, or Testimonials with product-specific headings that name the workflow, audience, proof, or outcome.')
    }
    const firstViewportLimit = Math.min(innerHeight * 0.88, 720)
    const supportCopyCandidates = textCandidates.filter((item) => {
      const tag = item.el.tagName.toLowerCase()
      const role = (item.el.getAttribute('role') || '').toLowerCase()
      const inputType = item.el instanceof HTMLInputElement ? (item.el.type || '').toLowerCase() : ''
      if (item.rect.top > firstViewportLimit || item.rect.bottom < 0) return false
      if (/^h[1-6]$/.test(tag) || controlLikeElement(tag, role, inputType)) return false
      const text = item.text.replace(/\b(loading|empty|error|disabled|success|hover|focus) state\b/gi, ' ').trim()
      return text.length >= 36
    })
    const hasFirstViewportHeading = headingCandidates.some((item) => item.rect.top <= firstViewportLimit && item.rect.bottom > 0)
    const hasFirstViewportAction = primaryActionCandidates.some((el) => {
      const rect = el.getBoundingClientRect()
      return rect.top <= firstViewportLimit && rect.bottom > 0
    })
    if (hasFirstViewportHeading && hasFirstViewportAction && supportCopyCandidates.length === 0) {
      push('runtime-weak-first-screen-hierarchy', 'warning', 'The first viewport has a heading and action but no supporting content.', 'Add concise supporting copy, concrete data, or a small content module near the page title so the screen communicates value before secondary details.')
    }
    if (hasFirstViewportHeading && hasFirstViewportAction && dataRealismText.length >= 140 && contentModules.length < 2) {
      push('runtime-weak-content-depth', 'warning', 'The rendered page has too few meaningful content modules.', 'Add at least two product-relevant modules such as a data table, record list, form, state panel, proof section, timeline, or settings group beyond the headline and CTA.')
    }
    const classLooksCardLike = (el) => String(el.className || '')
      .split(/\s+/)
      .some((token) => /^(card|panel|surface|tile)$/.test(token) || /-(card|panel|surface|tile)$/.test(token))
    const visuallyCardLike = (el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (rect.width * rect.height < 1600) return false
      const radius = maxElementRadius(el)
      const borderWidth = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0')
      const hasShadow = style.boxShadow && style.boxShadow !== 'none'
      const hasBox = hasShadow || borderWidth > 0 || classLooksCardLike(el)
      return radius >= 6 && hasBox
    }
    const maxElementRadius = (el) => {
      const style = getComputedStyle(el)
      return Math.max(
        Number.parseFloat(style.borderTopLeftRadius || '0'),
        Number.parseFloat(style.borderTopRightRadius || '0'),
        Number.parseFloat(style.borderBottomLeftRadius || '0'),
        Number.parseFloat(style.borderBottomRightRadius || '0')
      )
    }
    const cardShells = [...document.querySelectorAll('section,article,aside,div,li')]
      .filter(visible)
      .filter(visuallyCardLike)
      .slice(0, 80)
    const overRoundedCards = cardShells.filter((el) => classLooksCardLike(el) && maxElementRadius(el) >= 18)
    if (overRoundedCards.length > 0) {
      push('runtime-over-rounded-card-styling', 'warning', overRoundedCards.length + ' card or panel container(s) use oversized rounded corners.', 'Use a restrained radius scale for product surfaces, usually around 6-8px for cards and panels, reserving larger radii for intentional pills or media.')
    }
    const nestedCards = cardShells.filter((outer) =>
      cardShells.some((inner) => outer !== inner && outer.contains(inner))
    )
    if (nestedCards.length > 0) {
      push('runtime-nested-card-layout', 'warning', 'The rendered page uses card-like containers nested inside other cards.', 'Flatten the layout into clear sections, grids, rows, or tables; keep cards as sibling repeated items instead of putting cards inside cards.')
    }
    const clippedText = textCandidates.filter((item) => {
      const el = item.el
      const style = item.style
      if (style.overflow === 'visible' && style.textOverflow !== 'ellipsis') return false
      if (el.scrollWidth > el.clientWidth + 3) return true
      if (el.scrollHeight > el.clientHeight + 3) return true
      return false
    })
    if (clippedText.length > 0) {
      push('runtime-clipped-text', 'critical', clippedText.length + ' visible text element(s) are clipped or truncated in the rendered preview.', 'Increase container size, allow wrapping, reduce text length, or adjust responsive layout so all important copy remains readable.')
    }
    let lowContrastCount = 0
    for (const item of textCandidates) {
      const fg = parseRgb(item.style.color)
      if (!fg) continue
      const ratio = contrast(fg, backgroundFor(item.el))
      const fontSize = Number.parseFloat(item.style.fontSize || '16')
      const weight = Number.parseFloat(item.style.fontWeight || '400')
      const minRatio = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700) ? 3 : 4.5
      if (ratio < minRatio) lowContrastCount += 1
    }
    if (lowContrastCount > 0) {
      push('runtime-low-contrast-text', 'warning', lowContrastCount + ' visible text element(s) appear below contrast guidance.', 'Darken text, lighten backgrounds, or change tinted fills so important copy meets WCAG AA contrast.')
    }
    let overlaps = 0
    const overlapArea = (a, b) => {
      const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return w * h
    }
    for (let i = 0; i < textCandidates.length && overlaps < 3; i += 1) {
      for (let j = i + 1; j < textCandidates.length && overlaps < 3; j += 1) {
        const a = textCandidates[i]
        const b = textCandidates[j]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        const area = overlapArea(a.rect, b.rect)
        if (area < 24) continue
        const aArea = a.rect.width * a.rect.height
        const bArea = b.rect.width * b.rect.height
        if (area / Math.min(aArea, bArea) > 0.24) overlaps += 1
      }
    }
    if (overlaps > 0) {
      push('runtime-overlapping-text', 'critical', 'Some visible text elements overlap each other in the rendered preview.', 'Rework layout constraints, line wrapping, spacing, and responsive rules so text never collides.')
    }
    return findings
  })()`
}

/**
 * Static quality gate for generated HTML design artifacts. This deliberately
 * checks stable, non-visual signals that correlate with "AI first draft" output:
 * incomplete documents, placeholder content, missing responsive rules, missing
 * states, and missing accessibility/motion affordances.
 */
export function auditDesignHtmlQuality(input: DesignHtmlQualityAuditInput): DesignHtmlQualityFinding[] {
  const html = input.html ?? ''
  const normalized = stripHtmlComments(html)
  const styles = styleContent(html)
  const lower = normalized.toLowerCase()
  const visibleText = textContent(normalized)
  const findings: DesignHtmlQualityFinding[] = []

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
      suggestion: 'Replace dead anchors with real prototype hrefs, valid section anchors, or semantic buttons with local feedback.'
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
      suggestion: 'Add a real action/formaction, onsubmit handler, or scripted prototype feedback such as validation, loading, success, error, or toast states.'
    })
  }

  if (!hasSiblingPrototypeNavigation(normalized, input.siblingScreens)) {
    pushFinding(findings, {
      code: 'missing-prototype-navigation',
      severity: 'warning',
      message: 'This multi-screen project page does not link to any sibling screen.',
      suggestion: 'Add real anchors for relevant nav items, tabs, cards, or CTAs using the provided prototype hrefs.'
    })
  }

  if ((input.siblingScreens?.length ?? 0) >= 2 && linkedSiblingPrototypeTargetCount(normalized, input.siblingScreens) < 2) {
    pushFinding(findings, {
      code: 'weak-prototype-navigation-coverage',
      severity: 'warning',
      message: 'This multi-screen project page links to only one sibling screen.',
      suggestion: 'Add prototype links to multiple relevant sibling pages in the nav, tabs, breadcrumbs, cards, or primary/secondary actions so the project can be browsed as a connected prototype.'
    })
  }

  if ((input.siblingScreens?.length ?? 0) > 0 && !hasNavigationLandmark(normalized)) {
    pushFinding(findings, {
      code: 'missing-navigation-landmark',
      severity: 'warning',
      message: 'This multi-screen project page has no navigation landmark.',
      suggestion: 'Add a consistent nav, tabs, breadcrumb, or page switcher with real prototype links to related screens.'
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

  return findings
}

export function formatDesignHtmlQualityFindings(
  findings: DesignHtmlQualityFinding[] | undefined,
  limit = 8
): string[] {
  if (!findings || findings.length === 0) return []
  const ordered = findings
    .slice()
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, limit)
  return [
    'Previous version quality audit (repair these while making the requested change):',
    ...ordered.map((finding) => `- [${finding.severity}] ${finding.code}: ${finding.message} ${finding.suggestion}`)
  ]
}

function designQualityRepairDirective(code: string): string | undefined {
  switch (normalizeQualityCode(code)) {
    case 'fixed-desktop-frame':
    case 'horizontal-overflow':
    case 'clipped-text':
    case 'overlapping-text':
      return 'Resize-adaptive layout: remove fixed desktop shells, let text wrap, use fluid max-widths/minmax grids, make html/body/root fill the frame, and verify mobile/tablet/desktop plus arbitrary resized canvas frames without clipped or overlapping text.'
    case 'missing-layout-reset':
      return 'Layout resilience: add *, *::before, *::after { box-sizing: border-box; }, fluid img/video/iframe rules, and min-width:0 on grid/flex children so media cannot break responsive previews.'
    case 'center-everything-layout':
      return 'Information architecture: replace center-everything composition with aligned sections, split content, grids, tables, or lists that create a clear scanning path.'
    case 'nested-card-layout':
      return 'Layout structure: flatten card-in-card shells into sections, grids, rows, tables, or sibling repeated cards; avoid putting framed cards inside other framed cards.'
    case 'over-rounded-card-styling':
      return 'Surface radius: keep product cards and panels on a restrained radius scale, usually around 6-8px, reserving large pill radii for intentional controls or media masks.'
    case 'missing-document-title':
    case 'generic-document-title':
      return 'Document title: add a meaningful <title> that names the product, brand, screen, or offer; avoid Untitled, Draft, and prompt/page-type titles.'
    case 'weak-first-screen-hierarchy':
    case 'generic-action-copy':
    case 'missing-page-heading':
    case 'generic-page-heading':
    case 'weak-page-heading':
    case 'missing-primary-action':
    case 'weak-primary-action':
      return 'First screen: make the page goal obvious with a specific H1, concrete support copy, and one visually dominant primary action near the top.'
    case 'meta-page-heading':
      return 'Hero/title copy: replace prompt-style headings like "Marketing site for..." or "Pricing page for..." with the brand/product/person name or a literal offer/category, then put explanatory value props in supporting copy.'
    case 'generic-section-heading':
      return 'Section headings: replace bare section labels like Features, Benefits, Testimonials, and How it works with product-specific headings that name the workflow, audience, proof point, or outcome.'
    case 'weak-secondary-action-path':
      return 'Secondary action path: pair the primary first-screen CTA with a clearly different secondary action such as View demo, See features, Read case study, Compare plans, or Contact sales.'
    case 'weak-hero-viewport-composition':
      return 'Hero viewport composition: avoid full-height marketing heroes that hide the next section; reduce min-height, tune vertical spacing, or expose a next-section peek in the first viewport.'
    case 'weak-content-depth':
      return 'Content depth: add at least two product-relevant modules beyond the hero, such as a table, record list, form, status panel, proof section, timeline, or settings group.'
    case 'weak-app-shell':
      return 'Product shell: for app UI and dashboard surfaces, add visible product chrome such as a top bar, sidebar, nav rail, breadcrumbs, search, user/status area, and workspace switcher around the work surface.'
    case 'generic-product-navigation':
      return 'Product navigation: replace Dashboard, Analytics, Reports, or Settings-only nav with domain-specific product areas, objects, queues, workflows, or saved views tied to the screen.'
    case 'generic-breadcrumb-labels':
      return 'Breadcrumb specificity: replace Home, Dashboard, Details, and Page 1-only trails with product areas, object names, record IDs, workflow stages, or the current task context.'
    case 'weak-brand-navigation':
      return 'Brand navigation: add a branded header/nav with a logo or wordmark, links to the key page sections, and a visible primary action so the page feels like a complete site.'
    case 'weak-brand-identity':
      return 'Brand identity: make the product, brand, person, or place name visible in the header or first viewport with a real wordmark, logo, or product name instead of generic navigation labels alone.'
    case 'weak-portfolio-structure':
      return 'Portfolio structure: add real project or case-study cards with client, role/category, timeline or year, visual, outcome metric, and detail CTAs such as View project or Read case study.'
    case 'generic-portfolio-project-detail':
      return 'Portfolio project detail: replace placeholder entries like Project One, Client A, and Case Study 1 with realistic project names, client names, roles, timelines, visuals, outcome metrics, and detail CTAs.'
    case 'weak-visual-anchor':
      return 'Visual anchor: for landing, brand, portfolio, pricing, and marketing pages, add a real product preview, screenshot, image, gallery, media-led hero, or designed mockup that shows the offer instead of relying on text-only cards.'
    case 'weak-product-preview-detail':
      return 'Product preview detail: fill product previews, screenshots, mockups, or media panels with real media or concrete UI/data details such as dashboard rows, metrics, statuses, screenshots, and labeled controls.'
    case 'decorative-visual-anchor':
      return 'Visual anchor specificity: replace abstract blobs, orbs, gradients, and decorative-only SVG shapes with a product screenshot, media asset, gallery image, or concrete UI mockup that includes real labels, rows, metrics, and statuses.'
    case 'weak-trust-proof':
      return 'Trust proof: add concrete customer logos, testimonials, ratings, case-study metrics, press mentions, or security/compliance badges with realistic names and numbers so the page feels credible.'
    case 'generic-trust-proof':
      return 'Trust proof detail: replace placeholder proof labels like Logo 1, Company A, and Client B with realistic customer names, publication names, certification badges, ratings, or outcome metrics.'
    case 'generic-vanity-metrics':
      return 'Proof metrics: replace generic vanity stats like 99% satisfaction, 10x faster, 1M+ users, and 24/7 support with sourced customer metrics, timeframes, benchmarks, or case-study outcomes.'
    case 'weak-testimonial-attribution':
      return 'Testimonial attribution: give each testimonial or customer quote a named person/company, role or source, and concrete outcome context such as a metric, timeframe, or use case.'
    case 'generic-testimonial-copy':
      return 'Testimonial copy: replace vague praise like Amazing product, Highly recommend, and Game-changer with a concrete workflow, metric, timeframe, or case-study outcome from the named customer.'
    case 'weak-feature-anatomy':
      return 'Feature anatomy: add concrete feature, benefit, capability, or use-case sections with named product capabilities, user outcomes, and product-specific details instead of relying on hero copy alone.'
    case 'generic-feature-card-detail':
      return 'Feature card detail: replace broad cards like Automation, Analytics, Security, and Collaboration with named product capabilities tied to concrete objects, workflows, user outcomes, metrics, or domain-specific labels.'
    case 'duplicated-card-copy':
      return 'Card/module specificity: rewrite repeated feature, pricing, proof, project, and testimonial cards so each one has a distinct title, concrete detail, data point, outcome, or target audience.'
    case 'weak-pricing-structure':
      return 'Pricing structure: build distinct plan cards or a comparison table with prices, billing cadence, recommended/best-for labeling, feature differences, and plan-specific CTAs.'
    case 'generic-pricing-plan-detail':
      return 'Pricing plan detail: replace filler like All core features, Everything you need, and Priority support with concrete plan limits, feature differences, intended audiences, service levels, and upgrade reasons.'
    case 'generic-pricing-plan-action-labels':
      return 'Pricing plan CTAs: replace repeated Choose plan, Get started, or Start trial buttons with plan-specific actions such as Start studio trial, Upgrade to agency launch, or Talk to enterprise sales.'
    case 'weak-conversion-close':
      return 'Conversion close: add a final CTA/footer, FAQ, contact/demo/signup form, calendar/contact route, or next-step section near the end so landing pages have a complete conversion path.'
    case 'generic-conversion-close':
      return 'Conversion close detail: replace generic closes like Ready to get started, Start today, and Take the next step with a specific outcome, timeframe, next deliverable, or domain-specific CTA.'
    case 'weak-faq-anatomy':
      return 'FAQ anatomy: when an FAQ section is present, include multiple concrete question/answer items covering real objections such as pricing, migration, support, security, setup, or timeline.'
    case 'generic-faq-questions':
      return 'FAQ question specificity: replace generic questions like What is this, How does it work, and Who is this for with real objections about pricing, migration, setup time, security, support, integrations, or plan limits.'
    case 'generic-faq-answers':
      return 'FAQ answer detail: replace generic answers like Contact us, Learn more, or Our team can help with concrete objection-handling details about pricing, migration, support, security, setup, timelines, integrations, or plan limits.'
    case 'weak-site-footer':
      return 'Site footer: finish brand and marketing pages with a real footer containing brand/contact details, secondary links, social/legal links, copyright/support information, newsletter links, or status/help routes.'
    case 'generic-site-footer-detail':
      return 'Site footer detail: replace generic Product, Company, and Resources footer columns with brand/contact details, legal/status/social/help links, copyright, and product-specific routes.'
    case 'weak-metric-context':
      return 'Metric context: give KPI cards timeframe labels, previous-period deltas, target/goal comparisons, trend direction, or benchmark notes so numbers are interpretable.'
    case 'generic-metric-card-labels':
      return 'Metric specificity: replace generic Revenue, Users, Growth, and Tasks scorecards with KPI labels that name the business object, workflow, period, owner, SLA, risk, or target.'
    case 'weak-chart-structure':
      return 'Data visualization: add chart titles or captions, axis/legend labels, visible values, and accessible SVG title/desc or aria labels tied to concrete data.'
    case 'generic-chart-labels':
      return 'Chart specificity: replace Chart, Data, Growth, Performance, and Series 1-only labels with the business metric, object, period, comparison, segment, or decision the visualization supports.'
    case 'weak-table-structure':
      return 'Data tables: add clear column headers, scope attributes, captions or aria labels, and realistic row values so table modules are readable and implementation-ready.'
    case 'generic-record-table-columns':
      return 'Record table columns: replace Name, Status, Date, or Action-only table headers with domain-specific fields such as account, invoice, renewal, amount, due date, risk, owner, SLA, and workflow stage.'
    case 'weak-list-structure':
      return 'Structured records: convert repeated record cards, queues, feeds, and timelines from generic div stacks into ul/li, ol/li, table rows, role=list/listitem, or role=row patterns with clear item labels.'
    case 'weak-record-actions':
      return 'Record actions: add visible row actions, detail links, selection with bulk actions, approve/retry/assign buttons, or contextual menus so actionable records are not just static data.'
    case 'generic-record-item-labels':
      return 'Record item titles: replace Item 1, Task 2, Record A, and Customer B-only list or card titles with concrete customer, invoice, ticket, renewal, owner, date, amount, or workflow context.'
    case 'generic-record-action-labels':
      return 'Record action specificity: replace View, Details, More, or Open-only repeated row/card actions with task-specific actions such as Review renewal, Assign owner, Retry sync, Approve invoice, or Resolve ticket.'
    case 'weak-record-discovery-controls':
      return 'Record discovery: add search, status/date filters, sortable columns, pagination, saved views, or segmented tabs so dense tables and lists can be scanned and narrowed quickly.'
    case 'generic-record-discovery-controls':
      return 'Record discovery specificity: replace generic Search, Filter, or All statuses controls with object-specific search labels, domain filters, saved views, sort labels, or pagination copy.'
    case 'weak-status-affordance':
      return 'Status affordance: render statuses as labeled badges, chips, or state tags with semantic color, sufficient contrast, and accessible labels instead of plain table or list text for critical states.'
    case 'unnamed-content-section':
      return 'Module naming: give every meaningful section, panel, list, form, aside, and status module a concise visible heading, legend, aria-label, or aria-labelledby so the page is scannable and accessible.'
    case 'weak-data-realism':
    case 'placeholder-content':
    case 'vague-template-copy':
      return 'Real content: replace abstract copy with realistic names, metrics, dates, prices, IDs, statuses, records, and domain-specific labels.'
    case 'weak-color-system':
      return 'Color system: define reusable palette tokens for surface, text, border, muted, and accent roles; replace scattered hard-coded colors with those tokens.'
    case 'one-note-palette':
      return 'Palette range: keep one clear brand color, then add neutral surface/text/border roles plus a distinct secondary accent or semantic color so the design is not all one hue family.'
    case 'weak-spacing-system':
      return 'Spacing system: define a small spacing scale and vary section, group, and control spacing; avoid using the same 16px gap/padding everywhere.'
    case 'state-laundry-list':
    case 'missing-ui-states':
      return 'State coverage: replace state-name lists with visible UI states such as skeleton rows, empty panels, retry banners, disabled controls, offline/permission notices, or toast feedback.'
    case 'weak-state-recovery-action':
      return 'State recovery: give empty, error, offline, and permission states a clear next action such as Retry, Clear filters, Import records, Connect source, Request access, or Contact support.'
    case 'generic-recoverable-state-copy':
      return 'State recovery copy: replace generic No data, Nothing here, and Something went wrong panels with the missing object, likely cause, domain-specific next step, and recovery action.'
    case 'generic-feedback-message-copy':
      return 'Feedback message specificity: replace Success, Saved, Error, or Failed-only toasts, alerts, banners, and inline confirmations with the object, action result, and next step or recovery path.'
    case 'dead-link-targets':
    case 'dead-links':
    case 'missing-prototype-navigation':
    case 'missing-navigation-landmark':
    case 'missing-navigation-current-state':
    case 'missing-interaction-behavior':
      return 'Prototype behavior: convert dead anchors and visual-only controls into real links, section anchors, form feedback, filters, expanded panels, toasts, or sibling-screen navigation with a visible/accessible current-page state.'
    case 'weak-prototype-navigation-coverage':
      return 'Prototype navigation coverage: when several sibling screens exist, link to multiple relevant pages from nav items, tabs, breadcrumbs, cards, or CTAs using the provided prototype hrefs, and keep a visible current-page state.'
    case 'weak-tab-current-state':
      return 'Tab state: give tabs, segmented controls, and view switchers a visible and accessible selected state with aria-selected, aria-current, data-state="active", or active/current styling.'
    case 'generic-tab-labels':
      return 'Tab labels: replace generic Overview, Details, Settings, and Tab 1 labels with domain-specific views, queues, objects, or workflow stages tied to the screen.'
    case 'weak-workflow-step-state':
      return 'Workflow progress: mark multi-step flows with current, completed, and upcoming states using aria-current, data-state/status, progressbar values, and visible active/completed/pending styling.'
    case 'generic-workflow-step-labels':
      return 'Workflow step labels: replace Step 1, Step 2, and Phase 3 labels with domain-specific actions or milestones such as Connect source, Map fields, Review exceptions, and Submit approval.'
    case 'weak-destructive-action-safety':
      return 'Destructive action safety: style destructive actions with a clear danger tone and pair them with confirmation, undo toast/recovery, or explicit irreversible-warning feedback.'
    case 'weak-dialog-affordance':
      return 'Dialog affordance: use native <dialog> or role="dialog" with aria-modal/labeling, a visible title, and Close/Cancel/Dismiss controls for modals, drawers, sheets, and popovers.'
    case 'generic-dialog-title':
      return 'Dialog title specificity: replace Details, Confirmation, Warning, or Settings-only titles with titles that name the specific object, action, consequence, or workflow.'
    case 'missing-form-labels':
    case 'unlabeled-fields':
    case 'inert-form-submission':
    case 'weak-form-affordance':
      return 'Forms: give every field a visible/accessibility label, required/optional or helper guidance, aria-describedby/error text where useful, and submit paths that show validation, loading, success, error, or toast feedback.'
    case 'weak-lead-form-response':
      return 'Lead form response: for contact, demo, signup, waitlist, and newsletter forms, add visible submitting/loading, success/confirmation, and error/validation states so the conversion path feels complete.'
    case 'generic-form-field-labels':
      return 'Form field specificity: replace Name, Email, Message, and Details-only forms with fields tied to the intent, such as work email, company domain, team size, launch timeline, budget, request type, dispatch volume, or use case.'
    case 'generic-settings-control-labels':
      return 'Settings control specificity: replace Option 1, Enable, Notifications, and Setting-only toggles, checkboxes, or radio choices with labels that name the controlled object, audience, effect, or workflow.'
    case 'missing-image-source':
    case 'missing-image-alt':
    case 'generic-image-alt':
    case 'broken-images':
      return 'Media: use valid workspace-relative images or intentional designed placeholders, and write specific alt text naming the product, person, place, screen, or content shown unless the image is decorative.'
    case 'missing-focus-states':
    case 'missing-interaction-states':
    case 'small-tap-targets':
    case 'unnamed-icon-controls':
    case 'low-contrast-text':
      return 'Accessibility polish: keep focus states visible, add hover/active/disabled/pressed states, keep tap targets at least 40px, icon controls named, and important text at accessible contrast.'
    case 'weak-type-hierarchy':
      return 'Type hierarchy: build a bounded type scale where H1/H2 are visibly larger or heavier than body text, with smaller metadata/caption text and stable wrapping across breakpoints.'
    case 'wide-text-measure':
      return 'Text measure: constrain prose, lead copy, and explanatory text to readable columns around 60-72ch while letting tables, grids, and controls use wider layouts where appropriate.'
    case 'weak-typography-constraints':
      return 'Typography: replace unbounded viewport-sized text with a bounded type scale, keep letter spacing at 0 or positive values, and verify headings wrap cleanly on mobile and desktop.'
    default:
      return undefined
  }
}

export function buildDesignHtmlQualityRepairPrompt(
  findings: DesignHtmlQualityFinding[],
  mode: 'auto' | 'manual'
): string {
  const repairFindings = mergeDesignHtmlQualityFindings(findings)
  const issueLimit = mode === 'auto' ? 3 : 6
  const directiveLimit = 8
  const directives = repairFindings.reduce<string[]>((items, finding) => {
    const directive = designQualityRepairDirective(finding.code)
    if (directive && !items.includes(directive)) items.push(directive)
    return items
  }, [])
  const issueSummary = repairFindings
    .slice(0, issueLimit)
    .map((finding) => `- [${finding.severity}] ${finding.code}: ${finding.message}\n  建议：${finding.suggestion}`)

  return [
    mode === 'auto'
      ? '自动修复这个页面预览中的设计质量问题。'
      : '修复这个页面预览中的设计质量问题。',
    '只修改当前选中的 screen/page；保留页面意图、品牌风格和已有可用内容，不要整页重写。',
    '',
    '优先修复以下审计项：',
    ...issueSummary,
    ...(directives.length > 0
      ? ['', '修复 playbook:', ...directives.slice(0, directiveLimit).map((directive) => `- ${directive}`)]
      : []),
    '',
    'Resize 自适应硬性要求:',
    ...DESIGN_RESIZE_RESPONSIVE_LINES.slice(1).map((line) => `- ${line.replace(/^- /, '')}`),
    '',
    '完成要求：HTML 必须跟随画布 frame/webview resize 自动适应，无文本重叠、无横向溢出、无裁切；补真实内容、可见状态和可用交互；同步更新 DESIGN.md 的相关说明。'
  ].join('\n')
}

function severityRank(severity: DesignHtmlQualitySeverity): number {
  switch (severity) {
    case 'critical':
      return 0
    case 'warning':
      return 1
    case 'info':
      return 2
  }
}
