/**
 * Electron CJS shim - replaces the npm package's binary-path export
 * with the real Electron API, accessed via process._linkedBinding.
 *
 * When this file is bundled by Vite (via resolve alias for "electron"),
 * it provides the real Electron API at runtime inside Electron's main process.
 */

// NOTE: this file is bundled by Vite/Rollup from import statements.
// The actual require("electron") calls are replaced by this module.
// At bundle time, the import is resolved to this file, so there's
// no circular require of the npm electron package.

let electronExports: Record<string, any> | null = null

function getElectron(): any {
  if (electronExports) return electronExports

  // 1. Try direct require (works with standard Electron builds)
  try {
    const m = require('electron')
    if (m && typeof m === 'object' && !m.includes) {
      electronExports = m
      return electronExports
    }
  } catch (_) {}

  // 2. Inside Electron main process, access via _linkedBinding
  if (typeof process !== 'undefined' && typeof (process as any)._linkedBinding === 'function') {
    const api: Record<string, any> = {}
    const bindings: [string, string][] = [
      ['app', 'electron_browser_app'],
      ['autoUpdater', 'electron_browser_auto_updater'],
      ['BrowserWindow', 'electron_browser_window'],
      ['BrowserView', 'electron_browser_view'],
      ['crashReporter', 'electron_browser_crash_reporter'],
      ['desktopCapturer', 'electron_browser_desktop_capturer'],
      ['globalShortcut', 'electron_browser_global_shortcut'],
      ['Menu', 'electron_browser_menu'],
      ['Notification', 'electron_browser_notification'],
      ['session', 'electron_browser_session'],
      ['systemPreferences', 'electron_browser_system_preferences'],
      ['Tray', 'electron_browser_tray'],
      ['nativeImage', 'electron_common_native_image'],
    ]
    for (const [key, binding] of bindings) {
      try { api[key] = (process as any)._linkedBinding(binding) } catch (_) {}
    }

    // Dynamic bindings using snake_case pattern
    const dynamic = [
      'ipcMain', 'dialog', 'shell', 'clipboard', 'powerMonitor',
      'powerSaveBlocker', 'protocol', 'screen', 'nativeTheme',
      'net', 'netLog', 'safeStorage', 'webContents', 'webFrameMain',
      'contentTracing', 'ShareMenu', 'TouchBar'
    ]
    for (const key of dynamic) {
      const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
      try { api[key] = (process as any)._linkedBinding('electron_browser_' + snake); continue } catch (_) {}
      try { api[key] = (process as any)._linkedBinding('electron_common_' + snake); continue } catch (_) {}
    }

    if (api.app) {
      electronExports = api
      return electronExports
    }
  }

  // 3. Fallback Proxy for any missing property
  electronExports = new Proxy({}, {
    get(_, prop) {
      if (typeof process !== 'undefined' && typeof (process as any)._linkedBinding === 'function') {
        const key = String(prop)
        const snake = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
        try { return (process as any)._linkedBinding('electron_browser_' + snake) } catch (_) {}
        try { return (process as any)._linkedBinding('electron_common_' + snake) } catch (_) {}
      }
      return undefined
    }
  })
  return electronExports
}

const electron = getElectron()

// Named exports matching electron's module shape
export const app = electron.app
export const autoUpdater = electron.autoUpdater
export const BrowserView = electron.BrowserView
export const BrowserWindow = electron.BrowserWindow
export const clipboard = electron.clipboard
export const contentTracing = electron.contentTracing
export const crashReporter = electron.crashReporter
export const desktopCapturer = electron.desktopCapturer
export const dialog = electron.dialog
export const globalShortcut = electron.globalShortcut
export const ipcMain = electron.ipcMain
export const Menu = electron.Menu
export const MenuItem = electron.MenuItem
export const nativeImage = electron.nativeImage
export const nativeTheme = electron.nativeTheme
export const net = electron.net
export const netLog = electron.netLog
export const Notification = electron.Notification
export const powerMonitor = electron.powerMonitor
export const powerSaveBlocker = electron.powerSaveBlocker
export const protocol = electron.protocol
export const safeStorage = electron.safeStorage
export const screen = electron.screen
export const session = electron.session
export const ShareMenu = electron.ShareMenu
export const shell = electron.shell
export const systemPreferences = electron.systemPreferences
export const TouchBar = electron.TouchBar
export const Tray = electron.Tray
export const webContents = electron.webContents
export const webFrameMain = electron.webFrameMain

// Default export
export default electron
