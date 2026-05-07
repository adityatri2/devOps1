const { ethers } = require('ethers');
const BlockModel = require("@rollup/shared").BlockModel;
require('dotenv').config();
const { ethSuccess, ethFailed, activeStake, validatorHealth, slashingCount } = require("@rollup/shared").metrics;

const RollupABI = [
  "function registerSequencer() external payable",
  "function submitBatch(bytes calldata data, bytes32 txRoot, bytes32 daCommitment) external",
  "function challengeBatch(uint256 batchId, bytes calldata fraudProof) external",
  "function finalizeBatch(uint256 batchId) external",
  "function isActiveSequencer(address) external view returns (bool)",
  "event SequencerRegistered(address indexed sequencer, uint256 amount)",
  "event BatchSubmitted(uint256 indexed batchId, bytes32 batchHash, bytes32 txRoot, bytes32 daCommitment, address indexed sequencer)",
  "event BatchChallenged(uint256 indexed batchId)",
  "event FraudDetected(uint256 indexed batchId, address indexed slashedSequencer)",
  "event StakeSlashed(address indexed sequencer, uint256 amount)",
  "event BatchFinalized(uint256 indexed batchId)",
  "event RewardDistributed(address indexed sequencer, uint256 amount)"
];

class RollupService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.initialize();
  }

  initialize() {
    try {
      if (process.env.ETH_RPC_URL && process.env.ETH_PRIVATE_KEY && process.env.ROLLUP_CONTRACT_ADDRESS) {
        this.provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(process.env.ROLLUP_CONTRACT_ADDRESS, RollupABI, this.wallet);
        console.log(`Ethereum Rollup Service initialized.`);
        console.log(`Contract: ${process.env.ROLLUP_CONTRACT_ADDRESS}`);
        console.log(`Submitting from: ${this.wallet.address}`);
        
        // Setup listener for slashing events
        this.contract.on("StakeSlashed", (sequencer, amount) => {
          if (sequencer.toLowerCase() === this.wallet.address.toLowerCase()) {
            console.error(`🚨 WARNING: THIS SEQUENCER NODE WAS SLASHED FOR ${ethers.formatEther(amount)} ETH!`);
            slashingCount.inc();
            validatorHealth.set(0);
            activeStake.set(0);
          }
        });
        
        // Initial metrics update
        this.updateValidatorMetrics();
      } else {
        console.warn('Ethereum credentials or Contract Address missing in .env. Rollup submissions will be skipped.');
      }
    } catch (error) {
      console.error('Failed to initialize Rollup Service:', error);
    }
  }

  async updateValidatorMetrics() {
    if (!this.contract) return;
    try {
      const stake = await this.contract.stakes(this.wallet.address);
      const isActive = await this.contract.isActiveSequencer(this.wallet.address);
      
      activeStake.set(parseFloat(ethers.formatEther(stake)));
      validatorHealth.set(isActive ? 1 : 0);
    } catch (e) {}
  }

  async ensureRegistered() {
    if (!this.contract) return;
    try {
      const isActive = await this.contract.isActiveSequencer(this.wallet.address);
      if (!isActive) {
        console.log(`⚠️ Sequencer ${this.wallet.address} is not active. Registering now...`);
        // Minimum stake is 1 ether based on our contract
        const tx = await this.contract.registerSequencer({ value: ethers.parseEther("1.0") });
        console.log(`⏳ Waiting for registration confirmation (Tx: ${tx.hash})...`);
        await tx.wait();
        console.log(`✅ Sequencer successfully registered and staked!`);
        this.updateValidatorMetrics();
      } else {
        this.updateValidatorMetrics();
      }
    } catch (e) {
      console.error(`Failed to register sequencer:`, e.message);
    }
  }

  async submitBlock(block, daCommitment) {
    if (!this.contract) throw new Error('Rollup Service not initialized');
    
    await this.ensureRegistered();
    
    console.log(`Submitting block ${block.block_number} to Layer 1...`);
    const txRoot = block.tx_root || ethers.ZeroHash;
    const commitment = daCommitment || ethers.ZeroHash;
    
    // In a real rollup, 'data' would be compressed transactions.
    // However, since we now use a dedicated DA Layer, we just submit a small L1 payload
    const payload = ethers.toUtf8Bytes(`Block ${block.block_number}`);
    
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`\n🔗 Estimating gas for Block ${block.block_number} submission...`);
        // 3. Estimate gas for contract call
        const estimatedGas = await this.contract.submitBatch.estimateGas(payload, txRoot, commitment);
        const txOptions = {
            gasLimit: (estimatedGas * 120n) / 100n // Add 20% buffer
        };

        console.log(`🚀 Broadcasting Block ${block.block_number} to Layer 1...`);
        // 4. Send transaction
        const txResponse = await this.contract.submitBatch(payload, txRoot, commitment, txOptions);
        
        console.log(`⏳ Waiting for confirmation (Tx Hash: ${txResponse.hash})...`);
        const receipt = await txResponse.wait();

        // 5. Extract batchId from event
        let batchId = null;
        for (const log of receipt.logs) {
            try {
                const parsedLog = this.contract.interface.parseLog({
                  topics: [...log.topics],
                  data: log.data
                });
                if (parsedLog && parsedLog.name === 'BatchSubmitted') {
                    batchId = parsedLog.args[0].toString();
                    break;
                }
            } catch (e) {
                // Ignore logs not from our ABI
            }
        }

        // 6. Save tx hash and batch_id in database
        await BlockModel.updateSubmissionInfo(block.id, txResponse.hash, batchId);
        
        ethSuccess.inc(); // Increment successful Ethereum submission
        
        console.log(`✅ Block ${block.block_number} successfully submitted!`);
        console.log(`   Tx Hash: ${txResponse.hash}`);
        console.log(`   Batch ID: ${batchId}`);
        return;

      } catch (error) {
        retries--;
        console.error(`❌ Failed to submit Block ${block.block_number}. Retries left: ${retries}`);
        console.error('Error Details:', error.message || error);
        
        if (retries === 0) {
          ethFailed.inc(); // Increment failed Ethereum submission
          console.error(`🚨 Fatal: Block ${block.block_number} submission completely failed.`);
        } else {
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }
  async challengeBatch(blockId, batchId, txRoot) {
    if (!this.contract) throw new Error('Rollup Service not initialized');
    
    // Generate a mock fraud proof matching the contract's verification logic:
    // abi.encode(bytes32 providedTxRoot, string reason)
    const abiCoder = new ethers.AbiCoder();
    const fraudProof = abiCoder.encode(["bytes32", "string"], [txRoot, "INVALID_STATE"]);

    console.log(`🗡️ Challenging Batch ID: ${batchId}...`);
    const tx = await this.contract.challengeBatch(batchId, fraudProof);
    await tx.wait();
    console.log(`✅ Challenge submitted for Batch ${batchId}`);
    
    await BlockModel.updateChallengeStatus(blockId, true);
    return tx.hash;
  }

  async finalizeBatch(blockId, batchId) {
    if (!this.contract) throw new Error('Rollup Service not initialized');
    
    console.log(`🔒 Finalizing Batch ID: ${batchId}...`);
    const tx = await this.contract.finalizeBatch(batchId);
    await tx.wait();
    console.log(`✅ Batch ${batchId} finalized successfully`);

    await BlockModel.updateFinalizeStatus(blockId, true);
    return tx.hash;
  }
}

module.exports = new RollupService();
