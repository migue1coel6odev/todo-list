import cronstrue from 'cronstrue'

/** Human-readable description of a cron expression */
export function describeCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { verbose: false })
  } catch {
    return 'Invalid schedule'
  }
}

/** Returns true if the cron expression fires on the current day */
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
