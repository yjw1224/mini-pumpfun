// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;

// import {Test} from "forge-std/Test.sol";
// import {MemeToken} from "../contracts/MemeToken.sol";

// contract MemeTokenTest is Test {
//     MemeToken token;

//     address curve = makeAddr("curve");
//     address alice = makeAddr("alice");

//     function setUp() public {
//         token = new MemeToken(
//             "Test Meme",
//             "MEME"
//         );

//         token.setCurve(curve);
//     }

//     function test_InitialSupplyIsZero() public view {
//         assertEq(token.totalSupply(), 0);
//     }

//     function test_TokenMetadata() public view {
//         assertEq(token.name(), "Test Meme");
//         assertEq(token.symbol(), "MEME");
//         assertEq(token.decimals(), 18);
//     }

//     function test_CurveCanMint() public {
//         vm.prank(curve);

//         token.mint(alice, 1000 ether);

//         assertEq(token.balanceOf(alice), 1000 ether);
//     }

//     function test_NonCurveCannotMint() public {
//         vm.expectRevert("Only curve");

//         vm.prank(alice);
//         token.mint(alice, 1000 ether);
//     }
// }