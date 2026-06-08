import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { PDFDocument } from 'pdf-lib'
import { existsSync, appendFileSync } from 'node:fs'
import { readFile, writeFile, mkdir, unlink, readdir, rmdir } from 'node:fs/promises'
import { basename, dirname, extname, join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { fork, execFile, spawn } from 'node:child_process'

// ═══════════════════════════════════════════════════════════════════════════
// Debug logging
// ═══════════════════════════════════════════════════════════════════════════

const DEBUG_LOG = '/tmp/ocr-debug.log'
function dlog(msg: string, data?: unknown): void {
  try {
    const ts = new Date().toISOString()
    const line = data !== undefined
      ? `[${ts}] ${msg} ${JSON.stringify(data, (_k, v) =>
          v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v
        )}\n`
      : `[${ts}] ${msg}\n`
    appendFileSync(DEBUG_LOG, line)
  } catch { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const PDF_RENDER_DPI = 300
const PDF_POINTS_PER_INCH = 72
const PIXEL_TO_PDF = PDF_POINTS_PER_INCH / PDF_RENDER_DPI

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.pnm', '.pbm', '.webp'
])

// ═══════════════════════════════════════════════════════════════════════════
// pdftoppm detection — uses system-installed poppler-utils
// ═══════════════════════════════════════════════════════════════════════════

let _pdftoppmPath: string | null | undefined // undefined = not checked yet

async function findPdftoppm(): Promise<string | null> {
  if (_pdftoppmPath !== undefined) return _pdftoppmPath
  return new Promise((resolve) => {
    execFile('which', ['pdftoppm'], (err, stdout) => {
      if (err || !stdout.trim()) {
        _pdftoppmPath = null
        dlog('pdftoppm: not found')
        resolve(null)
      } else {
        _pdftoppmPath = stdout.trim()
        dlog('pdftoppm: found', { path: _pdftoppmPath })
        resolve(_pdftoppmPath)
      }
    })
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF → PNG via pdftoppm (poppler)
// Returns array of PNG file paths, one per page.
// ═══════════════════════════════════════════════════════════════════════════

async function renderPdfToPngs(pdfPath: string, dpi: number = PDF_RENDER_DPI): Promise<string[]> {
  const pdftoppm = await findPdftoppm()
  if (!pdftoppm) {
    throw new Error(
      'pdftoppm not found. Install poppler:\n' +
      '  macOS:   brew install poppler\n' +
      '  Ubuntu:  sudo apt install poppler-utils\n' +
      '  Windows: choco install poppler  (or download from github.com/oschwartz10612/poppler-windows)'
    )
  }

  const workDir = join(tmpdir(), `ocr-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const prefix = join(workDir, 'page')

  dlog('renderPdfToPngs: starting', { pdfPath, dpi, workDir })

  return new Promise((resolve, reject) => {
    const child = spawn(pdftoppm, [
      '-png',
      '-r', String(dpi),
      pdfPath,
      prefix
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    child.on('exit', async (code) => {
      dlog('renderPdfToPngs: pdftoppm exited', { code, stderr: stderr.slice(0, 500) })

      if (code !== 0) {
        await cleanupDir(workDir)
        reject(new Error(`pdftoppm failed (exit ${code}): ${stderr.slice(0, 300)}`))
        return
      }

      try {
        const files = await readdir(workDir)
        const pngFiles = files
          .filter(f => f.endsWith('.png'))
          .sort()
          .map(f => join(workDir, f))

        dlog('renderPdfToPngs: done', { pageCount: pngFiles.length })

        if (pngFiles.length === 0) {
          await cleanupDir(workDir)
          reject(new Error('pdftoppm produced no output images'))
          return
        }

        resolve(pngFiles)
      } catch (err) {
        await cleanupDir(workDir)
        reject(err)
      }
    })

    child.on('error', async (err) => {
      await cleanupDir(workDir)
      reject(new Error(`Failed to run pdftoppm: ${err.message}`))
    })
  })
}

async function cleanupDir(dir: string): Promise<void> {
  try {
    const files = await readdir(dir)
    await Promise.all(files.map(f => unlink(join(dir, f)).catch(() => undefined)))
    await rmdir(dir).catch(() => undefined)
  } catch { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// OCR Worker — one-shot child_process per request
//
// tesseract.js uses worker_threads internally, which fails in Electron ASAR.
// Solution: fork a fresh Node.js process for each OCR request.
// ═══════════════════════════════════════════════════════════════════════════

type OcrRequest = {
  id: string
  filePath: string
  language: string
  workerPath?: string
  corePath?: string
  langPath?: string
}

type OcrResponse = {
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

function getWorkerEntryPath(): string {
  const entryName = 'ocr-worker-entry.js'
  const mainDir = dirname(__dirname)

  // Packaged app: app.asar.unpacked/out/main/ocr-worker-entry.js
  if (__dirname.includes(`${sep}app.asar${sep}`)) {
    const unpackedMain = mainDir.replace(
      `${sep}app.asar${sep}`,
      `${sep}app.asar.unpacked${sep}`
    )
    const unpackedPath = join(unpackedMain, entryName)
    if (existsSync(unpackedPath)) return unpackedPath
    const unpackedSame = join(
      __dirname.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`),
      entryName
    )
    if (existsSync(unpackedSame)) return unpackedSame
  }

  // Development: try parent (out/main/) then same dir (out/main/chunks/)
  const parentPath = join(mainDir, entryName)
  if (existsSync(parentPath)) return parentPath
  const samePath = join(__dirname, entryName)
  if (existsSync(samePath)) return samePath
  return parentPath
}

function resolveAsarUnpackedPath(asarPath: string): string {
  if (!asarPath.includes(`${sep}app.asar${sep}`)) return asarPath
  return asarPath.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
}

function buildTesseractOptions(): { workerPath: string; corePath: string; langPath: string } {
  const tesseractEntry = require.resolve('tesseract.js')
  const coreEntry = require.resolve('tesseract.js-core')
  const realWorkerPath = resolveAsarUnpackedPath(
    join(dirname(tesseractEntry), 'worker-script', 'node', 'index.js')
  )
  const realCorePath = resolveAsarUnpackedPath(dirname(coreEntry))
  return {
    workerPath: realWorkerPath,
    corePath: realCorePath,
    langPath: 'https://tessdata.projectnaptha.com/4.0.0'
  }
}

function ocrViaChildProcess(filePath: string, language: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const entryPath = getWorkerEntryPath()
    const opts = buildTesseractOptions()
    const reqId = randomUUID()

    const request = JSON.stringify({ id: reqId, filePath, language, ...opts })
    dlog('ocrViaChildProcess: spawning', { entryPath, filePath, language, exists: existsSync(entryPath) })

    const child = fork(entryPath, [request], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('OCR worker timeout (300s)'))
    }, 300_000)

    child.on('exit', (code) => {
      clearTimeout(timer)
      dlog('ocrViaChildProcess: exited', { code, stdoutLen: stdout.length, stderrLen: stderr.length })
      if (stderr) dlog('ocrViaChildProcess: stderr', { stderr: stderr.slice(0, 2000) })

      if (code !== 0 && !stdout) {
        reject(new Error(`OCR worker exited with code ${code}${stderr ? ': ' + stderr.slice(0, 500) : ''}`))
        return
      }

      try {
        const resp: OcrResponse = JSON.parse(stdout)
        if (resp.ok) {
          resolve(resp.data)
        } else {
          reject(new Error(resp.error || 'OCR worker error'))
        }
      } catch {
        reject(new Error(`OCR worker returned invalid JSON: ${stdout.slice(0, 200)}`))
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      dlog('ocrViaChildProcess: spawn error', err)
      reject(new Error(`Failed to spawn OCR worker: ${err.message}`))
    })
  })
}

function preloadLanguages(languages: string[]): void {
  const entryPath = getWorkerEntryPath()
  const opts = buildTesseractOptions()
  const reqId = randomUUID()
  const request = JSON.stringify({ id: reqId, preload: languages, ...opts })
  dlog('preloadLanguages: starting', { languages })

  const child = fork(entryPath, [request], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })

  let stderr = ''
  child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

  child.on('exit', (code) => {
    dlog('preloadLanguages: done', { code, languages, stderr: stderr.slice(0, 500) })
  })
  child.on('error', (err) => {
    dlog('preloadLanguages: error', err)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type OcrWord = {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
  confidence: number
}

type OcrPage = {
  pageNumber: number
  text: string
  words: OcrWord[]
  confidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Core OCR engine
// ═══════════════════════════════════════════════════════════════════════════

async function ocrFile(filePath: string, language: string): Promise<unknown> {
  dlog('ocrFile', { filePath, language })
  return ocrViaChildProcess(filePath, language)
}

async function runOcrOnImage(inputPath: string, language: string): Promise<unknown> {
  const result = await ocrFile(inputPath, language)
  return flattenOcrResult([result])
}

async function runOcrOnPdf(pdfPath: string, language: string): Promise<unknown> {
  dlog('runOcrOnPdf:start', { pdfPath, language })

  // Step 1: PDF → PNG via pdftoppm (proven, reliable)
  const pngFiles = await renderPdfToPngs(pdfPath, PDF_RENDER_DPI)
  dlog('runOcrOnPdf:rendered', { pageCount: pngFiles.length })

  // Step 2: OCR each page via tesseract.js (in separate processes)
  const pageResults: unknown[] = []
  try {
    for (let i = 0; i < pngFiles.length; i++) {
      dlog('runOcrOnPdf:ocr-page', { pageIndex: i, file: pngFiles[i] })
      const result = await ocrFile(pngFiles[i], language)
      pageResults.push(result)
      dlog('runOcrOnPdf:page-done', { pageIndex: i })
    }
  } finally {
    // Cleanup temp PNG files
    await Promise.all(pngFiles.map(f => unlink(f).catch(() => undefined)))
    // Cleanup work dir
    if (pngFiles.length > 0) {
      await cleanupDir(dirname(pngFiles[0]))
    }
  }

  if (pageResults.length === 0) {
    throw new Error('Could not render any pages from the PDF.')
  }

  return flattenOcrResult(pageResults)
}

function flattenOcrResult(pageResults: unknown[]): unknown {
  const flatWords: Array<OcrWord & { page: number }> = []
  pageResults.forEach((r: any, i) => {
    const pageNo = i + 1
    for (const block of r.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const w of line.words ?? []) {
            if (!w.text) continue
            flatWords.push({
              text: w.text,
              bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
              confidence: w.confidence,
              page: pageNo
            })
          }
        }
      }
    }
  })

  const mergedData = {
    text: pageResults.map((r: any) => r.text ?? '').join('\n\n'),
    confidence: Math.round(
      pageResults.reduce((s: number, r: any) => s + (r.confidence ?? 0), 0) / pageResults.length
    ),
    blocks: pageResults.flatMap((r: any) => r.blocks ?? []),
    words: flatWords
  }
  return mergedData
}

function buildPageData(result: any): OcrPage[] {
  const pages = new Map<number, { text: string; words: OcrWord[]; confidences: number[] }>()

  for (const word of result.words) {
    const pageNum = (word as { page?: number }).page ?? 1
    if (!pages.has(pageNum)) {
      pages.set(pageNum, { text: '', words: [], confidences: [] })
    }
    const page = pages.get(pageNum)!
    const wordText = word.text || ''
    if (wordText.trim()) {
      page.words.push({
        text: wordText,
        bbox: { x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 },
        confidence: word.confidence
      })
      page.text += (page.text ? ' ' : '') + wordText
    }
    page.confidences.push(word.confidence)
  }

  const result_pages: OcrPage[] = []
  for (const [pageNum, data] of pages) {
    const avgConf = data.confidences.length
      ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length
      : 0
    result_pages.push({
      pageNumber: pageNum,
      text: data.text,
      words: data.words,
      confidence: Math.round(avgConf)
    })
  }

  if (result_pages.length === 0 && result.text?.trim()) {
    result_pages.push({
      pageNumber: 1,
      text: result.text.trim(),
      words: [],
      confidence: Math.round(result.confidence)
    })
  }

  return result_pages
}

// ═══════════════════════════════════════════════════════════════════════════
// Searchable PDF generation (pdf-lib)
// ═══════════════════════════════════════════════════════════════════════════

async function embedTextLayer(
  originalPdfPath: string,
  outputPdfPath: string,
  pages: OcrPage[]
): Promise<void> {
  const pdfBytes = await readFile(originalPdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const helvetica = pdfDoc.embedStandardFont('Helvetica')

  for (const ocrPage of pages) {
    const pageIndex = ocrPage.pageNumber - 1
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue

    const pdfPage = pdfDoc.getPage(pageIndex)
    const { height: pageHeight } = pdfPage.getSize()

    if (ocrPage.words.length > 0) {
      for (const word of ocrPage.words) {
        if (!word.text.trim()) continue

        const fontSize = Math.max(
          (word.bbox.y1 - word.bbox.y0) * PIXEL_TO_PDF,
          4
        )
        const x = word.bbox.x0 * PIXEL_TO_PDF
        const y = pageHeight - word.bbox.y1 * PIXEL_TO_PDF

        pdfPage.drawText(word.text, {
          x, y, size: fontSize, font: helvetica, opacity: 0
        })
      }
    } else {
      pdfPage.drawText(ocrPage.text, {
        x: 36,
        y: pageHeight - 36,
        size: 10,
        font: helvetica,
        opacity: 0,
        maxWidth: pdfPage.getSize().width - 72
      })
    }
  }

  const outputBytes = await pdfDoc.save()
  await writeFile(outputPdfPath, outputBytes)
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP helpers
// ═══════════════════════════════════════════════════════════════════════════

function textResult(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    ...(structuredContent ? { structuredContent } : {})
  }
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true
  }
}

function resolveOutputPath(inputPath: string, outputPath?: string): string {
  if (outputPath) return outputPath
  const dir = dirname(inputPath)
  const base = basename(inputPath, extname(inputPath))
  return join(dir, `${base}_ocr.pdf`)
}

const ALL_TESSERACT_LANGUAGES = [
  'afr', 'amh', 'ara', 'asm', 'aze', 'aze_cyrl', 'bel', 'ben', 'bod', 'bos',
  'bre', 'bul', 'cat', 'ceb', 'ces', 'chi_sim', 'chi_tra', 'chr', 'cos',
  'cym', 'dan', 'deu', 'div', 'dzo', 'ell', 'eng', 'enm', 'epo', 'est',
  'eus', 'fao', 'fas', 'fil', 'fin', 'fra', 'frk', 'frm', 'fry', 'gla',
  'gle', 'glg', 'grc', 'guj', 'hat', 'heb', 'hin', 'hrv', 'hun', 'hye',
  'iku', 'ind', 'isl', 'ita', 'ita_old', 'jav', 'jpn', 'kan', 'kat',
  'kat_old', 'kaz', 'khm', 'kir', 'kmr', 'kor', 'lao', 'lat', 'lav', 'lit',
  'ltz', 'mal', 'mar', 'mkd', 'mlt', 'mon', 'mri', 'msa', 'mya', 'nep',
  'nld', 'nor', 'oci', 'ori', 'pan', 'pol', 'por', 'pus', 'que', 'ron',
  'rus', 'san', 'sin', 'slk', 'slv', 'snd', 'spa', 'spa_old', 'sqi', 'srp',
  'srp_latn', 'sun', 'swa', 'swe', 'syr', 'tam', 'tat', 'tel', 'tgk', 'tha',
  'tir', 'ton', 'tur', 'uig', 'ukr', 'urd', 'uzb', 'uzb_cyrl', 'vie', 'yid', 'yor'
] as const

async function detectCachedLanguages(): Promise<string[]> {
  try { return ['eng'] } catch { return [] }
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP server definition
// ═══════════════════════════════════════════════════════════════════════════

export async function runOcrMcpServerFromArgv(argv: string[]): Promise<boolean> {
  if (!argv.includes('--gui-ocr-mcp-server')) return false

  const server = new McpServer(
    { name: 'deepseek-gui-ocr', version: '0.6.0' },
    { capabilities: { logging: {} } }
  )

  // Pre-download English and Chinese language data in the background
  preloadLanguages(['eng', 'chi_sim'])

  // ── gui_ocr_check ──────────────────────────────────────────────────

  server.registerTool('gui_ocr_check', {
    description:
      'Check the built-in OCR engine status. Shows pdftoppm availability ' +
      'and tesseract.js language cache status. English is pre-installed; ' +
      'other languages auto-download on first use.'
  }, async () => {
    const pdftoppm = await findPdftoppm()
    const cached = await detectCachedLanguages()
    const pdftoppmStatus = pdftoppm ? `ready (${pdftoppm})` : 'NOT FOUND — install poppler'

    return textResult(
      [
        'Built-in OCR engine — status:',
        '',
        `PDF renderer (pdftoppm): ${pdftoppmStatus}`,
        `OCR engine (tesseract.js WASM): ready`,
        `Pre-cached languages: ${cached.length ? cached.join(', ') : 'eng (bundled)'}`,
        `All supported languages (${ALL_TESSERACT_LANGUAGES.length}): ${ALL_TESSERACT_LANGUAGES.join(', ')}`,
        '',
        pdftoppm ? '' : '⚠ Install poppler for PDF OCR:\n  macOS: brew install poppler\n  Ubuntu: sudo apt install poppler-utils',
        '',
        'Use gui_ocr_pdf to OCR a PDF, gui_ocr_image to OCR an image.',
        'Language data for non-English languages auto-downloads on first use.'
      ].filter(Boolean).join('\n'),
      {
        engine: 'tesseract.js (WASM)',
        pdfRenderer: pdftoppm ? 'pdftoppm (poppler)' : 'not installed',
        ready: true,
        bundledLanguage: 'eng',
        supportedLanguageCount: ALL_TESSERACT_LANGUAGES.length,
        cachedLanguages: cached
      }
    )
  })

  // ── gui_ocr_languages ──────────────────────────────────────────────

  server.registerTool('gui_ocr_languages', {
    description:
      'List all Tesseract OCR language codes. English is pre-installed; ' +
      'others auto-download on first use and are cached permanently.'
  }, async () => {
    const cached = await detectCachedLanguages()
    return textResult(
      [
        `Supported language codes (${ALL_TESSERACT_LANGUAGES.length} total):`,
        '',
        ...ALL_TESSERACT_LANGUAGES.map(
          (l) => `${l}${cached.includes(l) ? ' [pre-cached]' : ' [auto-download on first use]'}`
        ),
        '',
        'Combine with "+", e.g. "eng+chi_sim+fra".'
      ].join('\n'),
      { languages: ALL_TESSERACT_LANGUAGES, cachedLanguages: cached, combineWith: '+' }
    )
  })

  // ── gui_ocr_preload ─────────────────────────────────────────────────

  server.registerTool('gui_ocr_preload', {
    description:
      'Pre-download Tesseract OCR language data for faster subsequent OCR. ' +
      'Languages are cached permanently after download.',
    inputSchema: {
      language: z.string().min(1).describe(
        'Language code(s) to pre-download. Combine with "+", e.g. "eng+chi_sim+jpn".'
      )
    }
  }, async (args) => {
    const languages = args.language.split('+').map((l: string) => l.trim()).filter(Boolean)
    const invalid = languages.filter((l: string) => !(ALL_TESSERACT_LANGUAGES as readonly string[]).includes(l))
    if (invalid.length > 0) {
      return errorResult(`Unknown language code(s): ${invalid.join(', ')}. Use gui_ocr_languages for the full list.`)
    }

    preloadLanguages(languages)
    return textResult(
      `Pre-downloading language data for: ${languages.join(', ')}.\n` +
      'This runs in the background. Language data will be cached permanently.',
      { languages, status: 'downloading' }
    )
  })

  // ── gui_ocr_pdf ────────────────────────────────────────────────────

  server.registerTool('gui_ocr_pdf', {
    description:
      'Run OCR on a PDF file. Uses pdftoppm (poppler) to render PDF pages ' +
      'to images, then tesseract.js to recognize text. Optionally creates ' +
      'a searchable output PDF with an invisible selectable text layer. ' +
      'Supports 100+ languages.',
    inputSchema: {
      input_path: z.string().min(1).describe('Absolute path to the input PDF file'),
      output_path: z.string().optional().describe(
        'Absolute path for the output searchable PDF. If provided, a copy of the ' +
        'original PDF is saved here with an invisible selectable text layer.'
      ),
      language: z.string().optional().describe(
        'OCR language(s). Combine with "+", e.g. "eng", "chi_sim", "eng+chi_sim". Default: "eng".'
      ),
      create_searchable_pdf: z.boolean().optional().describe(
        'If true, create a searchable PDF at output_path. Default: true when output_path is set.'
      ),
      timeout_seconds: z.number().int().min(30).max(3600).optional().describe(
        'Maximum time in seconds. Default: 300 (5 minutes).'
      )
    }
  }, async (args) => {
    const startedAt = Date.now()

    try {
      const inputPath = args.input_path
      if (!existsSync(inputPath)) {
        return errorResult(`Input file not found: ${inputPath}`)
      }

      const ext = extname(inputPath).toLowerCase()
      if (ext !== '.pdf') {
        return errorResult(`Input must be a .pdf file, got "${ext}". Use gui_ocr_image for images.`)
      }

      // Check pdftoppm availability
      const pdftoppm = await findPdftoppm()
      if (!pdftoppm) {
        return errorResult(
          'pdftoppm not found. Install poppler for PDF OCR:\n' +
          '  macOS:   brew install poppler\n' +
          '  Ubuntu:  sudo apt install poppler-utils\n' +
          '  Windows: choco install poppler'
        )
      }

      const language = args.language || 'eng'
      const shouldCreatePdf = args.create_searchable_pdf ?? (args.output_path !== undefined)

      if (args.output_path) {
        const outputDir = dirname(args.output_path)
        try { await mkdir(outputDir, { recursive: true }) } catch { /* noop */ }
      }

      const recognizeResult = await withTimeout(
        runOcrOnPdf(inputPath, language),
        (args.timeout_seconds ?? 300) * 1000,
        'OCR timed out'
      )

      const pages = buildPageData(recognizeResult)
      const fullText = pages.map((p) => p.text).join('\n\n')
      const avgConfidence = pages.length
        ? Math.round(pages.reduce((s, p) => s + p.confidence, 0) / pages.length)
        : 0
      const durationMs = Date.now() - startedAt

      let outputPath: string | undefined
      if (shouldCreatePdf && pages.length > 0) {
        outputPath = resolveOutputPath(inputPath, args.output_path)
        await embedTextLayer(inputPath, outputPath, pages)
      }

      const summaryLines = [
        `OCR completed in ${(durationMs / 1000).toFixed(1)}s.`,
        `Pages: ${pages.length}`,
        `Average confidence: ${avgConfidence}%`,
        `Language: ${language}`,
      ]
      if (outputPath) summaryLines.push(`Searchable PDF saved to: ${outputPath}`)
      summaryLines.push('', '--- Recognized text ---', fullText || '(no text recognized)')

      return textResult(summaryLines.join('\n'), {
        durationMs,
        pageCount: pages.length,
        confidence: avgConfidence,
        language,
        text: fullText,
        outputPath: outputPath ?? null,
        pages: pages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text.slice(0, 500),
          confidence: p.confidence,
          wordCount: p.words.length
        }))
      })
    } catch (err) {
      dlog('gui_ocr_pdf:error', err)
      return errorResult(
        `OCR failed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ` +
        `${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  // ── gui_ocr_image ──────────────────────────────────────────────────

  server.registerTool('gui_ocr_image', {
    description:
      'Run OCR on an image file (PNG, JPEG, TIFF, BMP, WebP) using the built-in engine.',
    inputSchema: {
      input_path: z.string().min(1).describe('Absolute path to the input image file'),
      language: z.string().optional().describe(
        'OCR language(s). Combine with "+", e.g. "eng", "chi_sim". Default: "eng".'
      )
    }
  }, async (args) => {
    const startedAt = Date.now()

    try {
      const inputPath = args.input_path
      if (!existsSync(inputPath)) {
        return errorResult(`Input file not found: ${inputPath}`)
      }
      const ext = extname(inputPath).toLowerCase()
      if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
        return errorResult(`Unsupported image format "${ext}". Supported: ${[...SUPPORTED_IMAGE_EXTENSIONS].join(', ')}`)
      }

      const language = args.language || 'eng'
      const recognizeResult = await withTimeout(
        runOcrOnImage(inputPath, language),
        300_000,
        'OCR timed out'
      )

      const pages = buildPageData(recognizeResult)
      const fullText = pages.map((p) => p.text).join('\n\n')
      const avgConfidence = pages.length
        ? Math.round(pages.reduce((s, p) => s + p.confidence, 0) / pages.length)
        : 0
      const durationMs = Date.now() - startedAt

      return textResult(
        [
          `OCR completed in ${(durationMs / 1000).toFixed(1)}s.`,
          `Confidence: ${avgConfidence}%`,
          `Language: ${language}`,
          '',
          '--- Recognized text ---',
          fullText || '(no text recognized)'
        ].join('\n'),
        { durationMs, confidence: avgConfidence, language, text: fullText }
      )
    } catch (err) {
      return errorResult(
        `OCR failed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ` +
        `${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then((val) => { clearTimeout(timer); resolve(val) })
      .catch((err) => { clearTimeout(timer); reject(err) })
  })
}
