# GoalLine ⚡ — Trustless World Cup Prediction Market

> **Superteams × TxLINE Track** · Built on Solana Devnet · Powered by TxLINE real-time data streams

---

## What is GoalLine?

GoalLine is a **permissionless, cryptographically-verifiable prediction market** for the FIFA World Cup 2026. Users place USDC bets on match outcomes (1X2, Over/Under 2.5, BTTS). Settlement is fully trustless — we never rely on a centralized oracle.

Instead, we use **TxLINE's Merkle-proof infrastructure** to verify match results directly on-chain via a Cross-Program Invocation (CPI) to TxLINE's `validate_stat` instruction.

---

## Architecture

```
  User Browser
      │
      ├── GET  /api/fixtures        ──→  TxLINE: GET /api/fixtures/snapshot
      ├── GET  /api/odds/:id        ──→  TxLINE: GET /api/odds/snapshot/{fixtureId}
      ├── SSE  /api/stream          ──→  TxLINE: SSE /api/scores/stream (live)
      └── POST /api/validate        ──→  TxLINE: GET /api/scores/stat-validation
              │
              │ (Merkle proof JSON)
              ▼
  Solana Devnet ── GoalLine Program (7Ao2A14qmYxnERuFRcGhFqVgA1p55eKr5RLfjhR9gXm8)
              │
              └── settle_market() ──CPI──→ TxLINE validate_stat program
                                           (verifies Merkle proof on-chain)
                                           returns bool: predicate passed?
                                           │
                                           └── market.winner = Some(result)
                                               vault unlocked for winners
```

---

## TxLINE Integration — 4 Endpoints

| Endpoint | Usage |
|---|---|
| `GET /api/fixtures/snapshot` | Seed the prediction dashboard with all World Cup match data |
| `GET /api/odds/snapshot/{fixtureId}` | Display consensus betting odds (homeWin, draw, awayWin, over/under, BTTS) |
| `SSE /api/scores/stream` | Power real-time score updates across the UI (scoreboard, cards, feed panel) |
| `GET /api/scores/stat-validation?fixtureId&seq&statKey` | Fetch Merkle proof for on-chain settlement CPI |

---

## Technical Highlights

### 1. Real-Time SSE Integration
The frontend maintains persistent EventSource connections to TxLINE's SSE stream. Scores update live across all components — the home page ticker, match cards (with flash animation), and the per-fixture event log — without polling.

### 2. Trustless On-Chain Settlement via CPI
```rust
// goalline-program/programs/goalline-program/src/lib.rs
pub fn settle_market(
    ctx: Context<SettleMarket>,
    ts: i64,
    fixture_summary: ScoresBatchSummary,
    fixture_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>,
    predicate: TraderPredicate,
    stat_a: StatTerm,
    stat_b: Option<StatTerm>,
    op: Option<BinaryExpression>,
) -> Result<()> {
    // Verifies TxLINE program owns the daily_scores_merkle_roots account
    require_keys_eq!(
        *ctx.accounts.daily_scores_merkle_roots.owner,
        ctx.accounts.txline_program.key(),
        GoalLineError::InvalidOracleOwner
    );

    // Manually builds the CPI instruction to validate_stat
    invoke(&ix, &[...accounts])?;

    // Reads the boolean result from return data
    let validated_result = return_data[0] != 0;
    market.winner = Some(validated_result);
    Ok(())
}
```

### 3. Escrow Vault with Proportional Payouts
Each market has a PDA-owned USDC vault. Winners receive `(user_bet / winning_pool) × total_pool` — zero platform fees, fully on-chain math.

### 4. Faucet for Testing
A built-in `request_faucet` instruction mints 1,000 test USDC to any connected wallet so judges can test the full flow without needing real funds.

---

## Program Instructions

| Instruction | Description |
|---|---|
| `initialize_mint` | Creates the PDA-owned test-USDC mint |
| `request_faucet` | Mints 1,000 USDC to caller |
| `create_market` | Opens a new prediction market for a fixture + market type |
| `place_bet` | Locks USDC in vault, records prediction |
| `settle_market` | CPIs into TxLINE to verify result, sets market winner |
| `claim_winnings` | Transfers proportional winnings from vault to winner |

---

## Market Types

| Byte | Market | Outcomes |
|---|---|---|
| `0` | Match Result | Home Win / Draw / Away Win |
| `1-2` | 1X2 extended | — |
| `3` | Over 2.5 Goals | Over / Under |
| `5` | Both Teams Score | Yes / No |

---

## Running Locally

```bash
# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000

# Anchor Program (WSL/Linux)
bash build-and-deploy.sh
```

**Requirements:**
- Node.js 18+, npm
- WSL2 with Ubuntu 24.04
- Phantom / Solflare wallet (set to Devnet)

---

## Devnet Deployment

- **Program ID:** `7Ao2A14qmYxnERuFRcGhFqVgA1p55eKr5RLfjhR9gXm8`
- **Network:** Solana Devnet
- **TxLINE Base URL:** `https://txline-dev.txodds.com/api`

---

## Judging Notes

> For Superteams TxLINE track reviewers:

1. **Data-Driven Web3 Platform**: GoalLine uses TxLINE's SSE stream to trigger live UI updates and could trigger on-chain settlement when a `FT` phase event is received.

2. **Merkle Proof Settlement**: The `settle_market` instruction performs a genuine CPI to TxLINE's `validate_stat` program. The proof path is also **visually rendered** in the UI via the ProofVisualizer component — judges can see the Merkle tree in action.

3. **No P2P Credit Token Transfers**: The internal TxLINE credit token is not used for betting. Users bet with test-USDC minted from a PDA-controlled faucet.

4. **Frontend Stack**: Next.js 14 App Router, Solana Wallet Adapter, Anchor client, custom SSE hooks.

5. **Demo Flow**: Connect wallet → Request Faucet → Browse Fixtures → Place Bet → Watch live scores update → Settle completed match → Claim winnings.
