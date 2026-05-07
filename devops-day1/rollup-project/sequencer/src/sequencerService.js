const redisClient = require("@rollup/shared").redis;
const TxModel = require("@rollup/shared").TxModel;
const BlockModel = require("@rollup/shared").BlockModel;
const StateEngineService = require('./stateEngineService');
const { blocksCreated } = require("@rollup/shared").metrics;
const MerkleTree = require("@rollup/shared").merkle;
const { ethers } = require('ethers');

class SequencerService {
  static async processQueue() {
    try {
      const blockSize = parseInt(process.env.BLOCK_SIZE) || 5;
      const transactions = [];

      // Try to pop up to blockSize transactions
      for (let i = 0; i < blockSize; i++) {
        // We use rPop because we used lPush in txQueue.js (FIFO)
        const txId = await redisClient.rPop('tx_queue');
        if (!txId) {
          break; // Queue is empty
        }

        // Fetch full transaction details from PostgreSQL
        const tx = await TxModel.getTransactionById(txId);
        if (tx && tx.status === 'pending') {
          // Avoid duplicates inside block if the same txId was pushed twice
          if (!transactions.find(t => t.id === tx.id)) {
            // Apply state transitions via State Engine
            const result = await StateEngineService.applyTransaction(tx);
            if (result.success) {
              transactions.push(tx);
            } else {
              console.log(`❌ Transaction ${tx.id} failed: ${result.reason}`);
            }
          }
        } else if (tx) {
          console.warn(`Transaction ${txId} is already processed or invalid status.`);
        } else {
          console.error(`Transaction ${txId} found in queue but missing from DB.`);
        }
      }

      // If we have transactions to process, group them into a block (prevents empty blocks)
      if (transactions.length > 0) {
        // Generate Merkle Tree for transactions
        const { root: txRoot } = MerkleTree.generateTree(transactions);
        
        // Placeholder for state_root (can be actual state tree later)
        const stateRoot = ethers.ZeroHash;

        // Create the block
        const newBlock = await BlockModel.createBlock(transactions, txRoot, stateRoot);

        console.log(`\n📦 Block ${newBlock.block_number} created with ${transactions.length} transactions.`);
        
        blocksCreated.inc(); // Increment block creation metric

        // Trigger Rollup submission asynchronously
        const rollupService = require('./rollupService');
        const { daUploadLatency, daCompressionRatio, daRetrievalFailures } = require("@rollup/shared").metrics;
        
        // Execute Rollup process without blocking queue
        (async () => {
          let daCommitment = ethers.ZeroHash;
          const endLatency = daUploadLatency.startTimer();
          
          try {
            // Post transactions to DA layer
            const daHost = process.env.DA_HOST || 'http://localhost:4000';
            const response = await fetch(`${daHost}/da/publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactions })
            });
            const data = await response.json();
            
            if (data && data.success) {
              daCommitment = data.commitment;
              daCompressionRatio.set(data.ratio);
              console.log(`📡 Batch uploaded to DA layer. Commitment: ${daCommitment}`);
            } else {
              console.error("DA layer rejected payload:", data.error);
            }
          } catch (e) {
            console.error("Failed to publish to DA Layer:", e.message);
            daRetrievalFailures.inc(); // Track failure
          } finally {
            endLatency();
          }

          try {
            await rollupService.submitBlock(newBlock, daCommitment);
          } catch (err) {
            console.error(`Rollup background task failed for block ${newBlock.block_number}:`, err);
          }
        })();
      }
    } catch (error) {
      console.error('Error in SequencerService:', error);
    }
  }
}

module.exports = SequencerService;
