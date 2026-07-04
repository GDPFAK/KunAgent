import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { startCodexBrowserAuth } from './codex-auth'

const CODEX_OAUTH_PORT = 1455

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function listenOnCodexOAuthPort(): Promise<Server | null> {
  return new Promise((resolve, reject) => {
    const server = createServer((_, res) => {
      res.writeHead(204).end()
    })
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        resolve(null)
        return
      }
      reject(error)
    })
    server.listen(CODEX_OAUTH_PORT, () => {
      resolve(server)
    })
  })
}

describe('startCodexBrowserAuth', () => {
  let blocker: Server | null = null

  afterEach(async () => {
    if (!blocker) return
    const server = blocker
    blocker = null
    await closeServer(server)
  })

  it('returns a structured fallback code when the fixed callback port is busy', async () => {
    blocker = await listenOnCodexOAuthPort()

    const result = await startCodexBrowserAuth(() => {
      throw new Error('openBrowser should not run while the callback port is busy')
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'port_in_use'
    })
    if (!result.ok) expect(result.message).toContain(String(CODEX_OAUTH_PORT))
  })
})
