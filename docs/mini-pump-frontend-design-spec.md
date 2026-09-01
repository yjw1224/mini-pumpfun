# Mini Pump Frontend Design Specification

> **Purpose:** Define a reusable visual system for Mini Pump before UI implementation.
>
> **Project context:** Mini Pump is a learning project that recreates the core smart-contract lifecycle of Pump.fun — token creation, bonding-curve trading, graduation, AMM trading, and liquidity — on Sepolia. The frontend should **not copy Pump.fun's visual design**. It should instead feel like a polished, everyday financial/crypto trading product.

---

## 0. Implementation Rule

**Do not start coding the UI immediately.**

First, define:

1. Design principles
2. Color palette
3. Typography
4. Spacing system
5. Border radius system
6. Button system
7. Input system
8. Card/container system
9. Table/data visualization rules
10. Page-level layout rules

Then implement the UI using those rules.

> **System-first rule:** Do not introduce a new visual pattern unless it is added to the design system first.

All pages and components must reuse the same design tokens and reusable components wherever possible.

---

# 1. Design Philosophy

## 1.1 Core Direction

Mini Pump should feel like a **financial tool that happens to trade meme tokens**, not a marketing website.

The visual language should combine:

- Pump.fun's directness and low-friction token/trading experience
- Robinhood's approachable, clean, information-first financial interface
- Toss Securities' Korean financial-product usability: clear hierarchy, intuitive actions, readable financial data, and low cognitive load

These references are **philosophical and UX references, not visual templates to copy**.

### Core principles

1. **Minimal before decorative**
   - Use visual elements only when they improve comprehension or interaction.
   - Avoid decoration that competes with trading information.

2. **Functional before promotional**
   - The product should look like something a user could open every day to trade.
   - Avoid landing-page or startup-marketing aesthetics.

3. **Information hierarchy over visual effects**
   - Price, balance, market state, progress, and trading actions should be immediately understandable.
   - Typography, spacing, alignment, and contrast should establish hierarchy.

4. **Dark, neutral foundation**
   - Most of the interface should be black/near-black/gray.
   - The primary accent color should be used sparingly for emphasis.

5. **High information density, low visual noise**
   - The UI should feel compact and deliberate.
   - Do not create large empty areas simply to make the page look "premium."

6. **Trading actions must be obvious**
   - Buy and Sell should be immediately distinguishable.
   - The amount input, expected output, slippage, fee, and execution button should form one coherent interaction.

7. **Consistency is a feature**
   - Buttons, inputs, cards, radii, spacing, typography, icons, and states should come from a small set of reusable primitives.

8. **Subtle personality**
   - Mini Pump can feel slightly playful because it is a meme-token platform.
   - Personality should come from the brand accent, logo, token imagery, and microcopy — not from decorative UI effects.

---

# 2. Visual Identity

## 2.1 Overall Appearance

The default interface is **dark mode**.

Base visual hierarchy:

```text
Background
    ↓
Surface / Container
    ↓
Border
    ↓
Primary text
    ↓
Secondary text
    ↓
Muted text
    ↓
Accent / semantic colors
```

The majority of the screen should remain neutral.

### Color usage principle

> **Use color to communicate meaning or direct attention, not as decoration.**

Examples of appropriate accent usage:

- Buy button
- Positive price movement
- Bonding-curve progress
- Selected navigation item
- Active tab
- Important interactive state
- Chart line / key chart element

Avoid filling entire sections with saturated colors.

---

# 3. Color Palette

A single primary brand accent should be established and reused consistently.

## 3.1 Brand Accent

Recommended direction:

```text
Primary: Electric Green
```

Initial token:

```text
--color-primary: #00C805
```

This is a starting value, not a requirement that every green element use exactly the same semantic meaning.

Brand color should be visually distinctive but used sparingly.

## 3.2 Neutral Palette

```text
--color-background: #0A0A0A
--color-surface: #111111
--color-surface-elevated: #171717

--color-border: #242424
--color-border-strong: #333333

--color-text-primary: #F5F5F5
--color-text-secondary: #A3A3A3
--color-text-muted: #666666
```

Neutral colors should dominate the interface.

## 3.3 Semantic Colors

```text
--color-positive: #00C805
--color-negative: #FF4D4F
--color-warning: #F5B942
--color-info: #5B9CFF
```

The exact shades may be adjusted during implementation for contrast and accessibility, but semantic roles must remain stable.

### Important

Do not introduce additional colors for individual components.

If a new color appears to be necessary, first determine whether it belongs to:

- Brand
- Neutral
- Positive
- Negative
- Warning
- Information

If it does not, add it to the design system before using it.

---

# 4. Logo and Brand Mark

Mini Pump should have a simple proprietary icon/mark.

## Direction

The mark should be:

- Geometric
- Simple
- Recognizable at small sizes
- Usable as a favicon
- Usable in the sidebar
- Compatible with monochrome and accent-color versions

A possible conceptual direction is an abstract combination of:

- upward price movement
- bonding curve
- pump / trajectory

Do not use a generic rocket, coin emoji, or copied Pump.fun mark.

The logo should work without requiring a wordmark at small sizes.

---

# 5. Typography

## 5.1 UI Typeface

Use **Pretendard** as the default UI typeface.

```css
font-family:
  Pretendard,
  -apple-system,
  BlinkMacSystemFont,
  sans-serif;
```

Recommended weights:

```text
400 — Regular
500 — Medium
600 — SemiBold
700 — Bold
```

Do not use excessive font-weight variation.

## 5.2 Financial Numbers

Prices, balances, token quantities, percentages, market caps, and other high-frequency financial figures should use a **distinct financial-data typeface** with tabular numerals.

Requirements:

- Tabular numerals
- Clear distinction between 0 / 8 / 6 / 9
- Stable character width
- Strong readability at small sizes
- Appropriate for rapidly changing numbers

Example:

```text
$12,483.21
0.00004231
+12.43%
1,284,321 MEME
```

The exact numeric font may be selected during implementation, but the design requirement is fixed:

> **Financial figures must use tabular numerals and a visually distinct numeric typeface from normal UI text.**

## 5.3 Typography Hierarchy

```text
Page title       24–28px / 600–700
Section title    18–20px / 600
Body             14–16px / 400–500
Label            12–14px / 500
Caption          11–12px / 400
Financial data   Context-dependent / tabular numerals
```

Avoid oversized marketing typography.

---

# 6. Spacing System

Use a consistent 4px-based spacing scale.

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Common usage:

```text
4px   — icon/text micro spacing
8px   — compact element spacing
12px  — input internals / small gaps
16px  — standard component padding
24px  — section/component spacing
32px  — major section spacing
48px+ — page-level spacing
```

Do not introduce arbitrary values such as 13px, 19px, 27px, etc. unless there is a strong implementation reason.

---

# 7. Border Radius System

Use a small, fixed radius system.

```text
4px   — small controls / compact elements
8px   — buttons / inputs
10px  — cards / primary containers
12px  — larger grouped containers
```

Avoid excessive rounding.

### Explicit rule

Do not use:

```text
rounded-full
rounded-2xl
rounded-3xl
```

as default styling.

Pills should be reserved for genuinely categorical/status elements where the pill shape has semantic value.

---

# 8. Button System

Buttons must come from a limited, reusable system.

## 8.1 Primary Button

Use for the most important action.

Examples:

```text
[ Buy MEME ]
[ Create Token ]
[ Add Liquidity ]
[ Swap ]
```

Properties:

```text
Height: 40–44px
Radius: 8px
Font: 14–15px / 600
```

Use the brand accent selectively.

## 8.2 Secondary Button

For supporting actions.

Examples:

```text
[ Copy Address ]
[ View Explorer ]
[ Get Test USDC ]
```

Neutral background/border.

## 8.3 Destructive / Sell Button

Sell actions must be visually distinct from Buy.

```text
[ Sell MEME ]
```

Use the negative semantic color.

## 8.4 Ghost / Icon Button

For low-emphasis actions:

```text
Copy
Settings
More
Close
```

No unnecessary background.

## 8.5 Button Rules

- Same height and radius across equivalent buttons.
- Same typography.
- Same loading behavior.
- Same disabled behavior.
- Same focus behavior.
- Icon placement must be consistent.
- Do not invent one-off button designs.

---

# 9. Input System

Trading inputs are one of the most important UI components.

## Standard Input

```text
Height: 44–48px
Radius: 8px
Border: 1px
Background: surface
```

Focus state should use the brand accent or a clearly visible neutral focus treatment.

## Financial Input

For:

```text
USDC
MEME
Price
Amount
Slippage
```

The input should clearly communicate:

```text
Asset
Amount
Balance
```

Example:

```text
USDC                         Balance 123.45
[ 100.00                         USDC ]
```

Avoid unnecessary floating labels and decorative input effects.

---

# 10. Card / Container System

Cards should be functional containers, not decorative objects.

## Standard Container

```text
Background: surface
Border: 1px solid border
Radius: 10px
Padding: 16–24px
Shadow: none
```

Use cards for:

- Trading panel
- Token information
- Liquidity position
- Pool information
- Transaction information

Do not put every piece of information inside its own card.

### Container hierarchy

Prefer:

```text
Page
 └── Section
      └── Container
           ├── Header
           ├── Content
           └── Actions
```

rather than:

```text
Page
 ├── Card
 ├── Card
 ├── Card
 ├── Card
 └── Card
```

---

# 11. Navigation

## 11.1 Desktop Sidebar

Use a persistent left sidebar.

Approximate width:

```text
220–240px
```

Structure:

```text
[ Mini Pump logo ]

Home
Explore
Create

----------------

Wallet

----------------

Settings
```

Each navigation item uses the same icon size and spacing.

Recommended icon size:

```text
18–20px
```

Active navigation:

- Subtle primary-color tint
- Primary-colored icon
- Primary/bright text

Do not use oversized navigation icons.

## 11.2 Header

Explore의 Token Card는 token image를 빠르게 식별할 수 있는 compact 탐색 항목으로 유지한다.

```text
Token image (card width, square)
────────────────────────────
Token name
Token ticker
Market Cap
```

- Image: 카드 상단에 카드 내부 너비를 사용한 정사각형 이미지로 배치하고 object-fit cover를 적용한다.
- Information: 이미지 아래 surface-elevated 정보 영역에 name, ticker, market cap 순서로 표시한다.
- Hierarchy: name과 market cap은 medium emphasis, ticker는 더 작은 secondary text로 표시한다.
- Metadata image가 없거나 로드에 실패하면 임의 이미지 대신 동일 비율의 빈 placeholder를 표시한다.
- 가격, progress, token address, creator, graduated badge는 Explore Token Card에서 표시하지 않는다.
- Explore의 기본 desktop grid는 한 줄 최대 6개 카드로 구성한다. 마지막 줄의 카드 수가 6개 미만이어도 동일한 6개 grid track을 유지해 카드 크기가 커지지 않도록 한다.

Cards should not contain unnecessary badges, statistics, or decorative elements.
- Emoji as UI icons
- Mixing filled and outlined icon styles without a semantic reason
- Random SVG icons from unrelated visual systems
- Large decorative icons

---

# 13. Trading Interface

The Buy/Sell experience is the most important interaction in the product.

## 13.1 Core Principle

> **The user should understand what they are spending, what they will receive, the execution conditions, and how to execute the trade without thinking about the underlying contract mechanics.**

## 13.2 Buy / Sell Structure

Use a clear two-state control:

```text
┌──────────────┬──────────────┐
│     BUY      │     SELL     │
└──────────────┴──────────────┘
```

The active state should be visually obvious.

## 13.3 Buy

```text
Buy MEME

USDC
[ 100.00 ]

Balance: 423.10 USDC

You receive
≈ 9,812 MEME

Minimum received
9,713 MEME

Fee
1.00 USDC

[ BUY MEME ]
```

## 13.4 Sell

```text
Sell MEME

MEME
[ 1,000 ]

Balance: 12,483 MEME

You receive
≈ 9.82 USDC

Minimum received
9.72 USDC

Fee
0.10 USDC

[ SELL MEME ]
```

## 13.5 Transaction States

Every write action should clearly communicate:

```text
Idle
↓
Confirm in wallet
↓
Transaction pending
↓
Confirmed
```

Failure:

```text
Transaction failed
[ Try Again ]
```

Do not leave the user wondering whether a transaction is processing.

---

# 14. Bonding Curve Visualization

The bonding curve is a core project concept and should be visually understandable.

Use a restrained visualization.

Primary information:

```text
Price
Market Cap
Progress
Tokens sold
Remaining reserve
Graduation state
```

Example:

```text
Bonding Curve

72.4% complete

██████████████████░░░░░

579,200 / 800,000 tokens sold

Graduation at 100%
```

The accent color should emphasize progress.

Avoid excessive gradients, animated charts, or decorative visualizations.

---

# 15. Charts and Data Visualization

Charts should resemble financial-product interfaces.

## Rules

- Dark/neutral background
- Thin grid lines or no grid when unnecessary
- One primary data series where possible
- Accent color for the main series
- Semantic positive/negative colors only when meaningful
- No decorative gradients
- No 3D effects
- No excessive animation

Charts must communicate data, not make the page look impressive.

## Financial Data

Use:

- Tabular numerals
- Right alignment for numerical columns
- Consistent decimal precision
- Consistent units
- Explicit positive/negative signs where relevant

Example:

```text
Price          $0.004231
Market Cap     $421,300
Change         +12.43%
Volume         $83,421
```

---

# 16. Tables and Lists

For token lists and financial data:

- Use compact rows.
- Align numerical values consistently.
- Keep column labels visible.
- Avoid excessive borders.
- Use subtle row separators.
- Use hover states sparingly.

Example:

```text
Token       Price       Market Cap      Progress
MEME        $0.0042     $421K            72%
DOGE2       $0.0018     $180K            41%
PUMP        $0.0091     $910K            94%
```

Do not turn every table row into a large rounded card.

---

# 17. Token Card

Token cards should remain compact.

### Market Cap and Ticker Formatting

Market Cap은 `$` 접두어와 compact unit을 사용한다.

```text
$123         below $1K
$1.23K       $1K to below $10K
$12.3K       $10K to below $1M
$1.23M       $1M to below $10M
$12.3M       $10M to below $1B
$1.23B       $1B to below $10B
$12.3B       $10B to below $100B
$123B        $100B or above
```

- 1부터 10 미만의 K/M/B 값은 최대 소수점 둘째 자리까지 표시한다.
- 10 이상 K/M/B 값은 최대 소수점 첫째 자리까지 표시한다.
- Token Card의 ticker는 `$` 접두어를 붙여 표시한다. 예: `$MEME`

Required information:

```text
Token name
Symbol
Price
Market Cap
Bonding Curve Progress
Graduation status
```

Optional:

```text
Creator
Token address
Token image
```

Primary action:

```text
[ Trade ]
```

Cards should not contain unnecessary badges, statistics, or decorative elements.

---

# 18. Token Dashboard

`/token/[address]` 화면은 앞으로 **Token Dashboard** 또는 **토큰 대시보드**로 부른다. Token Dashboard는 거래를 우선하되 token metadata와 시장 상태를 한 화면에서 빠르게 확인할 수 있어야 한다.

Recommended desktop layout:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Token header: image, name, symbol, address, creator, wallet balance │
├───────────────────────────────────────┬─────────────────────────────┤
│ Price / market metrics                │                             │
├───────────────────────────────────────┤          Trading            │
│ Chart                                 │        BUY / SELL            │
│ [ Recharts icon ] [ TradingView icon ]│        You pay               │
│ Chart data or empty placeholder       │        You receive           │
├───────────────────────────────────────┤        Minimum received      │
│ Bonding curve progress                │        Fee / Execute         │
├───────────────────────────────────────┴─────────────────────────────┤
│ About: token description only                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Token Metadata

Token Dashboard는 `tokenURI`의 JSON metadata에서 다음 값을 표시한다.

- `image`: token header의 token image
- `name`: on-chain name과 동일한 token name
- `symbol`: on-chain symbol과 동일한 token symbol
- `description`: 하단 About 섹션의 본문

IPFS metadata 또는 image를 불러오는 동안, 또는 데이터가 없을 때에는 임의 데이터를 채우지 않고 빈 placeholder를 유지한다.

### Token Image Modal

Token Dashboard header의 token image는 클릭 가능한 icon button이다. 클릭 시 원본 image를 확인하는 modal을 표시한다.

- Backdrop: viewport 전체를 덮는 translucent dark overlay
- Image: viewport의 최대 약 80% 너비와 높이 안에 맞추며 aspect ratio를 유지한다.
- Close: 우측 상단의 white `X` icon button과 backdrop 클릭으로 닫는다.
- Modal이 열려 있는 동안 token image 이외의 배경 요소와 상호작용하지 않는다.
- Metadata image가 없거나 로드 실패 시 placeholder는 클릭 동작을 제공하지 않는다.

### Chart Mode Toggle

차트 영역 상단에는 아이콘만 사용하는 두 개의 compact toggle button을 둔다.

- Recharts mode: Recharts 아이콘과 tooltip `Recharts chart`
- TradingView mode: TradingView 아이콘과 tooltip `TradingView chart`
- active mode는 primary accent로 식별한다.
- 아직 chart data나 renderer가 없으면 선택된 mode의 빈 chart placeholder만 표시한다.

### Trading Hierarchy

Buy와 Sell 모두 사용자가 지불하는 자산과 받는 자산을 같은 계층으로 읽을 수 있어야 한다.

```text
You pay
[ amount input ] asset

You receive
≈ quoted amount asset

Minimum received
quoted amount asset
```

Pool info, Holders, Trades 섹션은 Token Dashboard에 표시하지 않는다. 하단에는 설명만 포함한 About 섹션을 유지한다.

The layout should be functional rather than centered like a marketing landing page.

---

# 19. Create Token Page

The Create page should be simple and task-oriented.

```text
Create Token

Token Name
[                         ]

Symbol
[                         ]

Initial Price
[                         ] USDC

[ Create Token ]
```

Do not use a huge hero section.

The page should make the task feel like filling out a financial product form.

---

# 20. Liquidity Page

Liquidity should follow the same visual language as trading.

Information hierarchy:

```text
Pool
 ↓
Reserves
 ↓
Your Position
 ↓
Add / Remove Liquidity
```

Use the same:

- Inputs
- Buttons
- Containers
- Financial typography
- Spacing
- Radius

Do not invent a separate "liquidity dashboard" design language.

---

# 21. Wallet UI

Wallet state should be visible but unobtrusive.

Display:

```text
Connected
0x1234...5678

ETH
0.42

Test USDC
1,000.00
```

Wrong network:

```text
Wrong network

Mini Pump requires Sepolia.

[ Switch to Sepolia ]
```

Wallet connection should never visually overpower the trading interface.

---

# 22. Status, Toasts, and Feedback

Use a consistent notification system.

States:

```text
Success
Error
Warning
Pending
Info
```

Example:

```text
✓ Token created successfully
✓ Transaction confirmed
⚠ Insufficient USDC
✕ Transaction failed
```

Keep notifications compact.

Do not use oversized modal dialogs for routine transaction feedback.

### Token creation success Toast

토큰 생성 트랜잭션이 확정되어 토큰 대시보드로 이동한 뒤 성공 Toast를 표시한다.

- Position: viewport bottom-left, 16px inset
- Width: 최대 360px, mobile에서는 좌우 16px을 제외한 전체 너비
- Layout: 12px padding, icon/content/close button 사이 12px gap
- Radius: 10px
- Surface: semi-transparent `--color-surface`, `--color-border` border, subtle shadow, backdrop blur
- Success icon: `--color-positive` circular background with a dark check icon
- Title: `Token created successfully`
- Supporting text: `Your token is now live.`
- Dismiss: 우측 `X` icon button 제공
- Duration: 3 seconds, dismiss 시 즉시 제거
- Motion: 좌측에서 16px 이동하며 200ms fade-in으로 나타나고, 제거 시 300ms fade-out 적용

---

# 23. Loading States

Use skeletons or restrained loading indicators.

Avoid:

- Full-screen spinners for small reads
- Excessive animations
- Decorative loading screens

For transactions, show explicit state:

```text
Confirm in wallet...
Transaction pending...
Transaction confirmed.
```

---

# 24. Responsive Design

Desktop is the primary trading environment, but the interface must remain usable on mobile.

## Desktop

```text
Sidebar + Header + Main Content
```

## Tablet

```text
Reduced sidebar
Two-column layouts may collapse
```

## Mobile

```text
Top header
Single-column content
Trading panel full width
```

Buy/Sell controls must remain immediately accessible.

Do not simply shrink the desktop layout.

---

# 25. Motion

Motion should communicate state changes, not decorate the interface.

Allowed:

- Button loading state
- Tab transition
- Toast appearance
- Progress update
- Small hover/focus transitions

Avoid:

- Parallax
- Floating objects
- Excessive page transitions
- Continuous decorative animation
- Animated gradients
- Large entrance animations

Default transition duration should be short and subtle.

---

# 26. Accessibility

Minimum requirements:

- Sufficient text/background contrast
- Visible keyboard focus
- Buttons must have clear labels
- Icons must not be the only way to understand critical actions
- Buy/Sell must not rely only on color
- Error states must include text
- Numerical data should remain readable at small sizes

---

# 27. AI-LOOKING DESIGN — STRICTLY AVOID

The UI must **not** look like a generic website generated by GPT, Claude, v0, or a similar AI UI generator.

## Do NOT use:

- Purple/blue gradients
- Glassmorphism
- Excessive rounded cards
- Huge hero sections
- Excessive drop shadows
- Excessive whitespace
- Generic SaaS layouts
- "Modern AI startup" aesthetics
- Decorative blobs
- Abstract background shapes
- Excessive badges or pills
- Unnecessary icons
- Gradient text
- Excessive animations
- Large marketing-style headings
- Centered layouts when a functional left/right layout is more appropriate
- Inter as the default font unless explicitly requested
- Every section wrapped in a card
- Random one-off component styles
- Excessive use of color
- Decorative illustrations that do not communicate product information
- Emoji as interface elements

## Stronger rule

> **If a visual element does not improve comprehension, navigation, hierarchy, or interaction, remove it.**

---

# 28. Design System Enforcement

Before adding a component, ask:

1. Does an existing component already solve this?
2. Can this use an existing spacing value?
3. Can this use an existing radius?
4. Can this use an existing color token?
5. Can this use an existing button/input/container variant?
6. Does this introduce a new visual pattern?

If a new visual pattern is genuinely necessary:

> **Add it to the design system first, then use it.**

Do not create one-off visual solutions inside individual pages.

---

# 29. Recommended Reusable Component Structure

```text
components/
├── layout/
│   ├── AppShell
│   ├── Sidebar
│   └── Header
│
├── ui/
│   ├── Button
│   ├── Input
│   ├── Card
│   ├── Tabs
│   ├── Badge
│   ├── Progress
│   ├── Toast
│   └── IconButton
│
├── token/
│   ├── TokenCard
│   ├── TokenHeader
│   ├── TokenStats
│   └── BondingCurveProgress
│
├── trading/
│   ├── TradePanel
│   ├── BuyPanel
│   ├── SellPanel
│   ├── AssetInput
│   ├── QuoteSummary
│   └── SlippageControl
│
└── liquidity/
    ├── PoolInfo
    ├── PositionInfo
    ├── AddLiquidity
    └── RemoveLiquidity
```

The component system should enforce the visual system rather than merely organize files.

---

# 30. Page-Level Design Summary

## `/`

**Explore**

- Compact token list
- Search
- Token cards/list
- Minimal visual noise
- Primary Create action

## `/create`

**Create Token**

- Task-oriented form
- No marketing hero
- Clear transaction action

## `/token/[address]`

**Trading-first**

- Token information
- Bonding curve / AMM state
- Buy/Sell or Swap
- Financial data
- Contract information

## `/token/[address]/liquidity`

**Liquidity management**

- Pool information
- User position
- Add liquidity
- Remove liquidity

---

# 31. Final Design Goal

Mini Pump should look like:

> **A small but credible crypto trading terminal.**

It should feel:

```text
Minimal
        +
Financial
        +
Crypto-native
        +
Functional
        +
Consistent
        +
Slightly playful
```

It should **not** feel like:

```text
AI-generated SaaS
        or
Marketing landing page
        or
A direct Pump.fun clone
```

The ultimate visual test is:

> **Could a user comfortably open this every day to check a token, inspect its market state, and execute a trade without the interface getting in the way?**

If yes, the design is working.
