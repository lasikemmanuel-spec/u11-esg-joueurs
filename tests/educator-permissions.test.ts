import { describe, expect, it } from 'vitest'
import { hasEducatorAccess } from '@/lib/educator-permissions'

describe('hasEducatorAccess', () => {
  it.each([
    ['reader', false],
    ['educator', true],
    ['admin', true],
  ] as const)('returns %s access policy', (role, expected) => {
    expect(hasEducatorAccess({ role })).toBe(expected)
  })
})
