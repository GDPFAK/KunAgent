import { readBrowserStorageItem, writeBrowserStorageItem } from './browser-storage'

export type SkillRootId = string

const DEFAULT_SKILL_ROOT_ID: SkillRootId = 'workspace-agents'
const SKILL_ROOT_PREFERENCE_KEY = 'kun.skillRootPreference'

export function loadPreferredSkillRootId(): SkillRootId {
  const raw = readBrowserStorageItem(SKILL_ROOT_PREFERENCE_KEY)?.trim() ?? ''
  return raw || DEFAULT_SKILL_ROOT_ID
}

export function savePreferredSkillRootId(id: SkillRootId): void {
  writeBrowserStorageItem(SKILL_ROOT_PREFERENCE_KEY, id)
}
