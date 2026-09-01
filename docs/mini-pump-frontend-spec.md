# Mini Pump Frontend Specification

## 1. 목표

현재 구현된 스마트 컨트랙트를 기반으로, 사용자가 Sepolia 테스트넷에서 다음 전체 lifecycle을 실제로 수행할 수 있는 프론트엔드를 만든다.

```text
Wallet 연결
  ↓
Factory에서 Meme Token 생성
  ↓
FakeUSDC 획득
  ↓
Bonding Curve Buy / Sell
  ↓
Graduation
  ↓
SimpleAMM Swap
  ↓
Add / Remove Liquidity
```

### 권장 기술 스택

- Next.js
- TypeScript
- wagmi
- viem
- MetaMask 등 EVM wallet
- 네트워크: Sepolia
- 거래 자산: 개발용 FakeUSDC

---

# 2. 라우팅 구조

```text
/
├── /create
├── /token/[address]
└── /token/[address]/liquidity
```

## `/` — Home / Explore

생성된 Meme Token 목록을 보여준다.

### 화면

```text
Mini Pump

[ Create Token ]

Search...

Recent / Trending Tokens

┌─────────────────────────────┐
│ MEME                        │
│ Meme Token                  │
│ Price: ... USDC             │
│ Market Cap: ...             │
│ Progress: ███████░░ 70%     │
│ [ Trade ]                   │
└─────────────────────────────┘
```

### Token Card

- Name
- Symbol
- Token address
- Creator
- 현재 가격
- Market Cap 또는 FDV
- Bonding Curve 진행률
- Graduation 여부
- Trade 버튼

### 데이터

Factory의 `TokenCreated` 이벤트를 조회하여 Token 목록을 구성한다.

초기 MVP에서는 별도 백엔드/서브그래프 없이 프론트에서 이벤트를 조회한다.

---

# 3. `/create` — Token 생성

## 화면

```text
Create Meme Token

Token Name
[ My Meme Token ]

Symbol
[ MEME ]

Description
[ A cute meme token on Mini Pump. ]

Image
[ Upload image ]

Initial Price
[ 1.0 ] USDC

Fee
1%

Protocol
0.7%

Creator
0.3%

Real Token Reserve
800,000 tokens

[ Create Token ]
```

## 입력

- `name`
- `symbol`
- `description`
- `image`
- `initialPrice`

`initialPrice`는 FakeUSDC 18 decimals 기준으로 `parseUnits(value, 18)` 처리한다.

이미지는 Pinata에 업로드하고 반환된 CID를 `ipfs://<CID>` 형식으로 사용한다. 이후 다음 JSON 메타데이터를 Pinata에 업로드하고, 반환된 JSON CID를 `tokenURI`로 Factory에 전달한다.

```json
{
  "name": "CHIIKAWA",
  "symbol": "CHIKA",
  "description": "A cute meme token on Mini Pump.",
  "image": "ipfs://bafy..."
}
```

## Transaction

```solidity
Factory.createToken(
    name,
    symbol,
  initialPrice,
  tokenURI
)
```

성공 후 `TokenCreated` 이벤트에서 token / curve 주소를 확인하고 `/token/[address]`로 이동한다.

---

# 4. Global Header

모든 페이지에서 공통 사용.

```text
┌─────────────────────────────────────────────────────────┐
│ Mini Pump       Explore   Create        [Connect Wallet]│
└─────────────────────────────────────────────────────────┘
```

### 기능

- Logo → `/`
- Explore → `/`
- Create → `/create`
- Wallet connect
- 연결된 주소 축약 표시
- Sepolia 네트워크 확인
- 잘못된 네트워크면 전환 안내
- ETH balance 표시
- FakeUSDC balance 표시

---

# 5. `/token/[address]` — Token Detail

프론트엔드의 핵심 페이지.

Token 상태에 따라:

```text
Bonding Curve Mode
        OR
Graduated / AMM Mode
```

로 UI를 전환한다.

## 공통 Token Header

```text
MEME
Meme Token

Token
0x1234...5678

Creator
0xabcd...efgh

[Copy Address]
```

표시:

- Name
- Symbol
- Token address
- Creator
- Wallet token balance

---

# 6. Bonding Curve 화면

Graduation 이전에 표시한다.

## 상태

```text
MEME

Price
1.02 USDC

Market Cap
$...

Bonding Curve Progress

██████████████░░░░░░ 72%

576,000 / 800,000 tokens sold

Graduation at 100%
```

### 진행률

현재:

```solidity
curve.realTokenReserve()
```

초기 reserve:

```text
800,000 tokens
```

계산:

```text
progress =
(800,000 - realTokenReserve) / 800,000
```

---

# 7. Buy Panel

```text
Buy MEME

USDC
[ 10.00 ]

You receive
≈ 9.89 MEME

Minimum received
[ 9.79 MEME ]

Fee
0.10 USDC

Protocol
0.07 USDC

Creator
0.03 USDC

[ BUY ]
```

## 흐름

```text
USDC 입력
  ↓
Quote
  ↓
Expected output 표시
  ↓
Slippage 적용
  ↓
Allowance 확인
  ↓
approve()
  ↓
buy()
```

Transaction:

```solidity
curve.buy(
    amountIn,
    minAmountOut
)
```

### Slippage UI

```text
Slippage tolerance
[ 1.00% ]
```

예:

```text
expectedOut = 10 MEME
slippage = 1%

minAmountOut = 9.9 MEME
```

---

# 8. Sell Panel

```text
Sell MEME

MEME
[ 1,000 ]

Available
12,345 MEME

[ 10% ] [ 25% ] [ 50% ] [ MAX ]

You receive
≈ 4.95 USDC

Minimum received
[ 4.90 USDC ]

Fee
...

Protocol
...

Creator
...

[ SELL ]
```

Transaction:

```solidity
curve.sell(
    amountIn,
    minAmountOut
)
```

Allowance 부족 시:

```solidity
token.approve(
    curveAddress,
    amountIn
)
```

후 `sell()` 실행.

### 보유량 빠른 입력

연결된 지갑의 MEME balance를 Sell 입력 아래에 표시한다.

`10%`, `25%`, `50%`, `MAX` 버튼은 현재 지갑의 MEME balance를 기준으로
`amountIn`을 각각 10%, 25%, 50%, 100%로 설정한다.

---

# 9. FakeUSDC Faucet

테스트넷 전용.

```text
Test USDC

Balance
123.00 USDC

[ Get 1,000 Test USDC ]
```

실행:

```solidity
fakeUSDC.faucet(amount)
```

UI에 반드시 `Testnet Only` 또는 `FakeUSDC`임을 표시한다.

---

# 10. Graduation UI

Bonding Curve의:

```solidity
graduated()
```

를 확인한다.

### Before

```text
Bonding Curve
Buy / Sell
Progress
```

### After

```text
Graduated!

Trading is now handled by SimpleAMM.

[ Swap ]
[ Liquidity ]
```

AMM 주소:

```solidity
curve.amm()
```

를 사용한다.

---

# 11. AMM 화면

Graduation 이후 Token Detail에서 표시한다.

## Pool 정보

```text
MEME / USDC

MEME Reserve
200,000

USDC Reserve
...

Current Price
...

Pool
0x....

[ Swap ]
[ Liquidity ]
```

---

# 12. AMM Swap — Token → USDC

```text
Sell MEME

MEME
[ 1,000 ]

        ↓

USDC
[ 4.95 ]

Minimum received
[ 4.90 ]

Fee
1%

Price Impact
...

[ SWAP ]
```

Transaction:

```solidity
amm.swapTokenForUSDC(
    amountIn,
    minAmountOut
)
```

Allowance 부족 시:

```solidity
token.approve(
    ammAddress,
    amountIn
)
```

---

# 13. AMM Swap — USDC → Token

```text
Buy MEME

USDC
[ 10 ]

        ↓

MEME
[ ... ]

Minimum received
[ ... ]

Fee
1%

Price Impact
...

[ SWAP ]
```

Transaction:

```solidity
amm.swapUSDCforToken(
    amountIn,
    minAmountOut
)
```

Allowance 부족 시:

```solidity
fakeUSDC.approve(
    ammAddress,
    amountIn
)
```

---

# 14. `/token/[address]/liquidity` — Liquidity

## Pool 정보

```text
MEME / USDC

MEME Reserve
...

USDC Reserve
...

Total LP
...

────────────────────

Your Position

LP Shares
...

Pool Share
...

MEME
...

USDC
...
```

사용자의 LP 지분:

```solidity
liquidityShares[user]
```

전체:

```solidity
totalLPSupply
```

Pool share:

```text
liquidityShares[user] / totalLPSupply
```

---

# 15. Add Liquidity

```text
Add Liquidity

MEME
[ 10,000 ]

USDC
[ 50 ]

Pool Ratio
...

LP Received
...

[ ADD LIQUIDITY ]
```

Transaction:

```solidity
amm.addLiquidity(
    tokenAmount,
    usdcAmount
)
```

현재 SimpleAMM은 입력 비율이 맞지 않을 경우 실제 사용량을 계산하고 초과분을 사용자에게 반환한다.

프론트에서는 현재 reserve 비율을 읽어 적절한 입력 비율을 표시한다.

---

# 16. Remove Liquidity

```text
Remove Liquidity

Your LP
123.45

Amount
[ 50% ]

You receive

MEME
...

USDC
...

[ REMOVE LIQUIDITY ]
```

Transaction:

```solidity
amm.removeLiquidity(lpAmount)
```

예상 반환량:

```text
tokenAmount =
tokenReserve * lpAmount / totalLPSupply

usdcAmount =
usdcReserve * lpAmount / totalLPSupply
```

---

# 17. Quote

프론트의 예상 가격과 실제 컨트랙트 계산이 달라지지 않도록 quote view function을 사용하는 것을 권장한다.

## BondingCurve

```solidity
getBuyAmountOut(uint256 amountIn)
getSellAmountOut(uint256 amountIn)
```

## SimpleAMM

```solidity
getTokenToUSDCAmountOut(uint256 amountIn)
getUSDCToTokenAmountOut(uint256 amountIn)
```

UI 흐름:

```text
User Input
   ↓
Quote view
   ↓
Expected Amount
   ↓
Slippage
   ↓
minAmountOut
   ↓
Transaction
```

---

# 18. Approval UX

ERC20 allowance를 확인한다.

```text
Allowance < amount
       ↓
[ Approve ]
       ↓
Approval confirmed
       ↓
[ Buy / Sell / Swap ]
```

초기 MVP에서는 필요한 amount만 approve해도 충분하다.

---

# 19. Transaction UX

모든 write transaction에 상태를 표시한다.

```text
Idle
 ↓
Confirm in wallet
 ↓
Transaction pending
 ↓
Confirmed
```

실패:

```text
Transaction failed

[ Try Again ]
```

가능하면 transaction hash와 Sepolia block explorer 링크를 제공한다.

---

# 20. Contract / ABI 구조

```text
contracts/
├── Factory.ts
├── MemeToken.ts
├── BondingCurve.ts
├── SimpleAMM.ts
└── FakeUSDC.ts
```

Network별 주소:

```typescript
const CONTRACTS = {
  sepolia: {
    factory: "...",
    fakeUSDC: "...",
  }
}
```

Token / Curve / AMM 주소는 Factory 이벤트 또는 contract read를 통해 동적으로 가져온다.

---

# 21. 권장 프론트 구조

```text
frontend/
├── app/
│   ├── page.tsx
│   ├── create/
│   │   └── page.tsx
│   └── token/
│       └── [address]/
│           ├── page.tsx
│           └── liquidity/
│               └── page.tsx
│
├── components/
│   ├── TokenList
│   ├── TokenCard
│   ├── CreateToken
│   ├── TradeBox
│   ├── BuyPanel
│   ├── SellPanel
│   ├── BondingCurveProgress
│   ├── SwapPanel
│   ├── LiquidityPanel
│   └── WalletButton
│
├── contracts/
│   ├── Factory.ts
│   ├── MemeToken.ts
│   ├── BondingCurve.ts
│   ├── SimpleAMM.ts
│   └── FakeUSDC.ts
│
└── lib/
    ├── wagmi.ts
    ├── contracts.ts
    └── formatting.ts
```

---

# 22. 구현 순서

## Phase 1 — Web3 연결

- Next.js 프로젝트
- TypeScript
- wagmi / viem
- Sepolia 설정
- Wallet Connect
- Contract address 설정
- read/write 테스트

## Phase 2 — Factory

- `/create`
- Token 생성
- Factory `createToken()`
- `TokenCreated` 이벤트 처리
- 생성 후 token page 이동

## Phase 3 — Bonding Curve

- Token 상세 페이지
- Token 정보
- Price
- Reserve
- Graduation progress
- Buy
- Sell
- Approval
- Slippage

## Phase 4 — Graduation + AMM

- Graduation 상태
- AMM 주소
- Pool reserve
- Token ↔ USDC swap

## Phase 5 — LP

- Add Liquidity
- LP Shares
- Pool Share
- Remove Liquidity

## Phase 6 — UX

- Loading
- Transaction pending
- Error handling
- Toast
- Copy address
- Explorer link
- Responsive UI

---

# 23. MVP에서 제외

초기 버전에서는 다음을 만들지 않는다.

- 실시간 가격 차트
- 거래 history indexer
- WebSocket
- Portfolio dashboard
- 실제 USDC
- 여러 AMM routing
- DEX aggregator
- NFT LP token
- DAO governance
- Backend database

먼저 **Sepolia에서 전체 lifecycle을 실제 transaction으로 끝까지 실행하는 것**을 목표로 한다.

---

# 24. MVP 완료 기준

다음 시나리오가 브라우저에서 실제로 동작하면 1차 MVP 완료.

```text
1. Wallet 연결
      ↓
2. Create Token
      ↓
3. Factory transaction
      ↓
4. Token Detail 이동
      ↓
5. FakeUSDC Faucet
      ↓
6. Buy
      ↓
7. Sell
      ↓
8. Bonding Curve 진행률 확인
      ↓
9. Graduation
      ↓
10. SimpleAMM 자동 연결
      ↓
11. AMM Swap
      ↓
12. Add Liquidity
      ↓
13. LP Position 확인
      ↓
14. Remove Liquidity
```

**핵심 목표: 사용자가 지갑 하나만 연결해서 Meme Token의 생성 → Bonding Curve 거래 → Graduation → AMM 거래 → LP 예치/회수까지 직접 수행할 수 있어야 한다.**
