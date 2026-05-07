// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Rollup} from "../src/Rollup.sol";

contract DeployRollup is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Rollup rollup = new Rollup();
        console2.log("Rollup deployed to:", address(rollup));

        vm.stopBroadcast();
    }
}
