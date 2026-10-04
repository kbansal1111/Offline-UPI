const express = require('express');
const router = express.Router();
const serverKeyHolder = require('../crypto/ServerKeyHolder');
const demoService = require('../services/DemoService');
const meshSimulatorService = require('../services/MeshSimulatorService');
const bridgeIngestionService = require('../services/BridgeIngestionService');
const models = require('../models');
const idempotencyService = require('../services/IdempotencyService');

/**
 * Public REST surface.
 *
 * The endpoints split into three groups:
 *   /api/server-key      → so simulated senders can fetch the server's public key
 *   /api/mesh/*          → simulator endpoints (inject, gossip, flush)
 *   /api/bridge/ingest   → THE real production endpoint a real bridge node would hit
 *   /api/accounts, /api/transactions → for the dashboard
 */

// ------------------------------------------------------------------ key

router.get('/server-key', (req, res) => {
  res.json({
    publicKey: serverKeyHolder.getPublicKeyBase64(),
    algorithm: 'RSA-2048 / OAEP-SHA256',
    hybridScheme: 'RSA-OAEP encrypts an AES-256-GCM session key'
  });
});

// ---------------------------------------------------------------- demo

/**
 * Demo helper: build a packet on the server (simulating a sender phone)
 * and inject it into the mesh at the given device.
 */
router.post('/demo/send', async (req, res) => {
  try {
    const { senderVpa, receiverVpa, amount, pin, ttl, startDevice } = req.body;
    
    const packet = await demoService.createPacket(
      senderVpa,
      receiverVpa,
      amount,
      pin,
      ttl || 5
    );

    const startDeviceId = startDevice || 'phone-alice';
    meshSimulatorService.inject(startDeviceId, packet);

    res.json({
      packetId: packet.packetId,
      ciphertextPreview: packet.ciphertext.substring(0, 64) + '...',
      ttl: packet.ttl,
      injectedAt: startDeviceId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------- mesh sim

router.get('/mesh/state', (req, res) => {
  const devices = meshSimulatorService.getDevices();
  const deviceData = devices.map(d => ({
    deviceId: d.deviceId,
    hasInternet: d.hasInternetAccess(),
    packetCount: d.packetCount(),
    packetIds: d.getHeldPackets().map(p => p.packetId.substring(0, 8))
  }));

  res.json({
    devices: deviceData,
    idempotencyCacheSize: idempotencyService.size()
  });
});

router.post('/mesh/gossip', (req, res) => {
  const result = meshSimulatorService.gossipOnce();
  res.json(result);
});

/**
 * "All bridge nodes simultaneously walk outside and get 4G."
 * They all upload everything they hold to /api/bridge/ingest.
 *
 * THIS is the moment the duplicate-storm idempotency case is tested:
 * if multiple bridge nodes hold the same packet, the server gets multiple
 * concurrent POSTs of the same ciphertext, and only one should settle.
 */
router.post('/mesh/flush', async (req, res) => {
  try {
    const uploads = meshSimulatorService.collectBridgeUploads();
    const results = [];

    // Upload them in parallel to actually exercise concurrent idempotency.
    const uploadPromises = uploads.map(async (up) => {
      const r = await bridgeIngestionService.ingest(up.packet, up.bridgeNodeId, 5 - up.packet.ttl);
      return {
        bridgeNode: up.bridgeNodeId,
        packetId: up.packet.packetId.substring(0, 8),
        outcome: r.outcome,
        reason: r.reason || '',
        transactionId: r.transactionId || -1
      };
    });

    const uploadResults = await Promise.all(uploadPromises);
    results.push(...uploadResults);

    res.json({
      uploadsAttempted: uploads.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mesh/reset', (req, res) => {
  meshSimulatorService.resetMesh();
  idempotencyService.clear();
  res.json({ status: 'mesh and idempotency cache cleared' });
});

// -------------------------------------------------------------- bridge

/**
 * THE PRODUCTION ENDPOINT.
 * In a real deployment, the Android app's bridge logic POSTs here whenever
 * the device has internet and is holding mesh packets.
 */
router.post('/bridge/ingest', async (req, res) => {
  try {
    const packet = req.body;
    const bridgeNodeId = req.headers['x-bridge-node-id'] || 'unknown';
    const hopCount = parseInt(req.headers['x-hop-count'] || '0');

    const result = await bridgeIngestionService.ingest(packet, bridgeNodeId, hopCount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------- accounts

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await models.Account.findAll();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await models.Transaction.findAll({
      order: [['id', 'DESC']],
      limit: 20
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
