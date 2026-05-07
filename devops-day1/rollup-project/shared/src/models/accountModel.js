const db = require('../config/db');

class AccountModel {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY,
        address TEXT UNIQUE NOT NULL,
        balance NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(query);
  }

  static async getAccountByAddress(address) {
    const query = `SELECT * FROM accounts WHERE address = $1;`;
    const result = await db.query(query, [address]);
    return result.rows[0];
  }
}

module.exports = AccountModel;
