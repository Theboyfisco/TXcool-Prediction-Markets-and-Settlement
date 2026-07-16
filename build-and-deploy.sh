#!/bin/bash
# GoalLine — WSL Anchor Build & Deploy Script
# Run this inside a WSL2 Ubuntu terminal from the project root

set -e

echo "=== GoalLine Anchor Build & Deploy ==="
echo ""

# Always ensure Solana is on PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
source "$HOME/.cargo/env" 2>/dev/null || true

# Step 1: Check if solana is installed
if ! command -v solana &> /dev/null; then
  echo "[1/5] Installing Solana CLI v2.1.1..."
  sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.1/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  echo "export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\"" >> ~/.bashrc
else
  echo "[1/5] Solana CLI found: $(solana --version)"
fi

# Step 1.5: Check/install Rust
if ! command -v cargo &> /dev/null; then
  echo "[1.5/5] Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  export PATH="$HOME/.cargo/bin:$PATH"
else
  echo "[1.5/5] Rust found: $(cargo --version)"
fi

# Step 2: Check/install Anchor
if ! command -v anchor &> /dev/null; then
  echo "[2/5] Installing Anchor CLI..."
  if ! command -v avm &> /dev/null; then
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  fi
  avm install 0.30.1
  avm use 0.30.1
else
  echo "[2/5] Anchor found: $(anchor --version)"
fi

# Step 3: Configure for devnet
echo "[3/5] Configuring Solana for devnet..."
solana config set --url https://api.devnet.solana.com

# Copy keypair from Windows if not present in WSL
if [ ! -f ~/.config/solana/id.json ]; then
  echo "Copying keypair from Windows..."
  mkdir -p ~/.config/solana
  cp /mnt/c/Users/ifean/.config/solana/id.json ~/.config/solana/id.json
fi
echo "Wallet: $(solana-keygen pubkey)"
echo "Balance: $(solana balance)"

# Step 4: Build the program
echo "[4/5] Building GoalLine Anchor program..."
cd /mnt/c/Users/ifean/Documents/antigravity/cool-pythagoras/goalline-program

echo "  → Pinning cc crate to pre-edition2024 version..."
# Only cc needs pinning — it's the root that pulls wit-bindgen (edition2024)
cargo +stable update -p cc --precise 1.1.31 2>&1 || true

echo "  → Running anchor build..."
# Ensure cargo-build-sbf is on PATH (installed by Solana CLI)
anchor build

# Step 5: Deploy
echo "[5/5] Deploying to Devnet..."
anchor deploy

echo ""
echo "=== Deployment Complete ==="
echo "Program ID shown above — copy it and update:"
echo "  1. goalline-program/Anchor.toml -> [programs.devnet] goalline_program"
echo "  2. goalline-program/programs/goalline-program/src/lib.rs -> declare_id!(...)"
echo "  3. frontend/.env.local -> NEXT_PUBLIC_PROGRAM_ID=<id>"
echo ""
echo "Then run: anchor build && anchor deploy (again after ID update)"
