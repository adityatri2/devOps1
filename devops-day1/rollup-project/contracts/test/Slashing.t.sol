// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Rollup.sol";

contract SlashingTest is Test {
    Rollup public rollup;
    address sequencer1 = address(0x1);
    address challenger = address(0x2);

    function setUp() public {
        rollup = new Rollup();
        vm.deal(sequencer1, 10 ether);
        vm.deal(challenger, 10 ether);
    }

    function testSequencerRegistration() public {
        vm.startPrank(sequencer1);
        rollup.registerSequencer{value: 1 ether}();
        assertTrue(rollup.isActiveSequencer(sequencer1));
        assertEq(rollup.stakes(sequencer1), 1 ether);
        vm.stopPrank();
    }

    function testFraudSlashing() public {
        // 1. Sequencer registers and stakes
        vm.startPrank(sequencer1);
        rollup.registerSequencer{value: 1 ether}();
        bytes32 txRoot = keccak256("txRoot");
        bytes32 daCommitment = keccak256("daCommitment");
        rollup.submitBatch(bytes("data"), txRoot, daCommitment);
        vm.stopPrank();

        // 2. Challenger submits fraud proof
        vm.startPrank(challenger);
        uint256 challengerBalanceBefore = challenger.balance;
        
        bytes memory fraudProof = abi.encode(txRoot, "INVALID_STATE");
        rollup.challengeBatch(0, fraudProof);
        
        // 3. Verify Sequencer is slashed
        assertFalse(rollup.isActiveSequencer(sequencer1));
        assertEq(rollup.stakes(sequencer1), 0);
        
        // 4. Verify Challenger received 50% reward
        uint256 challengerBalanceAfter = challenger.balance;
        assertEq(challengerBalanceAfter, challengerBalanceBefore + 0.5 ether);
        vm.stopPrank();
    }

    function testRewardDistribution() public {
        // Fund the contract so it can pay rewards
        vm.deal(address(rollup), 10 ether);

        vm.startPrank(sequencer1);
        rollup.registerSequencer{value: 1 ether}();
        bytes32 txRoot = keccak256("txRoot");
        bytes32 daCommitment = keccak256("daCommitment");
        rollup.submitBatch(bytes("data"), txRoot, daCommitment);
        vm.stopPrank();

        // Fast forward past challenge window
        vm.warp(block.timestamp + 1 hours + 1);

        // Finalize
        rollup.finalizeBatch(0);

        // Verify Reward
        assertEq(rollup.sequencerRewards(sequencer1), 0.01 ether);
    }
}
