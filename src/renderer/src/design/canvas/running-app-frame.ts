import {
  createDefaultShape,
  type CanvasRunningAppFrame,
  type CanvasShape,
  type DevicePreset
} from './canvas-types'

type CreateRunningAppFrameOptions = {
  name?: string
  x: number
  y: number
  url: string
  devicePreset?: DevicePreset
  title?: string
  routePath?: string
  sourceFile?: string
  componentName?: string
  capturedAt?: string
}

const DEVICE_DIMENSIONS: Record<DevicePreset, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 }
}

function withLocalhostProtocol(value: string): string {
  if (/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[/?#].*)?$/i.test(value)) {
    return `http://${value}`
  }
  return value
}

export function normalizeRunningAppUrl(value: string): string | null {
  const raw = withLocalhostProtocol(value.trim())
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function runningAppFrameLabel(frame: CanvasRunningAppFrame): string {
  return frame.title?.trim() || frame.routePath?.trim() || frame.url
}

export function createRunningAppFrameShape(options: CreateRunningAppFrameOptions): CanvasShape | null {
  const url = normalizeRunningAppUrl(options.url)
  if (!url) return null
  const preset = options.devicePreset ?? 'desktop'
  const dims = DEVICE_DIMENSIONS[preset]
  const shape = createDefaultShape('frame', options.x, options.y)
  shape.name = options.name?.trim() || options.title?.trim() || 'Running app'
  shape.width = dims.width
  shape.height = dims.height
  shape.clipContent = true
  shape.devicePreset = preset
  shape.runningApp = {
    url,
    status: 'unknown',
    ...(options.title?.trim() ? { title: options.title.trim() } : {}),
    ...(options.routePath?.trim() ? { routePath: options.routePath.trim() } : {}),
    ...(options.sourceFile?.trim() ? { sourceFile: options.sourceFile.trim() } : {}),
    ...(options.componentName?.trim() ? { componentName: options.componentName.trim() } : {}),
    ...(options.capturedAt?.trim() ? { capturedAt: options.capturedAt.trim() } : {})
  }
  return shape
}
