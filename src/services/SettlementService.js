const models = require('../models');

/**
 * Where the actual ledger update happens. Wrapped in a DB transaction so either
 * BOTH the debit and credit happen, or neither does.
 *
 * The version column on Account gives us optimistic locking — if two threads
 * somehow get past idempotency and both try to debit the same account, the
 * second one will fail rather than corrupting the balance. (In a demo the
 * idempotency layer should always catch this first, but defense in depth.)
 */
class SettlementService {
  constructor() {
    this.Account = models.Account;
    this.Transaction = models.Transaction;
  }

  async settle(instruction, packetHash, bridgeNodeId, hopCount) {
    const transaction = await models.sequelize.transaction();

    try {
      const sender = await this.Account.findByPk(instruction.senderVpa, { transaction });
      if (!sender) {
        throw new Error('Unknown sender VPA: ' + instruction.senderVpa);
      }

      const receiver = await this.Account.findByPk(instruction.receiverVpa, { transaction });
      if (!receiver) {
        throw new Error('Unknown receiver VPA: ' + instruction.receiverVpa);
      }

      const amount = parseFloat(instruction.amount);
      if (amount <= 0) {
        throw new Error('Amount must be positive');
      }

      const senderBalance = parseFloat(sender.balance);
      if (senderBalance < amount) {
        console.warn(`Insufficient balance: ${sender.vpa} has ₹${senderBalance}, tried to send ₹${amount}`);
        await this.recordRejected(instruction, packetHash, bridgeNodeId, hopCount, transaction);
        await transaction.commit();
        return null;
      }

      sender.balance = (senderBalance - amount).toFixed(2);
      receiver.balance = (parseFloat(receiver.balance) + amount).toFixed(2);

      await sender.save({ transaction });
      await receiver.save({ transaction });

      const tx = await this.Transaction.create({
        packetHash,
        senderVpa: instruction.senderVpa,
        receiverVpa: instruction.receiverVpa,
        amount,
        signedAt: new Date(instruction.signedAt),
        settledAt: new Date(),
        bridgeNodeId,
        hopCount,
        status: 'SETTLED'
      }, { transaction });

      await transaction.commit();

      console.log(`SETTLED ₹${amount} from ${sender.vpa} to ${receiver.vpa} (packetHash=${packetHash.substring(0, 12)}..., bridge=${bridgeNodeId}, hops=${hopCount})`);

      return tx;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async recordRejected(instruction, packetHash, bridgeNodeId, hopCount, transaction) {
    await this.Transaction.create({
      packetHash,
      senderVpa: instruction.senderVpa,
      receiverVpa: instruction.receiverVpa,
      amount: instruction.amount,
      signedAt: new Date(instruction.signedAt),
      settledAt: new Date(),
      bridgeNodeId,
      hopCount,
      status: 'REJECTED'
    }, { transaction });
  }
}

module.exports = new SettlementService();
