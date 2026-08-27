// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FakeUSDC} from "../contracts/FakeUSDC.sol";
import {MemeToken} from "../contracts/MemeToken.sol";
import {LPToken} from "../contracts/LPToken.sol";

contract SimpleAMM {
    IERC20 public token;
    IERC20 public fakeUSDC;
    address public immutable curve;
    uint256 public constant FEE = 50; // 50bp fee (0.5%)

    uint256 public tokenReserve;
    uint256 public usdcReserve;

    // mapping(address => uint256) public liquidityShares;
    LPToken public lpToken;
    uint256 public totalLPSupply = 0;

    constructor(address _token, address _fakeUSDC, address _curve) {
        token = IERC20(_token);
        fakeUSDC = IERC20(_fakeUSDC);
        lpToken = new LPToken("LP Token", "LPT");
        curve = _curve;
    }

    function initializePool(uint256 tokenAmount, uint256 usdcAmount) external {
        require(msg.sender == curve, "Only curve can initialize pool");
        require(tokenReserve == 0 && usdcReserve == 0, "Pool already initialized");
        token.transferFrom(msg.sender, address(this), tokenAmount);
        fakeUSDC.transferFrom(msg.sender, address(this), usdcAmount);
        tokenReserve = tokenAmount;
        usdcReserve = usdcAmount;

        totalLPSupply = Math.sqrt(tokenAmount * usdcAmount);
        lpToken.mint(curve, totalLPSupply);
    }

    function swapTokenForUSDC(uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "Amount must be greater than 0");
        uint256 amountOut = (amountIn * usdcReserve * (10000 - FEE)) / ((tokenReserve + amountIn) * 10000);
        require(amountOut > 0 && amountOut >= minAmountOut, "Insufficient output amount");
        token.transferFrom(msg.sender, address(this), amountIn);
        fakeUSDC.transfer(msg.sender, amountOut);
        tokenReserve += amountIn;
        usdcReserve -= amountOut;
    }

    function swapUSDCforToken(uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "Amount must be greater than 0");
        uint256 amountOut = (amountIn * tokenReserve * (10000 - FEE)) / ((usdcReserve + amountIn) * 10000);
        require(amountOut > 0 && amountOut >= minAmountOut, "Insufficient output amount");
        fakeUSDC.transferFrom(msg.sender, address(this), amountIn);
        token.transfer(msg.sender, amountOut);
        usdcReserve += amountIn;
        tokenReserve -= amountOut;
    }

    function addLiquidity(uint256 tokenAmount, uint256 usdcAmount) external {
        require(tokenAmount > 0 && usdcAmount > 0, "Amounts must be greater than 0");

        uint256 tokenAmountUsed = tokenAmount;
        uint256 usdcAmountUsed = usdcAmount;

        if (tokenAmount * usdcReserve > usdcAmount * tokenReserve) {
            tokenAmountUsed = usdcAmount * tokenReserve / usdcReserve;
        } else if (tokenAmount * usdcReserve < usdcAmount * tokenReserve) {
            usdcAmountUsed = tokenAmount * usdcReserve / tokenReserve;
        }

        require(tokenAmountUsed > 0 && usdcAmountUsed > 0, "Insufficient liquidity amount");

        token.transferFrom(msg.sender, address(this), tokenAmountUsed);
        fakeUSDC.transferFrom(msg.sender, address(this), usdcAmountUsed);

        uint256 lpMinted = totalLPSupply * tokenAmountUsed / tokenReserve;

        tokenReserve += tokenAmountUsed;
        usdcReserve += usdcAmountUsed;
        
        lpToken.mint(msg.sender, lpMinted);
        totalLPSupply += lpMinted;
    }

    function removeLiquidity(uint256 lpAmount) external {
        require(lpToken.balanceOf(msg.sender) > 0, "No liquidity shares");
        require(lpAmount > 0 && lpAmount <= lpToken.balanceOf(msg.sender), "Invalid LP amount");

        require(totalLPSupply > 0, "No liquidity in pool");
        uint256 tokenAmount = tokenReserve * lpAmount / totalLPSupply;
        uint256 usdcAmount = usdcReserve * lpAmount / totalLPSupply;

        require(tokenAmount > 0 && usdcAmount > 0, "Insufficient liquidity amount");

        lpToken.burn(msg.sender, lpAmount);
        totalLPSupply -= lpAmount;

        tokenReserve -= tokenAmount;
        usdcReserve -= usdcAmount;

        token.transfer(msg.sender, tokenAmount);
        fakeUSDC.transfer(msg.sender, usdcAmount);
    }
}