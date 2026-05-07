// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Rollup.sol";

contract RollupFraudTest is Test {
    Rollup public rollup;
    address owner = address(1);

    function setUp() public {
        vm.startPrank(owner);
        rollup = new Rollup();
        vm.stopPrank();
    }

    function testSubmitAndFinalize() public {
        vm.startPrank(owner);
        bytes32 txRoot = keccak256("txRoot");
        rollup.submitBatch(bytes("data"), txRoot);
        
        // Cannot finalize immediately
        vm.expectRevert("Challenge window not expired");
        rollup.finalizeBatch(0);

        // Warp time forward by 1 hour + 1 second
        vm.warp(block.timestamp + 1 hours + 1);

        // Can finalize now
        rollup.finalizeBatch(0);
        
        (, , , bool isChallenged, bool isFinalized) = rollup.batches(0);
        assertFalse(isChallenged);
        assertTrue(isFinalized);
        vm.stopPrank();
    }

    function testValidChallenge() public {
        vm.startPrank(owner);
        bytes32 txRoot = keccak256("txRoot");
        rollup.submitBatch(bytes("data"), txRoot);
        vm.stopPrank();

        // Simulate a valid fraud proof for our basic verification
        // Our mock requires: abi.encode(providedTxRoot, "INVALID_STATE")
        bytes memory fraudProof = abi.encode(txRoot, "INVALID_STATE");

        // Anyone can challenge
        rollup.challengeBatch(0, fraudProof);

        (, , , bool isChallenged, bool isFinalized) = rollup.batches(0);
        assertTrue(isChallenged);
        assertFalse(isFinalized);
    }

    function testInvalidChallenge() public {
        vm.startPrank(owner);
        bytes32 txRoot = keccak256("txRoot");
        rollup.submitBatch(bytes("data"), txRoot);
        vm.stopPrank();

        // Simulate an invalid fraud proof (wrong string)
        bytes memory fraudProof = abi.encode(txRoot, "VALID_STATE");

        vm.expectRevert("Invalid fraud proof");
        rollup.challengeBatch(0, fraudProof);

        (, , , bool isChallenged, ) = rollup.batches(0);
        assertFalse(isChallenged);
    }
}
