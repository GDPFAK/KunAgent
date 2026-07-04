export const DESIGN_EXPORT_FORMATS = ['html', 'pdf'] as const
export type DesignExportFormat = (typeof DESIGN_EXPORT_FORMATS)[number]

export type DesignExportPayload = {
  /** Workspace-relative path to the prototype's single-file HTML document. */
  path: string
  workspaceRoot?: string
  format: DesignExportFormat
  /** Suggested base filename for the save dialog (e.g. the artifact title). */
  filename?: string
}

export type DesignExportResult =
  | { ok: true; path: string; format: DesignExportFormat; exportedAt: string }
  | { ok: false; canceled?: boolean; message?: string }
