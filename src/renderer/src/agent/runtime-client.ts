import type { AppSettingsPatch, AppSettingsV1 } from '@shared/app-settings'
import type {
  RuntimeRequestResult,
  SseEndPayload,
  SseErrorPayload,
  SseEventPayload
} from '@shared/kun-gui-api'
import { routeRegistry, type RouteRegistryFetch } from './route-registry.js'

class RendererRuntimeClient {
  private cachedSettings: AppSettingsV1 | null = null
  private settingsPromise: Promise<AppSettingsV1> | null = null
  private routeRegistryInitialized = false

  /**
   * Initialize the RouteRegistry with the IPC bridge fetch function.
   * Idempotent – safe to call multiple times. Falls back to default routes on failure.
   */
  async initRouteRegistry(): Promise<void> {
    if (this.routeRegistryInitialized) return
    const fetchFn: RouteRegistryFetch = async (path, method) => {
      return this.runtimeRequest(path, method)
    }
    await routeRegistry.init(fetchFn)
    this.routeRegistryInitialized = true
  }

  /**
   * Make a runtime request using a semantic route key.
   * Automatically resolves the key to the correct path via RouteRegistry.
   */
  async requestByKey(key: string, params: Record<string, string> = {}, method?: string, body?: string): Promise<RuntimeRequestResult> {
    const path = routeRegistry.path(key, params)
    return this.runtimeRequest(path, method, body)
  }

  async getSettings(options?: { forceRefresh?: boolean }): Promise<AppSettingsV1> {
    if (options?.forceRefresh) {
      this.invalidateSettings()
    }
    if (this.cachedSettings) return this.cachedSettings
    if (this.settingsPromise) return this.settingsPromise
    const task = window.kunGui.getSettings().then((settings) => {
      this.cachedSettings = settings
      return settings
    })
    this.settingsPromise = task.finally(() => {
      if (this.settingsPromise === task) this.settingsPromise = null
    })
    return task
  }

  async setSettings(partial: AppSettingsPatch): Promise<AppSettingsV1> {
    const settings = await window.kunGui.setSettings(partial)
    this.cachedSettings = settings
    this.settingsPromise = null
    return settings
  }

  invalidateSettings(): void {
    this.cachedSettings = null
    this.settingsPromise = null
  }

  runtimeRequest(path: string, method?: string, body?: string): Promise<RuntimeRequestResult> {
    if (body === undefined) {
      if (method === undefined) return window.kunGui.runtimeRequest(path)
      return window.kunGui.runtimeRequest(path, method)
    }
    return window.kunGui.runtimeRequest(path, method, body)
  }

  restartRuntime(): Promise<void> {
    return window.kunGui.restartRuntime()
  }

  startSse(threadId: string, sinceSeq: number, streamId?: string): Promise<{ streamId: string }> {
    return window.kunGui.startSse(threadId, sinceSeq, streamId)
  }

  stopSse(streamId: string): Promise<boolean> {
    return window.kunGui.stopSse(streamId)
  }

  onSseEvent(handler: (payload: SseEventPayload) => void): () => void {
    return window.kunGui.onSseEvent(handler)
  }

  onSseEnd(handler: (payload: SseEndPayload) => void): () => void {
    return window.kunGui.onSseEnd(handler)
  }

  onSseError(handler: (payload: SseErrorPayload) => void): () => void {
    return window.kunGui.onSseError(handler)
  }
}

export const rendererRuntimeClient = new RendererRuntimeClient()
