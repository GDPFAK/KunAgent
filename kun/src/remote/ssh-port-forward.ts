import { isIP } from 'node:net'
import { assertSafeSshAlias, buildSshBaseArgs, type SshConnectionOptions } from './ssh-command.js'

export type SshPortForwardOptions = SshConnectionOptions & {
  localPort: number
  remotePort: number
  remoteHost?: string
  localBindHost?: string
}

export function buildSshPortForwardArgv(options: SshPortForwardOptions): string[] {
  const localBindHost = options.localBindHost ?? '127.0.0.1'
  const remoteHost = options.remoteHost ?? '127.0.0.1'
  if (!isValidPort(options.localPort) || !isValidPort(options.remotePort)) {
    throw new Error('invalid port for SSH forward (1-65535 required)')
  }
  const forwardSpec = formatForwardHost(localBindHost) + ':' + options.localPort + ':' + formatForwardHost(remoteHost) + ':' + options.remotePort
  return [
    ...buildSshBaseArgs({
      ...options,
      batchMode: options.batchMode ?? true,
      connectTimeoutSec: options.connectTimeoutSec ?? 10
    }),
    '-o', 'ExitOnForwardFailure=yes',
    '-N',
    '-T',
    '-L', forwardSpec,
    assertSafeSshAlias(options.alias)
  ]
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function formatForwardHost(host: string): string {
  const value = host.trim()
  if (!value) throw new Error('SSH forward host must not be empty')
  const version = isIP(value)
  if (version === 4) return value
  if (version === 6) return '[' + value + ']'
  if (!/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/.test(value)) {
    throw new Error('invalid SSH forward host: ' + host)
  }
  return value
}
