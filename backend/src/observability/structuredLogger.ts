// ============================================================================
// PR 6 — Observability Layer: Structured Logger
//
// Wraps console.log/warn/error with structured JSON output for
// production log aggregation (CloudWatch, Datadog, ELK, etc.).
//
// Every log line includes:
//   - timestamp (ISO 8601)
//   - level (info | warn | error | debug)
//   - service name
//   - correlationId (for request tracing)
//   - component (which module emitted the log)
//   - message
//   - optional structured data
//
// Usage:
//   import { logger } from './observability/structuredLogger.ts';
//   logger.info('worker', 'Job completed', { jobId: '123', durationMs: 450 });
//   logger.error('graph', 'Query failed', { error: err.message, tenantId });
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  component: string;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

export interface LoggerConfig {
  /** Service name included in every log line */
  service: string;
  /** Minimum log level to emit (default: 'info') */
  minLevel: LogLevel;
  /** If true, output JSON; if false, output human-readable (default: true in production) */
  jsonOutput: boolean;
}

// ---------------------------------------------------------------------------
// Level Priority
// ---------------------------------------------------------------------------

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Correlation ID (AsyncLocalStorage for request tracing)
// ---------------------------------------------------------------------------

let currentCorrelationId: string | undefined;

export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export function getCorrelationId(): string | undefined {
  return currentCorrelationId;
}

export function clearCorrelationId(): void {
  currentCorrelationId = undefined;
}

// ---------------------------------------------------------------------------
// Structured Logger
// ---------------------------------------------------------------------------

export class StructuredLogger {
  private readonly config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      service: 'court-access-backend',
      minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
      jsonOutput: process.env.NODE_ENV === 'production',
      ...config,
    };
  }

  // =========================================================================
  // Log Methods
  // =========================================================================

  debug(component: string, message: string, data?: Record<string, unknown>): void {
    this.emit('debug', component, message, data);
  }

  info(component: string, message: string, data?: Record<string, unknown>): void {
    this.emit('info', component, message, data);
  }

  warn(component: string, message: string, data?: Record<string, unknown>): void {
    this.emit('warn', component, message, data);
  }

  error(component: string, message: string, data?: Record<string, unknown>): void {
    this.emit('error', component, message, data);
  }

  // =========================================================================
  // Core Emit
  // =========================================================================

  private emit(
    level: LogLevel,
    component: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    // Skip if below minimum level
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      component,
      message,
    };

    if (currentCorrelationId) {
      entry.correlationId = currentCorrelationId;
    }

    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }

    if (this.config.jsonOutput) {
      this.emitJSON(level, entry);
    } else {
      this.emitHumanReadable(level, entry);
    }
  }

  private emitJSON(level: LogLevel, entry: LogEntry): void {
    const line = JSON.stringify(entry);
    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }

  private emitHumanReadable(level: LogLevel, entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase().padEnd(5)}] [${entry.component}]`;
    const corr = entry.correlationId ? ` (${entry.correlationId})` : '';
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    const line = `${prefix}${corr} ${entry.message}${dataStr}`;

    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  getConfig(): Readonly<LoggerConfig> {
    return this.config;
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

export const logger = new StructuredLogger();
