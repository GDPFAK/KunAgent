import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'

export const PLACEHOLDER_RE =
  /\b(lorem ipsum|placeholder|todo|tbd|sample data|example (card|title|user|company|product)|card title|feature [0-9]+|item [0-9]+|user name|your company|product name)\b/i

export const GENERIC_IMAGE_ALT_RE =
  /^(?:app )?(?:image|photo|picture|graphic|illustration|screenshot|screen shot|preview|mockup|hero image|hero visual|product image|product screenshot|product preview|dashboard screenshot|customer photo|team photo|placeholder image)$/i

export const GENERIC_DOCUMENT_TITLE_RE =
  /^(?:untitled|draft|new page|page|website|site|homepage|home page|landing page|marketing site|brand site|portfolio|pricing page|plans page|product page|demo|test|preview)$/i

export const AI_GRADIENT_COLOR_RE =
  /#(?:4f46e5|6366f1|7c3aed|8b5cf6|9333ea|a855f7|2563eb|3b82f6)\b|\b(?:purple|violet|indigo|blue)\b/gi

export const CREAM_BACKGROUND_RE =
  /(body|html|\.app|\.page|\.container|main)\s*{[^}]*background(?:-color)?\s*:\s*(#(fff7ed|fffbeb|fdf6e3|faf7f0|f8f4ed|f5efe6|f4eadc)|rgb\(\s*(24[0-9]|25[0-5])\s*,\s*(23[0-9]|24[0-9]|25[0-5])\s*,\s*(21[0-9]|22[0-9]|23[0-9])\s*\)|\b(cream|beige|sand|linen|papayawhip|oldlace|antiquewhite)\b)/i

export const COLOR_LITERAL_RE =
  /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi

export const CSS_CUSTOM_PROPERTY_RE =
  /--[a-z0-9-]+\s*:/i

export const GLOBAL_BOX_SIZING_RE =
  /(?:^|[}\s>])(?:\*|html|body|:root|:where\([^)]*\))[^{]{0,160}{[^}]*\bbox-sizing\s*:\s*(?:border-box|inherit)\b/i

export const FLUID_MEDIA_RULE_RE =
  /\b(?:img|picture|video|canvas|svg|iframe)\b[^{]{0,160}{[^}]*(?:max-width\s*:\s*100%|width\s*:\s*100%)/i

export const VISUAL_MEDIA_TAG_RE =
  /<(?:img|picture|video|iframe|canvas)\b/i

export const PROTOTYPE_NAV_HASH_PREFIX = 'kun-proto-nav='

export const SPACING_DECLARATION_RE =
  /\b(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*([^;{}]+)/gi

export const SPACING_TOKEN_RE =
  /--(?:space|spacing|gap|pad|margin)[a-z0-9-]*\s*:/i

export const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu

export const VAGUE_TEMPLATE_COPY_PATTERNS = [
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

export const GENERIC_PAGE_HEADING_RE =
  /^(welcome|dashboard|overview|home|settings|profile|analytics|reports?|projects?|tasks?|messages?|help( center)?|admin|workspace|landing page|main page|get started|welcome back)$/i

export const GENERIC_SECTION_HEADING_RE =
  /^(?:about(?: us)?|benefits?|capabilit(?:y|ies)|case stud(?:y|ies)|customers?|faq|features?|frequently asked questions|how it works|our (?:services|work)|pricing|plans?|reviews?|services?|solutions?|testimonials?|what we do|why choose us)$/i

export const META_PAGE_HEADING_RE =
  /\b(?:(?:landing|marketing|brand|portfolio|pricing|plans?|product|home(?:page)?|case[- ]stud(?:y|ies)|features?)\s+(?:page|site|website)|(?:page|site|website))\s+(?:for|about|to)\b/i

export const GENERIC_ACTION_LABEL_RE =
  /^(start|get started|start now|learn more|submit|continue|next|explore|open|view|click here|try now|sign up|join|begin|go)$/i

export const PRODUCT_APP_SCREEN_RE =
  /\b(?:admin|analytics|approval queue|approvals?|billing|calendar|console|crm|dashboard|invoices?|kanban|messages?|orders?|portal|projects?|queue|records?|reports?|settings|tickets?|tasks?|workspace|workbench)\b/i

export const PRODUCT_APP_CHROME_CLASS_RE =
  /\b(?:app[- ]shell|shell|sidebar|side[- ]nav|sidenav|nav[- ]rail|rail|topbar|top[- ]bar|navbar|nav[- ]bar|global[- ]nav|workspace[- ]nav|breadcrumbs?|command[- ]bar|utility[- ]bar)\b/i

export const GENERIC_PRODUCT_NAV_LABEL_RE =
  /^(?:activity|admin|analytics|calendar|dashboard|help|home|insights?|messages?|notifications?|overview|profile|projects?|reports?|settings|tasks?|team|users?|workspace)$/i

export const PRODUCT_NAV_DOMAIN_LABEL_RE =
  /\b(?:account|approval|asset|booking|campaign|case|claim|client|contract|crew|customer|deployment|dispatch|handoff|incident|inventory|invoice|job|lead|member|order|patient|payment|payout|policy|proposal|record|release|renewal|request|risk|route|shipment|shift|supplier|ticket|vendor|warehouse)\b/i

export const BREADCRUMB_CONTAINER_RE =
  /\b(?:breadcrumb|breadcrumbs|crumbs?|page trail|page path|path nav|path navigation)\b/i

export const GENERIC_BREADCRUMB_LABEL_RE =
  /^(?:activity|admin|analytics|dashboard|details?|home|items?|overview|page\s*\d+|profile|projects?|records?|reports?|settings|summary|tasks?|workspace)$/i

export const SPECIFIC_BREADCRUMB_LABEL_RE =
  /\b(?:account|approval|asset|billing|case|claim|client|contract|crew|customer|deployment|dispatch|handoff|incident|inventory|invoice|job|lead|member|order|patient|payment|payout|policy|proposal|record|release|renewal|request|risk|route|shipment|shift|sla|supplier|ticket|vendor|warehouse|workspace)\b/i

export const BRAND_LANDING_SCREEN_RE =
  /\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing|plans|features|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i

export const STRONG_BRAND_LANDING_SCREEN_RE =
  /\b(?:landing page|marketing site|brand site|homepage|home page|portfolio|case stud(?:y|ies)|pricing page|plans page|testimonials?|waitlist|book a demo|start free trial|product page|website)\b/i

export const BRAND_NAV_CLASS_RE =
  /\b(?:brand|logo|wordmark|site[- ]nav|marketing[- ]nav|navbar|nav[- ]bar|masthead)\b/i

export const BRAND_IDENTITY_CLASS_RE =
  /\b(?:brand|brand[- ]mark|brand[- ]identity|logo|logotype|wordmark|site[- ]title|product[- ]name|masthead)\b/i

export const GENERIC_BRAND_IDENTITY_LABEL_RE =
  /^(?:home|features?|pricing|plans?|customers?|clients?|testimonials?|case stud(?:y|ies)|work|portfolio|about|contact|blog|docs|login|sign in|sign up|book a demo|start free trial|learn more|view demo|see work|compare plans|contact sales|demo|faq|support|proof)$/i

export const BRAND_NAME_LIKE_RE =
  /\b[A-Z][A-Za-z0-9&'.-]*(?:[A-Z][a-z0-9&'.-]+)+\b|\b[A-Z][A-Za-z0-9&'.-]+\s+(?:Studio|Labs|Works|Cloud|AI|HQ|OS|Desk|Flow|Suite|Hub|Health|Finance|Bank|Systems|Group|Co|Inc|LLC|Ltd)\b/

export const VISUAL_ANCHOR_CLASS_RE =
  /\b(?:hero[- ]visual|hero[- ]media|product[- ](?:shot|preview|mockup)|screenshot|device[- ]mockup|browser[- ]mockup|phone[- ]mockup|visual[- ]anchor|media[- ]panel|image[- ]panel|gallery|preview[- ]panel|demo[- ]preview)\b/i

export const VISUAL_ANCHOR_STYLE_RE =
  /\bbackground(?:-image)?\s*:\s*(?:url\(|image-set\()/i

export const DECORATIVE_VISUAL_ANCHOR_RE =
  /\b(?:abstract|ambient|blob|blobs|bokeh|decorative|glow|gradient|halo|mesh|orb|orbs|shape|shapes|sparkle|sphere|swoosh|wave)\b/i

export const TRUST_PROOF_TEXT_RE =
  /\b(?:trusted by|used by|loved by|chosen by|customers?|clients?|teams?|companies?|reviews?|ratings?|stars?|testimonial|case stud(?:y|ies)|customer stor(?:y|ies)|featured in|as seen in|press|security|compliance|soc\s?2|gdpr|hipaa|iso\s?27001|uptime|sla|roi|saved|increased|reduced|nps|g2|capterra|product hunt|fortune\s?500)\b/i

export const TRUST_PROOF_CLASS_RE =
  /\b(?:logo[- ]cloud|logos?|trust|proof|social[- ]proof|testimonial|review|rating|stars?|case[- ]stud(?:y|ies)|customer[- ]stor(?:y|ies)|press|security|compliance|badge|badges|certification)\b/i

export const GENERIC_TRUST_PROOF_LABEL_RE =
  /^(?:logo|logo\s*\d+|customer\s+logo|press\s+logo|company\s+[a-z0-9]+|client\s+[a-z0-9]+|customer\s+[a-z0-9]+|brand\s+[a-z0-9]+|partner\s+[a-z0-9]+|testimonial|quote|review|case\s+study|proof)$/i

export const VANITY_METRIC_CONTAINER_RE =
  /\b(?:impact|kpi|metric|metrics|numbers|outcomes?|proof|results?|roi|social[- ]proof|stat|stats|traction|trust)\b/i

export const GENERIC_VANITY_METRIC_RE =
  /\b(?:99|100(?:\.0+)?)\s?%\s*(?:customer\s+)?(?:accuracy|approval|happy|satisfaction|success|uptime)\b|\b(?:2|3|4|5|10)x\s+(?:better|conversion|faster|growth|more|output|productivity|roi)\b|\b(?:10k|100k|500k|1m)\+?\s+(?:customers?|downloads|members?|teams?|users?)\b|\b24\/7\s+(?:availability|coverage|service|support)\b|\b(?:zero|0)\s+(?:downtime|friction|hassle|setup)\b/i

export const CONCRETE_METRIC_SPECIFICITY_RE =
  /\b(?:after|baseline|benchmark|before|case study|cohort|goal|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|last|measured|pilot|previous|prior|q[1-4]|reported|surveyed|target|this (?:week|month|quarter|year)|trial|versus|vs|yoy|mom)\b/i

export const TESTIMONIAL_CLASS_RE =
  /\b(?:testimonial|review|quote|customer[- ]stor(?:y|ies)|client[- ]stor(?:y|ies)|social[- ]proof)\b/i

export const TESTIMONIAL_ATTRIBUTION_RE =
  /\b(?:by|from|at|role|title|founder|ceo|cto|cmo|vp|director|manager|lead|head of|customer|client|team|company)\b|[-+]?\d[\d,.]*\s?%|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|\b[A-Z][A-Za-z0-9&.-]+\s+(?:Studio|Labs|Inc|LLC|Ltd|Co|Group|Systems|Health|Finance|Bank|Agency)\b/

export const GENERIC_TESTIMONIAL_COPY_RE =
  /\b(?:amazing product|awesome product|best (?:decision|experience|product|tool)|changed everything|couldn'?t be happier|game[- ]changer|highly recommend|incredible|love (?:it|this|the product)|made our lives easier|perfect for our team|saved us so much time|so easy to use|transformed our workflow|would recommend)\b/i

export const CONCRETE_TESTIMONIAL_CONTEXT_RE =
  /\b(?:after|approval|before|case[- ]stud(?:y|ies)|conversion|dashboard|days?|dispatch|handoff|hours?|implementation|inquir(?:y|ies)|invoice|launch|migration|months?|onboarding|orders?|pilot|portfolio|project|q[1-4]|records?|renewal|revenue|route|sla|sync|tickets?|timeline|trial|users?|weeks?)\b|[-+]?\d[\d,.]*\s?(?:%|x|arr|days?|hours?|months?|orders?|pages?|projects?|records?|tickets?|users?|weeks?)?\b|[$€£¥]\s*\d/i

export const MARKETING_FEATURE_SURFACE_RE =
  /\b(?:landing page|marketing site|brand site|homepage|home page|features?|product page|website|waitlist|book a demo|start free trial)\b/i

export const FEATURE_SECTION_RE =
  /\b(?:features?|benefits?|capabilit(?:y|ies)|use[- ]cases?|solutions?|workflow|how it works|what you can do|why teams choose|product details?|core tools?)\b/i

export const FEATURE_ITEM_CLASS_RE =
  /\b(?:feature[- ]card|feature[- ]item|benefit[- ]card|benefit[- ]item|capability|use[- ]case|workflow[- ]card|solution[- ]card|tool[- ]card|module[- ]card)\b/i

export const FEATURE_DETAIL_RE =
  /\b(?:automate|automation|analy[sz]e|analytics|approve|approval|collaborate|collaboration|custom|dashboard|editor|export|gallery|handoff|import|insights?|integrations?|launch|manage|permissions?|publish|routing|schedule|sync|templates?|track|workflow)\b/i

export const GENERIC_FEATURE_TITLE_RE =
  /^(?:ai\s+)?(?:automation|analytics|collaboration|security|customization|dashboard|efficiency|growth|insights?|integrations?|productivity|reporting|simplicity|speed|support|templates?|visibility|workflow)$/i

export const GENERIC_FEATURE_DETAIL_RE =
  /\b(?:advanced|built for modern teams|easy to use|everything in one place|flexible|intuitive|modern|move faster|powerful|robust|save time|scale with confidence|seamless|smart|streamline (?:your|the) workflow|work smarter)\b/i

export const CONCRETE_FEATURE_DETAIL_RE =
  /\b(?:account|approval|asset|booking|branch|campaign|case|crew|customer|dashboard|dispatch|handoff|invoice|job|launch|lead|order|payment|portfolio|project|queue|record|renewal|request|route|shift|sla|studio|supplier|ticket|vendor|workspace)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|days?|hours?|users?|projects?|orders?|tickets?|records?|pages?)\b/i

export const DESIGN_ITEM_CARD_CLASS_RE =
  /\b(?:card|tile|feature|benefit|capability|use case|pricing|price card|plan|tier|testimonial|review|quote|case study|project card|portfolio item|module card)\b/i

export const PORTFOLIO_SURFACE_RE =
  /\b(?:case stud(?:y|ies)|portfolio(?: page| site| gallery)?|selected work|work showcase|client work|project portfolio)\b/i

export const PORTFOLIO_BUILDER_RE =
  /\b(?:builder|platform|software|tool|template|cms|generator)\b/i

export const PORTFOLIO_ENTRY_CLASS_RE =
  /\b(?:case[- ]study|project[- ]card|work[- ]card|portfolio[- ]item|client[- ]story|selected[- ]work|project[- ]tile|project[- ]entry)\b/i

export const PORTFOLIO_OUTCOME_RE =
  /\b(?:client|role|year|timeline|launched|scope|industry|deliverables|result|outcome|increased|reduced|saved|grew|conversion|qualified inquiries|revenue)\b|[-+]?\d[\d,.]*\s?%/i

export const PORTFOLIO_DETAIL_ACTION_RE =
  /\b(?:view case study|read case study|view project|see project|open project|view work|read story|explore project)\b/i

export const GENERIC_PORTFOLIO_PROJECT_RE =
  /\b(?:project\s+(?:one|two|three|[0-9]+|alpha|beta|gamma)|case\s+study\s+(?:one|two|three|[0-9]+)|selected\s+work\s+(?:one|two|three|[0-9]+)|(?:client|customer|brand|company)\s+(?:[a-z]|[0-9]+))\b/i

export const PRICING_SURFACE_RE =
  /\b(?:pricing|plans?|packages?|tiers?|subscription|billing|monthly|annual|yearly|starter|pro|team|business|enterprise)\b/i

export const PRICING_PRICE_RE =
  /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/i

export const PRICING_PRICE_GLOBAL_RE =
  /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b|\b(?:free|contact sales)\b/gi

export const PRICING_PLAN_CLASS_RE =
  /\b(?:pricing[- ]card|price[- ]card|plan|tier|package|subscription[- ]card)\b/i

export const PRICING_RECOMMENDATION_RE =
  /\b(?:popular|recommended|best value|best for|most chosen|featured|most popular|team favorite)\b/i

export const PRICING_CADENCE_RE =
  /\b(?:\/\s*(?:mo|month|yr|year)|per\s+(?:month|year|seat|user)|monthly|annual|yearly|billing|billed|save\s+\d+%)\b/i

export const PRICING_FEATURE_RE =
  /\b(?:includes?|included|unlimited|up to|users?|seats?|projects?|storage|support|workspaces?|everything in|feature|features|api|sso|audit log)\b/i

export const PRICING_ACTION_RE =
  /\b(?:choose plan|select plan|start trial|start free trial|buy now|upgrade|contact sales|get started with|talk to sales)\b/i

export const GENERIC_PRICING_PLAN_ACTION_RE =
  /^(?:buy now|choose plan|choose this plan|get started|get started now|select plan|select this plan|start now|start trial|start free trial|subscribe|try now|upgrade)$/i

export const GENERIC_PRICING_PLAN_DETAIL_RE =
  /\b(?:all (?:core )?features|everything you need|basic features|advanced features|premium features|standard support|priority support|premium support|custom support|best for (?:individuals|teams|businesses|growth)|great for (?:individuals|teams|businesses|growth)|perfect for (?:individuals|teams|businesses|growth)|grow faster|scale with confidence|contact us for details)\b/i

export const CONCRETE_PRICING_PLAN_DETAIL_RE =
  /\b(?:up to\s+)?\d[\d,.]*\s?(?:users?|seats?|projects?|pages?|workspaces?|gb|mb|credits?|requests?|records?|exports?|integrations?|domains?|forms?|submissions?|hours?)\b|\bunlimited\s+(?:users?|seats?|projects?|pages?|workspaces?|exports?|integrations?)\b|\b(?:api|audit log|client workspaces?|compliance|custom domain|dedicated manager|email support|gallery analytics|gdpr|hipaa|implementation|launch support|migration|onboarding|permissions?|roles?|sandbox|sla|soc\s?2|sso|storage|white label)\b/i

export const CONVERSION_CLOSE_TEXT_RE =
  /\b(?:faq|frequently asked|questions|ready to|start now|start free trial|book a demo|schedule a demo|request demo|get started|contact us|talk to sales|join waitlist|sign up|subscribe|request access|contact sales|next step|final step|still have questions)\b/i

export const STRONG_CONVERSION_CLOSE_TEXT_RE =
  /\b(?:faq|frequently asked|questions|ready to|schedule a demo|request demo|contact us|join waitlist|sign up|subscribe|request access|next step|final step|still have questions)\b/i

export const CONVERSION_CLOSE_CLASS_RE =
  /\b(?:final[- ]cta|bottom[- ]cta|closing[- ]cta|conversion|contact|demo[- ]form|signup[- ]form|lead[- ]form|waitlist|faq|questions|footer[- ]cta|next[- ]step)\b/i

export const GENERIC_CONVERSION_CLOSE_HEADING_RE =
  /^(?:get started today|let'?s get started|ready(?: to)?(?: get started| start| begin| grow| scale| take the next step| transform your workflow| unlock your potential)?|start your journey|take the next step)$/i

export const GENERIC_CONVERSION_CLOSE_COPY_RE =
  /\b(?:discover what (?:we|our|the) (?:platform|product|solution) can do|don'?t wait|join thousands|our team can help|see what (?:we|our|the) (?:platform|product|solution) can do|start (?:today|now)|take the next step|unlock your potential|we'?re here to help)\b/i

export const CONCRETE_CONVERSION_CLOSE_CONTEXT_RE =
  /\b(?:audit|checklist|demo|dispatch|handoff|implementation|inquir(?:y|ies)|launch|migration|onboarding|portfolio|pricing|proposal|quote|review|route|schedule|setup|trial|within)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|hours?|months?|projects?|weeks?)\b/i

export const FAQ_SECTION_RE =
  /\b(?:faq|frequently asked questions|frequently asked|question answers?|q and a|q&a)\b/i

export const FAQ_QUESTION_RE =
  /\?|^(?:can|do|does|how|what|when|where|who|why|will|is|are|should|which)\b/i

export const GENERIC_FAQ_QUESTION_RE =
  /^(?:can i (?:get started|try it|use it)|do you offer support|how does (?:it|this|the (?:platform|product|service|solution)) work|is (?:it|this) (?:easy|easy to use|right for me)|what (?:do i get|is (?:it|this|the (?:platform|product|service|solution)))|who is (?:it|this) for|why choose (?:us|this))\??$/i

export const CONCRETE_FAQ_QUESTION_RE =
  /\b(?:api|audit|billing|cancel|compliance|data|demo|export|gdpr|hipaa|implementation|import|integrations?|migrat(?:e|ion)|onboarding|permissions?|pricing|refund|retention|security|setup|sla|soc\s?2|sso|support|timeline|training|trial|uptime|users?)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|weeks?|months?|hours?|users?|seats?|projects?|pages?|records?)\b/i

export const GENERIC_FAQ_ANSWER_RE =
  /^(?:yes|no|it depends|contact (?:us|sales|support)|reach out|get in touch|learn more|coming soon|we support this|we can help|our team can help|our team will help|this is available|all plans include this|available on all plans)\b/i

export const CONCRETE_FAQ_DETAIL_RE =
  /\b(?:api|audit|billing|cancel|compliance|data|demo|export|gdpr|hipaa|implementation|import|integration|migration|onboarding|permission|pricing|refund|retention|security|setup|sla|soc\s?2|sso|support|timeline|training|trial|uptime|users?)\b|[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|business days?|days?|weeks?|months?|hours?|users?|seats?|projects?|pages?|records?)\b/i

export const SITE_FOOTER_TEXT_RE =
  /\b(?:privacy|terms|copyright|all rights reserved|contact|support|email|linkedin|twitter|x\.com|instagram|github|dribbble|behance|address|newsletter|status|security|legal)\b/i

export const SITE_FOOTER_CLASS_RE =
  /\b(?:site[- ]footer|footer[- ]nav|footer[- ]links|legal|social[- ]links|contact[- ]links|footer[- ]brand|copyright)\b/i

export const GENERIC_SITE_FOOTER_LABEL_RE =
  /^(?:about(?: us)?|company|explore|follow(?: us)?|links|more|navigation|pages|product|products|quick links|resources|social|solutions)$/i

export const LEAD_FORM_SIGNAL_RE =
  /\b(?:book a demo|schedule a demo|request demo|contact|contact sales|talk to sales|signup|sign up|subscribe|newsletter|waitlist|request access|early access|join|email|company|message)\b/i

export const LEAD_FORM_SUCCESS_RE =
  /\b(?:submitted|sent|thank you|thanks|confirmation|confirmed|request received|message received|demo booked|you'?re on the list|we'?ll be in touch|check your inbox|success[- ]message|form[- ]success|toast[- ]success)\b/i

export const LEAD_FORM_ERROR_RE =
  /\b(?:error|invalid|validation|required fields?|please enter|missing|try again|failed|could not|aria-invalid|role\s*=\s*["']alert["']|error[- ]message|form[- ]error|toast[- ]error)\b/i

export const LEAD_FORM_LOADING_RE =
  /\b(?:loading|submitting|sending|please wait|aria-busy|spinner|progress)\b/i

export const HERO_VIEWPORT_LOCK_RE =
  /(?:^|}|,|\s)(?:[#.]?[a-z0-9_-]*hero[a-z0-9_-]*|section\s*(?:[:.#]|\[)[^{,]*)[^{]*{[^}]*\b(?:min-height|height)\s*:\s*(?:100|9[5-9])(?:dvh|vh)\b/i

export const FIXED_DESKTOP_FRAME_RE =
  /(?:^|[;{]\s*)(?:width|min-width)\s*:\s*(?:1[1-9]\d{2}|[2-9]\d{3})px\b/i

export const VIEWPORT_LOCK_RE =
  /(?:^|[;{]\s*)height\s*:\s*100(?:dvh|vh)\b[\s\S]{0,160}(?:^|[;{]\s*)overflow\s*:\s*hidden\b|(?:^|[;{]\s*)overflow\s*:\s*hidden\b[\s\S]{0,160}(?:^|[;{]\s*)height\s*:\s*100(?:dvh|vh)\b/i

export const UNBOUNDED_VIEWPORT_FONT_RE =
  /(?:^|[;{]\s*)font-size\s*:\s*(?!\s*clamp\()[^;{}]*\b\d*\.?\d+\s*(?:vw|vh|vmin|vmax)\b/i

export const NEGATIVE_LETTER_SPACING_RE =
  /(?:^|[;{]\s*)letter-spacing\s*:\s*-\d*\.?\d+(?:px|em|rem|ch|%)?\b/i

export const CSS_RULE_BLOCK_RE =
  /([^{}@]+){([^{}]*)}/g

export const HEADING_SELECTOR_RE =
  /(^|[,\s>+~])(?:h[1-3]|\.[a-z0-9-]*(?:heading|headline|title)[a-z0-9-]*|\[role\s*=\s*["']heading["']\])/i

export const BODY_TEXT_SELECTOR_RE =
  /(^|[,\s>+~])(?:body|p|li|td|th|label|button|a|\.[a-z0-9-]*(?:body|caption|copy|meta|muted|text)[a-z0-9-]*)/i

export const CHART_CONTAINER_CLASS_RE =
  /\b(?:analytics|bars?|chart|graph|plot|sparkline|trend|visuali[sz]ation|viz)\b/i

export const CHART_MARK_CLASS_RE =
  /\b(?:area|bar|dot|line|marker|point|segment|series|slice|spark)\b/i

export const GENERIC_CHART_LABEL_RE =
  /^(?:analytics|chart|comparison|data|dataset\s*\d+|growth|insights?|metric|metrics|performance|progress|report|series\s*\d+|trend|value|values?)$/i

export const SPECIFIC_CHART_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|arr|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|mrr|order|orders|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces|q[1-4]|week|month|quarter|year)\b/i

export const METRIC_CONTAINER_CLASS_RE =
  /\b(?:kpi|metric|stat|summary|scorecard|insight|number-card|value-card)\b/i

export const METRIC_CONTEXT_RE =
  /\b(?:vs|versus|from|since|last|previous|prior|target|goal|benchmark|trend|delta|change|increase|decrease|up|down|won|lost|this week|this month|this quarter|today|yesterday|q[1-4]|mom|yoy|week over week|month over month|year over year)\b|[-+]\s?\d[\d,.]*\s?%|[↑↓]/i

export const GENERIC_METRIC_LABEL_RE =
  /^(?:activity|conversion(?: rate)?|cycle time|engagement|growth|performance|pipeline|productivity|progress|revenue|sales|tasks?|usage|users?)$/i

export const SPECIFIC_METRIC_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|arr|assignee|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|mrr|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i

export const FORM_FIELD_AFFORDANCE_RE =
  /\b(required|optional|helper|hint|error|invalid|success|validation|aria-describedby|aria-invalid|aria-required|pattern|minlength|maxlength|role\s*=\s*["']alert["'])\b/i

export const GENERIC_FORM_FIELD_LABEL_RE =
  /^(?:company(?: name)?|details?|email(?: address)?|enter text|full name|message|name|notes?|phone(?: number)?|select option|subject|text|title|type|your email|your message|your name)$/i

export const SPECIFIC_FORM_FIELD_LABEL_RE =
  /\b(?:account|approval|billing|budget|company domain|crew|demo|dispatch|handoff|implementation|invoice|launch|migration|order|renewal|request|role|route|sla|team size|timeline|use case|volume|work email|workspace)\b/i

export const SETTINGS_CONTROL_SURFACE_RE =
  /\b(?:access|alerts?|configuration|controls?|integrations?|notifications?|permissions?|preferences?|privacy|security|settings?|workspace)\b/i

export const GENERIC_SETTINGS_CONTROL_LABEL_RE =
  /^(?:alerts?|auto|automatic|checkbox|email(?: alerts?| notifications?)?|enabled?|feature\s*\d*|notifications?|off|on|option\s*\d+|push|security|setting\s*\d*|sms|toggle\s*\d+|updates?)$/i

export const SPECIFIC_SETTINGS_CONTROL_LABEL_RE =
  /\b(?:account|approval|billing|case|customer|dispatch|escalat(?:e|ion)|handoff|incident|invoice|lead|order|owner|overdue|renewal|request|risk|route|salesforce|sla|supplier|sync|ticket|vendor|workspace)\b/i

export const PSEUDO_LIST_CONTAINER_CLASS_RE =
  /\b(?:activity|accounts?|cards?|customers?|feed|invoices?|list|messages?|notifications?|orders?|queue|records?|rows?|tasks?|timeline)\b/i

export const PSEUDO_LIST_ITEM_CLASS_RE =
  /\b(?:account|card|customer|entry|event|invoice|item|message|notification|order|record|row|task|timeline-item)\b/i

export const ACTIONABLE_RECORD_TEXT_RE =
  /\b(?:account|approval|approve|assignment|case|customer|file|invoice|lead|message|order|payment|record|renewal|request|review|supplier|task|ticket|vendor|approved|pending|overdue|blocked|at risk|delayed|failed|needs review)\b/i

export const GENERIC_RECORD_ITEM_LABEL_RE =
  /^(?:(?:account|card|case|customer|entry|item|message|notification|order|project|record|request|task|ticket)\s*(?:#?\d+|[a-z]|one|two|three|four|five)?|(?:item|record|task)\s*[a-z])$/i

export const SPECIFIC_RECORD_ITEM_LABEL_RE =
  /\b(?:account|approval|arr|billing|case|claim|client|contract|customer|handoff|incident|invoice|lead|mrr|order|owner|patient|payment|proposal|record|renewal|request|risk|route|salesforce|shipment|sla|supplier|sync|ticket|vendor|workspace)\b/i

export const GENERIC_RECORD_ACTION_LABEL_RE =
  /^(?:action|actions|details?|edit|go|manage|more|open|select|view|view details?|view item|view record)$/i

export const SPECIFIC_RECORD_ACTION_LABEL_RE =
  /\b(?:account|approve|assign|audit|billing|case|customer|dispatch|escalate|handoff|invoice|lead|order|owner|pay|payment|proposal|renewal|request|resolve|retry|review|risk|route|schedule|sla|supplier|sync|ticket|triage|vendor|workspace)\b/i

export const RECORD_DISCOVERY_CONTROL_RE =
  /\b(?:search|filter|sort|group by|view|segmented|tab|pagination|page\s+\d|rows per page|showing\s+\d|next|previous|date range|status filter)\b/i

export const RECORD_DISCOVERY_MARKUP_RE =
  /\b(?:aria-sort|role\s*=\s*["'](?:tab|tablist|search)["']|type\s*=\s*["']search["']|data-(?:filter|sort|view|page)|class\s*=\s*["'][^"']*(?:search|filter|sort|pagination|pager|tabs?|segmented|toolbar)|placeholder\s*=\s*["'][^"']*(?:search|filter))/i

export const GENERIC_RECORD_DISCOVERY_LABEL_RE =
  /^(?:all|all items|all records|all statuses|date range|filter|filter status|search|search items|search records|sort|sort by|status|view|view all)$/i

export const SPECIFIC_RECORD_DISCOVERY_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|assignee|assignees|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i

export const GENERIC_RECORD_TABLE_COLUMN_LABEL_RE =
  /^(?:action|actions|amount|date|details?|id|name|owner|priority|progress|status|time|title|type|value)$/i

export const SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE =
  /\b(?:account|approval|arr|balance|billing|case|claim|client|contract|customer|due|handoff|incident|invoice|lead|mrr|order|patient|payout|policy|proposal|record|renewal|request|risk|route|shipment|shift|sla|supplier|ticket|vendor|workspace)\b/i

export const DESTRUCTIVE_ACTION_LABEL_RE =
  /^(?:delete|remove|archive|discard|revoke|disconnect|deactivate|disable|suspend|erase|reset|close\s+(?:account|workspace)|cancel\s+(?:subscription|plan|account|membership|renewal|invoice|order))\b/i

export const DESTRUCTIVE_TONE_MARKUP_RE =
  /\b(?:danger|destructive|critical|warning|error|negative|delete|remove|revoke|disconnect|deactivate|archive)\b/i

export const DESTRUCTIVE_SAFETY_MARKUP_RE =
  /\b(?:confirm|confirmation|undo|restore|recover|toast|dialog|modal|are you sure|permanent|irreversible|cannot be undone|role\s*=\s*["']dialog["']|aria-modal|data-confirm)\b/i

export const DIALOG_CONTAINER_CLASS_RE =
  /\b(?:modal|dialog|drawer|sheet|popover|confirmation|confirm-panel|side-panel)\b/i

export const DIALOG_CLOSE_LABEL_RE =
  /^(?:close|cancel|dismiss|done|back|never mind|go back)$/i

export const GENERIC_DIALOG_TITLE_RE =
  /^(?:are you sure|confirm|confirmation|details?|edit|information|modal|settings|warning)$/i

export const SPECIFIC_DIALOG_TITLE_RE =
  /\b(?:access|account|approval|billing|case|client|customer|delete|dispatch|handoff|incident|invoice|order|payment|renewal|request|risk|route|sla|supplier|ticket|vendor|workspace)\b/i

export const TAB_CONTAINER_CLASS_RE =
  /\b(?:tablist|tabs?|tab-list|segmented|segmented-control|segment-control|view-switcher|mode-switcher)\b/i

export const GENERIC_TAB_LABEL_RE =
  /^(?:activity|all|details?|general|history|items?|overview|settings|summary|tab\s*\d+|view\s*\d+|option\s*\d+)$/i

export const SPECIFIC_TAB_LABEL_RE =
  /\b(?:account|accounts|approval|approvals|billing|case|cases|client|clients|customer|customers|handoff|handoffs|invoice|invoices|lead|leads|order|orders|owner|owners|patient|patients|payment|payments|proposal|proposals|renewal|renewals|request|requests|risk|route|routes|shipment|shipments|sla|supplier|suppliers|task|tasks|ticket|tickets|vendor|vendors|workspace|workspaces)\b/i

export const WORKFLOW_STEP_CONTAINER_CLASS_RE =
  /\b(?:stepper|steps?|workflow|wizard|progress|timeline|process|journey|onboarding|checkout|approval-flow)\b/i

export const WORKFLOW_STEP_ITEM_CLASS_RE =
  /\b(?:step|stage|milestone|phase|checkpoint|timeline-item)\b/i

export const WORKFLOW_STEP_STATE_RE =
  /\b(?:aria-current|aria-selected|aria-checked|data-state\s*=\s*["'](?:active|current|complete|completed|done|upcoming|pending)["']|data-status\s*=|class\s*=\s*["'][^"']*\b(?:active|current|complete|completed|done|upcoming|pending|is-active|is-current|is-complete|is-completed|is-done)\b|role\s*=\s*["']progressbar["']|aria-valuenow)\b/i

export const GENERIC_WORKFLOW_STEP_LABEL_RE =
  /^(?:step|step\s*\d+|stage\s*\d+|phase\s*\d+|milestone\s*\d+|checkpoint\s*\d+|\d+[.)]?)$/i

export const SPECIFIC_WORKFLOW_STEP_LABEL_RE =
  /\b(?:account|approval|assign|billing|brief|checkout|connect|confirm|deploy|discover|draft|handoff|import|intake|invoice|launch|map|onboard|order|pay|payment|publish|renewal|request|review|route|schedule|setup|ship|submit|sync|triage|verify)\b/i

export const CONCRETE_DATA_PATTERNS = [
  /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:usd|eur|gbp|cny|rmb)\b/i,
  /\b\d[\d,.]*\s?(?:%|k|m|b|ms|sec|secs|min|mins|hr|hrs|hour|hours|day|days|week|weeks|users?|members?|tasks?|orders?|tickets?|invoices?|files?|gb|mb)\b/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\bq[1-4]\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i,
  /\b[A-Z]{2,}[-_#]?\d{2,}\b|\b(?:invoice|order|ticket|case|id|ref|build)\s*#?\s*[A-Z0-9-]{3,}\b/i,
  /\b(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready)\b/i,
  /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/,
  /\b[A-Z][A-Za-z0-9&.-]+\s+(?:Inc|LLC|Ltd|Labs|Finance|Bank|Studio|Clinic|Health|Systems|Group|Co)\b/
] as const

export const STATE_LAUNDRY_LIST_RE =
  /\b(?:loading|empty|error|disabled|offline|permission|success|hover|focus|skeleton)\s+states?\b/gi

export const STATUS_VALUE_ONLY_RE =
  /^(?:approved|pending|overdue|blocked|paid|unpaid|shipped|submitted|active|inactive|at risk|delayed|failed|synced|live|draft|ready|success|warning|error|critical|paused|complete|completed|rejected|canceled|cancelled|open|closed|resolved|in progress|on track|needs review|not started)$/i

export const STATUS_AFFORDANCE_CLASS_RE =
  /\b(?:status|badge|chip|pill|tag|state|tone|success|warning|danger|error|risk|critical|positive|negative|neutral|info|approved|pending|overdue|blocked|failed|active|inactive)\b/i

export const STATUS_AFFORDANCE_ATTRIBUTE_RE =
  /\b(?:data-(?:state|status|tone|variant|color)|aria-label|aria-labelledby|title)\s*=/i

export const STATUS_AFFORDANCE_STYLE_RE =
  /\b(?:background(?:-color)?|border(?:-[a-z]+)?|font-weight)\s*:/i

export const RECOVERABLE_STATE_TEXT_RE =
  /\b(?:no (?:[a-z]+ )?(?:data|results|items|records|invoices|tasks|messages|files|matches)|nothing found|empty (?:queue|state|list|inbox)|error|failed|failure|offline|disconnected|permission denied|access denied|unauthorized|unavailable|unable to|could not load|cannot load|sync failed|expired)\b/i

export const RECOVERABLE_STATE_HEADING_RE =
  /^(?:no (?:[a-z]+ )?(?:data|results|items|records|invoices|tasks|messages|files|matches)|nothing found|empty|error|failed|failure|offline|disconnected|permission|access denied|sync failed|retry failed|unable to|could not|cannot load|expired)/i

export const STATE_MODULE_CLASS_RE =
  /\b(?:empty|error|failure|failed|offline|permission|alert|notice|banner|state|status|retry)\b/i

export const GENERIC_RECOVERABLE_STATE_COPY_RE =
  /\b(?:no data|no items|nothing (?:here|to show)|nothing found|empty state|something went wrong|try again later|failed to load|unable to load|could not load|error occurred)\b/i

export const RECOVERABLE_STATE_CONTEXT_RE =
  /\b(?:account|approval|assignee|asset|billing|case|claim|client|contract|customer|deployment|dispatch|filter|handoff|import|incident|integration|inventory|invoice|lead|order|owner|patient|payment|payout|policy|proposal|record|renewal|request|risk|route|salesforce|shipment|shift|sla|supplier|sync|ticket|vendor|workspace)\b/i

export const FEEDBACK_MESSAGE_CLASS_RE =
  /\b(?:alert|banner|feedback|inline message|message|notification|notice|snackbar|status message|toast)\b/i

export const GENERIC_FEEDBACK_MESSAGE_RE =
  /^(?:changes saved|completed|done|error|failed|failure|info|operation complete|request sent|saved|sent|submitted|success|successfully saved|try again|updated|warning)$/i

export const FEEDBACK_MESSAGE_CONTEXT_RE =
  /\b(?:account|approval|assignee|billing|case|claim|client|connect|customer|dispatch|filter|handoff|import|incident|integration|invoice|lead|order|owner|payment|proposal|record|renewal|request|retry|risk|route|salesforce|sync|ticket|vendor|workspace)\b/i

export function normalizeQualityCode(code: string): string {
  return code.trim().replace(/^runtime-/, '')
}

export function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, ' ')
}

export function styleContent(html: string): string {
  return stripHtmlComments(html)
    .match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)
    ?.join('\n') ?? ''
}

export function textContent(html: string): string {
  return stripHtmlComments(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function documentTitleText(html: string): string {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(stripHtmlComments(html))
  return textContent(titleMatch?.[1] ?? '')
}

export function isGenericDocumentTitle(title: string): boolean {
  const normalized = title
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC_DOCUMENT_TITLE_RE.test(normalized) || PLACEHOLDER_RE.test(normalized) || META_PAGE_HEADING_RE.test(normalized)
}

export function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}
