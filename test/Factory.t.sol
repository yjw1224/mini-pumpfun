// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Factory} from "../contracts/Factory.sol";
import {BondingCurve} from "../contracts/BondingCurve.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {MemeToken} from "../contracts/MemeToken.sol";

contract FactoryTest is Test {
    FakeUSDC internal fakeUSDC;
    Factory internal factory;

    address internal master = makeAddr("master");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        fakeUSDC = new FakeUSDC();
        factory = new Factory(address(fakeUSDC), master);
    }

    function test_CreateTokensHaveFixedInitialMCap() public {
        vm.prank(alice);
        (address firstTokenAddress, address firstCurveAddress) = factory.createToken(
            "Doge", "DOGE", "ipfs://doge"
        );
        vm.prank(bob);
        (address secondTokenAddress, address secondCurveAddress) = factory.createToken(
            "Cat", "CAT", "ipfs://cat"
        );

        MemeToken firstToken = MemeToken(firstTokenAddress);
        MemeToken secondToken = MemeToken(secondTokenAddress);
        BondingCurve firstCurve = BondingCurve(firstCurveAddress);
        BondingCurve secondCurve = BondingCurve(secondCurveAddress);

        assertEq(firstToken.tokenURI(), "ipfs://doge");
        assertEq(secondToken.tokenURI(), "ipfs://cat");
        assertEq(firstCurve.creator(), alice);
        assertEq(secondCurve.creator(), bob);
        assertEq(firstCurve.currentPrice(), 1e14);
        assertEq(secondCurve.currentPrice(), 1e14);
        assertEq(firstCurve.marketCap(), firstCurve.INITIAL_MCAP());
        assertEq(secondCurve.marketCap(), secondCurve.INITIAL_MCAP());
        assertEq(firstToken.balanceOf(firstCurveAddress), 9_000_000 * 1e18);
        assertEq(secondToken.balanceOf(secondCurveAddress), 9_000_000 * 1e18);
        assertEq(factory.tokenToCurve(firstTokenAddress), firstCurveAddress);
        assertEq(factory.tokenToCurve(secondTokenAddress), secondCurveAddress);
    }

    function test_BuyOnOneTokenDoesNotChangeTheOtherCurve() public {
        vm.prank(alice);
        (, address firstCurveAddress) = factory.createToken("Doge", "DOGE", "ipfs://doge");
        vm.prank(bob);
        (address secondTokenAddress, address secondCurveAddress) = factory.createToken("Cat", "CAT", "ipfs://cat");

        BondingCurve firstCurve = BondingCurve(firstCurveAddress);
        BondingCurve secondCurve = BondingCurve(secondCurveAddress);
        uint256 secondMCapBefore = secondCurve.marketCap();

        fakeUSDC.faucet(100e18);
        fakeUSDC.approve(firstCurveAddress, 100e18);
        firstCurve.buy(100e18, 0);

        assertGt(firstCurve.marketCap(), firstCurve.INITIAL_MCAP());
        assertEq(secondCurve.marketCap(), secondMCapBefore);
        assertEq(MemeToken(secondTokenAddress).balanceOf(address(this)), 0);
    }

    function test_GraduateTokenRejectsUnknownCurve() public {
        vm.expectRevert("Unknown curve");
        factory.graduateToken(makeAddr("notACurve"));
    }
}