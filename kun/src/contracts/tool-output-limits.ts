export const DEFAULT_TOOL_OUTPUT_MAX_LINES = 20_000
export const DEFAULT_TOOL_OUTPUT_MAX_BYTES = 500 * 1024

export type ToolOutputLimitsConfig = {
  maxLines?: number
  maxBytes?: number
}
