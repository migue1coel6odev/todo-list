import cronstrue from 'cronstrue'

/** Human-readable description of a cron expression */
export function describeCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { verbose: false })
  } catch {
    return 'Invalid schedule'
  }
}

/** Returns true if the cron expression fires at the current minute */
export function matchesNow(expr: string): boolean {
  try {
    const parts = expr.trim().split(/\s+/)
    if (parts.length !== 5) return false
    const [minute, hour, dom, month, dow] = parts as [string, string, string, string, string]
    const now = new Date()
    return (
      matchField(minute, now.getMinutes()) &&
      matchField(hour,   now.getHours()) &&
      matchField(dom,    now.getDate()) &&
      matchField(month,  now.getMonth() + 1) &&
      matchField(dow,    now.getDay())
    )
  } catch {
    return false
  }
}

/** Returns true if the cron expression fires on the current day (ignores minute/hour) */
export function matchesToday(expr: string): boolean {
  try {
    const parts = expr.trim().split(/\s+/)
    if (parts.length !== 5) return false
    const [, , dom, month, dow] = parts as [string, string, string, string, string]
    const now = new Date()
    return (
      matchField(dom,   now.getDate()) &&
      matchField(month, now.getMonth() + 1) &&
      matchField(dow,   now.getDay())
    )
  } catch {
    return false
  }
}

/** Returns the next Date when the cron expression will fire (from now) */
export function nextOccurrence(expr: string): Date | null {
  try {
    const parts = expr.trim().split(/\s+/)
    if (parts.length !== 5) return null
    const [minuteF, hourF, domF, monthF, dowF] = parts as [string, string, string, string, string]

    const candidate = new Date()
    candidate.setSeconds(0, 0)
    candidate.setMinutes(candidate.getMinutes() + 1) // start one minute ahead

    // iterate minute-by-minute, up to ~1 year
    for (let i = 0; i < 527040; i++) {
      if (
        matchField(minuteF, candidate.getMinutes()) &&
        matchField(hourF,   candidate.getHours()) &&
        matchField(domF,    candidate.getDate()) &&
        matchField(monthF,  candidate.getMonth() + 1) &&
        matchField(dowF,    candidate.getDay())
      ) {
        return new Date(candidate)
      }
      candidate.setMinutes(candidate.getMinutes() + 1)
    }
    return null
  } catch {
    return null
  }
}

/** Human-readable time until the next cron occurrence, e.g. "in 2h 15m" */
export function timeUntilNext(expr: string): string | null {
  const next = nextOccurrence(expr)
  if (!next) return null

  const diffMins = Math.round((next.getTime() - Date.now()) / 60000)
  if (diffMins < 1)   return 'now'
  if (diffMins < 60)  return `in ${diffMins}m`

  const hours = Math.floor(diffMins / 60)
  const mins  = diffMins % 60
  if (hours < 24)     return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`

  const days  = Math.floor(hours / 24)
  const remH  = hours % 24
  if (days < 14)      return remH > 0 ? `in ${days}d ${remH}h` : `in ${days}d`
  return `in ${days}d`
}

export function isValidCron(expr: string): boolean {
  if (!expr.trim()) return false
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  try {
    cronstrue.toString(expr)
    return true
  } catch {
    return false
  }
}

function matchField(field: string, value: number): boolean {
  if (field === '*') return true
  if (field.startsWith('*/')) return value % parseInt(field.slice(2)) === 0
  if (field.includes(',')) return field.split(',').map(Number).includes(value)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number)
    return value >= start! && value <= end!
  }
  return parseInt(field) === value
}
