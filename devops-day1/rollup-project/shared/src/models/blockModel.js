const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class BlockModel {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS blocks (
        id UUID PRIMARY KEY,
        block_number INTEGER UNIQUE NOT NULL,
        transactions JSONB NOT NULL,
        eth_tx_hash TEXT,
        batch_id TEXT,
        tx_root TEXT,
        state_root TEXT,
        is_challenged BOOLEAN DEFAULT FALSE,
        is_finalized BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(query);

    // Migration for existing table
    await db.query(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS eth_tx_hash TEXT;`);
    await db.query(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS batch_id TEXT;`);
    await db.query(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS tx_root TEXT;`);
    await db.query(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS state_root TEXT;`);
    await db.query(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS is_challenged BOOLEAN DEFAULT FALSE;`);
    await db.query(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;`);
  }

  static async getLastBlockNumber() {
    const query = `SELECT MAX(block_number) as max_block FROM blocks;`;
    const result = await db.query(query);
    return result.rows[0].max_block || 0;
  }

  static async createBlock(transactions, txRoot, stateRoot) {
    const id = uuidv4();
    const query = `
      INSERT INTO blocks (id, block_number, transactions, tx_root, state_root)
      VALUES ($1, COALESCE((SELECT MAX(block_number) FROM blocks), 0) + 1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await db.query(query, [id, JSON.stringify(transactions), txRoot, stateRoot]);
    return result.rows[0];
  }

  static async updateSubmissionInfo(id, txHash, batchId) {
    const query = `
      UPDATE blocks
      SET eth_tx_hash = $2, batch_id = $3
      WHERE id = $1
      RETURNING *;
    `;
    const result = await db.query(query, [id, txHash, batchId]);
    return result.rows[0];
  }

  static async updateChallengeStatus(id, isChallenged) {
    const query = `UPDATE blocks SET is_challenged = $2 WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id, isChallenged]);
    return result.rows[0];
  }

  static async updateFinalizeStatus(id, isFinalized) {
    const query = `UPDATE blocks SET is_finalized = $2 WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id, isFinalized]);
    return result.rows[0];
  }
}

module.exports = BlockModel;
