import 'dotenv/config'

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'

import { MIGRATIONS } from './migrations'
import { schema } from './schema'

export type Database = LibSQLDatabase<typeof schema>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export type Db = Database | Transaction

const clients = new WeakMap<Database, Client>()
let defaultDatabase: Promise<Database> | undefined

export function resolveDatabasePath(): string {
  const configured = process.env.STUDYBUDDY_DB_PATH?.trim()
  if (configured) return resolve(configured)

  const legacy = join(
    homedir(),
    'Library',
    'Application Support',
    'dev.yanicells.Studybuddy',
    'studybuddy.db',
  )
  if (existsSync(legacy)) return legacy
  return resolve('data/studybuddy.db')
}

export function resolveConnection(): { url: string; authToken?: string } {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim()
  if (url && authToken) return { url, authToken }

  if (isServerless()) {
    throw new Error(
      'Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project environment.',
    )
  }

  const path = resolveDatabasePath()
  if (path !== ':memory:') ensureDirectory(path)
  return { url: path === ':memory:' ? ':memory:' : `file:${path}` }
}

export async function openDatabase(
  connection: { url: string; authToken?: string } | string = resolveConnection(),
): Promise<Database> {
  const options = typeof connection === 'string'
    ? { url: connection === ':memory:' ? ':memory:' : `file:${connection}` }
    : connection
  if (options.url.startsWith('file:')) ensureDirectory(options.url.slice('file:'.length))
  const client = createClient(options)
  await client.execute('PRAGMA foreign_keys = ON')
  await applyMigrations(client)
  const db = drizzle(client, { schema })
  clients.set(db, client)
  return db
}

export function getDatabase(): Promise<Database> {
  defaultDatabase ??= openDatabase().catch((error: unknown) => {
    defaultDatabase = undefined
    throw error
  })
  return defaultDatabase
}

export async function closeDatabase(db: Database): Promise<void> {
  const client = clients.get(db)
  if (!client) return
  client.close()
  clients.delete(db)
}

export async function applyMigrations(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `)
  const applied = await client.execute('SELECT hash FROM __drizzle_migrations')
  const hashes = new Set(applied.rows.map((row) => String(row.hash)))
  for (const migration of MIGRATIONS) {
    if (hashes.has(migration.hash)) continue
    await client.executeMultiple(migration.sql)
    await client.execute({
      sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      args: [migration.hash, Date.now()],
    })
  }
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function ensureDirectory(path: string): void {
  if (!path || path === ':memory:') return
  if (isServerless()) {
    throw new Error(
      'Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project environment.',
    )
  }
  mkdirSync(dirname(path), { recursive: true })
}
