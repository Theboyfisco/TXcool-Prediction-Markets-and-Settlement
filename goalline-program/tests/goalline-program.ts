import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GoallineProgram } from "../target/types/goalline_program";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("goalline-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.GoallineProgram as Program<GoallineProgram>;
  const wallet = provider.wallet as anchor.Wallet;

  // Derive Mint PDA
  const [mintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc-mint")],
    program.programId
  );

  // Derive User ATA
  const userAta = getAssociatedTokenAddressSync(
    mintPda,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  // Define market details
  const fixtureId = new anchor.BN(123456);
  const marketType = 0; // Match Result (Home Win)
  const closesAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  // Derive Market PDA
  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      fixtureId.toArrayLike(Buffer, "le", 8),
      Buffer.from([marketType]),
    ],
    program.programId
  );

  // Derive Vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPda.toBuffer()],
    program.programId
  );

  // Derive Bet PDA
  const [betPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );

  it("Initializes the test USDC Mint", async () => {
    try {
      const tx = await program.methods
        .initializeMint()
        .accounts({
          mint: mintPda,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("Initialize Mint transaction:", tx);
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Mints test USDC from the faucet", async () => {
    try {
      const tx = await program.methods
        .requestFaucet()
        .accounts({
          mint: mintPda,
          userTokenAccount: userAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("Request Faucet transaction:", tx);

      // Verify token balance
      const account = await getAccount(provider.connection, userAta);
      assert.equal(account.amount.toString(), (1000 * 1000000).toString());
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Creates a match market", async () => {
    try {
      const tx = await program.methods
        .createMarket(fixtureId, marketType, closesAt)
        .accounts({
          market: marketPda,
          vault: vaultPda,
          mint: mintPda,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("Create Market transaction:", tx);

      const marketAccount = await program.account.market.fetch(marketPda);
      assert.equal(marketAccount.fixtureId.toString(), fixtureId.toString());
      assert.equal(marketAccount.marketType, marketType);
      assert.equal(marketAccount.isSettled, false);
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Places a bet", async () => {
    try {
      const betAmount = new anchor.BN(100 * 1000000); // 100 USDC
      const prediction = true; // Yes (Home Win)

      const tx = await program.methods
        .placeBet(betAmount, prediction)
        .accounts({
          market: marketPda,
          bet: betPda,
          mint: mintPda,
          bettorTokenAccount: userAta,
          vault: vaultPda,
          bettor: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("Place Bet transaction:", tx);

      const betAccount = await program.account.bet.fetch(betPda);
      assert.equal(betAccount.amount.toString(), betAmount.toString());
      assert.equal(betAccount.prediction, prediction);
      assert.equal(betAccount.isClaimed, false);

      const marketAccount = await program.account.market.fetch(marketPda);
      assert.equal(marketAccount.totalYesAmount.toString(), betAmount.toString());
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
});
