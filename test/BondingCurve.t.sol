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
        vm.prank(creator);
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
        uint256 usdcAmount = 10 * 1e6; // 10 USDC

        vm.prank(alice);
        fakeUSDC.faucet(usdcAmount);

        vm.prank(alice);
        fakeUSDC.approve(address(curve), usdcAmount);

        uint256 tokensBefore = memeToken.balanceOf(alice);
        uint256 usdcBefore = fakeUSDC.balanceOf(alice);

        uint256 masterBefore = fakeUSDC.balanceOf(master);
        uint256 creatorBefore = fakeUSDC.balanceOf(creator);

        vm.prank(alice);
        curve.buy(usdcAmount);

        uint256 tokensAfter = memeToken.balanceOf(alice);
        uint256 usdcAfter = fakeUSDC.balanceOf(alice);

        uint256 masterAfter = fakeUSDC.balanceOf(master);
        uint256 creatorAfter = fakeUSDC.balanceOf(creator);

        // Alice balances

        assertEq(tokensBefore, 0);

        assertEq(
            tokensAfter,
            9_802_950_787_206_654_124
        );

        assertEq(usdcBefore, 10 * 1e6);
        assertEq(usdcAfter, 0);


        // Fee distribution

        assertEq(
            masterAfter - masterBefore,
            70_000 // 0.07 USDC
        );

        assertEq(
            creatorAfter - creatorBefore,
            30_000 // 0.03 USDC
        );


        // Virtual reserves

        assertEq(
            curve.virtualUSDCReserve(),
            1_009_900_000 // 1009.9 USDC
        );

        assertEq(
            curve.virtualTokenReserve(),
            990_197_049_212_793_345_876
        );


        // Real reserves

        assertEq(
            curve.realUSDCReserve(),
            9_900_000 // 9.9 USDC
        );

        assertEq(
            curve.realTokenReserve(),
            90_197_049_212_793_345_876
        );


        // Actual token balance held by Curve

        assertEq(
            memeToken.balanceOf(address(curve)),
            90_197_049_212_793_345_876
        );


        // Actual USDC balance held by Curve

        assertEq(
            fakeUSDC.balanceOf(address(curve)),
            9_900_000
        );
    }

    function test_SellTokens() public {
        uint256 usdcAmount = 10 * 1e6; // 10 USDC in

        vm.prank(alice);
        fakeUSDC.faucet(usdcAmount);

        vm.prank(alice);
        fakeUSDC.approve(address(curve), usdcAmount);

        // Buy
        vm.prank(alice);
        curve.buy(usdcAmount);

        uint256 tokensBefore = memeToken.balanceOf(alice);
        uint256 usdcBefore = fakeUSDC.balanceOf(alice);

        uint256 masterBefore = fakeUSDC.balanceOf(master);
        uint256 creatorBefore = fakeUSDC.balanceOf(creator);

        uint256 tokensToSell = tokensBefore / 2;

        vm.prank(alice);
        memeToken.approve(address(curve), tokensToSell);

        // Sell
        vm.prank(alice);
        uint256 grossUSDC = curve.sell(tokensToSell);

        uint256 usdcAfter = fakeUSDC.balanceOf(alice);
        uint256 masterAfter = fakeUSDC.balanceOf(master);
        uint256 creatorAfter = fakeUSDC.balanceOf(creator);

        // --------------------------------------------------
        // Alice
        // --------------------------------------------------

        assertEq(
            tokensBefore,
            9_802_950_787_206_654_124
        );

        assertEq(
            tokensToSell,
            4_901_475_393_603_327_062
        );

        assertEq(
            grossUSDC,
            4_974_381
        );

        // Alice receives gross - fee
        assertEq(
            usdcAfter - usdcBefore,
            4_924_638
        );

        assertEq(
            fakeUSDC.balanceOf(alice),
            4_924_638
        );

        assertEq(
            memeToken.balanceOf(alice),
            4_901_475_393_603_327_062
        );

        // --------------------------------------------------
        // Fee distribution
        // --------------------------------------------------

        // Total fee = 49,743
        assertEq(
            masterAfter - masterBefore,
            34_820
        );

        assertEq(
            creatorAfter - creatorBefore,
            14_923
        );

        // --------------------------------------------------
        // Virtual reserves
        // --------------------------------------------------

        assertEq(
            curve.virtualUSDCReserve(),
            1_004_925_619
        );

        assertEq(
            curve.virtualTokenReserve(),
            995_098_524_606_396_672_938
        );

        // --------------------------------------------------
        // Real reserves
        // --------------------------------------------------

        assertEq(
            curve.realUSDCReserve(),
            4_925_619
        );

        assertEq(
            curve.realTokenReserve(),
            95_098_524_606_396_672_938
        );

        // --------------------------------------------------
        // Actual Curve balances
        // --------------------------------------------------

        assertEq(
            fakeUSDC.balanceOf(address(curve)),
            4_925_619
        );

        assertEq(
            memeToken.balanceOf(address(curve)),
            95_098_524_606_396_672_938
        );
    }

}
