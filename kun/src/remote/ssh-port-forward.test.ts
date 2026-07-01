import { describe, expect, it } from 'vitest'
import { buildSshPortForwardArgv } from './ssh-port-forward.js'

describe('ssh-port-forward', () => {
  it('builds a loopback-bound -L tunnel that runs no remote command', () => {
    expect(buildSshPortForwardArgv({ alias: 'prod', localPort: 5173, remotePort: 3000 })).toEqual([
      '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ExitOnForwardFailure=yes',
      '-N', '-T', '-L', '127.0.0.1:5173:127.0.0.1:3000', 'prod'
    ])
  })

  it('rejects invalid ports', () => {
    expect(() => buildSshPortForwardArgv({ alias: 'p', localPort: 0, remotePort: 0 })).toThrow(/invalid port/)
    expect(() => buildSshPortForwardArgv({ alias: 'p', localPort: 70000, remotePort: 80 })).toThrow(/invalid port/)
  })
})
