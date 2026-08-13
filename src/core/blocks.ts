export type ContentBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }

const BULLET = /^[-*]\s+(.*)$/

export function stripBullet(line: string): string {
  return line.replace(BULLET, '$1').trim()
}

export function contentBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const bullet = line.match(BULLET)
    if (bullet) {
      const item = bullet[1]!.trim()
      if (!item) continue
      const last = blocks.at(-1)
      if (last?.kind === 'ul') last.items.push(item)
      else blocks.push({ kind: 'ul', items: [item] })
    } else {
      blocks.push({ kind: 'p', text: line })
    }
  }
  return blocks
}

export function backBlocks(text: string): ContentBlock[] {
  const blocks = contentBlocks(text)
  if (blocks.length === 0) return []
  if (blocks.every((block): block is { kind: 'p'; text: string } => block.kind === 'p')) {
    return [{ kind: 'ul', items: blocks.map((block) => block.text) }]
  }
  return blocks
}

export function withBulletPrefix(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => (BULLET.test(line.trim()) ? line.trim() : `- ${line.trim()}`))
    .join('\n')
}
