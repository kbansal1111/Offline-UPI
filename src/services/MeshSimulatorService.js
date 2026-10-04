const VirtualDevice = require('./VirtualDevice');

/**
 * Simulates the Bluetooth mesh.
 *
 * Each VirtualDevice represents a phone. The "gossip" step picks pairs of
 * devices that are nearby (we just say all devices are nearby for the demo)
 * and copies packets between them, decrementing TTL each hop.
 *
 * When a device with internet (a "bridge node") holds a packet, the demo's
 * /api/mesh/flush endpoint causes it to actually POST that packet to our
 * backend — simulating the moment a phone walks outside and gets 4G.
 */
class MeshSimulatorService {
  constructor() {
    this.devices = new Map();
    this.seedDefaultDevices();
  }

  seedDefaultDevices() {
    // Default scenario: 4 offline phones in a basement, 1 phone outside with 4G
    this.devices.set('phone-alice', new VirtualDevice('phone-alice', false));
    this.devices.set('phone-stranger1', new VirtualDevice('phone-stranger1', false));
    this.devices.set('phone-stranger2', new VirtualDevice('phone-stranger2', false));
    this.devices.set('phone-stranger3', new VirtualDevice('phone-stranger3', false));
    this.devices.set('phone-bridge', new VirtualDevice('phone-bridge', true));
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  getDevice(id) {
    return this.devices.get(id);
  }

  /**
   * Sender drops a packet into the mesh by handing it to their own device.
   */
  inject(senderDeviceId, packet) {
    const sender = this.devices.get(senderDeviceId);
    if (!sender) {
      throw new Error('Unknown device: ' + senderDeviceId);
    }
    sender.hold(packet);
    console.log(`Packet ${packet.packetId.substring(0, 8)} injected at ${senderDeviceId} (TTL=${packet.ttl})`);
  }

  /**
   * One round of gossip. Every device shares everything it has with every
   * other device. TTL is decremented per hop; packets at TTL 0 stay where
   * they are but are not forwarded further.
   *
   * Real BLE gossip would be pair-by-pair when devices come into range.
   * For the demo we let everyone gossip with everyone in one round, which
   * is equivalent to "fast-forward N rounds of pairwise gossip".
   */
  gossipOnce() {
    let transfers = 0;
    const deviceList = Array.from(this.devices.values());

    // Snapshot what each device holds at the start of this round, so
    // we don't gossip the same packet through 5 devices in 1 step.
    const snapshot = new Map();
    for (const d of deviceList) {
      snapshot.set(d.deviceId, [...d.getHeldPackets()]);
    }

    for (const src of deviceList) {
      for (const pkt of snapshot.get(src.deviceId)) {
        if (pkt.ttl <= 0) continue;
        for (const dst of deviceList) {
          if (dst === src) continue;
          if (dst.holds(pkt.packetId)) continue;
          
          const copy = {
            packetId: pkt.packetId,
            ttl: pkt.ttl - 1,
            createdAt: pkt.createdAt,
            ciphertext: pkt.ciphertext
          };
          dst.hold(copy);
          transfers++;
        }
      }
    }

    console.log(`Gossip round complete: ${transfers} packet transfers`);
    return {
      transfers,
      deviceCounts: this.snapshotMap()
    };
  }

  snapshotMap() {
    const m = new Map();
    for (const d of this.devices.values()) {
      m.set(d.deviceId, d.packetCount());
    }
    return m;
  }

  /**
   * Returns all packets held by devices with internet — these are what would
   * be uploaded to the backend the moment they reach connectivity.
   */
  collectBridgeUploads() {
    const out = [];
    for (const d of this.devices.values()) {
      if (!d.hasInternetAccess()) continue;
      for (const pkt of d.getHeldPackets()) {
        out.push({
          bridgeNodeId: d.deviceId,
          packet: pkt
        });
      }
    }
    return out;
  }

  resetMesh() {
    for (const d of this.devices.values()) {
      d.clear();
    }
  }
}

module.exports = new MeshSimulatorService();
