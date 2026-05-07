const BlockModel = require("@rollup/shared").BlockModel;
const db = require("@rollup/shared").db;
const MerkleTree = require("@rollup/shared").merkle;
const RollupService = require('../services/rollupService');

class BlockController {
  static async getBlocks(req, res, next) {
    try {
      const query = `SELECT * FROM blocks ORDER BY block_number DESC LIMIT 50;`;
      const result = await db.query(query);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  static async getProof(req, res, next) {
    try {
      const blockId = req.params.id;
      const txId = req.params.txId;

      const query = `SELECT * FROM blocks WHERE id = $1 OR block_number::text = $1 LIMIT 1;`;
      const result = await db.query(query, [blockId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Block not found' });
      }

      const block = result.rows[0];
      const transactions = typeof block.transactions === 'string' ? JSON.parse(block.transactions) : block.transactions;

      const txIndex = transactions.findIndex(tx => tx.id === txId);
      if (txIndex === -1) {
         return res.status(404).json({ success: false, error: 'Transaction not found in this block' });
      }

      const { tree, root } = MerkleTree.generateTree(transactions);
      const proof = MerkleTree.getProof(tree, txIndex);
      
      const leaf = transactions[txIndex];
      const isValid = MerkleTree.verifyProof(leaf, proof, root);

      res.status(200).json({
        success: true,
        data: {
          block_number: block.block_number,
          tx_root: block.tx_root,
          tx_id: txId,
          proof,
          is_valid: isValid
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProofByTxId(req, res, next) {
    try {
      const txId = req.params.txId;

      // PostgreSQL specific JSONB query to find the block containing this transaction ID
      const query = `
        SELECT * FROM blocks 
        WHERE transactions @> '[{"id": "' || $1 || '"}]' 
        LIMIT 1;
      `;
      // We pass txId as parameter but use concat operator to build valid jsonb query string safely or directly use JSONB containment operator
      // A safer and cleaner parameterized query for JSONB array of objects in Postgres:
      const querySafe = `SELECT * FROM blocks WHERE transactions @> $1::jsonb LIMIT 1;`;
      const result = await db.query(querySafe, [JSON.stringify([{ id: txId }])]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Transaction not found in any block' });
      }

      const block = result.rows[0];
      const transactions = typeof block.transactions === 'string' ? JSON.parse(block.transactions) : block.transactions;

      const txIndex = transactions.findIndex(tx => tx.id === txId);
      
      const { tree, root } = MerkleTree.generateTree(transactions);
      const proof = MerkleTree.getProof(tree, txIndex);
      const leaf = transactions[txIndex];

      res.status(200).json({
        success: true,
        data: {
          block_number: block.block_number,
          tx_root: block.tx_root,
          tx_id: txId,
          leaf: MerkleTree.hashLeaf(leaf),
          proof,
          is_valid: MerkleTree.verifyProof(leaf, proof, root)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async challengeBlock(req, res, next) {
    try {
      const blockId = req.params.id;
      const query = `SELECT * FROM blocks WHERE id = $1 OR block_number::text = $1 LIMIT 1;`;
      const result = await db.query(query, [blockId]);
      
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Block not found' });
      const block = result.rows[0];
      if (!block.batch_id) return res.status(400).json({ success: false, error: 'Block not submitted to L1 yet' });

      const txHash = await RollupService.challengeBatch(block.id, block.batch_id, block.tx_root);
      res.status(200).json({ success: true, message: 'Challenge submitted', txHash });
    } catch (error) {
      next(error);
    }
  }

  static async finalizeBlock(req, res, next) {
    try {
      const blockId = req.params.id;
      const query = `SELECT * FROM blocks WHERE id = $1 OR block_number::text = $1 LIMIT 1;`;
      const result = await db.query(query, [blockId]);
      
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Block not found' });
      const block = result.rows[0];
      if (!block.batch_id) return res.status(400).json({ success: false, error: 'Block not submitted to L1 yet' });

      const txHash = await RollupService.finalizeBatch(block.id, block.batch_id);
      res.status(200).json({ success: true, message: 'Batch finalized', txHash });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BlockController;
