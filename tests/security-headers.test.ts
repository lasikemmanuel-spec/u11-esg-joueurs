import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config.mjs'

describe('application security headers', () => {
  it('sets baseline browser security headers on every route', async () => {
    const headerRules = nextConfig.headers
    if (!headerRules) throw new Error('Next.js security headers are not configured.')
    const rules = await headerRules()
    const headers = new Map(rules[0].headers.map(({ key, value }) => [key, value]))

    expect(rules[0].source).toBe('/:path*')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=63072000')
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none')

    const csp = headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
  })
})
