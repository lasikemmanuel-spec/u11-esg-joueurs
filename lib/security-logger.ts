import 'server-only'

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'login_blocked'
  | 'logout'
  | 'session_expired'
  | 'unauthorized_access'
  | 'account_created'
  | 'account_deleted'
  | 'account_modified'
  | 'password_changed'
  | 'contact_modified'
  | 'match_modified'
  | 'callup_saved'

export type SecurityEvent = {
  event: SecurityEventType
  username?: string
  ip: string
  userAgent?: string
  role?: string
  detail?: string
  timestamp: string
}

/**
 * Journalise un événement de sécurité dans la console (Vercel Logs).
 * Les logs Vercel sont conservés 30 jours et consultables depuis le dashboard.
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>) {
  const entry: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  }
  // Préfixe structuré pour faciliter le filtrage dans Vercel Logs
  const icon = {
    login_success: '✅',
    login_failure: '⚠️',
    login_blocked: '🚫',
    logout: '👋',
    session_expired: '⏰',
    unauthorized_access: '🔴',
    account_created: '➕',
    account_deleted: '🗑️',
    account_modified: '✏️',
    password_changed: '🔑',
    contact_modified: '📞',
    match_modified: '⚽',
    callup_saved: '📋',
  }[event.event] ?? '📋'

  console.log(
    `[SECURITY] ${icon} ${entry.event.toUpperCase()} | ${entry.timestamp} | ip=${entry.ip} | user=${entry.username ?? 'anonymous'} | role=${entry.role ?? '-'}${entry.detail ? ` | ${entry.detail}` : ''}`,
  )
}

/**
 * Extrait l'IP réelle depuis les headers Vercel/proxy.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Extrait le User-Agent de façon tronquée (max 120 chars).
 */
export function getUserAgent(request: Request): string {
  return (request.headers.get('user-agent') ?? 'unknown').slice(0, 120)
}

