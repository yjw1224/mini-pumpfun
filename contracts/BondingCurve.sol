// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from
    "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SimpleAMM} from "./SimpleAMM.sol";
import "./MemeToken.sol";

contract BondingCurve is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    MemeToken public token;
    IERC20 public fakeUSDC;
    bool isInitialized;
    bool graduated;
    address public immutable master;
    address public immutable creator;

    uint256 private immutable INITIAL_PRICE;
    uint256 public constant MAX_TOKEN_SUPPLY = 1_000_000 * 1e18; // 1 million tokens
    uint256 public constant INITIAL_TOKEN_RESERVE = 800_000 * 1e18; // 800k tokens
    uint256 public constant FEE = 100; // 100bp fee (1%)
    uint256 public constant FEE_PROTOCOL = 70; // 70bp fee to protocol (0.7%)
    uint256 public virtualTokenReserve;
    uint256 public virtualUSDCReserve;
    
    uint256 public realTokenReserve = 0;
    uint256 public realUSDCReserve = 0;
    SimpleAMM public amm;

    constructor(
        address _token,
        address _fakeUSDC,
        address _master,
        uint256 _initialPrice,
        address _creator
    ) Ownable(msg.sender) {
        isInitialized = false;
        graduated = false;
        token = MemeToken(_token);
        fakeUSDC = IERC20(_fakeUSDC);

        virtualTokenReserve = 1_000_000 * 1e18; // 1 million token
        INITIAL_PRICE = _initialPrice;
        virtualUSDCReserve = INITIAL_PRICE * virtualTokenReserve / 1e18;

        realTokenReserve = INITIAL_TOKEN_RESERVE; // 800k token

        master = _master;
        creator = _creator;
    }

    function initialize() external onlyOwner {
        require(!isInitialized, "Already initialized");
        token.mint(address(this), INITIAL_TOKEN_RESERVE);
        isInitialized = true;
    }

    function buy(uint256 amountIn, uint256 minAmountOut) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Amount in must be greater than 0");
        require(!graduated, "Cannot buy after graduation");

        uint256 fee = amountIn * FEE / 10000;
        uint256 masterFee = fee * FEE_PROTOCOL / FEE;
        uint256 creatorFee = fee - masterFee;
        uint256 amountInAfterFee = amountIn - fee;
        amountOut = (virtualTokenReserve * amountInAfterFee) / (virtualUSDCReserve + amountInAfterFee);

        require(realTokenReserve >= amountOut, "Not enough tokens in reserve");
        require(amountOut >= minAmountOut, "Slippage exceeded");

        virtualTokenReserve -= amountOut;
        virtualUSDCReserve += amountInAfterFee;

        realTokenReserve -= amountOut;
        realUSDCReserve += amountInAfterFee;

        // Transfer USDC from buyer to this contract
        fakeUSDC.safeTransferFrom(msg.sender, address(this), amountIn);
        fakeUSDC.safeTransfer(master, masterFee); // Transfer fee to master
        fakeUSDC.safeTransfer(creator, creatorFee); // Transfer fee to creator
        IERC20(address(token)).safeTransfer(msg.sender, amountOut);
    }

    function sell(uint256 amountIn, uint256 minAmountOut) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Amount in must be greater than 0");
        require(!graduated, "Cannot sell after graduation");
        amountOut = (virtualUSDCReserve * amountIn) / (virtualTokenReserve + amountIn);

        require(realUSDCReserve >= amountOut, "Not enough USDC in reserve");
        
        uint256 fee = amountOut * FEE / 10000;
        uint256 masterFee = fee * FEE_PROTOCOL / FEE;
        uint256 creatorFee = fee - masterFee;
        uint256 netAmountOut = amountOut - fee;

        require(netAmountOut >= minAmountOut, "Slippage exceeded");

        virtualTokenReserve += amountIn;
        virtualUSDCReserve -= amountOut;

        realTokenReserve += amountIn;
        realUSDCReserve -= amountOut;

        // Transfer tokens from seller to this contract
        IERC20(address(token)).safeTransferFrom(msg.sender, address(this), amountIn);

        fakeUSDC.safeTransfer(msg.sender, netAmountOut);
        fakeUSDC.safeTransfer(master, masterFee); // Transfer fee to master
        fakeUSDC.safeTransfer(creator, creatorFee); // Transfer fee to creator
    }

    function getBuyAmountOut(uint256 amountIn) external view returns (uint256 amountOut) {
        uint256 fee = amountIn * FEE / 10000;
        uint256 amountInAfterFee = amountIn - fee;
        amountOut = (virtualTokenReserve * amountInAfterFee) / (virtualUSDCReserve + amountInAfterFee);
    }

    function getSellAmountOut(uint256 amountIn) external view returns (uint256 netAmountOut) {
        uint256 amountOut = (virtualUSDCReserve * amountIn) / (virtualTokenReserve + amountIn);
        uint256 fee = amountOut * FEE / 10000;
        netAmountOut = amountOut - fee;
    }

    // Permissionless: anyone can trigger graduation once the reserve condition is met.
    function graduate() external {
        require(realTokenReserve == 0, "Token reserve must be 0 to graduate");
        require(!graduated, "Already graduated");
        graduated = true;

        uint256 tokenAmount = MAX_TOKEN_SUPPLY - token.totalSupply();
        uint256 remainingUSDC = fakeUSDC.balanceOf(address(this));

        token.mint(address(this), tokenAmount);

        // you have to approve before making simpleamm swap
        amm = new SimpleAMM(address(token), address(fakeUSDC), address(this));
        token.approve(address(amm), tokenAmount);
        fakeUSDC.approve(address(amm), remainingUSDC);

        amm.initializePool(tokenAmount, remainingUSDC);
    }
}
