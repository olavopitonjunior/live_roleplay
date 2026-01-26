/**
 * Shared retry utility for Edge Functions
 *
 * Provides exponential backoff retry logic for API calls
 * to handle transient failures gracefully.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** HTTP status codes that should NOT be retried (default: 400-499 except 429) */
  nonRetryableStatuses?: number[];
  /** Optional callback for logging retry attempts */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  nonRetryableStatuses: [400, 401, 403, 404, 405, 422], // Don't retry client errors except 429
};

/**
 * Check if an error is retryable based on HTTP status
 */
function isRetryableError(error: unknown, nonRetryableStatuses: number[]): boolean {
  // Check if error has a status property (API errors usually do)
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    // Don't retry if status is in non-retryable list
    if (nonRetryableStatuses.includes(status)) {
      return false;
    }
    // Retry on 429 (rate limit) and 5xx (server errors)
    return status === 429 || status >= 500;
  }
  // For network errors or other exceptions, retry
  return true;
}

/**
 * Calculate delay with jitter to avoid thundering herd
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  // Exponential backoff
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add random jitter (0-25% of delay)
  const jitter = cappedDelay * Math.random() * 0.25;
  return Math.floor(cappedDelay + jitter);
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => anthropic.messages.create({ ... }),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    nonRetryableStatuses,
  } = { ...DEFAULT_OPTIONS, ...options };
  const { onRetry } = options;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt >= maxAttempts) {
        // No more retries, throw the error
        throw lastError;
      }

      if (!isRetryableError(error, nonRetryableStatuses)) {
        // Non-retryable error, throw immediately
        throw lastError;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);

      // Log retry attempt if callback provided
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper with pre-configured options
 *
 * @param options - Default retry options
 * @returns Function that wraps async functions with retry logic
 *
 * @example
 * ```typescript
 * const retryWithLogging = createRetryWrapper({
 *   maxAttempts: 5,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`)
 * });
 *
 * const result = await retryWithLogging(() => fetchData());
 * ```
 */
export function createRetryWrapper(options: RetryOptions = {}) {
  return <T>(fn: () => Promise<T>, overrideOptions: RetryOptions = {}): Promise<T> => {
    return withRetry(fn, { ...options, ...overrideOptions });
  };
}
