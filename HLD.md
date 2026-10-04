# High-Level Design (HLD) - UPI Offline Mesh System

## 1. System Overview

The UPI Offline Mesh System is a distributed payment processing backend that enables offline financial transactions through a mesh network of mobile devices. The system allows users to send money without internet connectivity by encrypting payment packets that hop device-to-device until reaching a bridge node with connectivity.

### 1.1 Business Problem
- **Challenge**: Process UPI payments in connectivity-constrained environments (rural areas, basements, disaster zones)
- **Solution**: Mesh network routing with encrypted payment packets
- **Key Features**: End-to-end encryption, duplicate prevention, replay attack protection, offline-to-online transaction settlement

### 1.2 System Goals
- **Security**: Military-grade encryption for payment data
- **Reliability**: Idempotency to handle duplicate packet delivery
- **Scalability**: Design for production with horizontal scaling capability
- **Performance**: Fast duplicate detection and parallel processing

---

## 2. High-Level Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Sender Phone │  │  Stranger 1  │  │  Stranger 2  │  │ Bridge Node  │  │
│  │   (Offline)  │  │   (Offline)  │  │   (Offline)  │  │   (Online)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                 │                 │            │
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                           Bluetooth Mesh Network                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            │ HTTPS POST
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Express.js Server                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │ API Routes   │  │ Middleware   │  │ Error Handler │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │ Bridge Ingestion │  │  Settlement      │  │  Mesh Simulator  │         │
│  │     Service      │  │     Service     │  │      Service     │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Idempotency     │  │  Demo Service    │  │  Crypto Service  │         │
│  │     Service      │  │                  │  │                  │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Database (SQLite/PostgreSQL)                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │  Accounts    │  │ Transactions │  │   (Indexes)  │              │  │
│  │  │    Table     │  │    Table     │  │              │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    In-Memory Cache (Map/Redis)                        │  │
│  │                    Idempotency Cache                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

#### Client Layer
- **Sender Phone**: Creates encrypted payment packets
- **Intermediate Devices**: Forward packets via Bluetooth gossip
- **Bridge Node**: Uploads packets to backend when internet available

#### API Gateway Layer
- **Express.js Server**: HTTP request handling
- **API Routes**: RESTful endpoint definitions
- **Middleware**: Request validation, error handling
- **Static Files**: Serve dashboard HTML

#### Service Layer
- **Bridge Ingestion Service**: Orchestrates packet processing pipeline
- **Settlement Service**: Handles transaction settlement with DB transactions
- **Mesh Simulator Service**: Simulates Bluetooth mesh network
- **Idempotency Service**: Prevents duplicate processing
- **Demo Service**: Seeds data and simulates sender phone
- **Crypto Service**: Handles encryption/decryption operations

#### Data Layer
- **Database**: Persistent storage for accounts and transactions
- **In-Memory Cache**: Fast duplicate detection (Map for demo, Redis for production)

---

## 3. Data Flow

### 3.1 Payment Creation Flow

```
1. Sender Phone (Offline)
   ↓
2. Create PaymentInstruction
   - senderVpa, receiverVpa, amount
   - nonce (UUID), signedAt (timestamp)
   - pinHash (SHA-256 of PIN)
   ↓
3. HybridCryptoService.encrypt()
   - Generate AES-256 key
   - AES-GCM encrypt instruction
   - RSA-OAEP encrypt AES key
   - Pack: [RSA key][IV][ciphertext + tag]
   ↓
4. Create MeshPacket
   - packetId (UUID)
   - ttl (hops remaining)
   - createdAt (timestamp)
   - ciphertext (base64 encoded)
   ↓
5. Inject into Mesh
   - Hand to sender's virtual device
```

### 3.2 Mesh Gossip Flow

```
1. Gossip Round Initiated
   ↓
2. For each device with packets:
   - Broadcast to all nearby devices
   - Decrement TTL
   - Skip if TTL = 0
   ↓
3. Receiver devices:
   - Accept if not already holding
   - Store packet
   ↓
4. Repeat for multiple rounds
   ↓
5. Bridge nodes (with internet):
   - Collect all held packets
   - Upload to backend
```

### 3.3 Backend Processing Flow

```
1. Bridge Node POSTs to /api/bridge/ingest
   ↓
2. BridgeIngestionService.ingest()
   ↓
3. Step 1: Hash Ciphertext
   - SHA-256 of base64 ciphertext
   ↓
4. Step 2: Idempotency Check
   - Try to claim hash in cache
   - If already claimed → DUPLICATE_DROPPED
   ↓
5. Step 3: Decrypt
   - HybridCryptoService.decrypt()
   - RSA-OAEP decrypt AES key
   - AES-GCM decrypt payload
   - Verify GCM tag (tamper detection)
   - If fails → INVALID
   ↓
6. Step 4: Freshness Check
   - Check signedAt within 24 hours
   - Check not future-dated (> 5 min tolerance)
   - If stale → INVALID
   ↓
7. Step 5: Settlement
   - SettlementService.settle()
   - Begin DB transaction
   - Fetch sender/receiver accounts
   - Check sufficient balance
   - Debit sender, credit receiver
   - Create transaction record
   - Commit transaction
   ↓
8. Return Result
   - SETTLED, DUPLICATE_DROPPED, or INVALID
```

---

## 4. Security Architecture

### 4.1 Encryption Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: Application                      │
│  PaymentInstruction (JSON)                                   │
│  - senderVpa, receiverVpa, amount                           │
│  - nonce, signedAt, pinHash                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ encrypt with AES-256-GCM
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: Symmetric                         │
│  AES-256 Encrypted Payload                                   │
│  - Ciphertext + GCM Tag (authentication)                     │
│  - IV (Initialization Vector)                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ encrypt with RSA-OAEP
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 3: Asymmetric                       │
│  RSA-2048 Encrypted AES Key                                  │
│  - Only server can decrypt with private key                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ concatenate
┌─────────────────────────────────────────────────────────────┐
│                    FINAL PACKET                              │
│  [256 bytes RSA key][12 bytes IV][ciphertext + 16 byte tag] │
│  Base64 encoded for transport                                │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Security Measures

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Encryption | RSA-OAEP + AES-GCM | Confidentiality & Integrity |
| Authentication | GCM Tag | Tamper detection |
| Idempotency | Hash claiming | Duplicate prevention |
| Replay Protection | Freshness check + Nonce | Replay attack prevention |
| Access Control | (Future) Mutual TLS | Bridge node authentication |
| Rate Limiting | (Future) Per-node limits | DoS prevention |

---

## 5. Scalability Considerations

### 5.1 Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                             │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Instance 1 │    │   Instance 2 │    │   Instance 3 │
│   (Node.js)  │    │   (Node.js)  │    │   (Node.js)  │
└──────────────┘    └──────────────┘    └──────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     Redis        │
                    │   (Idempotency)  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   (Database)     │
                    └──────────────────┘
```

### 5.2 Scaling Strategy

| Component | Current (Demo) | Production |
|-----------|----------------|------------|
| Database | SQLite (single file) | PostgreSQL (replicated) |
| Idempotency Cache | In-memory Map | Redis Cluster |
| Application | Single instance | Multiple instances + LB |
| Key Management | Generated on startup | AWS KMS / HashiCorp Vault |
| Monitoring | Console logs | SIEM + Alerts |

---

## 6. Technology Stack

### 6.1 Backend Stack
- **Runtime**: Node.js v16+
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)
- **Package Manager**: npm

### 6.2 Data Layer
- **ORM**: Sequelize
- **Database**: SQLite (demo), PostgreSQL (production)
- **Cache**: In-memory Map (demo), Redis (production)

### 6.3 Security
- **Crypto**: Node.js built-in crypto module
- **Asymmetric**: RSA-2048 with OAEP-SHA256
- **Symmetric**: AES-256-GCM
- **Hashing**: SHA-256

### 6.4 Architecture Patterns
- **API Design**: RESTful
- **Layering**: Service Layer Pattern
- **Data Access**: Repository Pattern
- **Transactions**: ACID-compliant

---

## 7. Non-Functional Requirements

### 7.1 Performance
- **Response Time**: < 100ms for API endpoints
- **Throughput**: 1000+ transactions/second (with scaling)
- **Duplicate Detection**: O(1) hash lookup

### 7.2 Reliability
- **Idempotency**: 100% duplicate prevention
- **Data Consistency**: ACID transactions
- **Error Recovery**: Transaction rollback on failures

### 7.3 Security
- **Encryption**: Military-grade (RSA-2048 + AES-256)
- **Integrity**: GCM authentication
- **Confidentiality**: End-to-end encryption

### 7.4 Scalability
- **Horizontal Scaling**: Stateless application instances
- **Vertical Scaling**: Database connection pooling
- **Cache Layer**: Redis for distributed idempotency

### 7.5 Maintainability
- **Code Organization**: Layered architecture
- **Documentation**: Comprehensive README and code comments
- **Testing**: Manual testing framework (expandable to automated)

---

## 8. Deployment Architecture

### 8.1 Current (Demo) Deployment

```
Development Machine
├── Node.js Application
├── SQLite Database (upimesh.db)
└── In-Memory Cache
```

### 8.2 Production Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Infrastructure                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Load Balancer (AWS ALB)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ EC2 Instance │    │ EC2 Instance │    │ EC2 Instance │ │
│  │   (Node.js)  │    │   (Node.js)  │    │   (Node.js)  │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│         ┌────────────────────┼────────────────────┐         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Redis      │    │ PostgreSQL   │    │ AWS KMS      │ │
│  │   Cluster    │    │   (RDS)      │    │   (Keys)      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. API Overview

### 9.1 Public APIs

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/server-key` | Get RSA public key | None |
| POST | `/api/demo/send` | Simulate payment creation | None |
| POST | `/api/mesh/gossip` | Run gossip round | None |
| POST | `/api/mesh/flush` | Bridge upload simulation | None |
| POST | `/api/mesh/reset` | Reset mesh state | None |
| POST | `/api/bridge/ingest` | Production endpoint | Mutual TLS |
| GET | `/api/accounts` | List accounts | None |
| GET | `/api/transactions` | List transactions | None |

### 9.2 Internal APIs (Service Layer)

- `HybridCryptoService.encrypt()` - Encrypt payment instruction
- `HybridCryptoService.decrypt()` - Decrypt ciphertext
- `HybridCryptoService.hashCiphertext()` - Generate hash
- `IdempotencyService.claim()` - Claim hash
- `SettlementService.settle()` - Process transaction
- `MeshSimulatorService.gossipOnce()` - Run gossip
- `BridgeIngestionService.ingest()` - Process packet

---

## 10. Monitoring & Observability

### 10.1 Logging Strategy
- **Application Logs**: Console logs (demo), Structured logs (production)
- **Security Events**: INVALID outcomes, duplicate spikes
- **Performance Metrics**: Response times, throughput

### 10.2 Monitoring Points
- API endpoint response times
- Idempotency cache hit rate
- Database query performance
- Encryption/decryption latency
- Transaction success/failure rates

### 10.3 Alerting (Production)
- High INVALID rate (potential attack)
- Database connection failures
- Redis cache failures
- High latency on critical endpoints

---

## 11. Failure Scenarios & Handling

### 11.1 Network Failure
- **Scenario**: Bridge node loses connection mid-upload
- **Handling**: Transaction rollback, retry on reconnect (dropped as duplicate)

### 11.2 Database Failure
- **Scenario**: Database connection lost during settlement
- **Handling**: Transaction rollback, return error to client

### 11.3 Concurrent Duplicates
- **Scenario**: 100 bridge nodes deliver same packet simultaneously
- **Handling**: Idempotency ensures only one processes, rest dropped

### 11.4 Tampered Packet
- **Scenario**: Malicious node modifies ciphertext
- **Handling**: GCM tag verification fails, return INVALID

### 11.5 Stale Packet
- **Scenario**: Attacker replays old packet
- **Handling**: Freshness check rejects (older than 24 hours)

---

## 12. Future Enhancements

### 12.1 Security
- Mutual TLS for bridge node authentication
- Rate limiting per bridge node
- Per-sender velocity checks
- HSM integration for key management

### 12.2 Scalability
- Redis cluster for distributed idempotency
- Database read replicas
- Connection pooling
- Horizontal auto-scaling

### 12.3 Features
- Real-time transaction status updates
- Webhook notifications
- Admin dashboard
- Audit logging
- Compliance reporting

### 12.4 Testing
- Unit tests for services
- Integration tests for APIs
- Load testing for performance
- Security penetration testing
