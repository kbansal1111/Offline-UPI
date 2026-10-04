# Tech Stack - UPI Offline Mesh Project

## Technologies & Tools

### Backend Development
- **Node.js** (v16+) - JavaScript runtime
- **Express.js** - Web framework for REST APIs
- **JavaScript (ES6+)** - Async/await, arrow functions, modules

### Database & ORM
- **Sequelize** - ORM for database operations and migrations
- **SQLite** - Embedded database for demo (production: PostgreSQL/MySQL)

### Security & Cryptography
- **Node.js Crypto Module** - Built-in cryptographic operations
- **RSA-2048 with OAEP-SHA256** - Asymmetric encryption for key exchange
- **AES-256-GCM** - Symmetric encryption with authentication
- **SHA-256** - Cryptographic hashing for idempotency

### API & Architecture
- **RESTful API Design** - HTTP methods, status codes, resource routing
- **JSON** - Data serialization
- **Service Layer Pattern** - Business logic separation
- **Repository Pattern** - Data access abstraction
- **Transaction Management** - Database consistency and rollback

### Development Tools
- **npm** - Package management and dependency management
- **Git** - Version control
- **VS Code** - IDE

### System Design Concepts
- **Idempotency Pattern** - Duplicate prevention in distributed systems
- **Hybrid Encryption** - Combining asymmetric and symmetric encryption
- **Mesh Network Simulation** - Gossip protocol implementation
- **Optimistic Locking** - Concurrency control with version fields
- **Atomic Operations** - Thread-safe data structures

### Security Best Practices
- **Authenticated Encryption** - AES-GCM for tamper detection
- **Replay Attack Prevention** - Freshness checks and nonces
- **Input Validation** - Request body validation
- **Secure Key Management** - RSA keypair generation and handling

### Testing & Quality
- **Manual Testing** - End-to-end workflow validation
- **Error Handling** - Try-catch blocks and graceful degradation
- **Logging** - Console logging for debugging and monitoring

---

## Project Complexity Indicators

### Algorithms & Data Structures
- **Hash Maps** - O(1) lookups for idempotency cache
- **Graph Traversal** - Mesh network gossip simulation
- **Buffer Operations** - Binary data manipulation for encryption
- **UUID Generation** - Unique identifier generation

### System Design
- **Distributed Systems Concepts** - Idempotency, eventual consistency
- **Network Protocols** - HTTP, simulated Bluetooth mesh
- **Scalability Considerations** - Redis migration path, horizontal scaling
- **Fault Tolerance** - Transaction rollback, error recovery

### Performance Optimization
- **In-Memory Caching** - Idempotency cache for fast duplicate detection
- **Batch Operations** - Parallel bridge uploads
- **Efficient Encryption** - Hybrid encryption reduces RSA overhead

---

## Key Skills Demonstrated

### Technical Skills
- Backend API development with Node.js/Express
- Database design and ORM usage
- Cryptography implementation (RSA, AES, hashing)
- Secure coding practices
- System design and architecture
- Transaction management
- Error handling and logging

### Soft Skills
- Problem-solving (offline payment routing)
- Security awareness (encryption, replay prevention)
- Scalability thinking (production considerations)
- Code organization and maintainability
- Documentation skills

---

## Resume-Worthy Keywords

- Node.js, Express.js, JavaScript, ES6+
- REST API, JSON, HTTP
- Sequelize, SQLite, PostgreSQL
- Cryptography, RSA, AES, Encryption, Hashing
- Security, Authentication, Idempotency
- Database Transactions, ACID
- System Design, Architecture
- Mesh Networks, Gossip Protocol
- Backend Development, API Design
- Error Handling, Logging
- Git, npm, Version Control
