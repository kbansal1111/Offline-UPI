const crypto = require('crypto');
const serverKeyHolder = require('./ServerKeyHolder');

/**
 * Hybrid encryption — the same pattern used by TLS, PGP, Signal, etc.
 *
 * Why hybrid? RSA can only encrypt small data (~245 bytes for a 2048-bit key).
 * Our payment instruction (JSON) might be ~300 bytes, and in real use we might
 * include device certificates and signatures pushing it well over.
 *
 * Solution: generate a fresh AES key per packet, encrypt the JSON with AES-GCM
 * (fast + authenticated), then encrypt JUST the AES key with RSA-OAEP.
 *
 * Wire format (after base64 encoding):
 *   [ 256 bytes RSA-encrypted AES key ][ 12 bytes GCM IV ][ ciphertext + 16-byte tag ]
 *
 * AES-GCM is authenticated encryption: any single-bit tampering with the ciphertext
 * causes decryption to fail with an exception. This is what makes it safe for
 * untrusted intermediates to hold.
 */
class HybridCryptoService {
  constructor() {
    this.RSA_ENCRYPTED_KEY_BYTES = 256; // for 2048-bit RSA
    this.GCM_IV_BYTES = 12;
    this.GCM_TAG_BITS = 128;
    this.AES_KEY_BITS = 256;
  }

  /**
   * Encrypt a payment instruction with the server's public key.
   * Called by the simulated sender device.
   */
  encrypt(instruction, serverPublicKey) {
    const plaintext = JSON.stringify(instruction);

    // 1. Generate a one-time AES key for this packet.
    const aesKey = crypto.randomBytes(this.AES_KEY_BITS / 8);

    // 2. AES-GCM encrypt the payload.
    const iv = crypto.randomBytes(this.GCM_IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    const aesCiphertext = Buffer.concat([encrypted, tag]);

    // 3. RSA-OAEP encrypt the AES key with the server's public key.
    const encryptedAesKey = crypto.publicEncrypt(
      {
        key: serverPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      aesKey
    );

    // 4. Pack: [encrypted AES key][IV][AES ciphertext + tag]
    const buf = Buffer.concat([encryptedAesKey, iv, aesCiphertext]);

    return buf.toString('base64');
  }

  /**
   * Decrypt with the server's private key.
   * If anything has been tampered with — wrong key, modified ciphertext,
   * truncated input — this throws.
   */
  decrypt(base64Ciphertext) {
    const all = Buffer.from(base64Ciphertext, 'base64');

    if (all.length < this.RSA_ENCRYPTED_KEY_BYTES + this.GCM_IV_BYTES + this.GCM_TAG_BITS / 8) {
      throw new Error('Ciphertext too short');
    }

    // Unpack
    const encryptedAesKey = all.subarray(0, this.RSA_ENCRYPTED_KEY_BYTES);
    const iv = all.subarray(this.RSA_ENCRYPTED_KEY_BYTES, this.RSA_ENCRYPTED_KEY_BYTES + this.GCM_IV_BYTES);
    const aesCiphertext = all.subarray(this.RSA_ENCRYPTED_KEY_BYTES + this.GCM_IV_BYTES);

    // 1. RSA-decrypt the AES key.
    const aesKeyBytes = crypto.privateDecrypt(
      {
        key: serverKeyHolder.getPrivateKey(),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedAesKey
    );

    // 2. AES-GCM decrypt + verify the tag.
    // Split ciphertext and tag (tag is last 16 bytes)
    const ciphertext = aesCiphertext.subarray(0, aesCiphertext.length - 16);
    const tag = aesCiphertext.subarray(aesCiphertext.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBytes, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * SHA-256 of the ciphertext. THIS is the idempotency key.
   *
   * Why ciphertext and not packetId? Because intermediates can rewrite packetId
   * but cannot forge a valid ciphertext for a different payload. Two delivered
   * copies of the same packet have identical ciphertexts, hence identical hashes.
   */
  hashCiphertext(base64Ciphertext) {
    return crypto.createHash('sha256').update(base64Ciphertext).digest('hex');
  }
}

module.exports = new HybridCryptoService();
