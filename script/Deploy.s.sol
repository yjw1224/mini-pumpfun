// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {Factory} from "../contracts/Factory.sol";

contract Deploy is Script {
	function run() external returns (FakeUSDC usdc, Factory factory) {
		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		address master = vm.addr(deployerPrivateKey);

		vm.startBroadcast(deployerPrivateKey);
		usdc = new FakeUSDC();
		factory = new Factory(address(usdc), master);
		vm.stopBroadcast();

		console2.log("FakeUSDC:", address(usdc));
		console2.log("Factory:", address(factory));
		console2.log("Master:", master);
	}
}
