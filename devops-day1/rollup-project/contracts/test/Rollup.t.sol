// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Rollup} from "../src/Rollup.sol";

contract RollupTest is Test {
    Rollup public rollup;
    address public owner = address(1);
    address public nonOwner = address(2);

    event BatchSubmitted(uint256 indexed batchId, bytes32 batchHash);

    function setUp() public {
        vm.prank(owner);
        rollup = new Rollup();
    }

    function test_InitialState() public {
        assertEq(rollup.owner(), owner);
        assertEq(rollup.batchCount(), 0);
    }

    function test_SubmitBatch_Success() public {
        bytes memory data = "test batch data";
        bytes32 expectedHash = keccak256(data);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit BatchSubmitted(0, expectedHash);
        
        rollup.submitBatch(data);

        assertEq(rollup.batchCount(), 1);
        assertEq(rollup.batches(0), expectedHash);
    }

    function test_SubmitBatch_RevertNonOwner() public {
        bytes memory data = "test batch data";

        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        rollup.submitBatch(data);
    }
}
