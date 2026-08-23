// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MemeToken is ERC20 {
    address public curve;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function setCurve(address _curve) external {
        require(curve == address(0), "Curve already set");
        curve = _curve;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == curve, "Only curve");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
