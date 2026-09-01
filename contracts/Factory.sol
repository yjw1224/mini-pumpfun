// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemeToken} from "./MemeToken.sol";
import {BondingCurve} from "./BondingCurve.sol";

contract Factory {
	address public immutable fakeUSDC;
	address public immutable master;
    address[] public allTokens;
    mapping(address => address) public tokenToCurve;
    mapping(address => bool) public isFactoryCurve;

	event TokenCreated(address indexed creator, address token, address bondingCurve);
	event TokenGraduated(address indexed token, address indexed curve, address amm);

	constructor(address _fakeUSDC, address _master) {
		fakeUSDC = _fakeUSDC;
		master = _master;
	}

	function createToken(
		string calldata name_,
		string calldata symbol_,
		string calldata tokenURI_
	) external returns (address tokenAddress, address curveAddress) {
		MemeToken token = new MemeToken(name_, symbol_, tokenURI_);
		BondingCurve curve = new BondingCurve(
			address(token),
			fakeUSDC,
			master,
			msg.sender
		);

		token.setCurve(address(curve));
		curve.initialize();

		token.transferOwnership(msg.sender);
		curve.transferOwnership(msg.sender);

        allTokens.push(address(token));
        tokenToCurve[address(token)] = address(curve);
        isFactoryCurve[address(curve)] = true;
		emit TokenCreated(msg.sender, address(token), address(curve));
		return (address(token), address(curve));
	}

	// Permissionless: BondingCurve.graduate() already enforces the reserve/graduated
	// invariants, this just verifies curveAddress was actually created by this Factory.
	function graduateToken(address curveAddress) external {
		require(curveAddress != address(0), "Invalid curve address");
		require(isFactoryCurve[curveAddress], "Unknown curve");

		BondingCurve curve = BondingCurve(curveAddress);
		curve.graduate();

		emit TokenGraduated(address(curve.token()), curveAddress, address(curve.amm()));
	}
}