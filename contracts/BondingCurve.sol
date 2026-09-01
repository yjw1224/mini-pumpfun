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

    uint256 public constant TOTAL_SUPPLY = 10_000_000 * 1e18;
    uint256 public constant INITIAL_MCAP = 1_000 * 1e18;
    uint256 public constant GRADUATION_MCAP = 100_000 * 1e18;
    uint256 public constant INITIAL_TOKEN_RESERVE = 9_000_000 * 1e18;
    uint256 public constant FEE = 100; // 100bp fee (1%)
    uint256 public constant FEE_PROTOCOL = 70; // 70bp fee to protocol (0.7%)
    uint256 public virtualTokenReserve;
    uint256 public virtualUSDCReserve;
    
    uint256 public realTokenReserve = 0;
    uint256 public realUSDCReserve = 0;
    SimpleAMM public amm;

    event TokensPurchased(address indexed buyer, uint256 usdcIn, uint256 tokensOut, uint256 price);
    event TokensSold(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 price);
    event Graduated(address indexed amm);

    constructor(
        address _token,
        address _fakeUSDC,
        address _master,
        address _creator
    ) Ownable(msg.sender) {
        isInitialized = false;
        graduated = false;
        token = MemeToken(_token);
        fakeUSDC = IERC20(_fakeUSDC);

        virtualTokenReserve = TOTAL_SUPPLY;
        virtualUSDCReserve = INITIAL_MCAP;

        realTokenReserve = INITIAL_TOKEN_RESERVE;

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

        emit TokensPurchased(msg.sender, amountIn, amountOut, currentPrice());

        if (marketCap() >= GRADUATION_MCAP) {
            _graduate();
        }
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

        emit TokensSold(msg.sender, amountIn, netAmountOut, currentPrice());
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

    function currentPrice() public view returns (uint256) {
        return virtualUSDCReserve * 1e18 / virtualTokenReserve;
    }

    function marketCap() public view returns (uint256) {
        return currentPrice() * TOTAL_SUPPLY / 1e18;
    }

    // Permissionless: anyone can trigger graduation once the market cap threshold is met.
    function graduate() external {
        _graduate();
    }

    function _graduate() internal {
        require(marketCap() >= GRADUATION_MCAP, "Market cap below graduation threshold");
        require(!graduated, "Already graduated");
        graduated = true;

        uint256 tokenAmount = TOTAL_SUPPLY - token.totalSupply();
        uint256 remainingUSDC = fakeUSDC.balanceOf(address(this));

        token.mint(address(this), tokenAmount);

        // you have to approve before making simpleamm swap
        amm = new SimpleAMM(address(token), address(fakeUSDC), address(this));
        token.approve(address(amm), tokenAmount);
        fakeUSDC.approve(address(amm), remainingUSDC);

        amm.initializePool(tokenAmount, remainingUSDC);

        emit Graduated(address(amm));
    }
}
