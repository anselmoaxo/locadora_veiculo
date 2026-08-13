type JsonRecord = Record<string, unknown>

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogClient {
  from(table: string): {
    insert(values: JsonRecord): PromiseLike<{ error: { message: string } | null }>
  }
}

export class Logger {
  constructor(
    private readonly functionName: string,
    private readonly requestId: string,
    private userId?: string,
    private readonly persistenceClient?: LogClient,
  ) {}

  setUserId(userId: string) {
    this.userId = userId
  }

  private format(level: LogLevel, message: string, metadata?: JsonRecord) {
    return {
      timestamp: new Date().toISOString(),
      level,
      function: this.functionName,
      request_id: this.requestId,
      user_id: this.userId,
      message,
      metadata: metadata ?? {},
    }
  }

  private write(level: LogLevel, message: string, metadata?: JsonRecord) {
    const entry = this.format(level, message, metadata)
    const serialized = JSON.stringify(entry)
    if (level === 'ERROR') console.error(serialized)
    else if (level === 'WARN') console.warn(serialized)
    else console.log(serialized)
  }

  debug(message: string, metadata?: JsonRecord) {
    this.write('DEBUG', message, metadata)
  }

  info(message: string, metadata?: JsonRecord) {
    this.write('INFO', message, metadata)
  }

  warn(message: string, metadata?: JsonRecord) {
    this.write('WARN', message, metadata)
  }

  error(message: string, metadata?: JsonRecord) {
    this.write('ERROR', message, metadata)
  }

  async persist(level: LogLevel, message: string, options: {
    errorCode?: string
    errorDetails?: JsonRecord
    metadata?: JsonRecord
  } = {}) {
    this.write(level, message, options.metadata)
    if (!this.persistenceClient) return

    const { error } = await this.persistenceClient.from('function_logs').insert({
      function_name: this.functionName,
      level,
      user_id: this.userId ?? null,
      request_id: this.requestId,
      message,
      error_code: options.errorCode ?? null,
      error_details: options.errorDetails ?? null,
      metadata: options.metadata ?? {},
    })

    if (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        function: this.functionName,
        request_id: this.requestId,
        message: 'Failed to persist structured log',
        metadata: { persistence_error: error.message },
      }))
    }
  }
}
