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
- tokenURI metadata image
- Market Cap 또는 FDV

카드는 상단의 정사각형 token image와 하단 정보 영역으로 구성한다. 하단 정보는 `Name → Symbol → Market Cap` 순서로 표시하며, metadata image가 없으면 빈 placeholder를 유지한다.

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

Fee
1%

Protocol
0.7%

Creator
0.3%

Real Token Reserve
9,000,000 tokens

[ Create Token ]
```

## 입력

- `name`
- `symbol`
- `description`
- `image`

현재 Factory의 `createToken`은 `name`, `symbol`, `tokenURI`를 입력으로 받으며 별도의 `initialPrice` 인자는 사용하지 않는다. 초기 가격/시가총액은 BondingCurve의 `virtualTokenReserve`와 `virtualUSDCReserve`에서 결정된다.

이미지는 Pinata에 업로드하고 반환된 CID를 `ipfs://<CID>` 형식으로 사용한다. 이후 JSON 메타데이터를 Pinata에 업로드하고, 반환된 JSON CID를 `tokenURI`로 Factory에 전달한다.

권장 metadata 구조는 다음과 같다.

```json
{
  "name": "CHIIKAWA",
  "symbol": "CHIKA",
  "description": "A cute meme token on Mini Pump.",
  "image": "ipfs://bafy..."
}
```

프론트는 위 필드 외에 token URI JSON에 추가 필드가 존재하면 이를 임의로 폐기하지 않고 Token Dashboard의 Metadata 영역에서 함께 표시한다. 구조를 알 수 없는 중첩 값은 JSON 문자열 형태로 안전하게 표시한다.

## Transaction

```solidity
Factory.createToken(
    name,
    symbol,
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

# 5. `/token/[address]` — Token Dashboard

프론트엔드의 핵심 페이지이며, 앞으로 **Token Dashboard** 또는 **토큰 대시보드**로 부른다. 파일/컴포넌트 이름도 `TokenDashboard`를 사용한다.

Token 상태에 따라:

```text
Bonding Curve Mode
        OR
Graduated / AMM Mode
```

로 UI를 전환한다.

## 5.1 Token Dashboard Layout

Token Dashboard는 **왼쪽 정보/차트 영역 + 오른쪽 거래 영역**의 고정적인 2-column 구조를 기본으로 한다. 샘플 이미지의 정보 밀도와 흐름을 참고할 수 있으나, 프로젝트 디자인 시스템이 우선한다.

권장 구조:

```text
┌──────────────────────────────────────────────────────────────┐
│ Token Header                                                  │
├───────────────────────────────────────┬──────────────────────┤
│ Price / Market Cap                    │ Buy / Sell           │
│ Chart                                 │                      │
│ Bonding Curve Progress                │                      │
├───────────────────────────────────────┴──────────────────────┤
│ About / Metadata                                             │
└──────────────────────────────────────────────────────────────┘
```

하단에는 `About`만 둔다. `Holders`, `Trades` 탭은 두지 않는다. 별도의 `Pool Info` 섹션도 Token Dashboard에서는 표시하지 않는다.

## 5.2 Token Dashboard Header

표시:

- tokenURI metadata image
- Name
- Symbol
- Token address
- Creator
- Wallet token balance

```text
[ IMAGE ]   MEME
            Meme Token

Token       0x1234...5678
Creator     0xabcd...efgh
Balance     12,345 MEME

[Copy Address]
```

metadata image를 클릭하면 화면의 약 80% 이내에서 원본 비율을 유지해 확대 표시한다. dark backdrop 또는 우측 상단 X button으로 modal을 닫는다.

### 5.3 Token Metadata

`tokenURI()`를 읽고 URI가 가리키는 JSON metadata를 조회한다. `image`, `description`뿐 아니라 JSON에 실제로 존재하는 모든 top-level metadata field를 표시한다.

예:

```text
About
A cute meme token on Mini Pump.

Metadata
name        CHIIKAWA
symbol      CHIKA
description A cute meme token on Mini Pump.
image       ipfs://bafy...
website     ...
twitter     ...
telegram    ...
```

필드가 존재하지 않으면 임의의 값으로 채우지 않는다. 값이 없는 UI 항목은 빈 placeholder를 유지한다. 예상하지 못한 배열/객체 값은 읽기 가능한 JSON 문자열로 표시한다.

### 5.4 Chart Toggle

차트 영역 상단에 Recharts와 TradingView-style 차트를 전환하는 icon toggle을 제공한다. 토글은 CoinMarketCap의 차트 전환 UI처럼 작고 명확한 형태를 사용하되, 프로젝트 디자인 시스템을 따른다.

SVG 기반 아이콘을 사용한다.

```text
[ Recharts icon ] [ TradingView-style icon ]
```

- Recharts: line chart
- TradingView-style: lightweight-charts 기반 candlestick chart
- 현재 데이터가 없으면 빈 placeholder 표시
- 실제 거래 데이터가 존재할 때만 차트를 표시
- 임의의 mock chart data를 사용하지 않는다.

---

# 6. Bonding Curve 화면

Graduation 이전에 표시한다.

## 상태

```text
Price
...

Market Cap
...

Bonding Curve Progress
██████████████░░░░░░ 72%

6,480,000 / 9,000,000 tokens sold

Graduation at 100%
```

### 진행률

현재:

```solidity
curve.realTokenReserve()
```

초기 reserve는 현재 컨트랙트의 상수:

```solidity
INITIAL_TOKEN_RESERVE = 9_000_000 * 1e18
```

계산:

```text
progress =
(INITIAL_TOKEN_RESERVE - realTokenReserve)
/ INITIAL_TOKEN_RESERVE
```

가격과 Market Cap은 컨트랙트의 virtual reserve 기반 현재 상태를 사용하며, 임의의 하드코딩 값으로 채우지 않는다.

---

# 7. Buy / Sell Panel

Buy와 Sell은 동일한 시각적 계층 구조를 사용한다. 두 자산 입력 영역과 결과 영역을 같은 크기/패딩/타이포그래피 체계로 배치하여 `You pay`와 `You receive`가 어느 쪽이든 한눈에 비교되도록 한다.

## Buy

```text
Buy MEME

You pay
USDC
[ 10.00 ]
Balance: ...

        ↓

You receive
MEME
≈ ...

Minimum received
...

Slippage tolerance
1.00%

Fee
...
Protocol
...
Creator
...

[ BUY MEME ]
```

## Sell

```text
Sell MEME

You pay
MEME
[ 1,000 ]
Balance: ...
[10%] [25%] [50%] [MAX]

        ↓

You receive
USDC
≈ ...

Minimum received
...

Slippage tolerance
1.00%

Fee
...
Protocol
...
Creator
...

[ SELL MEME ]
```

Buy/Sell 모두 다음 관계를 유지한다.

```text
입력 자산 = You pay
예상 결과 = You receive
```

생성되지 않은 값이나 아직 읽지 못한 값은 빈 placeholder를 유지한다.

### 흐름

```text
User Input
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
buy() / sell()
```

Transaction:

```solidity
curve.buy(amountIn, minAmountOut)
curve.sell(amountIn, minAmountOut)
```

### Quote

```solidity
getBuyAmountOut(uint256 amountIn)
getSellAmountOut(uint256 amountIn)
```

Quote는 반드시 현재 컨트랙트의 view 함수 결과를 사용한다. 프론트에서 컨트랙트와 다른 계산식을 임의로 복제하지 않는다.

### Sell 빠른 입력

연결된 지갑의 MEME balance를 사용한다.

`10%`, `25%`, `50%`, `MAX`는 현재 token balance의 각각 10%, 25%, 50%, 100%를 `amountIn`으로 설정한다.

---

# 8. FakeUSDC Faucet

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

# 9. Graduation UI

Bonding Curve의 graduation 상태를 확인한다.

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

# 10. AMM 화면

Graduation 이후 Token Dashboard에서 표시한다.

Token Dashboard의 기본 화면에는 별도 `Pool Info` 섹션을 만들지 않는다. 필요한 pool 상태값은 실제 Swap/Liquidity UI 내부에서만 표시하며, 존재하지 않는 데이터는 빈 placeholder로 둔다.

---

# 11. AMM Swap — Token → USDC

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
amm.swapTokenForUSDC(amountIn, minAmountOut)
```

Quote:

```solidity
getTokenToUSDCAmountOut(uint256 amountIn)
```

Allowance 부족 시:

```solidity
token.approve(ammAddress, amountIn)
```

---

# 12. AMM Swap — USDC → Token

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
amm.swapUSDCforToken(amountIn, minAmountOut)
```

Quote:

```solidity
getUSDCToTokenAmountOut(uint256 amountIn)
```

Allowance 부족 시:

```solidity
fakeUSDC.approve(ammAddress, amountIn)
```

---

# 13. `/token/[address]/liquidity` — Liquidity

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

실제 값이 존재하지 않는 경우 `...` 또는 빈 영역으로 유지하며 가짜 수치를 넣지 않는다.

---

# 14. Add Liquidity

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
amm.addLiquidity(tokenAmount, usdcAmount)
```

프론트에서는 현재 reserve 비율을 읽어 적절한 입력 비율을 표시한다. 실제 계약이 반환하는 사용량/초과분 처리 결과를 임의 값으로 예측하지 않는다.

---

# 15. Remove Liquidity

```text
Remove Liquidity

Your LP
...

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

예상 반환량을 표시할 수 있는 경우 실제 pool reserve와 LP supply를 사용한다. 값이 아직 존재하지 않으면 빈 placeholder를 유지한다.

---

# 16. Approval UX

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

# 17. Transaction UX

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

# 18. Contract / ABI 구조

```text
frontend/src/abi/
├── factory.ts
├── memeToken.ts
├── bondingCurve.ts
└── fakeUSDC.ts
```

현재 프론트의 계약 주소는 환경변수 기반이며 Token / Curve / AMM 주소는 Factory 이벤트 또는 contract read를 통해 동적으로 가져온다.

---

# 19. 권장 프론트 구조

```text
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── create/
│   │   │   └── page.tsx
│   │   └── token/
│   │       └── [address]/
│   │           ├── page.tsx
│   │           └── liquidity/
│   │               └── page.tsx
│   │
│   ├── components/
│   │   ├── token/
│   │   │   ├── TokenDashboard.tsx
│   │   │   ├── TokenDetail.tsx
│   │   │   ├── TokenCard.tsx
│   │   │   └── TradeCandlestickChart.tsx
│   │   └── ...
│   │
│   ├── hooks/
│   ├── lib/
│   └── abi/
```

`TokenDashboard`가 `/token/[address]`의 대표 UI 컴포넌트다.

---

# 20. 구현 원칙

- 명세 변경 후 코드를 수정한다.
- 디자인 시스템은 `docs/mini-pump-frontend-design-spec.md`를 우선한다.
- 샘플 이미지와 디자인 시스템이 충돌하면 디자인 시스템을 따른다.
- 샘플 이미지는 레이아웃 참고용이며 100% 복제하지 않는다.
- 존재하지 않는 데이터는 만들지 않는다.
- mock chart data를 넣지 않는다.
- 새로운 기능/시각 패턴은 기존 컴포넌트 시스템을 최대한 재사용한다.
- ERC20 보유량은 `balanceOf(user)`를 사용하며 별도 holder mapping을 추가하지 않는다.
- 블록체인 상태와 이벤트를 source of truth로 취급한다.
- 필요 이상의 리팩터링이나 의존성 추가를 하지 않는다.

---

# 21. Quote

프론트의 예상 가격과 실제 컨트랙트 계산이 달라지지 않도록 quote view function을 사용한다.

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
