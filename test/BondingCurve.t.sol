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
    uint256 constant initialTokenPrice = 1e18; // 1 USDC

    function setUp() public {
        fakeUSDC = new FakeUSDC();
        assertEq(fakeUSDC.decimals(), 18, "Decimal is not 1e18");

        vm.prank(creator);
        memeToken = new MemeToken("Meme Token", "MT");
        vm.prank(creator);
        curve = new BondingCurve(address(memeToken), address(fakeUSDC), master, initialTokenPrice);
        vm.prank(creator);
        memeToken.setCurve(address(curve));
        vm.prank(creator);
        curve.initialize();
    }

    function test_Initialize() public view {
        assertEq(
            memeToken.balanceOf(address(curve)),
            800_000 * 1e18,
            "Curve should have 800k tokens after initialization"
        );

        assertEq(
            curve.realTokenReserve(),
            800_000 * 1e18,
            "Real token reserve should be 800k after initialization"
        );

        assertEq(
            curve.realUSDCReserve(),
            0,
            "Real USDC reserve should be 0 after initialization"
        );
    }

    function test_InitialReserves() public view {
        assertEq(
            curve.virtualTokenReserve(),
            1_000_000 * 1e18
        );

        assertEq(
            curve.virtualUSDCReserve(),
            1_000_000 * 1e18
        );
    }

    function test_BobCannotMint() public {
        vm.expectRevert("Only curve");
        vm.prank(bob);
        memeToken.mint(bob, 1000 ether);
    }

    function test_BuyTokens() public {
        uint256 usdcAmount = 10 * 1e18; // 10 USDC

        vm.prank(alice);
        fakeUSDC.faucet(usdcAmount);

        vm.prank(alice);
        fakeUSDC.approve(address(curve), usdcAmount);

        uint256 tokensBefore = memeToken.balanceOf(alice);
        uint256 usdcBefore = fakeUSDC.balanceOf(alice);

        uint256 masterBefore = fakeUSDC.balanceOf(master);
        uint256 creatorBefore = fakeUSDC.balanceOf(creator);

        vm.prank(alice);
        curve.buy(
            usdcAmount,
            9_800_902_971_060_586_500 // 1% slippage
        );

        uint256 tokensAfter = memeToken.balanceOf(alice);
        uint256 usdcAfter = fakeUSDC.balanceOf(alice);

        uint256 masterAfter = fakeUSDC.balanceOf(master);
        uint256 creatorAfter = fakeUSDC.balanceOf(creator);

        // --------------------------------------------------
        // Alice balances
        // --------------------------------------------------

        assertEq(tokensBefore, 0);

        assertEq(
            tokensAfter,
            9_899_901_990_970_289_394
        );

        assertEq(
            usdcBefore,
            10 * 1e18
        );

        assertEq(
            usdcAfter,
            0
        );

        // --------------------------------------------------
        // Fee distribution
        // --------------------------------------------------

        assertEq(
            masterAfter - masterBefore,
            70_000_000_000_000_000
        );

        assertEq(
            creatorAfter - creatorBefore,
            30_000_000_000_000_000
        );

        // --------------------------------------------------
        // Virtual reserves
        // --------------------------------------------------

        assertEq(
            curve.virtualUSDCReserve(),
            1_000_009_900_000_000_000_000_000
        );

        assertEq(
            curve.virtualTokenReserve(),
            999_990_100_098_009_029_710_606
        );

        // --------------------------------------------------
        // Real reserves
        // --------------------------------------------------

        assertEq(
            curve.realUSDCReserve(),
            9_900_000_000_000_000_000
        );

        assertEq(
            curve.realTokenReserve(),
            799_990_100_098_009_029_710_606
        );

        // --------------------------------------------------
        // Actual Curve balances
        // --------------------------------------------------

        assertEq(
            memeToken.balanceOf(address(curve)),
            799_990_100_098_009_029_710_606
        );

        assertEq(
            fakeUSDC.balanceOf(address(curve)),
            9_900_000_000_000_000_000
        );
    }

    function test_SellTokens() public {
        uint256 usdcAmount = 10 * 1e18; // 10 USDC

        vm.prank(alice);
        fakeUSDC.faucet(usdcAmount);

        vm.prank(alice);
        fakeUSDC.approve(address(curve), usdcAmount);

        // --------------------------------------------------
        // Buy
        // --------------------------------------------------

        vm.prank(alice);
        curve.buy(
            usdcAmount,
            9_800_902_971_060_586_500 // 1% slippage
        );

        uint256 tokensBefore = memeToken.balanceOf(alice);
        uint256 usdcBefore = fakeUSDC.balanceOf(alice);

        uint256 masterBefore = fakeUSDC.balanceOf(master);
        uint256 creatorBefore = fakeUSDC.balanceOf(creator);

        uint256 tokensToSell = tokensBefore / 2;

        vm.prank(alice);
        memeToken.approve(address(curve), tokensToSell);

        // --------------------------------------------------
        // Sell
        // --------------------------------------------------

        vm.prank(alice);
        uint256 grossUSDC = curve.sell(
            tokensToSell,
            4_851_519_014_781_376_832 // 1% slippage
        );

        uint256 usdcAfter = fakeUSDC.balanceOf(alice);

        uint256 masterAfter = fakeUSDC.balanceOf(master);
        uint256 creatorAfter = fakeUSDC.balanceOf(creator);

        // --------------------------------------------------
        // Alice
        // --------------------------------------------------

        assertEq(
            tokensBefore,
            9_899_901_990_970_289_394
        );

        assertEq(
            tokensToSell,
            4_949_950_995_485_144_697
        );

        // Gross output
        assertEq(
            grossUSDC,
            4_950_024_502_378_713_225
        );

        // Net output after 1% fee
        assertEq(
            usdcAfter - usdcBefore,
            4_900_524_257_354_926_093
        );

        assertEq(
            fakeUSDC.balanceOf(alice),
            4_900_524_257_354_926_093
        );

        assertEq(
            memeToken.balanceOf(alice),
            4_949_950_995_485_144_697
        );

        // --------------------------------------------------
        // Fee distribution
        // --------------------------------------------------

        assertEq(
            masterAfter - masterBefore,
            34_650_171_516_650_992
        );

        assertEq(
            creatorAfter - creatorBefore,
            14_850_073_507_136_140
        );

        // --------------------------------------------------
        // Virtual reserves
        // --------------------------------------------------

        assertEq(
            curve.virtualUSDCReserve(),
            1_000_004_949_975_497_621_286_775
        );

        assertEq(
            curve.virtualTokenReserve(),
            999_995_050_049_004_514_855_303
        );

        // --------------------------------------------------
        // Real reserves
        // --------------------------------------------------

        assertEq(
            curve.realUSDCReserve(),
            4_949_975_497_621_286_775
        );

        assertEq(
            curve.realTokenReserve(),
            799_995_050_049_004_514_855_303
        );

        // --------------------------------------------------
        // Actual Curve balances
        // --------------------------------------------------

        assertEq(
            fakeUSDC.balanceOf(address(curve)),
            4_949_975_497_621_286_775
        );

        assertEq(
            memeToken.balanceOf(address(curve)),
            799_995_050_049_004_514_855_303
        );
    }
}