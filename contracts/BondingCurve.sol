// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./MemeToken.sol";

contract BondingCurve is Ownable {
    MemeToken public token;
    IERC20 public fakeUSDC;
    bool isInitialized;
    address public immutable master;
    address public immutable creator;

    uint256 private constant INITIAL_PRICE = 1e6; // 1 USDC
    uint256 public constant FEE = 100; // 100bp fee (1%)
    uint256 public constant FEE_MASTER = 70; // 70bp fee to master (0.7%)
    uint256 public virtualTokenReserve;
    uint256 public virtualUSDCReserve;
    
    uint256 public realTokenReserve = 0;
    uint256 public realUSDCReserve = 0;

    constructor(address _token, address _fakeUSDC, address _master) Ownable(msg.sender) {
        isInitialized = false;
        token = MemeToken(_token);
        fakeUSDC = IERC20(_fakeUSDC);

        virtualTokenReserve = 1000 * 1e18; // 1000 token
        virtualUSDCReserve = INITIAL_PRICE * virtualTokenReserve / 1e18;

        realTokenReserve = 100 * 1e18; // 100 token

        master = _master;
        creator = msg.sender;
    }

    function initialize() external onlyOwner {
        require(!isInitialized, "Already initialized");
        token.mint(address(this), realTokenReserve);
        isInitialized = true;
    }

    function buy(uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount in must be greater than 0");

        uint256 fee = amountIn * FEE / 10000;
        uint256 masterFee = fee * FEE_MASTER / FEE;
        uint256 creatorFee = fee - masterFee;
        uint256 amountInAfterFee = amountIn - fee;
        amountOut = (virtualTokenReserve * amountInAfterFee) / (virtualUSDCReserve + amountInAfterFee);

        require(realTokenReserve >= amountOut, "Not enough tokens in reserve");

        // Transfer USDC from buyer to this contract
        fakeUSDC.transferFrom(msg.sender, address(this), amountIn);
        fakeUSDC.transfer(master, masterFee); // Transfer fee to master
        fakeUSDC.transfer(creator, creatorFee); // Transfer fee to creator
        token.transfer(msg.sender, amountOut);

        virtualTokenReserve -= amountOut;
        virtualUSDCReserve += amountInAfterFee;

        realTokenReserve -= amountOut;
        realUSDCReserve += amountInAfterFee;
    }

    function sell(uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount in must be greater than 0");
        amountOut = (virtualUSDCReserve * amountIn) / (virtualTokenReserve + amountIn);

        require(realUSDCReserve >= amountOut, "Not enough USDC in reserve");

        // Transfer tokens from seller to this contract
        token.transferFrom(msg.sender, address(this), amountIn);

        uint256 fee = amountOut * FEE / 10000;
        uint256 masterFee = fee * FEE_MASTER / FEE;
        uint256 creatorFee = fee - masterFee;

        fakeUSDC.transfer(msg.sender, amountOut - fee);
        fakeUSDC.transfer(master, masterFee); // Transfer fee to master
        fakeUSDC.transfer(creator, creatorFee); // Transfer fee to creator

        virtualTokenReserve += amountIn;
        virtualUSDCReserve -= amountOut;

        realTokenReserve += amountIn;
        realUSDCReserve -= amountOut;
    }
}
