// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeUSDC is ERC20 {
    constructor() ERC20("Fake USDC", "fUSDC") {
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}