import { rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'

const databasePath = '.tmp/e2e-studybuddy.db'

for (const suffix of ['', '-shm', '-wal']) {
  rmSync(`${databasePath}${suffix}`, { force: true })
}

const child = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['dev', '--host', '127.0.0.1'],
  {
    env: { ...process.env, STUDYBUDDY_DB_PATH: databasePath },
    stdio: 'inherit',
  },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
