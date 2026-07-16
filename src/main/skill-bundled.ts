import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { app } from 'electron'

/**
 * Bundled skills: seeded once from the app's resources/skills/ directory into
 * ~/.kun/skills/ on first launch (idempotent seed marker). The Kun runtime
 * discovers them from the skills root and agents can load them (auto-activated
 * on matching prompts, or via load_skill). Deleting individual skills or the
 * entire ~/.kun/skills/ directory is honored — skills are not force-recreated.
 * Reappears after the next runtime restart.
 */

const BUNDLED_SEED_MARKER = '.bundled-skills-seed-v1'

/** All skill IDs shipped with the app. */
const BUNDLED_SKILL_IDS = [
  'banner-design',
  'brand',
  'design',
  'design-system',
  'slides',
  'ui-styling',
  'ui-ux-pro-max'
]

/** Source directory for bundled skills assets. */
function bundledSkillsSource(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'skills')
  }
  return join(app.getAppPath(), 'resources', 'skills')
}

/** Recursively copy a directory, creating destination subdirectories as needed. */
async function copyDirRecursive(src: string, dst: string): Promise<void> {
  await mkdir(dst, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const dstPath = join(dst, entry.name)
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, dstPath)
    } else {
      await copyFile(srcPath, dstPath)
    }
  }
}

let seedPromise: Promise<void> | null = null

export function ensureBundledSkills(kunHomeDir: string): Promise<void> {
  seedPromise ??= (async () => {
    const skillsRoot = join(kunHomeDir, 'skills')
    const markerPath = join(skillsRoot, BUNDLED_SEED_MARKER)
    try {
      await stat(markerPath)
      return
    } catch {
      // not seeded yet
    }

    const srcRoot = bundledSkillsSource()
    let seededCount = 0
    for (const skillId of BUNDLED_SKILL_IDS) {
      const src = join(srcRoot, skillId)
      try {
        await stat(src)
      } catch {
        console.warn(`[skill] bundled skill "${skillId}" not found at ${src}`)
        continue
      }
      try {
        const dst = join(skillsRoot, skillId)
        await copyDirRecursive(src, dst)
        seededCount++
      } catch (error) {
        console.error(`[skill] failed to seed bundled skill "${skillId}":`, error)
      }
    }

    if (seededCount > 0) {
      try {
        await mkdir(skillsRoot, { recursive: true })
        await writeFile(markerPath, `${BUNDLED_SKILL_IDS.join('\n')}\n`, 'utf8')
      } catch {
        // marker write failure is acceptable; seed retries next launch
      }
    }
  })()
  return seedPromise
}
