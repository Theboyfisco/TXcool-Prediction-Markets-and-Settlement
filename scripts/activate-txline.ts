import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import * as dotenv from "dotenv";

dotenv.config();

const API_ORIGIN = "https://txline-dev.txodds.com";
const API_BASE_URL = `${API_ORIGIN}/api`;
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_TOKEN_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const RPC_URL = "https://api.devnet.solana.com";

const idlPath = path.join(__dirname, "..", "idl", "txoracle-devnet.json");
if (!fs.existsSync(idlPath)) {
  console.error("IDL file not found at:", idlPath);
  process.exit(1);
}
const txoracleIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

function getWalletKeypair(): Keypair {
  const keyPath = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(keyPath)) {
    console.error(`Keypair not found at ${keyPath}. Run 'solana-keygen new'.`);
    process.exit(1);
  }
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8")));
  return Keypair.fromSecretKey(secretKey);
}

async function run() {
  console.log("Loading wallet...");
  const payer = getWalletKeypair();
  console.log(`Wallet Public Key: ${payer.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new anchor.Program(txoracleIdl as any, provider);

  console.log("Fetching guest JWT...");
  const authResponse = await axios.post(`${API_ORIGIN}/auth/guest/start`);
  const jwt: string = authResponse.data.token;
  console.log(`JWT obtained: ${jwt.substring(0, 20)}...`);

  // Derive PDAs — using exact seeds from TxLINE docs
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    PROGRAM_ID
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    PROGRAM_ID
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("PDAs:");
  console.log(`  tokenTreasuryPda:    ${tokenTreasuryPda.toBase58()}`);
  console.log(`  tokenTreasuryVault:  ${tokenTreasuryVault.toBase58()}`);
  console.log(`  pricingMatrixPda:    ${pricingMatrixPda.toBase58()}`);
  console.log(`  userTokenAccount:    ${userTokenAccount.toBase58()}`);

  // Create user ATA for TxL token if not already initialized
  console.log("\nEnsuring user TxL token account exists...");
  try {
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,   // payer
      userTokenAccount,  // ata
      payer.publicKey,   // owner
      TXL_TOKEN_MINT,    // mint
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const ataTx = new Transaction().add(createAtaIx);
    const ataSig = await sendAndConfirmTransaction(connection, ataTx, [payer], { commitment: "confirmed" });
    console.log(`  ATA created/confirmed: ${ataSig}`);
  } catch (e: any) {
    // If it already exists, this is fine
    console.log(`  ATA already exists or creation skipped: ${e.message?.substring(0, 80)}`);
  }

  // Free World Cup tier: service_level_id=1 (u16), weeks=4
  const SERVICE_LEVEL_ID = 1;
  const WEEKS = 4;
  const SELECTED_LEAGUES: number[] = [];

  console.log(`\nSubmitting on-chain subscribe tx (serviceLevel=${SERVICE_LEVEL_ID}, weeks=${WEEKS})...`);
  let txSig: string;
  try {
    txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, WEEKS)
      .accounts({
        user: payer.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: TXL_TOKEN_MINT,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`✓ Subscription tx confirmed: ${txSig}`);
    console.log(`  https://solscan.io/tx/${txSig}?cluster=devnet`);
  } catch (err: any) {
    console.error("Subscription failed:", err?.message || err);
    process.exit(1);
  }

  // Sign activation message: `${txSig}:${leagues.join(",")}:${jwt}`
  // For empty leagues this is `${txSig}::${jwt}`
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const messageBytes = new TextEncoder().encode(messageString);
  console.log(`\nSigning: "${messageString}"`);

  const sigBytes = nacl.sign.detached(messageBytes, payer.secretKey);
  const walletSignature = Buffer.from(sigBytes).toString("base64");

  console.log("Activating API token...");
  try {
    const activationResponse = await axios.post(
      `${API_BASE_URL}/token/activate`,
      { txSig, walletSignature, leagues: SELECTED_LEAGUES },
      { headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" } }
    );

    // Strip any surrounding quotes the server may include in the response
    let rawToken: string = activationResponse.data.token || JSON.stringify(activationResponse.data);
    const apiToken = rawToken.replace(/^"+|"+$/g, "");  // strip leading/trailing quotes
    console.log("\n==================================================");
    console.log("✓ ACTIVATION SUCCESSFUL!");
    console.log(`  JWT:       ${jwt.substring(0, 20)}...`);
    console.log(`  API Token: ${apiToken.substring(0, 20)}...`);
    console.log("==================================================\n");

    // Write to .env.local in project root
    const envPath = path.join(__dirname, "..", ".env.local");
    const envContent = `TXLINE_JWT="${jwt}"\nTXLINE_API_TOKEN="${apiToken}"\n`;
    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log(`Saved to: ${envPath}`);

    // Also write to frontend/.env.local
    const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env.local");
    const frontendEnvContent = [
      `NEXT_PUBLIC_SOLANA_RPC="https://api.devnet.solana.com"`,
      `NEXT_PUBLIC_TXLINE_API_BASE="https://txline-dev.txodds.com/api"`,
      `NEXT_PUBLIC_PROGRAM_ID="GL1neprog1111111111111111111111111111111111"`,
      `TXLINE_JWT="${jwt}"`,
      `TXLINE_API_TOKEN="${apiToken}"`,
    ].join("\n") + "\n";
    fs.writeFileSync(frontendEnvPath, frontendEnvContent, "utf-8");
    console.log(`Saved to: ${frontendEnvPath}`);
    console.log("\nRun `npm run test-stream` to verify the live data stream.");
  } catch (err: any) {
    console.error("Activation failed:", err.response?.data || err.message);
    process.exit(1);
  }
}

run();
