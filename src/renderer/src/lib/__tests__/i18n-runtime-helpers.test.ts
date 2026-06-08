import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { assertNoMarkup } from '../i18n-runtime-helpers'

/**
 * `i18n-runtime-helpers` exposes `assertNoMarkup`, a dev-only assertion
 * for catching accidental HTML markup in translation strings. The
 * `isSafeExternalHref` helper (used to gate `<a href>` onClick handlers
 * in the renderer) lives in `@shared/markdown-sanitize` and is covered
 * exhaustively by `src/shared/__tests__/markdown-sanitize.test.ts`.
 */
describe('i18n-runtime-helpers', () => {
  describe('assertNoMarkup (dev-only)', () => {
    beforeEach(() => {
      // Force dev mode so the assertion actually runs regardless of the
      // vitest environment.
      vi.stubEnv('DEV', true)
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('does not throw for plain text values', () => {
      expect(() => assertNoMarkup('hello world', 'greeting')).not.toThrow()
    })

    it('does not throw for empty string', () => {
      expect(() => assertNoMarkup('', 'description')).not.toThrow()
    })

    it('throws when value contains an HTML tag', () => {
      expect(() => assertNoMarkup('hello <b>world</b>', 'greeting')).toThrowError(
        /HTML markup/
      )
    })

    it('throws when value contains a <script> tag', () => {
      expect(() =>
        assertNoMarkup('ok <script>alert(1)</script>', 'body')
      ).toThrowError(/HTML markup/)
    })

    it('error message includes the field name for debuggability', () => {
      expect(() => assertNoMarkup('<i>x</i>', 'myField')).toThrowError(/myField/)
    })
  })
})
