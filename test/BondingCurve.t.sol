// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {BondingCurve} from "../contracts/BondingCurve.sol";
import {MemeToken} from "../contracts/MemeToken.sol";
import {SimpleAMM} from "../contracts/SimpleAMM.sol";
import {LPToken} from "../contracts/LPToken.sol";
import {Factory} from "../contracts/Factory.sol";

contract BondingCurveTest is Test {
    FakeUSDC fakeUSDC;
    MemeToken memeToken;
    BondingCurve curve;

    address master = makeAddr("master");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant initialTokenPrice = 1e18; // 1 USDC
    uint256 constant BUY_ALL_TOKENS_USDC = 4_040_404_040_404_040_404_040_405;
    uint256 constant GRADUATION_USDC_RESERVE = 4_000_000_000_000_000_000_000_001;
    uint256 constant AMM_TOKEN_SWAP_IN = 1e18; // 1 token
    uint256 constant AMM_TOKEN_SWAP_OUT = 19_899_900_500_497_497_512;
    uint256 constant AMM_USDC_SWAP_IN = 1e18;
    uint256 constant AMM_USDC_SWAP_OUT = 49_750_483_819_798_511;
    uint256 constant LP_ADD_TOKEN_AMOUNT = 1_000 * 1e18;
    uint256 constant LP_ADD_USDC_AMOUNT = 20_000 * 1e18;
    uint256 constant LP_ADD_TOKEN_USED = 999_999_999_999_999_999_999;
    uint256 constant LP_ADD_TOKEN_RETURNED = 999_999_999_999_999_999_998;
    uint256 constant LP_ADD_USDC_RETURNED = 19_999_999_999_999_999_999_976;
    uint256 constant BOB_SWAP_USDC_AMOUNT = 20_000 * 1e18;
    uint256 constant INITIAL_POOL_USDC_PER_TOKEN = 20;

    function setUp() public {
        fakeUSDC = new FakeUSDC();
        assertEq(fakeUSDC.decimals(), 18, "Decimal is not 1e18");

        vm.prank(creator);
        memeToken = new MemeToken("Meme Token", "MT");
        vm.prank(creator);
        curve = new BondingCurve(address(memeToken), address(fakeUSDC), master, initialTokenPrice, creator);
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

    function test_FactoryCreatesTokenAndCurve() public {
        vm.prank(creator);
        Factory factory = new Factory(address(fakeUSDC), master);

        vm.prank(alice);
        (address tokenAddress, address curveAddress) = factory.createToken(
            "Doge",
            "DOGE",
            initialTokenPrice
        );

        MemeToken createdToken = MemeToken(tokenAddress);
        BondingCurve createdCurve = BondingCurve(curveAddress);

        assertEq(createdToken.curve(), curveAddress);
        assertEq(address(createdCurve.token()), tokenAddress);
        assertEq(createdCurve.creator(), alice);
        assertEq(createdToken.owner(), alice);
        assertEq(createdCurve.owner(), alice);
        assertEq(createdToken.balanceOf(curveAddress), 800_000 * 1e18);
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

    function test_Graduation() public {
        // Ensure the curve is initialized and has no real token reserve

        assertEq(curve.realTokenReserve(), 800_000 * 1e18);

        // Buy exactly the 800k tokens held in the real reserve.
        vm.prank(alice);
        fakeUSDC.faucet(BUY_ALL_TOKENS_USDC);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), BUY_ALL_TOKENS_USDC);
        vm.prank(alice);
        curve.buy(BUY_ALL_TOKENS_USDC, 0);

        assertEq(curve.realTokenReserve(), 0);

        vm.prank(creator);
        curve.graduate();

        assertEq(memeToken.totalSupply(), 1_000_000 * 1e18);
        assertEq(memeToken.balanceOf(address(curve)), 0);
        assertEq(curve.realTokenReserve(), 0);
    }

    function test_AfterGraduation() public {
        // Buy all tokens to graduate
        vm.prank(alice);
        fakeUSDC.faucet(BUY_ALL_TOKENS_USDC);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), BUY_ALL_TOKENS_USDC);
        vm.prank(alice);
        curve.buy(BUY_ALL_TOKENS_USDC, 0);

        // Graduate
        vm.prank(creator);
        curve.graduate();

        SimpleAMM amm = curve.amm();
        assertTrue(address(amm) != address(0));
        assertEq(address(amm.token()), address(memeToken));
        assertEq(address(amm.fakeUSDC()), address(fakeUSDC));
        assertEq(amm.curve(), address(curve));
        assertEq(amm.tokenReserve(), 200_000 * 1e18);
        assertEq(amm.usdcReserve(), GRADUATION_USDC_RESERVE);
        assertEq(memeToken.balanceOf(address(amm)), 200_000 * 1e18);
        assertEq(fakeUSDC.balanceOf(address(amm)), GRADUATION_USDC_RESERVE);
        LPToken lpToken = amm.lpToken();
        assertEq(lpToken.balanceOf(address(curve)), lpToken.totalSupply());
        assertGt(lpToken.totalSupply(), 0);
        assertEq(memeToken.balanceOf(address(curve)), 0);
        assertEq(fakeUSDC.balanceOf(address(curve)), 0);

        uint256 aliceTokenBefore = memeToken.balanceOf(alice);
        uint256 aliceUSDCBefore = fakeUSDC.balanceOf(alice);
        vm.prank(alice);
        memeToken.approve(address(amm), AMM_TOKEN_SWAP_IN);
        vm.prank(alice);
        amm.swapTokenForUSDC(AMM_TOKEN_SWAP_IN, AMM_TOKEN_SWAP_OUT);

        assertEq(memeToken.balanceOf(alice), aliceTokenBefore - AMM_TOKEN_SWAP_IN);
        assertEq(fakeUSDC.balanceOf(alice), aliceUSDCBefore + AMM_TOKEN_SWAP_OUT);
        assertEq(amm.tokenReserve(), 200_000 * 1e18 + AMM_TOKEN_SWAP_IN);
        assertEq(amm.usdcReserve(), GRADUATION_USDC_RESERVE - AMM_TOKEN_SWAP_OUT);

        vm.prank(alice);
        fakeUSDC.faucet(AMM_USDC_SWAP_IN);
        aliceUSDCBefore = fakeUSDC.balanceOf(alice);
        aliceTokenBefore = memeToken.balanceOf(alice);
        vm.prank(alice);
        fakeUSDC.approve(address(amm), AMM_USDC_SWAP_IN);
        vm.prank(alice);
        amm.swapUSDCforToken(AMM_USDC_SWAP_IN, AMM_USDC_SWAP_OUT);

        assertEq(fakeUSDC.balanceOf(alice), aliceUSDCBefore - AMM_USDC_SWAP_IN);
        assertEq(memeToken.balanceOf(alice), aliceTokenBefore + AMM_USDC_SWAP_OUT);
        assertEq(amm.tokenReserve(), 200_000 * 1e18 + AMM_TOKEN_SWAP_IN - AMM_USDC_SWAP_OUT);
        assertEq(amm.usdcReserve(), GRADUATION_USDC_RESERVE - AMM_TOKEN_SWAP_OUT + AMM_USDC_SWAP_IN);

        // Attempt to buy after graduation
        vm.prank(alice);
        fakeUSDC.faucet(1e18);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), 1e18);

        vm.expectRevert("Cannot buy after graduation");
        vm.prank(alice);
        curve.buy(1e18, 0);

        // Attempt to sell after graduation
        uint256 tokensToSell = memeToken.balanceOf(alice) / 2;
        vm.prank(alice);
        memeToken.approve(address(curve), tokensToSell);

        vm.expectRevert("Cannot sell after graduation");
        vm.prank(alice);
        curve.sell(tokensToSell, 0);
    }

    function test_AddAndRemoveLiquidity() public {
        SimpleAMM amm = _graduateAndGetAmm();
        LPToken lpToken = amm.lpToken();
        uint256 initialLPSupply = lpToken.totalSupply();

        vm.prank(alice);
        fakeUSDC.faucet(LP_ADD_USDC_AMOUNT);
        vm.startPrank(alice);
        memeToken.approve(address(amm), LP_ADD_TOKEN_AMOUNT);
        fakeUSDC.approve(address(amm), LP_ADD_USDC_AMOUNT);
        amm.addLiquidity(LP_ADD_TOKEN_AMOUNT, LP_ADD_USDC_AMOUNT);
        vm.stopPrank();

        uint256 aliceLP = lpToken.balanceOf(alice);
        assertGt(aliceLP, 0);
        assertEq(lpToken.totalSupply(), initialLPSupply + aliceLP);
        assertEq(amm.tokenReserve(), 200_000 * 1e18 + LP_ADD_TOKEN_USED);
        assertEq(amm.usdcReserve(), 4_020_000 * 1e18 + 1);

        uint256 aliceTokenBefore = memeToken.balanceOf(alice);
        uint256 aliceUSDCBefore = fakeUSDC.balanceOf(alice);
        vm.prank(alice);
        amm.removeLiquidity(aliceLP);

        assertEq(memeToken.balanceOf(alice), aliceTokenBefore + LP_ADD_TOKEN_RETURNED);
        assertEq(fakeUSDC.balanceOf(alice), aliceUSDCBefore + LP_ADD_USDC_RETURNED);
        assertEq(lpToken.balanceOf(alice), 0);
        assertEq(lpToken.totalSupply(), initialLPSupply);
        assertEq(amm.tokenReserve(), 200_000 * 1e18 + 1);
        assertEq(amm.usdcReserve(), GRADUATION_USDC_RESERVE + 24);
    }

    function test_SwapThenRemoveLiquidity() public {
        SimpleAMM amm = _graduateAndGetAmm();

        vm.prank(alice);
        fakeUSDC.faucet(LP_ADD_USDC_AMOUNT);
        vm.startPrank(alice);
        memeToken.approve(address(amm), LP_ADD_TOKEN_AMOUNT);
        fakeUSDC.approve(address(amm), LP_ADD_USDC_AMOUNT);
        amm.addLiquidity(LP_ADD_TOKEN_AMOUNT, LP_ADD_USDC_AMOUNT);
        vm.stopPrank();

        LPToken lpToken = amm.lpToken();
        uint256 aliceLP = lpToken.balanceOf(alice);
        assertGt(aliceLP, 0);
        uint256 usdcReserveBeforeSwap = amm.usdcReserve();
        vm.prank(bob);
        fakeUSDC.faucet(BOB_SWAP_USDC_AMOUNT);
        vm.prank(bob);
        fakeUSDC.approve(address(amm), BOB_SWAP_USDC_AMOUNT);
        vm.prank(bob);
        amm.swapUSDCforToken(BOB_SWAP_USDC_AMOUNT, 0);

        assertGt(amm.usdcReserve(), usdcReserveBeforeSwap);

        uint256 aliceTokenBefore = memeToken.balanceOf(alice);
        uint256 aliceUSDCBefore = fakeUSDC.balanceOf(alice);
        vm.prank(alice);
        amm.removeLiquidity(aliceLP);

        uint256 tokenReturned = memeToken.balanceOf(alice) - aliceTokenBefore;
        uint256 usdcReturned = fakeUSDC.balanceOf(alice) - aliceUSDCBefore;
        uint256 initialValue = LP_ADD_TOKEN_AMOUNT * INITIAL_POOL_USDC_PER_TOKEN + LP_ADD_USDC_AMOUNT;
        uint256 returnedValue = tokenReturned * INITIAL_POOL_USDC_PER_TOKEN + usdcReturned;

        assertGt(returnedValue, initialValue);
        assertEq(lpToken.balanceOf(alice), 0);
    }

    function _graduateAndGetAmm() internal returns (SimpleAMM) {
        vm.prank(alice);
        fakeUSDC.faucet(BUY_ALL_TOKENS_USDC);
        vm.prank(alice);
        fakeUSDC.approve(address(curve), BUY_ALL_TOKENS_USDC);
        vm.prank(alice);
        curve.buy(BUY_ALL_TOKENS_USDC, 0);

        vm.prank(creator);
        curve.graduate();
        return curve.amm();
    }
}