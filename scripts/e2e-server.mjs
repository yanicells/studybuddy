import { spawn } from 'node:child_process'
import process from 'node:process'

const child = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['dev', '--host', '127.0.0.1'],
  {
    env: { ...process.env },
    stdio: 'inherit',
  },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
