# Local Development

This guide deploys `FakeUSDC` and `Factory` to a local Anvil network.

## Prerequisites

Run all commands from the repository root. Confirm that Foundry is installed:

```bash
forge --version
anvil --version
```

## Start Anvil

Start Anvil in a dedicated terminal and leave it running while deploying and testing.

```bash
anvil --disable-code-size-limit
```

`Factory` currently exceeds the EVM's 24 KB contract size limit, so the
`--disable-code-size-limit` flag is required for local development only.

Anvil prints funded test accounts and their private keys. Set the account that
will deploy and administer the local contracts as environment variables:

```bash
export DEPLOYER_PRIVATE_KEY=<ANVIL_PRIVATE_KEY>
export MASTER_ADDRESS=<ANVIL_ACCOUNT_ADDRESS>
```

Use values shown by your Anvil instance. Never use a local development key on a
public network or with real funds.

## Reset the Local Chain

To remove all deployed contracts and transactions without restarting Anvil:

```bash
cast rpc anvil_reset --rpc-url http://127.0.0.1:8545
```

This returns the chain to block `0` and resets every account nonce to `0`.

## Deploy FakeUSDC

In another terminal, deploy `FakeUSDC`. `--broadcast` is required: without it,
Forge simulates the deployment but does not send it to Anvil.

```bash
forge create contracts/FakeUSDC.sol:FakeUSDC \
  --rpc-url http://127.0.0.1:8545 \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

Copy the address printed after `Deployed to:`. Store it for the next command:

```bash
export FAKE_USDC_ADDRESS=0xYOUR_DEPLOYED_FAKE_USDC_ADDRESS
```

Always use the address printed by your command, because it changes if the
deployment account or transaction order changes.

Verify the deployment if needed:

```bash
cast code "$FAKE_USDC_ADDRESS" --rpc-url http://127.0.0.1:8545
```

The result must be non-empty bytecode, not `0x`.

## Deploy Factory

`Factory` requires two constructor arguments:

1. `FakeUSDC` contract address
2. `master` address, which can be the first Anvil account for local testing

```bash
forge create contracts/Factory.sol:Factory \
  --rpc-url http://127.0.0.1:8545 \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$FAKE_USDC_ADDRESS" "$MASTER_ADDRESS"
```

Copy the `Deployed to:` value as the Factory address.

## Restarting Anvil

By default, shutting down Anvil discards all chain state. After a restart,
deploy both contracts again. To restore a previous state, dump it when Anvil
stops and load it on the next start:

```bash
anvil --disable-code-size-limit --dump-state anvil-state.json
```

```bash
anvil --disable-code-size-limit --state anvil-state.json --dump-state anvil-state.json
```

Keep `anvil-state.json` out of version control unless sharing its local test
state is intentional.