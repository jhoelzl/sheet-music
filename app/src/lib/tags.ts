export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 24

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_TAG_LENGTH).trim()
}
