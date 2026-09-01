// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {BondingCurve} from "../contracts/BondingCurve.sol";
import {MemeToken} from "../contracts/MemeToken.sol";
import {SimpleAMM} from "../contracts/SimpleAMM.sol";

contract BondingCurveTest is Test {
    uint256 internal constant GRADUATION_BUY_AMOUNT = 9_090_909_090_909_090_909_090;

    FakeUSDC internal fakeUSDC;
    MemeToken internal memeToken;
    BondingCurve internal curve;

    address internal master = makeAddr("master");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");

    function setUp() public {
        fakeUSDC = new FakeUSDC();

        vm.prank(creator);
        memeToken = new MemeToken("Meme Token", "MT", "ipfs://meme-token");
        vm.prank(creator);
        curve = new BondingCurve(address(memeToken), address(fakeUSDC), master, creator);
        vm.prank(creator);
        memeToken.setCurve(address(curve));
        vm.prank(creator);
        curve.initialize();
    }

    function test_InitialMCapAndPriceQuotes() public view {
        assertEq(memeToken.MAX_SUPPLY(), 10_000_000 * 1e18);
        assertEq(curve.TOTAL_SUPPLY(), 10_000_000 * 1e18);
        assertEq(curve.INITIAL_TOKEN_RESERVE(), 9_000_000 * 1e18);
        assertEq(curve.virtualTokenReserve(), 10_000_000 * 1e18);
        assertEq(curve.virtualUSDCReserve(), 1_000 * 1e18);
        assertEq(curve.realTokenReserve(), 9_000_000 * 1e18);
        assertEq(curve.currentPrice(), 1e14);
        assertEq(curve.marketCap(), 1_000 * 1e18);
    }

    function test_BuyAndSellUpdateMCapQuotes() public {
        uint256 buyAmount = 100 * 1e18;
        uint256 initialPrice = curve.currentPrice();
        uint256 initialMCap = curve.marketCap();
        uint256 minimumTokensOut = curve.getBuyAmountOut(buyAmount);

        vm.prank(alice);
        fakeUSDC.faucet(buyAmount);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), buyAmount);
        vm.prank(alice);
        uint256 tokensBought = curve.buy(buyAmount, minimumTokensOut);

        assertGt(tokensBought, 0);
        assertGt(curve.currentPrice(), initialPrice);
        assertGt(curve.marketCap(), initialMCap);

        uint256 priceAfterBuy = curve.currentPrice();
        uint256 mCapAfterBuy = curve.marketCap();
        uint256 minimumUSDCOut = curve.getSellAmountOut(tokensBought);
        vm.prank(alice);
        memeToken.approve(address(curve), tokensBought);
        vm.prank(alice);
        curve.sell(tokensBought, minimumUSDCOut);

        assertLt(curve.currentPrice(), priceAfterBuy);
        assertLt(curve.marketCap(), mCapAfterBuy);
    }

    function test_GraduateRevertsBelowMCapThreshold() public {
        vm.expectRevert("Market cap below graduation threshold");
        curve.graduate();
    }

    function test_BuyAutomaticallyGraduatesAtMCapThreshold() public {
        vm.prank(alice);
        fakeUSDC.faucet(GRADUATION_BUY_AMOUNT);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), GRADUATION_BUY_AMOUNT);
        vm.prank(alice);
        uint256 tokensBought = curve.buy(GRADUATION_BUY_AMOUNT, 9_000_000 * 1e18);

        SimpleAMM amm = curve.amm();
        assertEq(tokensBought, 9_000_000 * 1e18);
        assertEq(curve.marketCap(), curve.GRADUATION_MCAP());
        assertEq(memeToken.totalSupply(), curve.TOTAL_SUPPLY());
        assertEq(memeToken.balanceOf(alice), 9_000_000 * 1e18);
        assertEq(memeToken.balanceOf(address(amm)), 1_000_000 * 1e18);
        assertEq(fakeUSDC.balanceOf(address(amm)), 9_000 * 1e18);

        vm.expectRevert("Cannot buy after graduation");
        vm.prank(alice);
        curve.buy(1, 0);
    }
}