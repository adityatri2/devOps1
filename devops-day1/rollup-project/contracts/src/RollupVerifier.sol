// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract RollupVerifier is Ownable {
    // Mapping from batchId to txRoot
    mapping(uint256 => bytes32) public batchRoots;

    event BatchRootStored(uint256 indexed batchId, bytes32 txRoot);
    event ProofVerified(bytes32 indexed leaf, bytes32 indexed root, bool isValid);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Submits a Merkle root for a given batch.
     * @param batchId The ID of the batch.
     * @param txRoot The Merkle root of the transactions in this batch.
     */
    function submitBatchRoot(uint256 batchId, bytes32 txRoot) external onlyOwner {
        batchRoots[batchId] = txRoot;
        emit BatchRootStored(batchId, txRoot);
    }

    /**
     * @notice Verifies that a specific transaction leaf is part of the Merkle tree.
     * @param leaf The keccak256 hash of the transaction data.
     * @param proof The array of sibling hashes needed for the proof.
     * @param root The expected Merkle root.
     * @return bool True if the proof is valid, false otherwise.
     */
    function verifyTransaction(
        bytes32 leaf,
        bytes32[] calldata proof,
        bytes32 root
    ) external returns (bool) {
        bool isValid = MerkleProof.verify(proof, root, leaf);
        emit ProofVerified(leaf, root, isValid);
        return isValid;
    }
}
