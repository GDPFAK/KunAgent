/**
 * Standalone OCR worker process entry point.
 *
 * Spawned via child_process.fork() from the main OCR MCP server.
 * Communicates via IPC (process.send / process.on('message')).
 *
 * This completely bypasses tesseract.js's worker_threads mechanism,
 * which fails inside Electron's ASAR environment because
 * `new Worker(asarPath)` cannot resolve virtual filesystem paths.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Tesseract = require('tesseract.js')
const { recognize } = Tesseract
const { readFile } = require('node:fs/promises')
const { extname } = require('node:path')

type WorkerRequest = {
  id: string
  filePath: string
  language: string
  workerPath?: string
  corePath?: string
  langPath?: string
}

type WorkerResponse = {
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

async function handleRequest(req: WorkerRequest): Promise<WorkerResponse> {
  try {
    const buf = await readFile(req.filePath)
    const ext = extname(req.filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.tiff' || ext === '.tif' ? 'image/tiff'
      : ext === '.bmp' ? 'image/bmp'
      : ext === '.webp' ? 'image/webp'
      : 'image/png'

    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

    const opts: Record<string, unknown> = {}
    if (req.workerPath) opts.workerPath = req.workerPath
    if (req.corePath) opts.corePath = req.corePath
    if (req.langPath) opts.langPath = req.langPath

    const result = await recognize(dataUrl, req.language, opts, {
      text: true,
      blocks: true,
      hocr: false,
      tsv: false
    })

    return { id: req.id, ok: true, data: result.data }
  } catch (err) {
    return {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

// Listen for OCR requests from the parent process
process.on('message', async (msg: WorkerRequest) => {
  const resp = await handleRequest(msg)
  try {
    process.send!(resp)
  } catch {
    // Parent exited; nothing to do.
  }
})

// Signal readiness
try { process.send!({ ready: true } as unknown as WorkerResponse) } catch { /* noop */ }
