const db = require('../config/db');

class TxModel {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(query);
  }

  static async createTransaction(id, from, to, amount, status = 'pending') {
    const query = `
      INSERT INTO transactions (id, from_address, to_address, amount, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await db.query(query, [id, from, to, amount, status]);
    return result.rows[0];
  }

  static async getTransactionById(id) {
    const query = `SELECT * FROM transactions WHERE id = $1;`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async updateTransactionStatus(id, status, client = db) {
    const query = `
      UPDATE transactions
      SET status = $2
      WHERE id = $1
      RETURNING *;
    `;
    const result = await client.query(query, [id, status]);
    return result.rows[0];
  }
}

module.exports = TxModel;
