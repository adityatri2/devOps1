// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RollupVerifier.sol";

contract RollupVerifierTest is Test {
    RollupVerifier public verifier;

    function setUp() public {
        verifier = new RollupVerifier();
    }

    function testValidProof() public {
        bytes32 leaf1 = keccak256("tx1");
        bytes32 leaf2 = keccak256("tx2");
        
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leaf2;
        
        // Root is hash of sorted leaves.
        bytes32 root;
        if (leaf1 <= leaf2) {
            root = keccak256(abi.encodePacked(leaf1, leaf2));
        } else {
            root = keccak256(abi.encodePacked(leaf2, leaf1));
        }

        bool isValid = verifier.verifyTransaction(leaf1, proof, root);
        assertTrue(isValid);
    }

    function testInvalidProof() public {
        bytes32 leaf1 = keccak256("tx1");
        bytes32 fakeLeaf2 = keccak256("fake");
        
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = fakeLeaf2;
        
        bytes32 root = keccak256("some_root");

        bool isValid = verifier.verifyTransaction(leaf1, proof, root);
        assertFalse(isValid);
    }
}
