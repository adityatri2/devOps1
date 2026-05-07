const db = require("@rollup/shared").db;
const TxModel = require("@rollup/shared").TxModel;
const { v4: uuidv4 } = require('uuid');

class StateEngineService {
  static async applyTransaction(tx) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Check/create sender account FOR UPDATE to lock the row
      let senderRes = await client.query('SELECT * FROM accounts WHERE address = $1 FOR UPDATE', [tx.from_address]);
      let sender = senderRes.rows[0];

      if (!sender) {
        // Create sender with default 1000 balance
        const insertRes = await client.query(
          'INSERT INTO accounts (id, address, balance) VALUES ($1, $2, $3) RETURNING *',
          [uuidv4(), tx.from_address, 1000]
        );
        sender = insertRes.rows[0];
      }

      // 2. Check balance
      if (parseFloat(sender.balance) < parseFloat(tx.amount)) {
        await TxModel.updateTransactionStatus(tx.id, 'failed', client);
        await client.query('COMMIT');
        return { success: false, reason: 'Insufficient balance' };
      }

      // 3. Deduct from sender
      await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE address = $2',
        [tx.amount, tx.from_address]
      );

      // 4. Add to receiver (upsert)
      await client.query(`
        INSERT INTO accounts (id, address, balance)
        VALUES ($1, $2, $3)
        ON CONFLICT (address) DO UPDATE SET balance = accounts.balance + EXCLUDED.balance
      `, [uuidv4(), tx.to_address, tx.amount]);

      // 5. Update tx status
      await TxModel.updateTransactionStatus(tx.id, 'processed', client);
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('StateEngine error:', error);
      return { success: false, reason: 'Internal error' };
    } finally {
      client.release();
    }
  }
}

module.exports = StateEngineService;
