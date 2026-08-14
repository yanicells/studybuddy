import 'dotenv/config'

import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export { api }
export type { Id }

export function getConvex(): ConvexHttpClient {
  const url = process.env.CONVEX_URL?.trim()
  if (!url) throw new Error('Set CONVEX_URL in the environment.')
  return new ConvexHttpClient(url)
}

export function asId<Table extends keyof import('../../convex/_generated/dataModel').DataModel>(
  id: string,
): Id<Table> {
  return id as Id<Table>
}
