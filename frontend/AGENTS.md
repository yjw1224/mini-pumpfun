<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mini Pump — Agent Instructions

## Project Overview

Mini Pump is a learning project that recreates the core lifecycle of a Pump.fun-like token platform on Sepolia.

Core lifecycle:

Wallet
→ Factory
→ Meme Token
→ Bonding Curve
→ Graduation
→ SimpleAMM
→ Swap / Liquidity

The project is primarily for understanding smart-contract architecture and Web3 frontend integration.

---

## General Rules

- Read the relevant existing code before modifying it.
- Do not introduce new dependencies unless necessary.
- Do not rewrite or restructure existing contracts/components without a clear reason.
- Prefer small, focused changes.
- Preserve existing contract interfaces unless the task explicitly requires changing them.
- Do not invent functionality that is not specified or implemented by the contracts.
- Do not use mock data when real on-chain data is available.
- Do not silently change architectural decisions.

---

## Smart Contracts

The smart-contract architecture consists of:

- Factory
- MemeToken
- BondingCurve
- SimpleAMM
- FakeUSDC

The frontend must treat the deployed contracts as the source of truth.

### Contract Rules

- Do not modify contract behavior merely to make frontend implementation easier.
- Before changing a contract interface, inspect its existing tests and all callers.
- Preserve access-control assumptions.
- Preserve existing invariants and accounting logic.
- Any change to contract behavior must be accompanied by appropriate tests.
- Do not remove tests to make a change pass.
- Prefer view/pure functions for read-only calculations.

### Quote Functions

Quote functions must reflect the exact calculation used by the corresponding state-changing transaction.

BondingCurve:

- getBuyAmountOut()
- getSellAmountOut()

SimpleAMM:

- getTokenToUSDCAmountOut()
- getUSDCToTokenAmountOut()

Quote functions must not modify state.

---

## Factory / Graduation Architecture

Factory is responsible for creating and managing the lifecycle of bonding curves.

Expected architecture:

Factory
→ creates BondingCurve
→ creates/registers associated token
→ can trigger graduation

Graduation must preserve the existing graduation condition.

Do not introduce a separate keeper, automation system, or backend-triggered graduation unless explicitly requested.

---

## Frontend Stack

Use:

- Next.js
- TypeScript
- wagmi
- viem
- EVM wallet
- Sepolia
- FakeUSDC

Do not introduce ethers.js unless explicitly requested.

Use wagmi/viem for wallet connection, contract reads, writes, transaction state, and ABI interaction.

---

## Frontend Architecture

Routes:

- `/`
- `/create`
- `/token/[address]`
- `/token/[address]/liquidity`

Contract interfaces should be kept separate from UI components.

Prefer reusable components over page-specific implementations.

---

## On-chain Data

The blockchain is the source of truth.

Prefer:

- Contract reads
- Contract events
- Transaction receipts
- Contract state

Do not duplicate on-chain state in local state unless necessary for UI interaction.

Factory-created tokens should be discovered from the `TokenCreated` event where appropriate.

---

## Transaction UX

All write operations must communicate:

1. Wallet confirmation
2. Transaction pending
3. Transaction confirmed
4. Transaction failed

For ERC20 interactions:

- Check allowance before requiring approval.
- Approve the relevant contract when necessary.
- Execute the intended transaction only after approval is confirmed.

Never assume an approval transaction has succeeded before confirmation.

---

## Slippage

User-facing trade execution must distinguish:

- Expected output
- Minimum received
- Slippage tolerance

Quote functions determine the expected output.

The frontend derives `minAmountOut` from the quoted output and the user's slippage tolerance.

Do not use arbitrary hard-coded output values.

---

## Design System

Follow the project's design specification.

The interface should feel like:

> A small but credible crypto trading terminal.

Avoid:

- AI-generated SaaS aesthetics
- Purple/blue gradients
- Glassmorphism
- Excessive rounded cards
- Huge hero sections
- Excessive whitespace
- Decorative animations
- Emoji as UI icons
- One-off component styling

Prefer:

- Dark neutral foundation
- Electric green accent
- Pretendard
- Tabular financial numerals
- Compact information-dense layouts
- Functional cards and containers
- Consistent spacing/radius/button/input systems

Do not introduce a new visual pattern without first considering whether it belongs in the design system.

---

## Testing

Before considering a contract change complete:

- Run the relevant Foundry tests.
- Add or update tests for changed behavior.
- Ensure existing tests continue to pass.

Before considering a frontend change complete:

- Run the relevant TypeScript/build/lint checks.
- Verify contract reads and writes against Sepolia-compatible interfaces.
- Do not claim a transaction flow works without verifying the relevant code path.

---

## Git / Changes

- Keep commits focused.
- Do not modify unrelated files.
- Do not commit generated build artifacts.
- Do not commit secrets, private keys, or environment-specific credentials.
- Do not modify `.gitignore` unless necessary.

---

## Documentation

Before implementing a feature, check the relevant specification in the project documentation.

When a specification and existing implementation disagree:

1. Inspect the current implementation.
2. Identify the discrepancy.
3. Do not silently choose one.
4. Explain the discrepancy before making a consequential architectural change.

## Specification-First Development

The project specifications define the intended architecture and product behavior.

When a change affects:

- contract architecture
- contract interfaces
- access control
- protocol behavior
- frontend routes
- frontend data flow
- component architecture
- design system
- user-facing behavior

update the relevant specification before modifying the implementation.

Preferred workflow:

1. Identify the specification affected by the change.
2. Update the specification to reflect the intended design.
3. Modify the implementation to match the specification.
4. Update or add tests.
5. Run validation and tests.
6. Verify that the implementation and specification remain consistent.

Do not silently change the architecture in code and leave the specification outdated.

If the existing implementation conflicts with the specification, do not automatically treat the implementation as the new specification. Identify the discrepancy and resolve it explicitly before making consequential changes.

For purely internal implementation details that do not affect the intended architecture or externally observable behavior, updating the specification is not required.