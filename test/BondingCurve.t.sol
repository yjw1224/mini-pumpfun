// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {BondingCurve} from "../contracts/BondingCurve.sol";
import {MemeToken} from "../contracts/MemeToken.sol";

contract BondingCurveTest is Test {
    FakeUSDC fakeUSDC;
    MemeToken memeToken;
    BondingCurve curve;

    address master = makeAddr("master");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        fakeUSDC = new FakeUSDC();
        vm.prank(creator);
        memeToken = new MemeToken("Meme Token", "MT");
        vm.prank(creator);
        curve = new BondingCurve(address(memeToken), address(fakeUSDC), master);
        vm.prank(creator);
        memeToken.setCurve(address(curve));
        curve.initialize();
    }

    function test_Initialize() public {
        assertEq(memeToken.balanceOf(address(curve)), 100 * 1e18, "Curve should have 100 tokens after initialization");
        assertEq(curve.realTokenReserve(), 100 * 1e18, "Real token reserve should be 100 after initialization");
        assertEq(curve.realUSDCReserve(), 0, "Real USDC reserve should be 0 after initialization");
    }

    function test_BobCannotMint() public {
        vm.expectRevert("Only curve");
        vm.prank(bob);
        memeToken.mint(bob, 1000 ether);
    }

    function test_BuyTokens() public {
        uint256 usdcAmount = 10 * 1e6; // 10 USDC in
        vm.prank(alice);
        fakeUSDC.faucet(usdcAmount);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), usdcAmount);

        uint256 tokensBefore = memeToken.balanceOf(alice);
        uint256 usdcBefore = fakeUSDC.balanceOf(alice);

        vm.prank(alice);
        curve.buy(usdcAmount);

        uint256 tokensAfter = memeToken.balanceOf(alice);
        uint256 usdcAfter = fakeUSDC.balanceOf(alice);

        // Alice balances
        assertEq(tokensBefore, 0);
        assertEq(tokensAfter, 9_900_990_099_009_900_990);

        assertEq(usdcBefore, 10 * 1e6);
        assertEq(usdcAfter, 0);

        // Virtual reserves
        assertEq(
            curve.virtualUSDCReserve(),
            1_010 * 1e6
        );

        assertEq(
            curve.virtualTokenReserve(),
            990_099_009_900_990_099_010
        );

        // Real reserves
        assertEq(
            curve.realUSDCReserve(),
            10 * 1e6
        );

        assertEq(
            curve.realTokenReserve(),
            90_099_009_900_990_099_010
        );

        // Actual token balance held by Curve
        assertEq(
            memeToken.balanceOf(address(curve)),
            90_099_009_900_990_099_010
        );

        // Actual USDC balance held by Curve
        assertEq(
            fakeUSDC.balanceOf(address(curve)),
            10 * 1e6
        );
    }

    function test_SellTokens() public {
        uint256 usdcAmount = 10 * 1e6; // 10 USDC in
        vm.prank(alice);
        fakeUSDC.faucet(usdcAmount);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), usdcAmount);

        vm.prank(alice);
        curve.buy(usdcAmount);

        uint256 tokensBefore = memeToken.balanceOf(alice);

        uint256 tokensToSell = tokensBefore / 2;

        vm.prank(alice);
        memeToken.approve(address(curve), tokensToSell);

        uint256 usdcBefore = fakeUSDC.balanceOf(alice);

        vm.prank(alice);
        curve.sell(tokensToSell);

        uint256 usdcAfter = fakeUSDC.balanceOf(alice);

        assertGt(usdcAfter, usdcBefore, "Alice should have more USDC after selling tokens");
        assertLt(memeToken.balanceOf(alice), tokensBefore, "Alice should have fewer tokens after selling");

        // reserve
        assertEq(
            curve.realUSDCReserve(),
            10 * 1e6 - (usdcAfter - usdcBefore)
        );

        assertEq(
            curve.realTokenReserve(),
            90_099_009_900_990_099_010 + tokensToSell
        );
    }

}
