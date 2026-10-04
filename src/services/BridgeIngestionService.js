const hybridCryptoService = require('../crypto/HybridCryptoService');
const idempotencyService = require('./IdempotencyService');
const settlementService = require('./SettlementService');

/**
 * Orchestrates the full server-side pipeline for one inbound packet from a
 * bridge node:
 *
 *   1. Hash the ciphertext.
 *   2. Try to claim that hash via the idempotency cache.
 *      - If already claimed: this is a duplicate. Drop it.
 *   3. Decrypt the ciphertext with the server's private key.
 *      - If decryption fails: tampered or junk. Reject.
 *   4. Check freshness — reject if signedAt is too old (replay protection).
 *   5. Hand off to SettlementService for the actual debit/credit.
 */
class BridgeIngestionService {
  constructor() {
    this.maxAgeSeconds = 86400; // 24 hours default
  }

  async ingest(packet, bridgeNodeId, hopCount) {
    try {
      const packetHash = hybridCryptoService.hashCiphertext(packet.ciphertext);

      // ---- Idempotency gate ----
      if (!idempotencyService.claim(packetHash)) {
        console.log(`DUPLICATE packet ${packetHash.substring(0, 12)}... from bridge ${bridgeNodeId} — dropped`);
        return this.duplicate(packetHash);
      }

      // ---- Decrypt ----
      let instruction;
      try {
        instruction = hybridCryptoService.decrypt(packet.ciphertext);
      } catch (e) {
        console.warn(`Decryption failed for packet ${packetHash.substring(0, 12)}...: ${e.message}`);
        return this.invalid(packetHash, 'decryption_failed');
      }

      // ---- Freshness check (replay protection) ----
      const ageSeconds = (Date.now() - instruction.signedAt) / 1000;
      if (ageSeconds > this.maxAgeSeconds) {
        console.warn(`Packet ${packetHash.substring(0, 12)}... too old (${ageSeconds}s), rejected`);
        return this.invalid(packetHash, 'stale_packet');
      }
      if (ageSeconds < -300) {
        // small clock-skew tolerance
        return this.invalid(packetHash, 'future_dated');
      }

      // ---- Settle ----
      const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);
      return this.settled(packetHash, tx);

    } catch (e) {
      console.error('Ingestion error:', e.message, e);
      return this.invalid('?', 'internal_error: ' + e.message);
    }
  }

  settled(hash, tx) {
    return {
      outcome: 'SETTLED',
      packetHash: hash,
      reason: null,
      transactionId: tx ? tx.id : null
    };
  }

  duplicate(hash) {
    return {
      outcome: 'DUPLICATE_DROPPED',
      packetHash: hash,
      reason: null,
      transactionId: null
    };
  }

  invalid(hash, reason) {
    return {
      outcome: 'INVALID',
      packetHash: hash,
      reason,
      transactionId: null
    };
  }
}

module.exports = new BridgeIngestionService();
