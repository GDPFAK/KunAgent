/**
 * Stricter ESLint rules for security-relevant i18n patterns. Run via:
 *
 *   pnpm lint:guard
 *
 * Built on top of the base flat config. ESLint v9 does not support
 * `--rule` CLI overrides for flat configs — extending the base via a
 * separate file is the supported way to layer additional rules.
 *
 * ## Why only two patterns?
 *
 * `no-restricted-syntax` only supports a single severity per rule, so
 * a rule that mixes "must fix" patterns with "should fix" patterns
 * would either block all PRs (annoying) or let everything through
 * (pointless). We therefore restrict this file to patterns that are
 * dangerous enough to block a PR on sight:
 *
 *   - `<Trans>...</Trans>` — react-i18next parses the translation
 *     string and renders any embedded JSX. If a translation value ever
 *     contains untrusted markup, it reaches the DOM verbatim. Use
 *     `t()` with JSX interpolation in render instead.
 *   - `t(\`prefix.${userVar}\`)` — dynamic keys bypass any typed
 *     translation key union and let user input flow into the
 *     translation key slot. Use a static key plus an interpolation
 *     argument.
 *
 * Other concerns (e.g. direct `i18n.t()` calls in store actions) are
 * left to a follow-up — there are ~95 pre-existing call sites and
 * lifting them all is out of scope for a security PR.
 */
import base from './eslint.config.js'

export default [
  ...base,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="Trans"]',
          message:
            'Avoid <Trans>. Use t() with JSX interpolation in render — this prevents untrusted HTML in translation strings from being rendered as raw DOM.'
        },
        {
          selector:
            "CallExpression[callee.property.name='t'] TemplateLiteral",
          message:
            'Avoid template literal translation keys (e.g. t(`foo.${var}`)). Use a static key with an interpolation argument so TypeScript can verify the key exists in the locale resources.'
        }
      ]
    }
  }
]
