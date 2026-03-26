type LogLevel = 'info' | 'warn' | 'error'

function formatMessage(level: LogLevel, scope: string, message: string): string {
  return `[${level.toUpperCase()}][${scope}] ${message}`
}

export const logger = {
  info(scope: string, message: string): void {
    console.info(formatMessage('info', scope, message))
  },

  warn(scope: string, message: string): void {
    console.warn(formatMessage('warn', scope, message))
  },

  error(scope: string, message: string): void {
    console.error(formatMessage('error', scope, message))
  },
}