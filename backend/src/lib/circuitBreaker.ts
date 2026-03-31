// ============================================================================
// CourtAccess — Circuit Breaker Pattern (System Hardening)
// Prevents cascading failures when external services (Redis, DB, R2) go down.
// When a service fails repeatedly, the circuit "opens" and fast-fails requests
// instead of piling up timeouts that consume threads and memory.
//
// States:
//   CLOSED   → Normal operation, requests pass through
//   OPEN     → Service is down, fast-fail all requests
//   HALF_OPEN → Testing if service recovered (allow limited requests)
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number;
  /** Number of successful calls in HALF_OPEN before closing the circuit */
  halfOpenSuccessThreshold: number;
  /** Name for logging */
  name: string;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

// ---------------------------------------------------------------------------
// Circuit Breaker Implementation
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private halfOpenSuccesses = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = {
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      halfOpenSuccessThreshold: 3,
      ...config,
    };
  }

  /**
   * Execute an async operation through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed — transition to HALF_OPEN
      if (this.openedAt && Date.now() - this.openedAt >= this.config.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.config.name, this.config.resetTimeoutMs);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if a request should be allowed (non-throwing alternative to execute).
   */
  isAllowed(): boolean {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      return true;
    }
    // Check if we should transition to HALF_OPEN
    if (this.openedAt && Date.now() - this.openedAt >= this.config.resetTimeoutMs) {
      this.transitionTo('HALF_OPEN');
      return true;
    }
    return false;
  }

  /**
   * Record a success manually (for cases where execute() isn't used).
   */
  onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Record a failure manually (for cases where execute() isn't used).
   */
  onFailure(): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately reopens the circuit
      this.transitionTo('OPEN');
    } else if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Get current circuit breaker statistics.
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Get the current state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force the circuit to a specific state (for admin/testing).
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.openedAt = Date.now();
      this.halfOpenSuccesses = 0;
      console.error(
        `[CircuitBreaker:${this.config.name}] OPENED — ${this.consecutiveFailures} consecutive failures. ` +
        `Will retry in ${this.config.resetTimeoutMs}ms.`,
      );
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenSuccesses = 0;
      console.warn(`[CircuitBreaker:${this.config.name}] HALF_OPEN — testing recovery`);
    } else if (newState === 'CLOSED') {
      this.consecutiveFailures = 0;
      this.halfOpenSuccesses = 0;
      this.openedAt = null;
      if (oldState !== 'CLOSED') {
        console.log(`[CircuitBreaker:${this.config.name}] CLOSED — service recovered`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Custom Error
// ---------------------------------------------------------------------------

export class CircuitOpenError extends Error {
  public readonly serviceName: string;
  public readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(`Circuit breaker OPEN for ${serviceName}. Service is temporarily unavailable.`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.retryAfterMs = retryAfterMs;
  }
}

// ---------------------------------------------------------------------------
// Pre-configured Circuit Breakers for Core Services
// ---------------------------------------------------------------------------

export const circuitBreakers = {
  database: new CircuitBreaker({
    name: 'PostgreSQL',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    halfOpenSuccessThreshold: 3,
  }),
  redis: new CircuitBreaker({
    name: 'Redis',
    failureThreshold: 5,
    resetTimeoutMs: 15_000,
    halfOpenSuccessThreshold: 3,
  }),
  r2: new CircuitBreaker({
    name: 'CloudflareR2',
    failureThreshold: 3,
    resetTimeoutMs: 20_000,
    halfOpenSuccessThreshold: 2,
  }),
};

/**
 * Get health status for all circuit breakers.
 */
export function getCircuitBreakerHealth(): Record<string, CircuitBreakerStats> {
  return {
    database: circuitBreakers.database.getStats(),
    redis: circuitBreakers.redis.getStats(),
    r2: circuitBreakers.r2.getStats(),
  };
}
