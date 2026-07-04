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
  const raw = text.trim().replace(/^／/, '/')
  const lower = raw.toLowerCase()
  if (/^当前(?:任务|会话|线程)$/.test(raw)) {
    return { kind: 'showCurrentThread' }
  }
  if (/^(?:列出)?(?:当前)?(?:任务|会话|线程)(?:列表)?$/.test(raw)) {
    return { kind: 'showThreads' }
  }
  const naturalSwitchMatch = raw.match(/^切换到\s*(.+)$/)
  if (naturalSwitchMatch) {
    const target = (naturalSwitchMatch[1] ?? '').trim()
    if (target) return { kind: 'switchThread', target }
  }
  if (/^[/-](?:clear|reset|new|清空|重置|新会话|新话题)$/.test(lower)) {
    return { kind: 'clear' }
  }
  if (/^[/-](?:stop|cancel|interrupt|停止|中止|取消)$/.test(lower)) {
    return { kind: 'stop' }
  }
  if (/^[/-](?:help|帮助|命令|\?)$/.test(lower)) {
    return { kind: 'help' }
  }
  if (/^[/-](?:list-skills|skills|skill|技能|技能列表)$/.test(lower)) {
    return { kind: 'showSkills' }
  }
  if (/^[/-](?:list-mcp|mcp|mcp-servers|mcp服务器|mcp列表)$/.test(lower)) {
    return { kind: 'showMcp' }
  }
  if (/^[/-](?:list-goal|goals|目标列表)$/.test(lower)) {
    return { kind: 'showGoal' }
  }
  if (/^[/-](?:pwd|cwd|workspace|工作目录|当前目录)$/.test(lower)) {
    return { kind: 'showWorkspace' }
  }
  if (/^[/-](?:usage|tokens|token|token-usage|用量|token用量|消耗)$/.test(lower)) {
    return { kind: 'showUsage' }
  }
  const goalMatch = raw.match(/^[/-](?:goal|目标)(?:\s*(.*))?$/i)
  if (goalMatch) {
    const objective = (goalMatch[1] ?? '').trim()
    return objective ? { kind: 'setGoal', objective } : { kind: 'invalidGoal' }
  }
  if (/^[/-](?:list-threads|threads|thread|list|sessions|tasks|会话|线程|任务|列表)$/.test(lower)) {
    return { kind: 'showThreads' }
  }
  if (/^[/-](?:current|当前|当前会话|当前线程|当前任务)$/.test(lower)) {
    return { kind: 'showCurrentThread' }
  }
  const switchMatch = raw.match(/^[/-](?:switch|use|open|切换|切换到|打开)(?:\s+(.+))?$/i)
  if (switchMatch) {
    const target = (switchMatch[1] ?? '').trim()
    return target ? { kind: 'switchThread', target } : { kind: 'showThreads' }
  }
  if (/^[/-](?:list-model|list-models|models|model-list|模型列表|可用模型)$/.test(lower)) {
    return { kind: 'showModel' }
  }
  const match = raw.match(/^[/-](?:model|模型)(?:\s+(.+))?$/i)
  if (match) {
    const value = (match[1] ?? '').trim()
    return value ? { kind: 'model', model: value } : { kind: 'showModel' }
  }
  return null
}
