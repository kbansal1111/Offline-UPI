const crypto = require('crypto');
const models = require('../models');
const hybridCryptoService = require('../crypto/HybridCryptoService');
const serverKeyHolder = require('../crypto/ServerKeyHolder');

/**
 * Helper service that:
 *   - seeds demo accounts on startup
 *   - simulates "sender phone creates an encrypted packet" flow
 */
class DemoService {
  constructor() {
    this.Account = models.Account;
  }

  async seedAccounts() {
    const count = await this.Account.count();
    if (count === 0) {
      await this.Account.bulkCreate([
        { vpa: 'alice@demo', holderName: 'Alice', balance: '5000.00' },
        { vpa: 'bob@demo', holderName: 'Bob', balance: '1000.00' },
        { vpa: 'carol@demo', holderName: 'Carol', balance: '2500.00' },
        { vpa: 'dave@demo', holderName: 'Dave', balance: '500.00' }
      ]);
      console.log('Seeded 4 demo accounts');
    }
  }

  /**
   * Simulates the sender's phone:
   *   1. Build a PaymentInstruction with a fresh nonce + signedAt timestamp.
   *   2. Encrypt with the server's public key (hybrid RSA+AES).
   *   3. Wrap in a MeshPacket with TTL.
   *
   * In a real Android app, this exact code (minus the server-side reference)
   * would run on the phone. The phone would have already cached the server's
   * public key during a previous online session.
   */
  async createPacket(senderVpa, receiverVpa, amount, pin, ttl) {
    const instruction = {
      senderVpa,
      receiverVpa,
      amount,
      pinHash: this.sha256Hex(pin),
      nonce: crypto.randomUUID(),
      signedAt: Date.now()
    };

    const ciphertext = hybridCryptoService.encrypt(instruction, serverKeyHolder.getPublicKey());

    const packet = {
      packetId: crypto.randomUUID(),
      ttl: ttl || 5,
      createdAt: Date.now(),
      ciphertext
    };

    return packet;
  }

  sha256Hex(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}

module.exports = new DemoService();
