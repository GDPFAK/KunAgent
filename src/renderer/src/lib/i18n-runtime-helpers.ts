/**
 * Runtime helpers for safer i18next usage. The static config in `i18n.ts`
 * is sufficient for the common case (React JSX already escapes
 * interpolated values), but these helpers add defence-in-depth against
 * future contributors who might:
 *
 *   - Pass a translation key as a dynamic template literal — caught by
 *     `no-restricted-syntax` in `eslint.config.guard.js` at lint time.
 *   - Use `<Trans>` (which renders embedded JSX in translation strings) —
 *     blocked by the same lint rule.
 *   - Feed user-controlled content into a translation string and pass
 *     the result to `dangerouslySetInnerHTML` — caught at runtime by
 *     `assertNoMarkup`.
 *
 * Note: `isSafeExternalHref` lives in `@shared/markdown-sanitize` (it
 * is used by the Markdown renderer in PR#1) and is intentionally not
 * re-exported here to keep this PR independent.
 */

/**
 * Dev-only assertion: throws if a value destined for a translation slot
 * contains anything that looks like HTML markup. Translation strings in
 * this codebase are intentionally plain text — `<b>`, `<a>`, `<script>`
 * etc. are never expected. Catching this in dev makes accidental XSS
 * vectors obvious instead of silently working until production.
 *
 * @param value The string about to be passed to `t()` or stored as a
 *   translation value.
 * @param fieldName A short label for the offending field, used in the
 *   error message to make debugging easier.
 */
export function assertNoMarkup(value: string, fieldName: string): void {
  if (!import.meta.env.DEV) return
  if (/<[a-z][^>]*>/i.test(value)) {
    throw new Error(
      `[i18n] field "${fieldName}" appears to contain HTML markup. ` +
        `Use t() with JSX interpolation in render, or store the value as a ` +
        `plain-text translation key. Value: ${JSON.stringify(value.slice(0, 80))}`
    )
  }
}
