// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Factory} from "../contracts/Factory.sol";
import {BondingCurve} from "../contracts/BondingCurve.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {MemeToken} from "../contracts/MemeToken.sol";

contract FactoryTest is Test {
    FakeUSDC fakeUSDC;
    Factory factory;
    address master = makeAddr("master");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant INITIAL_PRICE = 1e18;

    function setUp() public {
        fakeUSDC = new FakeUSDC();
        factory = new Factory(address(fakeUSDC), master);
    }

    function test_CreateMultipleTokensAreIndependent() public {
        vm.prank(alice);
        (address firstTokenAddress, address firstCurveAddress) = factory.createToken(
            "Doge",
            "DOGE",
            INITIAL_PRICE
        );

        vm.prank(bob);
        (address secondTokenAddress, address secondCurveAddress) = factory.createToken(
            "Cat",
            "CAT",
            2e18
        );

        MemeToken firstToken = MemeToken(firstTokenAddress);
        MemeToken secondToken = MemeToken(secondTokenAddress);
        BondingCurve firstCurve = BondingCurve(firstCurveAddress);
        BondingCurve secondCurve = BondingCurve(secondCurveAddress);

        assertTrue(firstTokenAddress != secondTokenAddress);
        assertTrue(firstCurveAddress != secondCurveAddress);
        assertEq(firstToken.curve(), firstCurveAddress);
        assertEq(secondToken.curve(), secondCurveAddress);
        assertEq(address(firstCurve.token()), firstTokenAddress);
        assertEq(address(secondCurve.token()), secondTokenAddress);
        assertEq(firstCurve.creator(), alice);
        assertEq(secondCurve.creator(), bob);
        assertEq(firstCurve.owner(), alice);
        assertEq(secondCurve.owner(), bob);
        assertEq(firstCurve.virtualUSDCReserve(), 1_000_000 * 1e18);
        assertEq(secondCurve.virtualUSDCReserve(), 2_000_000 * 1e18);
        assertEq(firstToken.balanceOf(firstCurveAddress), 800_000 * 1e18);
        assertEq(secondToken.balanceOf(secondCurveAddress), 800_000 * 1e18);
        assertEq(firstToken.balanceOf(secondCurveAddress), 0);
        assertEq(secondToken.balanceOf(firstCurveAddress), 0);
        assertEq(factory.tokenToCurve(firstTokenAddress), firstCurveAddress);
        assertEq(factory.tokenToCurve(secondTokenAddress), secondCurveAddress);
    }

    function test_GraduateTokenRevertsForUnknownCurve() public {
        vm.expectRevert("Unknown curve");
        factory.graduateToken(makeAddr("notACurve"));
    }

    function test_GraduateTokenRevertsForZeroAddress() public {
        vm.expectRevert("Invalid curve address");
        factory.graduateToken(address(0));
    }

    function test_GraduateTokenSucceedsForOwnCurve() public {
        vm.prank(alice);
        (, address curveAddress) = factory.createToken("Doge", "DOGE", INITIAL_PRICE);
        BondingCurve curve = BondingCurve(curveAddress);

        // Exact USDC amount (see BondingCurve.t.sol) needed to drain the 800k real token reserve.
        uint256 buyAmount = 4_040_404_040_404_040_404_040_405;
        fakeUSDC.faucet(buyAmount);
        fakeUSDC.approve(curveAddress, buyAmount);
        curve.buy(buyAmount, 0);
        assertEq(curve.realTokenReserve(), 0);

        // Permissionless: bob (not the creator) can trigger graduation through the Factory.
        vm.prank(bob);
        factory.graduateToken(curveAddress);

        assertTrue(address(curve.amm()) != address(0));
    }

    function test_BuyOnOneTokenDoesNotChangeTheOtherCurve() public {
        vm.prank(alice);
        (, address firstCurveAddress) = factory.createToken(
            "Doge",
            "DOGE",
            INITIAL_PRICE
        );

        vm.prank(bob);
        (address secondTokenAddress, address secondCurveAddress) = factory.createToken(
            "Cat",
            "CAT",
            INITIAL_PRICE
        );

        BondingCurve firstCurve = BondingCurve(firstCurveAddress);
        BondingCurve secondCurve = BondingCurve(secondCurveAddress);
        uint256 secondTokenReserveBefore = secondCurve.virtualTokenReserve();
        uint256 secondUSDCReserveBefore = secondCurve.virtualUSDCReserve();

        fakeUSDC.faucet(10e18);
        fakeUSDC.approve(firstCurveAddress, 10e18);
        firstCurve.buy(10e18, 0);

        assertEq(secondCurve.virtualTokenReserve(), secondTokenReserveBefore);
        assertEq(secondCurve.virtualUSDCReserve(), secondUSDCReserveBefore);
        assertEq(MemeToken(secondTokenAddress).balanceOf(alice), 0);
    }
}