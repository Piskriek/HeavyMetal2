/**
 * T07 — collision cooldowns and cache management
 *
 * Tracks per-pair cooldowns to prevent repeated collision responses.
 * Uses a fixed-size map with automatic expiry to prevent unbounded growth.
 */

const COOLDOWN_DURATION = 0.38; // seconds
const MAX_CACHE_SIZE = 1000; // prevent unbounded growth
const CLEANUP_INTERVAL = 5.0; // seconds between cleanup passes

export class CollisionCooldown {
  private cooldowns = new Map<string, number>();
  private lastCleanup = 0;

  /**
   * Check if a pair is on cooldown.
   */
  isOnCooldown(a: number, b: number, currentTime: number): boolean {
    const key = this.pairKey(a, b);
    const expiry = this.cooldowns.get(key);
    return expiry !== undefined && currentTime < expiry;
  }

  /**
   * Set cooldown for a pair.
   */
  setCooldown(a: number, b: number, currentTime: number): void {
    const key = this.pairKey(a, b);
    this.cooldowns.set(key, currentTime + COOLDOWN_DURATION);

    // Periodic cleanup to prevent unbounded growth
    if (currentTime - this.lastCleanup > CLEANUP_INTERVAL) {
      this.cleanup(currentTime);
    }
  }

  /**
   * Remove expired entries to prevent unbounded cache growth.
   */
  private cleanup(currentTime: number): void {
    this.lastCleanup = currentTime;

    // If cache is small, just remove expired entries
    if (this.cooldowns.size < MAX_CACHE_SIZE * 0.8) {
      for (const [key, expiry] of this.cooldowns) {
        if (currentTime >= expiry) {
          this.cooldowns.delete(key);
        }
      }
      return;
    }

    // If cache is large, keep only the most recent entries
    const entries = Array.from(this.cooldowns.entries())
      .sort((a, b) => b[1] - a[1]) // sort by expiry time, newest first
      .slice(0, MAX_CACHE_SIZE * 0.5); // keep half

    this.cooldowns.clear();
    for (const [key, expiry] of entries) {
      if (currentTime < expiry) {
        this.cooldowns.set(key, expiry);
      }
    }
  }

  /**
   * Generate a stable pair key (smaller index first).
   */
  private pairKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  /**
   * Clear all cooldowns (for reset).
   */
  clear(): void {
    this.cooldowns.clear();
    this.lastCleanup = 0;
  }

  /**
   * Get stats for profiling. Triggers cleanup if needed.
   */
  getStats(currentTime = 0): { size: number; activeCooldowns: number } {
    // Trigger cleanup if enough time has passed
    if (currentTime - this.lastCleanup > CLEANUP_INTERVAL) {
      this.cleanup(currentTime);
    }
    return {
      size: this.cooldowns.size,
      activeCooldowns: this.cooldowns.size,
    };
  }
}
