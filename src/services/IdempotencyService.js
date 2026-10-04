/**
 * In-memory idempotency cache. In production this would be Redis with SETNX +
 * TTL — exactly the same semantics, just distributed across instances.
 *
 * The contract:
 *   - claim(hash) returns true on first call, false on every call after that
 *     (within the TTL window)
 *   - the operation is atomic — even if 100 threads call claim(hash) at the
 *     same instant, exactly one returns true
 *
 * This is what kills the "three bridges deliver simultaneously" problem.
 * Map.set with check is the Node.js equivalent of Redis SETNX.
 */
class IdempotencyService {
  constructor() {
    this.seen = new Map();
    this.ttlSeconds = 86400; // 24 hours default
    
    // Periodically evict expired entries
    setInterval(() => this.evictExpired(), 60000);
  }

  /**
   * Try to claim a hash. Returns true if this caller is the first; false if
   * someone else already claimed it (i.e. the packet is a duplicate).
   */
  claim(packetHash) {
    const now = Date.now();
    if (!this.seen.has(packetHash)) {
      this.seen.set(packetHash, now);
      return true;
    }
    return false;
  }

  size() {
    return this.seen.size;
  }

  /** Periodically evict entries past their TTL so the map doesn't grow forever. */
  evictExpired() {
    const cutoff = Date.now() - (this.ttlSeconds * 1000);
    for (const [hash, timestamp] of this.seen.entries()) {
      if (timestamp < cutoff) {
        this.seen.delete(hash);
      }
    }
  }

  /** Test/demo helper. */
  clear() {
    this.seen.clear();
  }
}

module.exports = new IdempotencyService();
