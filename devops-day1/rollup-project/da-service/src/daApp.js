const express = require('express');
const zlib = require('zlib');
const { ethers } = require('ethers');
const db = require("@rollup/shared").db;

const app = express();
app.use(express.json({ limit: '50mb' }));

// Init DB for DA
db.query(`
  CREATE TABLE IF NOT EXISTS da_batches (
    commitment TEXT PRIMARY KEY,
    compressed_data BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(console.error);

app.post('/da/publish', async (req, res) => {
    try {
        const transactions = req.body.transactions;
        const jsonStr = JSON.stringify(transactions);
        const originalSize = Buffer.byteLength(jsonStr, 'utf8');
        
        // Compression using gzip
        const compressedData = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
        const compressedSize = compressedData.length;
        
        // Hash the compressed data to get the DA commitment
        const commitment = ethers.keccak256(compressedData);

        await db.query(`INSERT INTO da_batches (commitment, compressed_data) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [commitment, compressedData]);

        res.json({ 
            success: true, 
            commitment,
            originalSize,
            compressedSize,
            ratio: originalSize / compressedSize
        });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/da/:commitment', async (req, res) => {
    try {
        const result = await db.query(`SELECT compressed_data FROM da_batches WHERE commitment = $1`, [req.params.commitment]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "DA batch not found" });
        }

        const compressedData = result.rows[0].compressed_data;
        
        // Integrity Verification
        const computedCommitment = ethers.keccak256(compressedData);
        if (computedCommitment !== req.params.commitment) {
            return res.status(500).json({ success: false, error: "DA integrity verification failed!" });
        }

        const uncompressed = zlib.gunzipSync(compressedData).toString('utf-8');
        res.json({ success: true, transactions: JSON.parse(uncompressed) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = app;
