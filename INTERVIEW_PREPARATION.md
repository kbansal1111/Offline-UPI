# UPI Offline Mesh - Interview Preparation Guide

## Project Overview
This is a **Node.js/Express backend** that demonstrates offline UPI payments routed through a Bluetooth-style mesh network. The system allows users to send money without internet connectivity by encrypting payment packets that hop device-to-device until reaching a bridge node with connectivity.

---

## Key Technical Concepts (Must Know)

### 1. Hybrid Encryption (RSA-OAEP + AES-GCM)
**Why Hybrid?**
- RSA can only encrypt small data (~245 bytes for 2048-bit key)
- Payment instructions (JSON) can exceed this limit
- Solution: Encrypt JSON with AES-GCM, then encrypt just the AES key with RSA

**How it works:**
1. Generate fresh AES-256 key per packet
2. Encrypt payload with AES-256-GCM (authenticated encryption)
3. Encrypt AES key with RSA-OAEP using server's public key
4. Concatenate: `[256 bytes RSA-encrypted AES key][12 bytes IV][AES ciphertext + 16-byte tag]`

**Why AES-GCM?**
- Authenticated encryption: any tampering detected during decryption
- GCM tag verification prevents malicious intermediaries from modifying packets
- Same scheme used by TLS

### 2. Idempotency (Duplicate Prevention)
**Problem:** Multiple bridge nodes may deliver the same packet simultaneously
**Solution:** Atomic claim on ciphertext hash before processing

**Implementation:**
```javascript
// Map.set is atomic in Node.js
if (!seen.has(packetHash)) {
  seen.set(packetHash, now);
  return true; // First claimer
}
return false; // Duplicate
```

**Why hash ciphertext, not packetId?**
- PacketId can be rewritten by malicious intermediates
- Ciphertext is authenticated by GCM (tamper-proof)
- Same payment = same ciphertext = same hash

### 3. Replay Attack Prevention
**Two-layer defense:**
1. **Freshness check**: Reject packets older than 24 hours (signedAt field)
2. **Nonce**: Unique UUID per payment ensures different ciphertexts for legitimate duplicate payments

### 4. Mesh Network Simulation
**Gossip protocol:**
- Devices broadcast packets to nearby devices
- TTL (Time To Live) decrements per hop
- Bridge nodes (with internet) upload packets to backend

---

## Architecture Deep Dive

### System Flow
```
Sender Phone (offline)
  ↓ encrypt with server's public key
MeshPacket { packetId, ttl, createdAt, ciphertext }
  ↓ Bluetooth gossip
Multiple Intermediate Devices
  ↓ hop, decrement TTL
Bridge Node (with 4G)
  ↓ HTTPS POST
Backend /api/bridge/ingest
  ↓ [1] hash ciphertext
  ↓ [2] claim hash (idempotency)
  ↓ [3] decrypt with private key
  ↓ [4] freshness check
  ↓ [5] settle transaction
```

### Database Schema
**Accounts Table:**
- `vpa` (PK): Virtual Payment Address
- `holderName`: Account holder
- `balance`: Current balance
- `version`: Optimistic locking

**Transactions Table:**
- `id`: Auto-increment
- `packetHash` (UNIQUE): SHA-256 of ciphertext
- `senderVpa`, `receiverVpa`: Payment participants
- `amount`: Transaction amount
- `signedAt`, `settledAt`: Timestamps
- `bridgeNodeId`: Which node delivered it
- `hopCount`: Number of hops
- `status`: SETTLED/REJECTED

---

## Important Code Sections (Study These)

### 1. HybridCryptoService.js - Encryption
```javascript
encrypt(instruction, serverPublicKey) {
  // 1. Generate AES key
  const aesKey = crypto.randomBytes(32);
  
  // 2. AES-GCM encrypt
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  let encrypted = cipher.update(JSON.stringify(instruction), 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // 3. RSA encrypt AES key
  const encryptedAesKey = crypto.publicEncrypt({
    key: serverPublicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, aesKey);
  
  // 4. Pack: [RSA key][IV][ciphertext + tag]
  return Buffer.concat([encryptedAesKey, iv, Buffer.concat([encrypted, tag])]).toString('base64');
}
```

**Interview Question:** Why use OAEP padding?
**Answer:** OAEP (Optimal Asymmetric Encryption Padding) provides semantic security and prevents chosen-ciphertext attacks.

### 2. BridgeIngestionService.js - Pipeline
```javascript
async ingest(packet, bridgeNodeId, hopCount) {
  // Step 1: Hash ciphertext
  const packetHash = hybridCryptoService.hashCiphertext(packet.ciphertext);
  
  // Step 2: Idempotency gate
  if (!idempotencyService.claim(packetHash)) {
    return this.duplicate(packetHash);
  }
  
  // Step 3: Decrypt
  const instruction = hybridCryptoService.decrypt(packet.ciphertext);
  
  // Step 4: Freshness check
  const ageSeconds = (Date.now() - instruction.signedAt) / 1000;
  if (ageSeconds > 86400) return this.invalid(packetHash, 'stale_packet');
  
  // Step 5: Settle
  const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);
  return this.settled(packetHash, tx);
}
```

**Interview Question:** What happens if decryption fails?
**Answer:** Returns INVALID status - GCM tag verification catches tampering.

### 3. SettlementService.js - Transaction
```javascript
async settle(instruction, packetHash, bridgeNodeId, hopCount) {
  const transaction = await models.sequelize.transaction();
  
  try {
    // Fetch accounts
    const sender = await this.Account.findByPk(instruction.senderVpa, { transaction });
    const receiver = await this.Account.findByPk(instruction.receiverVpa, { transaction });
    
    // Check balance
    if (sender.balance < amount) {
      await this.recordRejected(instruction, packetHash, bridgeNodeId, hopCount, transaction);
      await transaction.commit();
      return null;
    }
    
    // Update balances
    sender.balance = (sender.balance - amount).toFixed(2);
    receiver.balance = (receiver.balance + amount).toFixed(2);
    
    await sender.save({ transaction });
    await receiver.save({ transaction });
    
    // Create transaction record
    const tx = await this.Transaction.create({
      packetHash, senderVpa, receiverVpa, amount,
      signedAt: new Date(instruction.signedAt),
      settledAt: new Date(),
      bridgeNodeId, hopCount,
      status: 'SETTLED'
    }, { transaction });
    
    await transaction.commit();
    return tx;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

**Interview Question:** Why use database transactions?
**Answer:** Ensures atomicity - either both debit and credit succeed, or neither does. Prevents data corruption.

### 4. IdempotencyService.js - Duplicate Prevention
```javascript
claim(packetHash) {
  const now = Date.now();
  if (!this.seen.has(packetHash)) {
    this.seen.set(packetHash, now);
    return true; // First claimer
  }
  return false; // Duplicate
}
```

**Interview Question:** How would you scale this for production?
**Answer:** Replace in-memory Map with Redis using `SET key NX EX 86400` for distributed idempotency.

---

## Common Interview Questions & Answers

### Q1: How does the system handle duplicate packets?
**A:** Uses idempotency via atomic hash claiming. First packet to claim hash processes; subsequent duplicates are dropped before decryption.

### Q2: What prevents attackers from tampering with packets?
**A:** AES-GCM authentication. Any bit-flip in ciphertext causes GCM tag verification to fail during decryption.

### Q3: Why use hybrid encryption instead of just RSA?
**A:** RSA has size limitations (~245 bytes for 2048-bit key). Hybrid allows encrypting arbitrarily large data by using RSA only for the symmetric key.

### Q4: How does the system detect replay attacks?
**A:** Two mechanisms: (1) Freshness check rejects packets older than 24 hours, (2) Nonce ensures legitimate duplicate payments have different ciphertexts.

### Q5: What happens if a bridge node goes offline mid-upload?
**A:** The idempotency cache holds the hash. When the node reconnects and retries, the packet is dropped as duplicate.

### Q6: How would you scale this for millions of users?
**A:** 
- Replace in-memory idempotency with Redis cluster
- Use PostgreSQL instead of SQLite
- Add horizontal scaling with load balancers
- Implement proper authentication for bridge nodes

### Q7: What's the purpose of the version field in Account?
**A:** Optimistic locking. Prevents lost updates when concurrent transactions modify the same account.

### Q8: Why use SQLite for the demo?
**A:** Zero setup, perfect for demos. Production would use PostgreSQL/MySQL with proper connection pooling.

### Q9: How does the mesh simulation work?
**A:** VirtualDevice class simulates phones. Gossip protocol copies packets between devices, decrementing TTL each hop. Bridge nodes (with internet) upload to backend.

### Q10: What's the difference between SETTLED and REJECTED status?
**A:** SETTLED: Successful transaction with balance transfer. REJECTED: Failed due to insufficient funds or other validation errors.

---

## Tech Stack Summary

### Backend
- **Node.js** (v16+) - Runtime
- **Express.js** - Web framework
- **Sequelize** - ORM for database operations
- **SQLite** - Database (demo), upgradable to PostgreSQL/MySQL

### Security
- **Node.js crypto module** - Cryptographic operations
- **RSA-OAEP** - Asymmetric encryption (2048-bit)
- **AES-256-GCM** - Symmetric encryption with authentication
- **SHA-256** - Hashing for idempotency

### Architecture Patterns
- **RESTful API** - HTTP endpoints
- **Service Layer Pattern** - Business logic separation
- **Repository Pattern** - Data access abstraction
- **Transaction Management** - Database consistency
- **Idempotency Pattern** - Duplicate prevention

### Development
- **JavaScript (ES6+)** - Language
- **npm** - Package management
- **Git** - Version control

---

## Key Talking Points for Interviews

1. **Security-First Design**: Implemented hybrid encryption following TLS patterns
2. **Scalability Considerations**: Designed idempotency to work with Redis in production
3. **Data Integrity**: Used database transactions and optimistic locking
4. **Real-World Problem**: Solved offline payment routing, relevant to fintech
5. **System Design**: Demonstrated understanding of distributed systems concepts
6. **Code Quality**: Clean architecture with separation of concerns

---

## Practice Scenarios

### Scenario 1: High Traffic
**Question:** What if 100 bridge nodes deliver the same packet simultaneously?
**Answer:** Idempotency service's atomic claim ensures only one processes. The other 99 return DUPLICATE_DROPPED before decryption.

### Scenario 2: Network Failure
**Question:** What if the backend crashes after claiming hash but before settlement?
**Answer:** Transaction rollback ensures no partial state. Packet hash remains in cache, so retry is dropped as duplicate.

### Scenario 3: Clock Skew
**Question:** What if device clocks are out of sync?
**Answer:** Added 5-minute tolerance for future-dated packets. Stale packets still rejected after 24 hours.

### Scenario 4: Malicious Bridge
**Question:** What if a bridge node modifies the ciphertext?
**Answer:** GCM tag verification fails during decryption, returning INVALID status.

---

## Advanced Topics (Bonus Points)

### 1. Rate Limiting
- Implement per-bridge-node rate limits
- Add velocity checks per sender

### 2. Monitoring
- Log all INVALID outcomes for security analysis
- Alert on duplicate spikes (potential attack)

### 3. Key Management
- Production: Use AWS KMS or HashiCorp Vault
- Demo: Keys generated on startup (not production-ready)

### 4. Compliance
- PCI-DSS considerations for payment systems
- Data encryption at rest
- Audit logging

---

## Code Walkthrough Checklist

Before your interview, be able to explain:
- [ ] How encryption works in `HybridCryptoService.js`
- [ ] The idempotency flow in `BridgeIngestionService.js`
- [ ] Transaction handling in `SettlementService.js`
- [ ] Mesh simulation in `MeshSimulatorService.js`
- [ ] API endpoints in `routes/api.js`
- [ ] Database models in `models/` directory

---

## Quick Reference: API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/server-key` | Get RSA public key |
| POST | `/api/demo/send` | Simulate payment creation |
| POST | `/api/mesh/gossip` | Run gossip round |
| POST | `/api/mesh/flush` | Bridge nodes upload |
| POST | `/api/mesh/reset` | Clear mesh state |
| POST | `/api/bridge/ingest` | Production endpoint |
| GET | `/api/accounts` | List accounts |
| GET | `/api/transactions` | List transactions |

---

## Final Tips

1. **Be specific** about your contributions - you built the entire Node.js version
2. **Explain trade-offs** - why SQLite vs PostgreSQL, why in-memory vs Redis
3. **Show enthusiasm** - this is a complex, real-world problem
4. **Connect to business value** - offline payments for rural areas, disaster scenarios
5. **Be honest** - this is a demo, mention what would change for production

Good luck with your interview! 🚀
