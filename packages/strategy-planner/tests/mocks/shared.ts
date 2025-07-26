// Mock for @promptdial/shared
export const createLogger = (name: string) => ({
  info: (message: string, data?: any) => console.log(`[${name}] INFO:`, message, data),
  error: (message: string, error?: Error, data?: any) => console.error(`[${name}] ERROR:`, message, error, data),
  warn: (message: string, data?: any) => console.warn(`[${name}] WARN:`, message, data),
  debug: (message: string, data?: any) => console.debug(`[${name}] DEBUG:`, message, data)
});