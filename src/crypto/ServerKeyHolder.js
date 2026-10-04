const crypto = require('crypto');

/**
 * Holds the server's RSA keypair.
 *
 * In production, the private key would live in an HSM (Hardware Security Module)
 * or at least a KMS like AWS KMS / HashiCorp Vault. NEVER in the JAR or source.
 *
 * For this demo we generate a fresh keypair on every startup. The public key is
 * exposed via /api/server-key so the (simulated) sender devices can use it to
 * encrypt payloads.
 */
class ServerKeyHolder {
  constructor() {
    this.keyPair = null;
    this.init();
  }

  init() {
    this.keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    const publicKeyBase64 = this.getPublicKeyBase64();
    console.log('Server RSA keypair generated (2048-bit). Public key fingerprint:', 
      publicKeyBase64.substring(0, 32) + '...');
  }

  getPublicKey() {
    return this.keyPair.publicKey;
  }

  getPrivateKey() {
    return this.keyPair.privateKey;
  }

  getPublicKeyBase64() {
    return this.keyPair.publicKey.toString('base64');
  }
}

module.exports = new ServerKeyHolder();
