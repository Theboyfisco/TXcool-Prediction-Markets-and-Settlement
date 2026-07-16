# GoalLine — Solana CLI & Anchor Setup Guide
## (For Windows users — WSL2 recommended)

---

## Option A: WSL2 (Recommended)

WSL2 gives you a full Linux environment on Windows — the easiest and most reliable path for Solana development.

### Step 1: Install WSL2
Open PowerShell as Administrator and run:
```powershell
wsl --install
```
Restart your computer when prompted. Then open Ubuntu from the Start menu and set up a username/password.

### Step 2: Install Solana CLI inside WSL2
```bash
# Inside WSL Ubuntu terminal
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
# Add to PATH
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
# Verify
solana --version
```

### Step 3: Install Anchor CLI
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.32.0
avm use 0.32.0
anchor --version
```

### Step 4: Generate Keypair & Fund It
```bash
solana-keygen new --no-bip39-passphrase
solana config set --url devnet
solana airdrop 2
solana balance
```

### Step 5: Build & Deploy GoalLine Program
```bash
# Navigate to the program directory (WSL path to Windows files)
cd /mnt/c/Users/ifean/Documents/antigravity/cool-pythagoras/goalline-program

# Install dependencies
npm install  # or yarn

# Build the program
anchor build

# Deploy to devnet (note the program ID from output)
anchor deploy

# Update NEXT_PUBLIC_PROGRAM_ID in frontend/.env.local with the deployed ID
```

### Step 6: Activate TxLINE
```bash
cd /mnt/c/Users/ifean/Documents/antigravity/cool-pythagoras
npm install
npm run activate
# This logs your JWT and API token to .env.local
```

### Step 7: Test the SSE Stream
```bash
npm run test-stream
# You should see live match data flowing in
```

---

## Option B: Native Windows (Solana v1.18.26 already installed!)

Solana CLI v1.18.26 Windows binaries have been successfully downloaded, extracted, and configured in:
`C:\solana-install-tmp\solana-release\bin`

To use the Solana CLI tools globally:
1. Add `C:\solana-install-tmp\solana-release\bin` to your Windows system Environment Variable `PATH`.
2. Open a new terminal session and run: `solana --version` to verify.

A keypair has already been generated at `C:\Users\ifean\.config\solana\id.json` and set to devnet.

---

## Option C: GitHub Actions / CI Deploy

If you can't get WSL working, you can deploy via GitHub Actions:

1. Push your code to a GitHub repo
2. Add `SOLANA_SECRET_KEY` as a repo secret (base58 encoded private key)
3. The workflow `.github/workflows/deploy.yml` (see below) will build and deploy automatically

```yaml
# .github/workflows/deploy.yml
name: Deploy GoalLine to Devnet
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Solana
        run: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
      - name: Install Anchor
        run: cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.32.0 && avm use 0.32.0
      - name: Setup Keypair
        run: |
          mkdir -p ~/.config/solana
          echo "${{ secrets.SOLANA_SECRET_KEY }}" > ~/.config/solana/id.json
      - name: Deploy
        run: |
          cd goalline-program
          anchor deploy --provider.cluster devnet
```

---

## Frontend (No WSL Needed)

The Next.js frontend runs natively on Windows:

```powershell
cd C:\Users\ifean\Documents\antigravity\cool-pythagoras\frontend
npm install
# Copy .env.local.example to .env.local and fill in your values
cp .env.local.example .env.local
# Start dev server
npm run dev
```

Then open http://localhost:3000

---

## Quick Reference — Key Addresses

| Item | Address |
|------|---------|
| TxLINE Program (devnet) | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL Token Mint (devnet) | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| Devnet RPC | `https://api.devnet.solana.com` |
| TxLINE API (devnet) | `https://txline-dev.txodds.com/api` |
| validate_stat discriminator | `[107, 197, 232, 90, 191, 136, 105, 185]` |
