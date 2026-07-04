export type ClawCommand =
  | { kind: 'clear' }
  | { kind: 'help' }
  | { kind: 'showSkills' }
  | { kind: 'showMcp' }
  | { kind: 'showGoal' }
  | { kind: 'showWorkspace' }
  | { kind: 'showUsage' }
  | { kind: 'invalidGoal' }
  | { kind: 'setGoal'; objective: string }
  | { kind: 'stop' }
  | { kind: 'showThreads' }
  | { kind: 'showCurrentThread' }
  | { kind: 'switchThread'; target: string }
  | { kind: 'showModel' }
  | { kind: 'model'; model: string }

export function parseClawCommand(text: string): ClawCommand | null {
  const raw = text.trim()
  const lower = raw.toLowerCase()
  if (/^[/-](?:new|clear)$/.test(lower)) {
    return { kind: 'clear' }
  }
  if (/^[/-]stop$/.test(lower)) {
    return { kind: 'stop' }
  }
  if (/^[/-]help$/.test(lower)) {
    return { kind: 'help' }
  }
  if (/^[/-]list-skills$/.test(lower)) {
    return { kind: 'showSkills' }
  }
  if (/^[/-]list-mcp$/.test(lower)) {
    return { kind: 'showMcp' }
  }
  if (/^[/-]list-goal$/.test(lower)) {
    return { kind: 'showGoal' }
  }
  if (/^[/-]pwd$/.test(lower)) {
    return { kind: 'showWorkspace' }
  }
  if (/^[/-]usage$/.test(lower)) {
    return { kind: 'showUsage' }
  }
  const goalMatch = raw.match(/^[/-]goal(?:\s*(.*))?$/i)
  if (goalMatch) {
    const objective = (goalMatch[1] ?? '').trim()
    return objective ? { kind: 'setGoal', objective } : { kind: 'invalidGoal' }
  }
  if (/^[/-]list-threads$/.test(lower)) {
    return { kind: 'showThreads' }
  }
  if (/^[/-]current$/.test(lower)) {
    return { kind: 'showCurrentThread' }
  }
  const switchMatch = raw.match(/^[/-]switch(?:\s+(.+))?$/i)
  if (switchMatch) {
    const target = (switchMatch[1] ?? '').trim()
    return target ? { kind: 'switchThread', target } : { kind: 'showThreads' }
  }
  if (/^[/-]list-model$/.test(lower)) {
    return { kind: 'showModel' }
  }
  const match = raw.match(/^[/-]model(?:\s+(.+))?$/i)
  if (match) {
    const value = (match[1] ?? '').trim()
    return value ? { kind: 'model', model: value } : { kind: 'showModel' }
  }
  return null
}
