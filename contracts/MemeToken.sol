// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MemeToken is ERC20 {
    address public immutable curve;

    constructor(
        string memory name_,
        string memory symbol_,
        address curve_
    ) ERC20(name_, symbol_) {
        curve = curve_;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == curve, "Only curve");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}