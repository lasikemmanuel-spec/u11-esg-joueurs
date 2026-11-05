import { isValidElement, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
}))
vi.mock('@/lib/players', () => ({
  getRoster: vi.fn(),
  isDateSuspicious: vi.fn(() => false),
}))
vi.mock('@/lib/stats', () => ({
  getStats: vi.fn(),
}))
vi.mock('@/lib/convocations', () => ({
  getConvocations: vi.fn(),
}))
vi.mock('@/lib/match-results', () => ({
  getMatchResults: vi.fn(),
}))
vi.mock('@/lib/cohesion', () => ({
  getCohesionDays: vi.fn(),
}))
vi.mock('@/lib/training-attendance', () => ({
  getTrainingAttendance: vi.fn(),
}))
vi.mock('@/components/dashboard-tabs', () => ({
  DashboardTabs: () => null,
}))
vi.mock('@/components/data-quality-panel', () => ({
  DataQualityPanel: () => null,
}))
vi.mock('@/components/club-crest', () => ({
  ClubCrest: () => null,
}))
vi.mock('@/components/scroll-to-top-button', () => ({
  ScrollToTopButton: () => null,
}))

import Page from '@/app/page'
import { getEducatorSession } from '@/lib/educator-auth'
import { getRoster } from '@/lib/players'
import { getStats } from '@/lib/stats'
import { getConvocations } from '@/lib/convocations'
import { getMatchResults } from '@/lib/match-results'
import { getCohesionDays } from '@/lib/cohesion'
import { getTrainingAttendance } from '@/lib/training-attendance'
import { DashboardTabs } from '@/components/dashboard-tabs'
import { DataQualityPanel } from '@/components/data-quality-panel'

const roster = {
  club: 'ES Genech',
  title: 'Effectif',
  players: [{
    number: 7,
    firstName: 'Camille',
    lastName: 'Test',
    position: 'Milieu',
    transferStatus: null,
    licenseNumber: 'LICENCE-PRIVEE',
    birthDate: '01/01/2015',
    birthYear: 2015,
  }],
  fetchedAt: new Date(0).toISOString(),
}

function getDashboardProps(element: ReactElement) {
  const children = (element as ReactElement<{ children: ReactElement[] }>).props.children
  const dashboard = children.find((child) => child.type === DashboardTabs)
  if (!dashboard) throw new Error('DashboardTabs was not rendered.')
  return dashboard.props as Record<string, unknown>
}

describe('server-rendered dashboard data access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRoster).mockResolvedValue(roster)
    vi.mocked(getStats).mockResolvedValue({ players: [], teamTrainingRate: null })
    vi.mocked(getConvocations).mockResolvedValue({
      players: [],
      matchesPlayed: 0,
      matchDates: [],
      presentCounts: {},
    })
    vi.mocked(getMatchResults).mockResolvedValue({
      E1: [],
      E2: [],
      matchTypes: { E1: [], E2: [] },
      entries: [],
    })
    vi.mocked(getCohesionDays).mockResolvedValue([])
    vi.mocked(getTrainingAttendance).mockResolvedValue([])
  })

  it('does not load or transmit dashboard data without a session', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(null)

    const page = await Page()
    const props = getDashboardProps(page)

    expect(getRoster).not.toHaveBeenCalled()
    expect(getStats).not.toHaveBeenCalled()
    expect(getConvocations).not.toHaveBeenCalled()
    expect(getMatchResults).not.toHaveBeenCalled()
    expect(getCohesionDays).not.toHaveBeenCalled()
    expect(getTrainingAttendance).not.toHaveBeenCalled()
    expect(props.rosterPlayers).toEqual([])
    expect(props.players).toEqual([])
    expect(JSON.stringify(props)).not.toContain('LICENCE-PRIVEE')
  })

  it('passes only the fields needed by browser components after authentication', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'coach',
      displayName: 'Coach',
      role: 'educator',
    })

    const page = await Page()
    const props = getDashboardProps(page)
    const panel = props.children

    expect(props.rosterPlayers).toEqual([{
      number: 7,
      firstName: 'Camille',
      lastName: 'Test',
      position: 'Milieu',
      transferStatus: null,
    }])
    expect(JSON.stringify(props)).not.toContain('LICENCE-PRIVEE')
    expect(isValidElement(panel)).toBe(true)
    if (!isValidElement(panel) || panel.type !== DataQualityPanel) {
      throw new Error('Expected the data quality panel.')
    }
    expect(panel.props).toEqual({
      missingBirthDates: 0,
      suspiciousBirthDates: 0,
      noPosition: 0,
      noTransfer: 1,
    })
    expect(JSON.stringify(panel.props)).not.toContain('birthDate')
  })
})
