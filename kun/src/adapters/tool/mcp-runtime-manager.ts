import type { McpCapabilityConfig, McpServerConfig } from '../../contracts/capabilities.js'
import type { McpConnectionStatus } from '../../contracts/events.js'
import { buildMcpToolProviders, type McpServerDiagnostic, type McpToolProviderBuildResult, type McpToolProviderOptions } from './mcp-tool-provider.js'
import { readMcpConfigFile, watchMcpConfigFile, type McpConfigError, type McpConfigFileParseResult } from './mcp-config-file.js'

export type McpRuntimeStatus = {
  servers: McpServerDiagnostic[]
  configErrors: McpConfigError[]
  configLoaded: boolean
  watching: boolean
}

export type McpRuntimeManagerOptions = McpToolProviderOptions & {
  /**
   * Called when a server's connection status transitions. The consumer
   * (e.g. runtime-factory) can forward this to the EventBus so GUI
   * clients receive mcp_status_changed events for observability.
   */
  onMcpStatusEvent?: (serverId: string, status: McpConnectionStatus, diagnostic: McpServerDiagnostic) => void
  /** Called when the config file has parse errors. */
  onConfigErrors?: (errors: McpConfigError[]) => void
}

/**
 * MCP runtime manager.
 *
 * Combines external config file parsing (with line-number-aware error
 * reporting) and the existing buildMcpToolProviders connection lifecycle
 * into a single component. Passes status transitions through the
 * onMcpStatusEvent callback so the EventBus can emit typed events.
 *
 * Key design principle: REUSES the existing buildMcpToolProviders connection
 * management — no duplicate connection logic.
 */
export class McpRuntimeManager {
  private readonly options: McpRuntimeManagerOptions
  private buildResult: McpToolProviderBuildResult | null = null
  private unwatchConfig: (() => void) | null = null
  private configErrors: McpConfigError[] = []
  private configLoaded = false
  /** Base config passed to initialize(), retained for hot-reload merging. */
  private baseConfig: McpCapabilityConfig | undefined

  constructor(options: McpRuntimeManagerOptions = {}) {
    this.options = options
  }

  /**
   * Initialize: load config file (if present), merge with base config,
   * connect all MCP servers, start config file watching if requested.
   */
  async initialize(baseConfig?: McpCapabilityConfig): Promise<McpToolProviderBuildResult> {
    this.baseConfig = baseConfig
    const mergedConfig = baseConfig

    // Wrap onStatusChange from tool-provider to emit typed events
    const onStatusChange: ((diagnostic: McpServerDiagnostic) => void) | undefined =
      this.options.onMcpStatusEvent
        ? (diagnostic) => {
          this.options.onMcpStatusEvent!(diagnostic.id, statusFromDiagnostic(diagnostic), diagnostic)
        }
        : undefined

    this.buildResult = await buildMcpToolProviders(mergedConfig, {
      ...this.options,
      onStatusChange,
    })

    return this.buildResult
  }

  /**
   * Load an external MCP config file and merge with base config.
   * Call before initialize() to apply file-based servers.
   */
  async loadConfigFile(filePath: string): Promise<McpCapabilityConfig | undefined> {
    try {
      const result = await readMcpConfigFile(filePath)
      this.configLoaded = true
      if (result.ok) {
        this.configErrors = []
        return result.config
      }
      this.configErrors = result.errors
      this.options.onConfigErrors?.(result.errors)
      return undefined
    } catch {
      this.configLoaded = true
      return undefined
    }
  }

  /** Get current runtime status (for GUI observability). */
  getStatus(): McpRuntimeStatus {
    return {
      servers: this.buildResult?.diagnostics ?? [],
      configErrors: [...this.configErrors],
      configLoaded: this.configLoaded,
      watching: this.unwatchConfig !== null,
    }
  }

  /** Get the underlying build result (backward compat). */
  getBuildResult(): McpToolProviderBuildResult | null {
    return this.buildResult
  }

  /** Start watching the config file for changes (hot-reload). */
  startWatching(filePath: string, debounceMs = 500): void {
    if (this.unwatchConfig) return
    this.unwatchConfig = watchMcpConfigFile(
      filePath,
      (result) => void this.handleConfigChange(result, filePath),
      { debounceMs },
    )
  }

  /** Stop watching the config file. */
  stopWatching(): void {
    if (this.unwatchConfig) {
      this.unwatchConfig()
      this.unwatchConfig = null
    }
  }

  /** Close the manager, stop watching, close all connections. */
  async close(): Promise<void> {
    this.stopWatching()
    if (this.buildResult) {
      await this.buildResult.close()
      this.buildResult = null
    }
  }

  // ─── internal ────────────────────────────────────────────────────────

  private async handleConfigChange(result: McpConfigFileParseResult, filePath: string): Promise<void> {
    if (!result.ok) {
      this.configErrors = result.errors ?? []
      this.options.onConfigErrors?.(this.configErrors)
      return
    }

    this.configErrors = []
    // Simple approach: close all and re-initialize with merged config.
    // An incremental add/remove/reconnect approach would be more efficient
    // but requires addServer/removeServer on the build result.
    if (this.buildResult) {
      await this.buildResult.close()
    }
    // Merge file config on top of baseConfig so hot-reload preserves servers
    // from the base config (e.g. programmatic or GUI defaults).
    const mergedConfig = mergeMcpConfigs(this.baseConfig, result.config)
    const onStatusChange = this.options.onMcpStatusEvent
      ? (diagnostic: McpServerDiagnostic) => {
        this.options.onMcpStatusEvent!(diagnostic.id, statusFromDiagnostic(diagnostic), diagnostic)
      }
      : undefined
    this.buildResult = await buildMcpToolProviders(mergedConfig, {
      ...this.options,
      onStatusChange,
    })
  }
}

/**
 * Merge base config with file-based config. File config takes priority
 * for overlapping server entries. Base enabled flag ORs with file.
 */
export function mergeMcpConfigs(
  base?: McpCapabilityConfig,
  file?: McpCapabilityConfig
): McpCapabilityConfig | undefined {
  if (!base && !file) return undefined
  if (!file) return base
  if (!base) return file
  return {
    enabled: base.enabled || file.enabled,
    servers: { ...base.servers, ...file.servers },
    search: file.search?.enabled ? file.search : base.search,
  } as McpCapabilityConfig
}

/** Map a McpServerDiagnostic status to the McpConnectionStatus enum. */
function statusFromDiagnostic(diagnostic: McpServerDiagnostic): McpConnectionStatus {
  switch (diagnostic.status) {
    case 'connected': return 'connected'
    case 'reconnecting': return 'connecting'
    case 'error': return 'error'
    case 'authorization_required': return 'error'
    case 'disabled': return 'disabled'
    default: return 'error'
  }
}
