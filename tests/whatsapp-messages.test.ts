import { describe, expect, it } from 'vitest'
import {
  buildKitList,
  buildWhatsAppLink,
  DEFAULT_WHATSAPP_GROUPS,
  DEFAULT_WHATSAPP_TEMPLATES,
  replaceMessageVariables,
} from '@/lib/whatsapp-messages'

describe('whatsapp-messages', () => {
  it('replaces all variables in message template correctly', () => {
    const template = 'Bonjour,\nMatch de {equipe} contre {adversaire} le {date}.\nJoueurs :\n{convoques}'
    const context = {
      teamName: 'ES Genech 1',
      opponent: 'Cysoing',
      dateLabel: 'samedi 14 novembre',
      calledPlayerNames: ['Léo Dupont', 'Tom Martin'],
    }
    const result = replaceMessageVariables(template, context)
    expect(result).toContain('Match de ES Genech 1 contre Cysoing le samedi 14 novembre.')
    expect(result).toContain('• Léo Dupont\n• Tom Martin')
  })

  it('includes warm gear in kit list when temperature is low (< 10°C)', () => {
    const normal = buildKitList(15)
    expect(normal).not.toContain('Gants')

    const cold = buildKitList(5)
    expect(cold).toContain('Gants')
  })

  it('provides default groups and templates', () => {
    expect(DEFAULT_WHATSAPP_GROUPS.length).toBeGreaterThanOrEqual(4)
    expect(DEFAULT_WHATSAPP_TEMPLATES.length).toBeGreaterThanOrEqual(4)
    expect(DEFAULT_WHATSAPP_GROUPS.some((g) => g.id === 'grp-e1')).toBe(true)
    expect(DEFAULT_WHATSAPP_GROUPS.some((g) => g.id === 'grp-e2')).toBe(true)
  })

  it('builds a valid WhatsApp sharing URL', () => {
    const link = buildWhatsAppLink('Hello WhatsApp!')
    expect(link).toContain('https://')
    expect(link).toContain('Hello%20WhatsApp!')
  })
})
