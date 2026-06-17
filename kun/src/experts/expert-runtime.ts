import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const ExpertTag = z.object({
  zh: z.string(),
  en: z.string()
})
export type ExpertTag = z.infer<typeof ExpertTag>

export const ExpertManifestEntry = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  displayName: z.object({ zh: z.string(), en: z.string() }),
  profession: z.object({ zh: z.string(), en: z.string() }),
  description: z.object({ zh: z.string(), en: z.string() }),
  promptFile: z.string().default(''),
  avatar: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  defaultInitPrompt: z.object({ zh: z.string(), en: z.string() }).optional(),
  expertType: z.string().default('agent'),
  agentName: z.string().optional(),
  plugin: z.string().optional(),
  tags: z.array(ExpertTag).default([]),
  quickPrompts: z.array(z.object({ zh: z.string(), en: z.string() })).default([]),
  isOPC: z.boolean().optional()
}).passthrough()
export type ExpertManifestEntry = z.infer<typeof ExpertManifestEntry>

export const ExpertCategory = z.object({
  id: z.string().min(1),
  name: z.object({ zh: z.string(), en: z.string() }),
  description: z.object({ zh: z.string(), en: z.string() })
}).passthrough()
export type ExpertCategory = z.infer<typeof ExpertCategory>

export const ExpertManifest = z.object({
  version: z.string(),
  lastUpdated: z.string().optional(),
  author: z.object({ name: z.string(), source: z.string().optional(), license: z.string().optional() }).optional(),
  paths: z.object({ experts: z.string(), avatars: z.string() }).optional(),
  categories: z.array(ExpertCategory).default([]),
  experts: z.array(ExpertManifestEntry).default([])
})
export type ExpertManifest = z.infer<typeof ExpertManifest>

export type LoadedExpert = ExpertManifestEntry & {
  promptContent?: string
  avatarPath?: string
}

export type ExpertRuntimeDiagnostics = {
  enabled: boolean
  manifestVersion: string
  categoryCount: number
  expertCount: number
  lastError?: string
}

export class ExpertRuntime {
  private manifest: ExpertManifest | null = null
  private experts: LoadedExpert[] = []
  private lastError: string | undefined
  private effectiveDir: string

  constructor(private readonly options: {
    expertsDir: string
    srcDir?: string
    enabled?: boolean
  }) {
    this.effectiveDir = options.expertsDir
  }

  async load(): Promise<void> {
    if (this.options.enabled === false) return
    try {
      // 尝试从主目录加载
      let manifestPath = join(this.options.expertsDir, 'manifest.json')
      try {
        const raw = await readFile(manifestPath, 'utf8')
        this.manifest = ExpertManifest.parse(JSON.parse(raw))
      } catch {
        // 如果主目录没有，尝试从源码目录加载（开发模式）
        const srcDir = this.options.srcDir ?? join(process.cwd(), 'kun', 'src', 'experts')
        manifestPath = join(srcDir, 'manifest.json')
        const raw = await readFile(manifestPath, 'utf8')
        this.manifest = ExpertManifest.parse(JSON.parse(raw))
        this.effectiveDir = srcDir
      }
      this.experts = await this.loadExpertPrompts(this.manifest.experts)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.manifest = null
      this.experts = []
    }
  }

  private async loadExpertPrompts(entries: ExpertManifestEntry[]): Promise<LoadedExpert[]> {
    const loaded: LoadedExpert[] = []
    for (const entry of entries) {
      const expert: LoadedExpert = { ...entry }
      try {
        const promptPath = join(this.effectiveDir, entry.promptFile)
        expert.promptContent = await readFile(promptPath, 'utf8')
      } catch {
        // prompt 文件可选，加载失败不影响
      }
      if (entry.avatar) {
        expert.avatarPath = join(this.effectiveDir, entry.avatar)
      }
      loaded.push(expert)
    }
    return loaded
  }

  getCategories(): ExpertCategory[] {
    return this.manifest?.categories ?? []
  }

  getExperts(filter?: { categoryId?: string; search?: string }): LoadedExpert[] {
    let result = this.experts
    if (filter?.categoryId) {
      result = result.filter((e) => e.categoryId === filter.categoryId)
    }
    if (filter?.search) {
      const lower = filter.search.toLowerCase()
      result = result.filter((e) =>
        e.displayName.zh.toLowerCase().includes(lower) ||
        e.displayName.en.toLowerCase().includes(lower) ||
        e.profession.zh.toLowerCase().includes(lower) ||
        e.profession.en.toLowerCase().includes(lower) ||
        e.description.zh.toLowerCase().includes(lower) ||
        e.description.en.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.zh.toLowerCase().includes(lower) || t.en.toLowerCase().includes(lower))
      )
    }
    return result
  }

  getExpertsWithAvatars(filter?: { categoryId?: string; search?: string }): Array<LoadedExpert & { avatarDataUrl?: string }> {
    const experts = this.getExperts(filter)
    return experts.map((expert) => {
      let avatarDataUrl: string | undefined
      if (expert.avatar) {
        try {
          const filename = expert.avatar.split('/').pop() ?? expert.avatar
          const buffer = readFileSync(join(this.effectiveDir, 'avatars', filename))
          const ext = filename.split('.').pop()?.toLowerCase() ?? 'png'
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
          avatarDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
        } catch {
          // avatar not found, skip
        }
      }
      return { ...expert, avatarDataUrl }
    })
  }

  getExpertById(id: string): LoadedExpert | undefined {
    return this.experts.find((e) => e.id === id)
  }

  getExpertPrompt(id: string): string | undefined {
    return this.getExpertById(id)?.promptContent
  }

  getAvatarImage(filename: string): Buffer | undefined {
    try {
      const avatarPath = join(this.effectiveDir, 'avatars', filename)
      return readFileSync(avatarPath)
    } catch {
      return undefined
    }
  }

  diagnostics(): ExpertRuntimeDiagnostics {
    return {
      enabled: this.options.enabled !== false,
      manifestVersion: this.manifest?.version ?? 'unknown',
      categoryCount: this.manifest?.categories.length ?? 0,
      expertCount: this.experts.length,
      ...(this.lastError ? { lastError: this.lastError } : {})
    }
  }
}
