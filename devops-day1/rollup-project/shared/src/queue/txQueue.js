const redisClient = require('../config/redis');

class TxQueue {
  static async pushToQueue(transactionId) {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    // Push the transaction ID to a Redis list named 'tx_queue'
    await redisClient.lPush('tx_queue', transactionId);
    console.log(`Transaction ${transactionId} pushed to queue.`);
  }
}

module.exports = TxQueue;
