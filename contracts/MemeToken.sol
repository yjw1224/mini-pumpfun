// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MemeToken is ERC20, Ownable {
    address public curve;
    string public tokenURI;
    uint256 public constant MAX_SUPPLY = 1000000 * 1e18; // 1 million tokens

    constructor(string memory name_, string memory symbol_, string memory tokenURI_) ERC20(name_, symbol_) Ownable(msg.sender) {
        tokenURI = tokenURI_;
    }

    function setCurve(address _curve) external onlyOwner {
        require(curve == address(0), "Curve already set");
        curve = _curve;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == curve, "Only curve");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
