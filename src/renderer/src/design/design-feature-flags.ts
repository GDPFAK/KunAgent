/**
 * Feature flags for the design workspace.
 *
 * Design mode now centers on the unified Figma-style board: HTML screen frames
 * are normal canvas frames linked to `kind: 'html'` artifacts, and every HTML
 * preview surface shares the same webview preview host.
 *
 * `DESIGN_CANVAS_ENABLED` is kept only as a compatibility gate for older
 * sidebar/canvas entry points that still check it. It must not be used to bring
 * back the legacy standalone project preview surface.
 */
export const DESIGN_CANVAS_ENABLED: boolean = false
