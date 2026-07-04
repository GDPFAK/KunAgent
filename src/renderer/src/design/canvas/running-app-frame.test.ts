import { describe, expect, it } from 'vitest'
import { isRunningAppFrame } from './canvas-types'
import {
  createRunningAppFrameShape,
  normalizeRunningAppUrl,
  runningAppFrameLabel
} from './running-app-frame'

describe('running app frames', () => {
  it('normalizes localhost and http urls while rejecting unsafe schemes', () => {
    expect(normalizeRunningAppUrl('localhost:3000/dashboard')).toBe('http://localhost:3000/dashboard')
    expect(normalizeRunningAppUrl('https://example.com/app')).toBe('https://example.com/app')
    expect(normalizeRunningAppUrl('javascript:alert(1)')).toBeNull()
  })

  it('creates a frame portal for a running app route', () => {
    const shape = createRunningAppFrameShape({
      x: 120,
      y: 80,
      url: 'localhost:5173/orders',
      title: 'Orders app',
      routePath: '/orders',
      sourceFile: 'src/app/orders/page.tsx',
      componentName: 'OrdersPage',
      devicePreset: 'desktop'
    })

    expect(shape).toMatchObject({
      type: 'frame',
      name: 'Orders app',
      width: 1280,
      height: 800,
      clipContent: true,
      devicePreset: 'desktop',
      runningApp: {
        url: 'http://localhost:5173/orders',
        title: 'Orders app',
        routePath: '/orders',
        sourceFile: 'src/app/orders/page.tsx',
        componentName: 'OrdersPage',
        status: 'unknown'
      }
    })
    expect(isRunningAppFrame(shape!)).toBe(true)
    expect(runningAppFrameLabel(shape!.runningApp!)).toBe('Orders app')
  })
})
