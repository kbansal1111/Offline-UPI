# Low-Level Design (LLD) - UPI Offline Mesh System

## 1. Class Diagrams & Component Design

### 1.1 Service Layer Classes

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ServerKeyHolder                                │
├─────────────────────────────────────────────────────────────────────┤
│ - keyPair: KeyPair                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ + init(): void                                                      │
│ + getPublicKey(): PublicKey                                         │
│ + getPrivateKey(): PrivateKey                                       │
│ + getPublicKeyBase64(): string                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    HybridCryptoService                              │
├─────────────────────────────────────────────────────────────────────┤
│ - RSA_ENCRYPTED_KEY_BYTES: 256                                      │
│ - GCM_IV_BYTES: 12                                                  │
│ - GCM_TAG_BITS: 128                                                 │
│ - AES_KEY_BITS: 256                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ + encrypt(instruction, publicKey): string                            │
│ + decrypt(base64Ciphertext): PaymentInstruction                     │
│ + hashCiphertext(base64Ciphertext): string                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ used by
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BridgeIngestionService                            │
├─────────────────────────────────────────────────────────────────────┤
│ - maxAgeSeconds: 86400                                              │
├─────────────────────────────────────────────────────────────────────┤
│ + ingest(packet, bridgeNodeId, hopCount): IngestResult             │
│ - settled(hash, tx): IngestResult                                   │
│ - duplicate(hash): IngestResult                                     │
│ - invalid(hash, reason): IngestResult                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    IdempotencyService                               │
├─────────────────────────────────────────────────────────────────────┤
│ - seen: Map<string, timestamp>                                       │
│ - ttlSeconds: 86400                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ + claim(packetHash): boolean                                        │
│ + size(): number                                                     │
│ - evictExpired(): void                                               │
│ + clear(): void                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SettlementService                                │
├─────────────────────────────────────────────────────────────────────┤
│ - Account: Account model                                            │
│ - Transaction: Transaction model                                    │
├─────────────────────────────────────────────────────────────────────┤
│ + settle(instruction, packetHash, bridgeNodeId, hopCount): Transaction│
│ - recordRejected(instruction, packetHash, bridgeNodeId, hopCount, tx): void│
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Model Classes

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Account                                     │
├─────────────────────────────────────────────────────────────────────┤
│ - vpa: string (PK)                                                  │
│ - holderName: string                                                │
│ - balance: decimal(19,2)                                           │
│ - version: bigint (optimistic locking)                              │
├─────────────────────────────────────────────────────────────────────┤
│ + getVpa(): string                                                  │
│ + setVpa(vpa: string): void                                         │
│ + getHolderName(): string                                           │
│ + setHolderName(name: string): void                                 │
│ + getBalance(): decimal                                             │
│ + setBalance(balance: decimal): void                                │
│ + getVersion(): bigint                                              │
│ + setVersion(version: bigint): void                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       Transaction                                   │
├─────────────────────────────────────────────────────────────────────┤
│ - id: bigint (PK, auto-increment)                                   │
│ - packetHash: string(64) (UNIQUE)                                   │
│ - senderVpa: string                                                 │
│ - receiverVpa: string                                               │
│ - amount: decimal(19,2)                                             │
│ - signedAt: date                                                    │
│ - settledAt: date                                                   │
│ - bridgeNodeId: string                                             │
│ - hopCount: integer                                                 │
│ - status: enum('SETTLED', 'REJECTED')                                │
├─────────────────────────────────────────────────────────────────────┤
│ + getId(): bigint                                                   │
│ + setId(id: bigint): void                                           │
│ + getPacketHash(): string                                           │
│ + setPacketHash(hash: string): void                                 │
│ + getSenderVpa(): string                                            │
│ + setSenderVpa(vpa: string): void                                   │
│ + getReceiverVpa(): string                                          │
│ + setReceiverVpa(vpa: string): void                                 │
│ + getAmount(): decimal                                              │
│ + setAmount(amount: decimal): void                                  │
│ + getSignedAt(): date                                               │
│ + setSignedAt(date: date): void                                     │
│ + getSettledAt(): date                                              │
│ + setSettledAt(date: date): void                                    │
│ + getBridgeNodeId(): string                                         │
│ + setBridgeNodeId(id: string): void                                  │
│ + getHopCount(): integer                                            │
│ + setHopCount(count: integer): void                                  │
│ + getStatus(): string                                               │
│ + setStatus(status: string): void                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Transfer Objects

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MeshPacket                                     │
├─────────────────────────────────────────────────────────────────────┤
│ - packetId: string (UUID)                                           │
│ - ttl: integer                                                      │
│ - createdAt: number (epoch millis)                                  │
│ - ciphertext: string (base64)                                       │
├─────────────────────────────────────────────────────────────────────┤
│ + getPacketId(): string                                            │
│ + setPacketId(id: string): void                                     │
│ + getTtl(): integer                                                 │
│ + setTtl(ttl: integer): void                                        │
│ + getCreatedAt(): number                                            │
│ + setCreatedAt(time: number): void                                  │
│ + getCiphertext(): string                                          │
│ + setCiphertext(text: string): void                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   PaymentInstruction                                │
├─────────────────────────────────────────────────────────────────────┤
│ - senderVpa: string                                                 │
│ - receiverVpa: string                                               │
│ - amount: decimal                                                   │
│ - pinHash: string                                                   │
│ - nonce: string (UUID)                                              │
│ - signedAt: number (epoch millis)                                  │
├─────────────────────────────────────────────────────────────────────┤
│ + getSenderVpa(): string                                            │
│ + setSenderVpa(vpa: string): void                                   │
│ + getReceiverVpa(): string                                          │
│ + setReceiverVpa(vpa: string): void                                 │
│ + getAmount(): decimal                                              │
│ + setAmount(amount: decimal): void                                  │
│ + getPinHash(): string                                              │
│ + setPinHash(hash: string): void                                    │
│ + getNonce(): string                                                │
│ + setNonce(nonce: string): void                                     │
│ + getSignedAt(): number                                             │
│ + setSignedAt(time: number): void                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     IngestResult                                     │
├─────────────────────────────────────────────────────────────────────┤
│ - outcome: string ('SETTLED', 'DUPLICATE_DROPPED', 'INVALID')       │
│ - packetHash: string                                                │
│ - reason: string (nullable)                                         │
│ - transactionId: number (nullable)                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 Accounts Table

```sql
CREATE TABLE accounts (
    vpa VARCHAR(255) PRIMARY KEY,
    holder_name VARCHAR(255) NOT NULL,
    balance DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    version BIGINT
);

-- Indexes
-- PRIMARY KEY on vpa

-- Sample Data
INSERT INTO accounts (vpa, holder_name, balance, version) VALUES
('alice@demo', 'Alice', 5000.00, NULL),
('bob@demo', 'Bob', 1000.00, NULL),
('carol@demo', 'Carol', 2500.00, NULL),
('dave@demo', 'Dave', 500.00, NULL);
```

### 2.2 Transactions Table

```sql
CREATE TABLE transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    packet_hash VARCHAR(64) NOT NULL UNIQUE,
    sender_vpa VARCHAR(255) NOT NULL,
    receiver_vpa VARCHAR(255) NOT NULL,
    amount DECIMAL(19, 2) NOT NULL,
    signed_at DATETIME NOT NULL,
    settled_at DATETIME NOT NULL,
    bridge_node_id VARCHAR(255) NOT NULL,
    hop_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SETTLED', 'REJECTED'))
);

-- Indexes
CREATE UNIQUE INDEX idx_packet_hash ON transactions(packet_hash);
CREATE INDEX idx_settled_at ON transactions(settled_at DESC);

-- Foreign Keys (optional, for referential integrity)
-- ALTER TABLE transactions ADD FOREIGN KEY (sender_vpa) REFERENCES accounts(vpa);
-- ALTER TABLE transactions ADD FOREIGN KEY (receiver_vpa) REFERENCES accounts(vpa);
```

### 2.3 Entity Relationships

```
┌──────────────┐         ┌──────────────┐
│   Accounts   │         │ Transactions │
├──────────────┤         ├──────────────┤
│ vpa (PK)     │◄────────│ sender_vpa   │
│ holder_name  │         │ receiver_vpa │
│ balance      │         │ amount       │
│ version      │         │ status       │
└──────────────┘         └──────────────┘
```

---

## 3. API Specifications

### 3.1 GET /api/server-key

**Purpose**: Get server's RSA public key for encryption

**Request**: None

**Response**:
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  "algorithm": "RSA-2048 / OAEP-SHA256",
  "hybridScheme": "RSA-OAEP encrypts an AES-256-GCM session key"
}
```

**Status Codes**: 200 OK

---

### 3.2 POST /api/demo/send

**Purpose**: Simulate sender phone creating and injecting payment packet

**Request Body**:
```json
{
  "senderVpa": "alice@demo",
  "receiverVpa": "bob@demo",
  "amount": 500,
  "pin": "1234",
  "ttl": 5,
  "startDevice": "phone-alice"
}
```

**Response**:
```json
{
  "packetId": "550e8400-e29b-41d4-a716-446655440000",
  "ciphertextPreview": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  "ttl": 5,
  "injectedAt": "phone-alice"
}
```

**Status Codes**: 200 OK, 500 Internal Server Error

---

### 3.3 POST /api/mesh/gossip

**Purpose**: Run one round of gossip across mesh devices

**Request**: None

**Response**:
```json
{
  "transfers": 4,
  "deviceCounts": {
    "phone-alice": 1,
    "phone-stranger1": 1,
    "phone-stranger2": 1,
    "phone-stranger3": 1,
    "phone-bridge": 1
  }
}
```

**Status Codes**: 200 OK

---

### 3.4 POST /api/mesh/flush

**Purpose**: Bridge nodes upload packets to backend

**Request**: None

**Response**:
```json
{
  "uploadsAttempted": 1,
  "results": [
    {
      "bridgeNode": "phone-bridge",
      "packetId": "550e8400",
      "outcome": "SETTLED",
      "reason": "",
      "transactionId": 1
    }
  ]
}
```

**Status Codes**: 200 OK, 500 Internal Server Error

---

### 3.5 POST /api/mesh/reset

**Purpose**: Clear mesh state and idempotency cache

**Request**: None

**Response**:
```json
{
  "status": "mesh and idempotency cache cleared"
}
```

**Status Codes**: 200 OK

---

### 3.6 POST /api/bridge/ingest

**Purpose**: Production endpoint for bridge nodes to upload packets

**Headers**:
- `X-Bridge-Node-Id`: Identifier of bridge node
- `X-Hop-Count`: Number of hops packet traveled

**Request Body**:
```json
{
  "packetId": "550e8400-e29b-41d4-a716-446655440000",
  "ttl": 2,
  "createdAt": 1730000000000,
  "ciphertext": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
}
```

**Response (SETTLED)**:
```json
{
  "outcome": "SETTLED",
  "packetHash": "a3f8c9d5e2b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4",
  "reason": null,
  "transactionId": 1
}
```

**Response (DUPLICATE_DROPPED)**:
```json
{
  "outcome": "DUPLICATE_DROPPED",
  "packetHash": "a3f8c9d5e2b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4",
  "reason": null,
  "transactionId": null
}
```

**Response (INVALID)**:
```json
{
  "outcome": "INVALID",
  "packetHash": "a3f8c9d5e2b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4",
  "reason": "decryption_failed",
  "transactionId": null
}
```

**Status Codes**: 200 OK, 500 Internal Server Error

---

### 3.7 GET /api/accounts

**Purpose**: List all accounts and balances

**Request**: None

**Response**:
```json
[
  {
    "vpa": "alice@demo",
    "holderName": "Alice",
    "balance": "4500.00",
    "version": 1
  },
  {
    "vpa": "bob@demo",
    "holderName": "Bob",
    "balance": "1500.00",
    "version": 1
  }
]
```

**Status Codes**: 200 OK, 500 Internal Server Error

---

### 3.8 GET /api/transactions

**Purpose**: List last 20 transactions

**Request**: None

**Response**:
```json
[
  {
    "id": 1,
    "packetHash": "a3f8c9d5e2b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4",
    "senderVpa": "alice@demo",
    "receiverVpa": "bob@demo",
    "amount": "500.00",
    "signedAt": "2024-09-06T14:30:00.000Z",
    "settledAt": "2024-09-06T14:30:05.000Z",
    "bridgeNodeId": "phone-bridge",
    "hopCount": 3,
    "status": "SETTLED"
  }
]
```

**Status Codes**: 200 OK, 500 Internal Server Error

---

## 4. Algorithms & Data Structures

### 4.1 Hybrid Encryption Algorithm

```
ALGORITHM: HybridEncrypt(instruction, publicKey)
INPUT: PaymentInstruction instruction, PublicKey publicKey
OUTPUT: string base64Ciphertext

1. plaintext = JSON.stringify(instruction)
2. aesKey = generateRandomBytes(32)  // AES-256 key
3. iv = generateRandomBytes(12)      // GCM IV
4. cipher = createCipheriv('aes-256-gcm', aesKey, iv)
5. encrypted = cipher.update(plaintext, 'utf8')
6. encrypted = encrypted + cipher.final()
7. tag = cipher.getAuthTag()
8. aesCiphertext = encrypted + tag
9. encryptedAesKey = publicEncrypt({
       key: publicKey,
       padding: RSA_PKCS1_OAEP_PADDING,
       oaepHash: 'sha256'
   }, aesKey)
10. buffer = encryptedAesKey + iv + aesCiphertext
11. return buffer.toString('base64')
```

**Time Complexity**: O(n) where n is plaintext size
**Space Complexity**: O(n) for ciphertext

---

### 4.2 Hybrid Decryption Algorithm

```
ALGORITHM: HybridDecrypt(base64Ciphertext)
INPUT: string base64Ciphertext
OUTPUT: PaymentInstruction instruction

1. all = base64Decode(base64Ciphertext)
2. IF all.length < 256 + 12 + 16 THEN
       THROW "Ciphertext too short"
3. encryptedAesKey = all[0:256]
4. iv = all[256:268]
5. aesCiphertext = all[268:]
6. ciphertext = aesCiphertext[0:-16]
7. tag = aesCiphertext[-16:]
8. aesKeyBytes = privateDecrypt({
       key: privateKey,
       padding: RSA_PKCS1_OAEP_PADDING,
       oaepHash: 'sha256'
   }, encryptedAesKey)
9. decipher = createDecipheriv('aes-256-gcm', aesKeyBytes, iv)
10. decipher.setAuthTag(tag)
11. decrypted = decipher.update(ciphertext)
12. decrypted = decrypted + decipher.final()
13. return JSON.parse(decrypted.toString('utf8'))
```

**Time Complexity**: O(n) where n is ciphertext size
**Space Complexity**: O(n) for plaintext

---

### 4.3 Idempotency Claim Algorithm

```
ALGORITHM: Claim(packetHash)
INPUT: string packetHash
OUTPUT: boolean isFirstClaimer

1. now = Date.now()
2. IF seen.has(packetHash) THEN
       RETURN false  // Duplicate
3. seen.set(packetHash, now)
4. RETURN true  // First claimer
```

**Time Complexity**: O(1) hash map lookup
**Space Complexity**: O(1) per entry

---

### 4.4 Gossip Algorithm

```
ALGORITHM: GossipOnce()
INPUT: None
OUTPUT: {transfers: int, deviceCounts: Map}

1. transfers = 0
2. deviceList = Array.from(devices.values())
3. snapshot = new Map()
4. FOR each device IN deviceList:
       snapshot.set(device.deviceId, [...device.getHeldPackets()])
5. FOR each src IN deviceList:
       FOR each pkt IN snapshot.get(src.deviceId):
           IF pkt.ttl <= 0 THEN CONTINUE
           FOR each dst IN deviceList:
               IF dst === src THEN CONTINUE
               IF dst.holds(pkt.packetId) THEN CONTINUE
               copy = {
                   packetId: pkt.packetId,
                   ttl: pkt.ttl - 1,
                   createdAt: pkt.createdAt,
                   ciphertext: pkt.ciphertext
               }
               dst.hold(copy)
               transfers++
6. RETURN {transfers, snapshotMap()}
```

**Time Complexity**: O(d * p * d) where d = devices, p = packets
**Space Complexity**: O(d * p) for snapshot

---

### 4.5 Settlement Algorithm

```
ALGORITHM: Settle(instruction, packetHash, bridgeNodeId, hopCount)
INPUT: PaymentInstruction, string, string, int
OUTPUT: Transaction or null

1. transaction = BEGIN_TRANSACTION()
2. TRY:
3.    sender = Account.findByPk(instruction.senderVpa, {transaction})
4.    IF sender == null THEN
5.        THROW "Unknown sender VPA"
6.    receiver = Account.findByPk(instruction.receiverVpa, {transaction})
7.    IF receiver == null THEN
8.        THROW "Unknown receiver VPA"
9.    amount = parseFloat(instruction.amount)
10.   IF amount <= 0 THEN
11.       THROW "Amount must be positive"
12.   IF sender.balance < amount THEN
13.       recordRejected(instruction, packetHash, bridgeNodeId, hopCount, transaction)
14.       COMMIT(transaction)
15.       RETURN null
16.   sender.balance = (sender.balance - amount).toFixed(2)
17.   receiver.balance = (receiver.balance + amount).toFixed(2)
18.   sender.save({transaction})
19.   receiver.save({transaction})
20.   tx = Transaction.create({
           packetHash, senderVpa, receiverVpa, amount,
           signedAt: new Date(instruction.signedAt),
           settledAt: new Date(),
           bridgeNodeId, hopCount,
           status: 'SETTLED'
       }, {transaction})
21.   COMMIT(transaction)
22.   RETURN tx
23. CATCH error:
24.   ROLLBACK(transaction)
25.   THROW error
```

**Time Complexity**: O(1) database operations
**Space Complexity**: O(1) transaction state

---

## 5. Error Handling

### 5.1 Error Hierarchy

```
Error
├── ValidationError
│   ├── InvalidAmountError
│   ├── InvalidVPAError
│   └── InvalidPacketError
├── CryptographyError
│   ├── DecryptionError
│   ├── EncryptionError
│   └── TamperDetectedError
├── BusinessError
│   ├── InsufficientBalanceError
│   ├── DuplicatePacketError
│   └── StalePacketError
└── SystemError
    ├── DatabaseError
    ├── NetworkError
    └── InternalError
```

### 5.2 Error Response Format

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Account alice@demo has insufficient balance",
    "details": {
      "available": 100.00,
      "required": 500.00
    }
  }
}
```

### 5.3 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| DECRYPTION_FAILED | 400 | Ciphertext tampered or invalid |
| STALE_PACKET | 400 | Packet older than 24 hours |
| FUTURE_DATED | 400 | Packet timestamp in future |
| INSUFFICIENT_BALANCE | 400 | Sender lacks funds |
| DUPLICATE_PACKET | 200 | Already processed (idempotency) |
| UNKNOWN_VPA | 404 | Account not found |
| INTERNAL_ERROR | 500 | Unexpected system error |

---

## 6. Transaction Management

### 6.1 Transaction Isolation Levels

**Current**: READ COMMITTED (Sequelize default)
**Production Consideration**: SERIALIZABLE for financial transactions

### 6.2 Transaction Flow

```
BEGIN TRANSACTION
├── Fetch sender account (FOR UPDATE)
├── Fetch receiver account (FOR UPDATE)
├── Validate balance
├── Update sender balance
├── Update receiver balance
├── Insert transaction record
├── COMMIT
└── OR ROLLBACK on error
```

### 6.3 Optimistic Locking

```javascript
// Version field on Account
UPDATE accounts 
SET balance = new_balance, version = version + 1
WHERE vpa = 'alice@demo' AND version = old_version

// If 0 rows affected, concurrent modification detected
```

---

## 7. Data Structures

### 7.1 Idempotency Cache

```javascript
// In-memory Map (demo)
const seen = new Map<string, timestamp>();

// Structure:
// Key: SHA-256 hash of ciphertext (64 hex chars)
// Value: Timestamp when first claimed

// Example:
seen.set("a3f8c9d5e2b1f4a6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4", 1725623400000);
```

### 7.2 Mesh Device Map

```javascript
// Device registry
const devices = new Map<string, VirtualDevice>();

// Structure:
// Key: Device ID (e.g., "phone-alice")
// Value: VirtualDevice instance

// VirtualDevice:
{
  deviceId: string,
  hasInternet: boolean,
  heldPackets: Map<packetId, MeshPacket>
}
```

### 7.3 Packet Structure

```javascript
// MeshPacket
{
  packetId: string,        // UUID
  ttl: number,             // Hops remaining
  createdAt: number,       // Epoch millis
  ciphertext: string       // Base64 encoded
}

// PaymentInstruction (decrypted)
{
  senderVpa: string,
  receiverVpa: string,
  amount: number,
  pinHash: string,
  nonce: string,          // UUID
  signedAt: number         // Epoch millis
}
```

---

## 8. Configuration

### 8.1 Application Configuration

```javascript
// Environment variables
{
  PORT: 8080,
  NODE_ENV: 'development',
  
  // Database
  DB_DIALECT: 'sqlite',
  DB_STORAGE: './upimesh.db',
  
  // Security
  IDEMPOTENCY_TTL_SECONDS: 86400,
  PACKET_MAX_AGE_SECONDS: 86400,
  
  // Logging
  LOG_LEVEL: 'info'
}
```

### 8.2 Cryptographic Constants

```javascript
const CRYPTO_CONFIG = {
  RSA_KEY_SIZE: 2048,
  RSA_PADDING: 'RSA_PKCS1_OAEP_PADDING',
  RSA_HASH: 'sha256',
  
  AES_KEY_SIZE: 256,
  AES_MODE: 'aes-256-gcm',
  
  GCM_IV_SIZE: 12,
  GCM_TAG_SIZE: 16,
  GCM_TAG_BITS: 128,
  
  HASH_ALGORITHM: 'sha256'
};
```

---

## 9. Sequence Diagrams

### 9.1 Payment Creation Sequence

```
Sender Phone    DemoService    CryptoService    ServerKeyHolder
    │                │                │                  │
    │────────────────│ createPacket() │                  │
    │                │────────────────►                  │
    │                │                │ getPublicKey()   │
    │                │                │─────────────────►│
    │                │                │◄─────────────────│
    │                │                │                  │
    │                │                │ encrypt()        │
    │                │                │─────────────────►│
    │                │                │◄─────────────────│
    │                │◄────────────────│                  │
    │◄───────────────│                │                  │
```

### 9.2 Packet Processing Sequence

```
Bridge Node    IngestionService    Idempotency    CryptoService    SettlementService
     │                   │                  │                  │                    │
     │ POST /ingest      │                  │                  │                    │
     │──────────────────►│                  │                  │                    │
     │                   │ hashCiphertext() │                  │                    │
     │                   │─────────────────►│                  │                    │
     │                   │◄─────────────────│                  │                    │
     │                   │                  │                  │                    │
     │                   │ claim(hash)      │                  │                    │
     │                   │─────────────────►│                  │                    │
     │                   │◄─────────────────│                  │                    │
     │                   │                  │                  │                    │
     │                   │ decrypt()        │                  │                    │
     │                   │───────────────────────────────────►│                    │
     │                   │◄───────────────────────────────────│                    │
     │                   │                  │                  │                    │
     │                   │ settle()        │                  │                    │
     │                   │──────────────────────────────────────────────────────►│
     │                   │◄──────────────────────────────────────────────────────│
     │                   │                  │                  │                    │
     │◄──────────────────│                  │                  │                    │
```

---

## 10. Performance Considerations

### 10.1 Time Complexity Analysis

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Hash computation | O(n) | n = ciphertext length |
| Idempotency check | O(1) | Hash map lookup |
| Encryption | O(n) | n = plaintext size |
| Decryption | O(n) | n = ciphertext size |
| Gossip round | O(d²p) | d = devices, p = packets |
| Settlement | O(1) | Fixed DB operations |

### 10.2 Space Complexity Analysis

| Component | Complexity | Notes |
|-----------|------------|-------|
| Idempotency cache | O(h) | h = unique hashes |
| Device registry | O(d) | d = devices |
| Packet storage | O(dp) | d = devices, p = packets |
| Ciphertext | O(n) | n = packet size |

### 10.3 Optimization Strategies

1. **Idempotency Cache**: Use Redis with TTL for automatic eviction
2. **Database**: Add connection pooling, read replicas
3. **Encryption**: Cache RSA key operations (key generation is expensive)
4. **Gossip**: Limit gossip rounds, implement smart routing
5. **API**: Implement response caching for non-mutating endpoints

---

## 11. Security Implementation Details

### 11.1 Key Generation

```javascript
// RSA Key Pair Generation
const keyPair = crypto.generateKeyPairSync('rsa', {
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
```

### 11.2 Encryption Parameters

```javascript
// RSA-OAEP Parameters
const rsaOptions = {
  key: publicKey,
  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: 'sha256'
};

// AES-GCM Parameters
const aesOptions = {
  key: aesKey,
  iv: iv,
  authTagLength: 16
};
```

### 11.3 Hash Computation

```javascript
// SHA-256 Hash
const hash = crypto.createHash('sha256')
  .update(base64Ciphertext)
  .digest('hex');
```

---

## 12. Testing Strategy

### 12.1 Unit Tests (To Be Implemented)

```javascript
// CryptoService Tests
describe('HybridCryptoService', () => {
  it('should encrypt and decrypt correctly', () => {
    const instruction = { /* test data */ };
    const ciphertext = cryptoService.encrypt(instruction, publicKey);
    const decrypted = cryptoService.decrypt(ciphertext);
    assert.deepEqual(decrypted, instruction);
  });
  
  it('should reject tampered ciphertext', () => {
    const ciphertext = cryptoService.encrypt(instruction, publicKey);
    const tampered = tamperCiphertext(ciphertext);
    assert.throws(() => cryptoService.decrypt(tampered));
  });
});

// IdempotencyService Tests
describe('IdempotencyService', () => {
  it('should allow first claim', () => {
    assert.isTrue(idempotencyService.claim('hash1'));
  });
  
  it('should reject duplicate claims', () => {
    idempotencyService.claim('hash2');
    assert.isFalse(idempotencyService.claim('hash2'));
  });
});
```

### 12.2 Integration Tests (To Be Implemented)

```javascript
describe('API Integration', () => {
  it('should process payment end-to-end', async () => {
    const response = await request(app)
      .post('/api/demo/send')
      .send({ /* payment data */ });
    assert.equal(response.status, 200);
  });
});
```

### 12.3 Load Testing (To Be Implemented)

- Simulate 1000 concurrent bridge uploads
- Measure response time under load
- Test idempotency under high concurrency

---

## 13. Deployment Checklist

### 13.1 Pre-Deployment

- [ ] Update environment variables
- [ ] Configure production database
- [ ] Set up Redis for idempotency
- [ ] Configure SSL/TLS certificates
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Implement authentication for bridge nodes

### 13.2 Post-Deployment

- [ ] Verify database connectivity
- [ ] Test encryption/decryption
- [ ] Verify idempotency cache
- [ ] Monitor API response times
- [ ] Check error rates
- [ ] Validate transaction settlement

---

## 14. Maintenance & Operations

### 14.1 Regular Tasks

- **Daily**: Monitor error logs, check cache size
- **Weekly**: Review transaction volumes, check for anomalies
- **Monthly**: Rotate encryption keys (if using KMS), audit access logs

### 14.2 Backup Strategy

- **Database**: Daily backups with point-in-time recovery
- **Configuration**: Version control for all config files
- **Keys**: Secure backup of private keys (if not using KMS)

### 14.3 Monitoring Metrics

- API response times (p50, p95, p99)
- Transaction success/failure rates
- Idempotency cache hit rate
- Database query performance
- Encryption/decryption latency
- Error rates by type

---

## 15. Troubleshooting Guide

### 15.1 Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| High duplicate rate | Many DUPLICATE_DROPPED | Check bridge node logic, verify clock sync |
| Decryption failures | INVALID outcomes | Verify key management, check for tampering |
| Slow response times | High latency | Check database performance, add caching |
| Database locks | Transaction timeouts | Optimize queries, add connection pooling |

### 15.2 Debug Commands

```bash
# Check cache size
curl http://localhost:8080/api/mesh/state

# Test encryption
curl -X POST http://localhost:8080/api/demo/send -d '{"senderVpa":"alice@demo","receiverVpa":"bob@demo","amount":500,"pin":"1234"}'

# View transactions
curl http://localhost:8080/api/transactions
```

---

This LLD document provides the detailed technical specifications needed for implementation, testing, and maintenance of the UPI Offline Mesh system. Use this in conjunction with the HLD for complete system design understanding during interviews.
