import crypto from 'node:crypto'

const WINDOW_SECONDS = 15 * 60
const MAX_ACCOUNT_ATTEMPTS = 5
const MAX_IP_ATTEMPTS = 15
const localAttempts = new Map<string, { count: number; resetAt: number }>()

type AttemptCounts = {
  account: number
  ip: number
}

const getCountsScript = `
local account = redis.call('GET', KEYS[1])
local ip = redis.call('GET', KEYS[2])
return { tonumber(account or '0'), tonumber(ip or '0') }
`

const recordFailureScript = `
local account = redis.call('INCR', KEYS[1])
if account == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ip = redis.call('INCR', KEYS[2])
if ip == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
return { account, ip }
`

const clearAccountScript = `
redis.call('DEL', KEYS[1])
return { 0, 0 }
`

function hashKey(value: string) {
  const key = process.env.UPSTASH_REDIS_REST_TOKEN || 'u11-local-login-rate-limit'
  return crypto.createHmac('sha256', key).update(value).digest('hex')
}

function localKey(scope: string, value: string) {
  return `login:${scope}:${hashKey(value)}`
}

function getLocalCount(key: string, now: number) {
  const entry = localAttempts.get(key)
  if (!entry || entry.resetAt <= now) {
    localAttempts.delete(key)
    return 0
  }
  return entry.count
}

function updateLocalCount(key: string, now: number) {
  const count = getLocalCount(key, now)
  if (localAttempts.size >= 5000 && !localAttempts.has(key)) {
    for (const [trackedKey, entry] of localAttempts) {
      if (entry.resetAt <= now) localAttempts.delete(trackedKey)
    }
    if (localAttempts.size >= 5000) {
      const oldestKey = localAttempts.keys().next().value
      if (oldestKey) localAttempts.delete(oldestKey)
    }
  }
  localAttempts.set(key, {
    count: count + 1,
    resetAt: localAttempts.get(key)?.resetAt ?? now + WINDOW_SECONDS * 1000,
  })
}

function getUpstashPipelineUrl() {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!endpoint || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont requis en production.')
  }

  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('UPSTASH_REDIS_REST_URL doit être une URL HTTPS valide.')
  }
  return { url: `${url.origin}${url.pathname.replace(/\/+$/, '')}/pipeline`, token }
}

async function executeScript(
  script: string,
  keys: string[],
  args: string[] = [],
): Promise<AttemptCounts> {
  const { url, token } = getUpstashPipelineUrl()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['EVAL', script, String(keys.length), ...keys, ...args]]),
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Upstash rate-limit request failed (${response.status}).`)

  const payload: unknown = await response.json()
  if (!Array.isArray(payload) || payload.length !== 1 || !payload[0] || typeof payload[0] !== 'object') {
    throw new Error('Upstash returned an invalid rate-limit response.')
  }
  const result = (payload[0] as { result?: unknown; error?: unknown }).result
  const error = (payload[0] as { result?: unknown; error?: unknown }).error
  if (error || !Array.isArray(result) || result.length !== 2) {
    throw new Error('Upstash returned an invalid rate-limit result.')
  }
  const [account, ip] = result.map((count) => count === null ? 0 : Number(count))
  if (!Number.isSafeInteger(account) || !Number.isSafeInteger(ip)) {
    throw new Error('Upstash returned invalid rate-limit counters.')
  }
  return { account, ip }
}

function getKeys(request: Request, username: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
  const account = username.trim().toLocaleLowerCase('fr-FR')
  return {
    account: `u11:login:account:${hashKey(account)}`,
    ip: `u11:login:ip:${hashKey(ip)}`,
    localAccount: localKey('account', account),
    localIp: localKey('ip', ip),
  }
}

export async function getLoginAttemptCounts(request: Request, username: string) {
  const keys = getKeys(request, username)
  if (process.env.NODE_ENV !== 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
    const now = Date.now()
    return {
      account: getLocalCount(keys.localAccount, now),
      ip: getLocalCount(keys.localIp, now),
    }
  }
  return executeScript(getCountsScript, [keys.account, keys.ip])
}

export async function recordLoginFailure(request: Request, username: string) {
  const keys = getKeys(request, username)
  if (process.env.NODE_ENV !== 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
    const now = Date.now()
    updateLocalCount(keys.localAccount, now)
    updateLocalCount(keys.localIp, now)
    return {
      account: getLocalCount(keys.localAccount, now),
      ip: getLocalCount(keys.localIp, now),
    }
  }
  return executeScript(recordFailureScript, [keys.account, keys.ip], [String(WINDOW_SECONDS)])
}

export async function clearLoginAccountAttempts(username: string) {
  const account = username.trim().toLocaleLowerCase('fr-FR')
  if (process.env.NODE_ENV !== 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
    localAttempts.delete(localKey('account', account))
    return
  }
  await executeScript(clearAccountScript, [`u11:login:account:${hashKey(account)}`])
}

export function isLoginAttemptLimitReached(counts: AttemptCounts) {
  return counts.account >= MAX_ACCOUNT_ATTEMPTS || counts.ip >= MAX_IP_ATTEMPTS
}
