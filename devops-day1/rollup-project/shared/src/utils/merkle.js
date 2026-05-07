const { ethers } = require('ethers');

class MerkleTree {
  /**
   * Hashes a transaction deterministically to form a leaf.
   */
  static hashLeaf(tx) {
    // Only hash deterministic fields (avoiding timestamps that might vary)
    const payload = {
      id: tx.id,
      from_address: tx.from_address,
      to_address: tx.to_address,
      amount: tx.amount
    };
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  }

  /**
   * Generates a complete Merkle Tree from a list of transactions.
   * Returns { root: bytes32, tree: [][] }
   */
  static generateTree(transactions) {
    let leaves = transactions.map(tx => this.hashLeaf(tx));
    
    if (leaves.length === 0) {
      return { root: ethers.ZeroHash, tree: [[]] };
    }

    const tree = [leaves];
    let level = leaves;

    while (level.length > 1) {
      let nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        // If odd number of nodes, duplicate the last node
        const right = i + 1 < level.length ? level[i + 1] : left;
        
        // Sort left and right to ensure consistent pair hashing (standard practice)
        const sorted = [left, right].sort();
        const hash = ethers.keccak256(ethers.concat([sorted[0], sorted[1]]));
        nextLevel.push(hash);
      }
      tree.push(nextLevel);
      level = nextLevel;
    }

    return { root: tree[tree.length - 1][0], tree };
  }

  /**
   * Retrieves the Merkle proof array for a specific leaf index.
   */
  static getProof(tree, leafIndex) {
    const proof = [];
    let index = leafIndex;

    for (let i = 0; i < tree.length - 1; i++) {
      const level = tree[i];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : Math.min(index + 1, level.length - 1);
      
      proof.push(level[siblingIndex]);
      index = Math.floor(index / 2);
    }

    return proof;
  }

  /**
   * Verifies a proof given a leaf transaction object, the proof array, and the expected root.
   */
  static verifyProof(tx, proof, root) {
    let computedHash = this.hashLeaf(tx);

    for (const proofElement of proof) {
      const sorted = [computedHash, proofElement].sort();
      computedHash = ethers.keccak256(ethers.concat([sorted[0], sorted[1]]));
    }

    return computedHash === root;
  }
}

module.exports = MerkleTree;
