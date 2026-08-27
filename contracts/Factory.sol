// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemeToken} from "./MemeToken.sol";
import {BondingCurve} from "./BondingCurve.sol";

contract Factory {
	address public immutable fakeUSDC;
	address public immutable master;
    address[] public allTokens;
    mapping(address => address) public tokenToCurve;

	event TokenCreated(address indexed creator, address token, address bondingCurve);

	constructor(address _fakeUSDC, address _master) {
		fakeUSDC = _fakeUSDC;
		master = _master;
	}

	function createToken(
		string calldata name_,
		string calldata symbol_,
		uint256 initialPrice
	) external returns (address tokenAddress, address curveAddress) {
		MemeToken token = new MemeToken(name_, symbol_);
		BondingCurve curve = new BondingCurve(
			address(token),
			fakeUSDC,
			master,
			initialPrice,
			msg.sender
		);

		token.setCurve(address(curve));
		curve.initialize();

		token.transferOwnership(msg.sender);
		curve.transferOwnership(msg.sender);

        allTokens.push(address(token));
        tokenToCurve[address(token)] = address(curve);
		emit TokenCreated(msg.sender, address(token), address(curve));
		return (address(token), address(curve));
	}
}