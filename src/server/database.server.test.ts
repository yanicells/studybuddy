import { afterEach, describe, expect, it } from 'vitest'

import { resolveConnection } from './database.server'

const KEYS = ['VERCEL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'STUDYBUDDY_DB_PATH'] as const

describe('database connection', () => {
  const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))

  afterEach(() => {
    for (const key of KEYS) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('uses Turso when both url and token are set', () => {
    process.env.TURSO_DATABASE_URL = 'libsql://studybuddy.example.turso.io'
    process.env.TURSO_AUTH_TOKEN = 'token'
    delete process.env.VERCEL
    expect(resolveConnection()).toEqual({
      url: 'libsql://studybuddy.example.turso.io',
      authToken: 'token',
    })
  })

  it('does not create a local sqlite file on vercel', () => {
    process.env.VERCEL = '1'
    delete process.env.TURSO_DATABASE_URL
    delete process.env.TURSO_AUTH_TOKEN
    expect(() => resolveConnection()).toThrow(/TURSO_AUTH_TOKEN/)
  })
})
