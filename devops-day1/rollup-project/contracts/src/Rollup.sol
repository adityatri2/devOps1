// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Rollup is Ownable {
    uint256 public batchCount;
    uint256 public constant CHALLENGE_WINDOW = 1 hours;
    uint256 public constant MINIMUM_STAKE = 1 ether;

    struct Batch {
        bytes32 batchHash;
        bytes32 txRoot;
        bytes32 daCommitment;
        uint256 timestamp;
        address sequencer;
        bool isChallenged;
        bool isFinalized;
    }

    mapping(uint256 => Batch) public batches;
    mapping(address => uint256) public stakes;
    mapping(address => bool) public isActiveSequencer;
    mapping(address => uint256) public sequencerRewards;

    event SequencerRegistered(address indexed sequencer, uint256 amount);
    event SequencerDeregistered(address indexed sequencer);
    event BatchSubmitted(uint256 indexed batchId, bytes32 batchHash, bytes32 txRoot, bytes32 daCommitment, address indexed sequencer);
    event BatchChallenged(uint256 indexed batchId);
    event FraudDetected(uint256 indexed batchId, address indexed slashedSequencer);
    event StakeSlashed(address indexed sequencer, uint256 amount);
    event BatchFinalized(uint256 indexed batchId);
    event RewardDistributed(address indexed sequencer, uint256 amount);

    // Pass msg.sender to the Ownable constructor (required in OpenZeppelin v5)
    constructor() Ownable(msg.sender) {}

    modifier onlyActiveSequencer() {
        require(isActiveSequencer[msg.sender], "Not an active sequencer");
        _;
    }

    /**
     * @notice Register a node as a sequencer by staking ETH.
     */
    function registerSequencer() external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        stakes[msg.sender] += msg.value;
        isActiveSequencer[msg.sender] = true;
        emit SequencerRegistered(msg.sender, msg.value);
    }

    /**
     * @notice Submits a new batch of L2 transactions.
     * @param data The batch data, passed as calldata for gas efficiency.
     * @param txRoot The Merkle root of the transactions in this batch.
     * @param daCommitment The Data Availability commitment hash.
     */
    function submitBatch(bytes calldata data, bytes32 txRoot, bytes32 daCommitment) external onlyActiveSequencer {
        // Calculate the hash of the batch data
        bytes32 batchHash = keccak256(data);
        uint256 currentBatchId = batchCount;
        
        // Store the batch hash and timestamp for the challenge window
        batches[currentBatchId] = Batch({
            batchHash: batchHash,
            txRoot: txRoot,
            daCommitment: daCommitment,
            timestamp: block.timestamp,
            sequencer: msg.sender,
            isChallenged: false,
            isFinalized: false
        });
        
        batchCount++;

        // Emit the event for off-chain indexers and tracking
        emit BatchSubmitted(currentBatchId, batchHash, txRoot, daCommitment, msg.sender);
    }

    /**
     * @notice Challenges a batch during the challenge window.
     * @param batchId The ID of the batch to challenge.
     * @param fraudProof The proof data demonstrating an invalid state transition.
     */
    function challengeBatch(uint256 batchId, bytes calldata fraudProof) external {
        Batch storage batch = batches[batchId];
        require(batch.timestamp != 0, "Batch does not exist");
        require(!batch.isFinalized, "Batch already finalized");
        require(!batch.isChallenged, "Batch already challenged");
        require(block.timestamp <= batch.timestamp + CHALLENGE_WINDOW, "Challenge window expired");

        // Basic fraud verification logic
        bool isFraudulent = _verifyFraudProof(batch.txRoot, fraudProof);
        require(isFraudulent, "Invalid fraud proof");

        batch.isChallenged = true;
        
        // Slashing Logic
        address slashedSequencer = batch.sequencer;
        uint256 slashedAmount = stakes[slashedSequencer];
        if (slashedAmount > 0) {
            stakes[slashedSequencer] = 0;
            isActiveSequencer[slashedSequencer] = false;
            // Reward the challenger with 50% of the stake, the rest is burned (remains in contract without tracking)
            payable(msg.sender).transfer(slashedAmount / 2);
            emit StakeSlashed(slashedSequencer, slashedAmount);
        }

        emit FraudDetected(batchId, slashedSequencer);
        emit BatchChallenged(batchId);
    }

    /**
     * @notice Internal logic to verify a fraud proof.
     */
    function _verifyFraudProof(bytes32 txRoot, bytes calldata fraudProof) internal pure returns (bool) {
        // Basic invalid state transition detection mock.
        (bytes32 providedTxRoot, string memory reason) = abi.decode(fraudProof, (bytes32, string));
        if (providedTxRoot == txRoot && keccak256(bytes(reason)) == keccak256("INVALID_STATE")) {
            return true;
        }
        return false;
    }

    /**
     * @notice Finalizes a batch after the challenge window expires without any successful challenges.
     * @param batchId The ID of the batch.
     */
    function finalizeBatch(uint256 batchId) external {
        Batch storage batch = batches[batchId];
        require(batch.timestamp != 0, "Batch does not exist");
        require(!batch.isChallenged, "Batch is challenged");
        require(!batch.isFinalized, "Batch already finalized");
        require(block.timestamp > batch.timestamp + CHALLENGE_WINDOW, "Challenge window not expired");

        batch.isFinalized = true;
        
        // Reward logic: fixed reward for finalized block
        uint256 rewardAmount = 0.01 ether;
        if (address(this).balance >= rewardAmount) {
            sequencerRewards[batch.sequencer] += rewardAmount;
            emit RewardDistributed(batch.sequencer, rewardAmount);
        }

        emit BatchFinalized(batchId);
    }
    
    // Fallback to allow funding the contract for rewards
    receive() external payable {}
}
