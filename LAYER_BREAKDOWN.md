# Layer-by-Layer Breakdown - UPI Offline Mesh System

## Complete Technology & Component Breakdown by Layer

This document provides a detailed breakdown of every layer in the system, explaining exactly what technologies, libraries, and components are used in each layer. This will help you answer specific interview questions like "What did you use in the client layer?" or "What technologies are in your service layer?"

---

## LAYER 1: CLIENT LAYER

### Purpose
The client layer represents the mobile devices (phones) that participate in the mesh network. This includes sender phones, intermediate devices (strangers), and bridge nodes that have internet connectivity.

### Components Used

#### 1.1 Sender Phone (Offline Device)
**What it does**: Creates encrypted payment packets and injects them into the mesh

**Technologies Used**:
- **JavaScript (ES6+)**: For payment creation logic
- **Node.js Crypto Module**: For encryption operations
- **UUID Generation**: For unique packet and nonce generation
- **JSON**: For data serialization

**Specific Implementation**:
```javascript
// File: src/services/DemoService.js
// Technology: Node.js crypto module
const crypto = require('crypto');

// UUID generation for packetId and nonce
packetId: crypto.randomUUID()
nonce: crypto.randomUUID()

// SHA-256 hashing for PIN
pinHash: crypto.createHash('sha256').update(pin).digest('hex')

// Timestamp generation
signedAt: Date.now()
```

**Key Features**:
- Creates PaymentInstruction object with sender, receiver, amount, PIN hash, nonce, timestamp
- Encrypts using HybridCryptoService (RSA + AES-GCM)
- Wraps in MeshPacket with TTL
- Injects into virtual device

---

#### 1.2 Intermediate Devices (Stranger Phones)
**What it does**: Forward packets between devices via Bluetooth gossip

**Technologies Used**:
- **JavaScript (ES6+)**: For device logic
- **Map Data Structure**: For storing held packets
- **JavaScript Objects**: For packet representation

**Specific Implementation**:
```javascript
// File: src/services/VirtualDevice.js
// Technology: JavaScript Map
const heldPackets = new Map();

// Technology: JavaScript Objects
{
  deviceId: string,
  hasInternet: boolean,
  heldPackets: Map<packetId, MeshPacket>
}
```

**Key Features**:
- Stores packets in memory using Map data structure
- Checks if already holding a packet before accepting
- Tracks packet count
- Can clear all packets (for reset)

---

#### 1.3 Bridge Node (Online Device)
**What it does**: Collects packets and uploads to backend when internet available

**Technologies Used**:
- **JavaScript (ES6+)**: For upload logic
- **Fetch API**: For HTTP POST requests
- **JSON**: For request/response serialization
- **HTTP Headers**: For metadata (X-Bridge-Node-Id, X-Hop-Count)

**Specific Implementation**:
```javascript
// File: src/routes/api.js (mesh/flush endpoint)
// Technology: Fetch API
const response = await fetch('/api/bridge/ingest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bridge-Node-Id': 'phone-bridge',
    'X-Hop-Count': '3'
  },
  body: JSON.stringify(packet)
});
```

**Key Features**:
- Identifies packets with internet connectivity
- Uploads all held packets in parallel
- Includes metadata in HTTP headers
- Handles responses (SETTLED, DUPLICATE_DROPPED, INVALID)

---

### Client Layer Technologies Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Payment Creation | JavaScript ES6+, Node.js Crypto | Create and encrypt payments |
| Device Management | JavaScript Map, Objects | Store and forward packets |
| Network Communication | Fetch API, HTTP, JSON | Upload packets to backend |
| Unique Identifiers | UUID (crypto.randomUUID()) | Generate packet IDs and nonces |
| Timestamps | Date.now() | Track creation time |
| Hashing | SHA-256 (crypto.createHash) | Hash PINs and ciphertexts |

---

## LAYER 2: API GATEWAY LAYER

### Purpose
The API Gateway layer handles HTTP requests, routing, middleware, and serves static files. It's the entry point for all external requests.

### Components Used

#### 2.1 Express.js Server
**What it does**: Main HTTP server that handles incoming requests

**Technologies Used**:
- **Express.js**: Web framework for Node.js
- **Node.js HTTP Module**: Underlying HTTP server
- **Body-Parser**: Middleware for parsing JSON request bodies
- **Path Module**: For file path handling

**Specific Implementation**:
```javascript
// File: src/server.js
// Technology: Express.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Technology: Body-Parser middleware
app.use(bodyParser.json());

// Technology: Express static file serving
app.use(express.static(path.join(__dirname, '../public')));

// Technology: Express routing
app.use('/api', apiRoutes);

// Technology: Path module for file serving
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});
```

**Key Features**:
- Listens on port 8080 (configurable)
- Parses JSON request bodies automatically
- Serves static HTML dashboard
- Routes API requests to appropriate handlers
- Error handling middleware

---

#### 2.2 API Routes
**What it does**: Defines RESTful API endpoints and maps them to service functions

**Technologies Used**:
- **Express Router**: For route organization
- **HTTP Methods**: GET, POST
- **Route Parameters**: For dynamic paths
- **Request Headers**: For metadata extraction

**Specific Implementation**:
```javascript
// File: src/routes/api.js
// Technology: Express Router
const router = express.Router();

// Technology: GET HTTP method
router.get('/server-key', (req, res) => {
  res.json({ publicKey: serverKeyHolder.getPublicKeyBase64() });
});

// Technology: POST HTTP method
router.post('/demo/send', async (req, res) => {
  const body = req.body;
  // Process payment
});

// Technology: Request headers
router.post('/bridge/ingest', async (req, res) => {
  const bridgeNodeId = req.headers['x-bridge-node-id'];
  const hopCount = parseInt(req.headers['x-hop-count']);
});
```

**Key Features**:
- 8 RESTful endpoints defined
- GET endpoints for data retrieval
- POST endpoints for actions
- Header extraction for metadata
- JSON response formatting
- Error handling with try-catch

---

#### 2.3 Middleware
**What it does**: Processes requests before they reach route handlers

**Technologies Used**:
- **Body-Parser**: JSON parsing middleware
- **Express Static**: Static file serving middleware
- **Error Handling**: Custom error middleware (future)

**Specific Implementation**:
```javascript
// Technology: Body-Parser middleware
app.use(bodyParser.json());

// Technology: Static file middleware
app.use(express.static(path.join(__dirname, '../public')));

// Technology: Route middleware
app.use('/api', apiRoutes);
```

**Key Features**:
- Automatic JSON body parsing
- Static file serving for dashboard
- Route organization with middleware
- CORS support (can be added)
- Authentication middleware (future)

---

### API Gateway Layer Technologies Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web Server | Express.js, Node.js HTTP | Handle HTTP requests |
| Request Parsing | Body-Parser | Parse JSON request bodies |
| Routing | Express Router | Map URLs to handlers |
| Static Files | Express Static | Serve HTML dashboard |
| HTTP Methods | GET, POST | RESTful API design |
| Headers | Express Request Headers | Extract metadata |
| File Paths | Node.js Path Module | Handle file paths |
| Error Handling | Try-Catch, Express Error Middleware | Handle errors gracefully |

---

## LAYER 3: SERVICE LAYER

### Purpose
The service layer contains all business logic. It processes data, enforces business rules, and coordinates between different components. This is where the core application logic lives.

### Components Used

#### 3.1 HybridCryptoService
**What it does**: Handles all encryption and decryption operations

**Technologies Used**:
- **Node.js Crypto Module**: Core cryptographic operations
- **RSA-2048**: Asymmetric encryption
- **OAEP-SHA256**: RSA padding scheme
- **AES-256-GCM**: Symmetric encryption with authentication
- **SHA-256**: Hashing algorithm
- **Buffer**: Binary data manipulation
- **Base64**: Encoding for transport

**Specific Implementation**:
```javascript
// File: src/crypto/HybridCryptoService.js
// Technology: Node.js crypto module
const crypto = require('crypto');

// Technology: Random number generation
const aesKey = crypto.randomBytes(32); // AES-256 key
const iv = crypto.randomBytes(12);    // GCM IV

// Technology: AES-GCM encryption
const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
const encrypted = cipher.update(plaintext, 'utf8');
const tag = cipher.getAuthTag();

// Technology: RSA-OAEP encryption
const encryptedAesKey = crypto.publicEncrypt({
  key: publicKey,
  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: 'sha256'
}, aesKey);

// Technology: Buffer concatenation
const buf = Buffer.concat([encryptedAesKey, iv, aesCiphertext]);

// Technology: Base64 encoding
return buf.toString('base64');

// Technology: SHA-256 hashing
const hash = crypto.createHash('sha256').update(base64Ciphertext).digest('hex');
```

**Key Features**:
- Hybrid encryption (RSA + AES)
- Authenticated encryption (GCM tag)
- Tamper detection
- Ciphertext hashing for idempotency
- Secure random number generation

---

#### 3.2 ServerKeyHolder
**What it does**: Manages RSA keypair generation and storage

**Technologies Used**:
- **Node.js Crypto Module**: Key generation
- **RSA-2048**: Key size
- **SPKI/PKCS8**: Key encoding formats
- **PEM Format**: Key storage format
- **Base64**: Key encoding

**Specific Implementation**:
```javascript
// File: src/crypto/ServerKeyHolder.js
// Technology: RSA key generation
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

// Technology: Base64 encoding
const publicKeyBase64 = keyPair.publicKey.toString('base64');
```

**Key Features**:
- Generates RSA-2048 keypair on startup
- Stores keys in PEM format
- Provides public key in base64 for clients
- Keeps private key secure (in-memory)

---

#### 3.3 IdempotencyService
**What it does**: Prevents duplicate transaction processing

**Technologies Used**:
- **JavaScript Map**: In-memory hash map
- **Date.now()**: Timestamp generation
- **setInterval**: Periodic cache eviction
- **Atomic Operations**: Map.set() and Map.has()

**Specific Implementation**:
```javascript
// File: src/services/IdempotencyService.js
// Technology: JavaScript Map
const seen = new Map();

// Technology: Atomic hash claiming
claim(packetHash) {
  const now = Date.now();
  if (!this.seen.has(packetHash)) {
    this.seen.set(packetHash, now);
    return true; // First claimer
  }
  return false; // Duplicate
}

// Technology: Periodic eviction
setInterval(() => this.evictExpired(), 60000);

// Technology: Timestamp comparison
evictExpired() {
  const cutoff = Date.now() - (this.ttlSeconds * 1000);
  for (const [hash, timestamp] of this.seen.entries()) {
    if (timestamp < cutoff) {
      this.seen.delete(hash);
    }
  }
}
```

**Key Features**:
- O(1) hash lookup for duplicate detection
- Atomic operations prevent race conditions
- Automatic cache eviction (TTL-based)
- Thread-safe in Node.js single-threaded model

---

#### 3.4 BridgeIngestionService
**What it does**: Orchestrates the complete packet processing pipeline

**Technologies Used**:
- **Async/Await**: Asynchronous operation handling
- **Try-Catch**: Error handling
- **Service Composition**: Using other services
- **Date Arithmetic**: Freshness calculations

**Specific Implementation**:
```javascript
// File: src/services/BridgeIngestionService.js
// Technology: Async/await
async ingest(packet, bridgeNodeId, hopCount) {
  try {
    // Step 1: Hash
    const packetHash = hybridCryptoService.hashCiphertext(packet.ciphertext);
    
    // Step 2: Idempotency
    if (!idempotencyService.claim(packetHash)) {
      return this.duplicate(packetHash);
    }
    
    // Step 3: Decrypt
    const instruction = hybridCryptoService.decrypt(packet.ciphertext);
    
    // Step 4: Freshness check
    const ageSeconds = (Date.now() - instruction.signedAt) / 1000;
    if (ageSeconds > this.maxAgeSeconds) {
      return this.invalid(packetHash, 'stale_packet');
    }
    
    // Step 5: Settle
    const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);
    return this.settled(packetHash, tx);
  } catch (e) {
    return this.invalid('?', 'internal_error: ' + e.message);
  }
}
```

**Key Features**:
- 5-step processing pipeline
- Service composition pattern
- Comprehensive error handling
- Freshness validation
- Status reporting (SETTLED, DUPLICATE_DROPPED, INVALID)

---

#### 3.5 SettlementService
**What it does**: Handles transaction settlement with database transactions

**Technologies Used**:
- **Sequelize ORM**: Database operations
- **Database Transactions**: ACID compliance
- **Async/Await**: Asynchronous database operations
- **Try-Catch-Finally**: Transaction rollback on error
- **Decimal Arithmetic**: Precise financial calculations

**Specific Implementation**:
```javascript
// File: src/services/SettlementService.js
// Technology: Sequelize ORM
const sender = await this.Account.findByPk(instruction.senderVpa, { transaction });
const receiver = await this.Account.findByPk(instruction.receiverVpa, { transaction });

// Technology: Database transactions
const transaction = await models.sequelize.transaction();

try {
  // Technology: Decimal arithmetic
  sender.balance = (senderBalance - amount).toFixed(2);
  receiver.balance = (receiverBalance + amount).toFixed(2);
  
  // Technology: Transactional updates
  await sender.save({ transaction });
  await receiver.save({ transaction });
  
  // Technology: Transactional insert
  const tx = await this.Transaction.create({
    packetHash, senderVpa, receiverVpa, amount,
    signedAt: new Date(instruction.signedAt),
    settledAt: new Date(),
    bridgeNodeId, hopCount,
    status: 'SETTLED'
  }, { transaction });
  
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

**Key Features**:
- ACID transaction management
- Balance validation
- Atomic debit/credit operations
- Transaction rollback on errors
- Ledger record creation

---

#### 3.6 MeshSimulatorService
**What it does**: Simulates Bluetooth mesh network gossip protocol

**Technologies Used**:
- **JavaScript Map**: Device registry
- **Array Operations**: Device iteration
- **Object Spread**: Packet copying
- **Nested Loops**: Gossip algorithm

**Specific Implementation**:
```javascript
// File: src/services/MeshSimulatorService.js
// Technology: JavaScript Map for device registry
const devices = new Map();

// Technology: Array operations
const deviceList = Array.from(this.devices.values());

// Technology: Snapshot for gossip
const snapshot = new Map();
for (const d of deviceList) {
  snapshot.set(d.deviceId, [...d.getHeldPackets()]);
}

// Technology: Nested loops for gossip
for (const src of deviceList) {
  for (const pkt of snapshot.get(src.deviceId)) {
    for (const dst of deviceList) {
      if (dst === src) continue;
      if (dst.holds(pkt.packetId)) continue;
      
      // Technology: Object spread for copying
      const copy = {
        packetId: pkt.packetId,
        ttl: pkt.ttl - 1,
        createdAt: pkt.createdAt,
        ciphertext: pkt.ciphertext
      };
      dst.hold(copy);
    }
  }
}
```

**Key Features**:
- Device registry management
- Gossip protocol simulation
- TTL-based packet routing
- Packet copying and forwarding
- Bridge node identification

---

#### 3.7 DemoService
**What it does**: Seeds demo data and simulates sender phone behavior

**Technologies Used**:
- **Sequelize ORM**: Database seeding
- **Async/Await**: Asynchronous operations
- **Crypto Module**: Hash generation
- **UUID**: Unique identifier generation

**Specific Implementation**:
```javascript
// File: src/services/DemoService.js
// Technology: Sequelize ORM for seeding
await this.Account.bulkCreate([
  { vpa: 'alice@demo', holderName: 'Alice', balance: '5000.00' },
  { vpa: 'bob@demo', holderName: 'Bob', balance: '1000.00' }
]);

// Technology: SHA-256 hashing
pinHash: this.sha256Hex(pin)

sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Technology: UUID generation
nonce: crypto.randomUUID()
```

**Key Features**:
- Database seeding on startup
- Payment instruction creation
- PIN hashing
- Nonce generation
- Timestamp management

---

### Service Layer Technologies Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Encryption | Node.js Crypto, RSA-2048, AES-256-GCM | Encrypt/decrypt payments |
| Key Management | Node.js Crypto, RSA Key Generation | Generate and store keys |
| Idempotency | JavaScript Map, Atomic Operations | Prevent duplicate processing |
| Pipeline Orchestration | Async/Await, Service Composition | Coordinate processing steps |
| Database Operations | Sequelize ORM, Transactions | Manage data with ACID |
| Mesh Simulation | JavaScript Map, Arrays, Loops | Simulate network behavior |
| Data Seeding | Sequelize ORM, Bulk Create | Initialize demo data |
| Hashing | SHA-256 (crypto.createHash) | Hash PINs and ciphertexts |
| Unique IDs | UUID (crypto.randomUUID) | Generate packet IDs and nonces |
| Error Handling | Try-Catch, Async Error Handling | Handle errors gracefully |

---

## LAYER 4: DATA LAYER

### Purpose
The data layer handles all data persistence, retrieval, and management. It includes the database, ORM, and in-memory caching.

### Components Used

#### 4.1 Database (SQLite)
**What it does**: Persistent storage for accounts and transactions

**Technologies Used**:
- **SQLite**: Embedded database
- **Sequelize ORM**: Object-Relational Mapping
- **SQL**: Query language (abstracted by Sequelize)
- **Database Transactions**: ACID compliance
- **Indexes**: Performance optimization

**Specific Implementation**:
```javascript
// File: src/models/index.js
// Technology: Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './upimesh.db',
  logging: false,
  define: {
    timestamps: false
  }
});

// Technology: Database synchronization
await sequelize.sync({ force: true });
```

**Key Features**:
- Zero-setup embedded database
- ACID transaction support
- Automatic schema creation
- Index on packet_hash for uniqueness
- Production-ready (can switch to PostgreSQL)

---

#### 4.2 Account Model
**What it does**: Represents user accounts in the database

**Technologies Used**:
- **Sequelize Model**: ORM model definition
- **DataTypes**: Column type definitions
- **Primary Key**: Unique identifier
- **Decimal Type**: Precise financial amounts
- **Version Field**: Optimistic locking

**Specific Implementation**:
```javascript
// File: src/models/Account.js
// Technology: Sequelize DataTypes
const Account = sequelize.define('Account', {
  vpa: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  holderName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(19, 2),
    allowNull: false,
    defaultValue: '0.00'
  },
  version: {
    type: DataTypes.BIGINT,
    allowNull: true
  }
}, {
  tableName: 'accounts',
  timestamps: false
});
```

**Key Features**:
- VPA as primary key
- Precise decimal for balances
- Version field for optimistic locking
- No timestamps (simple design)

---

#### 4.3 Transaction Model
**What it does**: Represents transaction records in the database

**Technologies Used**:
- **Sequelize Model**: ORM model definition
- **Auto-Increment**: ID generation
- **Unique Index**: Prevent duplicate packet hashes
- **Enum Type**: Status values
- **Date Type**: Timestamps
- **Foreign Keys**: Referential integrity (optional)

**Specific Implementation**:
```javascript
// File: src/models/Transaction.js
// Technology: Sequelize DataTypes
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  packetHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  senderVpa: {
    type: DataTypes.STRING,
    allowNull: false
  },
  receiverVpa: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(19, 2),
    allowNull: false
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  settledAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  bridgeNodeId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hopCount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('SETTLED', 'REJECTED'),
    allowNull: false
  }
}, {
  tableName: 'transactions',
  indexes: [
    {
      name: 'idx_packet_hash',
      unique: true,
      fields: ['packetHash']
    }
  ]
});
```

**Key Features**:
- Auto-increment ID
- Unique constraint on packetHash (defense-in-depth)
- Enum for status values
- Timestamps for audit trail
- Index on packetHash for performance

---

#### 4.4 In-Memory Cache (Idempotency)
**What it does**: Fast duplicate detection without database access

**Technologies Used**:
- **JavaScript Map**: Hash map for O(1) lookups
- **Timestamps**: TTL tracking
- **setInterval**: Periodic eviction
- **Atomic Operations**: Thread-safe operations

**Specific Implementation**:
```javascript
// File: src/services/IdempotencyService.js
// Technology: JavaScript Map
const seen = new Map();

// Technology: Timestamp-based TTL
seen.set(packetHash, Date.now());

// Technology: Periodic eviction
setInterval(() => {
  const cutoff = Date.now() - (this.ttlSeconds * 1000);
  for (const [hash, timestamp] of this.seen.entries()) {
    if (timestamp < cutoff) {
      this.seen.delete(hash);
    }
  }
}, 60000);
```

**Key Features**:
- O(1) lookup performance
- Automatic eviction
- Memory-efficient
- Production upgrade path to Redis

---

### Data Layer Technologies Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | SQLite, Sequelize ORM | Persistent data storage |
| ORM | Sequelize | Object-relational mapping |
| Transactions | Sequelize Transactions | ACID compliance |
| Models | Sequelize Models | Define data structures |
| Data Types | DataTypes.STRING, DECIMAL, DATE, ENUM | Column type definitions |
| Indexes | Database Indexes | Performance optimization |
| Constraints | Unique Constraints, Primary Keys | Data integrity |
| In-Memory Cache | JavaScript Map | Fast duplicate detection |
| TTL Management | Timestamps, setInterval | Cache eviction |
| Schema Sync | sequelize.sync() | Automatic schema creation |

---

## CROSS-LAYER COMMUNICATION

### How Layers Interact

#### Client → API Gateway
**Technology**: HTTP/HTTPS, JSON, Fetch API
```javascript
// Client sends HTTP POST
fetch('http://localhost:8080/api/bridge/ingest', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(packet)
});
```

#### API Gateway → Service Layer
**Technology**: Direct function calls, JavaScript modules
```javascript
// API route calls service
const result = await bridgeIngestionService.ingest(packet, bridgeNodeId, hopCount);
```

#### Service Layer → Data Layer
**Technology**: Sequelize ORM, SQL queries
```javascript
// Service calls ORM
const account = await this.Account.findByPk(vpa, { transaction });
```

#### Service → Service
**Technology**: Service composition, dependency injection
```javascript
// BridgeIngestionService uses other services
const packetHash = hybridCryptoService.hashCiphertext(packet.ciphertext);
const claimed = idempotencyService.claim(packetHash);
const instruction = hybridCryptoService.decrypt(packet.ciphertext);
const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);
```

---

## INTERVIEW PREPARATION: LAYER-SPECIFIC QUESTIONS

### Client Layer Questions

**Q: What technologies did you use in the client layer?**
**A**: In the client layer, I used:
- **JavaScript ES6+** for device logic
- **Node.js Crypto Module** for encryption operations
- **UUID generation** (crypto.randomUUID()) for unique identifiers
- **SHA-256 hashing** for PIN hashing
- **Fetch API** for HTTP communication with backend
- **JSON** for data serialization
- **Map data structure** for storing packets on devices

**Q: How do devices communicate in the client layer?**
**A**: Devices communicate through a simulated Bluetooth mesh network using:
- **Gossip protocol**: Devices broadcast packets to nearby devices
- **TTL (Time To Live)**: Packets have hop limits
- **Map data structure**: Each device stores packets in a Map
- **Bridge nodes**: Only devices with internet upload to backend

---

### API Gateway Layer Questions

**Q: What did you use in the API Gateway layer?**
**A**: In the API Gateway layer, I used:
- **Express.js** as the web framework
- **Body-Parser middleware** for parsing JSON request bodies
- **Express Router** for organizing API routes
- **Express Static** for serving the HTML dashboard
- **HTTP methods** (GET, POST) for RESTful design
- **Request headers** for metadata extraction
- **Path module** for file path handling

**Q: How do you handle incoming requests?**
**A**: I use:
- **Express.js middleware pipeline** for request processing
- **Body-Parser** automatically parses JSON bodies
- **Express Router** maps URLs to specific handlers
- **Try-catch blocks** for error handling
- **JSON responses** for all API endpoints

---

### Service Layer Questions

**Q: What technologies are in your service layer?**
**A**: The service layer uses:
- **Node.js Crypto Module** for all cryptographic operations
- **RSA-2048 with OAEP-SHA256** for asymmetric encryption
- **AES-256-GCM** for symmetric encryption with authentication
- **SHA-256** for hashing
- **JavaScript Map** for idempotency cache
- **Async/Await** for asynchronous operations
- **Sequelize ORM** for database operations
- **Database transactions** for ACID compliance

**Q: How does encryption work in your service layer?**
**A**: I implemented hybrid encryption:
- **Generate AES-256 key** per packet using crypto.randomBytes()
- **Encrypt payload** with AES-256-GCM (authenticated encryption)
- **Encrypt AES key** with RSA-2048-OAEP using server's public key
- **Pack**: [RSA-encrypted AES key][IV][ciphertext + GCM tag]
- **Base64 encode** for transport
- **GCM tag** provides tamper detection

**Q: How do you prevent duplicate transactions?**
**A**: I use an idempotency service:
- **JavaScript Map** for O(1) hash lookup
- **SHA-256 hash** of ciphertext as key
- **Atomic Map.set()** operation for claiming
- **First claimer processes**, subsequent duplicates dropped
- **TTL-based eviction** to prevent memory bloat

---

### Data Layer Questions

**Q: What did you use in the data layer?**
**A**: In the data layer, I used:
- **SQLite** as the embedded database (demo)
- **Sequelize ORM** for database operations
- **Database transactions** for ACID compliance
- **Sequelize Models** for defining data structures
- **DataTypes** (STRING, DECIMAL, DATE, ENUM) for columns
- **Database indexes** for performance
- **Unique constraints** for data integrity
- **JavaScript Map** for in-memory caching

**Q: How do you ensure data consistency?**
**A**: I ensure consistency through:
- **Database transactions** with Sequelize
- **ACID properties** (Atomicity, Consistency, Isolation, Durability)
- **Transaction rollback** on errors
- **Unique constraints** on packetHash
- **Optimistic locking** with version field
- **Decimal type** for precise financial calculations

**Q: Why did you choose SQLite?**
**A**: For the demo, I chose SQLite because:
- **Zero setup** - no database server needed
- **Embedded** - runs in the same process
- **Single file** - easy to manage
- **ACID compliant** - supports transactions
- **Production-ready** - can easily switch to PostgreSQL

---

## QUICK REFERENCE: WHAT TO SAY FOR EACH LAYER

### Client Layer
"I used JavaScript ES6+ with the Node.js crypto module for encryption. Devices store packets in a JavaScript Map data structure. Bridge nodes use the Fetch API to upload packets via HTTP POST requests with JSON payloads."

### API Gateway Layer
"I built the API with Express.js framework. I used Body-Parser middleware to automatically parse JSON request bodies. Express Router organizes my 8 RESTful endpoints. I serve the static HTML dashboard using Express Static middleware."

### Service Layer
"The service layer contains all business logic. I use the Node.js crypto module for RSA-2048 and AES-256-GCM encryption. I implemented idempotency using a JavaScript Map for O(1) duplicate detection. I use Sequelize ORM with database transactions for data operations, ensuring ACID compliance."

### Data Layer
"For data persistence, I use SQLite with Sequelize ORM. I defined Account and Transaction models using Sequelize DataTypes. I use database transactions to ensure ACID properties. I have a unique index on packetHash for duplicate prevention. I also use an in-memory JavaScript Map for fast idempotency caching."

---

## PRODUCTION UPGRADES BY LAYER

### Client Layer (Production)
- **Real Bluetooth**: Use BLE GATT or Wi-Fi Direct
- **Native Apps**: Android (Kotlin) or iOS (Swift)
- **Secure Storage**: Android Keystore / iOS Keychain

### API Gateway Layer (Production)
- **Load Balancer**: AWS ALB or Nginx
- **Rate Limiting**: Express-rate-limit middleware
- **Authentication**: JWT or Mutual TLS
- **HTTPS**: SSL/TLS certificates
- **CORS**: Proper CORS configuration

### Service Layer (Production)
- **Redis**: Replace in-memory Map for distributed idempotency
- **AWS KMS**: Replace in-memory key generation
- **Message Queue**: RabbitMQ or Kafka for async processing
- **Circuit Breaker**: For resilience

### Data Layer (Production)
- **PostgreSQL**: Replace SQLite for production
- **Connection Pooling**: For performance
- **Read Replicas**: For scalability
- **Backup Strategy**: Automated backups
- **Monitoring**: Database performance metrics

---

This comprehensive layer-by-layer breakdown will help you answer any specific question about technologies used in each layer during your interviews. Practice explaining each layer clearly and confidently!
